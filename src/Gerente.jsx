import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import SaidasRapidas from "./SaidasRapidas";
import SegurancaAlimentarGerente from "./SegurancaAlimentarGerente";
import RegistosHACCPGerente from "./RegistosHACCPGerente";

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

  const [equipamentosTemperatura, setEquipamentosTemperatura] = useState([]);
  const [registosTemperatura, setRegistosTemperatura] = useState([]);
  const [equipamentoTemperaturaNovo, setEquipamentoTemperaturaNovo] = useState({
    nome: "",
    setor: "cozinha",
    temperatura_min: "",
    temperatura_max: ""
  });
  const [filtroSetorTemperatura, setFiltroSetorTemperatura] = useState("cozinha");

  /* ✅ Avisos começam fechados */
  const [avisosAbertos, setAvisosAbertos] = useState(false);

  /* ✅ Toggles históricos (começam fechados) */
  const [entradasAbertas, setEntradasAbertas] = useState(false);
  const [saidasAbertas, setSaidasAbertas] = useState(true);
  const [movimentoEdicao, setMovimentoEdicao] = useState(null);

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
    precoUnit: "",
    codigoArtigo: ""
  });
  const [entradasProvisorias, setEntradasProvisorias] = useState([]);
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
  const [procedenciasAbertas, setProcedenciasAbertas] = useState({});
  const [codigosFornecedor, setCodigosFornecedor] = useState({});
  const [codigosEdicao, setCodigosEdicao] = useState({});

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
  function adicionarEntradaProvisoria(item) {
    setEntradasProvisorias(lista => {
      const existente = lista.find(linha => linha.produto === item.produto);
      if (!existente) return [...lista, { ...item, id: item.id || `${Date.now()}-${Math.random().toString(36).slice(2)}` }];
      return lista.map(linha => linha.produto === item.produto
        ? {
            ...linha,
            quantidade: Number(linha.quantidade) + Number(item.quantidade),
            ...(item.precoUnit !== "" && item.precoUnit !== undefined ? { precoUnit: item.precoUnit } : {}),
            ...(item.codigoArtigo ? { codigoArtigo: item.codigoArtigo } : {})
          }
        : linha
      );
    });
  }

  function adicionarEntradaManualGerente(event) {
    event.preventDefault();
    const produto = produtos.find(p => p.nome === entradaNova.produto);
    const quantidade = numeroEntrada(entradaNova.quantidade);
    const precoUnit = entradaNova.precoUnit === "" ? "" : numeroEntrada(entradaNova.precoUnit);

    if (!produto || !Number.isFinite(quantidade) || quantidade <= 0) {
      alert("Seleciona um produto e indica uma quantidade válida.");
      return;
    }
    if (entradaNova.precoUnit !== "" && (!Number.isFinite(precoUnit) || precoUnit < 0)) {
      alert("Indica um valor unitário válido.");
      return;
    }

    adicionarEntradaProvisoria({
      produto: produto.nome,
      quantidade,
      precoUnit,
      codigoArtigo: String(entradaNova.codigoArtigo || "").trim()
    });
    setEntradaNova({ produto: "", quantidade: "", precoUnit: "", codigoArtigo: "" });
    setPesquisaEntrada("");
  }

  async function confirmarEntradasGerente() {
    if (!entradasProvisorias.length) return;
    if (!window.confirm(`Confirmar ${entradasProvisorias.length} entrada(s) de stock?`)) return;

    setARegistarFaturaEntrada(true);
    const agora = new Date().toISOString();
    const payload = entradasProvisorias.map(item => {
      const preco = item.precoUnit === "" || item.precoUnit === undefined ? null : Number(item.precoUnit);
      return {
        produto: item.produto,
        quantidade: Number(item.quantidade),
        unidade: produtos.find(p => p.nome === item.produto)?.unidade || null,
        precoUnit: preco,
        precoTotal: preco === null ? null : Number(item.quantidade) * preco,
        codigo_artigo: item.codigoArtigo || null,
        datahora: agora,
        responsavel: "Gerente"
      };
    });

    const { error } = await supabase.from("entradas").insert(payload);
    setARegistarFaturaEntrada(false);
    if (error) {
      mostrarErro("Não foi possível registar as entradas", error);
      return;
    }

    setEntradasProvisorias([]);
    setFotografiasEntrada([]);
    setLinhasFaturaEntrada([]);
    setProgressoFaturaEntrada(0);
    await fetchTudo();
    alert("Entradas registadas com sucesso.");
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

  function registarEntradasDaFatura() {
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
      alert("Não existem linhas válidas para adicionar.");
      return;
    }

    validas.forEach(linha => {
      adicionarEntradaProvisoria({
        produto: linha.produto,
        quantidade: numeroEntrada(linha.quantidade),
        precoUnit: linha.precoFatura === "" || linha.precoFatura === undefined ? "" : numeroEntrada(linha.precoFatura),
        codigoArtigo: String(linha.codigoArtigo || "").trim()
      });
    });

    setLinhasFaturaEntrada([]);
    setFotografiasEntrada([]);
    setProgressoFaturaEntrada(0);
  }

  /* ===== FETCH ===== */
  useEffect(() => {
    fetchTudo();
    fetchTemperaturasGerente();
  }, []);

  async function fetchTemperaturasGerente() {
    const [equipamentosRes, registosRes] = await Promise.all([
      supabase.from("equipamentos_temperatura").select("*").order("setor").order("nome"),
      supabase.from("registos_temperatura").select("*").order("registado_em", { ascending: false }).limit(200)
    ]);

    if (equipamentosRes.error || registosRes.error) {
      console.error(equipamentosRes.error || registosRes.error);
      return;
    }

    setEquipamentosTemperatura(equipamentosRes.data || []);
    setRegistosTemperatura(registosRes.data || []);
  }

  async function guardarEquipamentoTemperatura(event) {
    event.preventDefault();
    const minRaw = equipamentoTemperaturaNovo.temperatura_min;
    const maxRaw = equipamentoTemperaturaNovo.temperatura_max;
    const min = minRaw === "" ? null : Number(String(minRaw).replace(",", "."));
    const max = maxRaw === "" ? null : Number(String(maxRaw).replace(",", "."));

    if (!equipamentoTemperaturaNovo.nome.trim()) {
      alert("Indica o nome do equipamento.");
      return;
    }
    if ((min !== null && !Number.isFinite(min)) || (max !== null && !Number.isFinite(max))) {
      alert("Confirma os limites de temperatura.");
      return;
    }
    if (min !== null && max !== null && min > max) {
      alert("A temperatura mínima não pode ser superior à máxima.");
      return;
    }

    const payload = {
      nome: equipamentoTemperaturaNovo.nome.trim(),
      setor: equipamentoTemperaturaNovo.setor,
      temperatura_min: min,
      temperatura_max: max,
      ativo: true
    };

    let res;
    if (equipamentoTemperaturaNovo.id) {
      res = await supabase.from("equipamentos_temperatura").update(payload).eq("id", equipamentoTemperaturaNovo.id);
    } else {
      res = await supabase.from("equipamentos_temperatura").insert(payload);
    }

    if (res.error) {
      mostrarErro("Não foi possível guardar o equipamento", res.error);
      return;
    }

    setEquipamentoTemperaturaNovo({ nome: "", setor: "cozinha", temperatura_min: "", temperatura_max: "" });
    await fetchTemperaturasGerente();
  }

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

  function chaveCodigo(produtoId, fornecedor) {
    return `${produtoId}::${String(fornecedor || "").trim()}`;
  }

  async function guardarCodigoArtigo(produto) {
    const fornecedor = String(produto.procedencia || "").trim();
    if (!produto.id || !fornecedor) return;
    const chave = chaveCodigo(produto.id, fornecedor);
    const valor = String(codigosEdicao[chave] ?? "").trim();
    const atual = String(codigosFornecedor[chave] ?? "").trim();
    if (valor === atual) return;

    if (!valor) {
      const { error } = await supabase.from("produto_fornecedor_codigos")
        .delete().eq("produto_id", produto.id).eq("fornecedor", fornecedor);
      if (error) {
        mostrarErro("Não foi possível remover o código do artigo", error);
        setCodigosEdicao(prev => ({ ...prev, [chave]: atual }));
        return;
      }
      setCodigosFornecedor(prev => {
        const proximo = { ...prev };
        delete proximo[chave];
        return proximo;
      });
      return;
    }

    const { error } = await supabase.from("produto_fornecedor_codigos").upsert(
      { produto_id: produto.id, fornecedor, codigo_artigo: valor, atualizado_em: new Date().toISOString() },
      { onConflict: "produto_id,fornecedor" }
    );

    if (error) {
      mostrarErro("Não foi possível guardar o código do artigo", error);
      setCodigosEdicao(prev => ({ ...prev, [chave]: atual }));
      return;
    }
    setCodigosFornecedor(prev => ({ ...prev, [chave]: valor }));
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
    const { data: codigos, error: erroCodigos } = await supabase
      .from("produto_fornecedor_codigos")
      .select("produto_id,fornecedor,codigo_artigo");
    const { data: ajustes, error: erroAjustes } = await supabase.from("inventario_ajustes")
      .select("id,produto,quantidade_anterior,quantidade_nova,tipo,mes_referencia,motivo,autor_email,criado_em")
      .order("criado_em", { ascending: false }).order("id", { ascending: false }).limit(100);
    if (erroProdutos || erroEntradas || erroSaidas || erroInventario || erroAjustes || erroCodigos) {
      console.error(erroProdutos || erroEntradas || erroSaidas || erroInventario || erroAjustes || erroCodigos);
      setErroStock("Não foi possível carregar os dados do stock. Tenta novamente.");
      return;
    }

    // normaliza unidade no client (para dados antigos)
    const produtosNorm = (p || []).map((x) => ({ ...x, unidade: normalizeUnidade(x.unidade) }));

    setProdutos(produtosNorm);

    const mapaCodigos = {};
    (codigos || []).forEach(item => {
      mapaCodigos[chaveCodigo(item.produto_id, item.fornecedor)] = item.codigo_artigo || "";
    });
    setCodigosFornecedor(mapaCodigos);
    setCodigosEdicao(mapaCodigos);

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

  const inventarioProvisorio = useMemo(() => {
    return produtos
      .filter(p => {
        const valor = inventarioEdicao[p.nome];
        return valor !== "" && valor !== null && typeof valor !== "undefined";
      })
      .map(p => {
        const novo = Number(String(inventarioEdicao[p.nome]).replace(",", "."));
        const atual = Number(inventarioAjustado[p.nome] || 0);
        return {
          ...p,
          valorIntroduzido: inventarioEdicao[p.nome],
          novo: Number.isFinite(novo) ? novo : null,
          atual
        };
      })
      .filter(p => p.novo !== null && p.novo >= 0)
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-PT"));
  }, [produtos, inventarioEdicao, inventarioAjustado]);

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
    // Inventário pode ser total ou parcial.
    // Começa vazio para garantir que apenas os produtos efetivamente contados são atualizados.
    const base = {};
    produtos.forEach(p => {
      base[p.nome] = "";
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
    inventarioMensalLista.forEach(p => {
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

    if (!rows.length) {
      return alert("Preenche pelo menos um produto com um valor válido (zero ou superior).");
    }
    if (!motivoInventario.trim()) return alert("Indica o motivo do inventário antes de gravar.");

    const confirmarParcial = window.confirm(
      `Vais atualizar o inventário de ${rows.length} produto(s).\n\nOs restantes produtos não serão alterados.\n\nContinuar?`
    );
    if (!confirmarParcial) return;

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
      alert(`✅ Inventário atualizado: ${rows.length} produto(s). Atenção: houve ${negativas.length} discrepância(s) negativa(s).`);
    } else {
      alert(`✅ Inventário atualizado: ${rows.length} produto(s). Os restantes mantiveram-se inalterados.`);
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

  function valoresDataHoraEdicao(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { data: "", hora: "" };
    const pad = valor => String(valor).padStart(2, "0");
    return {
      data: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      hora: `${pad(d.getHours())}:${pad(d.getMinutes())}`
    };
  }

  function iniciarEdicaoMovimento(tipo, movimento) {
    const campoData = tipo === "entrada" ? movimento.datahora : movimento.dataHora;
    const { data, hora } = valoresDataHoraEdicao(campoData);
    setMovimentoEdicao({
      tipo,
      id: movimento.id,
      produto: movimento.produto || "",
      quantidade: String(movimento.quantidade ?? ""),
      data,
      hora,
      responsavel: movimento.responsavel || ""
    });
  }

  async function guardarEdicaoMovimento() {
    if (!movimentoEdicao) return;

    const quantidade = Number(String(movimentoEdicao.quantidade).replace(",", "."));
    if (!movimentoEdicao.produto || !Number.isFinite(quantidade) || quantidade <= 0) {
      alert("Confirma o produto e introduz uma quantidade superior a zero.");
      return;
    }
    if (!movimentoEdicao.data || !movimentoEdicao.hora) {
      alert("Confirma a data e a hora.");
      return;
    }

    // As colunas datahora/dataHora são "timestamp without time zone".
    // Guardamos exatamente a data/hora escolhidas, sem converter para UTC,
    // para evitar que o movimento mude de dia e desapareça do filtro.
    const dataHora = `${movimentoEdicao.data}T${movimentoEdicao.hora}:00`;
    const tabela = movimentoEdicao.tipo === "entrada" ? "entradas" : "saidas";
    const campoData = movimentoEdicao.tipo === "entrada" ? "datahora" : "dataHora";

    const payload = {
      produto: movimentoEdicao.produto,
      quantidade,
      responsavel: movimentoEdicao.responsavel.trim() || null,
      [campoData]: dataHora
    };

    if (movimentoEdicao.tipo === "saida") {
      payload.unidade = getUnidadeByNome(movimentoEdicao.produto);
    }

    const { error } = await supabase.from(tabela).update(payload).eq("id", movimentoEdicao.id);
    if (error) {
      mostrarErro("Não foi possível guardar a correção", error);
      return;
    }

    setMovimentoEdicao(null);
    await fetchTudo();
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
          <img src="/logo-cozinha-de-tacho.svg" alt="Cozinha de Tacho" style={{ display: "block", width: 220, maxWidth: "70vw", height: "auto" }} />
          <h2 style={{ margin: "8px 0 0" }}>Gerente · Controlo de stock</h2>
        </div>
        <button onClick={onLogout} style={{ ...styles.button, ...styles.danger }}>
          🔑 Sair
        </button>
      </header>

      <nav className="operacao-nav" aria-label="Secções do Gerente">
        {[
          ["stock", "📊 Resumo"], ["movimentos", "➕ Entradas"], ["saidas", "➖ Saídas"],
          ["inventario", "🧾 Inventário"], ["produtos", "📦 Produtos"],
          ["temperaturas", "🌡️ Temperaturas"], ["haccp", "📋 HACCP"], ["historico", "📜 Histórico"]
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
            <div style={{ marginTop: 12 }}>
              {produtosAbaixoMinimo
                .slice()
                .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-PT"))
                .map(p => {
                  const atual = Number(inventarioAjustado[p.nome] || 0);
                  const minimo = Number(p.minimo || 0);

                  return (
                    <div
                      key={p.nome}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) auto auto",
                        gap: 12,
                        alignItems: "center",
                        padding: "10px 0",
                        borderTop: "1px solid #ecefea"
                      }}
                    >
                      <strong style={{ ...styles.warning, minWidth: 0 }}>{p.nome}</strong>
                      <span style={{ whiteSpace: "nowrap" }}>Atual: {fmtNum(atual, 3)} {p.unidade || ""}</span>
                      <span style={{ whiteSpace: "nowrap" }}>Mín.: {fmtNum(minimo, 3)} {p.unidade || ""}</span>
                    </div>
                  );
                })}
            </div>
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

      {area === "saidas" && <>
        <SaidasRapidas
          produtos={produtos}
          storageKey="gerente-saidas"
          titulo="➖ Saídas de stock"
          onConfirmar={async movimentos => {
            const agora = new Date().toISOString();
            const payload = movimentos.map(item => ({
              produto: item.produto,
              quantidade: Number(item.quantidade),
              unidade: item.unidade || produtos.find(p => p.nome === item.produto)?.unidade || "",
              setor: "Cozinha",
              responsavel: "Gerente",
              dataHora: agora
            }));

            const { error } = await supabase.from("saidas").insert(payload);
            if (error) {
              mostrarErro("Não foi possível registar as saídas", error);
              return false;
            }

            await fetchTudo();
            alert("Saídas registadas com sucesso.");
            return true;
          }}
        />
      </>}

      {area === "inventario" && <>

      {/* ✅ INVENTÁRIO MENSAL (RÁPIDO) */}
      <div style={{ ...styles.card, borderColor: "#4caf50" }}>
        <h3 className="operacao-section-title">🧾 Inventário</h3>
        <p className="operacao-muted">
          Pode ser total ou parcial. Só os produtos que preencheres serão atualizados; os restantes não são alterados.
        </p>

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
              🚀 Iniciar inventário
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
                0️⃣ Preencher visíveis com 0
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
                placeholder="Ex.: Contagem parcial de carnes / inventário de fim de mês"
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

            <div style={{ marginTop: 16, padding: 14, border: "1px solid #d8e2d2", borderRadius: 12, background: "#f8faf7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <strong>📋 Lista provisória do inventário</strong>
                <span style={{ opacity: 0.75 }}>{inventarioProvisorio.length} produto(s)</span>
              </div>

              {inventarioProvisorio.length === 0 ? (
                <p style={{ marginBottom: 0, opacity: 0.7 }}>
                  Ainda não adicionaste nenhum produto. Pesquisa um produto e introduz a quantidade contada.
                </p>
              ) : (
                <div style={{ marginTop: 10 }}>
                  {inventarioProvisorio.map(p => (
                    <div
                      key={`provisorio-${p.nome}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) auto auto",
                        gap: 10,
                        alignItems: "center",
                        padding: "9px 0",
                        borderTop: "1px solid #e4e9e1"
                      }}
                    >
                      <div>
                        <strong>{p.nome}</strong>
                        <div style={{ fontSize: 12, opacity: 0.72 }}>
                          Atual: {fmtNum(p.atual, 3)} {p.unidade || ""} → Novo: {fmtNum(p.novo, 3)} {p.unidade || ""}
                        </div>
                      </div>
                      <span style={{ fontWeight: 700 }}>
                        {fmtNum(p.novo - p.atual, 3)}
                      </span>
                      <button
                        type="button"
                        style={{ ...styles.button, ...styles.secondary, minHeight: 34, padding: "5px 9px" }}
                        onClick={() => setInventarioEdicao(prev => ({ ...prev, [p.nome]: "" }))}
                      >
                        Retirar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: 8 }}>
              <button style={styles.button} type="button" onClick={gravarInventarioMensal}>
                ✅ Atualizar todos os produtos da lista
              </button>
            </div>
          </div>
        )}
      </div>

      </>}

      {area === "temperaturas" && <>
      <SegurancaAlimentarGerente />
      <div style={styles.card}>
        <h3 className="operacao-section-title">🌡️ Configuração de frio e outros equipamentos</h3>
        <p className="operacao-muted">Configuração dos equipamentos do registo geral. Self/Banho-Maria e fritadeiras têm agora controlos próprios acima.</p>

        <form className="operacao-form" onSubmit={guardarEquipamentoTemperatura}>
          <input
            style={styles.input}
            placeholder="Nome do equipamento"
            value={equipamentoTemperaturaNovo.nome}
            onChange={e => setEquipamentoTemperaturaNovo(prev => ({ ...prev, nome: e.target.value }))}
            required
          />
          <select
            style={styles.input}
            value={equipamentoTemperaturaNovo.setor}
            onChange={e => setEquipamentoTemperaturaNovo(prev => ({ ...prev, setor: e.target.value }))}
          >
            <option value="cozinha">🍳 Cozinha</option>
            <option value="atendimento">🛎️ Atendimento</option>
          </select>
          <input
            style={styles.input}
            type="number"
            step="0.1"
            placeholder="Temperatura mínima °C"
            value={equipamentoTemperaturaNovo.temperatura_min}
            onChange={e => setEquipamentoTemperaturaNovo(prev => ({ ...prev, temperatura_min: e.target.value }))}
          />
          <input
            style={styles.input}
            type="number"
            step="0.1"
            placeholder="Temperatura máxima °C"
            value={equipamentoTemperaturaNovo.temperatura_max}
            onChange={e => setEquipamentoTemperaturaNovo(prev => ({ ...prev, temperatura_max: e.target.value }))}
          />
          <button style={styles.button}>
            {equipamentoTemperaturaNovo.id ? "Guardar alterações" : "Adicionar equipamento"}
          </button>
          {equipamentoTemperaturaNovo.id && (
            <button
              type="button"
              style={{ ...styles.button, ...styles.secondary }}
              onClick={() => setEquipamentoTemperaturaNovo({ nome: "", setor: "cozinha", temperatura_min: "", temperatura_max: "" })}
            >
              Cancelar
            </button>
          )}
        </form>
      </div>

      <div style={styles.card}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          <button type="button" style={{ ...styles.button, ...(filtroSetorTemperatura === "cozinha" ? {} : styles.secondary) }} onClick={() => setFiltroSetorTemperatura("cozinha")}>🍳 Cozinha</button>
          <button type="button" style={{ ...styles.button, ...(filtroSetorTemperatura === "atendimento" ? {} : styles.secondary) }} onClick={() => setFiltroSetorTemperatura("atendimento")}>🛎️ Atendimento</button>
        </div>

        <h3 className="operacao-section-title">Equipamentos</h3>
        {equipamentosTemperatura.filter(e => e.setor === filtroSetorTemperatura && !/^Self\b|^Fritadeira\b/i.test(e.nome || "")).length === 0 ? (
          <p className="operacao-muted">Ainda não existem equipamentos nesta área.</p>
        ) : (
          equipamentosTemperatura.filter(e => e.setor === filtroSetorTemperatura && !/^Self\b|^Fritadeira\b/i.test(e.nome || "")).map(eq => (
            <div key={eq.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 8, alignItems: "center", padding: "10px 0", borderBottom: "1px solid #e7eae3", opacity: eq.ativo ? 1 : 0.55 }}>
              <div>
                <strong>{eq.nome}</strong>
                <div style={{ fontSize: 12, opacity: 0.72 }}>
                  {eq.temperatura_min ?? "—"} °C a {eq.temperatura_max ?? "—"} °C {eq.ativo ? "" : "· Inativo"}
                </div>
              </div>
              <button
                type="button"
                style={{ ...styles.button, ...styles.secondary }}
                onClick={() => setEquipamentoTemperaturaNovo({
                  id: eq.id,
                  nome: eq.nome,
                  setor: eq.setor,
                  temperatura_min: eq.temperatura_min ?? "",
                  temperatura_max: eq.temperatura_max ?? ""
                })}
              >
                ✏️ Editar
              </button>
              <button
                type="button"
                style={{ ...styles.button, ...styles.secondary }}
                onClick={async () => {
                  const { error } = await supabase.from("equipamentos_temperatura").update({ ativo: !eq.ativo }).eq("id", eq.id);
                  if (error) return mostrarErro("Não foi possível alterar o equipamento", error);
                  await fetchTemperaturasGerente();
                }}
              >
                {eq.ativo ? "Desativar" : "Ativar"}
              </button>
            </div>
          ))
        )}
      </div>

      <div style={styles.card}>
        <h3 className="operacao-section-title">📜 Histórico de frio/outros · {filtroSetorTemperatura === "cozinha" ? "Cozinha" : "Atendimento"}</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Data/Hora</th>
                <th style={styles.th}>Momento</th>
                <th style={styles.th}>Equipamento</th>
                <th style={styles.th}>Temperatura</th>
                <th style={styles.th}>Responsável</th>
              </tr>
            </thead>
            <tbody>
              {registosTemperatura.filter(r => r.setor === filtroSetorTemperatura).map(r => {
                const d = new Date(r.registado_em);
                return (
                  <tr key={r.id}>
                    <td style={styles.td}>{d.toLocaleDateString("pt-PT")} {d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</td>
                    <td style={styles.td}>{r.momento === "inicio" ? "Início do dia" : r.momento === "fim" ? "Fim do dia" : "—"}</td>
                    <td style={styles.td}>{r.equipamento_nome}</td>
                    <td style={styles.td}>{Number(r.temperatura).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} °C</td>
                    <td style={styles.td}>{r.responsavel}</td>
                  </tr>
                );
              })}
              {registosTemperatura.filter(r => r.setor === filtroSetorTemperatura).length === 0 && (
                <tr><td style={styles.td} colSpan={5}>Ainda não existem registos nesta área.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>}

      {area === "haccp" && <RegistosHACCPGerente />}

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
      <div style={styles.card}>
        <h3 className="operacao-section-title">➕ Registar entrada</h3>

        <h4 style={{ margin: "14px 0 10px" }}>Adicionar manualmente</h4>
        <form className="operacao-form" onSubmit={adicionarEntradaManualGerente}>
          <label>
            <span style={{ display: "block", marginBottom: 5, fontSize: 13, fontWeight: 700 }}>Produto</span>
            <input
              style={styles.input}
              type="search"
              placeholder="Pesquisar produto…"
              value={pesquisaEntrada}
              onChange={e => setPesquisaEntrada(e.target.value)}
            />
            <select
              style={{ ...styles.input, marginTop: 6 }}
              value={entradaNova.produto}
              onChange={e => setEntradaNova({ ...entradaNova, produto: e.target.value })}
              required
            >
              <option value="">Selecionar produto…</option>
              {produtosEntradaFiltrados.map(p => (
                <option key={p.nome} value={p.nome}>{p.nome} ({p.unidade})</option>
              ))}
            </select>
          </label>

          <label>
            <span style={{ display: "block", marginBottom: 5, fontSize: 13, fontWeight: 700 }}>Quantidade</span>
            <input style={styles.input} type="number" inputMode="decimal" min="0.001" step="0.001" value={entradaNova.quantidade} onChange={e => setEntradaNova({ ...entradaNova, quantidade: e.target.value })} required />
          </label>

          <label>
            <span style={{ display: "block", marginBottom: 5, fontSize: 13, fontWeight: 700 }}>Valor unitário (€)</span>
            <input style={styles.input} type="number" inputMode="decimal" min="0" step="0.0001" value={entradaNova.precoUnit} onChange={e => setEntradaNova({ ...entradaNova, precoUnit: e.target.value })} placeholder="Opcional" />
          </label>

          <label>
            <span style={{ display: "block", marginBottom: 5, fontSize: 13, fontWeight: 700 }}>N.º artigo</span>
            <input style={styles.input} type="text" value={entradaNova.codigoArtigo} onChange={e => setEntradaNova({ ...entradaNova, codigoArtigo: e.target.value })} placeholder="Código do fornecedor" />
          </label>

          <button style={styles.button}>Adicionar</button>
        </form>
      </div>

      <div style={styles.card}>
        <h3 className="operacao-section-title">Adicionar através de fotografias da fatura</h3>
        <p className="operacao-muted">Podes adicionar várias fotografias. Serão usadas apenas para a leitura e não ficam guardadas.</p>
        <input type="file" accept="image/*" capture="environment" multiple onChange={juntarFotografiasEntrada} />

        {fotografiasEntrada.map((foto, indice) => (
          <div key={`${foto.name}-${indice}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 0" }}>
            <span>Fotografia {indice + 1}: {foto.name}</span>
            <button type="button" style={{ ...styles.button, ...styles.secondary }} onClick={() => setFotografiasEntrada(lista => lista.filter((_, i) => i !== indice))}>Retirar</button>
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
          <h3 className="operacao-section-title">Validar leitura da fatura</h3>
          <div style={{ padding: 12, borderRadius: 10, background: "#fff8e1", color: "#684f00", marginBottom: 10 }}>
            Compara todas as linhas com a fatura antes de confirmar. Confirma produto, quantidade e unidade do stock; embalagens podem exigir conversão. O valor unitário e o número do artigo podem ser corrigidos antes de adicionar.
          </div>

          {linhasFaturaEntrada.map(linha => (
            <div key={linha.id} style={{ padding: "14px 0", borderBottom: "1px solid #d9ddd4" }}>
              <div style={{ fontSize: 13, color: "#667064", marginBottom: 8 }}>Foto {linha.foto}: {linha.descricao}</div>
              <div className="operacao-form">
                <select style={styles.input} value={linha.produto || ""} onChange={e => atualizarLinhaFaturaEntrada(linha.id, "produto", e.target.value)}>
                  <option value="">Selecionar produto…</option>
                  {produtos.map(p => <option key={p.nome} value={p.nome}>{p.nome} ({p.unidade})</option>)}
                </select>
                <input style={styles.input} type="number" inputMode="decimal" min="0.001" step="0.001" placeholder="Quantidade" value={linha.quantidade} onChange={e => atualizarLinhaFaturaEntrada(linha.id, "quantidade", e.target.value)} />
                <input style={styles.input} type="number" inputMode="decimal" min="0" step="0.0001" placeholder="Valor unitário (€)" value={linha.precoFatura ?? ""} onChange={e => atualizarLinhaFaturaEntrada(linha.id, "precoFatura", e.target.value)} />
                <input style={styles.input} type="text" placeholder="N.º artigo" value={linha.codigoArtigo ?? ""} onChange={e => atualizarLinhaFaturaEntrada(linha.id, "codigoArtigo", e.target.value)} />
                <button type="button" style={{ ...styles.button, ...styles.danger }} onClick={() => setLinhasFaturaEntrada(lista => lista.filter(item => item.id !== linha.id))}>Remover</button>
              </div>
            </div>
          ))}

          <button type="button" style={{ ...styles.button, width: "100%", marginTop: 12 }} onClick={registarEntradasDaFatura}>
            Validar e adicionar à lista provisória
          </button>
        </div>
      )}

      <div style={styles.card}>
        <h3 className="operacao-section-title">Lista provisória</h3>
        {!entradasProvisorias.length ? (
          <p className="operacao-muted">Ainda não foram adicionados produtos.</p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Produto</th>
                    <th style={styles.th}>Quantidade</th>
                    <th style={styles.th}>Valor unit.</th>
                    <th style={styles.th}>N.º artigo</th>
                    <th style={styles.th}>Remover</th>
                  </tr>
                </thead>
                <tbody>
                  {entradasProvisorias.map(linha => {
                    const produto = produtos.find(p => p.nome === linha.produto);
                    return (
                      <tr key={linha.id}>
                        <td style={styles.td}>{linha.produto}<div style={{ fontSize: 12, opacity: 0.7 }}>{produto?.unidade || ""}</div></td>
                        <td style={styles.td}>{fmtNum(linha.quantidade, 3)}</td>
                        <td style={styles.td}>{linha.precoUnit === "" || linha.precoUnit === undefined ? "—" : Number(linha.precoUnit).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</td>
                        <td style={styles.td}>{linha.codigoArtigo || "—"}</td>
                        <td style={styles.td}>
                          <button type="button" style={{ ...styles.button, ...styles.danger }} onClick={() => setEntradasProvisorias(lista => lista.filter(item => item.id !== linha.id))}>Retirar</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button type="button" style={{ ...styles.button, width: "100%", marginTop: 12 }} disabled={aRegistarFaturaEntrada} onClick={confirmarEntradasGerente}>
              {aRegistarFaturaEntrada ? "A guardar…" : "Confirmar entradas"}
            </button>
          </>
        )}
      </div>
      </>}

      {area === "produtos" && <>
      {/* ===== LISTA DE PRODUTOS (✅ CAMPOS COMPLETOS + MAIS BONITO) ===== */}
      <h3 className="operacao-section-title">📝 Produtos e stock</h3>

      <div className="operacao-tools">
        <input
          style={styles.input}
          placeholder="Pesquisar produto ou código…"
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
          ? listaTotal.filter(p => {
              const codigo = codigosFornecedor[chaveCodigo(p.id, p.procedencia)] || "";
              return `${p.nome || ""} ${codigo}`.toLowerCase().includes(pesquisa);
            })
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
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "9%" }} />
                  </colgroup>

                  <thead>
                    <tr>
                      <th style={styles.thProdutos}>Nome</th>
                      <th style={styles.thProdutos}>Unidade</th>
                      <th style={styles.thProdutos}>Código artigo</th>
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
                        const minimo = p.minimo === null || p.minimo === undefined || p.minimo === "" ? null : Number(p.minimo);
                        const preco = Number(p.preco_unit || 0);

                        const abaixo = minimo !== null && stockAjust < minimo;
                        const aberto = produtoAberto === p.nome;

                        return (
                          <>
                            <tr key={`${proc}-${p.nome}`} style={abaixo ? styles.rowBad : undefined}>
                              <td data-label="Produto" style={{ ...styles.tdProdutos, ...styles.nomeProdutoCell }} title={p.nome}>
                                {p.nome}
                              </td>

                              <td data-label="Unidade" style={styles.tdProdutos}>{p.unidade || ""}</td>
                              <td data-label="Código artigo" style={styles.tdProdutos}>
                                <input
                                  style={{ ...styles.input, width: "100%", minWidth: 105, boxSizing: "border-box" }}
                                  type="text"
                                  placeholder="Código"
                                  value={codigosEdicao[chaveCodigo(p.id, p.procedencia)] ?? ""}
                                  onChange={e => {
                                    const chave = chaveCodigo(p.id, p.procedencia);
                                    setCodigosEdicao(prev => ({ ...prev, [chave]: e.target.value }));
                                  }}
                                  onBlur={() => guardarCodigoArtigo(p)}
                                />
                              </td>
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
                              <td data-label="Mínimo" style={styles.tdProdutosRight}>{minimo === null ? "—" : fmtNum(minimo, 3)}</td>
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
                <col style={{ width: "29%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "10%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={styles.thHist}>Produto</th>
                  <th style={styles.thHist}>Unid.</th>
                  <th style={styles.thHist}>Quantidade</th>
                  <th style={styles.thHist}>Data</th>
                  <th style={styles.thHist}>Hora</th>
                  <th style={styles.thHist}>Responsável</th>
                  <th style={styles.thHist}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {entradasFiltradas.map(e => {
                  const { data, hora } = formatDateTimeParts(e.datahora);
                  return (
                    <tr key={e.id}>
                      <td data-label="Produto" style={styles.tdHist} title={e.produto || ""}>
                        {movimentoEdicao?.tipo === "entrada" && movimentoEdicao?.id === e.id ? (
                          <select style={styles.input} value={movimentoEdicao.produto} onChange={ev => setMovimentoEdicao(prev => ({ ...prev, produto: ev.target.value }))}>
                            {produtos.map(p => <option key={p.id || p.nome} value={p.nome}>{p.nome}</option>)}
                          </select>
                        ) : e.produto || ""}
                      </td>
                      <td data-label="Unidade" style={styles.tdHist}>{getUnidadeByNome(movimentoEdicao?.tipo === "entrada" && movimentoEdicao?.id === e.id ? movimentoEdicao.produto : e.produto)}</td>
                      <td data-label="Quantidade" style={styles.tdHistRight}>
                        {movimentoEdicao?.tipo === "entrada" && movimentoEdicao?.id === e.id
                          ? <input style={styles.input} type="number" step="0.001" value={movimentoEdicao.quantidade} onChange={ev => setMovimentoEdicao(prev => ({ ...prev, quantidade: ev.target.value }))} />
                          : fmtNum(e.quantidade, 3)}
                      </td>
                      <td data-label="Data" style={styles.tdHist}>
                        {movimentoEdicao?.tipo === "entrada" && movimentoEdicao?.id === e.id
                          ? <input style={styles.input} type="date" value={movimentoEdicao.data} onChange={ev => setMovimentoEdicao(prev => ({ ...prev, data: ev.target.value }))} />
                          : data}
                      </td>
                      <td data-label="Hora" style={styles.tdHist}>
                        {movimentoEdicao?.tipo === "entrada" && movimentoEdicao?.id === e.id
                          ? <input style={styles.input} type="time" value={movimentoEdicao.hora} onChange={ev => setMovimentoEdicao(prev => ({ ...prev, hora: ev.target.value }))} />
                          : hora}
                      </td>
                      <td data-label="Responsável" style={styles.tdHist}>
                        {movimentoEdicao?.tipo === "entrada" && movimentoEdicao?.id === e.id
                          ? <input style={styles.input} value={movimentoEdicao.responsavel} onChange={ev => setMovimentoEdicao(prev => ({ ...prev, responsavel: ev.target.value }))} />
                          : e.responsavel || "—"}
                      </td>
                      <td data-label="Ações" style={styles.tdHist}>
                        {movimentoEdicao?.tipo === "entrada" && movimentoEdicao?.id === e.id ? (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button type="button" style={{ ...styles.button, minHeight: 36, padding: "6px 10px" }} onClick={guardarEdicaoMovimento}>✅ Guardar</button>
                            <button type="button" style={{ ...styles.button, ...styles.secondary, minHeight: 36, padding: "6px 10px" }} onClick={() => setMovimentoEdicao(null)}>Cancelar</button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button type="button" style={{ ...styles.button, minHeight: 36, padding: "6px 10px" }} onClick={() => iniciarEdicaoMovimento("entrada", e)}>✏️ Editar</button>
                            <button
                              type="button"
                              style={{ ...styles.button, ...styles.danger, minHeight: 36, padding: "6px 10px" }}
                              onClick={async () => {
                                const confirmar = window.confirm(
                                  `Eliminar esta entrada?\n\n${e.produto || ""} · ${fmtNum(e.quantidade, 3)} ${getUnidadeByNome(e.produto)}\n${data} às ${hora}\n\nEsta ação vai alterar o stock.`
                                );
                                if (!confirmar) return;
                                const { error } = await supabase.from("entradas").delete().eq("id", e.id);
                                if (error) {
                                  mostrarErro("Não foi possível eliminar a entrada", error);
                                  return;
                                }
                                await fetchTudo();
                              }}
                            >
                              🗑️ Eliminar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {entradasFiltradas.length === 0 && (
                  <tr>
                    <td data-label="" style={styles.tdHist} colSpan={7}>Sem entradas no intervalo.</td>
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
                <col style={{ width: "29%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "10%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={styles.thHist}>Produto</th>
                  <th style={styles.thHist}>Unid.</th>
                  <th style={styles.thHist}>Quantidade</th>
                  <th style={styles.thHist}>Data</th>
                  <th style={styles.thHist}>Hora</th>
                  <th style={styles.thHist}>Responsável</th>
                  <th style={styles.thHist}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {saidasFiltradas.map(s => {
                  const { data, hora } = formatDateTimeParts(s.dataHora);
                  return (
                    <tr key={s.id}>
                      <td data-label="Produto" style={styles.tdHist} title={s.produto || ""}>
                        {movimentoEdicao?.tipo === "saida" && movimentoEdicao?.id === s.id ? (
                          <select style={styles.input} value={movimentoEdicao.produto} onChange={ev => setMovimentoEdicao(prev => ({ ...prev, produto: ev.target.value }))}>
                            {produtos.map(p => <option key={p.id || p.nome} value={p.nome}>{p.nome}</option>)}
                          </select>
                        ) : s.produto || ""}
                      </td>
                      <td data-label="Unidade" style={styles.tdHist}>{getUnidadeByNome(movimentoEdicao?.tipo === "saida" && movimentoEdicao?.id === s.id ? movimentoEdicao.produto : s.produto)}</td>
                      <td data-label="Quantidade" style={styles.tdHistRight}>
                        {movimentoEdicao?.tipo === "saida" && movimentoEdicao?.id === s.id
                          ? <input style={styles.input} type="number" step="0.001" value={movimentoEdicao.quantidade} onChange={ev => setMovimentoEdicao(prev => ({ ...prev, quantidade: ev.target.value }))} />
                          : fmtNum(s.quantidade, 3)}
                      </td>
                      <td data-label="Data" style={styles.tdHist}>
                        {movimentoEdicao?.tipo === "saida" && movimentoEdicao?.id === s.id
                          ? <input style={styles.input} type="date" value={movimentoEdicao.data} onChange={ev => setMovimentoEdicao(prev => ({ ...prev, data: ev.target.value }))} />
                          : data}
                      </td>
                      <td data-label="Hora" style={styles.tdHist}>
                        {movimentoEdicao?.tipo === "saida" && movimentoEdicao?.id === s.id
                          ? <input style={styles.input} type="time" value={movimentoEdicao.hora} onChange={ev => setMovimentoEdicao(prev => ({ ...prev, hora: ev.target.value }))} />
                          : hora}
                      </td>
                      <td data-label="Responsável" style={styles.tdHist}>
                        {movimentoEdicao?.tipo === "saida" && movimentoEdicao?.id === s.id
                          ? <input style={styles.input} value={movimentoEdicao.responsavel} onChange={ev => setMovimentoEdicao(prev => ({ ...prev, responsavel: ev.target.value }))} />
                          : s.responsavel || "—"}
                      </td>
                      <td data-label="Ações" style={styles.tdHist}>
                        {movimentoEdicao?.tipo === "saida" && movimentoEdicao?.id === s.id ? (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button type="button" style={{ ...styles.button, minHeight: 36, padding: "6px 10px" }} onClick={guardarEdicaoMovimento}>✅ Guardar</button>
                            <button type="button" style={{ ...styles.button, ...styles.secondary, minHeight: 36, padding: "6px 10px" }} onClick={() => setMovimentoEdicao(null)}>Cancelar</button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button type="button" style={{ ...styles.button, minHeight: 36, padding: "6px 10px" }} onClick={() => iniciarEdicaoMovimento("saida", s)}>✏️ Editar</button>
                            <button
                              type="button"
                              style={{ ...styles.button, ...styles.danger, minHeight: 36, padding: "6px 10px" }}
                              onClick={async () => {
                                const confirmar = window.confirm(
                                  `Eliminar esta saída?\n\n${s.produto || ""} · ${fmtNum(s.quantidade, 3)} ${getUnidadeByNome(s.produto)}\n${data} às ${hora}\n\nEsta ação vai alterar o stock.`
                                );
                                if (!confirmar) return;
                                const { error } = await supabase.from("saidas").delete().eq("id", s.id);
                                if (error) {
                                  mostrarErro("Não foi possível eliminar a saída", error);
                                  return;
                                }
                                await fetchTudo();
                              }}
                            >
                              🗑️ Eliminar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {saidasFiltradas.length === 0 && (
                  <tr>
                    <td data-label="" style={styles.tdHist} colSpan={7}>Sem saídas no intervalo.</td>
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
