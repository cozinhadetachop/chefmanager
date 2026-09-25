import { createWorker } from "tesseract.js";

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function numero(valor) {
  const n = Number(String(valor).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function quantidadeNaUnidadeDoStock(linha, valor, unidadeFatura, produto, fimDescricao) {
  const unidadeStock = normalizar(produto?.unidade);
  if (!unidadeStock) return valor;
  const unidade = unidadeFatura.toLowerCase().replace("und", "un").replace("lt", "l");
  if (unidade === unidadeStock) return valor;

  // Uma caixa/embalagem não é automaticamente um quilograma ou um litro.
  // Só convertemos se o tamanho da embalagem estiver legível na descrição.
  if (["un", "cx", "pct"].includes(unidade) && ["kg", "g", "l", "ml"].includes(unidadeStock)) {
    const embalagens = [...linha.slice(0, fimDescricao).matchAll(/(\d+(?:[.,]\d{1,3})?)\s*(KG|G|LT|L|ML)\b/gi)];
    const embalagem = embalagens.at(-1);
    if (!embalagem) return "";
    const medida = embalagem[2].toLowerCase().replace("lt", "l");
    if (["kg", "g"].includes(medida) !== ["kg", "g"].includes(unidadeStock)) return "";
    const fatores = { kg: 1000, g: 1, l: 1000, ml: 1 };
    return Math.round(valor * numero(embalagem[1]) * fatores[medida] / fatores[unidadeStock] * 1000) / 1000;
  }

  // Se as unidades não coincidirem, a quantidade requer confirmação manual.
  return "";
}

function encontrarProduto(linha, produtos) {
  const texto = normalizar(linha);
  const correspondencias = produtos
    .map(produto => ({ produto, nome: normalizar(produto.nome) }))
    .filter(item => item.nome.length >= 3 && texto.includes(item.nome))
    .sort((a, b) => b.nome.length - a.nome.length);

  if (correspondencias.length) return correspondencias[0].produto;

  const palavrasLinha = new Set(texto.split(" ").filter(p => p.length >= 3));
  let melhor = null;
  let melhorPontuacao = 0;

  produtos.forEach(produto => {
    const palavrasProduto = normalizar(produto.nome).split(" ").filter(p => p.length >= 3);
    if (!palavrasProduto.length) return;
    const coincidentes = palavrasProduto.filter(p => palavrasLinha.has(p)).length;
    const pontuacao = coincidentes / palavrasProduto.length;
    if (coincidentes > 0 && pontuacao > melhorPontuacao) {
      melhor = produto;
      melhorPontuacao = pontuacao;
    }
  });

  return melhorPontuacao >= 0.66 ? melhor : null;
}

function pareceCabecalho(linha) {
  const texto = normalizar(linha);
  return [
    "descricao", "designacao", "artigo", "quantidade", "preco unitario",
    "subtotal", "total", "iva", "nif", "contribuinte", "fatura", "factura",
    "transportar", "pagamento", "iban"
  ].some(termo => texto.includes(termo));
}

export function interpretarTextoFatura(texto, produtos, foto) {
  const linhasTexto = String(texto || "")
    .split(/\r?\n/)
    .map(linha => linha.replace(/\s+/g, " ").trim());
  const linhaDeposito = linhasTexto.find(linha => /\bdep[oó]sito\s*sdr\b/i.test(linha));
  const garrafasDeposito = numero(linhaDeposito?.match(/(\d+(?:[.,]\d{1,3})?)\s*(?:UNID|UND|UN)\b/i)?.[1] || "");
  const linhasAguaSDR = linhasTexto.filter(linha => /\b[aá]gua\b/i.test(linha) && /\bSDR\b/i.test(linha));

  return linhasTexto
    .filter(linha => linha.length >= 4 && /[a-záàâãéêíóôõúç]/i.test(linha) && /\d/.test(linha))
    .filter(linha => !pareceCabecalho(linha) && !/\bdep[oó]sito\s*sdr\b/i.test(linha))
    .map((linha, indice) => {
      const produto = encontrarProduto(linha, produtos);
      // As faturas com colunas Vol / Qt.Vol / Qt.Total repetem a unidade.
      // A última quantidade acompanhada de unidade é a quantidade total;
      // os números que se seguem são preços, IVA e outros valores.
      const quantidades = [...linha.matchAll(/(\d+(?:[.,]\d{1,3})?)\s*(KG|G|LT|L|ML|UNID|UND|UN|CX|PCT)\b/gi)];
      const total = quantidades.at(-1);
      // Neste fornecedor, cada pack de Água Serrana 0,5 L tem 24 garrafas.
      // Só preenchemos automaticamente se o depósito confirmar a conversão
      // e houver uma única linha de água SDR nesta fotografia.
      const packs = total ? numero(total[1]) : null;
      const depositoConfirma = produto && /agua serrana/.test(normalizar(produto.nome))
        && normalizar(produto.unidade) === "un" && linhasAguaSDR.length === 1
        && packs > 0 && garrafasDeposito === packs * 24;
      const quantidade = depositoConfirma ? garrafasDeposito : /\bSDR\b/i.test(linha) ? "" : total
        ? quantidadeNaUnidadeDoStock(linha, numero(total[1]), total[2], produto, total.index)
        : "";
      const depoisDaQuantidade = total ? linha.slice(total.index + total[0].length) : "";
      const preco = depoisDaQuantidade.match(/\d+[.,]\d{2}\b/);
      const precoFatura = preco ? (depositoConfirma
        ? Math.round(numero(preco[0]) / 24 * 10000) / 10000
        : numero(preco[0])) : "";

      return {
        id: `${Date.now()}-${foto}-${indice}-${Math.random().toString(36).slice(2)}`,
        foto,
        descricao: depositoConfirma ? `${linha} · ${packs} packs × 24 garrafas` : linha,
        produto: produto?.nome || "",
        quantidade,
        precoFatura,
        ignorar: false
      };
    })
    // Uma linha sem quantidade/preço só é mostrada quando parece um artigo
    // cuja leitura ficou incompleta. Evita confundir datas e rodapés com stock.
    .filter(linha => (linha.quantidade !== "" && linha.precoFatura !== "")
      || /^\d{3,8}\s+[a-záàâãéêíóôõúç]{3}/i.test(linha.descricao)
      || (linha.produto && /\d/.test(linha.descricao)));
}

async function prepararImagem(ficheiro, graus) {
  const imagem = await createImageBitmap(ficheiro);
  try {
    const rodada = Math.abs(graus) % 180 === 90;
    const largura = rodada ? imagem.height : imagem.width;
    const altura = rodada ? imagem.width : imagem.height;
    const escala = Math.min(2, Math.max(1, 2800 / Math.max(largura, altura)));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(largura * escala);
    canvas.height = Math.round(altura * escala);
    const contexto = canvas.getContext("2d");
    if (!contexto) throw new Error("Não foi possível preparar a fotografia.");
    contexto.fillStyle = "white";
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    contexto.translate(canvas.width / 2, canvas.height / 2);
    contexto.rotate(graus * Math.PI / 180);
    contexto.drawImage(imagem, -imagem.width * escala / 2, -imagem.height * escala / 2,
      imagem.width * escala, imagem.height * escala);
    return canvas;
  } finally {
    imagem.close?.();
  }
}

async function lerAguaEmColunas(ficheiro, worker, produtos, foto) {
  const lerColuna = async (graus, inicioX, fimX) => {
    const imagem = await prepararImagem(ficheiro, graus);
    const recorte = document.createElement("canvas");
    const x = Math.round(imagem.width * inicioX);
    const y = Math.round(imagem.height * 0.25);
    const largura = Math.round(imagem.width * (fimX - inicioX));
    const altura = Math.round(imagem.height * 0.18);
    recorte.width = largura * 2;
    recorte.height = altura * 2;
    recorte.getContext("2d").drawImage(imagem, x, y, largura, altura,
      0, 0, recorte.width, recorte.height);
    const { data } = await worker.recognize(recorte);
    return data.text;
  };

  await worker.setParameters({ tessedit_pageseg_mode: "6" });
  const nomes = await lerColuna(4, 0.02, 0.54);
  const numeros = await lerColuna(0, 0.49, 0.99);
  const linhaAgua = nomes.split(/\r?\n/).find(linha => /agua\s+serrana/i.test(normalizar(linha)));
  if (!linhaAgua) return [];
  const valores = [...numeros.matchAll(/(\d+(?:[.,]\d{1,3})?)\s*(?:UNID|UND|UN)\b/gi)]
    .map(resultado => ({ quantidade: numero(resultado[1]), fim: resultado.index + resultado[0].length }));
  const depositoConfirma = /depo/i.test(nomes) && valores.length === 2
    && valores[0].quantidade > 0 && valores[1].quantidade === valores[0].quantidade * 24;
  const preco = depositoConfirma ? numeros.slice(valores[0].fim).match(/\b\d+[.,]\d{2}\b/) : null;
  const produto = encontrarProduto(linhaAgua, produtos);
  // Se o OCR não confirmar ambos os números, mostra a água para revisão.
  // O valor SDR nunca gera uma linha de stock.
  return [{
    id: `${Date.now()}-${foto}-agua-${Math.random().toString(36).slice(2)}`,
    foto,
    descricao: depositoConfirma
      ? `${linhaAgua.trim()} · ${valores[0].quantidade} packs × 24 garrafas (depósito SDR conferido)`
      : `${linhaAgua.trim()} · Confirma a quantidade de garrafas na fatura`,
    produto: produto && /agua serrana/.test(normalizar(produto.nome)) ? produto.nome : "",
    quantidade: depositoConfirma ? valores[1].quantidade : "",
    precoFatura: preco ? Math.round(numero(preco[0]) / 24 * 10000) / 10000 : "",
    ignorar: false
  }];
}

export async function lerFotografias(ficheiros, produtos, onProgress) {
  const resultados = [];
  let fotoAtual = 0;
  const worker = await createWorker("por", undefined, {
    logger: mensagem => {
      if (mensagem.status === "recognizing text") {
        const progressoFoto = Number(mensagem.progress || 0);
        onProgress?.((fotoAtual + progressoFoto) / ficheiros.length);
      }
    }
  });

  try {
    // Mantém a descrição e as quantidades da mesma linha na fatura tabular.
    await worker.setParameters({ tessedit_pageseg_mode: "6" });
    for (let i = 0; i < ficheiros.length; i += 1) {
      fotoAtual = i;
      let melhor = [];
      for (const [tentativa, graus] of [0, 90, 270].entries()) {
        const imagem = await prepararImagem(ficheiros[i], graus);
        const { data } = await worker.recognize(imagem);
        const linhas = interpretarTextoFatura(data.text, produtos, i + 1);
        const linhasComQuantidade = linhas.filter(linha => linha.quantidade !== "");
        const pontuacao = lista => lista.filter(linha => linha.quantidade !== "" && linha.precoFatura !== "").length * 10
          + lista.filter(linha => linha.produto).length * 2 + lista.length;
        if (pontuacao(linhas) > pontuacao(melhor)) {
          melhor = linhas;
        }
        onProgress?.((i + (tentativa + 1) / 3) / ficheiros.length);
        if (linhasComQuantidade.length >= 2
          || (tentativa === 0 && linhas.some(linha => linha.produto && /^\d{3,8}\s+/i.test(linha.descricao)))) break;
      }
      if (!melhor.some(linha => /agua serrana/.test(normalizar(linha.produto))
        && linha.quantidade !== "")) {
        const aguaEmColunas = await lerAguaEmColunas(ficheiros[i], worker, produtos, i + 1);
        if (aguaEmColunas.length) melhor = [...melhor.filter(linha =>
          !/agua serrana/.test(normalizar(linha.produto || linha.descricao))), ...aguaEmColunas];
      }
      resultados.push(...melhor);
      onProgress?.((i + 1) / ficheiros.length);
    }
  } finally {
    await worker.terminate();
  }

  return resultados;
}



function numeroFaladoPt(texto) {
  const limpo = normalizar(texto);
  if (!limpo) return null;

  const diretos = {
    zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
    seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12,
    treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezasseis: 16,
    dezessete: 17, dezassete: 17, dezoito: 18, dezanove: 19, dezenove: 19,
    vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60,
    setenta: 70, oitenta: 80, noventa: 90, cem: 100
  };

  if (Object.prototype.hasOwnProperty.call(diretos, limpo)) return diretos[limpo];

  const decimal = limpo.match(/^(.+?)\s+virgula\s+(.+)$/);
  if (decimal) {
    const inteiro = numeroFaladoPt(decimal[1]);
    const frac = numeroFaladoPt(decimal[2]);
    if (inteiro !== null && frac !== null) {
      const casas = String(Math.trunc(frac)).length;
      return inteiro + frac / (10 ** casas);
    }
  }

  const partes = limpo.split(/\s+e\s+/);
  if (partes.length === 2 && diretos[partes[0]] >= 20 && diretos[partes[0]] < 100
      && diretos[partes[1]] > 0 && diretos[partes[1]] < 10) {
    return diretos[partes[0]] + diretos[partes[1]];
  }

  return null;
}

function separarItensFalados(texto) {
  return String(texto || "")
    .replace(/,\s+(?=[A-Za-zÀ-ÿ])/g, "\n")
    .replace(/;\s*/g, "\n");
}



function singularizarPalavra(palavra) {
  const p = normalizar(palavra);
  if (p.length <= 3) return p;
  if (p.endsWith("oes")) return p.slice(0, -3) + "ao";
  if (p.endsWith("ais")) return p.slice(0, -3) + "al";
  if (p.endsWith("eis")) return p.slice(0, -3) + "el";
  if (p.endsWith("res") && p.length > 5) return p.slice(0, -2);
  if (p.endsWith("s") && !p.endsWith("ss")) return p.slice(0, -1);
  return p;
}

function tokensProduto(texto) {
  const ignorar = new Set([
    "de", "da", "do", "das", "dos", "com", "sem", "para",
    "kg", "g", "gr", "l", "lt", "ml", "cl", "un", "uni", "unid",
    "quilo", "quilos", "quilograma", "quilogramas",
    "grama", "gramas", "litro", "litros",
    "unidade", "unidades", "caixa", "caixas", "pacote", "pacotes",
    "garrafa", "garrafas", "saco", "sacos",
    "cx", "pct", "pack", "tam"
  ]);

  return normalizar(texto)
    .split(/\s+/)
    .map(singularizarPalavra)
    .filter(token => token && token.length >= 2 && !ignorar.has(token) && !/^\d/.test(token));
}

function distanciaLevenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
  const atual = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    atual[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      atual[j] = Math.min(
        atual[j - 1] + 1,
        anterior[j] + 1,
        anterior[j - 1] + custo
      );
    }
    for (let j = 0; j <= b.length; j += 1) anterior[j] = atual[j];
  }

  return anterior[b.length];
}

