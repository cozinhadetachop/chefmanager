import { useEffect, useState } from "react";
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

      <p className="operacao-muted">1. Escolhe os produtos · 2. Revê a lista · 3. Confirma as saídas.</p>
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
