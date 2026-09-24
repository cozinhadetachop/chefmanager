import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import SaidasRapidas from "./SaidasRapidas";

const cores = {
  verde: "#536b45",
  verdeEscuro: "#34452d",
  creme: "#f7f5ef",
  borda: "#d9ddd4",
  vermelho: "#b42318",
  vermelhoSuave: "#fff1f0",
  amareloSuave: "#fff8e1",
  cinzento: "#667064"
};

const estilos = {
  app: { minHeight: "100vh", padding: "18px 18px 34px", boxSizing: "border-box", fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: "#1f2a1d", background: "transparent" },
  shell: { maxWidth: 1040, margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, marginBottom: 20 },
  titulo: { margin: 0, fontSize: 26, letterSpacing: "-0.025em", color: "#24331f" },
  subtitulo: { margin: "4px 0 0", color: cores.cinzento, fontSize: 14 },
  grelha: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 },
  acao: { minHeight: 118, padding: 18, border: "1px solid #dfe5da", borderRadius: 18, background: "rgba(255,255,255,.94)", cursor: "pointer", textAlign: "left", fontSize: 17, fontWeight: 750, color: "#2d4028", boxShadow: "0 6px 18px rgba(49,67,42,.055)" },
  card: { padding: 18, marginBottom: 14, border: "1px solid #dfe5da", borderRadius: 18, background: "rgba(255,255,255,.94)", boxShadow: "0 6px 18px rgba(49,67,42,.055)" },
  input: { width: "100%", minHeight: 46, padding: "10px 13px", boxSizing: "border-box", border: "1px solid #dce3d7", borderRadius: 11, fontSize: 16, background: "white", color: "#1f2a1d" },
  formLinha: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, alignItems: "end" },
  botao: { minHeight: 46, padding: "10px 15px", border: "1px solid #536b45", borderRadius: 11, background: "linear-gradient(135deg, #5d774d, #49633d)", color: "white", cursor: "pointer", fontWeight: 750, boxShadow: "0 4px 10px rgba(73,99,61,.14)" },
  secundario: { minHeight: 44, padding: "9px 13px", border: "1px solid #dce3d7", borderRadius: 11, background: "white", color: "#34452d", cursor: "pointer", fontWeight: 750 },
  perigo: { color: cores.vermelho, borderColor: "#efc1bd", background: "white" },
  tabelaWrap: { overflowX: "auto" },
  tabela: { width: "100%", borderCollapse: "collapse", minWidth: 680 },
  th: { padding: "10px 8px", textAlign: "left", borderBottom: `2px solid ${cores.borda}`, fontSize: 13 },
  td: { padding: "10px 8px", borderBottom: `1px solid ${cores.borda}`, verticalAlign: "middle" },
  direita: { textAlign: "right" },
  alerta: { background: cores.vermelhoSuave },
  nota: { padding: 12, borderRadius: 10, background: cores.amareloSuave, color: "#684f00" },
  erro: { padding: 12, borderRadius: 10, background: cores.vermelhoSuave, color: cores.vermelho, fontWeight: 700 },
  etiqueta: { display: "block", marginBottom: 5, fontSize: 13, fontWeight: 700, color: cores.cinzento }
};

function numero(valor) {
  const n = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function formatarNumero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n.toLocaleString("pt-PT", { maximumFractionDigits: 3 }) : "0";
}

function formatarPreco(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n.toLocaleString("pt-PT", { style: "currency", currency: "EUR" }) : "—";
}

