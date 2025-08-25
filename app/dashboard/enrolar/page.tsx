// app/dashboard/enrolar/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type EventOpt = { id: number; label: string };

export default function EnrolarUsuarioPage() {
  const supabase = useMemo(() => getSupabase(), []);
  const [events, setEvents] = useState<EventOpt[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [doc, setDoc] = useState("");
  const [qr, setQr] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("events_table")
        .select(`id, name, event_date, departments_table(name), municipalities_table(name)`)
        .order("event_date", { ascending: false })
        .limit(120);

      if (error) {
        setMsg(`❌ Error cargando eventos: ${error.message}`);
        return;
      }

      const list: EventOpt[] = (data ?? []).map((r: any) => ({
        id: r.id,
        label: `${r.event_date} — ${r.name ?? "(sin nombre)"} — ${r?.departments_table?.name ?? "Depto"} / ${r?.municipalities_table?.name ?? "Municipio"}`
      }));

      setEvents(list);
      if (!eventId && list.length) setEventId(String(list[0].id));
    })();
  }, [supabase]);

  const canSubmit = !!eventId && (!!doc.trim() || !!qr.trim());

  const handleEnroll = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/attendees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: Number(eventId),
          doc_number: doc.trim() || undefined,
          qr_code: qr.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMsg(`❌ ${data?.error ?? "Error al enrolar"}`);
        return;
      }

      setMsg(`✔️ Enrolado en el evento #${data?.enrolled_event_id ?? eventId}`);
      setDoc("");
      setQr("");
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? "Error inesperado"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Enrolar usuario a evento</CardTitle>
            <CardDescription className="text-gray-300">
              Ingresa documento <em>o</em> QR y selecciona el evento. No afecta asistencias ni historial previos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-200">Evento</Label>
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                  <SelectValue placeholder="Selecciona evento" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600 max-h-80 overflow-y-auto">
                  {events.map((ev) => (
                    <SelectItem key={ev.id} value={String(ev.id)} className="text-white hover:bg-gray-700">
                      {ev.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-gray-200">Documento</Label>
                <Input
                  value={doc}
                  onChange={(e) => setDoc(e.target.value)}
                  placeholder="CC/NIT..."
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-200">QR (texto)</Label>
                <Input
                  value={qr}
                  onChange={(e) => setQr(e.target.value)}
                  placeholder="Contenido del QR..."
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleEnroll}
                disabled={!canSubmit || loading}
                className="bg-[#ff7700] hover:bg-[#e66600] text-white"
              >
                {loading ? "Enrolando..." : "Enrolar en evento"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
                onClick={() => {
                  setDoc("");
                  setQr("");
                  setMsg(null);
                }}
              >
                Limpiar
              </Button>
            </div>

            {msg && (
              <p className={msg.startsWith("✔️") ? "text-green-400" : "text-red-400"}>
                {msg}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
