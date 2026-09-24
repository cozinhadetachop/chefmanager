import { useMemo, useRef, useState } from "react";
import { interpretarDitadoSaidas, interpretarTextoSaidas, lerFotografiasSaidas } from "./invoiceOcr";

const ui = {
  card: { border: "1px solid #dfe5da", borderRadius: 18, padding: 18, marginBottom: 14, background: "rgba(255,255,255,.94)", boxShadow: "0 6px 18px rgba(49,67,42,.055)" },
  input: { minHeight: 46, maxWidth: "100%", padding: "10px 13px", margin: "2px 0", border: "1px solid #dce3d7", borderRadius: 11, background: "white", color: "#1f2a1d", fontSize: 16, boxSizing: "border-box" },
  button: { minHeight: 46, padding: "10px 15px", border: "1px solid #536b45", borderRadius: 11, background: "linear-gradient(135deg, #5d774d, #49633d)", color: "white", fontSize: 15, fontWeight: 750, cursor: "pointer" },
  secondary: { background: "white", color: "#34452d", borderColor: "#dce3d7", boxShadow: "none" },
  danger: { background: "#b42318", borderColor: "#b42318", color: "white" },
  muted: { color: "#687563", fontSize: 14, lineHeight: 1.5 }
};

function idLinha() {
  return Date.now() + "-" + Math.random().toString(36).slice(2);
}

