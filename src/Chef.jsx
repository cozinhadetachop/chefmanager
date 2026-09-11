import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const colors = {
  green: "#536b45",
  greenDark: "#34452d",
  cream: "#f7f5ef",
  border: "#d9ddd4",
  red: "#b42318",
  redSoft: "#fff1f0"
};

const styles = {
  app: {
    minHeight: "100vh",
    padding: 16,
    boxSizing: "border-box",
    fontFamily: "Arial, sans-serif",
    color: "#252b23",
    background: colors.cream
  },
  shell: { maxWidth: 900, margin: "0 auto" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 16
  },
  title: { margin: 0, fontSize: 24 },
  subtitle: { margin: "4px 0 0", color: "#647060", fontSize: 14 },
  tabs: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 8,
    marginBottom: 16
  },
  tab: {
    minHeight: 48,
    padding: "10px 12px",
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    background: "white",
    cursor: "pointer",
    fontWeight: 700
  },
  activeTab: { background: colors.green, borderColor: colors.green, color: "white" },
  card: {
    padding: 16,
    marginBottom: 12,
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    background: "white"
  },
  summary: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 10,
    marginBottom: 12
  },
  summaryCard: {
    padding: 14,
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    background: "white"
  },
  input: {
    width: "100%",
    minHeight: 44,
    padding: "10px 12px",
    boxSizing: "border-box",
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    fontSize: 16,
    background: "white"
  },
  form: { display: "grid", gap: 10, maxWidth: 560 },
  button: {
    minHeight: 44,
    padding: "10px 14px",
    border: 0,
    borderRadius: 8,
    background: colors.green,
    color: "white",
    cursor: "pointer",
    fontWeight: 700
  },
  logout: {
    minHeight: 40,
    padding: "8px 12px",
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    background: "white",
    cursor: "pointer"
  },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 560 },
  th: { padding: "10px 8px", textAlign: "left", borderBottom: `2px solid ${colors.border}` },
  td: { padding: "10px 8px", borderBottom: `1px solid ${colors.border}` },
  tdRight: { padding: "10px 8px", textAlign: "right", borderBottom: `1px solid ${colors.border}` },
  warningRow: { background: colors.redSoft },
  error: { color: colors.red, fontWeight: 700 }
};

function toNumber(value) {
  return Number(String(value ?? "").replace(",", "."));
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString("pt-PT", { maximumFractionDigits: 3 })
    : "0";
}

