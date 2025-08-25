"use client";

import { useMemo, useState, useCallback } from "react";
import QRCode from "qrcode";
import { getSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Printer, User as UserIcon } from "lucide-react";

// Tipos de documento
const documentTypes = [
  { value: "1", label: "Cédula de Ciudadanía (CC)" },
  { value: "2", label: "Cédula de Extranjería (CE)" },
  { value: "3", label: "Pasaporte" },
];

// Normalización/validación por tipo
type DocRule = { normalize: (s: string) => string; regex: RegExp; error: string; example: string };
const onlyDigits = (s: string) => s.replace(/[^\d]/g, "");
const removeSepAndUpper = (s: string) => s.replace(/[.\-\s]/g, "").toUpperCase();

const DOC_RULES: Record<string, DocRule> = {
  "1": { normalize: onlyDigits, regex: /^\d{6,12}$/, error: "La CC debe tener 6–12 dígitos.", example: "1025489632" },
  "2": { normalize: removeSepAndUpper, regex: /^[A-Z0-9]{6,15}$/, error: "La CE debe ser alfanumérica (6–15).", example: "XE12345" },
  "3": { normalize: removeSepAndUpper, regex: /^[A-Z0-9]{5,15}$/, error: "Pasaporte alfanumérico (5–15).", example: "PA1234567" },
};

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export default function ReimprimirCarnet() {
  const supabase = useMemo(() => getSupabase(), []);

  const [docType, setDocType] = useState<string>("");
  const [docNumber, setDocNumber] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [user, setUser] = useState<{
    id: number;
    name: string | null;
    lastname: string | null;
    doc_type: number | null;
    doc_number: string | null;
    photo_url: string | null;
    qr_code: string | null;
  } | null>(null);

  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  const validateAndNormalize = (type: string, value: string) => {
    const rule = DOC_RULES[type];
    if (!rule) return { ok: false, normalized: "", error: "Selecciona el tipo de documento." };
    const normalized = rule.normalize(value ?? "");
    if (!normalized) return { ok: false, normalized, error: "Ingresa el número de documento." };
    const ok = rule.regex.test(normalized);
    return { ok, normalized, error: ok ? null : rule.error };
  };

  const fetchUser = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setUser(null);
    setQrCodeUrl(null);

    try {
      if (!docType) {
        setErr("Selecciona el tipo de documento.");
        return;
      }
      const { ok, normalized, error } = validateAndNormalize(docType, docNumber);
      if (!ok) {
        setErr(error || "Documento inválido.");
        return;
      }

      const { data: u, error: uErr } = await supabase
        .from("users_table")
        .select("id, name, lastname, doc_type, doc_number, photo_url, qr_code")
        .eq("doc_type", Number(docType))
        .eq("doc_number", normalized)
        .maybeSingle();

      if (uErr) throw uErr;
      if (!u) {
        setErr("No se encontró un usuario con ese documento.");
        return;
      }
      setUser(u as any);

      if (u.qr_code) {
        const dataUrl = await QRCode.toDataURL(u.qr_code, {
          width: 500,
          margin: 1,
          color: { dark: "#1f2937", light: "#ffffff" },
          errorCorrectionLevel: "H",
        });
        setQrCodeUrl(dataUrl);
      } else {
        setErr("El usuario no tiene QR registrado.");
      }
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "No se pudo buscar el usuario.");
    } finally {
      setLoading(false);
    }
  }, [docType, docNumber, supabase]);

  const handlePrint = useCallback(() => {
    if (!user || !qrCodeUrl) {
      alert("Busca un usuario y genera el QR antes de imprimir.");
      return;
    }

    const fullName = `${user.name ?? ""} ${user.lastname ?? ""}`.trim();
    const safeName = escapeHtml(fullName);
    const safeDoc = escapeHtml(user.doc_number ?? "");

    const photoBlock = user.photo_url
      ? `<img src="${user.photo_url}" alt="Foto del usuario" class="photo" crossorigin="anonymous" />`
      : `<div class="photo-placeholder">👤</div>`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Registro de Usuario Vial - ${safeName}</title>
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
    .doc-number { font-size: 3.2mm; font-weight: bold; color: #ff7700; margin-bottom: 1mm; }
    .qr-section { text-align: center; flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 0; }
    .qr-code {
      width: 100%; height: 100%; margin: 0 auto; display: block;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
      image-rendering: pixelated;
    }
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
    }
    @media screen {
      body { background: #f0f0f0; padding: 10mm; }
      .print-container { box-shadow: 0 2mm 8mm rgba(0,0,0,0.1); }
    }
  </style>
</head>
<body>
  <div class="print-container">
    <div class="content">
      <div class="user-section">
        ${photoBlock}
        <div class="user-name">${safeName}</div>
        <div class="doc-number">${safeDoc}</div>
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
      function tryPrint() { setTimeout(() => { window.print(); window.close(); }, 500); }
      if (totalImages === 0) { tryPrint(); return; }
      images.forEach(img => {
        if (img.complete) {
          loadedImages++;
        } else {
          img.onload = () => { loadedImages++; if (loadedImages === totalImages) { tryPrint(); } };
          img.onerror = () => { loadedImages++; if (loadedImages === totalImages) { tryPrint(); } };
        }
      });
      if (loadedImages === totalImages) { tryPrint(); }
    };
  </script>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }, [user, qrCodeUrl]);

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Reimprimir carnet</h1>
          <p className="text-gray-300">Busca por tipo y número de documento. Se imprimirá sin evento ni fecha.</p>
        </div>

        <Card className="bg-gray-900 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <UserIcon className="h-5 w-5 text-[#ff7700]" />
              Buscar usuario
            </CardTitle>
            <CardDescription className="text-gray-300">
              Selecciona el tipo de documento e ingresa el número (sin puntos ni guiones)
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[220px_1fr_auto] gap-2">
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                  <SelectValue placeholder="Tipo de documento" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  {documentTypes.map((dt) => (
                    <SelectItem key={dt.value} value={dt.value} className="text-white hover:bg-gray-700">
                      {dt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                placeholder={
                  docType ? `Número (${DOC_RULES[docType].example})` : "Número de documento"
                }
                className="bg-gray-800 border-gray-600 text-white"
                onKeyDown={(e) => e.key === "Enter" && fetchUser()}
              />

              <Button onClick={fetchUser} disabled={loading} className="bg-[#ff7700] hover:bg-[#e66600] text-white">
                <Search className="w-4 h-4 mr-2" />
                {loading ? "Buscando..." : "Buscar"}
              </Button>
            </div>

            {err && <p className="text-sm text-red-400">{err}</p>}

            {user && (
              <div className="space-y-4 pt-2 border-t border-gray-700">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-300">Nombre</Label>
                    <p className="text-white font-medium">
                      {`${user.name ?? ""} ${user.lastname ?? ""}`.trim() || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-300">Documento</Label>
                    <p className="text-white font-medium">{user.doc_number || "-"}</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handlePrint}
                    disabled={!qrCodeUrl}
                    className="bg-[#ff7700] hover:bg-[#e66600] text-white"
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Imprimir carnet
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
