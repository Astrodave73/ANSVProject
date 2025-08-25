// app/api/upload.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = "metrics";

function pad(n: number) { return n < 10 ? `0${n}` : String(n); }
function parseCsvDate(d: string) {
  const m = d?.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]), mm = Number(m[2]), yyyy = Number(m[3]);
  if (!Number.isInteger(dd) || !Number.isInteger(mm) || !Number.isInteger(yyyy)) return null;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const dateLiteral = `${yyyy}-${pad(mm)}-${pad(dd)}`;
  const iso = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0)).toISOString();
  return { iso, dateLiteral } as const;
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Config faltante" }, { status: 500 });
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const eventIdRaw = form.get("eventId") as string | null;
    const action = (form.get("action") as string | null) ?? "validate"; // "validate" | "commit"

    if (!file) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    const event_id = Number(eventIdRaw);
    if (!event_id) return NextResponse.json({ error: "eventId inválido" }, { status: 400 });

    // Fecha del evento
    const ev = await admin.from("events_table").select("event_date").eq("id", event_id).single();
    if (ev.error || !ev.data) return NextResponse.json({ error: ev.error?.message || "Evento no encontrado" }, { status: 400 });
    const eventDateLiteral: string = ev.data.event_date;

    // Leer CSV
    const rawText = await file.text();
    const rawLines = rawText.split(/\r?\n/);

    // Cabecera opcional
    let startIdx = 0;
    if (rawLines[0] && /^fecha\s*,\s*identificacion\s*,\s*simulador\s*,\s*metrica\s*,\s*resultado\s*$/i.test(rawLines[0].trim())) {
      startIdx = 1;
    }
    if (/^,+$/.test(rawLines[0]?.trim() || "")) {
  startIdx = 1;
}

    type BadLine = { lineNo: number; line: string; reason: string };
    const bads: BadLine[] = [];

    type Parsed = {
      lineNo: number;
      line: string;
      measured_at_iso: string;
      dateLiteral: string;
      doc_number: string;
      simulator_id: number;
      metric_id: number;
      result: number;
    };

    const parsed: Parsed[] = [];
    const dateMismatches: { lineNo: number; parsed_date: string; expected: string; line: string }[] = [];
    let consideredTotal = 0;

    for (let i = startIdx; i < rawLines.length; i++) {
      const lineNo = i + 1;
      const line = rawLines[i]?.trim() ?? "";
      if (!line) continue;
      consideredTotal++;

   const parts = line.split(",").map(s => s?.trim());

let fecha: string, identificacion: string, simulador: string, metrica: string, resultado: string;

if (parts.length === 5) {
  // Formato “normal”: Fecha en una sola celda dd/mm/yyyy
  [fecha, identificacion, simulador, metrica, resultado] = parts;
} else if (parts.length === 7) {
  // Formato “compacto”: dd,mm,yyyy,doc,sim,met,res  → reconstruimos la fecha
  const [d, m, y, doc, sim, met, res] = parts;
  fecha = `${d}/${m}/${y}`;
  identificacion = doc;
  simulador = sim;
  metrica = met;
  resultado = res;
} else {
  bads.push({ lineNo, line, reason: `Número de columnas inválido (${parts.length})` });
  continue;
}

      const empties: string[] = [];
      if (!fecha) empties.push("fecha");
      if (!identificacion) empties.push("identificacion");
      if (!simulador) empties.push("simulador");
      if (!metrica) empties.push("metrica");
      if (!resultado) empties.push("resultado");
      if (empties.length) { bads.push({ lineNo, line, reason: `Campo(s) vacío(s): ${empties.join(", ")}` }); continue; }

      const d = parseCsvDate(fecha!);
      if (!d) { bads.push({ lineNo, line, reason: "Fecha inválida (dd/m/yyyy o dd/mm/yyyy)" }); continue; }

      const sim = Number(simulador);
      const mid = Number(metrica);
      const res = Number(resultado);
      if (!Number.isInteger(sim) || sim < 1) { bads.push({ lineNo, line, reason: "Simulador inválido" }); continue; }
      if (!Number.isInteger(mid) || mid < 0) { bads.push({ lineNo, line, reason: "Métrica inválida" }); continue; }
      if (!(res === 0 || res === 1))         { bads.push({ lineNo, line, reason: "Resultado debe ser 0 o 1" }); continue; }

      if (d.dateLiteral !== eventDateLiteral) {
        dateMismatches.push({ lineNo, parsed_date: d.dateLiteral, expected: eventDateLiteral, line });
      }

      parsed.push({
        lineNo,
        line,
        measured_at_iso: d.iso,
        dateLiteral: d.dateLiteral,
        doc_number: identificacion!,
        simulator_id: sim,
        metric_id: mid,
        result: res,
      });
    }

    if (bads.length > 0) {
      return NextResponse.json({ error: "El CSV contiene errores bloqueantes", bads }, { status: 400 });
    }
    if (!parsed.length) {
      return NextResponse.json({ error: "No hay filas válidas" }, { status: 400 });
    }

    // Mapear doc_number -> user_id para advertir C.C. no encontradas
    const uniqueDocs = Array.from(new Set(parsed.map(v => v.doc_number)));
    const userMap = new Map<string, number>();
    const unknownDocs: string[] = [];

    const chunk = 500;
    for (let i = 0; i < uniqueDocs.length; i += chunk) {
      const slice = uniqueDocs.slice(i, i + chunk);
      const q = await admin.from("users_table").select("id, doc_number").in("doc_number", slice);
      if (q.error) return NextResponse.json({ error: q.error.message }, { status: 400 });
      (q.data ?? []).forEach(u => userMap.set(u.doc_number, u.id));
    }
    for (const doc of uniqueDocs) {
      if (!userMap.has(doc)) unknownDocs.push(doc);
    }

    // VALIDACIÓN previa (no sube ni inserta)
    if (action === "validate") {
      return NextResponse.json({
        ok: true,
        totals: { parsed_total: consideredTotal },
        warnings: {
          date_mismatch_count: dateMismatches.length,
          date_mismatches_sample: dateMismatches.slice(0, 20),
          unknown_docs_count: unknownDocs.length,
          unknown_docs_sample: unknownDocs.slice(0, 50),
        },
      });
    }

    // COMMIT: subir a Storage + insertar en DB
    const storagePath = `${event_id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${file.name}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const up = await admin.storage.from(BUCKET).upload(storagePath, buffer, {
      contentType: file.type || "text/csv",
      upsert: false,
    });
    if (up.error) return NextResponse.json({ error: up.error.message }, { status: 400 });

    const mu = await admin
      .from("metric_uploads")
      .insert({ event_id, simulator_id: null, file_name: file.name, storage_path: storagePath })
      .select("id")
      .single();
    if (mu.error) return NextResponse.json({ error: mu.error.message }, { status: 400 });
    const upload_id = mu.data.id as number;

    const rows = parsed.map(v => {
      const user_id = userMap.get(v.doc_number) ?? null;
      return {
        upload_id,
        user_id,
        doc_number: v.doc_number,
        measured_at: v.measured_at_iso,
        simulator_id: v.simulator_id,
        metric_id: v.metric_id,
        result: v.result,
        resolution_status: user_id ? "resolved" : "pending",
      };
    });

    for (let i = 0; i < rows.length; i += 500) {
      const slice = rows.slice(i, i + 500);
      const ins = await admin.from("metric_rows").insert(slice);
      if (ins.error) {
        return NextResponse.json({ error: ins.error.message, atBatchStart: i, exampleRow: slice[0] }, { status: 400 });
      }
    }

    return NextResponse.json({
      ok: true,
      upload_id,
      totals: {
        parsed_total: consideredTotal,
        parsed_valid: rows.length,
        parsed_bad: 0,
      },
      warnings: {
        date_mismatch_count: dateMismatches.length,
        date_mismatches_sample: dateMismatches.slice(0, 20),
        unknown_docs_count: unknownDocs.length,
        unknown_docs_sample: unknownDocs.slice(0, 50),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error inesperado" }, { status: 500 });
  }
}
