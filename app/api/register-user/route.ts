// app/api/metrics/upload-csv/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type CsvRow = {
  fecha: string;
  doc: string;
  simulatorId: number;
  metricId: number;
  value: number;
};

function parseDateDDMMYYYY(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [_, d, mo, y] = m;
  const dd = d.padStart(2, "0");
  const mm = mo.padStart(2, "0");
  return `${y}-${mm}-${dd}T00:00:00Z`;
}
function detectHasHeader(firstNonEmptyLine: string): boolean {
  return !/^\d/.test(firstNonEmptyLine.trim());
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "upload-csv" });
}

export async function POST(req: NextRequest) {
  try {
    // 👇 import dinámico para que cualquier fallo sea atrapado por el catch
    const { parse } = await import("csv-parse/sync");

    const form = await req.formData();
    const eventId = Number(form.get("event_id"));
    const file = form.get("file") as File | null;

    if (!eventId || Number.isNaN(eventId)) {
      return NextResponse.json({ error: "event_id requerido" }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: "Archivo CSV requerido" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const raw = buf.toString("utf8");
    if (!raw.trim()) {
      return NextResponse.json({ error: "CSV vacío" }, { status: 400 });
    }

    const firstLine = raw.split(/\r?\n/).find(l => l.trim().length > 0) ?? "";
    const hasHeader = detectHasHeader(firstLine);

    let table: string[][];
    try {
      table = parse(raw, {
        delimiter: ",",
        skip_empty_lines: true,
        relax_column_count: true,
      }) as string[][];
    } catch (e: any) {
      return NextResponse.json({ error: `CSV inválido: ${e?.message ?? "parse error"}` }, { status: 400 });
    }

    const parsed: CsvRow[] = [];
    const rejectedGlobal: { line: number; reason: string }[] = [];

    for (let i = 0; i < table.length; i++) {
      if (hasHeader && i === 0) continue;
      const r = table[i];
      const lineNo = i + 1;

      if (!r || r.length < 5) { rejectedGlobal.push({ line: lineNo, reason: "Fila con menos de 5 columnas" }); continue; }

      const [fecha, identificacion, simulador, metrica, resultado] = r.map(c => (c ?? "").toString().trim());

      const measured_at = parseDateDDMMYYYY(fecha);
      if (!measured_at) { rejectedGlobal.push({ line: lineNo, reason: `Fecha inválida: "${fecha}"` }); continue; }
      if (!identificacion) { rejectedGlobal.push({ line: lineNo, reason: "Documento vacío" }); continue; }

      const simulatorId = Number(simulador);
      if (!Number.isFinite(simulatorId) || simulatorId <= 0) { rejectedGlobal.push({ line: lineNo, reason: `Simulador inválido: "${simulador}"` }); continue; }
      const metricId = Number(metrica);
      if (!Number.isFinite(metricId)) { rejectedGlobal.push({ line: lineNo, reason: `Métrica inválida: "${metrica}"` }); continue; }
      const value = Number(resultado);
      if (!Number.isFinite(value)) { rejectedGlobal.push({ line: lineNo, reason: `Resultado inválido: "${resultado}"` }); continue; }

      parsed.push({ fecha: measured_at, doc: identificacion, simulatorId, metricId, value });
    }

    if (parsed.length === 0) {
      return NextResponse.json({ error: "CSV sin filas válidas", rejected: rejectedGlobal }, { status: 400 });
    }

    const storagePath = `metrics/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("metrics")
      .upload(storagePath, buf, { contentType: "text/csv", upsert: false });
    if (upErr) {
      return NextResponse.json({ error: `Storage: ${upErr.message}` }, { status: 400 });
    }

    const uniqueDocs = Array.from(new Set(parsed.map(p => p.doc)));
    const userMap = new Map<string, number>();
    const chunk = 500;
    for (let i = 0; i < uniqueDocs.length; i += chunk) {
      const slice = uniqueDocs.slice(i, i + chunk);
      const { data, error } = await supabaseAdmin
        .from("users_table")
        .select("id, doc_number")
        .in("doc_number", slice);
      if (error) {
        return NextResponse.json({ error: `users_table: ${error.message}` }, { status: 500 });
      }
      (data ?? []).forEach(u => userMap.set(u.doc_number, u.id));
    }

    const groups = new Map<number, CsvRow[]>();
    parsed.forEach(row => {
      if (!groups.has(row.simulatorId)) groups.set(row.simulatorId, []);
      groups.get(row.simulatorId)!.push(row);
    });

    const summary: Array<{ simulator_id: number; upload_id: number; rows_total: number; inserted: number; rejected: number; pending_resolve: number; }> = [];

    for (const [simulatorId, rows] of groups.entries()) {
      const { data: upload, error: upInsErr } = await supabaseAdmin
        .from("metric_uploads")
        .insert({ event_id: eventId, simulator_id: simulatorId, file_name: file.name, storage_path: storagePath })
        .select("id")
        .single();
      if (upInsErr) {
        return NextResponse.json({ error: `metric_uploads: ${upInsErr.message}` }, { status: 500 });
      }
      const uploadId = upload!.id as number;

      const payload = rows.map(r => {
        const userId = userMap.get(r.doc) ?? null;
        return {
          upload_id: uploadId,
          user_id: userId,
          doc_number: r.doc,
          qr_code: null,
          measured_at: r.fecha,
          metrics: { metric_id: r.metricId, value: r.value },
          valid: !!userId,
          resolution_status: userId ? "resolved" : "pending",
          resolution_error: userId ? null : "user_not_found_by_doc",
        };
      });

      const seen = new Set<string>();
      const dedup = payload.filter(p => {
        const key = `${p.doc_number}|${p.measured_at}|${p.metrics.metric_id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      let inserted = 0;
      let pending = 0;
      const size = 1000;
      for (let i = 0; i < dedup.length; i += size) {
        const portion = dedup.slice(i, i + size);
        const { error: insErr } = await supabaseAdmin.from("metric_rows").insert(portion);
        if (insErr) {
          return NextResponse.json({ error: `metric_rows: ${insErr.message}` }, { status: 500 });
        }
        inserted += portion.length;
        pending += portion.filter(p => !p.user_id).length;
      }

      summary.push({ simulator_id: simulatorId, upload_id: uploadId, rows_total: rows.length, inserted, rejected: rows.length - inserted, pending_resolve: pending });
    }

    return NextResponse.json({
      event_id: eventId,
      file_name: file.name,
      storage_path: storagePath,
      totals: {
        rows_in_file: table.length - (hasHeader ? 1 : 0),
        parsed_valid: parsed.length,
        rejected_invalid: rejectedGlobal.length,
      },
      rejected_invalid_detail: rejectedGlobal.slice(0, 50),
      uploads: summary,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "Upload error" }, { status: 500 });
  }
}
