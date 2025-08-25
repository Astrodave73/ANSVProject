import { supabase } from "../../supabase/client";
import type { ID } from "../../domain/types";

function sb() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

export class EventRepo {
  /** Inserta (event_id,user_id) en event_attendees si no existe */
  async ensureAttendee(event_id: ID, user_id: ID): Promise<void> {
    // Nota: no encadenar .then/.catch; usa await + try/catch para evitar el error TS
    const { error } = await sb()
      .from("event_attendees")
      .insert({ event_id, user_id })
      .select("event_id") // forzar respuesta tipada
      .single();

    if (!error) return;

    const msg = String(error.message ?? "");
    const code = (error as any)?.code;
    const isDup = code === "23505" || msg.includes("duplicate key");
    if (!isDup) throw error;
  }

  /** Devuelve el evento activo hoy del usuario (si existe y es único preferente por created_at desc) */
  async findUserEventToday(user_id: ID, todayYYYYMMDD: string) {
    // 1) Traer todos los event_id donde el user es asistente
    const { data: attends, error: e1 } = await sb()
      .from("event_attendees")
      .select("event_id")
      .eq("user_id", user_id);

    if (e1) throw e1;
    const ids = (attends ?? []).map((r: any) => r.event_id);
    if (ids.length === 0) return null;

    // 2) Filtrar esos eventos por "hoy" y "no bloqueado"
    const { data: events, error: e2 } = await sb()
      .from("events_table")
      .select("id, event_date, locked_at, created_at")
      .in("id", ids)
      .eq("event_date", todayYYYYMMDD)
      .is("locked_at", null)
      .order("created_at", { ascending: false })
      .limit(2); // por seguridad

    if (e2) throw e2;
    if (!events || events.length === 0) return null;
    // si hay más de 1, tomamos el más reciente determinísticamente
    return events[0];
  }

  /** Si hay EXACTAMENTE 1 evento activo hoy, lo devuelve. Si 0 o >1, retorna null. */
  async findUniqueActiveEventToday(todayYYYYMMDD: string) {
    const { data, error } = await sb()
      .from("events_table")
      .select("id, event_date, locked_at, created_at")
      .eq("event_date", todayYYYYMMDD)
      .is("locked_at", null)
      .order("created_at", { ascending: false })
      .limit(2);
    if (error) throw error;
    if (!data || data.length !== 1) return null;
    return data[0];
  }

  /** Regla completa para el escaneo sin acompañamiento */
  async pickEventForScan(user_id: ID, todayYYYYMMDD: string) {
    // 1) evento de hoy del usuario
    const userEvt = await this.findUserEventToday(user_id, todayYYYYMMDD);
    if (userEvt) return { event: userEvt, source: "user_today" as const };

    // 2) único evento activo hoy
    const uniqueEvt = await this.findUniqueActiveEventToday(todayYYYYMMDD);
    if (uniqueEvt) {
      // lo inscribimos automáticamente y usamos ese
      await this.ensureAttendee(uniqueEvt.id, user_id);
      return { event: uniqueEvt, source: "unique_today" as const };
    }

    // 3) no se puede decidir
    return { event: null, source: "none" as const };
  }
}
