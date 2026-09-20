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
    .filter(linha => !pareceCabecalho(linha))
    .map((linha, indice) => {
      const produto = encontrarProduto(linha, produtos);
      const valores = (linha.match(/\d+(?:[.,]\d{1,3})?/g) || []).map(numero).filter(v => v !== null);
      const quantidade = valores.length >= 3 ? valores[valores.length - 3] : valores[0] || "";
      const precoFatura = valores.length >= 2 ? valores[valores.length - 2] : "";

      return {
        id: `${Date.now()}-${foto}-${indice}-${Math.random().toString(36).slice(2)}`,
        foto,
        descricao: linha,
        produto: produto?.nome || "",
        quantidade,
        precoFatura,
        ignorar: false
      };
    });
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
    for (let i = 0; i < ficheiros.length; i += 1) {
      fotoAtual = i;
      const { data } = await worker.recognize(ficheiros[i]);
      resultados.push(...interpretarTextoFatura(data.text, produtos, i + 1));
      onProgress?.((i + 1) / ficheiros.length);
    }
  } finally {
    await worker.terminate();
  }

  return resultados;
}
