import { supabase } from "../supabaseClient";

export async function getProdutos() {
  const { data, error } = await supabase
    .from("produtos")
    .select("*");

  if (error) throw error;
  return data;
}

export async function addProduto(produto) {
  const { data, error } = await supabase
    .from("produtos")
    .insert([produto]);

  if (error) throw error;
  return data;
}

export async function updateProduto(id, updates) {
  const { data, error } = await supabase
    .from("produtos")
    .update(updates)
    .eq("id", id);

  if (error) throw error;
  return data;
}

export async function deleteProduto(id) {
  const { data, error } = await supabase
    .from("produtos")
    .delete()
    .eq("id", id);

  if (e

