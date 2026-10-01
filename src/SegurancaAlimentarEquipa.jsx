import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const styles = {
  card: { border: "1px solid #dfe5da", borderRadius: 18, padding: 18, marginBottom: 14, background: "rgba(255,255,255,.94)", boxShadow: "0 6px 18px rgba(49,67,42,.055)" },
  input: { minHeight: 46, width: "100%", boxSizing: "border-box", padding: "10px 13px", margin: "2px 0", border: "1px solid #dce3d7", borderRadius: 11, background: "white", color: "#1f2a1d", fontSize: 16 },
  button: { minHeight: 46, padding: "10px 15px", border: "1px solid #536b45", borderRadius: 11, background: "linear-gradient(135deg, #5d774d, #49633d)", color: "white", fontSize: 15, fontWeight: 750, cursor: "pointer", boxShadow: "0 4px 10px rgba(73,99,61,.14)" },
  secondary: { background: "white", color: "#34452d", borderColor: "#dce3d7", boxShadow: "none" },
  dangerBox: { border: "1px solid #b42318", background: "#fff1f0", color: "#8a1c13", borderRadius: 10, padding: 10, marginTop: 8, fontWeight: 700 }
};

function hoje() {
  const d = new Date();
  const pad = v => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function agoraHora() {
  const d = new Date();
  const pad = v => String(v).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function numero(v) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function instanteValido(data, hora) {
  if (!data || !hora) return false;
  const d = new Date(`${data}T${hora}:00`);
  return !Number.isNaN(d.getTime()) && d.getTime() <= Date.now();
}
function limiteTexto(e) {
  if (e.temperatura_min !== null && e.temperatura_max !== null) return `${e.temperatura_min} °C a ${e.temperatura_max} °C`;
  if (e.temperatura_min !== null) return `≥ ${e.temperatura_min} °C`;
  if (e.temperatura_max !== null) return `≤ ${e.temperatura_max} °C`;
  return "Sem limite";
}

export default function SegurancaAlimentarEquipa() {
  const [separador, setSeparador] = useState("frio");
  const [equipamentos, setEquipamentos] = useState([]);
  const [setor, setSetor] = useState("cozinha");
  const [momentoFrio, setMomentoFrio] = useState("inicio");
  const [temperaturas, setTemperaturas] = useState({});
  const [data, setData] = useState(hoje());
  const [hora, setHora] = useState(agoraHora());
  const [responsavel, setResponsavel] = useState("");
  const [aGuardar, setAGuardar] = useState(false);

  const [bm, setBm] = useState({ equipamento: "1", refeicao: "almoco", momento: "inicio", alimento: "", equipamentoTemp: "" });
  const [oleo, setOleo] = useState({ fritadeira: "1", classificacao: "", temperatura: "", substituicao: false });

  useEffect(() => {
    (async () => {
      const { data: rows, error } = await supabase
        .from("equipamentos_temperatura")
        .select("*")
        .eq("ativo", true)
        .order("setor")
        .order("nome");
      if (!error) setEquipamentos(rows || []);
    })();
  }, []);

  const frio = useMemo(() => equipamentos.filter(e =>
    e.setor === setor && (e.nome.includes("Câmara") || e.nome.includes("Frigorífica"))
  ), [equipamentos, setor]);

  async function guardarFrio() {
    const itens = frio.map(e => {
      const n = numero(temperaturas[e.id]);
      return n === null ? null : {
        equipamento_id: e.id,
        temperatura: n,
        momento: momentoFrio,
        registado_em: `${data}T${hora}:00`
      };
    }).filter(Boolean);

    if (!responsavel.trim()) return alert("Indica o responsável.");
    if (!instanteValido(data, hora)) return alert("Confirma a data e a hora. Não são permitidos registos no futuro.");
    if (!itens.length) return alert("Introduz pelo menos uma temperatura.");

    setAGuardar(true);
    const { error } = await supabase.rpc("equipa_registar_temperaturas", { p_itens: itens, p_responsavel: responsavel.trim() });
    setAGuardar(false);
    if (error) return alert("Não foi possível guardar o registo.");
    setTemperaturas({});
    alert("Temperaturas de frio registadas.");
  }

  async function guardarQuente() {
    const ta = numero(bm.alimento);
    const te = numero(bm.equipamentoTemp);
    if (ta === null && te === null) return alert("Introduz a temperatura do alimento e/ou do equipamento.");
    if (!responsavel.trim()) return alert("Indica o responsável.");
    if (!instanteValido(data, hora)) return alert("Confirma a data e a hora. Não são permitidos registos no futuro.");

    setAGuardar(true);
    const { error } = await supabase.rpc("equipa_registar_manutencao_quente", {
      p_equipamento_num: Number(bm.equipamento),
      p_refeicao: bm.refeicao,
      p_momento: bm.momento,
      p_temperatura_alimento: ta,
      p_temperatura_equipamento: te,
      p_responsavel: responsavel.trim(),
      p_registado_em: `${data}T${hora}:00`
    });
    setAGuardar(false);
    if (error) return alert("Não foi possível guardar o registo.");
    setBm(prev => ({ ...prev, alimento: "", equipamentoTemp: "" }));
    alert("Registo do Self/Banho-Maria guardado.");
  }

  async function guardarOleo() {
    const t = numero(oleo.temperatura);
    if (!oleo.classificacao) return alert("Seleciona o resultado do teste do óleo.");
    if (!responsavel.trim()) return alert("Indica o responsável.");
    if (!instanteValido(data, hora)) return alert("Confirma a data e a hora. Não são permitidos registos no futuro.");

    setAGuardar(true);
    const { error } = await supabase.rpc("equipa_registar_oleo_fritura", {
      p_fritadeira_num: Number(oleo.fritadeira),
      p_classificacao: oleo.classificacao,
      p_temperatura: t,
      p_substituicao: oleo.substituicao,
      p_responsavel: responsavel.trim(),
      p_registado_em: `${data}T${hora}:00`
    });
    setAGuardar(false);
    if (error) return alert("Não foi possível guardar o registo.");
    setOleo(prev => ({ ...prev, classificacao: "", temperatura: "", substituicao: false }));
    alert("Controlo do óleo registado.");
  }

  const tempEquip = numero(bm.equipamentoTemp);
  const tempAli = numero(bm.alimento);
  const oleoTemp = numero(oleo.temperatura);
  const oleoRejeitar = oleo.classificacao === "mau" || oleo.classificacao === "muito_mau";

  return (
    <>
      <div style={styles.card}>
        <h3 style={{ marginTop: 0 }}>🧪 Segurança alimentar</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          <button type="button" style={{ ...styles.button, ...(separador === "frio" ? {} : styles.secondary) }} onClick={() => setSeparador("frio")}>❄️ Frio</button>
          <button type="button" style={{ ...styles.button, ...(separador === "quente" ? {} : styles.secondary) }} onClick={() => setSeparador("quente")}>♨️ Self</button>
          <button type="button" style={{ ...styles.button, ...(separador === "oleos" ? {} : styles.secondary) }} onClick={() => setSeparador("oleos")}>🍟 Óleos</button>
        </div>
      </div>

      {separador === "frio" && <div style={styles.card}>
        <h3 style={{ marginTop: 0 }}>❄️ Equipamentos de frio</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          <button type="button" style={{ ...styles.button, ...(setor === "cozinha" ? {} : styles.secondary) }} onClick={() => setSetor("cozinha")}>🍳 Cozinha</button>
          <button type="button" style={{ ...styles.button, ...(setor === "atendimento" ? {} : styles.secondary) }} onClick={() => setSetor("atendimento")}>🛎️ Balcão</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          <button type="button" style={{ ...styles.button, ...(momentoFrio === "inicio" ? {} : styles.secondary) }} onClick={() => setMomentoFrio("inicio")}>Início do dia</button>
          <button type="button" style={{ ...styles.button, ...(momentoFrio === "fim" ? {} : styles.secondary) }} onClick={() => setMomentoFrio("fim")}>Fim do dia</button>
        </div>
        {frio.map(e => {
          const v = temperaturas[e.id] ?? "";
          const n = numero(v);
          const fora = n !== null && ((e.temperatura_min !== null && n < Number(e.temperatura_min)) || (e.temperatura_max !== null && n > Number(e.temperatura_max)));
          const negativo = e.temperatura_max !== null && Number(e.temperatura_max) < 0;
          return <div key={e.id} style={{ padding: "10px 0", borderBottom: "1px solid #e7eae3" }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 135px", gap: 10, alignItems: "center" }}>
              <div><strong>{e.nome}</strong><div style={{ fontSize: 12, opacity: .72 }}>Referência: {limiteTexto(e)}</div></div>
              <div style={{ display: "grid", gridTemplateColumns: negativo ? "42px 1fr" : "1fr", gap: 5 }}>
                {negativo && <button type="button" style={{ ...styles.button, ...styles.secondary, fontSize: 21, padding: 4 }} onClick={() => setTemperaturas(p => ({ ...p, [e.id]: String(p[e.id] || "").startsWith("-") ? String(p[e.id]).slice(1) : "-" + String(p[e.id] || "") }))}>−</button>}
                <input style={{ ...styles.input, ...(fora ? { borderColor: "#b42318", background: "#fff1f0" } : {}) }} inputMode="decimal" value={v} placeholder={negativo ? "-18" : "°C"} onChange={ev => setTemperaturas(p => ({ ...p, [e.id]: ev.target.value.replace(",", ".") }))} />
              </div>
            </div>
            {fora && <div style={styles.dangerBox}>⚠ Fora do limite definido. O valor será registado.</div>}
          </div>;
        })}
      </div>}

      {separador === "quente" && <div style={styles.card}>
        <h3 style={{ marginTop: 0 }}>♨️ Manutenção a quente</h3>
        <p style={{ marginTop: -4, opacity: .75 }}>Equipamento: 80–90 °C · Interior do alimento: ≥ 65 °C</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label><strong>Banho-Maria</strong><select style={styles.input} value={bm.equipamento} onChange={e => setBm(p => ({ ...p, equipamento: e.target.value }))}><option value="1">Equipamento 1</option><option value="2">Equipamento 2</option></select></label>
          <label><strong>Refeição</strong><select style={styles.input} value={bm.refeicao} onChange={e => setBm(p => ({ ...p, refeicao: e.target.value }))}><option value="almoco">Almoço</option><option value="jantar">Jantar</option></select></label>
        </div>
        <label><strong>Momento</strong><select style={styles.input} value={bm.momento} onChange={e => setBm(p => ({ ...p, momento: e.target.value }))}><option value="inicio">Início</option><option value="intermedio">Intermédio</option><option value="fim">Fim</option></select></label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label><strong>Alimento (°C)</strong><input style={{ ...styles.input, ...(tempAli !== null && tempAli < 65 ? { borderColor: "#b42318", background: "#fff1f0" } : {}) }} inputMode="decimal" value={bm.alimento} onChange={e => setBm(p => ({ ...p, alimento: e.target.value }))} placeholder="≥ 65" /></label>
          <label><strong>Equipamento (°C)</strong><input style={{ ...styles.input, ...(tempEquip !== null && (tempEquip < 80 || tempEquip > 90) ? { borderColor: "#b42318", background: "#fff1f0" } : {}) }} inputMode="decimal" value={bm.equipamentoTemp} onChange={e => setBm(p => ({ ...p, equipamentoTemp: e.target.value }))} placeholder="80–90" /></label>
        </div>
        {((tempAli !== null && tempAli < 65) || (tempEquip !== null && (tempEquip < 80 || tempEquip > 90))) && <div style={styles.dangerBox}>⚠ Valor fora da referência. O registo será guardado.</div>}
      </div>}

      {separador === "oleos" && <div style={styles.card}>
        <h3 style={{ marginTop: 0 }}>🍟 Controlo dos óleos de fritura</h3>
        <p style={{ marginTop: -4, opacity: .75 }}>Temperatura do óleo ≤ 180 °C</p>
        <label><strong>Fritadeira</strong><select style={styles.input} value={oleo.fritadeira} onChange={e => setOleo(p => ({ ...p, fritadeira: e.target.value }))}><option value="1">Fritadeira 1</option><option value="2">Fritadeira 2</option></select></label>
        <strong>Resultado do teste</strong>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginTop: 6 }}>
          {[
            ["bom","BOM · TPM até 12%"],
            ["medio","MÉDIO · TPM 13–16%"],
            ["mau","MAU · TPM 17–23%"],
            ["muito_mau","MUITO MAU · TPM >24%"]
          ].map(([v,l]) => <button key={v} type="button" style={{ ...styles.button, ...(oleo.classificacao === v ? {} : styles.secondary) }} onClick={() => setOleo(p => ({ ...p, classificacao: v }))}>{l}</button>)}
        </div>
        <label style={{ display: "block", marginTop: 10 }}><strong>Temperatura do óleo (°C)</strong><input style={{ ...styles.input, ...(oleoTemp !== null && oleoTemp > 180 ? { borderColor: "#b42318", background: "#fff1f0" } : {}) }} inputMode="decimal" value={oleo.temperatura} onChange={e => setOleo(p => ({ ...p, temperatura: e.target.value }))} placeholder="Até 180" /></label>
        <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, fontWeight: 700 }}><input type="checkbox" checked={oleo.substituicao} onChange={e => setOleo(p => ({ ...p, substituicao: e.target.checked }))} /> Óleo substituído</label>
        {oleoRejeitar && <div style={styles.dangerBox}>⛔ Rejeitar o óleo — resultado MAU ou MUITO MAU.</div>}
        {oleoTemp !== null && oleoTemp > 180 && <div style={styles.dangerBox}>⚠ Temperatura superior a 180 °C.</div>}
      </div>}

      <div style={styles.card}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label><strong>Data</strong><input style={styles.input} type="date" value={data} max={hoje()} onChange={e => setData(e.target.value)} /></label>
          <label><strong>Hora</strong><input style={styles.input} type="time" value={hora} onChange={e => setHora(e.target.value)} /></label>
        </div>
        <label style={{ display: "block", marginTop: 8 }}><strong>Responsável</strong><input style={styles.input} value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Nome" /></label>
        <button type="button" disabled={aGuardar} style={{ ...styles.button, width: "100%", marginTop: 12 }} onClick={separador === "frio" ? guardarFrio : separador === "quente" ? guardarQuente : guardarOleo}>
          {aGuardar ? "A guardar…" : "✅ Guardar registo"}
        </button>
      </div>
    </>
  );
}
