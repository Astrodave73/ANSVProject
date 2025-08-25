// lib/repositories/supabaseR/SimulatorRepo.ts
import { supabase } from "@/lib/supabase/client";

function sb() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

export class SimulatorRepo {
  /** Valida que el simulador exista en simulator_table */
  async exists(id: number): Promise<boolean> {
    const { data, error } = await sb()
      .from("simulator_table")
      .select("id")
      .eq("id", id)
      .single();

    // PGRST116 = no rows
    if ((error as any)?.code === "PGRST116") return false;
    if (error) throw error;
    return !!data;
  }

  /** (Opcional) Listado para UI */
  async list(): Promise<Array<{ id: number; name: string }>> {
    const { data, error } = await sb()
      .from("simulator_table")
      .select("id, name")
      .order("id", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Array<{ id: number; name: string }>;
  }
}
