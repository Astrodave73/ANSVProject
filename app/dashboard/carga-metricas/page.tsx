// app/dashboard/carga-metricas/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type BadLine = { lineNo: number; line: string; reason: string };
type DateMismatch = { lineNo: number; parsed_date: string; expected: string; line: string };
type WarningsPayload = {
  date_mismatch_count: number;
  date_mismatches_sample: DateMismatch[];
  unknown_docs_count: number;
  unknown_docs_sample: string[];
};

export default function CargaMetricasPage() {
  const supabase = useMemo(() => getSupabase(), []);
  const [events, setEvents] = useState<{ id: number; label: string }[]>([]);
  const [eventId, setEventId] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);

  const [bads, setBads] = useState<BadLine[]>([]);
  const [warnings, setWarnings] = useState<WarningsPayload | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("events_table")
        .select(`id, name, event_date, departments_table(name), municipalities_table(name)`)
        .order("event_date", { ascending: false })
        .limit(100);
      if (error) { setMsg(`Error cargando eventos: ${error.message}`); return; }
      const list = (data ?? []).map((r: any) => ({
        id: r.id,
        label: `${r.event_date} — ${r.name ?? "(sin nombre)"} — ${r?.departments_table?.name ?? "Depto"} / ${r?.municipalities_table?.name ?? "Municipio"}`
      }));
      setEvents(list);
      if (!eventId && list.length) setEventId(String(list[0].id));
    })();
  }, [supabase]);

  // Auto-validación cuando cambia archivo o evento
  useEffect(() => {
    (async () => {
      setWarnings(null); setBads([]); setMsg(null);
      if (!file || !eventId) return;
      setValidating(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("eventId", eventId);
        fd.append("action", "validate"); // <- solo validar

        const res = await fetch("/api/upload-csv", { method: "POST", body: fd });
        const raw = await res.text();
        let data: any = {};
        try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }

        if (!res.ok) {
          setMsg(`❌ ${data?.error ?? "Error en validación"}`);
          if (Array.isArray(data?.bads)) setBads(data.bads as BadLine[]);
          return;
        }
        setWarnings(data?.warnings || null);
        setMsg(`✔️ Validación OK — Filas: ${data?.totals?.parsed_total ?? 0}`);
      } catch (e: any) {
        setMsg(`❌ ${e?.message ?? "Error de validación"}`);
      } finally {
        setValidating(false);
      }
    })();
  }, [file, eventId]);

const doUpload = useCallback(async () => {
  if (!file || !eventId) return;
  setLoading(true); setMsg(null);
  try {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("eventId", eventId);
    fd.append("action", "commit"); // <- subir definitivamente

    const res = await fetch("/api/upload-csv", { method: "POST", body: fd });

    const raw = await res.text();
    let data: any = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }

    if (!res.ok) {
      setMsg(`❌ ${data?.error ?? "Error de carga"}`);
      console.log("1")
      return;
    }
    const totals = data?.totals || {};
    const uploadId = data?.upload_id ?? "—";
    if (res.ok) {
      setMsg(`✔️ Subida confirmada (ID: ${uploadId}). Filas válidas: ${totals.parsed_valid ?? 0}`);
      console.log("1")
      return;
    }
    
    console.log("0")
    setWarnings(data?.warnings || null);
    setFile(null);
  } catch (e: any) {
    setMsg(`❌ ${e?.message ?? "Error inesperado"}`);
  } finally {
    setLoading(false);
  }
}, [file, eventId]);


  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Carga de métricas (CSV)</CardTitle>
            <CardDescription className="text-gray-300">
              Formato: <code>fecha,identificacion,simulador,metrica,resultado</code>
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-200">Evento destino</Label>
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                  <SelectValue placeholder="Selecciona evento" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600 max-h-80 overflow-y-auto">
                  {events.map(ev => (
                    <SelectItem key={ev.id} value={String(ev.id)} className="text-white hover:bg-gray-700">
                      {ev.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-200">Archivo CSV</Label>
              <Input
                type="file"
                accept=".csv,text/csv"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <Button
              onClick={doUpload}
              disabled={!file || !eventId || loading || validating || bads.length > 0}
              className="bg-[#ff7700] hover:bg-[#e66600] text-white"
            >
              {loading ? "Subiendo..." : (validating ? "Validando..." : "Subir CSV")}
            </Button>

            {msg && (
              <p className={msg.startsWith("✔️") ? "text-green-400" : "text-red-400"}>
                {msg}
              </p>
            )}

            {/* Errores bloqueantes */}
            {bads.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-red-300">Errores que impiden la carga:</p>
                <pre className="bg-black/50 border border-gray-700 rounded p-3 text-xs text-gray-200 overflow-auto max-h-64">
{bads.slice(0, 80).map((b, i) => `${i + 1}. Línea ${b.lineNo} — [${b.reason}] ${b.line}`).join("\n")}
                </pre>
              </div>
            )}

            {/* Advertencias no bloqueantes */}
            {warnings && (warnings.date_mismatch_count > 0 || warnings.unknown_docs_count > 0) && (
              <div className="mt-2">
                <p className="text-sm text-yellow-300">Advertencias (no bloquean):</p>
                <div className="text-xs text-gray-200 space-y-2">
                  {warnings.date_mismatch_count > 0 && (
                    <div>
                      <p>Fechas en CSV distintas a la del evento: <strong>{warnings.date_mismatch_count}</strong></p>
                      <pre className="bg-black/50 border border-gray-700 rounded p-3 overflow-auto max-h-48">
{warnings.date_mismatches_sample.map((w, i) =>
  `${i + 1}. Línea ${w.lineNo} — CSV=${w.parsed_date} esperado=${w.expected} :: ${w.line}`
).join("\n")}
                      </pre>
                    </div>
                  )}
                  {warnings.unknown_docs_count > 0 && (
                    <div>
                      <p>Identificaciones no encontradas (se cargarán como <em>pending</em>): <strong>{warnings.unknown_docs_count}</strong></p>
                      <pre className="bg-black/50 border border-gray-700 rounded p-3 overflow-auto max-h-48">
{warnings.unknown_docs_sample.map((d, i) => `${i + 1}. ${d}`).join("\n")}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
