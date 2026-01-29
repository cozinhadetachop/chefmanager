import { useEffect, useState } from "react";
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
  td: { padding: "6px 4px" }
};

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

    setProdutos(p || []);
    setEntradas(e || []);
    setSaidas(s || []);

    const map = {};
    r?.forEach(i => (map[i.produto] = i.quantidade));
    setInventarioReal(map);
  }

  /* ===== INVENTÁRIO TEÓRICO ===== */
  const inventarioTeorico = {};
  entradas.forEach(e => {
    inventarioTeorico[e.produto] = (inventarioTeorico[e.produto] || 0) + Number(e.quantidade);
  });
  saidas.forEach(s => {
    inventarioTeorico[s.produto] = (inventarioTeorico[s.produto] || 0) - Number(s.quantidade);
  });

  /* ===== AVISOS + VALOR TOTAL ===== */
  const produtosAbaixoMinimo = produtos.filter(
    p => (inventarioTeorico[p.nome] || 0) < p.minimo
  );

  const valorTotalStock = produtos.reduce((acc, p) => {
    const stock = inventarioTeorico[p.nome] || 0;
    return acc + stock * p.preco_unit;
  }, 0);

  /* ===== FUNÇÃO FILTRO INTERVALO (YYYY-MM-DD) ===== */
  function dentroIntervalo(iso, de, ate) {
    if (!iso) return false;
    const d = String(iso).slice(0, 10);
    if (de && d < de) return false;
    if (ate && d > ate) return false;
    return true;
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
  const produtosPorProcedencia = {};
  produtos.forEach(p => {
    const procRaw = (p.procedencia ?? "").toString().trim();
    const proc = procRaw ? procRaw : "Sem procedência";
    if (!produtosPorProcedencia[proc]) produtosPorProcedencia[proc] = [];
    produtosPorProcedencia[proc].push(p);
  });
  const procedenciasOrdenadas = Object.keys(produtosPorProcedencia).sort((a, b) => a.localeCompare(b));

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

      {/* ===== PRODUTO (CRIAR / EDITAR) ===== */}
      <h3>📦 Produto</h3>
      <form
        onSubmit={async e => {
          e.preventDefault();

          if (produtoNovo.id) {
            await supabase.from("produtos").update(produtoNovo).eq("id", produtoNovo.id);
          } else {
            await supabase.from("produtos").insert([
              {
                ...produtoNovo,
                minimo: Number(produtoNovo.minimo),
                preco_unit: Number(produtoNovo.preco_unit)
              }
            ]);
          }

          setProdutoNovo({ nome: "", unidade: "", procedencia: "", minimo: "", preco_unit: "" });
          fetchTudo();
        }}
      >
        {["nome", "unidade", "procedencia", "minimo", "preco_unit"].map(k => (
          <input
            key={k}
            style={styles.input}
            placeholder={k}
            value={produtoNovo[k] || ""}
            onChange={e => setProdutoNovo({ ...produtoNovo, [k]: e.target.value })}
            required
          />
        ))}
        <button style={styles.button}>
          {produtoNovo.id ? "Guardar alterações" : "Adicionar"}
        </button>
      </form>

      {/* ===== ENTRADA DE STOCK ===== */}
      <h3>➕ Entrada de Stock</h3>
      <form
        onSubmit={async e => {
          e.preventDefault();

          const { data } = await supabase.from("entradas").insert([entradaNova]).select();

          setEntradas(prev => [data[0], ...prev]);
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

      {/* ===== LISTA DE PRODUTOS (✅ POR PROCEDÊNCIA COLAPSÁVEL + PESQUISA) ===== */}
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

        // quando estás a pesquisar, escondemos procedências vazias para não ficar enorme
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
              <div style={{ marginLeft: 12 }}>
                {listaFiltrada
                  .slice()
                  .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
                  .map(p => {
                    const stock = inventarioTeorico[p.nome] || 0;
                    const aberto = produtoAberto === p.nome;

                    return (
                      <div key={`${proc}-${p.nome}`} style={{ padding: "6px 0", borderTop: "1px solid #eee" }}>
                        <div
                          style={styles.produtoLinha}
                          onClick={() => setProdutoAberto(aberto ? null : p.nome)}
                        >
                          {aberto ? "▼" : "▶"} {p.nome}
                        </div>

                        {aberto && (
                          <>
                            <p>Unidade: {p.unidade}</p>
                            <p>Stock teórico: {stock}</p>

                            <input
                              style={styles.input}
                              type="number"
                              placeholder="Inventário real"
                              value={inventarioReal[p.nome] || ""}
                              onChange={e =>
                                setInventarioReal({ ...inventarioReal, [p.nome]: e.target.value })
                              }
                              onBlur={async () => {
                                await supabase.from("inventario_real").upsert({
                                  produto: p.nome,
                                  quantidade: Number(inventarioReal[p.nome])
                                });
                              }}
                            />

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
                          </>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
