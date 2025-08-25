"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { slugify } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  CalendarDays,
  MapPin,
  Map,
} from "lucide-react";

type Dept = { id: number; name: string };
type Muni = { id: number; name: string; department_id: number };

function classNames(...c: (string | false | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export default function CrearEventoPage() {
  const [autoName, setAutoName] = useState(true);
  const [autoPreview, setAutoPreview] = useState<string>("");
  const sb = useMemo(() => getSupabase(), []);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [loadingMunis, setLoadingMunis] = useState(false);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [munis, setMunis] = useState<Muni[]>([]);
  const [deptId, setDeptId] = useState<number | "">("");
  const [muniId, setMuniId] = useState<number | "">("");

  const [eventName, setEventName] = useState("");
  function todayBogotaYMD() {
    // en-CA devuelve YYYY-MM-DD
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota",
    }).format(new Date());
  }
  const [eventDate, setEventDate] = useState<string>("");

  useEffect(() => {
    setEventDate(todayBogotaYMD()); // fija la TZ a Bogotá
  }, []);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    id: number;
    name: string;
    event_date: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Cargar departamentos al montar
  useEffect(() => {
    (async () => {
      setLoadingDepts(true);
      setErrorMsg(null);
      const { data, error } = await sb
        .from("departments_table")
        .select("id, name")
        .order("name", { ascending: true });
      setLoadingDepts(false);
      if (error) {
        setErrorMsg(`Error cargando departamentos: ${error.message}`);
        return;
      }
      setDepts((data || []) as Dept[]);
      if (data && data.length) setDeptId(data[0].id);
    })();
  }, [sb]);

  useEffect(() => {
    async function refreshPreview() {
      if (!autoName || !deptId || !muniId) {
        setAutoPreview("");
        return;
      }

      // 1) nombres de dpto/muni
      const dept = depts.find((d) => d.id === deptId)?.name ?? `dept-${deptId}`;
      const muni = munis.find((m) => m.id === muniId)?.name ?? `muni-${muniId}`;

      // 2) contador global (total eventos + 1)
      const { count } = await sb
        .from("events_table")
        .select("id", { count: "exact", head: true });
      const seq = (count ?? 0) + 1;

      // 3) nombre preview
      const preview = `Jornada-${slugify(dept)}-${slugify(muni)}-${seq}`;
      setAutoPreview(preview);
    }
    refreshPreview();
  }, [autoName, deptId, muniId, depts, munis, sb]);

  // al enviar:
  const payload = {
    department_id: Number(deptId),
    municipality_id: Number(muniId),
    event_date: eventDate,
    name: autoName ? autoPreview : eventName.trim(), // el backend igual añadirá -{contadorGlobal} si manual
  };
  // Cargar municipios cuando cambie departamento
  useEffect(() => {
    if (!deptId) {
      setMunis([]);
      setMuniId("");
      return;
    }
    (async () => {
      setLoadingMunis(true);
      setErrorMsg(null);
      const { data, error } = await sb
        .from("municipalities_table")
        .select("id, name, department_id")
        .eq("department_id", deptId)
        .order("name", { ascending: true });
      setLoadingMunis(false);
      if (error) {
        setErrorMsg(`Error cargando municipios: ${error.message}`);
        return;
      }
      setMunis((data || []) as Muni[]);
      if (data && data.length) setMuniId(data[0].id);
      else setMuniId("");
    })();
  }, [deptId, sb]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccess(null);
    setCopied(false);

    if (!deptId || !muniId || !eventDate) {
      setErrorMsg("Departamento, municipio y fecha son obligatorios.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        department_id: Number(deptId),
        municipality_id: Number(muniId),
        name: eventName || null,
        event_date: eventDate,
      };
      const res = await fetch("/api/create-event", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "No se pudo crear el evento");
      setSuccess(json); // { id, event_date, name }
      // opcional: limpiar nombre pero mantener selección
      // setEventName("");
    } catch (err: any) {
      setErrorMsg(err.message || "Error creando evento");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyId() {
    if (!success?.id) return;
    await navigator.clipboard.writeText(String(success.id));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="min-h-screen bg-black p-4 pt-[0]">
      <div className="max-w-xl mx-auto space-y-6 mt-[58px]">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-xl font-semibold text-white">Crear evento</h1>
          <p className="text-sm text-gray-400">
            Selecciona ubicación y fecha. Usa el mismo estilo del escáner.
          </p>
        </div>

        {/* Formulario */}
        <Card className="bg-gray-900 border-gray-700 shadow-lg">
          <CardContent className="p-4 space-y-4">
            {/* Nombre opcional */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-[#ff7700]">
                  Nombre del evento
                </label>
              </div>

              <input
                type="text"
                value={autoName ? autoPreview || "" : eventName}
                onChange={(e) => !autoName && setEventName(e.target.value)}
                placeholder={
                  autoName
                    ? "Se generará automáticamente"
                    : "Ej. mi-evento-especial"
                }
                disabled={autoName}
                className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ff7700] focus:border-[#ff7700]"
              />

              <p className="text-xs text-gray-400">
                Requisito: el nombre **siempre termina** en el número total de
                eventos (contador global).
              </p>
            </div>

            {/* Departamento */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-[#ff7700] flex items-center gap-2">
                <Map className="w-4 h-4" /> Departamento
              </label>
              <select
                value={deptId || ""}
                onChange={(e) =>
                  setDeptId(e.target.value ? Number(e.target.value) : "")
                }
                disabled={loadingDepts}
                className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-[#ff7700] focus:border-[#ff7700]"
              >
                {loadingDepts && <option value="">Cargando...</option>}
                {!loadingDepts && depts.length === 0 && (
                  <option value="">Sin datos</option>
                )}
                {depts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Municipio */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-[#ff7700] flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Municipio
              </label>
              <select
                value={muniId || ""}
                onChange={(e) =>
                  setMuniId(e.target.value ? Number(e.target.value) : "")
                }
                disabled={!deptId || loadingMunis}
                className={classNames(
                  "w-full px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-[#ff7700] focus:border-[#ff7700]",
                  !deptId && "opacity-50 cursor-not-allowed"
                )}
              >
                {!deptId && (
                  <option value="">Selecciona un departamento primero</option>
                )}
                {deptId && loadingMunis && (
                  <option value="">Cargando...</option>
                )}
                {deptId && !loadingMunis && munis.length === 0 && (
                  <option value="">Sin municipios</option>
                )}
                {munis.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Fecha */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-[#ff7700] flex items-center gap-2">
                <CalendarDays className="w-4 h-4" /> Fecha del evento
              </label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-[#ff7700] focus:border-[#ff7700]"
              />
            </div>

            {/* Submit */}
            <div className="pt-1">
              <Button
                onClick={onSubmit}
                disabled={submitting || !deptId || !muniId || !eventDate}
                className="bg-[#ff7700] hover:bg-[#e66a00] text-white border-0"
              >
                {submitting ? "Creando..." : "Crear evento"}
              </Button>
            </div>

            {/* Errores */}
            {errorMsg && (
              <Alert
                variant="destructive"
                className="bg-red-900/20 border-red-800 text-red-400 mt-1"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Éxito + Acciones rápidas */}
        {success && (
          <Card className="bg-green-900/20 border-green-700 shadow-lg">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-medium">
                  Evento creado correctamente
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-green-200">
                <div>
                  <span className="text-green-300/90">ID:</span> {success.id}
                </div>
                <div>
                  <span className="text-green-300/90">Fecha:</span>{" "}
                  {success.event_date}
                </div>
                <div className="sm:col-span-2">
                  <span className="text-green-300/90">Nombre:</span>{" "}
                  {success.name ?? (
                    <em className="text-green-300/70">sin nombre</em>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
