import { useEffect } from "react";
import { supabase } from "./supabaseClient";

export default function TesteSupabase() {
  useEffect(() => {
    async function testeSupabase() {
      const { data, error } = await supabase.from("produtos").select("*");
      if (error) console.log("Erro:", error);
      else console.log("Produtos:", data);
    }
    testeSupabase();
  }, []);

  return (
    <div>
      Teste Supabase — abre o console do navegador (F12) para ver os resultados
    </div>
  );
}
