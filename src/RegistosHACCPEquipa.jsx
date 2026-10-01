import { useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const styles = {
  card: { border: "1px solid #dfe5da", borderRadius: 18, padding: 18, marginBottom: 14, background: "rgba(255,255,255,.94)", boxShadow: "0 6px 18px rgba(49,67,42,.055)" },
  input: { minHeight: 46, width: "100%", boxSizing: "border-box", padding: "10px 13px", margin: "2px 0", border: "1px solid #dce3d7", borderRadius: 11, background: "white", color: "#1f2a1d", fontSize: 16 },
  button: { minHeight: 46, padding: "10px 15px", border: "1px solid #536b45", borderRadius: 11, background: "linear-gradient(135deg, #5d774d, #49633d)", color: "white", fontSize: 15, fontWeight: 750, cursor: "pointer", boxShadow: "0 4px 10px rgba(73,99,61,.14)" },
  secondary: { background: "white", color: "#34452d", borderColor: "#dce3d7", boxShadow: "none" }
};

const TAREFAS = {
  cozinha: {
    diario: [
      "Utensílios de trabalho (facas, espátulas, tenazes, pranchas de corte, recipientes, …)",
      "Loiças grossas (panelas, tabuleiros) / Loiças e talheres",
      "Superfícies de trabalho / Bancadas / Mesas de apoio",
      "Fogão",
      "Forno convetor",
      "Fritadeiras (EXTERIOR) / Filtrar o óleo",
      "Grelhador",
      "Tanque demolhador de bacalhau",
      "Máquina de cortar batatas",
      "Equipamentos de frio (EXTERIOR: portas / borrachas)",
      "Bancas de lavagem / Lavatório(s) e dispensadores",
      "Pavimento / Ralos e grelhas de escoamento",
      "Contentores de resíduos",
      "Utensílios de higienização (esponjas, esfregões, escovas, baldes, esfregonas, panos de microfibra, …)",
      "Reposição de toalhetes das mãos",
      "Reposição de sabonete líquido"
    ],
    semanal: [
      "Equipamento de frio (INTERIOR)",
      "Hotte / Filtros",
      "Fritadeiras (INTERIOR) (quando esvaziadas)",
      "Cilindro / Extintor / Manta anti-fogo (Limpar)",
      "Paredes",
      "Prateleiras",
      "Armários / Gavetas",
      "Portas"
    ],
    mensal: [
      "Tetos / Sistema de iluminação / Grelhas da ventilação (Limpar)",
      "Insetocaçador (Verificar tela)"
    ]
  },
  balcao: {
    diario: [
      "Utensílios de trabalho (tenazes, …)",
      "Tabuleiros / Loiças e talheres",
      "Bancadas / Mesas de apoio",
      "Mesas e Cadeiras (Sala)",
      "Pavimento",
      "Banho-Maria (Linha de empratamento – cuvetes)",
      "Banho-Maria (Sopa)",
      "Aquecedor de pratos",
      "Máquina e moinho de café",
      "Máquina de bebidas de pressão",
      "Vitrinas (Vidros)",
      "Equipamentos de frio (EXTERIOR: portas / borrachas)",
      "Lavatório e dispensadores",
      "Reposição de toalhetes das mãos",
      "Reposição de sabonete líquido"
    ],
    semanal: [
      "Equipamento de frio (INTERIOR)",
      "Máquina de gelo",
      "Prateleiras / Expositores",
      "Armários / Gavetas",
      "Computador e seus componentes",
      "Extintor (Limpar)",
      "Televisão (Limpar)",
      "Paredes"
    ],
    mensal: [
      "Tetos / Sistema de iluminação (Candeeiros) (Limpar)",
      "Insetocaçador (Verificar tela)"
    ]
  }
};

function hoje() {
  const d = new Date();
  const pad = v => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function HigienizacaoEquipa() {
  const [area,setArea]=useState("cozinha");
  const [freq,setFreq]=useState("diario");
  const [selecionadas,setSelecionadas]=useState([]);
  const [data,setData]=useState(hoje());
  const [responsavel,setResponsavel]=useState("");
  const [aGuardar,setAGuardar]=useState(false);

  const tarefas=useMemo(()=>TAREFAS[area][freq],[area,freq]);
  function toggle(t){ setSelecionadas(s=>s.includes(t)?s.filter(x=>x!==t):[...s,t]); }
  function mudarArea(v){ setArea(v); setSelecionadas([]); }
  function mudarFreq(v){ setFreq(v); setSelecionadas([]); }

  async function guardar(){
    if(!selecionadas.length) return alert("Seleciona pelo menos uma tarefa concluída.");
    if(!responsavel.trim()) return alert("Indica o responsável.");
    if(!data || data>hoje()) return alert("Confirma a data do registo.");
    setAGuardar(true);
    const {error}=await supabase.rpc("equipa_registar_higienizacao",{
      p_area:area,p_frequencia:freq,p_tarefas:selecionadas,p_data:data,p_responsavel:responsavel.trim()
    });
    setAGuardar(false);
    if(error) return alert("Não foi possível guardar o registo de higienização.");
    setSelecionadas([]);
    alert("Higienização registada.");
  }

  return <>
    <div style={styles.card}>
      <h3 style={{marginTop:0}}>🧼 Higienização das instalações</h3>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
        <button type="button" style={{...styles.button,...(area==="cozinha"?{}:styles.secondary)}} onClick={()=>mudarArea("cozinha")}>🍳 Cozinha / Copa / Despensa</button>
        <button type="button" style={{...styles.button,...(area==="balcao"?{}:styles.secondary)}} onClick={()=>mudarArea("balcao")}>🛎️ Balcão / Linha / Sala</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
        <button type="button" style={{...styles.button,...(freq==="diario"?{}:styles.secondary)}} onClick={()=>mudarFreq("diario")}>Diário / Quando utilizado</button>
        <button type="button" style={{...styles.button,...(freq==="semanal"?{}:styles.secondary)}} onClick={()=>mudarFreq("semanal")}>Semanal</button>
        <button type="button" style={{...styles.button,...(freq==="mensal"?{}:styles.secondary)}} onClick={()=>mudarFreq("mensal")}>Mensal</button>
      </div>

      <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",marginBottom:8}}>
        <strong>{selecionadas.length} tarefa(s) assinalada(s)</strong>
        <button type="button" style={{...styles.button,...styles.secondary,minHeight:38,padding:"6px 10px"}} onClick={()=>setSelecionadas(selecionadas.length===tarefas.length?[]:[...tarefas])}>
          {selecionadas.length===tarefas.length?"Desmarcar todas":"Marcar todas"}
        </button>
      </div>

      {tarefas.map(t=><label key={t} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"10px 0",borderBottom:"1px solid #e7eae3",fontWeight:600}}>
        <input type="checkbox" checked={selecionadas.includes(t)} onChange={()=>toggle(t)} style={{width:22,height:22,marginTop:1}} />
        <span>{t}</span>
      </label>)}
    </div>

    <div style={styles.card}>
      <label><strong>Data</strong><input style={styles.input} type="date" value={data} max={hoje()} onChange={e=>setData(e.target.value)} /></label>
      <label style={{display:"block",marginTop:8}}><strong>Responsável</strong><input style={styles.input} value={responsavel} onChange={e=>setResponsavel(e.target.value)} placeholder="Nome" /></label>
      <button type="button" style={{...styles.button,width:"100%",marginTop:12}} disabled={aGuardar} onClick={guardar}>{aGuardar?"A guardar…":"✅ Guardar higienização"}</button>
    </div>
  </>;
}

