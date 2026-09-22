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
  return String(texto || "")
    .split(/\r?\n/)
    .map(linha => linha.replace(/\s+/g, " ").trim())
    .filter(linha => linha.length >= 4 && /[a-záàâãéêíóôõúç]/i.test(linha) && /\d/.test(linha))
    .filter(linha => !pareceCabecalho(linha) && !/\bdep[oó]sito\s*sdr\b/i.test(linha))
    .map((linha, indice) => {
      const produto = encontrarProduto(linha, produtos);
      // As faturas com colunas Vol / Qt.Vol / Qt.Total repetem a unidade.
      // A última quantidade acompanhada de unidade é a quantidade total;
      // os números que se seguem são preços, IVA e outros valores.
      const quantidades = [...linha.matchAll(/(\d+(?:[.,]\d{1,3})?)\s*(KG|G|LT|L|ML|UNID|UND|UN|CX|PCT)\b/gi)];
      const total = quantidades.at(-1);
      // Uma linha SDR pode faturar packs, enquanto o stock conta garrafas.
      // Sem conhecer a embalagem, pedimos a quantidade na unidade do stock.
      const quantidade = /\bSDR\b/i.test(linha) ? "" : total
        ? quantidadeNaUnidadeDoStock(linha, numero(total[1]), total[2], produto, total.index)
        : "";
      const depoisDaQuantidade = total ? linha.slice(total.index + total[0].length) : "";
      const preco = depoisDaQuantidade.match(/\d+[.,]\d{2}\b/);
      const precoFatura = preco ? numero(preco[0]) : "";

      return {
        id: `${Date.now()}-${foto}-${indice}-${Math.random().toString(36).slice(2)}`,
        foto,
        descricao: linha,
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
        if (linhasComQuantidade.length > melhor.filter(linha => linha.quantidade !== "").length) {
          melhor = linhas;
        }
        onProgress?.((i + (tentativa + 1) / 3) / ficheiros.length);
        if (linhasComQuantidade.length >= 2) break;
      }
      // Faturas com texto pequeno e folha inclinada podem não produzir
      // nenhuma linha completa na leitura normal. Tentamos alinhar a foto
      // e ler blocos dispersos antes de desistir.
      if (!melhor.some(linha => linha.quantidade !== "" && linha.precoFatura !== "")) {
        await worker.setParameters({ tessedit_pageseg_mode: "11" });
        for (const graus of [4, -4]) {
          const imagem = await prepararImagem(ficheiros[i], graus);
          const { data } = await worker.recognize(imagem);
          const linhas = interpretarTextoFatura(data.text, produtos, i + 1);
          const pontuacao = lista => lista.filter(linha => linha.quantidade !== "" && linha.precoFatura !== "").length * 2 + lista.filter(linha => linha.produto).length;
          if (pontuacao(linhas) > pontuacao(melhor)) melhor = linhas;
          if (pontuacao(melhor) >= 3) break;
        }
        await worker.setParameters({ tessedit_pageseg_mode: "6" });
      }
      resultados.push(...melhor);
      onProgress?.((i + 1) / ficheiros.length);
    }
  } finally {
    await worker.terminate();
  }

  return resultados;
}