function semelhancaPalavra(a, b) {
  if (a === b) return 1;
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return 0.9;
  const maior = Math.max(a.length, b.length);
  if (!maior) return 0;
  return 1 - distanciaLevenshtein(a, b) / maior;
}

function candidatosProdutoFalado(descricao, produtos) {
  const descricaoTokens = tokensProduto(descricao);
  if (!descricaoTokens.length) return [];

  return produtos
    .map(produto => {
      const produtoTokens = tokensProduto(produto.nome);
      if (!produtoTokens.length) return { produto, score: 0 };

      const scoresDescricao = descricaoTokens.map(tokenDescricao =>
        Math.max(...produtoTokens.map(tokenProduto => semelhancaPalavra(tokenDescricao, tokenProduto)))
      );

      const coberturaDescricao = scoresDescricao.reduce((a, b) => a + b, 0) / scoresDescricao.length;
      const exatos = descricaoTokens.filter(td => produtoTokens.includes(td)).length;
      const coberturaExata = exatos / descricaoTokens.length;

      const nomeBase = produtoTokens.join(" ");
      const descBase = descricaoTokens.join(" ");
      let bonus = 0;
      if (nomeBase === descBase) bonus += 0.45;
      else if (nomeBase.includes(descBase) || descBase.includes(nomeBase)) bonus += 0.18;

      const score = Math.min(1, coberturaDescricao * 0.65 + coberturaExata * 0.35 + bonus);
      return { produto, score };
    })
    .filter(item => item.score >= 0.42)
    .sort((a, b) => b.score - a.score || String(a.produto.nome).localeCompare(String(b.produto.nome), "pt-PT"));
}

