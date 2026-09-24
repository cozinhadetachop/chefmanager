import { useEffect, useMemo, useState } from "react";
import Gerente from "./Gerente";
import Equipa from "./Equipa";
import Chef from "./Chef";
import { supabase } from "./supabaseClient";
import { entrarComPin, perfilDaSessao, PERFIS, terminarSessao } from "./auth";

const cores = {
  verde: "#536b45",
  creme: "#f7f5ef",
  borda: "#d9ddd4",
  vermelho: "#b42318"
};

const estilos = {
  pagina: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 20,
    boxSizing: "border-box",
    fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: "#252b23",
    background: "radial-gradient(circle at top right, rgba(116,145,94,.14), transparent 28rem), linear-gradient(180deg, #f8f9f6 0%, #f1f4ef 100%)"
  },
  caixa: {
    width: "100%",
    maxWidth: 540,
    padding: 28,
    boxSizing: "border-box",
    border: `1px solid ${cores.borda}`,
    borderRadius: 24,
    background: "rgba(255,255,255,.96)",
    boxShadow: "0 24px 60px rgba(52,69,45,.13)"
  },
  logo: { display: "block", width: "100%", maxWidth: 320, height: "auto", margin: "0 auto 18px" },
  perfis: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, margin: "22px 0" },
  perfil: {
    minHeight: 98,
    padding: 12,
    border: "1px solid #dfe5da",
    borderRadius: 16,
    background: "white",
    color: "#34452d",
    cursor: "pointer",
    fontWeight: 750,
    boxShadow: "0 4px 14px rgba(49,67,42,.05)"
  },
  perfilAtivo: { color: "white", background: "linear-gradient(135deg, #5d774d, #445d39)", borderColor: cores.verde, boxShadow: "0 10px 22px rgba(73,99,61,.20)" },
  input: {
    width: "100%",
    minHeight: 52,
    padding: "10px 14px",
    boxSizing: "border-box",
    border: `1px solid ${cores.borda}`,
    borderRadius: 13,
    textAlign: "center",
    fontSize: 24,
    letterSpacing: 8
  },
  entrar: {
    width: "100%",
    minHeight: 50,
    marginTop: 12,
    border: 0,
    borderRadius: 13,
    background: "linear-gradient(135deg, #5d774d, #49633d)",
    color: "white",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 750
  }
};

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MS = 60_000;

export default function App() {
  const [perfil, setPerfil] = useState(null);
  const [perfilEscolhido, setPerfilEscolhido] = useState("chef");
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const [aEntrar, setAEntrar] = useState(false);
  const [aIniciar, setAIniciar] = useState(true);
  const [tentativas, setTentativas] = useState(0);
  const [bloqueadoAte, setBloqueadoAte] = useState(0);
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setPerfil(perfilDaSessao(data.session));
      setAIniciar(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_evento, session) => {
      setPerfil(perfilDaSessao(session));
      setAIniciar(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!bloqueadoAte) return undefined;
    const timer = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [bloqueadoAte]);

  const segundosBloqueio = useMemo(
    () => Math.max(0, Math.ceil((bloqueadoAte - agora) / 1000)),
    [bloqueadoAte, agora]
  );

  async function entrar(event) {
    event.preventDefault();
    if (segundosBloqueio > 0) return;
    if (!/^\d{4}$/.test(pin)) {
      setErro("Introduz os quatro algarismos do PIN.");
      return;
    }

    setAEntrar(true);
    setErro("");
    const { data, error } = await entrarComPin(perfilEscolhido, pin);
    setPin("");
    setAEntrar(false);

    if (error || perfilDaSessao(data?.session) !== perfilEscolhido) {
      const novasTentativas = tentativas + 1;
      if (novasTentativas >= MAX_TENTATIVAS) {
        setTentativas(0);
        setBloqueadoAte(Date.now() + BLOQUEIO_MS);
        setAgora(Date.now());
        setErro("Demasiadas tentativas. Aguarda um minuto.");
      } else {
        setTentativas(novasTentativas);
        setErro("PIN incorreto.");
      }
      return;
    }

    setTentativas(0);
    setPerfil(perfilEscolhido);
  }

  async function logout() {
    await terminarSessao();
    setPerfil(null);
    setPin("");
  }

  if (aIniciar) return <div style={estilos.pagina}>A iniciar…</div>;
  if (perfil === "gerente") return <Gerente onLogout={logout} />;
  if (perfil === "equipa") return <Equipa onLogout={logout} />;
  if (perfil === "chef") return <Chef onLogout={logout} />;

  return (
    <main style={estilos.pagina}>
      <section style={estilos.caixa}>
        <div style={{ textAlign: "center" }}>
          <img src="/logo-cozinha-de-tacho.svg" alt="Cozinha de Tacho" style={estilos.logo} />
          <h1 style={{ margin: "8px 0 4px" }}>Controlo Cozinha</h1>
          <p style={{ margin: 0, color: "#667064" }}>Escolhe o perfil e introduz o PIN</p>
        </div>

        <div style={estilos.perfis}>
          {Object.values(PERFIS).map(item => (
            <button
              key={item.id}
              type="button"
              style={{ ...estilos.perfil, ...(perfilEscolhido === item.id ? estilos.perfilAtivo : {}) }}
              onClick={() => {
                setPerfilEscolhido(item.id);
                setPin("");
                setErro("");
              }}
            >
              <span style={{ display: "block", fontSize: 28, marginBottom: 5 }}>{item.icone}</span>
              {item.nome}
            </button>
          ))}
        </div>

        <form onSubmit={entrar}>
          <input
            style={estilos.input}
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            maxLength={4}
            aria-label={`PIN de ${PERFIS[perfilEscolhido].nome}`}
            placeholder="••••"
            value={pin}
            disabled={segundosBloqueio > 0 || aEntrar}
            onChange={event => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
          />
          {erro && <p role="alert" style={{ color: cores.vermelho, fontWeight: 700 }}>{erro}</p>}
          {segundosBloqueio > 0 && <p>Aguarda {segundosBloqueio} segundos.</p>}
          <button style={estilos.entrar} disabled={aEntrar || segundosBloqueio > 0}>
            {aEntrar ? "A verificar…" : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}
