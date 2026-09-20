import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

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
  app: { minHeight: "100vh", padding: 16, boxSizing: "border-box", fontFamily: "Arial, sans-serif", color: "#252b23", background: cores.creme },
  shell: { maxWidth: 980, margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 },
  titulo: { margin: 0, fontSize: 24 },
  subtitulo: { margin: "4px 0 0", color: cores.cinzento, fontSize: 14 },
  grelha: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 },
  acao: { minHeight: 115, padding: 16, border: `1px solid ${cores.borda}`, borderRadius: 14, background: "white", cursor: "pointer", textAlign: "left", fontSize: 17, fontWeight: 700 },
  card: { padding: 16, marginBottom: 12, border: `1px solid ${cores.borda}`, borderRadius: 14, background: "white" },
  input: { width: "100%", minHeight: 46, padding: "10px 12px", boxSizing: "border-box", border: `1px solid ${cores.borda}`, borderRadius: 9, fontSize: 16, background: "white" },
  formLinha: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, alignItems: "end" },
  botao: { minHeight: 46, padding: "10px 14px", border: 0, borderRadius: 9, background: cores.verde, color: "white", cursor: "pointer", fontWeight: 700 },
  secundario: { minHeight: 42, padding: "8px 12px", border: `1px solid ${cores.borda}`, borderRadius: 9, background: "white", cursor: "pointer", fontWeight: 700 },
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

  const [fotografias, setFotografias] = useState([]);
  const [linhasFatura, setLinhasFatura] = useState([]);
  const [aLer, setALer] = useState(false);
  const [progresso, setProgresso] = useState(0);

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

  function adicionarEntradaManual(event) {
    event.preventDefault();
    const produto = produtos.find(p => p.nome === entradaManual.produto);
    const quantidade = numero(entradaManual.quantidade);
    if (!produto || !Number.isFinite(quantidade) || quantidade <= 0) {
      alert("Seleciona um produto e indica uma quantidade válida.");
      return;
    }
    setEntradas(lista => [...lista, { id: idLinha(), produto: produto.nome, quantidade, precoFatura: "" }]);
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

    const jaAdicionado = saidas
      .filter(item => item.produto === produto.nome)
      .reduce((total, item) => total + Number(item.quantidade), 0);
    if (jaAdicionado + quantidade > Number(produto.stock_atual || 0)) {
      alert("Quantidade superior ao stock disponível. Informe o gerente.");
      return;
    }

    setSaidas(lista => [...lista, { id: idLinha(), produto: produto.nome, quantidade }]);
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
    const ultrapassaStock = saidas.some(item => {
      const produto = produtos.find(p => p.nome === item.produto);
      const total = saidas.filter(s => s.produto === item.produto).reduce((soma, s) => soma + Number(s.quantidade), 0);
      return !produto || total > Number(produto.stock_atual || 0);
    });
    if (ultrapassaStock) {
      alert("Quantidade superior ao stock disponível. Informe o gerente.");
      return;
    }
    if (!window.confirm(`Confirmar ${saidas.length} saída(s) de stock?`)) return;
    setAGuardar(true);
    const movimentos = saidas.map(item => ({ produto: item.produto, quantidade: Number(item.quantidade) }));
    const { error } = await supabase.rpc("chef_registar_saidas", { p_movimentos: movimentos });
    setAGuardar(false);
    if (error) {
      console.error(error);
      alert(error.message?.includes("STOCK_INSUFICIENTE")
        ? "Quantidade superior ao stock disponível. Informe o gerente."
        : "Não foi possível registar as saídas.");
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
    setEntradas(atuais => [
      ...atuais,
      ...validas.map(linha => ({
        id: idLinha(),
        produto: linha.produto,
        quantidade: numero(linha.quantidade),
        precoFatura: numero(linha.precoFatura) > 0 ? numero(linha.precoFatura) : ""
      }))
    ]);
    setLinhasFatura([]);
    setFotografias([]);
    setProgresso(0);
  }

  function CabecalhoArea({ titulo }) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button type="button" style={estilos.secundario} onClick={() => mudarArea("inicio")}>← Início</button>
        <h2 style={{ margin: 0 }}>{titulo}</h2>
      </div>
    );
  }

  function SeletorProduto({ value, onChange, id }) {
    return (
      <select id={id} style={estilos.input} value={value} onChange={onChange} required>
        <option value="">Selecionar produto…</option>
        {produtos.map(produto => (
          <option key={produto.nome} value={produto.nome}>{produto.nome} ({produto.unidade})</option>
        ))}
      </select>
    );
  }

  function ListaProvisoria({ tipo, linhas, remover, confirmar }) {
    if (!linhas.length) return <p style={estilos.subtitulo}>Ainda não foram adicionados produtos.</p>;
    return (
      <>
        <div style={estilos.tabelaWrap}>
          <table style={estilos.tabela}>
            <thead><tr><th style={estilos.th}>Produto</th><th style={{ ...estilos.th, ...estilos.direita }}>Quantidade</th>{tipo === "entrada" && <th style={{ ...estilos.th, ...estilos.direita }}>Preço da fatura</th>}<th style={estilos.th}>Remover</th></tr></thead>
            <tbody>
              {linhas.map(linha => {
                const produto = produtos.find(p => p.nome === linha.produto);
                return (
                  <tr key={linha.id}>
                    <td style={estilos.td}>{linha.produto}<div style={estilos.subtitulo}>{produto?.unidade}</div></td>
                    <td style={{ ...estilos.td, ...estilos.direita }}>{formatarNumero(linha.quantidade)}</td>
                    {tipo === "entrada" && <td style={{ ...estilos.td, ...estilos.direita }}>{linha.precoFatura === "" ? "—" : formatarPreco(linha.precoFatura)}</td>}
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

  return (
    <div style={estilos.app}>
      <div style={estilos.shell}>
        <header style={estilos.header}>
          <div><h1 style={estilos.titulo}>👨‍🍳 Chef Cozinha</h1><p style={estilos.subtitulo}>Controlo operacional do Cozinha de Tacho</p></div>
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
                  <thead><tr><th style={estilos.th}>Produto</th><th style={estilos.th}>Fornecedor</th><th style={estilos.th}>Unidade</th><th style={{ ...estilos.th, ...estilos.direita }}>Stock atual</th><th style={{ ...estilos.th, ...estilos.direita }}>Mínimo</th><th style={{ ...estilos.th, ...estilos.direita }}>Preço unitário</th></tr></thead>
                  <tbody>
                    {produtosFiltrados.map(produto => {
                      const alerta = Number(produto.stock_atual || 0) < Number(produto.minimo || 0);
                      return <tr key={produto.nome} style={alerta ? estilos.alerta : undefined}><td style={estilos.td}><strong>{produto.nome}</strong></td><td style={estilos.td}>{produto.procedencia || "—"}</td><td style={estilos.td}>{produto.unidade}</td><td style={{ ...estilos.td, ...estilos.direita }}>{formatarNumero(produto.stock_atual)}</td><td style={{ ...estilos.td, ...estilos.direita }}>{formatarNumero(produto.minimo)}</td><td style={{ ...estilos.td, ...estilos.direita }}>{formatarPreco(produto.preco_unit)}</td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {!aCarregar && !erro && area === "entrada" && (
          <>
            <CabecalhoArea titulo="Registar entrada" />
            <section style={estilos.card}>
              <h3 style={{ marginTop: 0 }}>Adicionar manualmente</h3>
              <form style={estilos.formLinha} onSubmit={adicionarEntradaManual}>
                <label><span style={estilos.etiqueta}>Produto</span><SeletorProduto id="entrada-produto" value={entradaManual.produto} onChange={e => setEntradaManual({ ...entradaManual, produto: e.target.value })} /></label>
                <label><span style={estilos.etiqueta}>Quantidade</span><input style={estilos.input} type="number" inputMode="decimal" min="0.001" step="0.001" value={entradaManual.quantidade} onChange={e => setEntradaManual({ ...entradaManual, quantidade: e.target.value })} required /></label>
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
                <div style={estilos.nota}>Confirma obrigatoriamente o produto, a quantidade e o preço lido. O preço serve apenas para comparação e não será guardado.</div>
                {linhasFatura.map(linha => {
                  const produto = produtos.find(p => p.nome === linha.produto);
                  return (
                    <div key={linha.id} style={{ padding: "14px 0", borderBottom: `1px solid ${cores.borda}`, opacity: linha.ignorar ? 0.55 : 1 }}>
                      <div style={{ fontSize: 13, color: cores.cinzento, marginBottom: 8 }}>Foto {linha.foto}: {linha.descricao}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, alignItems: "end" }}>
                        <label><span style={estilos.etiqueta}>Produto existente</span><SeletorProduto value={linha.produto} onChange={e => atualizarLinhaFatura(linha.id, "produto", e.target.value)} /></label>
                        <label><span style={estilos.etiqueta}>Quantidade</span><input style={estilos.input} type="number" inputMode="decimal" min="0.001" step="0.001" value={linha.quantidade} onChange={e => atualizarLinhaFatura(linha.id, "quantidade", e.target.value)} /></label>
                        <label><span style={estilos.etiqueta}>Preço da fatura</span><input style={estilos.input} type="number" inputMode="decimal" min="0" step="0.001" value={linha.precoFatura} onChange={e => atualizarLinhaFatura(linha.id, "precoFatura", e.target.value)} /></label>
                        <button type="button" style={{ ...estilos.secundario, ...estilos.perigo }} onClick={() => setLinhasFatura(lista => lista.filter(item => item.id !== linha.id))}>Remover</button>
                      </div>
                      {produto && <div style={{ marginTop: 7, fontSize: 14 }}>Preço atual: <strong>{formatarPreco(produto.preco_unit)}</strong>{numero(linha.precoFatura) > 0 && <> · Diferença: <strong>{formatarPreco(numero(linha.precoFatura) - Number(produto.preco_unit || 0))}</strong></>}</div>}
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
            <section style={estilos.card}>
              <form style={estilos.formLinha} onSubmit={adicionarSaidaManual}>
                <label><span style={estilos.etiqueta}>Produto</span><SeletorProduto id="saida-produto" value={saidaManual.produto} onChange={e => setSaidaManual({ ...saidaManual, produto: e.target.value })} /></label>
                <label><span style={estilos.etiqueta}>Quantidade</span><input style={estilos.input} type="number" inputMode="decimal" min="0.001" step="0.001" value={saidaManual.quantidade} onChange={e => setSaidaManual({ ...saidaManual, quantidade: e.target.value })} required /></label>
                <button style={estilos.botao}>Adicionar</button>
              </form>
              {saidaManual.produto && <p style={estilos.subtitulo}>Stock disponível: {formatarNumero(produtos.find(p => p.nome === saidaManual.produto)?.stock_atual || 0)} {produtos.find(p => p.nome === saidaManual.produto)?.unidade}</p>}
            </section>
            <section style={estilos.card}><h3 style={{ marginTop: 0 }}>Lista provisória</h3><ListaProvisoria tipo="saida" linhas={saidas} remover={id => setSaidas(lista => lista.filter(item => item.id !== id))} confirmar={confirmarSaidas} /></section>
          </>
        )}
      </div>
    </div>
  );
}
