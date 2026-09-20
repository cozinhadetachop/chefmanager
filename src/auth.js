import { supabase } from "./supabaseClient";

export const PERFIS = {
  gerente: {
    id: "gerente",
    nome: "Gerente",
    email: "gerente@cozinhadetacho.app",
    icone: "👔"
  },
  equipa: {
    id: "equipa",
    nome: "Equipa",
    email: "equipa@cozinhadetacho.app",
    icone: "👥"
  },
  chef: {
    id: "chef",
    nome: "Chef Cozinha",
    email: "chef@cozinhadetacho.app",
    icone: "👨‍🍳"
  }
};

const PASSWORD_PREFIX = "CdT!";

export function perfilDaSessao(session) {
  const email = session?.user?.email?.toLowerCase();
  return Object.values(PERFIS).find(perfil => perfil.email === email)?.id || null;
}

export async function entrarComPin(perfilId, pin) {
  const perfil = PERFIS[perfilId];
  if (!perfil || !/^\d{4}$/.test(pin)) {
    return { error: new Error("O PIN deve ter quatro algarismos.") };
  }

  return supabase.auth.signInWithPassword({
    email: perfil.email,
    password: `${PASSWORD_PREFIX}${pin}`
  });
}

export async function terminarSessao() {
  return supabase.auth.signOut();
}
