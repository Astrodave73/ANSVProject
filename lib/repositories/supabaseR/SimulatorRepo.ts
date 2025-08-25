import { supabase } from "../../supabase/client";
import { ISimulatorRepo } from "../ISimulatorRepo";

function sb() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

export class SimulatorRepo implements ISimulatorRepo {
  async exists(simulator_id: number): Promise<boolean> {
    const { data, error } = await sb()
      .from("simulator_table")
      .select("id")
      .eq("id", simulator_id)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  }
}
