// lib/repositories/supabaseR/AttendanceRepo.ts
import { supabase } from "@/lib/supabase/client";
import type { Attendance, ID } from "@/lib/domain/types";
import { IAttendanceRepo } from "../IAttendanceRepo";

function sb() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

export class AttendanceRepo implements IAttendanceRepo {
  /**
   * Inserta 1 vez por (user_id, simulator_id).
   * Si ya existía (UNIQUE), devuelve la fila existente con created=false.
   */
  async insertOnce(
    user_id: ID,
    simulator_id: number,
    event_id: ID
  ): Promise<{ created: boolean; row: Attendance }> {
    const { data, error } = await sb()
      .from("simulator_attendance")
      .insert({ user_id, simulator_id, event_id, source: "qr" })
      .select("id, user_id, simulator_id, event_id, attended_at")
      .single();

    if (!error && data) return { created: true, row: data as Attendance };

    const msg = String(error?.message ?? "");
    const code = (error as any)?.code;
    const isUnique =
      code === "23505" ||
      msg.includes("duplicate key") ||
      msg.includes("uniq_user_simulator_once");

    if (isUnique) {
      const { data: existed, error: selErr } = await sb()
        .from("simulator_attendance")
        .select("id, user_id, simulator_id, event_id, attended_at")
        .eq("user_id", user_id)
        .eq("simulator_id", simulator_id)
        .single();
      if (selErr) throw selErr;
      return { created: false, row: existed as Attendance };
    }

    throw error!;
  }

  /** ¿Alguna vez hizo este simulador? (vida del programa, no solo hoy) */
  async hasUserEverDoneSimulator(
    user_id: ID,
    simulator_id: number
  ): Promise<boolean> {
    const { count, error } = await sb()
      .from("simulator_attendance")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user_id)
      .eq("simulator_id", simulator_id);

    if (error) throw error;
    return (count ?? 0) > 0;
  }

  /** ¿Lo hizo hoy? (si necesitas la validación “por día”) */
  async hasUserDoneSimulatorToday(
    user_id: ID,
    simulator_id: number
  ): Promise<boolean> {
    const today = new Date();
    const yyyy = today.getUTCFullYear();
    const mm = String(today.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(today.getUTCDate()).padStart(2, "0");
    const start = `${yyyy}-${mm}-${dd}T00:00:00.000Z`;
    const endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const yyyy2 = endDate.getUTCFullYear();
    const mm2 = String(endDate.getUTCMonth() + 1).padStart(2, "0");
    const dd2 = String(endDate.getUTCDate()).padStart(2, "0");
    const end = `${yyyy2}-${mm2}-${dd2}T00:00:00.000Z`;

    const { data, error } = await sb()
      .from("simulator_attendance")
      .select("id")
      .eq("user_id", user_id)
      .eq("simulator_id", simulator_id)
      .gte("attended_at", start)
      .lt("attended_at", end)
      .limit(1);

    if (error) throw error;
    return !!(data && data.length);
  }
}
