import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

/* ===== Estilos (iguais ao resto da app) ===== */
const styles = {
  app: { padding: 20, fontFamily: "sans-serif" },
  card: { border: "1px solid #ccc", borderRadius: 6, padding: 12, marginBottom: 12 },
  input: { padding: "4px 6px", margin: "2px 4px" },
  button: { padding: "4px 8px", marginLeft: 4, cursor: "pointer" },
  danger: { backgroundColor: "#f44336", color: "white" },
  produtoLinha: { fontWeight: "bold", cursor: "pointer" }
};

export default function Equipa({ onLogout }) {
  /* ===== STATE SEGURO ===== */
  const [produtos, setProdutos] = useState([]);
  const [saidasProvisorias, setSaidasProvisorias] = useState([]);
  const [quantidades, setQuantidades] = useState({});
  const [responsavel, setResponsavel] = useState("");

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
    <div style={styles.app}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <img src="/logo-cozinha-de-tacho.webp" alt="Cozinha de Tacho" style={{ display: "block", width: 220, maxWidth: "70vw", height: "auto" }} />
          <h2 style={{ margin: "8px 0 0" }}>👨‍🍳 Equipa — Registo de Saídas</h2>
        </div>
        <button onClick={onLogout} style={{ ...styles.button, ...styles.danger }}>
          🔑 Sair
        </button>
      </header>

      {/* ✅ Pesquisa + abrir/fechar tudo (igual ao gerente) */}
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

      {/* ===== LISTA DE PRODUTOS (COLAPSÁVEL POR PROCEDÊNCIA) ===== */}
      {procedenciasOrdenadas.map(proc => {
        const listaTotal = produtosPorProcedencia[proc] || [];
        const listaFiltrada = pesquisa
          ? listaTotal.filter(p => (p.nome || "").toLowerCase().includes(pesquisa))
          : listaTotal;

        // ao pesquisar, não mostramos procedências vazias
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
                  .map(p => (
                    <div key={p.id} style={{ marginBottom: 6, borderTop: "1px solid #eee", paddingTop: 6 }}>
                      <span style={{ fontWeight: "bold" }}>
                        {p.nome} ({p.unidade})
                      </span>

                      <input
                        style={styles.input}
                        type="number"
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
                        ➕
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        );
      })}

      {/* ===== LISTA PROVISÓRIA ===== */}
      <h3>📋 Lista provisória</h3>

      {saidasProvisorias.length === 0 && <div>Sem saídas adicionadas.</div>}

      {saidasProvisorias.length > 0 && (
        <table border="1" cellPadding="4" style={{ width: "100%" }}>
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
                <td>{s.produto}</td>
                <td>{s.quantidade}</td>
                <td>{s.unidade}</td>
                <td>{s.setor}</td>
                <td>
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

      {/* ===== CONFIRMAR ===== */}
      <div style={{ marginTop: 12 }}>
        <input
          style={styles.input}
          placeholder="Responsável"
          value={responsavel}
          onChange={e => setResponsavel(e.target.value)}
        />

        <button
          style={styles.button}
          type="button"
          onClick={async () => {
            if (!responsavel) {
              alert("Responsável obrigatório");
              return;
            }
            if (saidasProvisorias.length === 0) {
              alert("Lista vazia");
              return;
            }

            const payload = saidasProvisorias.map(s => ({
              ...s,
              responsavel
            }));

            const { error } = await supabase.from("saidas").insert(payload);
            if (error) {
              alert("Erro ao guardar saídas");
              console.error(error);
              return;
            }

            setSaidasProvisorias([]);
            setResponsavel("");
            alert("Saídas registadas com sucesso!");
          }}
        >
          ✅ Confirmar Saídas
        </button>
      </div>
    </div>
  );
}