function associarProdutoFalado(descricao, produtos) {
  const candidatos = candidatosProdutoFalado(descricao, produtos);
  if (!candidatos.length) return { produto: null, sugestoes: [] };

  const primeiro = candidatos[0];
  const segundo = candidatos[1];
  const vantagem = segundo ? primeiro.score - segundo.score : primeiro.score;

  const seguro =
    primeiro.score >= 0.9 ||
    (primeiro.score >= 0.68 && (!segundo || vantagem >= 0.12)) ||
    (!segundo && primeiro.score >= 0.55);

  return {
    produto: seguro ? primeiro.produto : null,
    sugestoes: candidatos.slice(0, 3).map(item => item.produto.nome)
  };
}


function quantidadeFaladoNosTokens(tokens) {
  for (let i = 0; i < tokens.length; i += 1) {
    const nDireto = numero(tokens[i]);
    if (nDireto !== null && nDireto > 0) return nDireto;

    for (let tamanho = Math.min(5, tokens.length - i); tamanho >= 1; tamanho -= 1) {
      const n = numeroFaladoPt(tokens.slice(i, i + tamanho).join(" "));
      if (n !== null && n > 0) return n;
    }
  }
  return "";
}

function encontrarTodosProdutosNoDitado(texto, produtos, foto = 0) {
  const palavras = normalizar(texto).split(/\s+/).filter(Boolean);
  if (!palavras.length) return [];

  const grupos = new Map();

  (produtos || []).forEach(produto => {
    const tokens = tokensProduto(produto.nome);
    if (!tokens.length) return;
    const chave = tokens.join(" ");
    if (!grupos.has(chave)) grupos.set(chave, { tokens, produtos: [] });
    grupos.get(chave).produtos.push(produto);
  });

  const candidatos = [];

  grupos.forEach(grupo => {
    const alvo = grupo.tokens;
    if (!alvo.length || alvo.length > palavras.length) return;

    for (let inicio = 0; inicio <= palavras.length - alvo.length; inicio += 1) {
      let coincide = true;
      for (let j = 0; j < alvo.length; j += 1) {
        if (singularizarPalavra(palavras[inicio + j]) !== alvo[j]) {
          coincide = false;
          break;
        }
      }
      if (!coincide) continue;

      candidatos.push({
        inicio,
        fim: inicio + alvo.length,
        tamanho: alvo.length,
        grupo
      });
    }
  });

  if (!candidatos.length) return [];

  // Se "bacalhau" e "bacalhau a bras" começarem no mesmo ponto,
  // conserva a correspondência mais específica.
  candidatos.sort((a, b) => a.inicio - b.inicio || b.tamanho - a.tamanho);

  const ocorrencias = [];
  for (const candidato of candidatos) {
    const sobrepoe = ocorrencias.some(item =>
      candidato.inicio < item.fim && candidato.fim > item.inicio
    );
    if (!sobrepoe) ocorrencias.push(candidato);
  }

  ocorrencias.sort((a, b) => a.inicio - b.inicio);

  return ocorrencias.map((ocorrencia, indice) => {
    const seguinte = ocorrencias[indice + 1];
    const fimSegmento = seguinte ? seguinte.inicio : palavras.length;
    const depoisProduto = palavras.slice(ocorrencia.fim, fimSegmento);

    // Normalmente a quantidade é dita depois do produto.
    let quantidade = quantidadeFaladoNosTokens(depoisProduto);

    // Se não houver quantidade depois, tenta o pequeno espaço imediatamente
    // antes do produto, útil para ditados como "dois quilos cebola".
    if (quantidade === "") {
      const anterior = ocorrencias[indice - 1];
      const inicioAnterior = anterior ? anterior.fim : Math.max(0, ocorrencia.inicio - 6);
      quantidade = quantidadeFaladoNosTokens(palavras.slice(inicioAnterior, ocorrencia.inicio));
    }

    const opcoes = ocorrencia.grupo.produtos;
    const produtoSeguro = opcoes.length === 1 ? opcoes[0] : null;

    return {
      id: Date.now() + "-catalogo-" + foto + "-" + indice + "-" + Math.random().toString(36).slice(2),
      foto,
      descricao: palavras.slice(ocorrencia.inicio, fimSegmento).join(" "),
      produto: produtoSeguro?.nome || "",
      quantidade,
      sugestoes: opcoes.slice(0, 3).map(p => p.nome)
    };
  });
}