export function SobremesasEquipa() {
  const [f,setF]=useState({identificacao:"",data_preparacao:hoje(),validade:"",quantidade:"",stock:"",responsavel:""});
  const [aGuardar,setAGuardar]=useState(false);
  const n=v=>v===""?null:Number(String(v).replace(",","."));

  async function guardar(e){
    e.preventDefault();
    if(!f.identificacao.trim()) return alert("Indica a sobremesa.");
    if(!f.data_preparacao || f.data_preparacao>hoje()) return alert("Confirma a data de preparação.");
    if(!f.validade || f.validade<f.data_preparacao) return alert("Confirma a validade.");
    if(!f.responsavel.trim()) return alert("Indica o responsável.");
    setAGuardar(true);
    const {error}=await supabase.rpc("equipa_registar_sobremesa",{
      p_identificacao:f.identificacao.trim(),
      p_data_preparacao:f.data_preparacao,
      p_validade:f.validade,
      p_quantidade_unidades:n(f.quantidade),
      p_stock:n(f.stock),
      p_responsavel:f.responsavel.trim()
    });
    setAGuardar(false);
    if(error) return alert("Não foi possível guardar a rastreabilidade.");
    setF({identificacao:"",data_preparacao:hoje(),validade:"",quantidade:"",stock:"",responsavel:f.responsavel});
    alert("Rastreabilidade da sobremesa registada.");
  }

  return <div style={styles.card}>
    <h3 style={{marginTop:0}}>🍰 Rastreabilidade das sobremesas</h3>
    <form onSubmit={guardar}>
      <label><strong>Identificação</strong><input style={styles.input} value={f.identificacao} onChange={e=>setF(p=>({...p,identificacao:e.target.value}))} placeholder="Ex.: Pudim, Mousse de chocolate…" /></label>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
        <label><strong>Data de preparação</strong><input style={styles.input} type="date" max={hoje()} value={f.data_preparacao} onChange={e=>setF(p=>({...p,data_preparacao:e.target.value}))} /></label>
        <label><strong>Validade</strong><input style={styles.input} type="date" min={f.data_preparacao||undefined} value={f.validade} onChange={e=>setF(p=>({...p,validade:e.target.value}))} /></label>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
        <label><strong>Quantidade (unidades)</strong><input style={styles.input} inputMode="decimal" value={f.quantidade} onChange={e=>setF(p=>({...p,quantidade:e.target.value}))} /></label>
        <label><strong>Stock</strong><input style={styles.input} inputMode="decimal" value={f.stock} onChange={e=>setF(p=>({...p,stock:e.target.value}))} /></label>
      </div>
      <label style={{display:"block",marginTop:8}}><strong>Responsável</strong><input style={styles.input} value={f.responsavel} onChange={e=>setF(p=>({...p,responsavel:e.target.value}))} placeholder="Nome" /></label>
      <button style={{...styles.button,width:"100%",marginTop:12}} disabled={aGuardar}>{aGuardar?"A guardar…":"✅ Guardar sobremesa"}</button>
    </form>
  </div>;
}
