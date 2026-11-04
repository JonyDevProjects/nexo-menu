"use client";

import React, { useEffect, useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";

interface AiProgressStepperProps {
  isProcessing: boolean;
}

export const AiProgressStepper: React.FC<AiProgressStepperProps> = ({ isProcessing }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { title: "Leyendo foto de la carta y analizando textos", desc: "Detección visual inteligente" },
    { title: "Extrayendo secciones y precios en euros", desc: "Clasificación de platos y categorías" },
    { title: "Identificando los 14 alérgenos de la UE", desc: "Normativa Reglamento (UE) 1169/2011" },
    { title: "Traduciendo nombres y descripciones al inglés", desc: "Adaptación turística instantánea" },
  ];

  useEffect(() => {
    if (!isProcessing) {
      setCurrentStep(0);
      return;
    }

    const timer1 = setTimeout(() => setCurrentStep(1), 700);
    const timer2 = setTimeout(() => setCurrentStep(2), 1500);
    const timer3 = setTimeout(() => setCurrentStep(3), 2200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [isProcessing]);

  if (!isProcessing) return null;

  return (
    <div className="w-full p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-amber-200/80 dark:border-amber-900/60 shadow-lg space-y-5 animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <Sparkles className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Gemini Flash está digitalizando tu carta
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Procesamiento multimodal en un solo paso (~2,5s)
          </p>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        {steps.map((step, idx) => {
          const isDone = currentStep > idx;
          const isCurrent = currentStep === idx;

          return (
            <div key={idx} className="flex items-start gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold mt-0.5 transition-colors ${
                  isDone
                    ? "bg-emerald-500 text-white"
                    : isCurrent
                    ? "bg-amber-500 text-white"
                    : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400"
                }`}
              >
                {isDone ? (
                  <Check className="w-3.5 h-3.5" />
                ) : isCurrent ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  idx + 1
                )}
              </div>
              <div className="space-y-0.5">
                <p
                  className={`text-sm font-medium ${
                    isCurrent
                      ? "text-zinc-900 dark:text-zinc-100"
                      : isDone
                      ? "text-zinc-700 dark:text-zinc-300"
                      : "text-zinc-400 dark:text-zinc-500"
                  }`}
                >
                  {step.title}
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
