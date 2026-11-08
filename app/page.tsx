"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ImageUploader, CompressedImage } from "@/components/admin/ImageUploader";
import { AiProgressStepper } from "@/components/admin/AiProgressStepper";
import { MenuEditor } from "@/components/admin/MenuEditor";
import { QrDownloadModal } from "@/components/qr/QrDownloadModal";
import {
  InferenceControlPanel,
  InferenceConfig,
  AiProviderType,
} from "@/components/admin/InferenceControlPanel";
import { extractMenuAction } from "@/app/actions/ai";
import { saveMenuAction } from "@/app/actions/menu";
import { ensureAnonymousSessionAction } from "@/app/actions/auth";
import { ExtractedMenu } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import {
  Sparkles,
  Utensils,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

export default function HomePage() {
  const [selectedImages, setSelectedImages] = useState<CompressedImage[]>([]);
  const [isProcessingAi, setIsProcessingAi] = useState(false);
  const [extractedMenu, setExtractedMenu] = useState<ExtractedMenu | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [savedRestaurantName, setSavedRestaurantName] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [canFallbackToMock, setCanFallbackToMock] = useState(false);
  const [aiProvider, setAiProvider] = useState<"local" | "litert" | "litert_hybrid" | "gemini" | "mock">("local");
  const [aiModelName, setAiModelName] = useState<string>("");

  const [inferenceConfig, setInferenceConfig] = useState<InferenceConfig>({
    provider: "auto",
    geminiApiKey: "",
    geminiModel: "auto",
    ollamaBaseUrl: "http://127.0.0.1:11434",
    ollamaModel: "qwen3-vl:8B",
    litertVisionUrl: "http://127.0.0.1:11436",
    litertReasoningUrl: "http://127.0.0.1:11435",
  });

  useEffect(() => {
    // Garantiza sesión anónima transparente en segundo plano
    ensureAnonymousSessionAction().catch((err) => {
      console.warn("Sesión anónima:", err);
    });
  }, []);

  const getButtonProviderLabel = (provider: AiProviderType) => {
    switch (provider) {
      case "gemini":
        return "Gemini Flash";
      case "local":
        return "Ollama Local";
      case "litert_hybrid":
        return "LiteRT Híbrido";
      case "mock":
        return "Simulación Demo";
      default:
        return "IA Inteligente";
    }
  };

  const handleProcessAi = async (overrideProvider?: AiProviderType) => {
    if (selectedImages.length === 0) return;
    setErrorMsg(null);
    setCanFallbackToMock(false);
    setIsProcessingAi(true);

    const activeProvider = overrideProvider || inferenceConfig.provider;
    const clientStartTime = Date.now();

    try {
      const formData = new FormData();
      let totalPayloadBytes = 0;

      selectedImages.forEach((img) => {
        formData.append("images", img.dataUrl);
        totalPayloadBytes += (img.dataUrl?.length || 0) * 0.75;
      });

      const totalMb = totalPayloadBytes / (1024 * 1024);
      console.log(
        `[Nexo Client AI] Despachando inferencia: ${selectedImages.length} imagen(es), ~${totalMb.toFixed(
          2
        )} MB. Proveedor: ${activeProvider}`
      );

      if (totalMb > 4.2) {
        console.warn(
          `[Nexo Client AI] Advertencia de payload: ~${totalMb.toFixed(
            2
          )} MB se aproxima al límite de Vercel Serverless (4.5 MB).`
        );
      }

      formData.append("provider", activeProvider);
      if (inferenceConfig.geminiApiKey) {
        formData.append("apiKey", inferenceConfig.geminiApiKey);
      }
      if (inferenceConfig.geminiModel) {
        formData.append("geminiModel", inferenceConfig.geminiModel);
      }
      formData.append("ollamaBaseUrl", inferenceConfig.ollamaBaseUrl);
      formData.append("ollamaModel", inferenceConfig.ollamaModel);
      formData.append("litertVisionUrl", inferenceConfig.litertVisionUrl);
      formData.append("litertReasoningUrl", inferenceConfig.litertReasoningUrl);

      const res = await extractMenuAction(formData);
      const clientLatencyMs = Date.now() - clientStartTime;

      if (!res.success || !res.data) {
        if (res.canFallbackToMock) {
          setCanFallbackToMock(true);
        }
        throw new Error(res.error || "Error al procesar la carta con IA.");
      }

      console.log(
        `[Nexo Client AI] Inferencia completada con éxito en ${clientLatencyMs}ms. Proveedor: ${res.provider} (${res.modelName})`
      );

      if (res.provider) setAiProvider(res.provider);
      if (res.modelName) setAiModelName(res.modelName);
      setExtractedMenu(res.data);
    } catch (err: any) {
      const clientLatencyMs = Date.now() - clientStartTime;
      console.error(
        `[Nexo Client AI] Error en procesamiento tras ${clientLatencyMs}ms:`,
        err
      );

      let userFriendlyMessage =
        err?.message || "Error al conectar con el servicio de IA.";

      // Blindaje específico contra fallos de Server Actions por payload o timeout (HTTP 413 / 504)
      if (
        userFriendlyMessage.includes("An unexpected response was received from the server") ||
        userFriendlyMessage.includes("Failed to fetch") ||
        userFriendlyMessage.includes("413") ||
        userFriendlyMessage.includes("FUNCTION_INVOCATION_TIMEOUT")
      ) {
        userFriendlyMessage =
          "El servidor no pudo procesar la solicitud (posible límite de tamaño de imagen o tiempo de espera excedido). Puedes probar con una foto más ligera o usar la Simulación Demo.";
        setCanFallbackToMock(true);
      }

      setErrorMsg(userFriendlyMessage);
    } finally {
      setIsProcessingAi(false);
    }
  };

  const handleSaveMenu = async (payload: {
    restaurantName: string;
    slug: string;
    description: string;
    menu: ExtractedMenu;
    legalConfirmed: boolean;
  }) => {
    setIsSaving(true);
    setErrorMsg(null);

    try {
      const res = await saveMenuAction({
        restaurantName: payload.restaurantName,
        slug: payload.slug,
        description: payload.description,
        menu: payload.menu,
        legalConfirmed: payload.legalConfirmed,
      });

      if (!res.success) {
        throw new Error(res.error || "Error al publicar la carta.");
      }

      setSavedSlug(payload.slug);
      setSavedRestaurantName(payload.restaurantName);
      setIsModalOpen(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Error al guardar.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-zinc-950">
      {/* Barra superior */}
      <nav className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black shadow-sm">
              <Utensils className="w-4 h-4" />
            </div>
            <span className="text-lg font-black tracking-tight text-zinc-900 dark:text-zinc-50">
              Nexo
            </span>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              Plan Free
            </span>
          </div>

          <Link
            href="/m/bar-pepe"
            target="_blank"
            className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-amber-600 flex items-center gap-1 transition-colors"
          >
            <span>Ver Carta Demo</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </nav>

      {/* Contenido Principal */}
      <main className="max-w-xl mx-auto px-4 py-8 space-y-8">
        {!extractedMenu ? (
          <>
            {/* Hero */}
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Tu restaurante en internet en 3 minutos</span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 leading-tight">
                De foto en papel a{" "}
                <span className="text-amber-600 dark:text-amber-500">
                  Carta QR con Alérgenos
                </span>
              </h1>

              <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
                Sube una foto de tu carta o pizarra. Nuestra IA extrae platos,
                precios, detecta los 14 alérgenos de la UE y traduce al inglés automáticamente.
              </p>
            </div>

            {/* Ventajas clave */}
            <div className="grid grid-cols-3 gap-2 py-1 text-center">
              <div className="p-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-1">
                <span className="text-xl">📸</span>
                <p className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200">Foto a Menú</p>
                <p className="text-[10px] text-zinc-400">Sin teclear nada</p>
              </div>

              <div className="p-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-1">
                <span className="text-xl">🌾</span>
                <p className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200">14 Alérgenos</p>
                <p className="text-[10px] text-zinc-400">Normativa UE</p>
              </div>

              <div className="p-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-1">
                <span className="text-xl">🇬🇧</span>
                <p className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200">Traducción</p>
                <p className="text-[10px] text-zinc-400">Para turistas</p>
              </div>
            </div>

            {/* Panel de Control del Motor de Inferencia IA */}
            <InferenceControlPanel
              config={inferenceConfig}
              onChangeConfig={setInferenceConfig}
              isProcessing={isProcessingAi}
            />

            {/* Componente de Subida */}
            <div className="space-y-4">
              <ImageUploader
                onImagesReady={(imgs) => setSelectedImages(imgs)}
                isLoading={isProcessingAi}
              />

              {errorMsg && (
                <div className="p-4 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 rounded-2xl text-xs border border-red-200 dark:border-red-900/60 space-y-2.5 animate-in fade-in duration-200">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="flex-1 font-medium leading-relaxed">{errorMsg}</p>
                  </div>
                  {canFallbackToMock && (
                    <div className="pt-2 border-t border-red-200/60 dark:border-red-900/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <span className="text-[11px] text-zinc-600 dark:text-zinc-400">
                        ¿Quieres probar el resto del flujo sin configurar claves?
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setInferenceConfig({ ...inferenceConfig, provider: "mock" });
                          handleProcessAi("mock");
                        }}
                        className="text-xs bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 h-7"
                      >
                        <span>👉 Continuar con Simulación Demo</span>
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {selectedImages.length > 0 && !isProcessingAi && (
                <Button
                  onClick={() => handleProcessAi()}
                  size="lg"
                  className="w-full text-base py-4"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Digitalizar Carta con {getButtonProviderLabel(inferenceConfig.provider)} ({selectedImages.length} foto
                  {selectedImages.length > 1 ? "s" : ""})
                </Button>
              )}

              <AiProgressStepper isProcessing={isProcessingAi} />
            </div>

            {/* Acceso Directo de Prueba */}
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 text-center space-y-2">
              <p className="text-xs text-zinc-500">¿Quieres ver cómo queda una carta terminada?</p>
              <Link
                href="/m/bar-pepe"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline"
              >
                <span>Explorar la carta pública de &quot;Bar Pepe&quot;</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </>
        ) : (
          /* Editor Táctil de Platos */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setExtractedMenu(null)}
                className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-semibold flex items-center gap-1"
              >
                ← Subir otras fotos
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-xl text-xs border border-red-200">
                {errorMsg}
              </div>
            )}

            <MenuEditor
              initialMenu={extractedMenu}
              onSave={handleSaveMenu}
              isSaving={isSaving}
              provider={aiProvider}
              modelName={aiModelName}
            />
          </div>
        )}
      </main>

      {/* Modal de Descarga de QR e Impresión */}
      <QrDownloadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        restaurantName={savedRestaurantName}
        slug={savedSlug || "mi-bar"}
      />
    </div>
  );
}
