import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// —— Helpers ——
function pickName(maybeArrOrObj: any): string {
  if (!maybeArrOrObj) return "";
  if (Array.isArray(maybeArrOrObj)) return maybeArrOrObj[0]?.name ?? "";
  return maybeArrOrObj?.name ?? "";
}

const ROAD_USER_LABEL: Record<number, string> = {
  1: "Peatón",
  2: "Ciclista",
  3: "Conductor",
};

function toSexo(genderName?: string | null): string {
  if (!genderName) return "";
  const n = String(genderName).toLowerCase();
  if (n.startsWith("mas")) return "Masculino";
  if (n.startsWith("fem")) return "Femenino";
  return "";
}

function resultadoLabel(v: any): string {
  if (v === 1 || v === "1") return "Logrado";
  if (v === 0 || v === "0") return "Fallido";
  return "";
}

/**
 * Etiquetas de métricas por simulador (rellena aquí tu catálogo real).
 * Estructura: METRIC_LABELS[simulator_id][metric_id] = "Nombre/Categoría";
 */
const METRIC_LABELS: Record<number, Record<number, string>> = {
  // Ejemplos: completa con tus reales
  1: { 1: "Tiempo de reacción", 2: "Frenado", 3: "Conos", 4: "Señales" },
  2: {
    5: "Distracción",
    6: "Alcohol",
    7: "Cinturón",
    8: "Velocidad",
    9: "Distancia",
  },
  // 3: { ... }
};

