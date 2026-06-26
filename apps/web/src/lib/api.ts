import { supabase } from "./supabase";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
export const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000";
/** true quando aponta para o backend local de desenvolvimento. */
export const IS_LOCAL_API = API_URL.includes("localhost") || API_URL.includes("127.0.0.1");

/** Wrapper de fetch que injeta o JWT do Supabase no header Authorization. */
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  // Em dev a auth é opcional (backend aceita sem token). Se o Supabase estiver
  // configurado e houver sessão, anexamos o JWT.
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }
  } catch {
    // Supabase não configurado — segue sem token (modo dev).
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${detail}`);
  }
  return (await res.json()) as T;
}
