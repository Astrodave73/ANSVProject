"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { getSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Dept = { id: number; name: string };
type Muni = { id: number; name: string; department_id: number };
type EventRow = {
  id: number;
  name: string | null;
  event_date: string;        // YYYY-MM-DD
  department_id: number;
  municipality_id: number;
  deptName: string;
  muniName: string;
};

export default function ExportarPage() {
  const supabase = useMemo(() => getSupabase(), []);
  const [loading, setLoading] = useState(false);

  const [departments, setDepartments] = useState<Dept[]>([]);
  const [municipalities, setMunicipalities] = useState<Muni[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);

  const [loadingDeps, setLoadingDeps] = useState(true);
  const [loadingMuns, setLoadingMuns] = useState(true);
  const [loadingEvs, setLoadingEvs] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selecciones
  const [deptIds, setDeptIds] = useState<number[]>([]);
  const [muniIds, setMuniIds] = useState<number[]>([]);
  const [eventIds, setEventIds] = useState<number[]>([]);

  // Cargar catálogos
  useEffect(() => {
    (async () => {
      setError(null);

      // Departamentos
      try {
        setLoadingDeps(true);
        const { data, error } = await supabase
          .from("departments_table")
          .select("id, name")
          .order("name", { ascending: true });
        if (error) throw error;
        setDepartments((data ?? []).map((d: any) => ({ id: d.id, name: d.name })));
      } catch (e: any) {
        setError(e.message || "Error cargando departamentos");
      } finally {
        setLoadingDeps(false);
      }

      // Municipios
      try {
        setLoadingMuns(true);
        const { data, error } = await supabase
          .from("municipalities_table")
          .select("id, name, department_id")
          .order("name", { ascending: true });
        if (error) throw error;
        setMunicipalities(
          (data ?? []).map((m: any) => ({
            id: m.id,
            name: m.name,
            department_id: m.department_id,
          }))
        );
      } catch (e: any) {
        setError(e.message || "Error cargando municipios");
      } finally {
        setLoadingMuns(false);
      }

      // Eventos (normalizamos dept/muni a strings seguras)
      try {
        setLoadingEvs(true);
        const { data, error } = await supabase
          .from("events_table")
          .select(
            `
            id,
            name,
            event_date,
            department_id,
            municipality_id,
            departments_table ( name ),
            municipalities_table ( name )
          `
          )
          .order("event_date", { ascending: false })
          .limit(1000);
        if (error) throw error;

        const evs: EventRow[] = (data ?? []).map((e: any) => ({
          id: e.id,
          name: e.name ?? null,
          event_date: e.event_date,
          department_id: e.department_id,
          municipality_id: e.municipality_id,
          deptName: Array.isArray(e.departments_table)
            ? (e.departments_table[0]?.name ?? "")
            : (e.departments_table?.name ?? ""),
          muniName: Array.isArray(e.municipalities_table)
            ? (e.municipalities_table[0]?.name ?? "")
            : (e.municipalities_table?.name ?? ""),
        }));
        setEvents(evs);
      } catch (e: any) {
        setError(e.message || "Error cargando eventos");
      } finally {
        setLoadingEvs(false);
      }
    })();
  }, [supabase]);

  // Filtrado dependiente
  const filteredMunicipalities = useMemo(() => {
    if (!deptIds.length) return municipalities;
    return municipalities.filter((m) => deptIds.includes(m.department_id));
  }, [municipalities, deptIds]);

  const filteredEvents = useMemo(() => {
    let list = events;
    if (deptIds.length) list = list.filter((e) => deptIds.includes(e.department_id));
    if (muniIds.length) list = list.filter((e) => muniIds.includes(e.municipality_id));
    return list;
  }, [events, deptIds, muniIds]);

  // Helpers selección
  const toggleId = (arr: number[], setArr: (v: number[]) => void, id: number) => {
    setArr(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  };

  // Tri-state para Checkbox de “Seleccionar todos”
  const tri = (selectedCount: number, total: number): boolean | "indeterminate" => {
    if (total === 0 || selectedCount === 0) return false;
    if (selectedCount === total) return true;
    return "indeterminate";
  };

  // Exportar
  const doExport = async () => {
    setLoading(true);
    setError(null);
    try {
      const body = {
        departmentIds: deptIds,
        municipalityIds: muniIds,
        eventIds: eventIds,
      };

      const res = await fetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Export failed: ${t.slice(0, 500)}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "export-ansv.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || "Error al exportar");
    } finally {
      setLoading(false);
    }
  };

  // Render
  return (
    <div className="space-y-6">
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Exportar datos a Excel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">

          {/* Departamentos */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">Departamentos</h3>
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <Checkbox
                  checked={tri(deptIds.length, departments.length)}
                  onCheckedChange={(v) => {
                    const all = departments.map((d) => d.id);
                    // si ya está en true → desmarcar todo, si no → marcar todo
                    if (v === true) {
                      setDeptIds(all);
                    } else {
                      // v === false o "indeterminate" → limpiar
                      setDeptIds([]);
                    }
                    // reset dependientes
                    setMuniIds([]);
                    setEventIds([]);
                  }}
                />
                <span>Seleccionar todos</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {loadingDeps ? (
                <p className="text-gray-400">Cargando departamentos...</p>
              ) : (
                departments.map((d) => (
                  <label
                    key={d.id}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-md border border-gray-800 bg-gray-800/60",
                      deptIds.includes(d.id) && "border-primary"
                    )}
                  >
                    <Checkbox
                      checked={deptIds.includes(d.id)}
                      onCheckedChange={() => {
                        toggleId(deptIds, setDeptIds, d.id);
                        setMuniIds([]);
                        setEventIds([]);
                      }}
                    />
                    <span className="text-gray-200">{d.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Municipios */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">Municipios</h3>
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <Checkbox
                  checked={tri(muniIds.length, filteredMunicipalities.length)}
                  onCheckedChange={(v) => {
                    const all = filteredMunicipalities.map((m) => m.id);
                    if (v === true) setMuniIds(all);
                    else setMuniIds([]);
                    setEventIds([]);
                  }}
                  disabled={loadingMuns || filteredMunicipalities.length === 0}
                />
                <span>Seleccionar todos (filtrados)</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {loadingMuns ? (
                <p className="text-gray-400">Cargando municipios...</p>
              ) : filteredMunicipalities.length === 0 ? (
                <p className="text-gray-500">No hay municipios para los departamentos seleccionados.</p>
              ) : (
                filteredMunicipalities.map((m) => (
                  <label
                    key={m.id}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-md border border-gray-800 bg-gray-800/60",
                      muniIds.includes(m.id) && "border-primary"
                    )}
                  >
                    <Checkbox
                      checked={muniIds.includes(m.id)}
                      onCheckedChange={() => {
                        toggleId(muniIds, setMuniIds, m.id);
                        setEventIds([]);
                      }}
                    />
                    <span className="text-gray-200">{m.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Eventos */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">Eventos</h3>
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <Checkbox
                  checked={tri(eventIds.length, filteredEvents.length)}
                  onCheckedChange={(v) => {
                    const all = filteredEvents.map((e) => e.id);
                    if (v === true) setEventIds(all);
                    else setEventIds([]);
                  }}
                  disabled={loadingEvs || filteredEvents.length === 0}
                />
                <span>Seleccionar todos (filtrados)</span>
              </label>
            </div>

            <div className="space-y-2">
              {loadingEvs ? (
                <p className="text-gray-400">Cargando eventos...</p>
              ) : filteredEvents.length === 0 ? (
                <p className="text-gray-500">No hay eventos para los filtros seleccionados.</p>
              ) : (
                filteredEvents.map((ev) => {
                  const label = `${ev.event_date} — ${ev.name ?? "(sin nombre)"} — ${ev.deptName} / ${ev.muniName}`;
                  return (
                    <label
                      key={ev.id}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-md border border-gray-800 bg-gray-800/60",
                        eventIds.includes(ev.id) && "border-primary"
                      )}
                    >
                      <Checkbox
                        checked={eventIds.includes(ev.id)}
                        onCheckedChange={() => toggleId(eventIds, setEventIds, ev.id)}
                      />
                      <span className="text-gray-200">{label}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-red-900/30 border border-red-700 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={doExport}
              disabled={loading}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {loading ? "Generando Excel..." : "Exportar Excel"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