function metricName(simId?: number | null, metricId?: number | null) {
  if (simId == null || metricId == null) return "";
  return METRIC_LABELS[simId]?.[metricId] ?? "";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const departmentIds: number[] = body?.departmentIds ?? [];
    const municipalityIds: number[] = body?.municipalityIds ?? [];
    const eventIdsFilter: number[] = body?.eventIds ?? [];

    // 1) Eventos filtrados
    let evQuery = supabase
      .from("events_table")
      .select(
        `
        id, event_date, name, department_id, municipality_id,
        departments_table(name),
        municipalities_table(name)
      `
      )
      .order("event_date", { ascending: false });

    if (departmentIds.length)
      evQuery = evQuery.in("department_id", departmentIds);
    if (municipalityIds.length)
      evQuery = evQuery.in("municipality_id", municipalityIds);
    if (eventIdsFilter.length) evQuery = evQuery.in("id", eventIdsFilter);

    const { data: evData, error: evErr } = await evQuery;
    if (evErr) throw evErr;

    const events = (evData ?? []).map((e: any) => ({
      id: e.id as number,
      event_date: e.event_date as string,
      name: (e.name ?? null) as string | null,
      deptName: pickName(e.departments_table),
      muniName: pickName(e.municipalities_table),
    }));

    const eventIds = events.map((e) => e.id);
    if (!eventIds.length) {
      const headerEs = [
        "ID de evento",
        "Fecha del evento",
        "Nombre del evento",
        "Departamento",
        "Municipio",
        "ID de usuario",
        "Documento",
        "Nombre",
        "Apellido",
        "Sexo",
        "Fecha de nacimiento",
        "Empresa",
        "ARL",
        "Teléfono",
        "Correo electrónico",
        "Tipo de usuario vial",
        "Licencia: expedición",
        "Licencia: vencimiento",
        "Licencia: categorías",
        "Licencia: restricciones",
        "ID simulador",
        "Simulador",
        "Fecha de asistencia",
        "Fuente asistencia",
        "ID métrica",
        "Ítem (simulador)",
        "Nombre/Categoría de la métrica",
        "Fecha de medición",
        "Resultado",
      ];
      const ws = XLSX.utils.aoa_to_sheet([headerEs]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Datos");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      return new Response(buf, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="export-ansv.xlsx"`,
        },
      });
    }

    const eventById = new Map<number, (typeof events)[number]>();
    for (const e of events) eventById.set(e.id, e);

    // 2) Uploads (para mapear métricas -> evento/simulador)
    const { data: muData, error: muErr } = await supabase
      .from("metric_uploads")
      .select("id, event_id, simulator_id")
      .in("event_id", eventIds);
    if (muErr) throw muErr;

    const uploadIdToEvent: Record<number, number> = {};
    const uploadIdToSim: Record<number, number | null> = {};
    const uploadIds: number[] = [];

    for (const u of muData ?? []) {
      const id = u.id as number;
      uploadIds.push(id);
      uploadIdToEvent[id] = u.event_id as number;
      uploadIdToSim[id] = (u.simulator_id as number) ?? null;
    }

    // 3) Asistencias por simulador (aunque no haya métricas)
    const { data: attData, error: attErr } = await supabase
      .from("simulator_attendance")
      .select("user_id, event_id, simulator_id, attended_at, source")
      .in("event_id", eventIds);
    if (attErr) throw attErr;
    const attendances = attData ?? [];

    // 4) Métricas
    let mrRows: any[] = [];
    if (uploadIds.length) {
      const { data: mrData, error: mrErr } = await supabase
        .from("metric_rows")
        .select(
          `id, upload_id, simulator_id, user_id, metric_id, result, measured_at`
        )
        .in("upload_id", uploadIds)
        .order("measured_at", { ascending: true });
      if (mrErr) throw mrErr;
      mrRows = mrData ?? [];
    }

    // 5) Usuarios (de asistencias, métricas, y también inscritos al evento)
    const userIds = new Set<number>();
    for (const a of attendances) userIds.add(a.user_id as number);
    for (const r of mrRows) userIds.add(r.user_id as number);

    // + inscritos por evento (para que aparezcan aunque no tengan simuladores)
    const { data: eaData, error: eaErr } = await supabase
      .from("event_attendees")
      .select("event_id, user_id")
      .in("event_id", eventIds);
    if (eaErr) throw eaErr;
    const eventAttendees = eaData ?? [];
    for (const ea of eventAttendees) userIds.add(ea.user_id as number);

    const userIdList = Array.from(userIds);

    // 6) Datos de usuarios
    const usersById = new Map<number, any>();
    if (userIdList.length) {
      const { data: uData, error: uErr } = await supabase
        .from("users_table")
        .select(
          `
          id, doc_number, name, lastname, gender_id, birthdate,
          company_name, arl, phone_number, email, road_user_type
        `
        )
        .in("id", userIdList);
      if (uErr) throw uErr;
      for (const u of uData ?? []) usersById.set(u.id as number, u);
    }

    // 6.1) Genders (para “Sexo”)
    const { data: genders, error: gErr } = await supabase
      .from("gender_table")
      .select("id, name");
    if (gErr) throw gErr;
    const genderNameById = new Map<number, string>();
    for (const g of genders ?? [])
      genderNameById.set(g.id as number, g.name as string);

    // 7) Simuladores
    const { data: simData, error: simErr } = await supabase
      .from("simulator_table")
      .select("id, name");
    if (simErr) throw simErr;
    const simNameById = new Map<number, string>();
    for (const s of simData ?? [])
      simNameById.set(s.id as number, s.name as string);

    // 8) Licencias (categorías, fechas, restricciones)
    const licensesByUser = new Map<
      number,
      {
        issued_at: string;
        expires_at: string;
        restrictions: string;
        categories: string[];
      }[]
    >();
    if (userIdList.length) {
      const { data: licData, error: licErr } = await supabase
        .from("licenses")
        .select(
          `
          id, user_id, issued_at, expires_at, restrictions,
          license_category_links (
            category_id,
            license_categories ( code )
          )
        `
        )
        .in("user_id", userIdList);
      if (licErr) throw licErr;

      for (const L of licData ?? []) {
        const userId = L.user_id as number;
        const cats = (L.license_category_links ?? [])
          .map((lk: any) => lk.license_categories?.code)
          .filter(Boolean);
        const arr = licensesByUser.get(userId) ?? [];
        arr.push({
          issued_at: L.issued_at ?? "",
          expires_at: L.expires_at ?? "",
          restrictions: L.restrictions ?? "",
          categories: cats,
        });
        licensesByUser.set(userId, arr);
      }
    }

    // Índices para evitar perder nada
    const metricsByKey = new Map<string, any[]>(); // key = ev|user|sim
    for (const r of mrRows) {
      const uploadId = r.upload_id as number;
      const evId = uploadIdToEvent[uploadId];
      if (!evId) continue;
      const simId =
        (r.simulator_id as number) ?? uploadIdToSim[uploadId] ?? null;
      const key = `${evId}|${r.user_id}|${simId ?? "null"}`;
      const arr = metricsByKey.get(key) ?? [];
      arr.push(r);
      metricsByKey.set(key, arr);
    }

    // Conjuntos emitidos para no duplicar
    const emittedEventUser = new Set<string>(); // ev|user   (solo para “inscrito sin simuladores”)
    const usedMetricIds = new Set<number>(); // ya exportadas

    const rows: any[] = [];

    function pushRowBase(params: {
      event_id: number;
      user_id: number;
      simulator_id: number | null;
      attended_at?: string | null;
      source?: string | null;
      metric?: any | null; // una métrica o null
    }) {
      const ev = eventById.get(params.event_id);
      if (!ev) return;

      const u = usersById.get(params.user_id) ?? {};
      const genderName = genderNameById.get(u.gender_id as number) ?? null;
      const sexo = toSexo(genderName);

      const licArr = licensesByUser.get(params.user_id) ?? [];
      const lic_issued = licArr
        .map((l) => l.issued_at)
        .filter(Boolean)
        .join(" | ");
      const lic_expires = licArr
        .map((l) => l.expires_at)
        .filter(Boolean)
        .join(" | ");
      const lic_cats = licArr
        .map((l) => (l.categories ?? []).join(","))
        .filter(Boolean)
        .join(" | ");
      const lic_restr = licArr
        .map((l) => l.restrictions)
        .filter(Boolean)
        .join(" | ");

      const simId = params.simulator_id;
      const simName = simId != null ? simNameById.get(simId) ?? "" : "";

      const metricId = params.metric?.metric_id ?? null;
      const metricItem = metricId ?? null; // por ahora el ítem es el propio id
      const metricDisplay = metricName(simId ?? null, metricId ?? null);

      rows.push({
        event_id: ev.id,
        event_date: ev.event_date,
        event_name: ev.name ?? "",
        department: ev.deptName,
        municipality: ev.muniName,

        user_id: u.id ?? null,
        doc_number: u.doc_number ?? "",
        name: u.name ?? "",
        lastname: u.lastname ?? "",
        sexo,
        birthdate: u.birthdate ?? null,
        company: u.company_name ?? "",
        arl: u.arl ?? "",
        phone: u.phone_number ?? "",
        email: u.email ?? "",
        tipo_usuario_vial: ROAD_USER_LABEL[u.road_user_type as number] ?? "",

        licencia_expedicion: lic_issued || "",
        licencia_vencimiento: lic_expires || "",
        licencia_categorias: lic_cats || "",
        licencia_restricciones: lic_restr || "",

        simulator_id: simId,
        simulator_name: simName,
        attended_at: params.attended_at ?? null,
        attendance_source: params.source ?? null,

        metric_id: metricId,
        metric_item: metricItem,
        metric_name: metricDisplay,
        measured_at: params.metric?.measured_at ?? null,
        resultado: resultadoLabel(params.metric?.result),
      });
    }

    // 8.1) De asistencias: una fila por cada métrica; si no hay métricas, una fila “vacía”
    for (const a of attendances) {
      const evId = a.event_id as number;
      const uId = a.user_id as number;
      const simId = a.simulator_id as number;
      const key = `${evId}|${uId}|${simId}`;
      const metrics = metricsByKey.get(key) ?? [];

      if (metrics.length) {
        for (const m of metrics) {
          usedMetricIds.add(m.id as number);
          pushRowBase({
            event_id: evId,
            user_id: uId,
            simulator_id: simId,
            attended_at: a.attended_at ?? null,
            source: a.source ?? null,
            metric: m,
          });
        }
      } else {
        pushRowBase({
          event_id: evId,
          user_id: uId,
          simulator_id: simId,
          attended_at: a.attended_at ?? null,
          source: a.source ?? null,
          metric: null,
        });
      }
    }

    // 8.2) Métricas sin asistencia registrada
    for (const r of mrRows) {
      const id = r.id as number;
      if (usedMetricIds.has(id)) continue;

      const uploadId = r.upload_id as number;
      const evId = uploadIdToEvent[uploadId];
      if (!evId) continue;

      const uId = r.user_id as number;
      const simId =
        (r.simulator_id as number) ?? uploadIdToSim[uploadId] ?? null;

      pushRowBase({
        event_id: evId,
        user_id: uId,
        simulator_id: simId,
        attended_at: null,
        source: null,
        metric: r,
      });
    }

    // 8.3) Inscritos al evento que NO tienen simuladores ni métricas
    const producedKeys = new Set<string>(); // ev|user (que ya tengan al menos 1 fila arriba)
    for (const row of rows) producedKeys.add(`${row.event_id}|${row.user_id}`);

    for (const ea of eventAttendees) {
      const evId = ea.event_id as number;
      const uId = ea.user_id as number;
      const key = `${evId}|${uId}`;
      if (producedKeys.has(key)) continue; // ya tiene al menos una fila
      if (emittedEventUser.has(key)) continue;
      emittedEventUser.add(key);

      // Fila “evento-usuario” sin simulador/métrica
      pushRowBase({
        event_id: evId,
        user_id: uId,
        simulator_id: null,
        attended_at: null,
        source: null,
        metric: null,
      });
    }

    // 9) Excel
    const headerEs = [
      "ID de evento",
      "Fecha del evento",
      "Nombre del evento",
      "Departamento",
      "Municipio",
      "ID de usuario",
      "Documento",
      "Nombre",
      "Apellido",
      "Sexo",
      "Fecha de nacimiento",
      "Empresa",
      "ARL",
      "Teléfono",
      "Correo electrónico",
      "Tipo de usuario vial",
      "Licencia: expedición",
      "Licencia: vencimiento",
      "Licencia: categorías",
      "Licencia: restricciones",
      "ID simulador",
      "Simulador",
      "Fecha de asistencia",
      "Fuente asistencia",
      "ID métrica",
      "Ítem (simulador)",
      "Nombre/Categoría de la métrica",
      "Fecha de medición",
      "Resultado",
    ];

    const dataAoA = [
      headerEs,
      ...rows.map((r) => [
        r.event_id,
        r.event_date,
        r.event_name,
        r.department,
        r.municipality,
        r.user_id,
        r.doc_number,
        r.name,
        r.lastname,
        r.sexo,
        r.birthdate,
        r.company,
        r.arl,
        r.phone,
        r.email,
        r.tipo_usuario_vial,
        r.licencia_expedicion,
        r.licencia_vencimiento,
        r.licencia_categorias,
        r.licencia_restricciones,
        r.simulator_id,
        r.simulator_name,
        r.attended_at,
        r.attendance_source,
        r.metric_id,
        r.metric_item,
        r.metric_name,
        r.measured_at,
        r.resultado,
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(dataAoA);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Datos");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new Response(buf, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="export-ansv.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("Export error:", e);
    const msg = e?.message || String(e);
    return new Response(`Export error: ${msg}`, { status: 500 });
  }
}