export default function SaidasRapidas({ produtos, storageKey, onConfirmar, titulo = "Registar saídas" }) {
  const [listaManual, setListaManual] = useState("");
  const [fotografias, setFotografias] = useState([]);
  const [linhasReconhecidas, setLinhasReconhecidas] = useState([]);
  const [provisorias, setProvisorias] = useState([]);
  const [aLer, setALer] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [aOuvir, setAOuvir] = useState(false);
  const [mostrarProdutos, setMostrarProdutos] = useState(false);
  const [pesquisa, setPesquisa] = useState("");
  const [quantidadeManual, setQuantidadeManual] = useState("");
  const [produtoManual, setProdutoManual] = useState("");
  const [aGuardar, setAGuardar] = useState(false);

  const [favoritos, setFavoritos] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem(storageKey + "-favoritos") || "[]"); }
    catch { return []; }
  });
  const [recentes, setRecentes] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem(storageKey + "-recentes") || "[]"); }
    catch { return []; }
  });

  const reconhecimento = useRef(null);
  const ditadoAtivo = useRef(false);
  const textoFinal = useRef("");
  const textoParcial = useRef("");

  const produtosFiltrados = useMemo(() => {
    const termo = pesquisa.trim().toLocaleLowerCase("pt-PT");
    const lista = produtos.slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-PT"));
    if (!termo) return lista;
    return lista.filter(p => String(p.nome || "").toLocaleLowerCase("pt-PT").includes(termo));
  }, [produtos, pesquisa]);

  function guardarFavoritos(lista) {
    setFavoritos(lista);
    window.localStorage.setItem(storageKey + "-favoritos", JSON.stringify(lista));
  }

  function alternarFavorito(nome) {
    guardarFavoritos(
      favoritos.includes(nome)
        ? favoritos.filter(item => item !== nome)
        : [nome, ...favoritos].slice(0, 12)
    );
  }

  function registarRecente(nome) {
    setRecentes(atual => {
      const lista = [nome, ...atual.filter(item => item !== nome)].slice(0, 8);
      window.localStorage.setItem(storageKey + "-recentes", JSON.stringify(lista));
      return lista;
    });
  }

  function adicionarProvisoria(item) {
    setProvisorias(atual => {
      const indice = atual.findIndex(linha => linha.produto === item.produto);
      if (indice < 0) return [...atual, { ...item, id: idLinha() }];
      return atual.map((linha, i) => i === indice
        ? { ...linha, quantidade: Number(linha.quantidade) + Number(item.quantidade) }
        : linha
      );
    });
    registarRecente(item.produto);
  }

  function adicionarVarias(itens) {
    setProvisorias(atual => {
      const resultado = [...atual];
      itens.forEach(item => {
        const indice = resultado.findIndex(linha => linha.produto === item.produto);
        if (indice >= 0) {
          resultado[indice] = { ...resultado[indice], quantidade: Number(resultado[indice].quantidade) + Number(item.quantidade) };
        } else {
          resultado.push({ ...item, id: idLinha() });
        }
      });
      return resultado;
    });
    itens.forEach(item => registarRecente(item.produto));
  }

  function atualizarReconhecida(id, campo, valor) {
    setLinhasReconhecidas(linhas => linhas.map(linha => linha.id === id ? { ...linha, [campo]: valor } : linha));
  }

  function reverLinhas(linhas) {
    if (!linhas.length) {
      alert("Não consegui identificar produtos e quantidades.");
      return;
    }
    setLinhasReconhecidas(linhas);
  }

  function lerLista() {
    if (!listaManual.trim()) return alert("Escreve primeiro a lista.");
    reverLinhas(interpretarTextoSaidas(listaManual, produtos, 0));
  }

  function iniciarVoz() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Este navegador não suporta ditado por voz.");

    ditadoAtivo.current = true;
    textoFinal.current = "";
    textoParcial.current = "";
    setAOuvir(true);
    setListaManual("");

    const arrancar = () => {
      if (!ditadoAtivo.current) return;
      const r = new SpeechRecognition();
      r.lang = "pt-PT";
      r.continuous = false;
      r.interimResults = true;
      reconhecimento.current = r;

      r.onresult = event => {
        const finais = [];
        let parcial = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const texto = event.results[i][0]?.transcript?.trim();
          if (!texto) continue;
          if (event.results[i].isFinal) finais.push(texto);
          else parcial = texto;
        }
        textoParcial.current = parcial;
        if (finais.length) {
          const novo = finais.join(" ");
          textoFinal.current = textoFinal.current ? textoFinal.current + " " + novo : novo;
          textoParcial.current = "";
        }
        setListaManual((textoFinal.current + (textoParcial.current ? " " + textoParcial.current : "")).trim());
      };

      r.onerror = event => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          ditadoAtivo.current = false;
          setAOuvir(false);
          alert("Permite o acesso ao microfone no navegador.");
        }
      };

      r.onend = () => {
        reconhecimento.current = null;
        if (ditadoAtivo.current) window.setTimeout(arrancar, 160);
      };

      try { r.start(); }
      catch {
        ditadoAtivo.current = false;
        setAOuvir(false);
      }
    };

    arrancar();
  }

  function pararVoz() {
    ditadoAtivo.current = false;
    setAOuvir(false);
    const r = reconhecimento.current;
    if (r) {
      try { r.stop(); } catch {}
    }

    window.setTimeout(() => {
      const texto = (textoFinal.current + (textoParcial.current ? " " + textoParcial.current : "")).trim();
      setListaManual(texto);
      if (texto) reverLinhas(interpretarDitadoSaidas(texto, produtos, 0));
    }, 220);
  }

  async function lerFotos() {
    if (!fotografias.length) return;
    setALer(true);
    setProgresso(0);
    try {
      const linhas = await lerFotografiasSaidas(fotografias, produtos, setProgresso);
      reverLinhas(linhas);
    } catch (error) {
      console.error(error);
      alert("Não foi possível ler as fotografias.");
    } finally {
      setALer(false);
    }
  }

  function adicionarReconhecidas() {
    const invalidas = linhasReconhecidas.filter(l => !l.produto || !(Number(l.quantidade) > 0));
    if (invalidas.length) return alert("Confirma o produto e a quantidade de todas as linhas.");

    adicionarVarias(linhasReconhecidas.map(linha => ({
      produto: linha.produto,
      quantidade: Number(linha.quantidade),
      unidade: produtos.find(p => p.nome === linha.produto)?.unidade || ""
    })));

    setLinhasReconhecidas([]);
    setListaManual("");
    setFotografias([]);
    setProgresso(0);
  }

  function adicionarManual() {
    const quantidade = Number(String(quantidadeManual).replace(",", "."));
    if (!produtoManual || !(quantidade > 0)) return alert("Seleciona um produto e indica uma quantidade válida.");
    const produto = produtos.find(p => p.nome === produtoManual);
    adicionarProvisoria({ produto: produtoManual, quantidade, unidade: produto?.unidade || "" });
    setQuantidadeManual("");
  }

  async function confirmar() {
    if (!provisorias.length) return alert("A lista provisória está vazia.");
    setAGuardar(true);
    try {
      const resultado = await onConfirmar(provisorias.map(({ produto, quantidade, unidade }) => ({ produto, quantidade, unidade })));
      if (resultado === false) return;
      setProvisorias([]);
      setProdutoManual("");
      setQuantidadeManual("");
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <div>
      <div style={ui.card}>
        <h2 style={{ margin: "0 0 6px" }}>{titulo}</h2>
        <p style={ui.muted}>Escreve, dita ou fotografa uma lista. Depois revê e adiciona às saídas.</p>

        <textarea
          style={{ ...ui.input, width: "100%", minHeight: 105, resize: "vertical" }}
          placeholder={"Arroz 2\nBatata 5\nFrango 3"}
          value={listaManual}
          onChange={e => setListaManual(e.target.value)}
        />

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          <button type="button" style={ui.button} onClick={lerLista}>✍️ Ler lista</button>
          {!aOuvir ? (
            <button type="button" style={{ ...ui.button, ...ui.secondary }} onClick={iniciarVoz}>🎤 Começar gravação</button>
          ) : (
            <button type="button" style={{ ...ui.button, ...ui.danger }} onClick={pararVoz}>⏹️ Parar e rever</button>
          )}
          <label style={{ ...ui.button, ...ui.secondary, display: "inline-flex", alignItems: "center" }}>
            📷 Fotografar lista
            <input type="file" accept="image/*" capture="environment" multiple style={{ display: "none" }}
              onChange={e => { setFotografias(Array.from(e.target.files || [])); e.target.value = ""; }} />
          </label>
        </div>

        {!!fotografias.length && (
          <button type="button" style={{ ...ui.button, marginTop: 10 }} disabled={aLer} onClick={lerFotos}>
            {aLer ? "A ler… " + Math.round(progresso * 100) + "%" : "Ler " + fotografias.length + " fotografia(s)"}
          </button>
        )}
        {aLer && <progress style={{ width: "100%", marginTop: 8 }} max="1" value={progresso} />}
      </div>

      {!!linhasReconhecidas.length && (
        <div style={ui.card}>
          <h3 style={{ marginTop: 0 }}>👀 Rever lista reconhecida</h3>
          {linhasReconhecidas.map(linha => (
            <div key={linha.id} style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "10px 0", borderBottom: "1px solid #edf0ea" }}>
              <select style={{ ...ui.input, flex: "1 1 240px" }} value={linha.produto || ""} onChange={e => atualizarReconhecida(linha.id, "produto", e.target.value)}>
                <option value="">Selecionar produto…</option>
                {produtos.map(p => <option key={p.nome} value={p.nome}>{p.nome} ({p.unidade})</option>)}
              </select>
              <input style={{ ...ui.input, width: 120 }} type="number" inputMode="decimal" min="0.001" step="0.001" value={linha.quantidade} onChange={e => atualizarReconhecida(linha.id, "quantidade", e.target.value)} />
              <button type="button" style={{ ...ui.button, ...ui.danger }} onClick={() => setLinhasReconhecidas(lista => lista.filter(i => i.id !== linha.id))}>Remover</button>
              {linha.descricao && <small style={{ ...ui.muted, flexBasis: "100%" }}>Lido: {linha.descricao}</small>}
              {!!linha.sugestoes?.length && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flexBasis: "100%" }}>
                  {linha.sugestoes.map(nome => <button key={nome} type="button" style={{ ...ui.button, ...ui.secondary, minHeight: 36, padding: "6px 9px" }} onClick={() => atualizarReconhecida(linha.id, "produto", nome)}>{nome}</button>)}
                </div>
              )}
            </div>
          ))}
          <button type="button" style={{ ...ui.button, width: "100%", marginTop: 12 }} onClick={adicionarReconhecidas}>➕ Adicionar esta lista às saídas</button>
        </div>
      )}

      <div style={ui.card}>
        <button type="button" style={{ ...ui.button, ...ui.secondary, width: "100%", display: "flex", justifyContent: "space-between" }} onClick={() => setMostrarProdutos(v => !v)}>
          <span>📦 Produtos</span><span>{mostrarProdutos ? "▲ Esconder" : "▼ Mostrar"}</span>
        </button>

        {mostrarProdutos && (
          <div style={{ marginTop: 12 }}>
            {!!favoritos.length && (
              <>
                <strong>⭐ Favoritos</strong>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap", margin: "8px 0 12px" }}>
                  {favoritos.map(nome => <button key={nome} type="button" style={{ ...ui.button, ...ui.secondary, minHeight: 38 }} onClick={() => setProdutoManual(nome)}>{nome}</button>)}
                </div>
              </>
            )}
            {!!recentes.length && (
              <>
                <strong>🕘 Recentes</strong>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap", margin: "8px 0 12px" }}>
                  {recentes.map(nome => <button key={nome} type="button" style={{ ...ui.button, ...ui.secondary, minHeight: 38 }} onClick={() => setProdutoManual(nome)}>{nome}</button>)}
                </div>
              </>
            )}

            <input style={{ ...ui.input, width: "100%", marginBottom: 8 }} type="search" placeholder="Pesquisar produto…" value={pesquisa} onChange={e => setPesquisa(e.target.value)} />
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 110px auto auto", gap: 8, alignItems: "center" }}>
              <select style={ui.input} value={produtoManual} onChange={e => setProdutoManual(e.target.value)}>
                <option value="">Selecionar produto…</option>
                {produtosFiltrados.map(p => <option key={p.nome} value={p.nome}>{p.nome} ({p.unidade})</option>)}
              </select>
              <input style={ui.input} type="number" inputMode="decimal" min="0.001" step="0.001" placeholder="Qtd" value={quantidadeManual} onChange={e => setQuantidadeManual(e.target.value)} />
              <button type="button" style={{ ...ui.button, ...ui.secondary }} disabled={!produtoManual} onClick={() => alternarFavorito(produtoManual)}>
                {favoritos.includes(produtoManual) ? "⭐" : "☆"}
              </button>
              <button type="button" style={ui.button} onClick={adicionarManual}>Adicionar</button>
            </div>
          </div>
        )}
      </div>

      <div style={ui.card}>
        <h3 style={{ marginTop: 0 }}>📋 Lista provisória ({provisorias.length})</h3>
        {!provisorias.length && <p style={ui.muted}>Sem saídas adicionadas.</p>}
        {provisorias.map(linha => (
          <div key={linha.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 8, alignItems: "center", padding: "9px 0", borderBottom: "1px solid #edf0ea" }}>
            <strong>{linha.produto}</strong>
            <span>{linha.quantidade} {linha.unidade}</span>
            <button type="button" style={{ ...ui.button, ...ui.danger, minHeight: 38, padding: "6px 9px" }} onClick={() => setProvisorias(lista => lista.filter(i => i.id !== linha.id))}>❌</button>
          </div>
        ))}
        <button type="button" style={{ ...ui.button, width: "100%", marginTop: 12 }} disabled={aGuardar || !provisorias.length} onClick={confirmar}>
          {aGuardar ? "A guardar…" : "✅ Confirmar saídas"}
        </button>
      </div>
    </div>
  );
}
