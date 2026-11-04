"use client";

import React, { useState, useEffect } from "react";
import {
  Cpu,
  Cloud,
  Server,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Key,
  RefreshCw,
  SlidersHorizontal,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FlaskConical,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { checkAiProvidersAction, ProviderStatus } from "@/app/actions/ai";

export type AiProviderType =
  | "auto"
  | "gemini"
  | "litert_hybrid"
  | "local"
  | "mock";

export interface InferenceConfig {
  provider: AiProviderType;
  geminiApiKey: string;
  geminiModel?: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
  litertVisionUrl: string;
  litertReasoningUrl: string;
}

interface InferenceControlPanelProps {
  config: InferenceConfig;
  onChangeConfig: (newConfig: InferenceConfig) => void;
  isProcessing?: boolean;
}

export const InferenceControlPanel: React.FC<InferenceControlPanelProps> = ({
  config,
  onChangeConfig,
  isProcessing = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [providerStatuses, setProviderStatuses] = useState<
    Record<string, ProviderStatus>
  >({});
  const [isChecking, setIsChecking] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Cargar estado inicial y sincronizar con localStorage
  useEffect(() => {
    // Restaurar clave de Gemini si existe en localStorage
    const savedGeminiKey = localStorage.getItem("nexo_gemini_api_key");
    const savedGeminiModel = localStorage.getItem("nexo_gemini_model");
    const savedProvider = localStorage.getItem("nexo_ai_provider") as AiProviderType;
    if (savedGeminiKey && !config.geminiApiKey) {
      onChangeConfig({
        ...config,
        geminiApiKey: savedGeminiKey,
        geminiModel: savedGeminiModel || config.geminiModel || "auto",
        provider: savedProvider || config.provider,
      });
    } else if (savedGeminiModel && !config.geminiModel) {
      onChangeConfig({
        ...config,
        geminiModel: savedGeminiModel,
      });
    }

    refreshStatuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshStatuses = async () => {
    setIsChecking(true);
    try {
      const statuses = await checkAiProvidersAction();
      setProviderStatuses(statuses);
    } catch (err) {
      console.warn("No se pudieron comprobar los estados de IA:", err);
    } finally {
      setIsChecking(false);
    }
  };

  const handleProviderChange = (provider: AiProviderType) => {
    const updated = { ...config, provider };
    onChangeConfig(updated);
    localStorage.setItem("nexo_ai_provider", provider);
  };

  const handleApiKeyChange = (val: string) => {
    const clean = val.trim();
    const updated = { ...config, geminiApiKey: clean };
    onChangeConfig(updated);
    localStorage.setItem("nexo_gemini_api_key", clean);
  };

  const handleModelChange = (val: string) => {
    const clean = val.trim();
    const updated = { ...config, geminiModel: clean };
    onChangeConfig(updated);
    localStorage.setItem("nexo_gemini_model", clean);
  };

  const getProviderBadge = () => {
    switch (config.provider) {
      case "gemini":
        return {
          label: "Gemini Flash (Cloud)",
          icon: <Cloud className="w-3.5 h-3.5 text-sky-500" />,
          color: "border-sky-200 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300",
        };
      case "local":
        return {
          label: `Ollama (${config.ollamaModel})`,
          icon: <Server className="w-3.5 h-3.5 text-amber-500" />,
          color: "border-amber-200 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300",
        };
      case "litert_hybrid":
        return {
          label: "LiteRT Híbrido (Local)",
          icon: <Cpu className="w-3.5 h-3.5 text-purple-500" />,
          color: "border-purple-200 bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300",
        };
      case "mock":
        return {
          label: "Simulación Demo (Offline)",
          icon: <FlaskConical className="w-3.5 h-3.5 text-emerald-500" />,
          color: "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300",
        };
      default:
        return {
          label: "Motor Automático (Auto)",
          icon: <Sparkles className="w-3.5 h-3.5 text-amber-600" />,
          color: "border-zinc-200 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200",
        };
    }
  };

  const currentBadge = getProviderBadge();

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden transition-all">
      {/* Barra superior de control */}
      <div className="p-3.5 flex items-center justify-between gap-3 bg-zinc-50/70 dark:bg-zinc-900/70">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-zinc-200/80 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                Motor de Inferencia IA:
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${currentBadge.color}`}
              >
                {currentBadge.icon}
                <span className="truncate">{currentBadge.label}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={refreshStatuses}
            disabled={isChecking || isProcessing}
            className="p-1.5 h-7 w-7 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            title="Actualizar estado de motores"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isChecking ? "animate-spin" : ""}`}
            />
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(!isOpen)}
            className="text-xs px-2.5 py-1 h-7 flex items-center gap-1 font-semibold"
          >
            <span>{isOpen ? "Ocultar" : "Configurar"}</span>
            {isOpen ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Panel Desplegable de Ajustes de Inferencia */}
      {isOpen && (
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-4 text-xs animate-in fade-in duration-150">
          {/* Selector de Motores */}
          <div className="space-y-1.5">
            <label className="font-semibold text-zinc-700 dark:text-zinc-300 block">
              Selecciona el motor de extracción visual:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {/* Opción Auto */}
              <button
                type="button"
                onClick={() => handleProviderChange("auto")}
                className={`p-2.5 rounded-xl border text-left space-y-1 transition-all ${
                  config.provider === "auto"
                    ? "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500 text-amber-900 dark:text-amber-100"
                    : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Auto
                  </span>
                  {config.provider === "auto" && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                  )}
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Detecta el mejor motor activo
                </p>
              </button>

              {/* Opción Gemini Cloud */}
              <button
                type="button"
                onClick={() => handleProviderChange("gemini")}
                className={`p-2.5 rounded-xl border text-left space-y-1 transition-all ${
                  config.provider === "gemini"
                    ? "border-sky-500 bg-sky-500/10 ring-1 ring-sky-500 text-sky-900 dark:text-sky-100"
                    : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] flex items-center gap-1">
                    <Cloud className="w-3.5 h-3.5 text-sky-500" /> Gemini Flash
                  </span>
                  {config.provider === "gemini" && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                  )}
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Cloud ultra-rápido (~2,2s)
                </p>
              </button>

              {/* Opción Simulación Demo */}
              <button
                type="button"
                onClick={() => handleProviderChange("mock")}
                className={`p-2.5 rounded-xl border text-left space-y-1 transition-all ${
                  config.provider === "mock"
                    ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500 text-emerald-900 dark:text-emerald-100"
                    : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] flex items-center gap-1">
                    <FlaskConical className="w-3.5 h-3.5 text-emerald-500" /> Demo
                    Mock
                  </span>
                  {config.provider === "mock" && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  100% offline sin claves
                </p>
              </button>

              {/* Opción Ollama Local */}
              <button
                type="button"
                onClick={() => handleProviderChange("local")}
                className={`p-2.5 rounded-xl border text-left space-y-1 transition-all ${
                  config.provider === "local"
                    ? "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500 text-amber-900 dark:text-amber-100"
                    : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] flex items-center gap-1">
                    <Server className="w-3.5 h-3.5 text-amber-500" /> Ollama
                  </span>
                  {config.provider === "local" && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                  )}
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Qwen3-VL:8B en :11434
                </p>
              </button>

              {/* Opción LiteRT Híbrido */}
              <button
                type="button"
                onClick={() => handleProviderChange("litert_hybrid")}
                className={`p-2.5 rounded-xl border text-left space-y-1 transition-all ${
                  config.provider === "litert_hybrid"
                    ? "border-purple-500 bg-purple-500/10 ring-1 ring-purple-500 text-purple-900 dark:text-purple-100"
                    : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5 text-purple-500" /> LiteRT
                  </span>
                  {config.provider === "litert_hybrid" && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                  )}
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  MiniCPM-V + Gemma en local
                </p>
              </button>
            </div>
          </div>

          {/* Ajustes específicos según el motor seleccionado */}
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
            {config.provider === "gemini" || config.provider === "auto" ? (
              <div className="p-3 bg-sky-50/50 dark:bg-sky-950/20 rounded-xl border border-sky-100 dark:border-sky-900/50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-sky-900 dark:text-sky-200 flex items-center gap-1.5 text-[11px]">
                    <Key className="w-3.5 h-3.5 text-sky-600" /> Clave de API de
                    Google Gemini (Opcional si ya está en .env):
                  </label>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] font-semibold text-sky-600 hover:underline flex items-center gap-1"
                  >
                    <span>Conseguir API Key gratis</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={config.geminiApiKey}
                      onChange={(e) => handleApiKeyChange(e.target.value)}
                      placeholder="AIzaSy... (o deja vacío para usar .env / .zshrc)"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-sky-200 dark:border-sky-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 font-mono"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="text-[11px] px-2.5 py-1 h-auto"
                  >
                    {showApiKey ? "Ocultar" : "Ver"}
                  </Button>
                </div>
                <div className="space-y-1 pt-1 border-t border-sky-100/60 dark:border-sky-900/40">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-semibold text-sky-800 dark:text-sky-300">
                      Variante del Modelo Gemini:
                    </label>
                    <span className="text-[9px] text-sky-600 dark:text-sky-400">
                      Fallback automático activo
                    </span>
                  </div>
                  <select
                    value={config.geminiModel || "auto"}
                    onChange={(e) => handleModelChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-sky-200 dark:border-sky-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono"
                  >
                    <option value="auto">Auto (Detección automática / Recomendado)</option>
                    <option value="gemini-flash-lite-latest">gemini-flash-lite-latest (Ultra-rápido / Recomendado)</option>
                    <option value="gemini-2.0-flash">gemini-2.0-flash (Próxima generación)</option>
                    <option value="gemini-1.5-flash-latest">gemini-1.5-flash-latest</option>
                    <option value="gemini-1.5-flash-002">gemini-1.5-flash-002 (Estable)</option>
                    <option value="gemini-1.5-flash">gemini-1.5-flash (Estable estándar)</option>
                    <option value="gemini-flash-latest">gemini-flash-latest</option>
                    <option value="gemini-1.5-flash-8b">gemini-1.5-flash-8b (Ultra-rápido)</option>
                    <option value="gemini-1.5-pro">gemini-1.5-pro (Máxima precisión)</option>
                  </select>
                </div>

                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  💡 Si una variante genera error 404 en tu cuenta, el sistema prueba automáticamente las demás alternativas. Las claves de Google AI Studio empiezan siempre por{" "}
                  <code className="font-mono text-zinc-700 dark:text-zinc-300">
                    AIzaSy...
                  </code>
                  .
                </p>
              </div>
            ) : null}

            {config.provider === "local" && (
              <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-900 dark:text-amber-200 text-[11px]">
                    Configuración de Ollama Daemon:
                  </span>
                  <span
                    className={`text-[10px] font-semibold ${
                      providerStatuses["local"]?.available
                        ? "text-emerald-600"
                        : "text-amber-600"
                    }`}
                  >
                    {providerStatuses["local"]?.statusText || "Comprobando..."}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-1">
                      URL Servidor:
                    </label>
                    <input
                      type="text"
                      value={config.ollamaBaseUrl}
                      onChange={(e) =>
                        onChangeConfig({
                          ...config,
                          ollamaBaseUrl: e.target.value,
                        })
                      }
                      className="w-full px-2.5 py-1 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-1">
                      Modelo Visión:
                    </label>
                    <input
                      type="text"
                      value={config.ollamaModel}
                      onChange={(e) =>
                        onChangeConfig({
                          ...config,
                          ollamaModel: e.target.value,
                        })
                      }
                      className="w-full px-2.5 py-1 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-zinc-500">
                  Para arrancar en tu terminal:{" "}
                  <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded">
                    ollama run {config.ollamaModel}
                  </code>
                </p>
              </div>
            )}

            {config.provider === "litert_hybrid" && (
              <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-100 dark:border-purple-900/50 space-y-2">
                <span className="font-bold text-purple-900 dark:text-purple-200 text-[11px] block">
                  Puertos LiteRT-LM Local:
                </span>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-zinc-500 block mb-1">
                      Visión (MiniCPM-V):
                    </span>
                    <input
                      type="text"
                      value={config.litertVisionUrl}
                      onChange={(e) =>
                        onChangeConfig({
                          ...config,
                          litertVisionUrl: e.target.value,
                        })
                      }
                      className="w-full px-2 py-1 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-zinc-500 block mb-1">
                      Razonamiento (Gemma 26B):
                    </span>
                    <input
                      type="text"
                      value={config.litertReasoningUrl}
                      onChange={(e) =>
                        onChangeConfig({
                          ...config,
                          litertReasoningUrl: e.target.value,
                        })
                      }
                      className="w-full px-2 py-1 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {config.provider === "mock" && (
              <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/50 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>
                  <strong>Modo Simulación Activo:</strong> Extrae de forma
                  inmediata platos gastronómicos realistas con los 14 alérgenos
                  de la UE para probar toda la plataforma sin coste ni esperas.
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
