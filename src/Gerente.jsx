import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

/* ✅ PDF */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ===== Estilos ===== */
const styles = {
  app: { minHeight: "100vh", maxWidth: 1240, margin: "0 auto", padding: "18px 18px 34px", fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  card: { border: "1px solid #dfe5da", borderRadius: 18, padding: 18, marginBottom: 14, background: "rgba(255,255,255,.94)", boxShadow: "0 6px 18px rgba(49,67,42,.055)" },
  input: { minHeight: 46, maxWidth: "100%", padding: "10px 13px", margin: "2px 0", border: "1px solid #dce3d7", borderRadius: 11, background: "white", color: "#1f2a1d", fontSize: 16 },
  button: { minHeight: 46, padding: "10px 15px", border: "1px solid #536b45", borderRadius: 11, background: "linear-gradient(135deg, #5d774d, #49633d)", color: "white", fontSize: 15, fontWeight: 750, cursor: "pointer", boxShadow: "0 4px 10px rgba(73,99,61,.14)" },
  secondary: { background: "white", color: "#34452d", borderColor: "#dce3d7", boxShadow: "none" },
  danger: { backgroundColor: "#b42318", borderColor: "#b42318", color: "white" },
  warning: { color: "#e53935", fontWeight: "bold" },
  produtoLinha: { cursor: "pointer", fontWeight: "bold", padding: "6px 0" },

  /* tabela alertas */
  table: { width: "100%", borderCollapse: "collapse", marginTop: 8 },
  th: { textAlign: "left", borderBottom: "1px solid #ccc", padding: "6px 4px" },
  td: { padding: "6px 4px", borderBottom: "1px solid #f0f0f0" },

  /* tabela produtos */
  tdRight: { padding: "6px 4px", borderBottom: "1px solid #f0f0f0", textAlign: "right" },
  rowBad: { backgroundColor: "#fff3f3" },

  /* ✅ tabela produtos (melhor visual) */
  tableProdutos: { width: "100%", borderCollapse: "collapse", marginTop: 8, tableLayout: "fixed" },
  thProdutos: {
    textAlign: "left",
    borderBottom: "1px solid #ccc",
    padding: "10px 8px",
    fontSize: 13,
    whiteSpace: "nowrap"
  },
  tdProdutos: {
    padding: "10px 8px",
    borderBottom: "1px solid #f0f0f0",
    verticalAlign: "middle"
  },
  tdProdutosRight: {
    padding: "10px 8px",
    borderBottom: "1px solid #f0f0f0",
    textAlign: "right",
    verticalAlign: "middle"
  },
  nomeProdutoCell: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },

  /* ✅ tabelas histórico (mais limpas) */
  tableHist: { width: "100%", borderCollapse: "collapse", marginTop: 8, tableLayout: "fixed" },
  thHist: {
    textAlign: "left",
    borderBottom: "1px solid #ccc",
    padding: "8px 6px",
    fontSize: 13,
    whiteSpace: "nowrap"
  },
  tdHist: {
    padding: "8px 6px",
    borderBottom: "1px solid #f0f0f0",
    verticalAlign: "middle",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  tdHistRight: {
    padding: "8px 6px",
    borderBottom: "1px solid #f0f0f0",
    textAlign: "right",
    verticalAlign: "middle",
    whiteSpace: "nowrap"
  }
};

/* ===== Unidades (normalizadas) ===== */
const UNIDADES = [
  { value: "kg", label: "kg" },
  { value: "g", label: "g" },
  { value: "l", label: "L" },
  { value: "ml", label: "mL" },
  { value: "un", label: "un" },
  { value: "cx", label: "cx" },
  { value: "pct", label: "pct" }
];

function normalizeUnidade(u) {
  const x = (u ?? "").toString().trim().toLowerCase();

  // mapeamento defensivo (para dados antigos já gravados com variações)
  if (!x) return "";
  if (["kg", "kgs", "quilo", "quilos", "kg.", "kgs."].includes(x)) return "kg";
  if (["g", "gr", "grama", "gramas", "g."].includes(x)) return "g";
  if (["l", "lt", "lts", "litro", "litros", "l."].includes(x)) return "l";
  if (["ml", "mls", "mililitro", "mililitros", "ml."].includes(x)) return "ml";
  if (["un", "uni", "unidade", "unidades"].includes(x)) return "un";
  if (["cx", "caixa", "caixas"].includes(x)) return "cx";
  if (["pct", "pacote", "pacotes"].includes(x)) return "pct";

  // se vier algo fora do esperado, mantém (para não quebrar)
  return x;
}

function fmtNum(v, casas = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(casas);
}

function mostrarErro(acao, erro) {
  console.error(acao, erro);
  window.alert(`${acao}: ${erro?.message || "Ocorreu um erro inesperado. Tenta novamente."}`);
}

export default function Gerente({ onLogout }) {
  /* ===== ESTADOS ===== */
  const [produtos, setProdutos] = useState([]);
  const [entradas, setEntradas] = useState([]);
  const [saidas, setSaidas] = useState([]);
  const [erroSaidas, setErroSaidas] = useState("");
  const [aAtualizarSaidas, setAAtualizarSaidas] = useState(false);
  const [saidasAtualizadasEm, setSaidasAtualizadasEm] = useState(null);
  const [inventarioReal, setInventarioReal] = useState({});
  const [inventarioConfirmado, setInventarioConfirmado] = useState({});
  const [ajustesInventario, setAjustesInventario] = useState([]);
  const [historicoInventarioAberto, setHistoricoInventarioAberto] = useState(false);
  const [inventarioAjustado, setInventarioAjustado] = useState({});
  const [stockCarregado, setStockCarregado] = useState(false);
  const [erroStock, setErroStock] = useState("");
  const [produtoAberto, setProdutoAberto] = useState(null);
  const [area, setArea] = useState("stock");

  /* ✅ Avisos começam fechados */
  const [avisosAbertos, setAvisosAbertos] = useState(false);

  /* ✅ Toggles históricos (começam fechados) */
  const [entradasAbertas, setEntradasAbertas] = useState(false);
  const [saidasAbertas, setSaidasAbertas] = useState(true);

  const [produtoNovo, setProdutoNovo] = useState({
    nome: "",
    unidade: "",
    procedencia: "",
    minimo: "",
    preco_unit: ""
  });

  const [entradaNova, setEntradaNova] = useState({
    produto: "",
    quantidade: "",
    datahora: new Date().toISOString()
  });
  const [pesquisaEntrada, setPesquisaEntrada] = useState("");

  /* ✅ ENTRADA POR FOTOGRAFIA / FATURA */
  const [fotografiasEntrada, setFotografiasEntrada] = useState([]);
  const [linhasFaturaEntrada, setLinhasFaturaEntrada] = useState([]);
  const [aLerFaturaEntrada, setALerFaturaEntrada] = useState(false);
  const [progressoFaturaEntrada, setProgressoFaturaEntrada] = useState(0);
  const [aRegistarFaturaEntrada, setARegistarFaturaEntrada] = useState(false);

  /* ✅ INVENTÁRIO MENSAL (RÁPIDO) */
  const [modoInventarioMensal, setModoInventarioMensal] = useState(false);
  const [inventarioMes, setInventarioMes] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [inventarioEdicao, setInventarioEdicao] = useState({}); // { produto: "12.3" }
  const [inventarioColar, setInventarioColar] = useState("");
  const [inventarioFiltro, setInventarioFiltro] = useState("");
  const [motivoInventario, setMotivoInventario] = useState("");

  /* ===== FILTROS (INTERVALO) ===== */
  const [filtroEntradaDe, setFiltroEntradaDe] = useState("");
  const [filtroEntradaAte, setFiltroEntradaAte] = useState("");

  const [filtroDataSaidas, setFiltroDataSaidas] = useState(""); // Saídas: De
  const [filtroDataSaidasAte, setFiltroDataSaidasAte] = useState(""); // Saídas: Até

  /* ✅ ORGANIZAÇÃO PRODUTOS (COLAPSÁVEL + PESQUISA) */
  const [pesquisaProduto, setPesquisaProduto] = useState("");
  const [procedenciasAbertas, setProcedenciasAbertas] = useState({}); // { "Makro": true, ... }

  const produtosEntradaFiltrados = useMemo(() => {
    const termo = pesquisaEntrada.trim().toLocaleLowerCase("pt-PT");
    if (!termo) return produtos;
    return produtos.filter(produto =>
      `${produto.nome || ""} ${produto.procedencia || ""}`
        .toLocaleLowerCase("pt-PT")
        .includes(termo)
    );
  }, [produtos, pesquisaEntrada]);

  function numeroEntrada(valor) {
    const n = Number(String(valor ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  }

  function juntarFotografiasEntrada(event) {
    const novas = Array.from(event.target.files || []).filter(file => file.type.startsWith("image/"));
    setFotografiasEntrada(atuais => [...atuais, ...novas].slice(0, 10));
    event.target.value = "";
  }

  async function lerFaturaEntrada() {
    if (!fotografiasEntrada.length) {
      alert("Adiciona pelo menos uma fotografia.");
      return;
    }
    setALerFaturaEntrada(true);
    setProgressoFaturaEntrada(0);
    setLinhasFaturaEntrada([]);
    try {
      const { lerFotografias } = await import("./invoiceOcr");
      const linhas = await lerFotografias(fotografiasEntrada, produtos, setProgressoFaturaEntrada);
      setLinhasFaturaEntrada(linhas);
      if (!linhas.length) alert("Não foi possível identificar linhas de produtos. Podes continuar com a entrada manual.");
    } catch (error) {
      console.error(error);
      alert("Não foi possível ler estas fotografias. Confirma se estão nítidas e tenta novamente.");
    } finally {
      setALerFaturaEntrada(false);
    }
  }

  function atualizarLinhaFaturaEntrada(id, campo, valor) {
    setLinhasFaturaEntrada(linhas => linhas.map(linha => linha.id === id ? { ...linha, [campo]: valor } : linha));
  }

  async function registarEntradasDaFatura() {
    const pendentes = linhasFaturaEntrada.filter(
      linha => !linha.ignorar && (!linha.produto || !(numeroEntrada(linha.quantidade) > 0))
    );
    if (pendentes.length) {
      alert("Associa cada linha válida a um produto e confirma a quantidade. Remove as linhas que não interessam.");
      return;
    }

    const validas = linhasFaturaEntrada.filter(
      linha => !linha.ignorar && linha.produto && numeroEntrada(linha.quantidade) > 0
    );
    if (!validas.length) {
      alert("Não existem linhas válidas para registar.");
      return;
    }
    if (!window.confirm(`Confirmar ${validas.length} entrada(s) de stock a partir da fatura?`)) return;

    setARegistarFaturaEntrada(true);
    const agora = new Date().toISOString();
    const payload = validas.map(linha => ({
      produto: linha.produto,
      quantidade: numeroEntrada(linha.quantidade),
      datahora: agora
    }));
    const { error } = await supabase.from("entradas").insert(payload);
    setARegistarFaturaEntrada(false);

    if (error) {
      mostrarErro("Não foi possível registar as entradas da fatura", error);
      return;
    }

    setFotografiasEntrada([]);
    setLinhasFaturaEntrada([]);
    setProgressoFaturaEntrada(0);
    setPesquisaEntrada("");
    await fetchTudo();
    alert("Entradas da fatura registadas com sucesso.");
  }

  /* ===== FETCH ===== */
  useEffect(() => {
    fetchTudo();
  }, []);

  useEffect(() => {
    if (area !== "historico") return;
    fetchSaidas();
    const aoVoltar = () => fetchSaidas();
    const aoFicarVisivel = () => {
      if (document.visibilityState === "visible") fetchSaidas();
    };
    window.addEventListener("focus", aoVoltar);
    document.addEventListener("visibilitychange", aoFicarVisivel);
    const intervalo = window.setInterval(fetchSaidas, 30000);
    return () => {
      window.removeEventListener("focus", aoVoltar);
      document.removeEventListener("visibilitychange", aoFicarVisivel);
      window.clearInterval(intervalo);
    };
  }, [area]);

  async function fetchSaidas() {
    setAAtualizarSaidas(true);
    try {
      const { data, error } = await supabase.from("saidas").select("*").order("dataHora", { ascending: false });
      if (error) throw error;
      setSaidas(data || []);
      setSaidasAtualizadasEm(new Date());
      setErroSaidas("");
    } catch (error) {
      console.error(error);
      setErroSaidas("Não foi possível atualizar as saídas. Tenta novamente.");
    } finally {
      setAAtualizarSaidas(false);
    }
  }

  async function fetchTudo() {
    setErroStock("");
    // O Gerente e o Chef recebem as mesmas quantidades calculadas no Supabase.
    const { data: stock, error: erroConsultaStock } = await supabase.rpc("chef_stock_atual");
    if (erroConsultaStock || !Array.isArray(stock)) {
      console.error(erroConsultaStock);
      setErroStock("Não foi possível carregar o stock atual. Tenta novamente.");
      return;
    }

    const { data: p, error: erroProdutos } = await supabase.from("produtos").select("*").order("nome");
    const { data: e, error: erroEntradas } = await supabase.from("entradas").select("*").order("datahora", { ascending: false });
    const { data: s, error: erroSaidas } = await supabase.from("saidas").select("*").order("dataHora", { ascending: false });
    const { data: r, error: erroInventario } = await supabase.from("inventario_real").select("*");
    const { data: ajustes, error: erroAjustes } = await supabase.from("inventario_ajustes")
      .select("id,produto,quantidade_anterior,quantidade_nova,tipo,mes_referencia,motivo,autor_email,criado_em")
      .order("criado_em", { ascending: false }).order("id", { ascending: false }).limit(100);
    if (erroProdutos || erroEntradas || erroSaidas || erroInventario || erroAjustes) {
      console.error(erroProdutos || erroEntradas || erroSaidas || erroInventario || erroAjustes);
      setErroStock("Não foi possível carregar os dados do stock. Tenta novamente.");
      return;
    }

    // normaliza unidade no client (para dados antigos)
    const produtosNorm = (p || []).map((x) => ({ ...x, unidade: normalizeUnidade(x.unidade) }));

    setProdutos(produtosNorm);
    setEntradas(e || []);
    setSaidas(s || []);
    setSaidasAtualizadasEm(new Date());

    const mapQtd = {};
    r?.forEach(i => {
      mapQtd[i.produto] = i.quantidade;
    });
    setInventarioReal(mapQtd);
    setInventarioConfirmado(mapQtd);
    setAjustesInventario(ajustes || []);
    setInventarioAjustado(Object.fromEntries(stock.map(item => [item.nome, Number(item.stock_atual)])));
    setStockCarregado(true);
  }

  /* ===== INVENTÁRIO TEÓRICO ===== */
  const inventarioTeorico = useMemo(() => {
    const inv = {};
    entradas.forEach(e => {
      inv[e.produto] = (inv[e.produto] || 0) + Number(e.quantidade);
    });
    saidas.forEach(s => {
      inv[s.produto] = (inv[s.produto] || 0) - Number(s.quantidade);
    });
    return inv;
  }, [entradas, saidas]);

  /* ✅ LISTA FILTRADA PARA INVENTÁRIO MENSAL (RÁPIDO) */
  const inventarioMensalLista = useMemo(() => {
    const q = inventarioFiltro.trim().toLowerCase();
    const base = produtos
      .slice()
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
    if (!q) return base;
    return base.filter(p => (p.nome || "").toLowerCase().includes(q));
  }, [produtos, inventarioFiltro]);

  /* ===== AVISOS + VALOR TOTAL ===== */
  const produtosAbaixoMinimo = useMemo(() => {
    return produtos.filter(p => Number(inventarioAjustado[p.nome] || 0) < Number(p.minimo || 0));
  }, [produtos, inventarioAjustado]);

  const valorTotalStock = useMemo(() => {
    return produtos.reduce((acc, p) => {
      const stockAtual = Number(inventarioAjustado[p.nome] || 0);
      const preco = Number(p.preco_unit || 0);
      return acc + stockAtual * preco;
    }, 0);
  }, [produtos, inventarioAjustado]);

  /* ===== FUNÇÃO FILTRO INTERVALO (YYYY-MM-DD) ===== */
  function dentroIntervalo(iso, de, ate) {
    if (!iso) return false;
    const d = String(iso).slice(0, 10);
    if (de && d < de) return false;
    if (ate && d > ate) return false;
    return true;
  }

  /* ✅ INVENTÁRIO MENSAL (RÁPIDO) - HELPERS */
  function iniciarInventarioMensal() {
    // copia o stock real atual para edição (para ficar tudo pré-preenchido e rápido)
    const base = {};
    produtos.forEach(p => {
      const atual = inventarioReal[p.nome];
      base[p.nome] = atual ?? "";
    });
    setInventarioEdicao(base);
    setInventarioColar("");
    setInventarioFiltro("");
    setModoInventarioMensal(true);
  }

  function fecharInventarioMensal() {
    setModoInventarioMensal(false);
  }

  function parseInventarioTexto(texto) {
    // Aceita linhas do tipo:
    // "Produto; 12,5"  | "Produto\t12,5" | "Produto: 12,5" | "Produto = 12,5"
    // Também tenta extrair "12,5" do fim da linha se houver outros separadores
    const out = {};
    const lines = (texto || "")
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      // tenta separadores comuns
      let parts = line.split(";").map(x => x.trim()).filter(Boolean);
      if (parts.length < 2) parts = line.split("\t").map(x => x.trim()).filter(Boolean);
      if (parts.length < 2) parts = line.split(":").map(x => x.trim()).filter(Boolean);
      if (parts.length < 2) parts = line.split("=").map(x => x.trim()).filter(Boolean);

      let nome = "";
      let qtd = "";

      if (parts.length >= 2) {
        nome = parts[0];
        qtd = parts.slice(1).join(" "); // caso venha "12,5 kg" etc.
      } else {
        // fallback: tenta último número da linha
        const m = line.match(/(.+?)\s+(-?\d+(?:[.,]\d+)?)/);
        if (m) {
          nome = (m[1] || "").trim();
          qtd = (m[2] || "").trim();
        }
      }

      if (!nome) continue;

      // normaliza quantidade (só número)
      const mNum = String(qtd).match(/-?\d+(?:[.,]\d+)?/);
      const numStr = mNum ? mNum[0] : "";
      const val = Number(String(numStr).replace(",", "."));
      if (!Number.isFinite(val)) continue;

      out[nome] = val;
    }

    return out;
  }

  function aplicarColagemInventario() {
    const parsed = parseInventarioTexto(inventarioColar);

    if (!Object.keys(parsed).length) {
      return alert("Não consegui ler nada. Cola linhas tipo: 'Produto; 12,5' (uma por linha).");
    }

    // aplica apenas aos produtos existentes (match por nome)
    const nomesSet = new Set(produtos.map(p => p.nome));
    const updates = {};
    Object.entries(parsed).forEach(([nome, val]) => {
      if (nomesSet.has(nome)) updates[nome] = String(val).replace(".", ","); // mantém visual PT
    });

    // se houver nomes que não batem, avisa (sem bloquear)
    const naoEncontrados = Object.keys(parsed).filter(n => !nomesSet.has(n));
    if (naoEncontrados.length) {
      alert(
        `⚠ Alguns nomes não existem na lista de produtos e foram ignorados:\n\n` +
          naoEncontrados.slice(0, 25).join("\n") +
          (naoEncontrados.length > 25 ? "\n..." : "")
      );
    }

    setInventarioEdicao(prev => ({ ...prev, ...updates }));
  }

  function preencherVaziosComZeroInventario() {
    const next = { ...inventarioEdicao };
    produtos.forEach(p => {
      const v = next[p.nome];
      if (v === "" || v === null || typeof v === "undefined") next[p.nome] = "0";
    });
    setInventarioEdicao(next);
  }

  async function gravarInventarioMensal() {
    const rows = produtos
      .map(p => {
        const raw = inventarioEdicao[p.nome];
        const val = Number(String(raw ?? "").replace(",", "."));
        if (raw === "" || raw === null || raw === undefined || !Number.isFinite(val) || val < 0) return null;
        return { produto: p.nome, quantidade: val };
      })
      .filter(Boolean);

    if (!rows.length || rows.length !== produtos.length) {
      return alert("Preenche um valor válido (zero ou superior) para todos os produtos antes de gravar.");
    }
    if (!motivoInventario.trim()) return alert("Indica o motivo do inventário antes de gravar.");

    /* ✅ ALERTA DISCREPÂNCIA NEGATIVA (Inventário < Teórico) */
    const negativas = rows
      .map(r => {
        const teo = Number(inventarioTeorico[r.produto] || 0);
        const dif = r.quantidade - teo; // negativa = inventário menor do que o esperado
        return { ...r, teo, dif };
      })
      .filter(x => x.dif < 0)
      .sort((a, b) => a.dif - b.dif); // mais negativo primeiro

    if (negativas.length > 0) {
      const linhas = negativas
        .slice(0, 20)
        .map(
          x =>
            `${x.produto}: Teórico ${fmtNum(x.teo, 3)} | Inventário ${fmtNum(x.quantidade, 3)} | Dif ${fmtNum(
              x.dif,
              3
            )}`
        )
        .join("\n");

      const msg =
        `⚠ Discrepância NEGATIVA detetada (Inventário < Teórico) em ${negativas.length} produto(s).\n\n` +
        `${linhas}` +
        (negativas.length > 20 ? `\n\n... e mais ${negativas.length - 20}` : "") +
        `\n\nQueres gravar mesmo assim?`;

      const ok = window.confirm(msg);
      if (!ok) return; // cancela gravação
    }

    const { error } = await supabase.rpc("gerente_gravar_inventario", {
      p_itens: rows, p_motivo: motivoInventario.trim(), p_tipo: "mensal", p_mes: inventarioMes
    });

    if (error) {
      mostrarErro("Não foi possível gravar o inventário mensal", error);
      return;
    }

    await fetchTudo();

    if (negativas.length > 0) {
      alert(`✅ Inventário gravado (mês: ${inventarioMes}). Atenção: houve ${negativas.length} discrepância(s) negativa(s).`);
    } else {
      alert(`✅ Inventário gravado (mês: ${inventarioMes}). Já aparece em Stock real.`);
    }

    setModoInventarioMensal(false);
    setMotivoInventario("");
  }

  /* ===== HELPERS PDF ===== */
  function getUnidadeByNome(nomeProduto) {
    return produtos.find(p => p.nome === nomeProduto)?.unidade || "";
  }

  function formatDateTimeParts(iso) {
    const d = new Date(iso);
    const data = d.toLocaleDateString();
    const hora = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return { data, hora };
  }

  function exportPDFEntradas() {
    const lista = entradas.filter(e => dentroIntervalo(e.datahora, filtroEntradaDe, filtroEntradaAte));
    if (!lista.length) return alert("Sem entradas no intervalo selecionado.");

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

    doc.setFontSize(14);
    doc.text("Histórico de Entradas", 40, 40);

    doc.setFontSize(10);
    doc.text(`Intervalo: ${filtroEntradaDe || "—"} até ${filtroEntradaAte || "—"}`, 40, 60);

    const rows = lista.map(e => {
      const { data, hora } = formatDateTimeParts(e.datahora);
      return [e.produto || "", getUnidadeByNome(e.produto), String(e.quantidade ?? ""), data, hora, e.responsavel || "—"];
    });

    autoTable(doc, {
      startY: 80,
      head: [["Produto", "Unidade", "Quantidade", "Data", "Hora", "Responsável"]],
      body: rows,
      styles: { fontSize: 9, cellPadding: 4 }
    });

    doc.save(`entradas_${(filtroEntradaDe || "todas")}_a_${(filtroEntradaAte || "todas")}.pdf`);
  }

  function exportPDFSaidas() {
    const lista = saidas.filter(s => dentroIntervalo(s.dataHora, filtroDataSaidas, filtroDataSaidasAte));
    if (!lista.length) return alert("Sem saídas no intervalo selecionado.");

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

    doc.setFontSize(14);
    doc.text("Histórico de Saídas", 40, 40);

    doc.setFontSize(10);
    doc.text(`Intervalo: ${filtroDataSaidas || "—"} até ${filtroDataSaidasAte || "—"}`, 40, 60);

    const rows = lista.map(s => {
      const { data, hora } = formatDateTimeParts(s.dataHora);
      return [s.produto || "", getUnidadeByNome(s.produto), String(s.quantidade ?? ""), data, hora, s.responsavel || "—"];
    });

    autoTable(doc, {
      startY: 80,
      head: [["Produto", "Unidade", "Quantidade", "Data", "Hora", "Responsável"]],
      body: rows,
      styles: { fontSize: 9, cellPadding: 4 }
    });

    doc.save(`saidas_${(filtroDataSaidas || "todas")}_a_${(filtroDataSaidasAte || "todas")}.pdf`);
  }

  /* ✅ PDF STOCK (AJUSTADO) */
  function exportPDFStock() {
    if (!produtos.length) return alert("Sem produtos para exportar.");

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

    doc.setFontSize(14);
    doc.text("Stock (Ajustado: Real + Movimentos após inventário)", 40, 40);

    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 40, 60);

    const rows = produtos
      .slice()
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
      .map(p => {
        const stock = Number(inventarioAjustado[p.nome] || 0);
        const preco = Number(p.preco_unit || 0);
        const minimo = Number(p.minimo || 0);
        const valor = stock * preco;

        return [
          p.nome || "",
          p.unidade || "",
          String(stock),
          String(minimo),
          `${preco.toFixed(2)} €`,
          `${valor.toFixed(2)} €`
        ];
      });

    autoTable(doc, {
      startY: 80,
      head: [["Produto", "Unidade", "Stock", "Mínimo", "Preço", "Valor"]],
      body: rows,
      styles: { fontSize: 9, cellPadding: 4 }
    });

    const totalAjustado = produtos.reduce((acc, p) => {
      const stock = Number(inventarioAjustado[p.nome] || 0);
      const preco = Number(p.preco_unit || 0);
      return acc + stock * preco;
    }, 0);

    const finalY = (doc.lastAutoTable?.finalY || 80) + 20;
    doc.setFontSize(12);
    doc.text(`Total do stock (ajustado): ${totalAjustado.toFixed(2)} €`, 40, finalY);

    doc.save("stock_ajustado.pdf");
  }

  /* ✅ AGRUPAR PRODUTOS POR PROCEDÊNCIA (COLAPSÁVEL) */
  const produtosPorProcedencia = useMemo(() => {
    const map = {};
    produtos.forEach(p => {
      const procRaw = (p.procedencia ?? "").toString().trim();
      const proc = procRaw ? procRaw : "Sem procedência";
      if (!map[proc]) map[proc] = [];
      map[proc].push(p);
    });
    return map;
  }, [produtos]);

  const procedenciasOrdenadas = useMemo(() => {
    return Object.keys(produtosPorProcedencia).sort((a, b) => a.localeCompare(b));
  }, [produtosPorProcedencia]);

  function toggleProcedencia(proc) {
    setProcedenciasAbertas(prev => ({ ...prev, [proc]: !prev[proc] }));
  }

  function abrirTudoProcedencias() {
    const all = {};
    procedenciasOrdenadas.forEach(proc => (all[proc] = true));
    setProcedenciasAbertas(all);
  }

  function fecharTudoProcedencias() {
    setProcedenciasAbertas({});
  }

  const pesquisa = pesquisaProduto.trim().toLowerCase();

  const entradasFiltradas = useMemo(() => {
    return entradas.filter(e => dentroIntervalo(e.datahora, filtroEntradaDe, filtroEntradaAte));
  }, [entradas, filtroEntradaDe, filtroEntradaAte]);

  const saidasFiltradas = useMemo(() => {
    return saidas.filter(s => dentroIntervalo(s.dataHora, filtroDataSaidas, filtroDataSaidasAte));
  }, [saidas, filtroDataSaidas, filtroDataSaidasAte]);

  if (!stockCarregado || erroStock) {
    return (
      <div style={styles.app}>
        <p role={erroStock ? "alert" : undefined}>{erroStock || "A carregar stock…"}</p>
        {erroStock && <button style={styles.button} type="button" onClick={fetchTudo}>Tentar novamente</button>}
        <button style={styles.button} type="button" onClick={onLogout}>Sair</button>
      </div>
    );
  }

  return (
    <div className="operacao" style={styles.app}>
      <header className="operacao-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <img src="/logo-cozinha-de-tacho.webp" alt="Cozinha de Tacho" style={{ display: "block", width: 220, maxWidth: "70vw", height: "auto" }} />
          <h2 style={{ margin: "8px 0 0" }}>Gerente · Controlo de stock</h2>
        </div>
        <button onClick={onLogout} style={{ ...styles.button, ...styles.danger }}>
          🔑 Sair
        </button>
      </header>

      <nav className="operacao-nav" aria-label="Secções do Gerente">
        {[
          ["stock", "📊 Resumo"], ["movimentos", "➕ Entradas"], ["fatura", "📷 Fatura"],
          ["inventario", "🧾 Inventário"], ["produtos", "📦 Produtos"],
          ["historico", "📜 Histórico"]
        ].map(([id, titulo]) => (
          <button key={id} type="button" aria-pressed={area === id} onClick={() => setArea(id)}>{titulo}</button>
        ))}
      </nav>

      {area === "stock" && <>

      {/* ===== AVISOS (BASEADOS NO STOCK ATUAL) ===== */}
      {produtosAbaixoMinimo.length > 0 && (
        <div style={{ ...styles.card, borderColor: "#e53935" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>⚠ Avisos de Stock</h3>

            <button style={styles.button} type="button" onClick={() => setAvisosAbertos(prev => !prev)}>
              {avisosAbertos ? "Ocultar" : "Mostrar"}
            </button>
          </div>

          {avisosAbertos && (
            <table className="mobile-cards" style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Produto</th>
                  <th style={styles.th}>Stock atual</th>
                  <th style={styles.th}>Stock mínimo</th>
                </tr>
              </thead>
              <tbody>
                {produtosAbaixoMinimo.map(p => {
                  const atual = Number(inventarioAjustado[p.nome] || 0);
                  const minimo = Number(p.minimo || 0);

                  return (
                    <tr key={p.nome}>
                      <td data-label="Produto" style={{ ...styles.td, ...styles.warning }}>{p.nome}</td>
                      <td data-label="Stock atual" style={styles.td}>{fmtNum(atual, 3)}</td>
                      <td data-label="Mínimo" style={styles.td}>{fmtNum(minimo, 3)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {!avisosAbertos && (
            <div style={{ marginTop: 8, opacity: 0.8 }}>
              {produtosAbaixoMinimo.length} produto(s) abaixo do mínimo.
            </div>
          )}
        </div>
      )}

      <div style={styles.card}><h3 style={{ margin: 0 }}>💰 Valor total de stock: {valorTotalStock.toFixed(2)} €</h3></div>

      {/* ✅ BOTÃO PDF STOCK */}
      <div style={{ marginBottom: 12 }}>
        <button style={styles.button} onClick={exportPDFStock} type="button">
          📄 PDF Stock
        </button>
      </div>
      <div style={styles.card}>
        <h3 style={{ marginTop: 0 }}>Ações rápidas</h3>
        <div className="operacao-tools">
          <button style={styles.button} type="button" onClick={() => setArea("movimentos")}>Registar entrada</button>
          <button style={{ ...styles.button, ...styles.secondary }} type="button" onClick={() => setArea("inventario")}>Fazer inventário</button>
          <button style={{ ...styles.button, ...styles.secondary }} type="button" onClick={() => setArea("produtos")}>Consultar produtos e stock</button>
        </div>
      </div>
      </>}

      {area === "inventario" && <>

      {/* ✅ INVENTÁRIO MENSAL (RÁPIDO) */}
      <div style={{ ...styles.card, borderColor: "#4caf50" }}>
        <h3 className="operacao-section-title">🧾 Inventário mensal</h3><p className="operacao-muted">A contagem atualiza o stock real.</p>

        {!modoInventarioMensal ? (
          <div>
            <span style={{ marginRight: 8 }}>Mês</span>
            <input
              type="month"
              style={styles.input}
              value={inventarioMes}
              onChange={e => setInventarioMes(e.target.value)}
            />
            <button style={styles.button} type="button" onClick={iniciarInventarioMensal}>
              🚀 Iniciar inventário mensal
            </button>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 8 }}>
              <span style={{ marginRight: 8 }}>Mês</span>
              <input
                type="month"
                style={styles.input}
                value={inventarioMes}
                onChange={e => setInventarioMes(e.target.value)}
              />

              <input
                style={{ ...styles.input, width: "min(100%, 280px)" }}
                placeholder="Pesquisar no inventário…"
                value={inventarioFiltro}
                onChange={e => setInventarioFiltro(e.target.value)}
              />

              <button style={styles.button} type="button" onClick={preencherVaziosComZeroInventario}>
                0️⃣ Preencher vazios com 0
              </button>

              <button style={{ ...styles.button, ...styles.danger }} type="button" onClick={fecharInventarioMensal}>
                ✖ Fechar
              </button>
            </div>

            <div style={{ marginBottom: 8 }}>
              <div style={{ marginBottom: 6 }}>
                <strong>Colar lista (opcional)</strong>{" "}
                <span style={{ fontSize: 12, opacity: 0.8 }}>
                  (uma linha por produto: <em>Produto; 12,5</em> ou <em>Produto	12,5</em>)
                </span>
              </div>

              <textarea
                style={{ ...styles.input, width: "100%", height: 80, margin: 0 }}
                placeholder={`Ex:\nArroz; 12,5\nAzeite; 3\n`}
                value={inventarioColar}
                onChange={e => setInventarioColar(e.target.value)}
              />

              <div style={{ marginTop: 6 }}>
                <button style={styles.button} type="button" onClick={aplicarColagemInventario}>
                  📥 Aplicar colagem
                </button>
              </div>
            </div>

            <label style={{ display: "block", marginBottom: 10 }}>
              Motivo do inventário (obrigatório)
              <input
                style={{ ...styles.input, display: "block", width: "min(100%, 520px)", boxSizing: "border-box" }}
                type="text"
                maxLength={500}
                placeholder="Ex.: Contagem física de fim de mês"
                value={motivoInventario}
                onChange={e => setMotivoInventario(e.target.value)}
              />
            </label>

            <table className="mobile-cards" style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Produto</th>
                  <th style={styles.th}>Unidade</th>
                  <th style={styles.th}>Stock teórico</th>
                  <th style={styles.th}>Stock real (inventário)</th>
                </tr>
              </thead>
              <tbody>
                {inventarioMensalLista.map(p => {
                  const stockTeo = Number(inventarioTeorico[p.nome] || 0);

                  return (
                    <tr key={`inv-${p.nome}`}>
                      <td data-label="Produto" style={styles.td}>{p.nome}</td>
                      <td data-label="Unidade" style={styles.td}>{p.unidade || ""}</td>
                      <td data-label="Stock teórico" style={styles.tdRight}>{fmtNum(stockTeo, 3)}</td>
                      <td data-label="Stock real" style={styles.tdRight}>
                        <input
                          style={{ ...styles.input, width: 110, textAlign: "right" }}
                          type="number"
                          step="0.001"
                          value={inventarioEdicao[p.nome] ?? ""}
                          onChange={e => setInventarioEdicao(prev => ({ ...prev, [p.nome]: e.target.value }))}
                          placeholder="0"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ marginTop: 8 }}>
              <button style={styles.button} type="button" onClick={gravarInventarioMensal}>
                ✅ Gravar inventário do mês (Stock real)
              </button>
            </div>
          </div>
        )}
      </div>

      </>}

      {area === "historico" && <>
      <div style={styles.card}>
        <button style={styles.button} type="button" onClick={() => setHistoricoInventarioAberto(!historicoInventarioAberto)}>
          {historicoInventarioAberto ? "Fechar" : "Ver"} histórico de correções do inventário
        </button>
        {historicoInventarioAberto && (
          <div style={{ overflowX: "auto" }}>
            <p>Últimos 100 registos, desde a ativação deste histórico.</p>
            <table className="mobile-cards" style={styles.table}>
              <thead><tr>
                <th style={styles.th}>Data</th><th style={styles.th}>Produto</th>
                <th style={styles.th}>Anterior</th><th style={styles.th}>Novo</th>
                <th style={styles.th}>Tipo</th><th style={styles.th}>Motivo</th>
                <th style={styles.th}>Responsável</th>
              </tr></thead>
              <tbody>
                {ajustesInventario.map(a => (
                  <tr key={a.id}>
                    <td data-label="Data" style={styles.td}>{new Date(a.criado_em).toLocaleString("pt-PT")}</td>
                    <td data-label="Produto" style={styles.td}>{a.produto}</td>
                    <td data-label="Anterior" style={styles.tdRight}>{a.quantidade_anterior === null ? "—" : fmtNum(a.quantidade_anterior, 3)}</td>
                    <td data-label="Novo" style={styles.tdRight}>{fmtNum(a.quantidade_nova, 3)}</td>
                    <td data-label="Tipo" style={styles.td}>{a.tipo === "mensal" ? `Mensal (${a.mes_referencia})` : "Pontual"}</td>
                    <td data-label="Motivo" style={styles.td}>{a.motivo}</td>
                    <td data-label="Responsável" style={styles.td}>{a.autor_email}</td>
                  </tr>
                ))}
                {!ajustesInventario.length && <tr><td data-label="" style={styles.td} colSpan={7}>Ainda não há correções registadas.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      </>}

      {area === "fatura" && <>
      <div style={styles.card}>
        <h3 className="operacao-section-title">📷 Entrada por fotografia da fatura</h3>
        <p className="operacao-muted">
          Adiciona uma ou várias fotografias da fatura. As imagens são usadas apenas para a leitura e não ficam guardadas.
        </p>
        <input type="file" accept="image/*" capture="environment" multiple onChange={juntarFotografiasEntrada} />

        {fotografiasEntrada.map((foto, indice) => (
          <div key={`${foto.name}-${indice}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 0" }}>
            <span>Fotografia {indice + 1}: {foto.name}</span>
            <button type="button" style={{ ...styles.button, ...styles.secondary }} onClick={() => setFotografiasEntrada(lista => lista.filter((_, i) => i !== indice))}>
              Retirar
            </button>
          </div>
        ))}

        {!!fotografiasEntrada.length && (
          <button type="button" style={{ ...styles.button, marginTop: 10 }} disabled={aLerFaturaEntrada} onClick={lerFaturaEntrada}>
            {aLerFaturaEntrada ? `A ler… ${Math.round(progressoFaturaEntrada * 100)}%` : `Ler ${fotografiasEntrada.length} fotografia(s)`}
          </button>
        )}
        {aLerFaturaEntrada && <progress style={{ width: "100%", marginTop: 10 }} max="1" value={progressoFaturaEntrada} />}
      </div>

      {!!linhasFaturaEntrada.length && (
        <div style={styles.card}>
          <h3 className="operacao-section-title">✅ Validar leitura da fatura</h3>
          <p className="operacao-muted">
            Confirma o produto e a quantidade de cada linha antes de registar as entradas. Se a embalagem exigir conversão, corrige a quantidade antes de confirmar.
          </p>

          {linhasFaturaEntrada.map(linha => {
            const produtoAtual = produtos.find(p => p.nome === linha.produto);
            const precoFatura = numeroEntrada(linha.precoFatura);
            return (
              <div key={linha.id} style={{ padding: "14px 0", borderBottom: "1px solid #d9ddd4" }}>
                <div style={{ fontSize: 13, color: "#667064", marginBottom: 8 }}>Foto {linha.foto}: {linha.descricao}</div>
                <div className="operacao-form">
                  <select style={styles.input} value={linha.produto || ""} onChange={e => atualizarLinhaFaturaEntrada(linha.id, "produto", e.target.value)}>
                    <option value="">Selecionar produto…</option>
                    {produtos.map(p => <option key={p.nome} value={p.nome}>{p.nome} ({p.unidade})</option>)}
                  </select>

                  <input style={styles.input} type="number" inputMode="decimal" min="0.001" step="0.001" placeholder="Quantidade" value={linha.quantidade} onChange={e => atualizarLinhaFaturaEntrada(linha.id, "quantidade", e.target.value)} />

                  <input style={styles.input} type="number" inputMode="decimal" min="0" step="0.001" placeholder="Preço da fatura" value={linha.precoFatura} onChange={e => atualizarLinhaFaturaEntrada(linha.id, "precoFatura", e.target.value)} />

                  <button type="button" style={{ ...styles.button, ...styles.danger }} onClick={() => setLinhasFaturaEntrada(lista => lista.filter(item => item.id !== linha.id))}>Remover</button>
                </div>

                {produtoAtual && (
                  <div style={{ marginTop: 7, fontSize: 14 }}>
                    Preço atual: <strong>{Number(produtoAtual.preco_unit || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</strong>
                    {Number.isFinite(precoFatura) && precoFatura > 0 && <> · Preço da fatura: <strong>{precoFatura.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</strong></>}
                  </div>
                )}
              </div>
            );
          })}

          <button type="button" style={{ ...styles.button, width: "100%", marginTop: 12 }} disabled={aRegistarFaturaEntrada} onClick={registarEntradasDaFatura}>
            {aRegistarFaturaEntrada ? "A registar…" : "✅ Confirmar e registar entradas"}
          </button>
        </div>
      )}


      </>}

      {area === "produtos" && <>
      {/* ===== PRODUTO (CRIAR / EDITAR) ===== */}
      <div style={styles.card}>
      <h3 className="operacao-section-title">📦 Produto</h3>
      <form className="operacao-form"
        onSubmit={async e => {
          e.preventDefault();

          const { id, ...rest } = produtoNovo;

          const payload = {
            ...rest,
            unidade: normalizeUnidade(rest.unidade),
            minimo: Number(String(rest.minimo ?? "").replace(",", ".")),
            preco_unit: Number(String(rest.preco_unit ?? "").replace(",", "."))
          };

          if (!Number.isFinite(payload.minimo) || !Number.isFinite(payload.preco_unit)) {
            return alert("⚠ Verifica 'mínimo' e 'preço unit.' (usa números válidos).");
          }

          let res;
          if (id) {
            res = await supabase.from("produtos").update(payload).eq("id", id);
          } else {
            res = await supabase.from("produtos").insert([payload]);
          }

          if (res?.error) {
            mostrarErro("Não foi possível guardar o produto", res.error);
            return;
          }

          setProdutoNovo({ nome: "", unidade: "", procedencia: "", minimo: "", preco_unit: "" });
          fetchTudo();
        }}
      >
        <input
          style={styles.input}
          placeholder="nome"
          value={produtoNovo.nome || ""}
          onChange={e => setProdutoNovo({ ...produtoNovo, nome: e.target.value })}
          required
        />

        {/* ✅ unidade normalizada (select, não texto livre) */}
        <select
          style={styles.input}
          value={produtoNovo.unidade || ""}
          onChange={e => setProdutoNovo({ ...produtoNovo, unidade: e.target.value })}
          required
        >
          <option value="">unidade</option>
          {UNIDADES.map(u => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>

        <input
          style={styles.input}
          placeholder="procedencia"
          value={produtoNovo.procedencia || ""}
          onChange={e => setProdutoNovo({ ...produtoNovo, procedencia: e.target.value })}
          required
        />

        <input
          style={styles.input}
          type="number"
          step="0.01"
          placeholder="minimo"
          value={produtoNovo.minimo ?? ""}
          onChange={e => setProdutoNovo({ ...produtoNovo, minimo: e.target.value })}
          required
        />

        <input
          style={styles.input}
          type="number"
          step="0.01"
          placeholder="preco_unit"
          value={produtoNovo.preco_unit ?? ""}
          onChange={e => setProdutoNovo({ ...produtoNovo, preco_unit: e.target.value })}
          required
        />

        <button style={styles.button}>
          {produtoNovo.id ? "Guardar alterações" : "Adicionar"}
        </button>
      </form>
      </div>

      </>}

      {area === "movimentos" && <>
      {/* ===== ENTRADA DE STOCK ===== */}
      <div style={styles.card}>
      <h3 className="operacao-section-title">➕ Entrada de stock</h3>
      <form className="operacao-form"
        onSubmit={async e => {
          e.preventDefault();

          const payload = {
            ...entradaNova,
            quantidade: Number(String(entradaNova.quantidade).replace(",", ".")),
            datahora: new Date().toISOString()
          };

          if (!Number.isFinite(payload.quantidade) || payload.quantidade <= 0) {
            alert("Indica uma quantidade superior a zero.");
            return;
          }

          const { error } = await supabase.from("entradas").insert([payload]);
          if (error) {
            mostrarErro("Não foi possível registar a entrada de stock", error);
            return;
          }

          setEntradaNova({ produto: "", quantidade: "", datahora: new Date().toISOString() });
          setPesquisaEntrada("");
          await fetchTudo();
        }}
      >
        <input
          style={styles.input}
          type="search"
          placeholder="Pesquisar produto…"
          aria-label="Pesquisar produto para entrada de stock"
          value={pesquisaEntrada}
          onChange={e => setPesquisaEntrada(e.target.value)}
        />
        <select
          style={styles.input}
          value={entradaNova.produto}
          onChange={e => setEntradaNova({ ...entradaNova, produto: e.target.value })}
          required
        >
          <option value="">Produto</option>
          {produtosEntradaFiltrados.map(p => (
            <option key={p.nome} value={p.nome}>
              {p.nome} ({p.unidade})
            </option>
          ))}
        </select>
        {!!pesquisaEntrada && !produtosEntradaFiltrados.length && (
          <div style={{ marginBottom: 8, color: "#666" }}>Nenhum produto encontrado.</div>
        )}

        <input
          style={styles.input}
          type="number"
          step="0.001"
          placeholder="Quantidade"
          value={entradaNova.quantidade}
          onChange={e => setEntradaNova({ ...entradaNova, quantidade: e.target.value })}
          required
        />
        <button style={styles.button}>Registar</button>
      </form>
      </div>


      </>}

      {area === "produtos" && <>
      {/* ===== LISTA DE PRODUTOS (✅ CAMPOS COMPLETOS + MAIS BONITO) ===== */}
      <h3 className="operacao-section-title">📝 Produtos e stock</h3>

      <div className="operacao-tools">
        <input
          style={styles.input}
          placeholder="Pesquisar produto…"
          value={pesquisaProduto}
          onChange={e => setPesquisaProduto(e.target.value)}
        />
        <button style={styles.button} type="button" onClick={abrirTudoProcedencias}>
          Abrir tudo
        </button>
        <button style={styles.button} type="button" onClick={fecharTudoProcedencias}>
          Fechar tudo
        </button>
      </div>

      {procedenciasOrdenadas.map(proc => {
        const listaTotal = produtosPorProcedencia[proc] || [];
        const listaFiltrada = pesquisa
          ? listaTotal.filter(p => (p.nome || "").toLowerCase().includes(pesquisa))
          : listaTotal;

        if (pesquisa && listaFiltrada.length === 0) return null;

        const aberta = !!procedenciasAbertas[proc] || !!pesquisa;

        return (
          <div key={proc} style={styles.card}>
            <button type="button" className="operacao-group" aria-expanded={aberta}
              onClick={() => toggleProcedencia(proc)}
            >
              <span>{aberta ? "▼" : "▶"} {proc}</span>
              <span style={{ fontWeight: "normal" }}>
                {listaFiltrada.length}/{listaTotal.length}
              </span>
            </button>

            {aberta && (
              <div className="operacao-table-scroll" style={{ marginTop: 8 }}>
                <table className="mobile-cards products-table" style={styles.tableProdutos}>
                  <colgroup>
                    <col style={{ width: "26%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "12%" }} />
                  </colgroup>

                  <thead>
                    <tr>
                      <th style={styles.thProdutos}>Nome</th>
                      <th style={styles.thProdutos}>Unidade</th>
                      <th style={styles.thProdutos}>Stock teórico</th>
                      <th style={styles.thProdutos}>Inventário inicial</th>
                      <th style={styles.thProdutos}>Stock atual</th>
                      <th style={styles.thProdutos}>Stock mínimo</th>
                      <th style={styles.thProdutos}>Preço unit.</th>
                      <th style={styles.thProdutos}></th>
                    </tr>
                  </thead>

                  <tbody>
                    {listaFiltrada
                      .slice()
                      .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
                      .map(p => {
                        const stockTeo = Number(inventarioTeorico[p.nome] || 0);
                        const stockAjust = Number(inventarioAjustado[p.nome] || 0);
                        const minimo = Number(p.minimo || 0);
                        const preco = Number(p.preco_unit || 0);

                        const abaixo = stockAjust < minimo;
                        const aberto = produtoAberto === p.nome;

                        return (
                          <>
                            <tr key={`${proc}-${p.nome}`} style={abaixo ? styles.rowBad : undefined}>
                              <td data-label="Produto" style={{ ...styles.tdProdutos, ...styles.nomeProdutoCell }} title={p.nome}>
                                {p.nome}
                              </td>

                              <td data-label="Unidade" style={styles.tdProdutos}>{p.unidade || ""}</td>
                              <td data-label="Stock teórico" style={styles.tdProdutosRight}>{fmtNum(stockTeo, 3)}</td>

                              <td data-label="Inventário inicial" style={styles.tdProdutosRight}>
                                <input
                                  style={{
                                    ...styles.input,
                                    width: "100%",
                                    textAlign: "right",
                                    boxSizing: "border-box"
                                  }}
                                  type="number"
                                  step="0.001"
                                  value={inventarioReal[p.nome] ?? ""}
                                  onChange={e => setInventarioReal({ ...inventarioReal, [p.nome]: e.target.value })}
                                  onBlur={async () => {
                                    const raw = inventarioReal[p.nome];
                                    const anterior = inventarioConfirmado[p.nome];
                                    const repor = () => setInventarioReal(prev => ({ ...prev, [p.nome]: anterior ?? "" }));
                                    if (raw === "" || raw === undefined || raw === null) {
                                      repor();
                                      return;
                                    }
                                    const val = Number(String(raw).replace(",", "."));
                                    if (!Number.isFinite(val) || val < 0) {
                                      alert("A quantidade deve ser zero ou superior.");
                                      repor();
                                      return;
                                    }
                                    if (anterior !== undefined && Number(anterior) === val) return;
                                    const motivo = window.prompt(`Motivo da correção de ${p.nome}:`);
                                    if (!motivo?.trim()) {
                                      repor();
                                      return;
                                    }
                                    const { error } = await supabase.rpc("gerente_gravar_inventario", {
                                      p_itens: [{ produto: p.nome, quantidade: val }],
                                      p_motivo: motivo.trim(), p_tipo: "pontual"
                                    });

                                    if (error) {
                                      mostrarErro(`Não foi possível atualizar o inventário de ${p.nome}`, error);
                                      repor();
                                      return;
                                    }
                                    await fetchTudo();
                                  }}
                                  placeholder="0"
                                />
                              </td>

                              <td data-label="Stock atual" style={styles.tdProdutosRight}>{fmtNum(stockAjust, 3)}</td>
                              <td data-label="Mínimo" style={styles.tdProdutosRight}>{fmtNum(minimo, 3)}</td>
                              <td data-label="Preço" style={styles.tdProdutosRight}>{fmtNum(preco, 2)} €</td>

                              <td data-label="Ações" style={styles.tdProdutosRight}>
                                <button
                                  style={{ ...styles.button, width: "100%" }}
                                  type="button"
                                  onClick={() => setProdutoAberto(aberto ? null : p.nome)}
                                >
                                  {aberto ? "Fechar" : "Abrir"}
                                </button>
                              </td>
                            </tr>

                            {aberto && (
                              <tr key={`${proc}-${p.nome}-acoes`}>
                                <td data-label="" style={styles.tdProdutos} colSpan={8}>
                                  <button style={styles.button} onClick={() => setProdutoNovo(p)} type="button">
                                    ✏ Editar
                                  </button>

                                  <button
                                    style={{ ...styles.button, ...styles.danger }}
                                    onClick={async () => {
                                      if (!window.confirm(`Apagar ${p.nome}?`)) return;
                                      const { error } = await supabase.from("produtos").delete().eq("id", p.id);
                                      if (error) {
                                        mostrarErro(`Não foi possível apagar ${p.nome}`, error);
                                        return;
                                      }
                                      await fetchTudo();
                                    }}
                                    type="button"
                                  >
                                    ❌ Apagar
                                  </button>

                                  {abaixo && (
                                    <span style={{ marginLeft: 10, ...styles.warning }}>
                                      ⚠ Abaixo do mínimo (com stock atual)
                                    </span>
                                  )}
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      </>}

      {area === "historico" && <>
      {/* ✅ HISTÓRICO ENTRADAS (CARD + TOGGLE) */}
      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ marginTop: 0, marginBottom: 0 }}>📜 Histórico de Entradas</h3>
          <button style={styles.button} type="button" onClick={() => setEntradasAbertas(prev => !prev)}>
            {entradasAbertas ? "Ocultar" : "Mostrar"}
          </button>
        </div>

        {entradasAbertas && (
          <>
            <div style={{ marginBottom: 8, marginTop: 8 }}>
              <span>De</span>
              <input
                type="date"
                style={styles.input}
                value={filtroEntradaDe}
                onChange={e => setFiltroEntradaDe(e.target.value)}
              />
              <span>Até</span>
              <input
                type="date"
                style={styles.input}
                value={filtroEntradaAte}
                onChange={e => setFiltroEntradaAte(e.target.value)}
              />
              <button
                style={styles.button}
                onClick={() => {
                  setFiltroEntradaDe("");
                  setFiltroEntradaAte("");
                }}
                type="button"
              >
                Limpar filtro
              </button>

              <button style={styles.button} onClick={exportPDFEntradas} type="button">
                📄 PDF Entradas
              </button>
            </div>

            <table className="mobile-cards" style={styles.tableHist}>
              <colgroup>
                <col style={{ width: "34%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "16%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={styles.thHist}>Produto</th>
                  <th style={styles.thHist}>Unid.</th>
                  <th style={styles.thHist}>Quantidade</th>
                  <th style={styles.thHist}>Data</th>
                  <th style={styles.thHist}>Hora</th>
                  <th style={styles.thHist}>Responsável</th>
                </tr>
              </thead>
              <tbody>
                {entradasFiltradas.map(e => {
                  const { data, hora } = formatDateTimeParts(e.datahora);
                  return (
                    <tr key={e.id}>
                      <td data-label="Produto" style={styles.tdHist} title={e.produto || ""}>{e.produto || ""}</td>
                      <td data-label="Unidade" style={styles.tdHist}>{getUnidadeByNome(e.produto)}</td>
                      <td data-label="Quantidade" style={styles.tdHistRight}>{fmtNum(e.quantidade, 3)}</td>
                      <td data-label="Data" style={styles.tdHist}>{data}</td>
                      <td data-label="Hora" style={styles.tdHist}>{hora}</td>
                      <td data-label="Responsável" style={styles.tdHist}>{e.responsavel || "—"}</td>
                    </tr>
                  );
                })}
                {entradasFiltradas.length === 0 && (
                  <tr>
                    <td data-label="" style={styles.tdHist} colSpan={6}>Sem entradas no intervalo.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {!entradasAbertas && (
          <div style={{ marginTop: 8, opacity: 0.8 }}>
            {entradasFiltradas.length} entrada(s) no intervalo atual.
          </div>
        )}
      </div>

      {/* ✅ HISTÓRICO SAÍDAS (CARD + TOGGLE) */}
      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <h3 style={{ marginTop: 0, marginBottom: 0 }}>📜 Histórico de Saídas</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={{ ...styles.button, ...styles.secondary }} type="button" onClick={fetchSaidas} disabled={aAtualizarSaidas}>
              {aAtualizarSaidas ? "A atualizar…" : "Atualizar saídas"}
            </button>
            <button style={styles.button} type="button" onClick={() => setSaidasAbertas(prev => !prev)}>
              {saidasAbertas ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </div>
        <p style={{ margin: "8px 0", opacity: 0.8 }}>
          {saidasFiltradas.length} saída(s) no intervalo atual
          {saidasAtualizadasEm && ` · Atualizado às ${saidasAtualizadasEm.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}`}
        </p>
        {erroSaidas && <p role="alert" style={styles.warning}>{erroSaidas}</p>}

        {saidasAbertas && (
          <>
            <div style={{ marginBottom: 8, marginTop: 8 }}>
              <span>De</span>
              <input
                type="date"
                style={styles.input}
                value={filtroDataSaidas}
                onChange={e => setFiltroDataSaidas(e.target.value)}
              />
              <span>Até</span>
              <input
                type="date"
                style={styles.input}
                value={filtroDataSaidasAte}
                onChange={e => setFiltroDataSaidasAte(e.target.value)}
              />
              <button
                style={styles.button}
                onClick={() => {
                  setFiltroDataSaidas("");
                  setFiltroDataSaidasAte("");
                }}
                type="button"
              >
                Limpar filtro
              </button>

              <button style={styles.button} onClick={exportPDFSaidas} type="button">
                📄 PDF Saídas
              </button>
            </div>

            <table className="mobile-cards" style={styles.tableHist}>
              <colgroup>
                <col style={{ width: "34%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "16%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={styles.thHist}>Produto</th>
                  <th style={styles.thHist}>Unid.</th>
                  <th style={styles.thHist}>Quantidade</th>
                  <th style={styles.thHist}>Data</th>
                  <th style={styles.thHist}>Hora</th>
                  <th style={styles.thHist}>Responsável</th>
                </tr>
              </thead>
              <tbody>
                {saidasFiltradas.map(s => {
                  const { data, hora } = formatDateTimeParts(s.dataHora);
                  return (
                    <tr key={s.id}>
                      <td data-label="Produto" style={styles.tdHist} title={s.produto || ""}>{s.produto || ""}</td>
                      <td data-label="Unidade" style={styles.tdHist}>{getUnidadeByNome(s.produto)}</td>
                      <td data-label="Quantidade" style={styles.tdHistRight}>{fmtNum(s.quantidade, 3)}</td>
                      <td data-label="Data" style={styles.tdHist}>{data}</td>
                      <td data-label="Hora" style={styles.tdHist}>{hora}</td>
                      <td data-label="Responsável" style={styles.tdHist}>{s.responsavel || "—"}</td>
                    </tr>
                  );
                })}
                {saidasFiltradas.length === 0 && (
                  <tr>
                    <td data-label="" style={styles.tdHist} colSpan={6}>Sem saídas no intervalo.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {!saidasAbertas && (
          <div style={{ marginTop: 8, opacity: 0.8 }}>
            {saidasFiltradas.length} saída(s) no intervalo atual.
          </div>
        )}
      </div>
      </>}
    </div>
  );
}