export default function Chef({ onLogout }) {
  const [area, setArea] = useState("stock");
  const [produtos, setProdutos] = useState([]);
  const [entradas, setEntradas] = useState([]);
  const [saidas, setSaidas] = useState([]);
  const [inventarioReal, setInventarioReal] = useState({});
  const [inventarioAtualizadoEm, setInventarioAtualizadoEm] = useState({});
  const [pesquisa, setPesquisa] = useState("");
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState("");

  const [entrada, setEntrada] = useState({ produto: "", quantidade: "" });
  const [saida, setSaida] = useState({ produto: "", quantidade: "", responsavel: "" });
  const [contagens, setContagens] = useState({});

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setACarregar(true);
    setErro("");

    const [produtosRes, entradasRes, saidasRes, inventarioRes] = await Promise.all([
      supabase.from("produtos").select("*").order("nome"),
      supabase.from("entradas").select("*").order("datahora", { ascending: false }),
      supabase.from("saidas").select("*").order("dataHora", { ascending: false }),
      supabase.from("inventario_real").select("*")
    ]);

    const falha = [produtosRes, entradasRes, saidasRes, inventarioRes].find(r => r.error);
    if (falha) {
      console.error(falha.error);
      setErro("Não foi possível carregar os dados. Verifica a ligação à internet.");
      setACarregar(false);
      return;
    }

    setProdutos(produtosRes.data || []);
    setEntradas(entradasRes.data || []);
    setSaidas(saidasRes.data || []);

    const quantidades = {};
    const datas = {};
    (inventarioRes.data || []).forEach(item => {
      quantidades[item.produto] = Number(item.quantidade || 0);
      datas[item.produto] = item.updated_at || null;
    });
    setInventarioReal(quantidades);
    setInventarioAtualizadoEm(datas);
    setACarregar(false);
  }

  const stockAtual = useMemo(() => {
    const stock = {};

    produtos.forEach(produto => {
      const nome = produto.nome;
      const temContagem = Object.prototype.hasOwnProperty.call(inventarioReal, nome);
      const corte = inventarioAtualizadoEm[nome] ? new Date(inventarioAtualizadoEm[nome]) : null;
      let quantidade = temContagem ? Number(inventarioReal[nome] || 0) : 0;

      entradas.forEach(movimento => {
        if (movimento.produto !== nome) return;
        if (corte && new Date(movimento.datahora) < corte) return;
        quantidade += Number(movimento.quantidade || 0);
      });

      saidas.forEach(movimento => {
        if (movimento.produto !== nome) return;
        if (corte && new Date(movimento.dataHora) < corte) return;
        quantidade -= Number(movimento.quantidade || 0);
      });

      stock[nome] = quantidade;
    });

    return stock;
  }, [produtos, entradas, saidas, inventarioReal, inventarioAtualizadoEm]);

  const produtosFiltrados = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase();
    return produtos.filter(p => !termo || (p.nome || "").toLowerCase().includes(termo));
  }, [produtos, pesquisa]);

  const abaixoDoMinimo = useMemo(
    () => produtos.filter(p => Number(stockAtual[p.nome] || 0) < Number(p.minimo || 0)),
    [produtos, stockAtual]
  );

  async function registarEntrada(event) {
    event.preventDefault();
    const quantidade = toNumber(entrada.quantidade);
    const produto = produtos.find(p => p.nome === entrada.produto);
    if (!produto || !Number.isFinite(quantidade) || quantidade <= 0) {
      alert("Seleciona um produto e indica uma quantidade válida.");
      return;
    }

    const { error } = await supabase.from("entradas").insert([{
      produto: produto.nome,
      quantidade,
      datahora: new Date().toISOString()
    }]);

    if (error) {
      console.error(error);
      alert("Não foi possível registar a entrada.");
      return;
    }

    setEntrada({ produto: "", quantidade: "" });
    await carregarDados();
    alert("Entrada registada com sucesso.");
  }

  async function registarSaida(event) {
    event.preventDefault();
    const quantidade = toNumber(saida.quantidade);
    const produto = produtos.find(p => p.nome === saida.produto);
    if (!produto || !Number.isFinite(quantidade) || quantidade <= 0 || !saida.responsavel.trim()) {
      alert("Preenche o produto, a quantidade e o responsável.");
      return;
    }

    const { error } = await supabase.from("saidas").insert([{
      produto: produto.nome,
      quantidade,
      unidade: produto.unidade,
      setor: "Cozinha",
      dataHora: new Date().toISOString(),
      responsavel: saida.responsavel.trim()
    }]);

    if (error) {
      console.error(error);
      alert("Não foi possível registar a saída.");
      return;
    }

    setSaida({ produto: "", quantidade: "", responsavel: "" });
    await carregarDados();
    alert("Saída registada com sucesso.");
  }

  async function guardarInventario(event) {
    event.preventDefault();
    const dataAtualizacao = new Date().toISOString();
    const linhas = Object.entries(contagens)
      .filter(([, valor]) => String(valor).trim() !== "")
      .map(([produto, valor]) => ({ produto, quantidade: toNumber(valor), updated_at: dataAtualizacao }))
      .filter(item => Number.isFinite(item.quantidade) && item.quantidade >= 0);

    if (!linhas.length) {
      alert("Introduz pelo menos uma contagem válida.");
      return;
    }

    const { error } = await supabase.from("inventario_real").upsert(linhas);
    if (error) {
      console.error(error);
      alert("Não foi possível guardar o inventário.");
      return;
    }

    setContagens({});
    await carregarDados();
    alert("Inventário atualizado com sucesso.");
  }

  const tabs = [
    ["stock", "📦 Stock"],
    ["entrada", "➕ Entrada"],
    ["saida", "➖ Saída"],
    ["inventario", "📝 Inventário"]
  ];

  return (
    <div style={styles.app}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>👨‍🍳 Chef de Cozinha</h1>
            <p style={styles.subtitle}>Controlo operacional da cozinha</p>
          </div>
          <button type="button" style={styles.logout} onClick={onLogout}>Sair</button>
        </header>

        <nav style={styles.tabs} aria-label="Áreas do perfil Chef de Cozinha">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              style={{ ...styles.tab, ...(area === id ? styles.activeTab : {}) }}
              onClick={() => {
                setArea(id);
                setPesquisa("");
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        {erro && <div style={{ ...styles.card, ...styles.error }}>{erro}</div>}
        {aCarregar && <div style={styles.card}>A carregar…</div>}

        {!aCarregar && !erro && area === "stock" && (
          <>
            <div style={styles.summary}>
              <div style={styles.summaryCard}>
                <strong>{produtos.length}</strong>
                <div>Produtos controlados</div>
              </div>
              <div style={{ ...styles.summaryCard, ...(abaixoDoMinimo.length ? styles.warningRow : {}) }}>
                <strong>{abaixoDoMinimo.length}</strong>
                <div>Produtos abaixo do mínimo</div>
              </div>
            </div>

            <section style={styles.card}>
              <input
                style={styles.input}
                value={pesquisa}
                onChange={e => setPesquisa(e.target.value)}
                placeholder="Pesquisar produto…"
              />
              <div style={{ ...styles.tableWrap, marginTop: 10 }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Produto</th>
                      <th style={styles.th}>Unidade</th>
                      <th style={{ ...styles.th, textAlign: "right" }}>Stock atual</th>
                      <th style={{ ...styles.th, textAlign: "right" }}>Mínimo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtosFiltrados.map(produto => {
                      const atual = Number(stockAtual[produto.nome] || 0);
                      const minimo = Number(produto.minimo || 0);
                      return (
                        <tr key={produto.id || produto.nome} style={atual < minimo ? styles.warningRow : undefined}>
                          <td style={styles.td}>{produto.nome}</td>
                          <td style={styles.td}>{produto.unidade}</td>
                          <td style={styles.tdRight}>{formatNumber(atual)}</td>
                          <td style={styles.tdRight}>{formatNumber(minimo)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {!aCarregar && !erro && area === "entrada" && (
          <section style={styles.card}>
            <h2 style={{ marginTop: 0 }}>Registar entrada de stock</h2>
            <form style={styles.form} onSubmit={registarEntrada}>
              <input
                style={styles.input}
                list="chef-produtos-entrada"
                placeholder="Pesquisar produto…"
                value={entrada.produto}
                onChange={e => setEntrada({ ...entrada, produto: e.target.value })}
                required
              />
              <datalist id="chef-produtos-entrada">
                {produtos.map(p => <option key={p.id || p.nome} value={p.nome}>{p.unidade}</option>)}
              </datalist>
              <input style={styles.input} type="number" step="0.001" min="0.001" placeholder="Quantidade" value={entrada.quantidade} onChange={e => setEntrada({ ...entrada, quantidade: e.target.value })} required />
              <button style={styles.button}>Registar entrada</button>
            </form>
          </section>
        )}

        {!aCarregar && !erro && area === "saida" && (
          <section style={styles.card}>
            <h2 style={{ marginTop: 0 }}>Registar saída de stock</h2>
            <form style={styles.form} onSubmit={registarSaida}>
              <input
                style={styles.input}
                list="chef-produtos-saida"
                placeholder="Pesquisar produto…"
                value={saida.produto}
                onChange={e => setSaida({ ...saida, produto: e.target.value })}
                required
              />
              <datalist id="chef-produtos-saida">
                {produtos.map(p => <option key={p.id || p.nome} value={p.nome}>{p.unidade}</option>)}
              </datalist>
              <input style={styles.input} type="number" step="0.001" min="0.001" placeholder="Quantidade" value={saida.quantidade} onChange={e => setSaida({ ...saida, quantidade: e.target.value })} required />
              <input style={styles.input} placeholder="Responsável" value={saida.responsavel} onChange={e => setSaida({ ...saida, responsavel: e.target.value })} required />
              <button style={styles.button}>Registar saída</button>
            </form>
          </section>
        )}

        {!aCarregar && !erro && area === "inventario" && (
          <section style={styles.card}>
            <h2 style={{ marginTop: 0 }}>Atualizar inventário real</h2>
            <p style={styles.subtitle}>Preenche apenas os produtos que foram contados.</p>
            <input style={{ ...styles.input, marginTop: 12 }} value={pesquisa} onChange={e => setPesquisa(e.target.value)} placeholder="Pesquisar produto…" />
            <form onSubmit={guardarInventario}>
              <div style={{ ...styles.tableWrap, marginTop: 10 }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Produto</th>
                      <th style={styles.th}>Unidade</th>
                      <th style={{ ...styles.th, textAlign: "right" }}>Stock atual</th>
                      <th style={styles.th}>Contagem real</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtosFiltrados.map(produto => (
                      <tr key={produto.id || produto.nome}>
                        <td style={styles.td}>{produto.nome}</td>
                        <td style={styles.td}>{produto.unidade}</td>
                        <td style={styles.tdRight}>{formatNumber(stockAtual[produto.nome] || 0)}</td>
                        <td style={styles.td}>
                          <input
                            style={{ ...styles.input, minWidth: 120 }}
                            type="number"
                            step="0.001"
                            min="0"
                            placeholder="Quantidade"
                            value={contagens[produto.nome] ?? ""}
                            onChange={e => setContagens({ ...contagens, [produto.nome]: e.target.value })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button style={{ ...styles.button, marginTop: 12 }} type="submit">Guardar inventário preenchido</button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
