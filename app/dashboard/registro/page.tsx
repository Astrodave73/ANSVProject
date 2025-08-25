"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  User,
  Car,
  Users,
  Upload,
  Check,
  ImageIcon,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import QRCode from "qrcode";
import { getSupabase } from "@/lib/supabase/client";
import CameraFrame from "@/components/camera-frame";

// ---------- utilidades ----------
const sanitizeInput = (
  value: string,
  type: "text" | "email" | "number" = "text"
) => {
  if (type === "email") return value.replace(/[^a-zA-Z0-9@._-]/g, "");
  if (type === "number") return value.replace(/[^0-9]/g, "");
  return value.replace(/[^a-zA-Z0-9\sáéíóúÁÉÍÓÚüÜñÑ]/g, "");
};

const isAdult = (birthdate: string) => {
  const today = new Date();
  const birth = new Date(birthdate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 18;
};

// ---------- tipos ----------
type EventOption = {
  id: number;
  name: string | null;
  event_date: string;
  dept: string;
  muni: string;
  label: string;
};

interface FormData {
  name: string;
  lastname: string;
  documentType: string;
  documentNumber: string;
  birthdate: string;
  Sexo: string;
  phoneNumber: string;
  email: string;
  company: string;
  arl: string;
  acceptsPrivacy: boolean;
  acceptsTerms: boolean; // NUEVO

  // evento existente
  eventId: string;

  // Road user
  roadUserType: string;

  // Licencia (solo UI)
  licenseIssueDate: string;
  licenseValidThru: string;
  allowedCategories: string[];
  restrictions: string;

  // FOTO
  photo: string | null;
  photoConfirmed: boolean;

  // QR
  qrCodeText?: string;
}

// ---------- catálogos UI ----------
const documentTypes = [
  { value: "1", label: "Cédula de Ciudadanía (CC)" },
  { value: "2", label: "Cédula de Extranjería (CE)" },
  { value: "3", label: "Pasaporte" },
];

const genderOptions = [
  { value: "1", label: "Masculino" },
  { value: "2", label: "Femenino" },
];

const roadUserTypes = [
  { value: "pedestrian", label: "Peatón", icon: User },
  { value: "cyclist", label: "Ciclista", icon: User },
  { value: "driver", label: "Conductor", icon: Car },
];

const licenseCategories = [
  { value: "A1", label: "A1 - Motocicletas hasta 125cc" },
  { value: "A2", label: "A2 - Motocicletas más de 125cc" },
  { value: "B1", label: "Automóviles, camperos, camionetas" },
  { value: "B2", label: "Camiones rígidos, buses" },
  { value: "B3", label: "Vehículos articulados" },
  { value: "C1", label: "Taxi" },
  { value: "C2", label: "Transporte público colectivo" },
  { value: "C3", label: "Transporte público masivo" },
];

// ---------- reglas doc ----------
type DocRule = {
  normalize: (s: string) => string;
  regex: RegExp;
  error: string;
  example: string;
};
const onlyDigits = (s: string) => s.replace(/[^\d]/g, "");
const removeSepAndUpper = (s: string) =>
  s.replace(/[.\-\s]/g, "").toUpperCase();

const DOC_RULES: Record<string, DocRule> = {
  "1": {
    normalize: onlyDigits,
    regex: /^\d{6,12}$/,
    error: "La CC debe tener 6–12 dígitos (sin puntos ni guiones).",
    example: "1025489632",
  },
  "2": {
    normalize: removeSepAndUpper,
    regex: /^[A-Z0-9]{6,15}$/,
    error: "La CE debe ser alfanumérica (6–15 caracteres).",
    example: "XE12345",
  },
  "3": {
    normalize: removeSepAndUpper,
    regex: /^[A-Z0-9]{5,15}$/,
    error: "El pasaporte debe ser alfanumérico (5–15 caracteres).",
    example: "PA1234567",
  },
};

// =====================================================

export default function UserRegistration() {
  const supabase = useMemo(() => getSupabase(), []);
  const [currentStep, setCurrentStep] = useState(1);

  const [formData, setFormData] = useState<FormData>({
    name: "",
    lastname: "",
    documentType: "",
    documentNumber: "",
    birthdate: "",
    Sexo: "",
    phoneNumber: "",
    email: "",
    company: "",
    arl: "",
    acceptsPrivacy: false,
    acceptsTerms: false, // NUEVO
    eventId: "",
    roadUserType: "",
    licenseIssueDate: "",
    licenseValidThru: "",
    allowedCategories: [],
    restrictions: "",
    photo: null,
    photoConfirmed: false,
  });

  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [docCheckLoading, setDocCheckLoading] = useState(false);
  const [docExistsError, setDocExistsError] = useState<string | null>(null);
  const [docIsValid, setDocIsValid] = useState<boolean | null>(null);
  const [docFormatError, setDocFormatError] = useState<string | null>(null);

  // eventos
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [refreshingEvents, setRefreshingEvents] = useState(false);

  // ---------------- helpers form ----------------
  const updateFormData = (
    field: keyof FormData,
    value: string | string[] | boolean | null
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value as any }));
  };
  const handleCategoryChange = (category: string, checked: boolean) => {
    const updated = checked
      ? [...formData.allowedCategories, category]
      : formData.allowedCategories.filter((c) => c !== category);
    updateFormData("allowedCategories", updated);
  };
  const needsLicenseInfo = () => ["driver"].includes(formData.roadUserType);

  const validateDocFormatByType = (docType: string, rawValue: string) => {
    const rule = DOC_RULES[docType];
    if (!rule)
      return {
        ok: false,
        normalized: "",
        error: "Selecciona un tipo de documento.",
      };
    const normalized = rule.normalize(rawValue ?? "");
    if (!normalized)
      return {
        ok: false,
        normalized,
        error: "Ingresa un número de documento.",
      };
    const ok = rule.regex.test(normalized);
    return { ok, normalized, error: ok ? null : rule.error };
  };
  const getDocPlaceholder = (docType: string) =>
    DOC_RULES[docType]?.example ?? "Ingrese número de documento";

  const checkDocumentExists = async (
    docType: string,
    docNumber: string,
    setLoading: (v: boolean) => void,
    setError: (v: string | null) => void
  ) => {
    setLoading(true);
    setError(null);
    try {
      const dt = Number.parseInt(docType);
      if (Number.isNaN(dt)) {
        setError("Selecciona un tipo de documento válido.");
        return true;
      }
      const dn = (docNumber ?? "").trim().replace(/[.\-\s]/g, "");
      const { count, error } = await supabase
        .from("users_table")
        .select("id", { count: "exact", head: true })
        .eq("doc_type", dt)
        .eq("doc_number", dn);
      if (error) throw error;
      return (count ?? 0) > 0;
    } catch (err) {
      console.error("Error checking document:", err);
      setError("No se pudo validar el documento. Intente de nuevo.");
      return true;
    } finally {
      setLoading(false);
    }
  };

  // ---------------- cargar eventos existentes ----------------
  const mapEventRow = (row: any): EventOption => {
    const dept = row?.departments_table?.name ?? "Depto";
    const muni = row?.municipalities_table?.name ?? "Municipio";
    const nm = row?.name ?? "(sin nombre)";
    const date = row?.event_date ?? "";
    return {
      id: row.id,
      name: row.name,
      event_date: date,
      dept,
      muni,
      label: `${date} — ${nm} — ${dept} / ${muni}`,
    };
  };

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    setEventsError(null);
    try {
      const { data, error } = await supabase
        .from("events_table")
        .select(
          `
          id,
          name,
          event_date,
          created_at,
          department_id,
          municipality_id,
          departments_table ( name ),
          municipalities_table ( name )
        `
        )
        .order("event_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      const opts = (data ?? []).map(mapEventRow);
      setEvents(opts);
      if (opts.length && !formData.eventId) {
        updateFormData("eventId", String(opts[0].id));
      }
    } catch (e: any) {
      setEventsError(e.message || "No se pudieron cargar los eventos");
    } finally {
      setEventsLoading(false);
    }
  }, [supabase, formData.eventId]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const refreshEvents = async () => {
    setRefreshingEvents(true);
    await loadEvents();
    setRefreshingEvents(false);
  };

  // ---------------- validaciones por paso ----------------
  const canProceedToNextStep = () => {
    let result = false;
    if (currentStep === 1) {
      result =
        formData.name &&
        formData.lastname &&
        formData.documentType &&
        formData.documentNumber &&
        formData.birthdate &&
        isAdult(formData.birthdate) &&
        formData.Sexo &&
        formData.phoneNumber &&
        formData.email &&
        formData.company &&
        formData.arl &&
        formData.acceptsPrivacy &&
        formData.acceptsTerms && // NUEVO
        formData.eventId &&
        docIsValid === true;
    } else if (currentStep === 2) {
      if (!formData.roadUserType) return false;
      if (needsLicenseInfo()) {
        result = !!(
          formData.licenseIssueDate &&
          formData.licenseValidThru &&
          formData.allowedCategories.length > 0
        );
      } else {
        result = true;
      }
    } else if (currentStep === 3) {
      result = !!(formData.photo && formData.photoConfirmed);
    } else if (currentStep === 4) {
      result = !!qrCodeUrl;
    }
    return !!result;
  };

  // Guardia impresión/descarga/compartir
  const canPrintOrDownload = () => {
    return (
      Boolean(qrCodeUrl) &&
      Boolean(registrationId) &&
      formData.photoConfirmed === true &&
      formData.acceptsPrivacy === true &&
      formData.acceptsTerms === true
    );
  };

  // ---------------- secciones UI ----------------
  const renderEventPicker = () => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-gray-200">
          Selecciona el evento existente *
        </Label>
        <Button
          type="button"
          onClick={refreshEvents}
          variant="ghost"
          size="sm"
          className="text-gray-300 hover:text-[#ff7700]"
          disabled={eventsLoading || refreshingEvents}
          title="Recargar lista de eventos"
        >
          <RefreshCw
            className={`w-4 h-4 ${refreshingEvents ? "animate-spin" : ""}`}
          />
        </Button>
      </div>

      {eventsError && (
        <p className="text-sm text-red-400">
          Error cargando eventos: {eventsError}
        </p>
      )}

      <Select
        value={formData.eventId}
        onValueChange={(v) => updateFormData("eventId", v)}
        disabled={eventsLoading}
      >
        <SelectTrigger className="bg-gray-800 border-gray-600 text-white focus:border-[#ff7700] focus:ring-[#ff7700]">
          <SelectValue
            placeholder={
              eventsLoading
                ? "Cargando eventos..."
                : "Evento (más reciente primero)"
            }
          />
        </SelectTrigger>
        <SelectContent className="bg-gray-800 border-gray-600 max-h-80 overflow-y-auto">
          {events.length === 0 && !eventsLoading && (
            <div className="px-3 py-2 text-sm text-gray-300">
              No hay eventos.{" "}
              <Link
                className="text-[#ff7700] underline"
                href="/dashboard/crearevent"
              >
                Crear evento
              </Link>
            </div>
          )}
          {events.map((ev) => (
            <SelectItem
              key={ev.id}
              value={String(ev.id)}
              className="text-white hover:bg-gray-700"
            >
              {ev.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <p className="text-xs text-gray-400">
        Ordenado por fecha más reciente. Recomendado seleccionar el último
        evento para evitar errores.
      </p>
    </div>
  );

  const renderGeneralDataSection = () => (
    <Card className="bg-gray-900 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <User className="h-5 w-5 text-[#ff7700]" />
          Datos Generales del Usuario
        </CardTitle>
        <CardDescription className="text-gray-300">
          Complete la información personal y elija el evento existente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-gray-200">
              Nombre *
            </Label>
            <Input
              id="name"
              value={formData.name}
              required
              onChange={(e) =>
                updateFormData("name", sanitizeInput(e.target.value, "text"))
              }
              placeholder="Ingrese su nombre"
              className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400 focus:border-[#ff7700] focus:ring-[#ff7700]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastname" className="text-gray-200">
              Apellido *
            </Label>
            <Input
              id="lastname"
              required
              value={formData.lastname}
              onChange={(e) =>
                updateFormData(
                  "lastname",
                  sanitizeInput(e.target.value, "text")
                )
              }
              placeholder="Ingrese su apellido"
              className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400 focus:border-[#ff7700] focus:ring-[#ff7700]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="documentType" className="text-gray-200">
              Tipo de Documento *
            </Label>
            <Select
              value={formData.documentType}
              onValueChange={(value) => updateFormData("documentType", value)}
            >
              <SelectTrigger className="bg-gray-800 border-gray-600 text-white focus:border-[#ff7700] focus:ring-[#ff7700]">
                <SelectValue placeholder="Seleccione tipo de documento" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                {documentTypes.map((type) => (
                  <SelectItem
                    key={type.value}
                    value={type.value}
                    className="text-white hover:bg-gray-700"
                  >
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="documentNumber" className="text-gray-200">
              Número de Documento *
            </Label>
            <Input
              id="documentNumber"
              type="text"
              required
              value={formData.documentNumber}
              onChange={(e) => updateFormData("documentNumber", e.target.value)}
              onBlur={async () => {
                if (!formData.documentType) {
                  setDocFormatError("Selecciona un tipo de documento.");
                  setDocExistsError(null);
                  setDocIsValid(false);
                  return;
                }
                const { ok, normalized, error } = validateDocFormatByType(
                  formData.documentType,
                  formData.documentNumber
                );
                if (!ok) {
                  setDocFormatError(error);
                  setDocExistsError(null);
                  setDocIsValid(false);
                  return;
                }
                setDocFormatError(null);
                const exists = await checkDocumentExists(
                  formData.documentType,
                  normalized,
                  setDocCheckLoading,
                  setDocExistsError
                );
                if (exists) {
                  setDocIsValid(false);
                  setDocExistsError("Este documento ya está registrado");
                } else {
                  setDocIsValid(true);
                  setDocExistsError(null);
                }
              }}
              placeholder={getDocPlaceholder(formData.documentType)}
              className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400 focus:border-[#ff7700] focus:ring-[#ff7700]"
            />
            {docFormatError && (
              <p className="text-red-500 text-sm pt-1">{docFormatError}</p>
            )}
            {!docFormatError && docExistsError && (
              <p className="text-red-500 text-sm pt-1">{docExistsError}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="birthdate" className="text-gray-200">
              Fecha de Nacimiento *
            </Label>
            <Input
              id="birthdate"
              type="date"
              required
              value={formData.birthdate}
              onChange={(e) => updateFormData("birthdate", e.target.value)}
              className="bg-gray-800 border-gray-600 text-white focus:border-[#ff7700] focus:ring-[#ff7700]"
            />
            {formData.birthdate && !isAdult(formData.birthdate) && (
              <p className="text-red-500 text-sm pt-1">
                Debes ser mayor de edad para continuar.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-gray-200">Sexo *</Label>
            <RadioGroup
              value={formData.Sexo}
              onValueChange={(value) => updateFormData("Sexo", value)}
              className="flex flex-wrap gap-4"
            >
              {genderOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={option.value}
                    id={option.value}
                    className="border-gray-600 text-[#ff7700] data-[state=checked]:bg-[#ff7700] data-[state=checked]:border-[#ff7700]"
                  />
                  <Label
                    htmlFor={option.value}
                    className="text-sm text-gray-200"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>

        {/* Selector de evento existente */}
        {renderEventPicker()}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phoneNumber" className="text-gray-200">
              Número de Teléfono *
            </Label>
            <Input
              id="phoneNumber"
              value={formData.phoneNumber}
              type="tel"
              onChange={(e) =>
                updateFormData(
                  "phoneNumber",
                  sanitizeInput(e.target.value, "number")
                )
              }
              placeholder="Ej: 3001234567"
              className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400 focus:border-[#ff7700] focus:ring-[#ff7700]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-200">
              Correo Electrónico *
            </Label>
            <Input
              id="email"
              type="email"
              required
              value={formData.email}
              onChange={(e) =>
                updateFormData("email", sanitizeInput(e.target.value, "email"))
              }
              placeholder="ejemplo@correo.com"
              className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400 focus:border-[#ff7700] focus:ring-[#ff7700]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="company" className="text-gray-200">
              Empresa donde Trabaja *
            </Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) =>
                updateFormData("company", sanitizeInput(e.target.value, "text"))
              }
              placeholder="Nombre de la empresa"
              className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400 focus:border-[#ff7700] focus:ring-[#ff7700]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="arl" className="text-gray-200">
              ARL *
            </Label>
            <Input
              id="arl"
              value={formData.arl}
              onChange={(e) =>
                updateFormData("arl", sanitizeInput(e.target.value, "text"))
              }
              placeholder="Nombre de la ARL"
              className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400 focus:border-[#ff7700] focus:ring-[#ff7700]"
            />
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t border-gray-700">
          <div className="flex items-start space-x-2">
            <Checkbox
              id="acceptsPrivacy"
              checked={formData.acceptsPrivacy}
              onCheckedChange={(checked) =>
                updateFormData("acceptsPrivacy", checked as boolean)
              }
              className="border-gray-600 text-[#ff7700] data-[state=checked]:bg-[#ff7700] data-[state=checked]:border-[#ff7700]"
            />
            <Label htmlFor="acceptsPrivacy" className="text-sm text-gray-300">
              Autorizo el{" "}
              <a
                href="/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#ff7700] hover:underline"
              >
                tratamiento de mis datos personales
              </a>{" "}
              según la política de privacidad.
            </Label>
          </div>

          {/* NUEVO: términos de confidencialidad */}
          <div className="flex items-start space-x-2">
            <Checkbox
              id="acceptsTerms"
              checked={formData.acceptsTerms}
              onCheckedChange={(checked) =>
                updateFormData("acceptsTerms", checked as boolean)
              }
              className="border-gray-600 text-[#ff7700] data-[state=checked]:bg-[#ff7700] data-[state=checked]:border-[#ff7700]"
            />
            <Label htmlFor="acceptsTerms" className="text-sm text-gray-300">
              Acepto los{" "}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#ff7700] hover:underline"
              >
                términos de confidencialidad
              </a>{" "}
              relacionados con el manejo de los datos suministrados.
            </Label>
          </div>

          {(!formData.acceptsPrivacy || !formData.acceptsTerms) && (
            <p className="text-red-500 text-sm pt-2">
              Debes aceptar la política de datos y los términos de
              confidencialidad para continuar.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderRoadUserSection = () => (
    <Card className="bg-gray-900 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Car className="h-5 w-5 text-[#ff7700]" />
          Tipo de Usuario Vial
        </CardTitle>
        <CardDescription className="text-gray-300">
          Seleccione qué tipo de usuario vial es usted
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label className="text-gray-200">Tipo de Usuario Vial *</Label>
          <RadioGroup
            value={formData.roadUserType}
            onValueChange={(value) => updateFormData("roadUserType", value)}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {roadUserTypes.map((type) => {
              const Icon = type.icon;
              return (
                <div
                  key={type.value}
                  className="flex items-center space-x-2 p-3 border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <RadioGroupItem
                    value={type.value}
                    id={type.value}
                    className="border-gray-600 text-[#ff7700] data-[state=checked]:bg-[#ff7700] data-[state=checked]:border-[#ff7700]"
                  />
                  <Label
                    htmlFor={type.value}
                    className="flex items-center gap-2 cursor-pointer text-gray-200"
                  >
                    <Icon className="h-4 w-4 text-[#ff7700]" />
                    {type.label}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        </div>

        {["driver"].includes(formData.roadUserType) && (
          <div className="space-y-4 p-4 border border-gray-600 rounded-lg bg-gray-800">
            <h3 className="font-semibold text-lg text-white">
              Información de Licencia de Conducir
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="licenseIssueDate" className="text-gray-200">
                  Fecha de Expedición *
                </Label>
                <Input
                  id="licenseIssueDate"
                  type="date"
                  value={formData.licenseIssueDate}
                  onChange={(e) =>
                    updateFormData("licenseIssueDate", e.target.value)
                  }
                  className="bg-gray-700 border-gray-600 text-white focus:border-[#ff7700] focus:ring-[#ff7700]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="licenseValidThru" className="text-gray-200">
                  Válida Hasta *
                </Label>
                <Input
                  id="licenseValidThru"
                  type="date"
                  value={formData.licenseValidThru}
                  onChange={(e) =>
                    updateFormData("licenseValidThru", e.target.value)
                  }
                  className="bg-gray-700 border-gray-600 text-white focus:border-[#ff7700] focus:ring-[#ff7700]"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-gray-200">Categorías Permitidas *</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {licenseCategories.map((category) => (
                  <div
                    key={category.value}
                    className="flex items-center space-x-2"
                  >
                    <Checkbox
                      id={category.value}
                      checked={formData.allowedCategories.includes(
                        category.value
                      )}
                      onCheckedChange={(checked) =>
                        handleCategoryChange(category.value, checked as boolean)
                      }
                      className="border-gray-600 text-[#ff7700] data-[state=checked]:bg-[#ff7700] data-[state=checked]:border-[#ff7700]"
                    />
                    <Label
                      htmlFor={category.value}
                      className="text-sm text-gray-200"
                    >
                      {category.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="restrictions" className="text-gray-200">
                Restricciones
              </Label>
              <Input
                id="restrictions"
                value={formData.restrictions}
                onChange={(e) => updateFormData("restrictions", e.target.value)}
                placeholder="Ej: Uso de lentes, horario diurno, etc."
                className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:border-[#ff7700] focus:ring-[#ff7700]"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // ---------------- SECCIÓN 3: Fotografía ----------------
  const renderPhotoSection = () => (
    <Card className="bg-gray-900 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <ImageIcon className="h-5 w-5 text-[#ff7700]" />
          Tomar Fotografía
        </CardTitle>
        <CardDescription className="text-gray-300">
          Tome una fotografía tipo selfie para completar su registro
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-gray-800 border border-[#ff7700] rounded-lg p-4">
          <h3 className="font-semibold text-[#ff7700] mb-2">
            Requisitos para la fotografía:
          </h3>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• Foto tipo selfie mirando directamente a la cámara</li>
            <li>• Buena iluminación y fondo claro</li>
            <li>
              • Sin gafas de sol, gorros o accesorios que cubran el rostro
            </li>
          </ul>
        </div>

        {!formData.photo && (
          <div className="flex justify-center">
            <CameraFrame
              onCapture={(imageDataUrl) => {
                updateFormData("photo", imageDataUrl);
                updateFormData("photoConfirmed", false);
              }}
              width={400}
              height={400}
              aspectRatio="square"
              className="mx-auto"
            />
          </div>
        )}

        {formData.photo && !formData.photoConfirmed && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="relative mx-auto max-w-md">
                <img
                  src={formData.photo || "/placeholder.svg"}
                  alt="Foto tomada"
                  className="w-full h-auto rounded-lg border-2 border-gray-600"
                />
              </div>
            </div>
            <div className="text-center space-y-4">
              <p className="text-lg font-medium text-gray-200">
                ¿Esta foto cumple con los requisitos?
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={() => updateFormData("photoConfirmed", true)}
                  size="lg"
                  className="bg-[#ff7700] hover:bg-[#e66600] text-white"
                >
                  <Check className="h-5 w-5 mr-2" />
                  Confirmar Foto
                </Button>
                <Button
                  onClick={() => {
                    updateFormData("photo", null);
                    updateFormData("photoConfirmed", false);
                  }}
                  variant="outline"
                  className="border-gray-600 text-gray-200 hover:bg-gray-800 hover:text-white bg-transparent"
                >
                  <RotateCcw className="h-5 w-5 mr-2" />
                  Tomar Otra Foto
                </Button>
              </div>
            </div>
          </div>
        )}

        {formData.photo && formData.photoConfirmed && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="relative mx-auto max-w-md">
                <img
                  src={formData.photo || "/placeholder.svg"}
                  alt="Foto confirmada"
                  className="w-full h-auto rounded-lg border-2 border-[#ff7700]"
                />
                <div className="absolute top-2 right-2 bg-[#ff7700] text-white rounded-full p-1">
                  <Check className="h-4 w-4" />
                </div>
              </div>
            </div>
            <div className="text-center space-y-2">
              <p className="text-[#ff7700] font-medium">
                ¡Foto confirmada exitosamente!
              </p>
              <Button
                onClick={() => {
                  updateFormData("photo", null);
                  updateFormData("photoConfirmed", false);
                }}
                variant="outline"
                size="sm"
                className="border-gray-600 text-gray-200 hover:bg-gray-800 hover:text-white bg-transparent"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Tomar Otra Foto
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // ---------------- SECCIÓN 4: QR + impresión ----------------
  const renderQRCodeSection = () => {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Check className="h-5 w-5 text-[#ff7700]" />
            Registro Completado
          </CardTitle>
          <CardDescription className="text-gray-300">
            Su código QR de acceso ha sido generado exitosamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-gray-800 border border-[#ff7700] rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Check className="h-8 w-8 text-[#ff7700]" />
            </div>
            <h3 className="font-semibold text-[#ff7700] mb-1">
              ¡Registro Exitoso!
            </h3>
            <p className="text-gray-300 text-sm">
              Su registro ha sido completado. Use el código QR a continuación
              para el acceso al evento.
            </p>
          </div>

          {/* Tarjeta para imprimir/descargar — FORMATO 44mm x 80mm */}
          <div className="text-center">
            <div
              id="printable-card"
              className="inline-block bg-white rounded-lg shadow-lg overflow-hidden"
              style={{ width: "167px", height: "302px" }}
            >
              <div className="p-2 space-y-2 pb-0 pt-0 shadow-none">
                {/* Foto + datos (vertical) */}
                <div className="space-y-3 py-0 pt-1.5 pb-0 mt-[9px]">
                  <div className="flex justify-center my-0.5">
                    {formData.photo ? (
                      <img
                        src={formData.photo}
                        alt="Foto del usuario"
                        className="w-16 h-16 object-cover rounded border border-gray-300"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded border border-gray-300 flex items-center justify-center">
                        <User className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="text-center space-y-1">
                    <div>
                      <p className="text-xs font-bold text-gray-900 my-0 mb-0 mt-[-6px]">
                        {formData.name} {formData.lastname}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-800 mx-0 mt-[-4px]">
                        {
                          documentTypes.find(
                            (dt) => dt.value === formData.documentType
                          )?.label
                        }
                      </p>
                      <p className="text-sm font-bold">
                        {formData.documentNumber}
                      </p>
                    </div>
                  </div>
                </div>

                {/* QR */}
                <div>
                  <div className="flex items-center justify-center py-1 pt-0 mt-[0px]">
                    <div className="text-center pb-0 pt-0 mb-0 mt-[-13px]">
                      <img
                        src={qrCodeUrl || "/placeholder.svg"}
                        alt="Código QR de Acceso"
                        className="mx-auto mb-auto"
                        style={{ width: "160px", height: "160px" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer (vacío por ahora para respetar layout) */}
                <div></div>
              </div>
            </div>
          </div>

          {/* Acciones QR / imprimir */}
          {!qrCodeUrl && (
            <div className="text-center space-y-4">
              <Button
                onClick={generateQRCode}
                size="lg"
                disabled={isGeneratingQR}
                className="w-full md:w-auto bg-[#ff7700] hover:bg-[#e66600] text-white"
              >
                {isGeneratingQR ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Generando Código QR...
                  </>
                ) : (
                  <>
                    <ImageIcon className="h-5 w-5 mr-2" />
                    Procesar Registro y Generar QR
                  </>
                )}
              </Button>
            </div>
          )}

          {qrCodeUrl && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {/* Descargar tarjeta con escalado 44mm x 80mm @300DPI */}
                <Button
                  onClick={async () => {
                    if (!canPrintOrDownload()) {
                      alert(
                        "Para continuar debes confirmar la foto, aceptar privacidad y términos, y generar el QR."
                      );
                      return;
                    }
                    const printableCard =
                      document.getElementById("printable-card");
                    if (!printableCard) return;
                    const html2canvas = await import("html2canvas");

                    const mmToPx = (mm: number) =>
                      Math.round((mm * 300) / 25.4); // 300 DPI
                    const targetWidth = mmToPx(44); // 44mm
                    const targetHeight = mmToPx(80); // 80mm

                    html2canvas
                      .default(printableCard, {
                        width: 167,
                        height: 302,
                        scale: targetWidth / 167,
                        useCORS: true,
                        allowTaint: true,
                        backgroundColor: "#ffffff",
                      })
                      .then((canvas) => {
                        const finalCanvas = document.createElement("canvas");
                        const ctx = finalCanvas.getContext("2d");
                        finalCanvas.width = targetWidth * 2;
                        finalCanvas.height = targetHeight * 2;
                        if (ctx) {
                          ctx.fillStyle = "#ffffff";
                          ctx.fillRect(
                            0,
                            0,
                            finalCanvas.width,
                            finalCanvas.height
                          );
                          ctx.drawImage(
                            canvas,
                            0,
                            0,
                            finalCanvas.width,
                            finalCanvas.height
                          );
                        }
                        const link = document.createElement("a");
                        link.download = `tarjeta-registro-${formData.name.replace(
                          /\s+/g,
                          "_"
                        )}_${formData.lastname.replace(/\s+/g, "_")}.png`;
                        link.href = finalCanvas.toDataURL("image/png");
                        link.click();
                      })
                      .catch(() => {
                        const link = document.createElement("a");
                        link.download = `qr-${formData.qrCodeText}.png`;
                        link.href = qrCodeUrl!;
                        link.click();
                      });
                  }}
                  disabled={!canPrintOrDownload()}
                  variant="outline"
                  className="flex-1 sm:flex-none border-gray-600 text-gray-700 hover:bg-gray-800 hover:text-white hover:border-[#ff7700]"
                >
                  <Upload className="h-6 w-6 mr-2" />
                  Descargar QR
                </Button>

                {/* Imprimir con parametrización EXACTA 44mm x 80mm */}
                <Button
                  onClick={async () => {
                    if (!canPrintOrDownload()) {
                      alert(
                        "Para continuar debes confirmar la foto, aceptar privacidad y términos, y generar el QR."
                      );
                      return;
                    }
                    const printContent =
                      document.getElementById("printable-card");
                    if (!printContent) return;

                    const printWindow = window.open(
                      "",
                      "_blank",
                      "width=600,height=800"
                    );
                    if (!printWindow) return;

                    printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Registro de Usuario Vial - ${`${formData.name} ${formData.lastname}`}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page {
      size: 44mm 80mm;
      margin: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: Arial, sans-serif;
      background: white;
      margin: 0;
      padding: 0;
      width: 44mm;
      height: 80mm;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
    }
    .print-container {
      background: white;
      border-radius: 1.5mm;
      border: 0.5mm solid #ff7700;
      overflow: hidden;
      width: 44mm;
      height: 80mm;
      display: flex;
      flex-direction: column;
      position: relative;
      box-shadow: none;
    }
    .content {
      padding: 1.5mm;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 100%;
    }
    .user-section {
      text-align: center;
      margin-bottom: 1mm;
      flex-shrink: 0;
    }
    .photo {
      width: 16mm; height: 16mm;
      object-fit: cover;
      border-radius: 1mm;
      border: 0.3mm solid #d1d5db;
      margin: 0 auto 1mm auto;
      display: block;
      margin-top: 20px;
    }
    .photo-placeholder {
      width: 14mm; height: 14mm;
      background: #f3f4f6;
      border-radius: 1mm;
      border: 0.3mm solid #d1d5db;
      display: flex; align-items: center; justify-content: center;
      color: #9ca3af; margin: 0 auto 1mm auto; font-size: 7mm;
    }
    .user-name {
      font-size: 3mm; font-weight: bold; color: #111827; line-height: 1.1;
      margin-bottom: 0.5mm; word-wrap: break-word; max-width: 40mm;
    }
    .doc-type { font-size: 2.2mm; font-weight: 600; color: #374151; margin-bottom: 0.3mm; }
    .doc-number { font-size: 3.2mm; font-weight: bold; color: #ff7700; margin-bottom: 1mm; }
    .qr-section { text-align: center; flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 0; }
    .qr-code {
      width: 100%; height: 100%; margin: 0 auto; display: block;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
      image-rendering: pixelated;
    }
    .qr-label { font-size: 1.8mm; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.1mm; margin-top: 1mm; margin-bottom: 0.5mm; }
    .qr-id { font-size: 2.2mm; font-weight: bold; color: #ff7700; word-break: break-all; max-width: 40mm; line-height: 1.1; }
    
    @media print {
      html, body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        width: 44mm !important; height: 80mm !important; margin: 0 !important; padding: 0 !important;
      }
      .print-container {
        border: 0.5mm solid #ff7700 !important;
        width: 44mm !important; height: 80mm !important;
        page-break-inside: avoid;
      }
      .photo { filter: contrast(1.3) brightness(1.1) saturate(1.1); }
      .qr-code { filter: contrast(1.2) brightness(0.95); image-rendering: -webkit-optimize-contrast !important; image-rendering: crisp-edges !important; }
      .header-strip, .footer-strip { background: #ff7700 !important; }
    }
    @media screen {
      body { background: #f0f0f0; padding: 10mm; }
      .print-container { box-shadow: 0 2mm 8mm rgba(0,0,0,0.1); }
    }
  </style>
</head>
<body>
  <div class="print-container">
    <div class="header-strip"></div>
    <div class="content">
      <div class="user-section">
        ${
          formData.photo
            ? `<img src="${formData.photo}" alt="Foto del usuario" class="photo" crossorigin="anonymous" />`
            : `<div class="photo-placeholder">👤</div>`
        }
        <div class="user-name">${`${formData.name} ${formData.lastname}`}</div>
       
        <div class="doc-number">${formData.documentNumber}</div>
      </div>
      <div class="qr-section">
        <img src="${qrCodeUrl}" alt="Código QR de Acceso" class="qr-code" crossorigin="anonymous" />
      </div>
    </div>
  </div>
  <script>
    window.onload = function() {
      const images = document.querySelectorAll('img');
      let loadedImages = 0;
      const totalImages = images.length;
      function tryPrint() {
        setTimeout(() => { window.print(); window.close(); }, 500);
      }
      if (totalImages === 0) { tryPrint(); return; }
      images.forEach(img => {
        if (img.complete) {
          loadedImages++;
        } else {
          img.onload = () => {
            loadedImages++;
            if (loadedImages === totalImages) { tryPrint(); }
          };
          img.onerror = () => {
            loadedImages++;
            if (loadedImages === totalImages) { tryPrint(); }
          };
        }
      });
      if (loadedImages === totalImages) { tryPrint(); }
    };
  </script>
</body>
</html>
`);
                    printWindow.document.close();
                  }}
                  disabled={!canPrintOrDownload()}
                  variant="outline"
                  className="flex-1 sm:flex-none border-gray-600 text-gray-700 hover:bg-gray-800 hover:text-white hover:border-[#ff7700]"
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Imprimir
                </Button>

                {/* Compartir QR */}
                <Button
                  onClick={() => {
                    if (!canPrintOrDownload()) {
                      alert(
                        "Para continuar debes confirmar la foto, aceptar privacidad y términos, y generar el QR."
                      );
                      return;
                    }
                    if (navigator.share && qrCodeUrl) {
                      navigator.share({
                        title: "Mi Código QR de Registro",
                        text: `Código QR para acceso al evento - Código: ${formData.qrCodeText}`,
                        url: qrCodeUrl,
                      });
                    }
                  }}
                  disabled={!canPrintOrDownload()}
                  variant="outline"
                  className="flex-1 sm:flex-none border-gray-600 text-gray-700 hover:bg-gray-800 hover:text-white hover:border-[#ff7700]"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Compartir
                </Button>
              </div>

              <div className="text-center p-4 bg-gradient-to-r from-gray-800 to-gray-700 rounded-lg border border-[#ff7700]">
                <h3 className="font-semibold text-white mb-2">
                  ¡Registro Completado!
                </h3>
                <p className="text-gray-300 text-sm">
                  Su registro ha sido procesado exitosamente. ¡Nos vemos en el
                  evento!
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // ---------------- acción principal (generar QR + insert DB) ----------------
  const generateQRCode = useCallback(async () => {
    setIsGeneratingQR(true);
    try {
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const regId = `REG-${timestamp}-${randomId}`;
      setRegistrationId(regId);

      // 1) Generar QR único en DB
      let qrCodeText = "";
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 5) {
        attempts++;
        qrCodeText = (
          Math.random().toString(36).substring(2, 15) +
          Math.random().toString(36).substring(2, 4)
        )
          .toUpperCase()
          .substring(0, 15);

        const { data: existingQR, error: qrCheckError } = await supabase
          .from("users_table")
          .select('"qr_code"')
          .eq("qr_code", qrCodeText)
          .maybeSingle();

        if (qrCheckError) console.error("Error verificando QR:", qrCheckError);
        if (!existingQR) isUnique = true;
      }
      if (!isUnique) throw new Error("No se pudo generar un QR único");

      // 2) Normalizar documento
      const { normalized: normalizedDoc } = validateDocFormatByType(
        formData.documentType,
        formData.documentNumber
      );

      // 3) Insertar usuario
      const road_user_type =
        ({ pedestrian: 1, cyclist: 2, driver: 3 } as const)[
          formData.roadUserType as "pedestrian" | "cyclist" | "driver"
        ] ?? null;

      const userData = {
        name: formData.name,
        lastname: formData.lastname,
        doc_type: Number.parseInt(formData.documentType),
        doc_number: normalizedDoc,
        birthdate: formData.birthdate,
        gender_id: Number.parseInt(formData.Sexo),
        phone_number: formData.phoneNumber,
        email: formData.email,
        company_name: formData.company,
        arl: formData.arl,
        qr_code: qrCodeText,
        road_user_type,
      };

      let newUserId: number | null = null;
      let insertErr: any = null;

      {
        const { data, error } = await supabase
          .from("users_table")
          .insert(userData)
          .select("id")
          .single();
        if (!error) {
          newUserId = data!.id;
        } else if (error.code === "42703") {
          const { data: d2, error: e2 } = await supabase
            .from("users_table")
            .insert({ ...userData, road_user_type: undefined })
            .select("id")
            .single();
          insertErr = e2;
          newUserId = d2?.id ?? null;
        } else {
          insertErr = error;
        }
      }
      if (!newUserId) {
        console.error("Error insertando usuario:", insertErr);
        throw insertErr;
      }

      // 4) Vincular con evento seleccionado
      const eventId = Number(formData.eventId);
      if (!eventId || Number.isNaN(eventId)) {
        throw new Error("Evento no seleccionado");
      }
      const { error: attErr } = await supabase
        .from("event_attendees")
        .insert({ event_id: eventId, user_id: newUserId! });
      if (attErr && attErr.code !== "23505") {
        console.error("Error vinculando event_attendees:", attErr);
        throw attErr;
      }

      // 4.5) licencia/categorías (si corresponde)
      try {
        if (
          formData.roadUserType === "driver" &&
          formData.licenseIssueDate &&
          formData.licenseValidThru &&
          formData.allowedCategories.length > 0
        ) {
          const { data: licenseRow, error: licErr } = await supabase
            .from("licenses")
            .insert({
              user_id: newUserId!,
              license_number: formData.documentNumber,
              issued_at: formData.licenseIssueDate,
              expires_at: formData.licenseValidThru,
              restrictions: formData.restrictions || null,
            })
            .select("id")
            .single();
          if (licErr) throw licErr;

          const { data: catRows, error: catErr } = await supabase
            .from("license_categories")
            .select("id, code")
            .in("code", formData.allowedCategories);
          if (catErr) throw catErr;

          const links = (catRows ?? []).map((c) => ({
            license_id: licenseRow!.id,
            category_id: c.id,
          }));
          if (links.length > 0) {
            const { error: linkErr } = await supabase
              .from("license_category_links")
              .upsert(links, {
                onConflict: "license_id,category_id",
                ignoreDuplicates: true,
              });
            if (linkErr) throw linkErr;
          }
        }
      } catch (e) {
        console.error("Error registrando licencia/categorías:", e);
      }

      // --- SUBIR FOTO A STORAGE Y GUARDAR photo_url ---
        const BUCKET_NAME = "userphoto";

        function dataUrlToBlob(dataUrl: string, contentType = "image/jpeg") {
          const base64 = dataUrl.split(",")[1] ?? dataUrl;
          const byteChars = atob(base64);
          const byteNumbers = new Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
          const byteArray = new Uint8Array(byteNumbers);
          return new Blob([byteArray], { type: contentType });
        }

        try {
          if (formData.photo) {
            const blob = dataUrlToBlob(formData.photo, "image/jpeg");
            const filePath = `users/${newUserId}/photo_${Date.now()}.jpg`;

            const { error: upErr } = await supabase
              .storage.from(BUCKET_NAME)
              .upload(filePath, blob, { contentType: "image/jpeg", upsert: true });

            if (upErr) {
              console.error("Upload foto error:", upErr);
            } else {
              // Si tu bucket es público:
              const { data: pub } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
              const publicUrl = pub.publicUrl;

              // Si tu bucket es privado y prefieres guardar el path:
              // const publicUrl = filePath;

              const { error: updErr } = await supabase
                .from("users_table")
                .update({ photo_url: publicUrl })
                .eq("id", newUserId);

              if (updErr) console.error("Update photo_url error:", updErr);
            }
          }
        } catch (e) {
          console.error("No se pudo guardar la foto:", e);
        }

      // 5) Generar imagen del QR (SIN overlay de texto; tal cual QR)
      const qrCanvas = document.createElement("canvas");
      await QRCode.toCanvas(qrCanvas, qrCodeText, {
        width: 200,
        margin: 1,
        color: { dark: "#1f2937", light: "#ffffff" },
        errorCorrectionLevel: "H",
      });
      setQrCodeUrl(qrCanvas.toDataURL("image/png", 1.0));
      setFormData((prev) => ({ ...prev, qrCodeText }));
    } catch (error) {
      console.error("Error en generateQRCode:", error);
      alert("Error al procesar el registro.");
    } finally {
      setIsGeneratingQR(false);
    }
  }, [formData, supabase]);

  // ---------------- layout principal ----------------
  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Registro de Usuario Vial
          </h1>
          <p className="text-gray-300">
            Complete el formulario de registro paso a paso
          </p>
        </div>

        {/* Progreso (4 pasos) */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  step <= currentStep
                    ? "bg-[#ff7700] text-white"
                    : "bg-gray-700 text-gray-400"
                }`}
              >
                {step}
              </div>
            ))}
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-[#ff7700] h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Secciones */}
        <div className="space-y-6">
          {currentStep === 1 && renderGeneralDataSection()}
          {currentStep === 2 && renderRoadUserSection()}
          {currentStep === 3 && renderPhotoSection()}
          {currentStep === 4 && renderQRCodeSection()}
        </div>

        {/* Navegación */}
        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="border-gray-600 text-gray-700 hover:bg-gray-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </Button>

          {currentStep < 4 ? (
            <Button
              onClick={async () => {
                if (currentStep === 1) {
                  if (docIsValid !== true) {
                    if (!formData.documentType) {
                      setDocFormatError("Selecciona un tipo de documento.");
                      setDocIsValid(false);
                      return;
                    }
                    const { ok, normalized, error } = validateDocFormatByType(
                      formData.documentType,
                      formData.documentNumber
                    );
                    if (!ok) {
                      setDocFormatError(error);
                      setDocIsValid(false);
                      return;
                    }
                    setDocFormatError(null);
                    const exists = await checkDocumentExists(
                      formData.documentType,
                      normalized,
                      setDocCheckLoading,
                      setDocExistsError
                    );
                    if (exists) {
                      setDocIsValid(false);
                      setDocExistsError("Este documento ya está registrado");
                      return;
                    }
                    setDocExistsError(null);
                    setDocIsValid(true);
                  }

                  if (!canProceedToNextStep()) return;
                }
                if (!canProceedToNextStep()) return;
                setCurrentStep(currentStep + 1);
              }}
              disabled={
                !canProceedToNextStep() || docCheckLoading || eventsLoading
              }
              className="bg-[#ff7700] hover:bg-[#e66600] text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {docCheckLoading ? "Verificando..." : "Siguiente"}
            </Button>
          ) : (
            <Button
              onClick={() => {
                setFormData({
                  name: "",
                  lastname: "",
                  documentType: "",
                  documentNumber: "",
                  birthdate: "",
                  Sexo: "",
                  phoneNumber: "",
                  email: "",
                  company: "",
                  arl: "",
                  acceptsPrivacy: false,
                  acceptsTerms: false, // NUEVO
                  eventId: "",
                  roadUserType: "",
                  licenseIssueDate: "",
                  licenseValidThru: "",
                  allowedCategories: [],
                  restrictions: "",
                  photo: null,
                  photoConfirmed: false,
                });
                setQrCodeUrl(null);
                setRegistrationId(null);
                setCurrentStep(1);
              }}
              disabled={!canProceedToNextStep()}
              className="w-full md:w-auto bg-[#ff7700] hover:bg-[#e66600] text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Registrar Otro Usuario
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
