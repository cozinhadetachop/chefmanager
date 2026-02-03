import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

/* ✅ PDF */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ===== Estilos ===== */
const styles = {
  app: { padding: 20, fontFamily: "sans-serif" },
  card: { border: "1px solid #ccc", borderRadius: 6, padding: 12, marginBottom: 12 },
  input: { padding: "4px 6px", margin: "2px 4px" },
  button: { padding: "4px 8px", marginLeft: 4, cursor: "pointer" },
  danger: { backgroundColor: "#f44336", color: "white" },
  warning: { color: "#e53935", fontWeight: "bold" },
  produtoLinha: { cursor: "pointer", fontWeight: "bold", padding: "6px 0" },

  /* tabela alertas */
  table: { width: "100%", borderCollapse: "collapse", marginTop: 8 },
  th: { textAlign: "left", borderBottom: "1px solid #ccc", padding: "6px 4px" },
  td: { padding: "6px 4px", borderBottom: "1px solid #f0f0f0" },

  /* tabela produtos */
  tdRight: { padding: "6px 4px", borderBottom: "1px solid #f0f0f0", textAlign: "right" },
  rowBad: { backgroundColor: "#fff3f3" }
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

export default function Gerente({ onLogout }) {
  /* ===== ESTADOS ===== */
  const [produtos, setProdutos] = useState([]);
  const [entradas, setEntradas] = useState([]);
  const [saidas, setSaidas] = useState([]);
  const [inventarioReal, setInventarioReal] = useState({});
  const [produtoAberto, setProdutoAberto] = useState(null);

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

  /* ✅ INVENTÁRIO MENSAL (RÁPIDO) */
  const [modoInventarioMensal, setModoInventarioMensal] = useState(false);
  const [inventarioMes, setInventarioMes] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [inventarioEdicao, setInventarioEdicao] = useState({}); // { produto: "12.3" }
  const [inventarioColar, setInventarioColar] = useState("");
  const [inventarioFiltro, setInventarioFiltro] = useState("");

  /* ===== FILTROS (INTERVALO) ===== */
  const [filtroEntradaDe, setFiltroEntradaDe] = useState("");
  const [filtroEntradaAte, setFiltroEntradaAte] = useState("");

  const [filtroDataSaidas, setFiltroDataSaidas] = useState(""); // Saídas: De
  const [filtroDataSaidasAte, setFiltroDataSaidasAte] = useState(""); // Saídas: Até

  /* ✅ ORGANIZAÇÃO PRODUTOS (COLAPSÁVEL + PESQUISA) */
  const [pesquisaProduto, setPesquisaProduto] = useState("");
  const [procedenciasAbertas, setProcedenciasAbertas] = useState({}); // { "Makro": true, ... }

  /* ===== FETCH ===== */
  useEffect(() => {
    fetchTudo();
  }, []);

  async function fetchTudo() {
    const { data: p } = await supabase.from("produtos").select("*").order("nome");
    const { data: e } = await supabase.from("entradas").select("*").order("datahora", { ascending: false });
    const { data: s } = await supabase.from("saidas").select("*").order("dataHora", { ascending: false });
    const { data: r } = await supabase.from("inventario_real").select("*");

    // normaliza unidade no client (para dados antigos)
    const produtosNorm = (p || []).map((x) => ({ ...x, unidade: normalizeUnidade(x.unidade) }));

    setProdutos(produtosNorm);
    setEntradas(e || []);
    setSaidas(s || []);

    const map = {};
    r?.forEach(i => (map[i.produto] = i.quantidade));
    setInventarioReal(map);
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
    return produtos.filter(p => (Number(inventarioTeorico[p.nome] || 0)) < Number(p.minimo || 0));
  }, [produtos, inventarioTeorico]);

  const valorTotalStock = useMemo(() => {
    return produtos.reduce((acc, p) => {
      const stock = Number(inventarioTeorico[p.nome] || 0);
      const preco = Number(p.preco_unit || 0);
      return acc + stock * preco;
    }, 0);
  }, [produtos, inventarioTeorico]);

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
    // grava em massa no inventario_real, e reflete no Stock real imediatamente
    // (depende de inventario_real.produto ser UNIQUE ou PK para o upsert funcionar bem)
    const rows = produtos
      .map(p => {
        const raw = inventarioEdicao[p.nome];
        const val = Number(String(raw ?? "").replace(",", "."));
        if (!Number.isFinite(val)) return null;
        return { produto: p.nome, quantidade: val };
      })
      .filter(Boolean);

    if (!rows.length) return alert("Sem valores válidos para gravar.");

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

    const { error } = await supabase.from("inventario_real").upsert(rows);

    if (error) {
      console.error(error);
      return alert(
        "Erro ao gravar inventário mensal. Vê a consola e confirma se 'produto' é UNIQUE/PK em inventario_real."
      );
    }

    // atualiza UI
    const nextReal = { ...inventarioReal };
    rows.forEach(r => (nextReal[r.produto] = r.quantidade));
    setInventarioReal(nextReal);

    await fetchTudo();

    if (negativas.length > 0) {
      alert(
        `✅ Inventário gravado (mês: ${inventarioMes}). Atenção: houve ${negativas.length} discrepância(s) negativa(s).`
      );
    } else {
      alert(`✅ Inventário gravado (mês: ${inventarioMes}). Já aparece em Stock real.`);
    }

    setModoInventarioMensal(false);
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
      return [e.produto || "", getUnidadeByNome(e.produto), String(e.quantidade ?? ""), data, hora, "Gerente"];
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

  /* ✅ PDF STOCK */
  function exportPDFStock() {
    if (!produtos.length) return alert("Sem produtos para exportar.");

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

    doc.setFontSize(14);
    doc.text("Stock (Inventário Teórico)", 40, 40);

    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 40, 60);

    const rows = produtos
      .slice()
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
      .map(p => {
        const stock = Number(inventarioTeorico[p.nome] || 0);
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

    const finalY = (doc.lastAutoTable?.finalY || 80) + 20;
    doc.setFontSize(12);
    doc.text(`Total do stock: ${valorTotalStock.toFixed(2)} €`, 40, finalY);

    doc.save("stock_inventario_teorico.pdf");
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

  return (
    <div style={styles.app}>
      <button onClick={onLogout} style={{ ...styles.button, ...styles.danger }}>
        🔑 Sair
      </button>

      <h2>👔 Gerente — Controlo Completo</h2>

      {/* ===== AVISOS (AGORA EM TABELA) ===== */}
      {produtosAbaixoMinimo.length > 0 && (
        <div style={{ ...styles.card, borderColor: "#e53935" }}>
          <h3>⚠ Avisos de Stock</h3>

          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Produto</th>
                <th style={styles.th}>Stock</th>
                <th style={styles.th}>Mínimo</th>
              </tr>
            </thead>
            <tbody>
              {produtosAbaixoMinimo.map(p => (
                <tr key={p.nome}>
                  <td style={{ ...styles.td, ...styles.warning }}>{p.nome}</td>
                  <td style={styles.td}>{inventarioTeorico[p.nome] || 0}</td>
                  <td style={styles.td}>{p.minimo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>💰 Valor total de stock: {valorTotalStock.toFixed(2)} €</h3>

      {/* ✅ BOTÃO PDF STOCK */}
      <div style={{ marginBottom: 12 }}>
        <button style={styles.button} onClick={exportPDFStock} type="button">
          📄 PDF Stock
        </button>
      </div>

      {/* ✅ INVENTÁRIO MENSAL (RÁPIDO) */}
      <div style={{ ...styles.card, borderColor: "#4caf50" }}>
        <h3>🧾 Inventário mensal (rápido) → atualiza Stock real</h3>

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
                style={{ ...styles.input, width: 260 }}
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

                <button style={styles.button} type="button" onClick={gravarInventarioMensal}>
                  ✅ Gravar inventário do mês (Stock real)
                </button>
              </div>
            </div>

            <table style={styles.table}>
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
                      <td style={styles.td}>{p.nome}</td>
                      <td style={styles.td}>{p.unidade || ""}</td>
                      <td style={styles.tdRight}>{fmtNum(stockTeo, 3)}</td>
                      <td style={styles.tdRight}>
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

      {/* ===== PRODUTO (CRIAR / EDITAR) ===== */}
      <h3>📦 Produto</h3>
      <form
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
            console.error(res.error);
            return alert("❌ Não consegui guardar o produto. Vê a consola.");
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

      {/* ===== ENTRADA DE STOCK ===== */}
      <h3>➕ Entrada de Stock</h3>
      <form
        onSubmit={async e => {
          e.preventDefault();

          const payload = {
            ...entradaNova,
            quantidade: Number(String(entradaNova.quantidade).replace(",", ".")),
            datahora: new Date().toISOString()
          };

          const { data } = await supabase.from("entradas").insert([payload]).select();

          setEntradas(prev => [data?.[0], ...prev].filter(Boolean));
          setEntradaNova({ produto: "", quantidade: "", datahora: new Date().toISOString() });
          fetchTudo();
        }}
      >
        <select
          style={styles.input}
          value={entradaNova.produto}
          onChange={e => setEntradaNova({ ...entradaNova, produto: e.target.value })}
          required
        >
          <option value="">Produto</option>
          {produtos.map(p => (
            <option key={p.nome} value={p.nome}>
              {p.nome} ({p.unidade})
            </option>
          ))}
        </select>

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

      {/* ===== HISTÓRICO DE ENTRADAS (FILTRO INTERVALO) ===== */}
      <h3>📜 Histórico de Entradas</h3>
      <div style={{ marginBottom: 8 }}>
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

      {entradas
        .filter(e => dentroIntervalo(e.datahora, filtroEntradaDe, filtroEntradaAte))
        .map(e => {
          const produtoInfo = produtos.find(p => p.nome === e.produto);
          const data = new Date(e.datahora);

          return (
            <div key={e.id} style={{ marginBottom: 4 }}>
              {e.produto} ({produtoInfo?.unidade || ""}) — {e.quantidade} |{" "}
              {data.toLocaleDateString()}{" "}
              {data.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} | Gerente
            </div>
          );
        })}

      {/* ===== HISTÓRICO DE SAÍDAS (FILTRO INTERVALO) ===== */}
      <h3>📜 Histórico de Saídas</h3>
      <div style={{ marginBottom: 8 }}>
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

      {saidas
        .filter(s => dentroIntervalo(s.dataHora, filtroDataSaidas, filtroDataSaidasAte))
        .map(s => {
          const produtoInfo = produtos.find(p => p.nome === s.produto);
          const data = new Date(s.dataHora);

          return (
            <div key={s.id} style={{ marginBottom: 4 }}>
              {s.produto} ({produtoInfo?.unidade || ""}) — {s.quantidade} |{" "}
              {data.toLocaleDateString()}{" "}
              {data.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} |{" "}
              {s.responsavel || "—"}
            </div>
          );
        })}

      {/* ===== LISTA DE PRODUTOS (✅ CAMPOS COMPLETOS) ===== */}
      <h3>📝 Produtos</h3>

      <div style={{ marginBottom: 8 }}>
        <input
          style={{ ...styles.input, width: 260 }}
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

        const aberta = !!procedenciasAbertas[proc];

        return (
          <div key={proc} style={styles.card}>
            <div
              style={{
                ...styles.produtoLinha,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
              onClick={() => toggleProcedencia(proc)}
            >
              <span>{aberta ? "▼" : "▶"} {proc}</span>
              <span style={{ fontWeight: "normal" }}>
                {listaFiltrada.length}/{listaTotal.length}
              </span>
            </div>

            {aberta && (
              <div style={{ marginLeft: 8, marginTop: 8 }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Nome</th>
                      <th style={styles.th}>Unidade</th>
                      <th style={styles.th}>Stock teórico</th>
                      <th style={styles.th}>Stock real</th>
                      <th style={styles.th}>Stock mínimo</th>
                      <th style={styles.th}>Preço unit.</th>
                      <th style={styles.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {listaFiltrada
                      .slice()
                      .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
                      .map(p => {
                        const stockTeo = Number(inventarioTeorico[p.nome] || 0);
                        const stockReal = Number(inventarioReal[p.nome] || 0);
                        const minimo = Number(p.minimo || 0);
                        const preco = Number(p.preco_unit || 0);
                        const abaixo = stockTeo < minimo;

                        const aberto = produtoAberto === p.nome;

                        return (
                          <>
                            <tr
                              key={`${proc}-${p.nome}`}
                              style={abaixo ? styles.rowBad : undefined}
                            >
                              <td style={styles.td}>{p.nome}</td>
                              <td style={styles.td}>{p.unidade || ""}</td>
                              <td style={styles.tdRight}>{fmtNum(stockTeo, 3)}</td>

                              {/* ✅ Stock real editável inline (blur faz upsert) */}
                              <td style={styles.tdRight}>
                                <input
                                  style={{ ...styles.input, width: 90, textAlign: "right" }}
                                  type="number"
                                  step="0.001"
                                  value={inventarioReal[p.nome] ?? ""}
                                  onChange={e =>
                                    setInventarioReal({ ...inventarioReal, [p.nome]: e.target.value })
                                  }
                                  onBlur={async () => {
                                    const val = Number(String(inventarioReal[p.nome] ?? "").replace(",", "."));
                                    if (!Number.isFinite(val)) return;

                                    await supabase.from("inventario_real").upsert({
                                      produto: p.nome,
                                      quantidade: val
                                    });

                                    fetchTudo();
                                  }}
                                  placeholder="0"
                                />
                              </td>

                              <td style={styles.tdRight}>{fmtNum(minimo, 3)}</td>
                              <td style={styles.tdRight}>{fmtNum(preco, 2)} €</td>

                              <td style={styles.tdRight}>
                                <button
                                  style={styles.button}
                                  type="button"
                                  onClick={() => setProdutoAberto(aberto ? null : p.nome)}
                                >
                                  {aberto ? "Fechar" : "Abrir"}
                                </button>
                              </td>
                            </tr>

                            {aberto && (
                              <tr key={`${proc}-${p.nome}-acoes`}>
                                <td style={styles.td} colSpan={7}>
                                  <button style={styles.button} onClick={() => setProdutoNovo(p)} type="button">
                                    ✏ Editar
                                  </button>

                                  <button
                                    style={{ ...styles.button, ...styles.danger }}
                                    onClick={async () => {
                                      if (!window.confirm(`Apagar ${p.nome}?`)) return;
                                      await supabase.from("produtos").delete().eq("id", p.id);
                                      fetchTudo();
                                    }}
                                    type="button"
                                  >
                                    ❌ Apagar
                                  </button>

                                  {abaixo && (
                                    <span style={{ marginLeft: 10, ...styles.warning }}>
                                      ⚠ Abaixo do mínimo (teórico)
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
    </div>
  );
}
