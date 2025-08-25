// lib/services/EventService.ts
import { EventRepo } from "@/lib/repositories/IEventRepo";
import { CreateEventInput, Event } from "@/lib/domain/types";
import { ValidationError } from "@/lib/domain/errors";
import { getSupabase } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils";

export class EventService {
  constructor(private events: EventRepo) {}

  async create(
    input: CreateEventInput & { name?: string | null }
  ): Promise<Event> {
    if (!input.department_id || !input.municipality_id) {
      throw new ValidationError(
        "department_id y municipality_id son obligatorios"
      );
    }

    const sb = getSupabase();
    const event_date =
      input.event_date ?? new Date().toISOString().slice(0, 10);

    // 1) Traer nombres de dpto y municipio (para default)
    const [{ data: d }, { data: m }] = await Promise.all([
      sb
        .from("departments_table")
        .select("name")
        .eq("id", input.department_id)
        .single(),
      sb
        .from("municipalities_table")
        .select("name")
        .eq("id", input.municipality_id)
        .single(),
    ]);
    const deptName = d?.name ?? `dept-${input.department_id}`;
    const muniName = m?.name ?? `muni-${input.municipality_id}`;

    // 2) Contador global (total de eventos + 1)
    const { count: total } = await sb
      .from("events_table")
      .select("id", { count: "exact", head: true });
    const seq = (total ?? 0) + 1;

    // 3) Base del nombre:
    //    - si el usuario no mandó nombre -> "jorna-{dept}-{muni}"
    //    - si mandó -> se usa su base pero se normaliza (slugify)
    const base =
      input.name && input.name.trim().length > 0
        ? slugify(input.name)
        : `jorna-${slugify(deptName)}-${slugify(muniName)}`;

    // 4) Nombre final SIEMPRE termina con el contador global
    const finalName = `${base}-${seq}`;

    // 5) Insertar
    const payload: any = {
      department_id: input.department_id,
      municipality_id: input.municipality_id,
      event_date,
      name: finalName,
    };

    // Puedes usar tu EventRepo o insertar directo
    const { data, error } = await sb
      .from("events_table")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    return data as Event;
  }
}