export function interpretarDitadoSaidas(texto, produtos, foto = 0) {
  const original = String(texto || "").trim();
  const normal = normalizar(original);
  if (!normal) return [];

  // Primeiro percorre o ditado inteiro à procura de TODOS os produtos
  // existentes no catálogo. Esta via evita que apenas o primeiro produto
  // seja devolvido quando a lista é dita toda seguida.
  const produtosEncontrados = encontrarTodosProdutosNoDitado(original, produtos, foto);
  if (produtosEncontrados.length >= 2) return produtosEncontrados;

  const palavras = normal.split(/\s+/).filter(Boolean);
  const itens = [];
  let inicioDescricao = 0;
  let i = 0;

  while (i < palavras.length) {
    let quantidade = null;
    let tamanhoNumero = 0;

    const numerico = numero(palavras[i]);
    if (numerico !== null && numerico > 0) {
      quantidade = numerico;
      tamanhoNumero = 1;
    } else {
      for (let tamanho = Math.min(5, palavras.length - i); tamanho >= 1; tamanho -= 1) {
        const candidato = palavras.slice(i, i + tamanho).join(" ");
        const n = numeroFaladoPt(candidato);
        if (n !== null && n > 0) {
          quantidade = n;
          tamanhoNumero = tamanho;
          break;
        }
      }
    }

    if (quantidade !== null) {
      const descricao = palavras.slice(inicioDescricao, i).join(" ").trim();

      if (descricao) {
        const associacao = associarProdutoFalado(descricao, produtos);

        itens.push({
          id: Date.now() + "-ditado-" + foto + "-" + itens.length + "-" + Math.random().toString(36).slice(2),
          foto,
          descricao: descricao + " " + palavras.slice(i, i + tamanhoNumero).join(" "),
          produto: associacao.produto?.nome || "",
          quantidade,
          sugestoes: associacao.sugestoes
        });
      }

      i += tamanhoNumero;

      // Depois da quantidade, ignora a unidade falada para que o próximo
      // produto comece limpo: "arroz dois quilos batata cinco quilos".
      const unidadesFaladas = new Set([
        "kg", "quilo", "quilos", "quilograma", "quilogramas",
        "g", "gr", "grama", "gramas",
        "l", "lt", "litro", "litros",
        "ml", "cl",
        "un", "uni", "unid", "unidade", "unidades",
        "cx", "caixa", "caixas",
        "pct", "pacote", "pacotes",
        "pack", "garrafa", "garrafas", "saco", "sacos"
      ]);

      while (i < palavras.length && unidadesFaladas.has(palavras[i])) {
        i += 1;
      }

      // Também tolera um "e" natural entre itens:
      // "arroz dois quilos e batata cinco quilos".
      if (palavras[i] === "e") i += 1;

      inicioDescricao = i;
      continue;
    }

    i += 1;
  }

  if (itens.length) return itens;
  return interpretarTextoSaidas(original, produtos, foto);
}

