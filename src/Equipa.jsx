import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

/* ===== Estilos (iguais ao resto da app) ===== */
const styles = {
  app: { minHeight: "100vh", maxWidth: 1000, margin: "0 auto", padding: 16, fontFamily: "Arial, sans-serif" },
  card: { border: "1px solid #d9ddd4", borderRadius: 14, padding: 16, marginBottom: 12, background: "white" },
  input: { minHeight: 44, maxWidth: "100%", padding: "9px 12px", margin: "2px 0", border: "1px solid #d9ddd4", borderRadius: 9, background: "white", fontSize: 16 },
  button: { minHeight: 44, padding: "9px 14px", border: "1px solid #536b45", borderRadius: 9, background: "#536b45", color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer" },
  secondary: { background: "white", color: "#34452d", borderColor: "#d9ddd4" },
  danger: { backgroundColor: "#b42318", borderColor: "#b42318", color: "white" },
  produtoLinha: { fontWeight: "bold", cursor: "pointer" }
};

export default function Equipa({ onLogout }) {
  /* ===== STATE SEGURO ===== */
  const [produtos, setProdutos] = useState([]);
  const [saidasProvisorias, setSaidasProvisorias] = useState([]);
  const [quantidades, setQuantidades] = useState({});
  const [responsavel, setResponsavel] = useState("");
  const [aGuardar, setAGuardar] = useState(false);
  const [erroSaida, setErroSaida] = useState("");
  const [listaManual, setListaManual] = useState("");
  const [fotografiasSaida, setFotografiasSaida] = useState([]);
  const [linhasImportadas, setLinhasImportadas] = useState([]);
  const [aLerFotografias, setALerFotografias] = useState(false);
  const [progressoFotografias, setProgressoFotografias] = useState(0);
  const [aOuvir, setAOuvir] = useState(false);
  const reconhecimentoVoz = useRef(null);
  const ditadoAtivo = useRef(false);
  const textoDitado = useRef("");

  /* ✅ UI (igual ao gerente) */
  const [pesquisaProduto, setPesquisaProduto] = useState("");
  const [procedenciasAbertas, setProcedenciasAbertas] = useState({}); // { "Makro": true, ... }

  /* ===== FETCH PRODUTOS ===== */
  useEffect(() => {
    fetchProdutos();
  }, []);

  async function fetchProdutos() {
    const { data } = await supabase.from("produtos").select("*").order("nome");
    setProdutos(data || []);
  }

  /* ===== AGRUPAR POR PROCEDÊNCIA ===== */
  const produtosPorProcedencia = {};
  produtos.forEach(p => {
    const procRaw = (p.procedencia ?? "").toString().trim();
    const proc = procRaw ? procRaw : "Sem procedência";
    if (!produtosPorProcedencia[proc]) produtosPorProcedencia[proc] = [];
    produtosPorProcedencia[proc].push(p);
  });
  const procedenciasOrdenadas = Object.keys(produtosPorProcedencia).sort((a, b) =>
    a.localeCompare(b)
  );

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


  async function transformarDitadoEmLista(texto) {
    const conteudo = String(texto || "").trim();
    if (!conteudo) return;

    const { interpretarTextoSaidas } = await import("./invoiceOcr");
    const linhas = interpretarTextoSaidas(conteudo, produtos, 0);
    if (linhas.length) {
      setLinhasImportadas(linhas);
    } else {
      alert("Ouvi o ditado, mas não consegui identificar produtos e quantidades. Revê o texto e corrige se necessário.");
    }
  }

  function iniciarDitado() {
    if (aOuvir || ditadoAtivo.current) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Este navegador não suporta ditado por voz. Tenta no Chrome ou Edge.");
      return;
    }

    ditadoAtivo.current = true;
    textoDitado.current = "";
    setAOuvir(true);

    const criarReconhecimento = () => {
      if (!ditadoAtivo.current) return;

      const recognition = new SpeechRecognition();
      recognition.lang = "pt-PT";
      recognition.continuous = false;
      recognition.interimResults = false;
      reconhecimentoVoz.current = recognition;

      recognition.onresult = event => {
        const frases = [];
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          if (event.results[i].isFinal) {
            const texto = event.results[i][0]?.transcript?.trim();
            if (texto) frases.push(texto);
          }
        }

        if (frases.length) {
          const novo = frases.join("\n");
          textoDitado.current = textoDitado.current
            ? textoDitado.current.trimEnd() + "\n" + novo
            : novo;

          setListaManual(atual => {
            const prefixo = atual.trim() ? atual.trimEnd() + "\n" : "";
            return prefixo + novo;
          });
        }
      };

      recognition.onerror = event => {
        console.error(event);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          ditadoAtivo.current = false;
          reconhecimentoVoz.current = null;
          setAOuvir(false);
          alert("O microfone não está autorizado. Permite o acesso ao microfone no navegador.");
        }
      };

      recognition.onend = () => {
        reconhecimentoVoz.current = null;
        if (ditadoAtivo.current) {
          window.setTimeout(criarReconhecimento, 180);
        } else {
          setAOuvir(false);
        }
      };

      try {
        recognition.start();
      } catch (error) {
        console.error(error);
        ditadoAtivo.current = false;
        reconhecimentoVoz.current = null;
        setAOuvir(false);
      }
    };

    criarReconhecimento();
  }

  function pararDitado() {
    ditadoAtivo.current = false;
    setAOuvir(false);

    const recognition = reconhecimentoVoz.current;
    reconhecimentoVoz.current = null;

    if (recognition) {
      try {
        recognition.abort();
      } catch (error) {
        console.error(error);
      }
    }

    const conteudoDitado = textoDitado.current.trim();
    if (conteudoDitado) {
      window.setTimeout(() => transformarDitadoEmLista(conteudoDitado), 80);
    }
  }

  function juntarFotografiasSaida(event) {
    const novos = Array.from(event.target.files || []);
    if (!novos.length) return;
    setFotografiasSaida(atual => [...atual, ...novos]);
    event.target.value = "";
  }

  async function lerListaManual() {
    if (!listaManual.trim()) {
      alert("Escreve ou cola primeiro a lista de produtos e quantidades.");
      return;
    }
    const { interpretarTextoSaidas } = await import("./invoiceOcr");
    const linhas = interpretarTextoSaidas(listaManual, produtos, 0);
    if (!linhas.length) {
      alert("Não consegui reconhecer produtos nessa lista. Usa uma linha por produto, por exemplo: Arroz 2");
      return;
    }
    setLinhasImportadas(linhas);
  }

  async function lerFotografiasSaida() {
    if (!fotografiasSaida.length) return;
    setALerFotografias(true);
    setProgressoFotografias(0);
    try {
      const { lerFotografiasSaidas } = await import("./invoiceOcr");
      const linhas = await lerFotografiasSaidas(fotografiasSaida, produtos, setProgressoFotografias);
      if (!linhas.length) {
        alert("Não consegui reconhecer produtos na fotografia. Tenta com a folha mais direita, bem iluminada e com letra legível.");
        return;
      }
      setLinhasImportadas(linhas);
    } catch (error) {
      console.error(error);
      alert("Não foi possível ler a fotografia.");
    } finally {
      setALerFotografias(false);
    }
  }

  function atualizarLinhaImportada(id, campo, valor) {
    setLinhasImportadas(linhas => linhas.map(linha => linha.id === id ? { ...linha, [campo]: valor } : linha));
  }

  function adicionarLinhasImportadas() {
    const invalidas = linhasImportadas.filter(linha => !linha.produto || !Number(linha.quantidade) || Number(linha.quantidade) <= 0);
    if (invalidas.length) {
      alert("Confirma o produto e a quantidade de todas as linhas antes de adicionar.");
      return;
    }

    const novas = linhasImportadas.map(linha => {
      const produto = produtos.find(p => p.nome === linha.produto);
      return {
        produto: linha.produto,
        quantidade: Number(linha.quantidade),
        unidade: produto?.unidade || "",
        setor: "Cozinha",
        dataHora: new Date().toISOString()
      };
    });

    setSaidasProvisorias(atual => [...atual, ...novas]);
    setLinhasImportadas([]);
    setListaManual("");
    setFotografiasSaida([]);
    setProgressoFotografias(0);
  }

  return (
    <div className="operacao" style={styles.app}>
      <header className="operacao-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <img src="/logo-cozinha-de-tacho.webp" alt="Cozinha de Tacho" style={{ display: "block", width: 220, maxWidth: "70vw", height: "auto" }} />
          <h2 style={{ margin: "8px 0 0" }}>Equipa · Registo de saídas</h2>
        </div>
        <button onClick={onLogout} style={{ ...styles.button, ...styles.danger }}>
          🔑 Sair
        </button>
      </header>

      <p className="operacao-muted">1. Faz a lista · 2. Revê o que foi lido · 3. Confirma as saídas.</p>

      <div style={styles.card}>
        <h3 className="operacao-section-title">⚡ Saída rápida por lista</h3>
        <p className="operacao-muted">
          Escreve uma linha por produto, tira uma fotografia ou usa o microfone. Ao ditar, diz por exemplo:
          <strong> “Arroz dois, batata cinco, frango três”</strong>.
        </p>

        <textarea
          style={{ ...styles.input, width: "100%", minHeight: 110, boxSizing: "border-box", resize: "vertical" }}
          placeholder={"Arroz 2\nBatata 5\nFrango 3"}
          value={listaManual}
          onChange={e => setListaManual(e.target.value)}
        />

        <div className="operacao-tools" style={{ marginTop: 8 }}>
          <button style={styles.button} type="button" onClick={lerListaManual}>
            ✍️ Ler lista escrita
          </button>
          {!aOuvir ? (
            <button
              style={{ ...styles.button, ...styles.secondary }}
              type="button"
              onClick={iniciarDitado}
            >
              🎤 Começar gravação
            </button>
          ) : (
            <button
              style={{ ...styles.button, ...styles.danger }}
              type="button"
              onClick={pararDitado}
            >
              ⏹️ Parar e rever
            </button>
          )}
          <label style={{ ...styles.button, ...styles.secondary, display: "inline-flex", alignItems: "center" }}>
            📷 Tirar/carregar fotografia
            <input type="file" accept="image/*" capture="environment" multiple onChange={juntarFotografiasSaida} style={{ display: "none" }} />
          </label>
        </div>

        {fotografiasSaida.map((foto, indice) => (
          <div key={`${foto.name}-${indice}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "7px 0" }}>
            <span>Foto {indice + 1}: {foto.name}</span>
            <button type="button" style={{ ...styles.button, ...styles.secondary }} onClick={() => setFotografiasSaida(lista => lista.filter((_, i) => i !== indice))}>
              Retirar
            </button>
          </div>
        ))}

        {!!fotografiasSaida.length && (
          <button style={{ ...styles.button, marginTop: 8 }} type="button" disabled={aLerFotografias} onClick={lerFotografiasSaida}>
            {aLerFotografias ? `A ler… ${Math.round(progressoFotografias * 100)}%` : `Ler ${fotografiasSaida.length} fotografia(s)`}
          </button>
        )}
        {aLerFotografias && <progress style={{ width: "100%", marginTop: 8 }} max="1" value={progressoFotografias} />}
      </div>

      {!!linhasImportadas.length && (
        <div style={styles.card}>
          <h3 className="operacao-section-title">👀 Rever lista reconhecida</h3>
          <p className="operacao-muted">Corrige qualquer produto ou quantidade antes de adicionar às saídas.</p>

          {linhasImportadas.map(linha => (
            <div key={linha.id} className="operacao-form" style={{ padding: "10px 0", borderBottom: "1px solid #e7eae3" }}>
              <select
                style={styles.input}
                value={linha.produto || ""}
                onChange={e => atualizarLinhaImportada(linha.id, "produto", e.target.value)}
              >
                <option value="">Selecionar produto…</option>
                {produtos.map(p => <option key={p.nome} value={p.nome}>{p.nome} ({p.unidade})</option>)}
              </select>

              <input
                style={styles.input}
                type="number"
                inputMode="decimal"
                min="0.001"
                step="0.001"
                placeholder="Quantidade"
                value={linha.quantidade}
                onChange={e => atualizarLinhaImportada(linha.id, "quantidade", e.target.value)}
              />

              <button type="button" style={{ ...styles.button, ...styles.danger }} onClick={() => setLinhasImportadas(lista => lista.filter(item => item.id !== linha.id))}>
                Remover
              </button>

              {linha.descricao && <small style={{ flexBasis: "100%", color: "#667064" }}>Lido: {linha.descricao}</small>}
            </div>
          ))}

          <button style={{ ...styles.button, width: "100%", marginTop: 12 }} type="button" onClick={adicionarLinhasImportadas}>
            ➕ Adicionar esta lista às saídas
          </button>
        </div>
      )}

      <div style={{ margin: "18px 0 10px" }}>
        <h3 className="operacao-section-title">Adicionar produto individual</h3>
      </div>
      {/* ✅ Pesquisa + abrir/fechar tudo (igual ao gerente) */}
      <div className="operacao-tools" style={styles.card}>
        <input
          style={styles.input}
          type="search"
          aria-label="Pesquisar produto para saída"
          placeholder="Pesquisar produto…"
          value={pesquisaProduto}
          onChange={e => setPesquisaProduto(e.target.value)}
        />
        <button style={{ ...styles.button, ...styles.secondary }} type="button" onClick={abrirTudoProcedencias}>
          Abrir tudo
        </button>
        <button style={{ ...styles.button, ...styles.secondary }} type="button" onClick={fecharTudoProcedencias}>
          Fechar tudo
        </button>
      </div>

      {/* ===== LISTA DE PRODUTOS (COLAPSÁVEL POR PROCEDÊNCIA) ===== */}
      {procedenciasOrdenadas.map(proc => {
        const listaTotal = produtosPorProcedencia[proc] || [];
        const listaFiltrada = pesquisa
          ? listaTotal.filter(p => (p.nome || "").toLowerCase().includes(pesquisa))
          : listaTotal;

        // ao pesquisar, não mostramos procedências vazias
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
              <div style={{ marginLeft: 12 }}>
                {listaFiltrada
                  .slice()
                  .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
                  .map(p => (
                    <div key={p.id} className="equipa-produto">
                      <strong>{p.nome} ({p.unidade})</strong>

                      <input
                        style={styles.input}
                        type="number"
                        aria-label={`Quantidade de ${p.nome}`}
                        placeholder="Qtd"
                        value={quantidades[p.id] || ""}
                        onChange={e =>
                          setQuantidades({
                            ...quantidades,
                            [p.id]: e.target.value
                          })
                        }
                      />

                      <button
                        style={styles.button}
                        type="button"
                        onClick={() => {
                          const qtd = Number(quantidades[p.id]);
                          if (!qtd || qtd <= 0) {
                            alert("Quantidade inválida");
                            return;
                          }

                          setSaidasProvisorias(prev => [
                            ...prev,
                            {
                              produto: p.nome,
                              quantidade: qtd,
                              unidade: p.unidade,
                              setor: "Cozinha",
                              dataHora: new Date().toISOString()
                            }
                          ]);

                          setQuantidades({ ...quantidades, [p.id]: "" });
                        }}
                      >
                        Adicionar
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        );
      })}

      {/* ===== LISTA PROVISÓRIA ===== */}
      <div style={styles.card}><h3 className="operacao-section-title">📋 Lista provisória ({saidasProvisorias.length})</h3>

      {saidasProvisorias.length === 0 && <div>Sem saídas adicionadas.</div>}

      {saidasProvisorias.length > 0 && (
        <table className="mobile-cards" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Qtd</th>
              <th>Unidade</th>
              <th>Setor</th>
              <th>Remover</th>
            </tr>
          </thead>
          <tbody>
            {saidasProvisorias.map((s, i) => (
              <tr key={i}>
                <td data-label="Produto">{s.produto}</td>
                <td data-label="Quantidade">{s.quantidade}</td>
                <td data-label="Unidade">{s.unidade}</td>
                <td data-label="Setor">{s.setor}</td>
                <td data-label="Remover">
                  <button
                    style={{ ...styles.button, ...styles.danger }}
                    type="button"
                    onClick={() =>
                      setSaidasProvisorias(prev => prev.filter((_, idx) => idx !== i))
                    }
                  >
                    ❌
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      </div>
      {/* ===== CONFIRMAR ===== */}
      <div className="equipa-confirmar" style={styles.card}>
        <h3 className="operacao-section-title">✅ Confirmar saídas</h3>
        <label htmlFor="responsavel-saidas">Responsável</label><br />
        <input id="responsavel-saidas"
          style={styles.input}
          placeholder="Responsável"
          value={responsavel}
          onChange={e => setResponsavel(e.target.value)}
        />

        <button
          style={{ ...styles.button, marginTop: 10 }}
          type="button"
          disabled={aGuardar}
          onClick={async () => {
            if (!responsavel.trim()) {
              alert("Responsável obrigatório");
              return;
            }
            if (saidasProvisorias.length === 0) {
              alert("Lista vazia");
              return;
            }

            setAGuardar(true);
            setErroSaida("");
            try {
              const { error } = await supabase.rpc("equipa_registar_saidas", {
                p_movimentos: saidasProvisorias.map(({ produto, quantidade }) => ({ produto, quantidade })),
                p_responsavel: responsavel.trim()
              });
              if (error) {
                console.error(error);
                setErroSaida("Não foi possível guardar as saídas. Tenta novamente.");
                return;
              }
              setSaidasProvisorias([]);
              setResponsavel("");
              alert("Saídas registadas com sucesso!");
            } catch (error) {
              console.error(error);
              setErroSaida("Não foi possível guardar as saídas. Tenta novamente.");
            } finally {
              setAGuardar(false);
            }
          }}
        >
          {aGuardar ? "A guardar…" : "✅ Confirmar Saídas"}
        </button>
        {erroSaida && <p role="alert" style={{ color: "#b42318" }}>{erroSaida}</p>}
      </div>
    </div>
  );
}
