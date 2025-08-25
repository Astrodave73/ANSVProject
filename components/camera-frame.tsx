"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RotateCcw, AlertCircle } from "lucide-react";

interface CameraFrameProps {
  onCapture: (imageDataUrl: string) => void;
  width?: number;
  height?: number;
  aspectRatio?: "square" | "portrait" | "landscape";
  className?: string;
}

export default function CameraFrame({
  onCapture,
  width = 300,
  height = 300,
  aspectRatio = "square",
  className = "",
}: CameraFrameProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Calculate dimensions based on aspect ratio
  const getDimensions = useCallback(() => {
    switch (aspectRatio) {
      case "portrait":
        return { width: Math.min(width, 300), height: Math.min(height, 400) };
      case "landscape":
        return { width: Math.min(width, 400), height: Math.min(height, 300) };
      default: // square
        return {
          width: Math.min(width, height, 400),
          height: Math.min(width, height, 400),
        };
    }
  }, [width, height, aspectRatio]);

  const { width: frameWidth, height: frameHeight } = getDimensions();

  const startCamera = useCallback(async () => {
    setIsInitializing(true);
    setError(null);

    try {
      console.log("Requesting camera access...");

      // Stop any existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      // Try different constraint configurations
      const constraintOptions = [
        // Ideal constraints
        {
          video: {
            width: { ideal: frameWidth },
            height: { ideal: frameHeight },
            facingMode: "user",
            aspectRatio: frameWidth / frameHeight,
          },
        },
        // Fallback constraints
        {
          video: {
            width: { min: 240, ideal: frameWidth, max: 1920 },
            height: { min: 240, ideal: frameHeight, max: 1080 },
            facingMode: "user",
          },
        },
        // Basic constraints
        {
          video: {
            facingMode: "user",
          },
        },
        // Minimal constraints
        {
          video: true,
        },
      ];

      let stream: MediaStream | null = null;
      let lastError: Error | null = null;

      for (const constraints of constraintOptions) {
        try {
          console.log("Trying constraints:", constraints);
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          console.log("Camera access granted with constraints:", constraints);
          break;
        } catch (err) {
          console.warn("Failed with constraints:", constraints, err);
          lastError = err as Error;
          continue;
        }
      }

      if (!stream) {
        throw (
          lastError || new Error("Could not access camera with any constraints")
        );
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        // Wait for video to be ready
        await new Promise<void>((resolve, reject) => {
          if (!videoRef.current) {
            reject(new Error("Video element not available"));
            return;
          }

          const video = videoRef.current;

          const onLoadedMetadata = () => {
            console.log("Video metadata loaded:", {
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              readyState: video.readyState,
            });

            video.removeEventListener("loadedmetadata", onLoadedMetadata);
            video.removeEventListener("error", onError);
            resolve();
          };

          const onError = (e: Event) => {
            console.error("Video error:", e);
            video.removeEventListener("loadedmetadata", onLoadedMetadata);
            video.removeEventListener("error", onError);
            reject(new Error("Video failed to load"));
          };

          video.addEventListener("loadedmetadata", onLoadedMetadata);
          video.addEventListener("error", onError);

          // Start playing the video
          video.play().catch((playError) => {
            console.error("Video play error:", playError);
          });

          // Fallback timeout
          setTimeout(() => {
            if (video.readyState >= 2) {
              // HAVE_CURRENT_DATA
              video.removeEventListener("loadedmetadata", onLoadedMetadata);
              video.removeEventListener("error", onError);
              resolve();
            }
          }, 3000);
        });

        setIsStreaming(true);
        console.log("Camera stream started successfully");
      }
    } catch (err) {
      console.error("Camera initialization error:", err);
      let errorMessage = "No se pudo acceder a la cámara";

      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          errorMessage =
            "Acceso a la cámara denegado. Por favor, permite el acceso a la cámara en tu navegador.";
        } else if (err.name === "NotFoundError") {
          errorMessage = "No se encontró ninguna cámara en este dispositivo.";
        } else if (err.name === "NotReadableError") {
          errorMessage = "La cámara está siendo utilizada por otra aplicación.";
        } else if (err.name === "OverconstrainedError") {
          errorMessage = "La cámara no cumple con los requisitos necesarios.";
        } else if (err.message.includes("video source")) {
          errorMessage =
            "No se pudo iniciar la fuente de video. Verifica que la cámara esté disponible.";
        }
      }

      setError(errorMessage);
      setIsStreaming(false);
    } finally {
      setIsInitializing(false);
    }
  }, [frameWidth, frameHeight]);

  const stopCamera = useCallback(() => {
    console.log("Stopping camera...");
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        console.log("Stopping track:", track.kind, track.label);
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setError(null);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isStreaming) {
      console.error("Cannot capture: missing refs or not streaming");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) {
      console.error("Cannot get canvas context");
      return;
    }

    // Set canvas dimensions
    canvas.width = frameWidth;
    canvas.height = frameHeight;

    // Save context for transformations
    context.save();

    // Flip horizontally for mirror effect
    context.scale(-1, 1);
    context.translate(-frameWidth, 0);

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, frameWidth, frameHeight);

    // Restore context
    context.restore();

    // Convert to data URL
    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.8);
    console.log("Photo captured, data URL length:", imageDataUrl.length);

    onCapture(imageDataUrl);
  }, [frameWidth, frameHeight, isStreaming, onCapture]);

  // Initialize camera on mount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className={`flex flex-col items-center space-y-4 ${className}`}>
      <div
        className="relative border-2 border-gray-600 rounded-lg overflow-hidden bg-gray-800"
        style={{ width: frameWidth, height: frameHeight }}
      >
        {isInitializing && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff7700] mx-auto mb-2"></div>
              <p className="text-sm">Iniciando cámara...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
            <div className="text-center text-white p-4">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm mb-3">{error}</p>
              <Button
                onClick={startCamera}
                size="sm"
                className="bg-[#ff7700] hover:bg-[#e66600] text-white"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reintentar
              </Button>
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{
            display: isStreaming && !error ? "block" : "none",
            transform: "scaleX(-1)", // Mirror effect for selfie
          }}
        />

        {!isStreaming && !error && !isInitializing && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <div className="text-center text-gray-400">
              <Camera className="h-12 w-12 mx-auto mb-2" />
              <p className="text-sm">Cámara no disponible</p>
            </div>
          </div>
        )}
      </div>

      <canvas
        ref={canvasRef}
        className="hidden"
        width={frameWidth}
        height={frameHeight}
      />

      <div className="flex gap-3">
        <Button
          onClick={capturePhoto}
          disabled={!isStreaming || isInitializing}
          className="bg-[#ff7700] hover:bg-[#e66600] text-white disabled:opacity-50"
        >
          <Camera className="h-4 w-4 mr-2" />
          Tomar Foto
        </Button>

        <Button
          onClick={startCamera}
          disabled={isInitializing}
          variant="outline"
          className="border-gray-600 text-gray-200 hover:bg-gray-800 hover:text-white bg-transparent"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reiniciar
        </Button>
      </div>
    </div>
  );
}
