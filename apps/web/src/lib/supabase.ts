import { createClient } from "@supabase/supabase-js";

// Limpa espaços/quebras e qualquer caractere fora do alfabeto de um JWT. Isso
// evita o erro "headers ... non ISO-8859-1 code point" quando a variável de
// ambiente vem com algum caractere invisível colado por engano.
const url = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "")
  .trim()
  .replace(/[^A-Za-z0-9._-]/g, "");

export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  console.warn(
    "[supabase] Sem VITE_SUPABASE_URL/ANON_KEY — rodando em modo dev sem login.",
  );
}

// Placeholders válidos evitam que createClient lance erro quando o Supabase
// ainda não foi configurado (modo dev). Nenhuma chamada de rede é feita.
export const supabase = createClient(
  url || "http://localhost:54321",
  anonKey || "dev-anon-placeholder-key",
  {
    auth: {
      persistSession: isSupabaseConfigured,
      autoRefreshToken: isSupabaseConfigured,
    },
  },
);
