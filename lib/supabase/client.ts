// lib/supabase/client.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
if (!url || !anon) throw new Error("Missing Supabase env vars");

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) _client = createClient(url, anon);
  return _client;
}

/** (Opcional) exporta también un singleton por comodidad */
export const supabase = getSupabase();