export function interpretarTextoSaidas(texto, produtos, foto = 0) {
  const linhas = separarItensFalados(texto)
    .split(/\r?\n/)
    .map(linha => linha.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return linhas.map((linha, indice) => {
    const produto = encontrarProduto(linha, produtos);
    const semProduto = produto
      ? normalizar(linha).replace(normalizar(produto.nome), " ").trim()
      : normalizar(linha);

    let quantidade = "";
    const mFim = linha.match(/(?:^|\s|[;:=xX-])(-?\d+(?:[.,]\d{1,3})?)\s*(?:kg|g|l|ml|un|und|unid|cx|pct)?\s*$/i);
    if (mFim) {
      const n = numero(mFim[1]);
      if (n !== null && n > 0) quantidade = n;
    } else {
      const numeros = [...semProduto.matchAll(/\b(\d+(?:[.,]\d{1,3})?)\b/g)];
      if (numeros.length === 1) {
        const n = numero(numeros[0][1]);
        if (n !== null && n > 0) quantidade = n;
      }

      if (quantidade === "") {
        const palavras = semProduto.split(/\s+/).filter(Boolean);
        for (let tamanho = Math.min(4, palavras.length); tamanho >= 1; tamanho -= 1) {
          const candidato = palavras.slice(-tamanho).join(" ");
          const n = numeroFaladoPt(candidato);
          if (n !== null && n > 0) {
            quantidade = n;
            break;
          }
        }
      }
    }

    return {
      id: `${Date.now()}-saida-${foto}-${indice}-${Math.random().toString(36).slice(2)}`,
      foto,
      descricao: linha,
      produto: produto?.nome || "",
      quantidade
    };
  }).filter(linha => linha.produto || linha.quantidade !== "");
}

export async function lerFotografiasSaidas(ficheiros, produtos, onProgress) {
  const resultados = [];
  let fotoAtual = 0;
  const worker = await createWorker("por", undefined, {
    logger: mensagem => {
      if (mensagem.status === "recognizing text") {
        const progressoFoto = Number(mensagem.progress || 0);
        onProgress?.((fotoAtual + progressoFoto) / ficheiros.length);
      }
    }
  });

  try {
    await worker.setParameters({ tessedit_pageseg_mode: "6" });

    for (let i = 0; i < ficheiros.length; i += 1) {
      fotoAtual = i;
      let melhor = [];

      for (const [tentativa, graus] of [0, 90, 270].entries()) {
        const imagem = await prepararImagem(ficheiros[i], graus);
        const { data } = await worker.recognize(imagem);
        const linhas = interpretarTextoSaidas(data.text, produtos, i + 1);

        const pontuacao = lista =>
          lista.filter(linha => linha.produto && linha.quantidade !== "").length * 10
          + lista.filter(linha => linha.produto).length * 3
          + lista.length;

        if (pontuacao(linhas) > pontuacao(melhor)) melhor = linhas;
        onProgress?.((i + (tentativa + 1) / 3) / ficheiros.length);

        if (linhas.filter(linha => linha.produto && linha.quantidade !== "").length >= 2) break;
      }

      resultados.push(...melhor);
      onProgress?.((i + 1) / ficheiros.length);
    }
  } finally {
    await worker.terminate();
  }

  return resultados;
}
