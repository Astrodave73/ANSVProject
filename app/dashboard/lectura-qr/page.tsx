"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { VerificationPopup } from "@/components/verification-popup";
import { Camera, CheckCircle2, AlertCircle, Bug, BugOff } from "lucide-react";

import { ScanService } from "@/lib/services/ScanService";

type ScanPhase =
  | "initializing"
  | "camera-starting"
  | "scanning"
  | "processing"
  | "complete"
  | "error";

declare global {
  interface Window {
    jsQR: any;
  }
}

export default function QRScannerPage() {
  // --- UI state
  const [scanPhase, setScanPhase] = useState<ScanPhase>("initializing");
  const [hasCamera, setHasCamera] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<string>("unknown");
  const [jsQRLoaded, setJsQRLoaded] = useState(false);

  // --- simulator
  const [simulatorId, setSimulatorId] = useState<string>("");
  const [simulatorVerifying, setSimulatorVerifying] = useState(false);
  const [simulatorVerified, setSimulatorVerified] = useState(false);
  const [simulatorVerificationError, setSimulatorVerificationError] =
    useState("");

  // --- scanning state
  const [scannedData, setScannedData] = useState("");
  const [scanSuccess, setScanSuccess] = useState(false);
  const [error, setError] = useState("");

  // --- verification popup
  const [showVerificationPopup, setShowVerificationPopup] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(
    null
  );
  const [userRecord, setUserRecord] = useState<any>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  // --- debug
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [scanAttempts, setScanAttempts] = useState(0);

  // --- refs
  const isBrowser = typeof window !== "undefined";
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRestartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const lastScannedCodeRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);
  const scanningActiveRef = useRef<boolean>(false);
  const simulatorVerifiedRef = useRef<boolean>(false);
  const simulatorIdRef = useRef<string>("");

  const addDebugLog = useCallback((msg: string) => {
    console.log(`[QR] ${msg}`);
    setDebugInfo((prev) => [
      ...prev.slice(-9),
      `${new Date().toLocaleTimeString()}: ${msg}`,
    ]);
  }, []);

  // ====== LOAD jsQR ======
  useEffect(() => {
    addDebugLog("Loading jsQR...");
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
    script.onload = () => {
      setJsQRLoaded(true);
      addDebugLog("jsQR loaded");
    };
    script.onerror = () => {
      setError("Failed to load QR library");
      addDebugLog("jsQR load failed");
      setScanPhase("error");
    };
    document.head.appendChild(script);
    return () => {
      if (document.head.contains(script)) document.head.removeChild(script);
    };
  }, [addDebugLog]);

  // ====== CAMERA PERMISSIONS ======
  const checkPermissions = async () => {
    if (!isBrowser || !navigator.permissions) {
      addDebugLog("Permissions API not available");
      return;
    }
    try {
      const permission = await navigator.permissions.query({
        name: "camera" as PermissionName,
      });
      setPermissionStatus(permission.state);
      permission.onchange = () => setPermissionStatus(permission.state);
    } catch {
      addDebugLog("Could not check camera permissions");
    }
  };

  // ====== CAMERA AVAILABILITY ======
  const checkCameraAvailability = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setHasCamera(false);
        setError("Camera not supported on this device");
        return;
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      setHasCamera(videoDevices.length > 0);
      if (!videoDevices.length) setError("No camera found on this device");
    } catch (err) {
      setHasCamera(false);
      setError("Unable to access camera");
    }
  };

  // ====== INIT SCANNER ======
  useEffect(() => {
    const init = async () => {
      await checkCameraAvailability();
      await checkPermissions();

      const tryStart = () => {
        if (jsQRLoaded && hasCamera) {
          startScanCycle();
        } else if (!hasCamera) {
          setScanPhase("error");
        } else {
          setTimeout(tryStart, 400);
        }
      };
      tryStart();
    };
    init();
    return () => cleanup();
  }, [jsQRLoaded, hasCamera]);

  // ====== VERIFY SIMULATOR ======
  const verifySimulator = useCallback(async () => {
    if (!simulatorId.trim()) {
      setSimulatorVerificationError("Ingrese un ID de simulador");
      return;
    }
    const simId = Number(simulatorId.trim());
    if (!simId || isNaN(simId) || simId <= 0) {
      setSimulatorVerificationError("ID de simulador inválido");
      return;
    }
    setSimulatorVerifying(true);
    setSimulatorVerificationError("");
    try {
      const ok = await ScanService.verifySimulatorId(simId);
      setSimulatorVerified(ok);
      simulatorVerifiedRef.current = ok;
      simulatorIdRef.current = ok ? String(simId) : "";
      if (!ok) setSimulatorVerificationError("ID de simulador no existe");
    } catch (e: any) {
      setSimulatorVerificationError(e?.message ?? "Error de verificación");
      setSimulatorVerified(false);
      simulatorVerifiedRef.current = false;
      simulatorIdRef.current = "";
    } finally {
      setSimulatorVerifying(false);
    }
  }, [simulatorId]);

  // ====== SCAN PIPELINE ======
  const verifyQRCodeAndRecord = useCallback(async (qr: string) => {
    setScanPhase("processing");
    setVerificationLoading(true);
    setVerificationError(null);
    setUserRecord(null);
    setShowVerificationPopup(true);
    setResultMessage(null);

    try {
      if (!simulatorVerifiedRef.current)
        throw new Error("Verifique el simulador primero");
      if (!simulatorIdRef.current) throw new Error("Falta ID de simulador");

      const simId = Number(simulatorIdRef.current);
      if (!simId || isNaN(simId) || simId <= 0)
        throw new Error("ID de simulador inválido");

      // 👉 ahora el servicio resuelve el EVENTO automáticamente (no se pasa eventId)
      const res = await ScanService.scanByQr({
        qr,
        simulatorId: simId,
      });

      // Se espera algo como: { status: "ok"|"duplicate"|"not_found"|"error", message, user? }
      setUserRecord(res.user ?? null);
      setResultMessage(res.message ?? null);

      if (res.status === "ok") {
        setScanSuccess(true);
        setTimeout(() => setScanSuccess(false), 2000);
      }
    } catch (e: any) {
      setVerificationError(e?.message ?? "Error en la verificación");
    } finally {
      setVerificationLoading(false);
      setScanPhase("complete");
      autoRestartTimeoutRef.current = setTimeout(() => restartScanning(), 3000);
    }
  }, []);

  // ====== VIDEO SCAN LOOP ======
  const scanFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !window.jsQR) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    if (!canvas.width || !canvas.height) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = window.jsQR(img.data, img.width, img.height, {
      inversionAttempts: "dontInvert",
    });
    return code ? code.data : null;
  }, []);

  const performSingleScanAttempt = useCallback(() => {
    if (!scanningActiveRef.current) return;
    if (!simulatorVerifiedRef.current || !simulatorIdRef.current) return;

    setScanAttempts((prev) => prev + 1);

    const qrData = scanFrame();
    if (!qrData) return;

    const now = Date.now();
    const elapsed = now - (lastScanTimeRef.current || 0);

    if (qrData !== lastScannedCodeRef.current || elapsed > 2000) {
      // pause loop
      scanningActiveRef.current = false;
      if (scanIntervalRef.current !== null) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }

      lastScannedCodeRef.current = qrData;
      lastScanTimeRef.current = now;
      setScannedData(qrData);

      verifyQRCodeAndRecord(qrData);
    }
  }, [scanFrame, verifyQRCodeAndRecord]);

  const startContinuousScanning = useCallback(() => {
    if (scanIntervalRef.current !== null) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    scanningActiveRef.current = true;
    setScanAttempts(0);

    scanIntervalRef.current = setInterval(() => {
      if (!scanningActiveRef.current) return;
      performSingleScanAttempt();
    }, 1000);

    // primer intento inmediato
    setTimeout(() => performSingleScanAttempt(), 200);
  }, [performSingleScanAttempt]);

  const startCamera = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const tries: MediaStreamConstraints[] = [
        {
          video: {
            facingMode: "environment",
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
          },
        },
        { video: { facingMode: "environment" } },
        { video: true },
      ];

      let stream: MediaStream | null = null;
      let lastErr: any = null;
      for (const c of tries) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(c);
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!stream) throw lastErr || new Error("No stream");

      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      video.playsInline = true;
      video.muted = true;
      video.autoplay = true;

      const onLoaded = () => {
        setScanPhase("scanning");
        setTimeout(() => startContinuousScanning(), 250);
      };
      video.addEventListener("loadedmetadata", onLoaded);
      await video.play();

      // @ts-ignore: store cleanup
      (video as any)._cleanup = () =>
        video.removeEventListener("loadedmetadata", onLoaded);
    } catch (err: any) {
      setScanPhase("error");
      setError(err?.message ?? "Camera error");
    }
  };

  const startScanCycle = async () => {
    if (!hasCamera || !jsQRLoaded) {
      setError("Camera or QR library not ready");
      setScanPhase("error");
      return;
    }
    setScanPhase("camera-starting");
    await startCamera();
  };

  const cleanup = () => {
    scanningActiveRef.current = false;

    if (scanIntervalRef.current !== null) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (autoRestartTimeoutRef.current !== null) {
      clearTimeout(autoRestartTimeoutRef.current);
      autoRestartTimeoutRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const restartScanning = () => {
    setScanSuccess(false);
    setScannedData("");
    setUserRecord(null);
    setVerificationError(null);
    setShowVerificationPopup(false);
    setScanAttempts(0);
    setScanPhase("scanning");
    setTimeout(() => startContinuousScanning(), 250);
  };

  const getScanPhaseMessage = () => {
    if (scanPhase === "initializing") return "Inicializando…";
    if (scanPhase === "camera-starting") return "Iniciando cámara…";
    if (scanPhase === "scanning") {
      if (!simulatorVerifiedRef.current) return "Verifique simulador primero";
      return "Escaneando…";
    }
    if (scanPhase === "processing") return "Procesando QR…";
    if (scanPhase === "complete")
      return scanSuccess ? "¡QR leído!" : "Completado";
    if (scanPhase === "error") return "Error del lector";
    return "Listo";
  };

  const isCameraActive = [
    "camera-starting",
    "scanning",
    "processing",
    "complete",
  ].includes(scanPhase);
  const isScanning = scanPhase === "scanning" && simulatorVerifiedRef.current;

  return (
    <div className="min-h-screen bg-black p-4 pt-[0]">
      <div className="max-w-md mx-auto space-y-6 mt-[58px]">
        {/* STEP 1: Simulator ID */}
        <Card className="bg-gray-900 border-gray-700 shadow-lg">
          <CardContent className="p-3">
            <div className="space-y-3">
              <label
                htmlFor="simulator-id"
                className="block text-sm font-medium text-[#ff7700]"
              >
                ID del Simulador
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  id="simulator-id"
                  value={simulatorId}
                  onChange={(e) => setSimulatorId(e.target.value)}
                  placeholder="Ingrese el ID del simulador"
                  className="flex-1 px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ff7700] focus:border-[#ff7700]"
                  min={1}
                  disabled={simulatorVerifying}
                />
                <Button
                  onClick={verifySimulator}
                  disabled={!simulatorId.trim() || simulatorVerifying}
                  size="sm"
                  className="bg-[#ff7700] hover:bg-[#e66a00] text-white border-0"
                >
                  {simulatorVerifying ? "Verificando..." : "Verificar"}
                </Button>
              </div>
              {simulatorVerified && (
                <div className="text-sm text-green-400 bg-green-900/20 border border-green-700 rounded p-2">
                  <CheckCircle2 className="inline-block w-4 h-4 mr-1" />
                  Simulador verificado — puede escanear
                </div>
              )}
              {simulatorVerificationError && (
                <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded p-2">
                  {simulatorVerificationError}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* CAMERA + SCANNER */}
        <Card className="overflow-hidden bg-gray-900 border-gray-700 shadow-lg">
          <CardContent className="p-0">
            <div className="relative aspect-square bg-gray-900 flex items-center justify-center">
              <video
                ref={videoRef}
                className={`w-full h-full object-cover ${
                  isCameraActive ? "block" : "hidden"
                }`}
                playsInline
                muted
                autoPlay
                style={{ minWidth: "100%", minHeight: "100%" }}
              />
              <canvas ref={canvasRef} className="hidden" />

              {isCameraActive ? (
                <>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="relative">
                      <div
                        className={`w-48 h-48 border-2 rounded-lg relative transition-all duration-300 ${
                          isScanning
                            ? "border-[#ff7700] animate-pulse"
                            : "border-gray-400"
                        }`}
                      >
                        <div
                          className={`absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 rounded-tl-lg ${
                            isScanning ? "border-[#ff7700]" : "border-gray-400"
                          }`}
                        />
                        <div
                          className={`absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 rounded-tr-lg ${
                            isScanning ? "border-[#ff7700]" : "border-gray-400"
                          }`}
                        />
                        <div
                          className={`absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 rounded-bl-lg ${
                            isScanning ? "border-[#ff7700]" : "border-gray-400"
                          }`}
                        />
                        <div
                          className={`absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 rounded-br-lg ${
                            isScanning ? "border-[#ff7700]" : "border-gray-400"
                          }`}
                        />
                        {isScanning && (
                          <div className="absolute inset-0 overflow-hidden rounded-lg">
                            <div
                              className="w-full h-1 bg-gradient-to-r from-transparent via-[#ff7700] to-transparent absolute"
                              style={{
                                animation: "scanLine 1s ease-in-out infinite",
                              }}
                            />
                          </div>
                        )}
                        {scanSuccess && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="bg-[#ff7700] rounded-full p-3 animate-pulse">
                              <CheckCircle2 className="w-8 h-8 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
                    <div
                      className={`px-4 py-2 rounded-full text-sm flex items-center gap-2 transition-colors ${
                        isScanning
                          ? "bg-[#ff7700] bg-opacity-90 text-white"
                          : simulatorVerifiedRef.current
                          ? "bg-gray-700 bg-opacity-90 text-[#ff7700]"
                          : "bg-gray-800 bg-opacity-90 text-gray-300"
                      }`}
                    >
                      {isScanning && (
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      )}
                      {getScanPhaseMessage()}
                    </div>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-center text-white p-8">
                  <div>
                    <Camera className="w-16 h-16 mx-auto mb-4 opacity-50 text-gray-400" />
                    <p className="text-lg mb-2 text-gray-300">Camera Preview</p>
                    <p className="text-sm opacity-75 text-gray-400">
                      {scanPhase === "initializing"
                        ? "Inicializando…"
                        : scanPhase === "error"
                        ? "Error"
                        : "Cargando…"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Error global */}
        {error && (
          <Alert
            variant="destructive"
            className="bg-red-900/20 border-red-800 text-red-400"
          >
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Raw scanned data */}
        {scannedData && (
          <Card className="bg-gray-900 border-gray-700 shadow-lg">
            <CardContent className="p-4">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-[#ff7700]">
                  Scanned QR Code
                </label>
                <Textarea
                  value={scannedData}
                  readOnly
                  className="min-h-[90px] resize-none bg-gray-800 border-gray-600 text-white"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Debug toggle */}
        <div className="text-center">
          <Button
            onClick={() => setShowDebug((s) => !s)}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-[#ff7700] hover:bg-gray-800"
          >
            {showDebug ? (
              <BugOff className="w-4 h-4 mr-1" />
            ) : (
              <Bug className="w-4 h-4 mr-1" />
            )}
            {showDebug ? "Hide Debug" : "Show Debug"}
          </Button>
        </div>

        {showDebug && (
          <Card className="bg-gray-900 border-gray-700 shadow-lg">
            <CardContent className="p-4 text-xs text-gray-300 space-y-1">
              <div>Permission: {permissionStatus}</div>
              <div>Phase: {scanPhase}</div>
              <div>Camera: {hasCamera ? "OK" : "NO"}</div>
              <div>jsQR: {jsQRLoaded ? "OK" : "NO"}</div>
              <div>
                Simulator Verified:{" "}
                {simulatorVerifiedRef.current ? "YES" : "NO"}
              </div>
              <div>Simulator ID: {simulatorIdRef.current || "none"}</div>
              <div>Scan attempts: {scanAttempts}</div>
              {debugInfo.length > 0 && (
                <div className="mt-2 max-h-32 overflow-auto text-gray-400">
                  {debugInfo.map((l, i) => (
                    <div key={i}>{l}</div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Verification Popup */}
      <VerificationPopup
        isOpen={showVerificationPopup}
        onClose={() => setShowVerificationPopup(false)}
        userRecord={userRecord}
        qrCode={scannedData}
        isLoading={verificationLoading}
        error={verificationError}
        // @ts-ignore si tu componente acepta algo como subtitle/message
        message={resultMessage ?? undefined}
      />

      {/* scan line anim */}
      <style jsx>{`
        @keyframes scanLine {
          0% {
            top: 0%;
          }
          50% {
            top: 100%;
          }
          100% {
            top: 0%;
          }
        }
      `}</style>
    </div>
  );
}
