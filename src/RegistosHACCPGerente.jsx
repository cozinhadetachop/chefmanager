import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const styles = {
  card: { border: "1px solid #dfe5da", borderRadius: 18, padding: 18, marginBottom: 14, background: "rgba(255,255,255,.94)", boxShadow: "0 6px 18px rgba(49,67,42,.055)" },
  button: { minHeight: 42, padding: "8px 13px", border: "1px solid #536b45", borderRadius: 11, background: "linear-gradient(135deg, #5d774d, #49633d)", color: "white", fontSize: 14, fontWeight: 750, cursor: "pointer" },
  secondary: { background: "white", color: "#34452d", borderColor: "#dce3d7" },
  input: { minHeight: 42, padding: "8px 10px", border: "1px solid #dce3d7", borderRadius: 10, background: "white", fontSize: 14 },
  table: { width: "100%", borderCollapse: "collapse", marginTop: 8 },
  th: { textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px 6px", whiteSpace: "nowrap" },
  td: { padding: "8px 6px", borderBottom: "1px solid #f0f0f0", verticalAlign: "top" }
};

function labelArea(v){ return v==="cozinha"?"Cozinha / Copa / Despensa":"Balcão / Linha / Sala"; }
function labelFreq(v){ return ({diario:"Diário / Quando utilizado",semanal:"Semanal",mensal:"Mensal"})[v]||v; }

export default function RegistosHACCPGerente(){
  const [tab,setTab]=useState("higiene");
  const [higiene,setHigiene]=useState([]);
  const [sobremesas,setSobremesas]=useState([]);
  const [area,setArea]=useState("");
  const [freq,setFreq]=useState("");
  const [data,setData]=useState("");

  useEffect(()=>{ carregar(); },[]);
  async function carregar(){
    const [h,s]=await Promise.all([
      supabase.from("registos_higienizacao").select("*").order("data",{ascending:false}).order("criado_em",{ascending:false}).limit(500),
      supabase.from("rastreabilidade_sobremesas").select("*").order("data_preparacao",{ascending:false}).order("criado_em",{ascending:false}).limit(300)
    ]);
    if(!h.error) setHigiene(h.data||[]);
    if(!s.error) setSobremesas(s.data||[]);
  }

  const higieneFiltrada=useMemo(()=>higiene.filter(r=>
    (!area||r.area===area)&&(!freq||r.frequencia===freq)&&(!data||r.data===data)
  ),[higiene,area,freq,data]);

  return <div style={styles.card}>
    <h3 style={{marginTop:0}}>📋 Registos HACCP</h3>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
      <button type="button" style={{...styles.button,...(tab==="higiene"?{}:styles.secondary)}} onClick={()=>setTab("higiene")}>🧼 Higienização</button>
      <button type="button" style={{...styles.button,...(tab==="sobremesas"?{}:styles.secondary)}} onClick={()=>setTab("sobremesas")}>🍰 Sobremesas</button>
    </div>

    {tab==="higiene" && <>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8,marginBottom:10}}>
        <select style={styles.input} value={area} onChange={e=>setArea(e.target.value)}>
          <option value="">Todas as áreas</option><option value="cozinha">Cozinha / Copa / Despensa</option><option value="balcao">Balcão / Linha / Sala</option>
        </select>
        <select style={styles.input} value={freq} onChange={e=>setFreq(e.target.value)}>
          <option value="">Todas as frequências</option><option value="diario">Diário / Quando utilizado</option><option value="semanal">Semanal</option><option value="mensal">Mensal</option>
        </select>
        <input style={styles.input} type="date" value={data} onChange={e=>setData(e.target.value)} />
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={styles.table}>
          <thead><tr><th style={styles.th}>Data</th><th style={styles.th}>Área</th><th style={styles.th}>Frequência</th><th style={styles.th}>Tarefa</th><th style={styles.th}>Responsável</th></tr></thead>
          <tbody>
            {higieneFiltrada.map(r=><tr key={r.id}>
              <td style={styles.td}>{new Date(r.data+"T00:00:00").toLocaleDateString("pt-PT")}</td>
              <td style={styles.td}>{labelArea(r.area)}</td>
              <td style={styles.td}>{labelFreq(r.frequencia)}</td>
              <td style={styles.td}>{r.tarefa}</td>
              <td style={styles.td}>{r.responsavel}</td>
            </tr>)}
            {!higieneFiltrada.length&&<tr><td style={styles.td} colSpan={5}>Ainda não existem registos com estes filtros.</td></tr>}
          </tbody>
        </table>
      </div>
    </>}

    {tab==="sobremesas" && <div style={{overflowX:"auto"}}>
      <table style={styles.table}>
        <thead><tr>
          <th style={styles.th}>Identificação</th><th style={styles.th}>Preparação</th><th style={styles.th}>Validade</th>
          <th style={styles.th}>Quantidade</th><th style={styles.th}>Stock</th><th style={styles.th}>Responsável</th>
        </tr></thead>
        <tbody>
          {sobremesas.map(r=><tr key={r.id}>
            <td style={styles.td}>{r.identificacao}</td>
            <td style={styles.td}>{new Date(r.data_preparacao+"T00:00:00").toLocaleDateString("pt-PT")}</td>
            <td style={styles.td}>{new Date(r.validade+"T00:00:00").toLocaleDateString("pt-PT")}</td>
            <td style={styles.td}>{r.quantidade_unidades??"—"}</td>
            <td style={styles.td}>{r.stock??"—"}</td>
            <td style={styles.td}>{r.responsavel}</td>
          </tr>)}
          {!sobremesas.length&&<tr><td style={styles.td} colSpan={6}>Ainda não existem registos.</td></tr>}
        </tbody>
      </table>
    </div>}
  </div>;
}