function idLinha() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function SeletorProduto({ produtos, value, onChange, id }) {
  const [termo, setTermo] = useState("");

  useEffect(() => {
    if (!value) setTermo("");
  }, [value]);

  const produtosFiltrados = useMemo(() => {
    const pesquisa = termo.trim().toLocaleLowerCase("pt-PT");
    if (!pesquisa) return produtos;
    return produtos.filter(produto =>
      `${produto.nome || ""} ${produto.procedencia || ""}`
        .toLocaleLowerCase("pt-PT")
        .includes(pesquisa)
    );
  }, [produtos, termo]);

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <input
        style={estilos.input}
        type="search"
        value={termo}
        onChange={event => setTermo(event.target.value)}
        placeholder="Pesquisar produto…"
        aria-label="Pesquisar produto"
      />
      <select id={id} style={estilos.input} value={value} onChange={onChange} required>
        <option value="">Selecionar produto…</option>
        {produtosFiltrados.map(produto => (
          <option key={produto.nome} value={produto.nome}>{produto.nome} ({produto.unidade})</option>
        ))}
      </select>
      {!!termo && !produtosFiltrados.length && (
        <span style={estilos.subtitulo}>Nenhum produto encontrado.</span>
      )}
    </div>
  );
}

export default function Chef({ onLogout }) {
  const [area, setArea] = useState("inicio");
  const [produtos, setProdutos] = useState([]);
  const [pesquisa, setPesquisa] = useState("");
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState("");

  const [entradaManual, setEntradaManual] = useState({ produto: "", quantidade: "" });
  const [entradas, setEntradas] = useState([]);
  const [saidaManual, setSaidaManual] = useState({ produto: "", quantidade: "" });
  const [saidas, setSaidas] = useState([]);
  const [aGuardar, setAGuardar] = useState(false);
  const [favoritos, setFavoritos] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem("chef-favoritos") || "[]"); }
    catch { return []; }
  });
  const [recentes, setRecentes] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem("chef-recentes") || "[]"); }
    catch { return []; }
  });

  const [fotografias, setFotografias] = useState([]);
  const [linhasFatura, setLinhasFatura] = useState([]);
  const [aLer, setALer] = useState(false);
  const [progresso, setProgresso] = useState(0);

  const [inventario, setInventario] = useState({});
  const [pesquisaInventario, setPesquisaInventario] = useState("");
  const [aGuardarInventario, setAGuardarInventario] = useState(false);

  useEffect(() => {
    carregarStock();
  }, []);

  async function carregarStock() {
    setACarregar(true);
    setErro("");
    const { data, error } = await supabase.rpc("chef_stock_atual");

    if (error) {
      console.error(error);
      setErro("Não foi possível carregar o stock. Tenta novamente.");
      setACarregar(false);
      return;
    }

    const lista = Array.isArray(data) ? data : [];
    setProdutos(lista.sort((a, b) => String(a.nome).localeCompare(String(b.nome))));
    setACarregar(false);
  }

  const produtosFiltrados = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase();
    return produtos.filter(produto => {
      const texto = `${produto.nome || ""} ${produto.procedencia || ""}`.toLowerCase();
      return !termo || texto.includes(termo);
    });
  }, [produtos, pesquisa]);

  const abaixoMinimo = useMemo(
    () => produtos
      .filter(p => Number(p.stock_atual || 0) < Number(p.minimo || 0))
      .sort((a, b) => Number(a.stock_atual || 0) - Number(b.stock_atual || 0)),
    [produtos]
  );

  function mudarArea(novaArea) {
    setArea(novaArea);
    setPesquisa("");
    setErro("");
  }

  function guardarFavoritos(lista) {
    setFavoritos(lista);
    window.localStorage.setItem("chef-favoritos", JSON.stringify(lista));
  }

  function alternarFavorito(nome) {
    if (!nome) return;
    guardarFavoritos(
      favoritos.includes(nome)
        ? favoritos.filter(item => item !== nome)
        : [nome, ...favoritos].slice(0, 12)
    );
  }

  function registarRecente(nome) {
    if (!nome) return;
    setRecentes(atual => {
      const lista = [nome, ...atual.filter(item => item !== nome)].slice(0, 8);
      window.localStorage.setItem("chef-recentes", JSON.stringify(lista));
      return lista;
    });
  }

  function adicionarOuSomar(setter, item) {
    setter(lista => {
      const existente = lista.find(linha => linha.produto === item.produto);
      if (!existente) return [...lista, item];
      return lista.map(linha => linha.produto === item.produto
        ? { ...linha, quantidade: Number(linha.quantidade) + Number(item.quantidade) }
        : linha
      );
    });
    registarRecente(item.produto);
  }

  function adicionarEntradaManual(event) {
    event.preventDefault();
    const produto = produtos.find(p => p.nome === entradaManual.produto);
    const quantidade = numero(entradaManual.quantidade);
    if (!produto || !Number.isFinite(quantidade) || quantidade <= 0) {
      alert("Seleciona um produto e indica uma quantidade válida.");
      return;
    }
    adicionarOuSomar(setEntradas, { id: idLinha(), produto: produto.nome, quantidade, precoFatura: "" });
    setEntradaManual({ produto: "", quantidade: "" });
  }

  function adicionarSaidaManual(event) {
    event.preventDefault();
    const produto = produtos.find(p => p.nome === saidaManual.produto);
    const quantidade = numero(saidaManual.quantidade);
    if (!produto || !Number.isFinite(quantidade) || quantidade <= 0) {
      alert("Seleciona um produto e indica uma quantidade válida.");
      return;
    }

    adicionarOuSomar(setSaidas, { id: idLinha(), produto: produto.nome, quantidade });
    setSaidaManual({ produto: "", quantidade: "" });
  }

  async function confirmarEntradas() {
    if (!entradas.length) return;
    if (!window.confirm(`Confirmar ${entradas.length} entrada(s) de stock?`)) return;
    setAGuardar(true);
    const movimentos = entradas.map(item => ({ produto: item.produto, quantidade: Number(item.quantidade) }));
    const { error } = await supabase.rpc("chef_registar_entradas", { p_movimentos: movimentos });
    setAGuardar(false);
    if (error) {
      console.error(error);
      alert("Não foi possível registar as entradas.");
      return;
    }
    setEntradas([]);
    await carregarStock();
    alert("Entradas registadas com sucesso.");
  }

  async function confirmarSaidas() {
    if (!saidas.length) return;
    if (!window.confirm(`Confirmar ${saidas.length} saída(s) de stock?`)) return;
    setAGuardar(true);
    const movimentos = saidas.map(item => ({ produto: item.produto, quantidade: Number(item.quantidade) }));
    const { error } = await supabase.rpc("chef_registar_saidas", { p_movimentos: movimentos });
    setAGuardar(false);
    if (error) {
      console.error(error);
      alert("Não foi possível registar as saídas.");
      return;
    }
    setSaidas([]);
    await carregarStock();
    alert("Saídas registadas com sucesso.");
  }

  function juntarFotografias(event) {
    const novas = Array.from(event.target.files || []).filter(file => file.type.startsWith("image/"));
    setFotografias(atuais => [...atuais, ...novas].slice(0, 10));
    event.target.value = "";
  }

  async function lerFatura() {
    if (!fotografias.length) {
      alert("Adiciona pelo menos uma fotografia.");
      return;
    }
    setALer(true);
    setProgresso(0);
    setLinhasFatura([]);
    try {
      const { lerFotografias } = await import("./invoiceOcr");
      const linhas = await lerFotografias(fotografias, produtos, setProgresso);
      setLinhasFatura(linhas);
      if (!linhas.length) alert("Não foi possível identificar linhas de produtos. Podes adicioná-los manualmente.");
    } catch (error) {
      console.error(error);
      alert("Não foi possível ler estas fotografias. Confirma se estão nítidas e tenta novamente.");
    } finally {
      setALer(false);
    }
  }

  function atualizarLinhaFatura(id, campo, valor) {
    setLinhasFatura(linhas => linhas.map(linha => linha.id === id ? { ...linha, [campo]: valor } : linha));
  }

  function validarLinhasFatura() {
    const pendentes = linhasFatura.filter(linha => !linha.ignorar && (!linha.produto || !(numero(linha.quantidade) > 0)));
    if (pendentes.length) {
      alert("Associa cada linha válida a um produto e confirma a quantidade. Remove as linhas que não interessam.");
      return;
    }
    const validas = linhasFatura.filter(linha => !linha.ignorar && linha.produto && numero(linha.quantidade) > 0);
    if (!validas.length) {
      alert("Não existem linhas válidas para adicionar.");
      return;
    }
    setEntradas(atuais => {
      const resultado = [...atuais];
      validas.forEach(linha => {
        const quantidade = numero(linha.quantidade);
        const indice = resultado.findIndex(item => item.produto === linha.produto);
        if (indice >= 0) {
          resultado[indice] = {
            ...resultado[indice],
            quantidade: Number(resultado[indice].quantidade) + quantidade
          };
        } else {
          resultado.push({
            id: idLinha(),
            produto: linha.produto,
            quantidade,
            precoFatura: ""
          });
        }
      });
      return resultado;
    });
    validas.forEach(linha => registarRecente(linha.produto));
    setLinhasFatura([]);
    setFotografias([]);
    setProgresso(0);
  }

  const produtosInventario = useMemo(() => {
    const termo = pesquisaInventario.trim().toLocaleLowerCase("pt-PT");
    const lista = produtos.slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-PT"));
    if (!termo) return lista;
    return lista.filter(p => `${p.nome || ""} ${p.procedencia || ""}`.toLocaleLowerCase("pt-PT").includes(termo));
  }, [produtos, pesquisaInventario]);

  function preencherInventarioVaziosComZero() {
    const proximo = { ...inventario };
    produtos.forEach(p => {
      if (proximo[p.nome] === "" || proximo[p.nome] === undefined || proximo[p.nome] === null) {
        proximo[p.nome] = "0";
      }
    });
    setInventario(proximo);
  }

  async function gravarInventarioChef() {
    const linhas = produtos.map(p => {
      const raw = inventario[p.nome];
      const quantidade = numero(raw);
      if (raw === "" || raw === undefined || raw === null || !Number.isFinite(quantidade) || quantidade < 0) return null;
      return { produto: p.nome, quantidade };
    }).filter(Boolean);

    if (!linhas.length || linhas.length !== produtos.length) {
      alert("Preenche a contagem de todos os produtos antes de gravar o inventário.");
      return;
    }

    if (!window.confirm(`Confirmar inventário físico de ${linhas.length} produto(s)?`)) return;

    setAGuardarInventario(true);
    const { error } = await supabase.rpc("chef_gravar_inventario", { p_itens: linhas });
    setAGuardarInventario(false);

    if (error) {
      console.error(error);
      alert("Não foi possível gravar o inventário.");
      return;
    }

    setInventario({});
    setPesquisaInventario("");
    await carregarStock();
    alert("Inventário gravado com sucesso.");
  }

  function CabecalhoArea({ titulo }) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button type="button" style={estilos.secundario} onClick={() => mudarArea("inicio")}>← Início</button>
        <h2 style={{ margin: 0 }}>{titulo}</h2>
      </div>
    );
  }

  function ListaProvisoria({ tipo, linhas, remover, confirmar }) {
    if (!linhas.length) return <p style={estilos.subtitulo}>Ainda não foram adicionados produtos.</p>;
    return (
      <>
        <div style={estilos.tabelaWrap}>
          <table style={estilos.tabela}>
            <thead><tr><th style={estilos.th}>Produto</th><th style={{ ...estilos.th, ...estilos.direita }}>Quantidade</th><th style={estilos.th}>Remover</th></tr></thead>
            <tbody>
              {linhas.map(linha => {
                const produto = produtos.find(p => p.nome === linha.produto);
                return (
                  <tr key={linha.id}>
                    <td style={estilos.td}>{linha.produto}<div style={estilos.subtitulo}>{produto?.unidade}</div></td>
                    <td style={{ ...estilos.td, ...estilos.direita }}>{formatarNumero(linha.quantidade)}</td>
                    <td style={estilos.td}><button type="button" style={{ ...estilos.secundario, ...estilos.perigo }} onClick={() => remover(linha.id)}>Retirar</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button type="button" style={{ ...estilos.botao, width: "100%", marginTop: 12 }} disabled={aGuardar} onClick={confirmar}>
          {aGuardar ? "A guardar…" : `Confirmar ${tipo === "entrada" ? "entradas" : "saídas"}`}
        </button>
      </>
    );
  }

  function AtalhosProdutos({ selecionar }) {
    if (!favoritos.length && !recentes.length) return null;
    return (
      <div style={{ marginBottom: 12 }}>
        {!!favoritos.length && (
          <>
            <div style={{ ...estilos.etiqueta, marginBottom: 6 }}>⭐ Favoritos</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: recentes.length ? 10 : 0 }}>
              {favoritos.map(nome => (
                <button key={nome} type="button" style={estilos.secundario} onClick={() => selecionar(nome)}>
                  {nome}
                </button>
              ))}
            </div>
          </>
        )}
        {!!recentes.length && (
          <>
            <div style={{ ...estilos.etiqueta, marginBottom: 6 }}>🕘 Recentes</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {recentes.map(nome => (
                <button key={nome} type="button" style={estilos.secundario} onClick={() => selecionar(nome)}>
                  {nome}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={estilos.app}>
      <div style={estilos.shell}>
        <header style={estilos.header}>
          <div>
            <img src="/logo-cozinha-de-tacho.webp" alt="Cozinha de Tacho" style={{ display: "block", width: 220, maxWidth: "70vw", height: "auto", marginBottom: 8 }} />
            <h1 style={estilos.titulo}>👨‍🍳 Chef Cozinha</h1>
            <p style={estilos.subtitulo}>Controlo operacional do Cozinha de Tacho</p>
          </div>
          <button type="button" style={estilos.secundario} onClick={onLogout}>Sair</button>
        </header>

        {erro && <div style={{ ...estilos.card, ...estilos.erro }}>{erro} <button type="button" style={estilos.secundario} onClick={carregarStock}>Tentar novamente</button></div>}
        {aCarregar && <div style={estilos.card}>A carregar stock…</div>}

        {!aCarregar && !erro && area === "inicio" && (
          <>
            <div style={estilos.grelha}>
              <button type="button" style={estilos.acao} onClick={() => mudarArea("stock")}><span style={{ fontSize: 28 }}>📦</span><br />Consultar stock</button>
              <button type="button" style={estilos.acao} onClick={() => mudarArea("entrada")}><span style={{ fontSize: 28 }}>➕</span><br />Registar entrada</button>
              <button type="button" style={estilos.acao} onClick={() => mudarArea("saida")}><span style={{ fontSize: 28 }}>➖</span><br />Registar saída</button>
              <button type="button" style={estilos.acao} onClick={() => mudarArea("inventario")}><span style={{ fontSize: 28 }}>🧾</span><br />Fazer inventário</button>
            </div>
            <section style={{ ...estilos.card, marginTop: 14, ...(abaixoMinimo.length ? estilos.alerta : {}) }}>
              <h2 style={{ marginTop: 0 }}>Stock abaixo do mínimo</h2>
              {!abaixoMinimo.length && <p style={{ marginBottom: 0 }}>Não existem alertas neste momento.</p>}
              {abaixoMinimo.slice(0, 8).map(produto => (
                <div key={produto.nome} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: `1px solid ${cores.borda}` }}>
                  <span>{produto.nome}</span><strong>{formatarNumero(produto.stock_atual)} {produto.unidade}</strong>
                </div>
              ))}
              {abaixoMinimo.length > 8 && <button type="button" style={{ ...estilos.secundario, marginTop: 10 }} onClick={() => mudarArea("stock")}>Ver todos os alertas</button>}
            </section>
          </>
        )}

        {!aCarregar && !erro && area === "stock" && (
          <>
            <CabecalhoArea titulo="Consultar stock" />
            <section style={estilos.card}>
              <input style={estilos.input} value={pesquisa} onChange={e => setPesquisa(e.target.value)} placeholder="Pesquisar produto ou fornecedor…" />
              <div style={{ ...estilos.tabelaWrap, marginTop: 10 }}>
                <table style={estilos.tabela}>
                  <thead><tr><th style={estilos.th}>Produto</th><th style={estilos.th}>Fornecedor</th><th style={estilos.th}>Unidade</th><th style={{ ...estilos.th, ...estilos.direita }}>Stock atual</th><th style={{ ...estilos.th, ...estilos.direita }}>Mínimo</th></tr></thead>
                  <tbody>
                    {produtosFiltrados.map(produto => {
                      const alerta = Number(produto.stock_atual || 0) < Number(produto.minimo || 0);
                      return <tr key={produto.nome} style={alerta ? estilos.alerta : undefined}><td style={estilos.td}><strong>{produto.nome}</strong></td><td style={estilos.td}>{produto.procedencia || "—"}</td><td style={estilos.td}>{produto.unidade}</td><td style={{ ...estilos.td, ...estilos.direita }}>{formatarNumero(produto.stock_atual)}</td><td style={{ ...estilos.td, ...estilos.direita }}>{formatarNumero(produto.minimo)}</td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {!aCarregar && !erro && area === "inventario" && (
          <>
            <CabecalhoArea titulo="Fazer inventário" />
            <section style={estilos.card}>
              <div style={estilos.nota}>
                Inventário físico: conta o que existe realmente. Nesta área não são apresentados preços, valores totais nem o stock atual.
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
                <input
                  style={{ ...estilos.input, flex: "1 1 260px" }}
                  type="search"
                  value={pesquisaInventario}
                  onChange={e => setPesquisaInventario(e.target.value)}
                  placeholder="Pesquisar produto…"
                />
                <button type="button" style={estilos.secundario} onClick={preencherInventarioVaziosComZero}>
                  Preencher vazios com 0
                </button>
              </div>

              <div style={estilos.tabelaWrap}>
                <table style={estilos.tabela}>
                  <thead>
                    <tr>
                      <th style={estilos.th}>Produto</th>
                      <th style={estilos.th}>Unidade</th>
                      <th style={{ ...estilos.th, ...estilos.direita }}>Contagem física</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtosInventario.map(produto => (
                      <tr key={produto.nome}>
                        <td style={estilos.td}><strong>{produto.nome}</strong></td>
                        <td style={estilos.td}>{produto.unidade}</td>
                        <td style={{ ...estilos.td, ...estilos.direita }}>
                          <input
                            style={{ ...estilos.input, width: 130, textAlign: "right" }}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.001"
                            value={inventario[produto.nome] ?? ""}
                            onChange={e => setInventario(atual => ({ ...atual, [produto.nome]: e.target.value }))}
                            placeholder="0"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                style={{ ...estilos.botao, width: "100%", marginTop: 14 }}
                disabled={aGuardarInventario}
                onClick={gravarInventarioChef}
              >
                {aGuardarInventario ? "A gravar…" : "Confirmar inventário"}
              </button>
            </section>
          </>
        )}

        {!aCarregar && !erro && area === "entrada" && (
          <>
            <CabecalhoArea titulo="Registar entrada" />
            <section style={estilos.card}>
              <h3 style={{ marginTop: 0 }}>Adicionar manualmente</h3>
              <AtalhosProdutos selecionar={nome => setEntradaManual(atual => ({ ...atual, produto: nome }))} />
              <form style={estilos.formLinha} onSubmit={adicionarEntradaManual}>
                <label><span style={estilos.etiqueta}>Produto</span><SeletorProduto produtos={produtos} id="entrada-produto" value={entradaManual.produto} onChange={e => setEntradaManual({ ...entradaManual, produto: e.target.value })} /></label>
                <label><span style={estilos.etiqueta}>Quantidade</span><input style={estilos.input} type="number" inputMode="decimal" min="0.001" step="0.001" value={entradaManual.quantidade} onChange={e => setEntradaManual({ ...entradaManual, quantidade: e.target.value })} required /></label>
                <button
                  type="button"
                  style={estilos.secundario}
                  disabled={!entradaManual.produto}
                  onClick={() => alternarFavorito(entradaManual.produto)}
                >
                  {favoritos.includes(entradaManual.produto) ? "⭐ Favorito" : "☆ Favorito"}
                </button>
                <button style={estilos.botao}>Adicionar</button>
              </form>
            </section>

            <section style={estilos.card}>
              <h3 style={{ marginTop: 0 }}>Adicionar através de fotografias da fatura</h3>
              <p style={estilos.subtitulo}>Podes adicionar várias fotografias. Serão usadas apenas para a leitura e não ficam guardadas.</p>
              <input type="file" accept="image/*" capture="environment" multiple onChange={juntarFotografias} />
              {fotografias.map((foto, indice) => <div key={`${foto.name}-${indice}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 0" }}><span>Fotografia {indice + 1}: {foto.name}</span><button type="button" style={{ ...estilos.secundario, ...estilos.perigo }} onClick={() => setFotografias(lista => lista.filter((_, i) => i !== indice))}>Retirar</button></div>)}
              {!!fotografias.length && <button type="button" style={{ ...estilos.botao, marginTop: 10 }} disabled={aLer} onClick={lerFatura}>{aLer ? `A ler… ${Math.round(progresso * 100)}%` : `Ler ${fotografias.length} fotografia(s)`}</button>}
              {aLer && <progress style={{ width: "100%", marginTop: 10 }} max="1" value={progresso} />}
            </section>

            {!!linhasFatura.length && (
              <section style={estilos.card}>
                <h3 style={{ marginTop: 0 }}>Validar leitura da fatura</h3>
                <div style={estilos.nota}>Compara todas as linhas com a fatura antes de confirmar. Confirma produto, quantidade e unidade do stock; embalagens podem exigir conversão (por exemplo, 3 garrafas de 5 L = 15 L). Se faltar algum artigo, adiciona-o manualmente. O preço é só para comparação e não será guardado.</div>
                {linhasFatura.map(linha => {
                  const produto = produtos.find(p => p.nome === linha.produto);
                  return (
                    <div key={linha.id} style={{ padding: "14px 0", borderBottom: `1px solid ${cores.borda}`, opacity: linha.ignorar ? 0.55 : 1 }}>
                      <div style={{ fontSize: 13, color: cores.cinzento, marginBottom: 8 }}>Foto {linha.foto}: {linha.descricao}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, alignItems: "end" }}>
                        <label><span style={estilos.etiqueta}>Produto existente</span><SeletorProduto produtos={produtos} value={linha.produto} onChange={e => atualizarLinhaFatura(linha.id, "produto", e.target.value)} /></label>
                        <label><span style={estilos.etiqueta}>Quantidade</span><input style={estilos.input} type="number" inputMode="decimal" min="0.001" step="0.001" value={linha.quantidade} onChange={e => atualizarLinhaFatura(linha.id, "quantidade", e.target.value)} /></label>
                        <button type="button" style={{ ...estilos.secundario, ...estilos.perigo }} onClick={() => setLinhasFatura(lista => lista.filter(item => item.id !== linha.id))}>Remover</button>
                      </div>
                    </div>
                  );
                })}
                <button type="button" style={{ ...estilos.botao, width: "100%", marginTop: 12 }} onClick={validarLinhasFatura}>Validar e adicionar à lista provisória</button>
              </section>
            )}

            <section style={estilos.card}><h3 style={{ marginTop: 0 }}>Lista provisória</h3><ListaProvisoria tipo="entrada" linhas={entradas} remover={id => setEntradas(lista => lista.filter(item => item.id !== id))} confirmar={confirmarEntradas} /></section>
          </>
        )}

        {!aCarregar && !erro && area === "saida" && (
          <>
            <CabecalhoArea titulo="Registar saída" />
            <SaidasRapidas
              produtos={produtos}
              storageKey="chef-saidas"
              titulo="➖ Saídas de stock"
              onConfirmar={async movimentos => {
                const { error } = await supabase.rpc("chef_registar_saidas", {
                  p_movimentos: movimentos.map(({ produto, quantidade }) => ({ produto, quantidade }))
                });

                if (error) {
                  console.error(error);
                  alert("Não foi possível registar as saídas.");
                  return false;
                }

                await carregarStock();
                alert("Saídas registadas com sucesso.");
                return true;
              }}
            />
          </>
        )}

      </div>
    </div>
  );
}
