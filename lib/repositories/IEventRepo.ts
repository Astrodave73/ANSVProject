// lib/repositories/supabaseR/EventRepo.ts
import { supabase } from "@/lib/supabase/client";

function sb() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

export type EventSelectOption = {
  id: number;
  label: string;
  name: string;
  event_date: string;
  department?: string | null;
  municipality?: string | null;
};

export class EventRepo {
  async listEventsForSelect(limit = 100): Promise<EventSelectOption[]> {
    const query = sb()
      .from("events_table")
      .select(
        `
        id,
        name,
        event_date,
        created_at,
        departments:departments_table!events_table_department_id_fkey ( name ),
        municipalities:municipalities_table!events_table_municipality_id_fkey ( name )
      `
      )
      .order("event_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    // Si tu typegen no entiende el alias/!fk, castea el builder a any
    const { data, error } = await (query as any);
    if (error) throw error;

    // Soporta objeto o arreglo (según cómo venga del API)
    type Raw = {
      id: number;
      name: string | null;
      event_date: string;
      created_at: string;
      departments: { name: string } | { name: string }[] | null;
      municipalities: { name: string } | { name: string }[] | null;
    };

    const rows = (data ?? []) as Raw[];

    return rows.map((r) => {
      const depName = Array.isArray(r.departments)
        ? r.departments[0]?.name ?? null
        : r.departments?.name ?? null;

      const munName = Array.isArray(r.municipalities)
        ? r.municipalities[0]?.name ?? null
        : r.municipalities?.name ?? null;

      const parts = [
        r.name ?? "(sin nombre)",
        depName && `· ${depName}`,
        munName && `· ${munName}`,
        r.event_date && `· ${r.event_date}`,
      ].filter(Boolean);

      return {
        id: r.id,
        label: parts.join(" "),
        name: r.name ?? "",
        event_date: r.event_date,
        department: depName,
        municipality: munName,
      };
    });
  }
}
