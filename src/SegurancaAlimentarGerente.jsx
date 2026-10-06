import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const styles = {
  card: { border: "1px solid #dfe5da", borderRadius: 18, padding: 18, marginBottom: 14, background: "rgba(255,255,255,.94)", boxShadow: "0 6px 18px rgba(49,67,42,.055)" },
  button: { minHeight: 42, padding: "8px 13px", border: "1px solid #536b45", borderRadius: 11, background: "linear-gradient(135deg, #5d774d, #49633d)", color: "white", fontSize: 14, fontWeight: 750, cursor: "pointer" },
  secondary: { background: "white", color: "#34452d", borderColor: "#dce3d7" },
  table: { width: "100%", borderCollapse: "collapse", marginTop: 8 },
  th: { textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px 6px", whiteSpace: "nowrap" },
  td: { padding: "8px 6px", borderBottom: "1px solid #f0f0f0", whiteSpace: "nowrap" }
};

function dataHora(v) {
  if (!v) return "—";
  const d = new Date(v);
  return `${d.toLocaleDateString("pt-PT")} ${d.toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"})}`;
}
function labelMomento(v) {
  return ({ inicio:"Início", intermedio:"Intermédio", fim:"Fim" })[v] || v;
}
function labelClass(v) {
  return ({ bom:"BOM", medio:"MÉDIO", mau:"MAU", muito_mau:"MUITO MAU" })[v] || v;
}

export default function SegurancaAlimentarGerente() {
  const [tab,setTab]=useState("frio");
  const [frio,setFrio]=useState([]);
  const [setorFrio,setSetorFrio]=useState("cozinha");
  const [quente,setQuente]=useState([]);
  const [oleos,setOleos]=useState([]);
  const [aAtualizar,setAAtualizar]=useState(false);
  const [erro,setErro]=useState("");

  useEffect(()=>{ carregar(); },[]);
  async function carregar(){
    setAAtualizar(true);
    setErro("");
    const [f,q,o]=await Promise.all([
      supabase.rpc("gerente_listar_registos_temperatura"),
      supabase.from("registos_manutencao_quente").select("*").order("registado_em",{ascending:false}).limit(300),
      supabase.from("registos_oleo_fritura").select("*").order("registado_em",{ascending:false}).limit(300)
    ]);

    if(f.error || q.error || o.error){
      console.error(f.error || q.error || o.error);
      setErro("Não foi possível carregar todos os registos de temperatura.");
    }

    if(!f.error) setFrio(f.data||[]);
    if(!q.error) setQuente(q.data||[]);
    if(!o.error) setOleos(o.data||[]);
    setAAtualizar(false);
  }

  async function eliminarRegisto(tipo,id,descricao){
    if(!window.confirm(`Eliminar este registo?\n\n${descricao}\n\nEsta ação não pode ser anulada.`)) return;
    const {error}=await supabase.rpc("gerente_eliminar_registo_temperatura",{p_tipo:tipo,p_id:id});
    if(error){
      console.error(error);
      alert(`Não foi possível eliminar o registo. ${error.message||""}`.trim());
      return;
    }
    await carregar();
  }

  function exportarSelfPDF(){
    const doc=new jsPDF({orientation:"landscape"});
    doc.setFontSize(16);
    doc.text("Cozinha de Tacho - Registo de Temperaturas do Self / Banho-Maria",14,16);
    doc.setFontSize(10);
    doc.text("Referencias: Banho-Maria 80-90 C | Interior do alimento >= 65 C",14,23);

    const rows=quente.map(r=>[
      dataHora(r.registado_em),
      `Self ${r.equipamento_num}`,
      r.refeicao==="manha"?"Manhã":r.refeicao==="tarde"?"Tarde":r.refeicao,
      labelMomento(r.momento),
      r.temperatura_alimento===null?"—":`${Number(r.temperatura_alimento)} C`,
      r.temperatura_equipamento===null?"—":`${Number(r.temperatura_equipamento)} C`,
      r.responsavel||""
    ]);

    autoTable(doc,{
      startY:29,
      head:[["Data/Hora","Self","Período","Momento","Alimento","Banho-Maria","Responsável"]],
      body:rows,
      styles:{fontSize:9,cellPadding:3},
      headStyles:{fontStyle:"bold"}
    });
    doc.save("registo-self-banho-maria.pdf");
  }

  function exportarOleosPDF(){
    const doc=new jsPDF({orientation:"landscape"});
    doc.setFontSize(16);
    doc.text("Cozinha de Tacho - Registo de Controlo dos Oleos de Fritura",14,16);
    doc.setFontSize(10);
    doc.text("Temperatura <= 180 C | Rejeitar nos resultados MAU e MUITO MAU",14,23);

    const rows=oleos.map(r=>[
      dataHora(r.registado_em),
      `Fritadeira ${r.fritadeira_num}`,
      labelClass(r.classificacao),
      r.temperatura===null?"—":`${Number(r.temperatura)} C`,
      r.substituicao?"Sim":"Não",
      r.responsavel||""
    ]);

    autoTable(doc,{
      startY:29,
      head:[["Data/Hora","Fritadeira","Resultado","Temperatura","Substituição","Responsável"]],
      body:rows,
      styles:{fontSize:9,cellPadding:3},
      headStyles:{fontStyle:"bold"}
    });
    doc.save("registo-oleos-fritura.pdf");
  }

  return <div style={styles.card}>
    <h3 style={{marginTop:0}}>🧪 Registos HACCP</h3>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
      <button type="button" style={{...styles.button,...(tab==="frio"?{}:styles.secondary)}} onClick={()=>setTab("frio")}>🌡️ Equipamentos</button>
      <button type="button" style={{...styles.button,...(tab==="quente"?{}:styles.secondary)}} onClick={()=>setTab("quente")}>♨️ Self / Banho-Maria</button>
      <button type="button" style={{...styles.button,...(tab==="oleos"?{}:styles.secondary)}} onClick={()=>setTab("oleos")}>🍟 Óleos de fritura</button>
    </div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:12}}>
      {erro ? <span style={{color:"#b42318",fontWeight:700}}>{erro}</span> : <span style={{opacity:.7}}>Registos atualizados diretamente da base de dados.</span>}
      <button type="button" style={{...styles.button,...styles.secondary}} onClick={carregar} disabled={aAtualizar}>
        {aAtualizar?"A atualizar…":"↻ Atualizar registos"}
      </button>
    </div>

    {tab==="frio" && <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
        <button type="button" style={{...styles.button,...(setorFrio==="cozinha"?{}:styles.secondary)}} onClick={()=>setSetorFrio("cozinha")}>🍳 Cozinha</button>
        <button type="button" style={{...styles.button,...(setorFrio==="atendimento"?{}:styles.secondary)}} onClick={()=>setSetorFrio("atendimento")}>🛎️ Atendimento</button>
      </div>
      <p style={{opacity:.75,margin:"0 0 10px"}}>
        {frio.filter(r=>r.setor===setorFrio).length} registo(s) nesta área.
      </p>
      <div style={{overflowX:"auto"}}>
        <table style={styles.table}>
          <thead><tr>
            <th style={styles.th}>Data/Hora</th>
            <th style={styles.th}>Momento</th>
            <th style={styles.th}>Equipamento</th>
            <th style={styles.th}>Temperatura</th>
            <th style={styles.th}>Responsável</th>
            <th style={styles.th}>Ações</th>
          </tr></thead>
          <tbody>
            {frio.filter(r=>r.setor===setorFrio).map(r=><tr key={r.id}>
              <td style={styles.td}>{dataHora(r.registado_em)}</td>
              <td style={styles.td}>{r.momento==="inicio"?"Início":r.momento==="fim"?"Fim":"—"}</td>
              <td style={styles.td}>{r.equipamento_nome}</td>
              <td style={styles.td}>{Number(r.temperatura).toLocaleString("pt-PT",{maximumFractionDigits:1})} °C</td>
              <td style={styles.td}>{r.responsavel||"—"}</td>
              <td style={styles.td}>
                <button
                  type="button"
                  style={{...styles.button,...styles.secondary,minHeight:34,padding:"5px 9px"}}
                  onClick={()=>eliminarRegisto("equipamento",r.id,`${r.equipamento_nome} · ${Number(r.temperatura).toLocaleString("pt-PT",{maximumFractionDigits:1})} °C · ${dataHora(r.registado_em)}`)}
                >
                  🗑️ Eliminar
                </button>
              </td>
            </tr>)}
            {!frio.filter(r=>r.setor===setorFrio).length&&<tr><td style={styles.td} colSpan={6}>Ainda não existem registos nesta área.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>}

    {tab==="quente" && <div>
      <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <p style={{opacity:.75,margin:"0 0 10px"}}>Referências: equipamento 80–90 °C · interior do alimento ≥65 °C.</p>
        <button type="button" style={styles.button} onClick={exportarSelfPDF}>📄 Gerar PDF</button>
      </div>
      <div style={{overflowX:"auto"}}>
      <table style={styles.table}>
        <thead><tr>
          <th style={styles.th}>Data/Hora</th><th style={styles.th}>Self</th><th style={styles.th}>Período</th><th style={styles.th}>Momento</th>
          <th style={styles.th}>Alimento</th><th style={styles.th}>Equip.</th><th style={styles.th}>Responsável</th><th style={styles.th}>Ações</th>
        </tr></thead>
        <tbody>
          {quente.map(r=>{
            const ali=r.temperatura_alimento===null?null:Number(r.temperatura_alimento);
            const eq=r.temperatura_equipamento===null?null:Number(r.temperatura_equipamento);
            const foraAli=ali!==null&&ali<65;
            const foraEq=eq!==null&&(eq<80||eq>90);
            return <tr key={r.id} style={(foraAli||foraEq)?{background:"#fff1f0"}:{}}>
              <td style={styles.td}>{dataHora(r.registado_em)}</td>
              <td style={styles.td}>N.º {r.equipamento_num}</td>
              <td style={styles.td}>{r.refeicao==="manha"?"Manhã":r.refeicao==="tarde"?"Tarde":r.refeicao}</td>
              <td style={styles.td}>{labelMomento(r.momento)}</td>
              <td style={{...styles.td,...(foraAli?{color:"#b42318",fontWeight:700}:{})}}>{ali===null?"—":`${ali} °C`}</td>
              <td style={{...styles.td,...(foraEq?{color:"#b42318",fontWeight:700}:{})}}>{eq===null?"—":`${eq} °C`}</td>
              <td style={styles.td}>{r.responsavel}</td>
              <td style={styles.td}>
                <button
                  type="button"
                  style={{...styles.button,...styles.secondary,minHeight:34,padding:"5px 9px"}}
                  onClick={()=>eliminarRegisto("self",r.id,`Self ${r.equipamento_num} · ${r.refeicao==="manha"?"Manhã":"Tarde"} · ${labelMomento(r.momento)} · ${dataHora(r.registado_em)}`)}
                >
                  🗑️ Eliminar
                </button>
              </td>
            </tr>;
          })}
          {!quente.length&&<tr><td style={styles.td} colSpan={8}>Ainda não existem registos.</td></tr>}
        </tbody>
      </table>
      </div>
    </div>}

    {tab==="oleos" && <div>
      <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <p style={{opacity:.75,margin:"0 0 10px"}}>Rejeitar nos resultados MAU e MUITO MAU · temperatura ≤180 °C.</p>
        <button type="button" style={styles.button} onClick={exportarOleosPDF}>📄 Gerar PDF</button>
      </div>
      <div style={{overflowX:"auto"}}>
      <table style={styles.table}>
        <thead><tr>
          <th style={styles.th}>Data/Hora</th><th style={styles.th}>Fritadeira</th><th style={styles.th}>Teste</th>
          <th style={styles.th}>Temperatura</th><th style={styles.th}>Substituição</th><th style={styles.th}>Responsável</th><th style={styles.th}>Ações</th>
        </tr></thead>
        <tbody>
          {oleos.map(r=>{
            const t=r.temperatura===null?null:Number(r.temperatura);
            const rejeitar=r.classificacao==="mau"||r.classificacao==="muito_mau";
            const quenteDemais=t!==null&&t>180;
            return <tr key={r.id} style={(rejeitar||quenteDemais)?{background:"#fff1f0"}:{}}>
              <td style={styles.td}>{dataHora(r.registado_em)}</td>
              <td style={styles.td}>N.º {r.fritadeira_num}</td>
              <td style={{...styles.td,...(rejeitar?{color:"#b42318",fontWeight:700}:{})}}>{labelClass(r.classificacao)}</td>
              <td style={{...styles.td,...(quenteDemais?{color:"#b42318",fontWeight:700}:{})}}>{t===null?"—":`${t} °C`}</td>
              <td style={styles.td}>{r.substituicao?"Sim":"Não"}</td>
              <td style={styles.td}>{r.responsavel}</td>
              <td style={styles.td}>
                <button
                  type="button"
                  style={{...styles.button,...styles.secondary,minHeight:34,padding:"5px 9px"}}
                  onClick={()=>eliminarRegisto("oleo",r.id,`Fritadeira ${r.fritadeira_num} · ${labelClass(r.classificacao)} · ${dataHora(r.registado_em)}`)}
                >
                  🗑️ Eliminar
                </button>
              </td>
            </tr>;
          })}
          {!oleos.length&&<tr><td style={styles.td} colSpan={7}>Ainda não existem registos.</td></tr>}
        </tbody>
      </table>
      </div>
    </div>}
  </div>;
}
