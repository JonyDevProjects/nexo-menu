"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { FullMenuData } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import {
  Download,
  Printer,
  FileCode,
  ArrowLeft,
  ExternalLink,
  Copy,
  Check,
  QrCode,
  UtensilsCrossed,
  Info,
  Sparkles,
} from "lucide-react";

interface QrDedicatedViewProps {
  data: FullMenuData;
}

export const QrDedicatedView: React.FC<QrDedicatedViewProps> = ({ data }) => {
  const qrRef = useRef<SVGSVGElement>(null);
  const [copied, setCopied] = useState(false);

  const slug = data.restaurant.slug;
  const restaurantName = data.restaurant.name;

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/m/${slug}`
      : `https://nexo-menu.vercel.app/m/${slug}`;

  const copyUrlToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback si clipboard falla
      setCopied(false);
    }
  };

  const downloadPNG = () => {
    const svg = qrRef.current;
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    canvas.width = 1024;
    canvas.height = 1024;

    img.onload = () => {
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pngUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = `QR-${slug}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    };

    img.src =
      "data:image/svg+xml;base64," +
      btoa(unescape(encodeURIComponent(svgData)));
  };

  const downloadSVG = () => {
    const svg = qrRef.current;
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], {
      type: "image/svg+xml;charset=utf-8",
    });
    const svgUrl = URL.createObjectURL(svgBlob);
    const a = document.createElement("a");
    a.href = svgUrl;
    a.download = `QR-${slug}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(svgUrl);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors">
      {/* Barra de navegación superior (oculta al imprimir) */}
      <nav className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-40 print:hidden">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <Link
            href={`/m/${slug}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a la carta</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Carta Publicada
            </span>
            <Link
              href={`/m/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white transition-colors"
            >
              <span>Ver Carta</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Contenedor Principal */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8 print:p-0 print:m-0 print:max-w-none">
        {/* Cabecera descriptiva (oculta al imprimir) */}
        <div className="space-y-1.5 text-left print:hidden">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 text-xs font-semibold">
            <QrCode className="w-3.5 h-3.5 text-amber-600" />
            <span>Material Físico para Mesa</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
            Código QR de {restaurantName}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl">
            Imprime la peana de mesa en formato A5 o descarga el código QR en
            alta resolución para colocarlo en tu restaurante, barra o terraza.
          </p>
        </div>

        {/* Layout en 2 columnas: Vista previa A5 a la izquierda, Panel de descarga y guía a la derecha */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start print:block print:m-0">
          {/* COLUMNA IZQUIERDA: Plantilla A5 Imprimible / Peana de mesa */}
          <div className="lg:col-span-7 flex justify-center print:block print:w-full">
            <div
              id="nexo-a5-stand"
              className="w-full max-w-sm border-2 border-zinc-900/10 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 bg-white dark:bg-zinc-900 text-center space-y-5 shadow-xl print:shadow-none print:border-2 print:border-zinc-900 print:rounded-3xl print:p-8 print:w-[132mm] print:min-h-[194mm] print:mx-auto print:bg-white print:text-zinc-950 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500 print:text-amber-700 block">
                  Carta Digital · Menú Interactivo
                </span>
                <h2 className="text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-zinc-50 print:text-black">
                  {restaurantName}
                </h2>
                {data.restaurant.description && (
                  <p className="text-xs text-zinc-500 print:text-zinc-600 font-medium max-w-xs mx-auto line-clamp-2">
                    {data.restaurant.description}
                  </p>
                )}
                <p className="text-[11px] text-zinc-500 print:text-zinc-600 font-medium max-w-xs mx-auto pt-1">
                  Escanea con la cámara de tu móvil para consultar nuestra carta y alérgenos
                </p>
              </div>

              {/* Contenedor del código QR con margen y contraste WCAG AAA */}
              <div className="flex justify-center p-4 bg-white rounded-2xl w-fit mx-auto border-2 border-zinc-900 shadow-sm print:shadow-none my-2">
                <QRCodeSVG
                  ref={qrRef}
                  value={publicUrl}
                  size={210}
                  level="H"
                  includeMargin={true}
                />
              </div>

              {/* Indicadores de valor: Idiomas + Alérgenos UE + Carga Instantánea */}
              <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400 print:text-zinc-700">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 print:bg-zinc-100 text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 print:text-zinc-900">
                  <span>🇪🇸 Español</span>
                  <span>•</span>
                  <span>🇬🇧 English</span>
                </div>
                <p className="text-[11px] text-zinc-500 print:text-zinc-600 font-medium">
                  🌾 Información completa de los 14 alérgenos (Reglamento UE 1169/2011)
                </p>
                <p className="text-[10px] text-zinc-400 print:text-zinc-500">
                  ⚡ Sin descargas de apps ni registros · Carga instantánea
                </p>
              </div>

              <div className="pt-3 border-t border-dashed border-zinc-200 dark:border-zinc-800 print:border-zinc-400 text-[10px] font-mono text-zinc-400 print:text-zinc-600 truncate">
                {publicUrl}
              </div>

              {/* Guía física para corte o plegado en peana de mesa A5 */}
              <div className="hidden print:block pt-3 border-t border-dotted border-zinc-400 text-[9px] uppercase tracking-wider text-zinc-400">
                ✂️ Línea de doblado para soporte / peana de mesa A5 (148 x 210 mm)
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: Acciones, Enlace directo y Consejos de Uso (oculta al imprimir) */}
          <div className="lg:col-span-5 space-y-5 print:hidden">
            {/* Tarjeta de Acciones Principales */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Printer className="w-4 h-4 text-amber-600" />
                <span>Impresión y Descarga</span>
              </h3>

              <div className="space-y-2.5">
                <Button
                  type="button"
                  variant="primary"
                  onClick={handlePrint}
                  className="w-full text-sm font-bold py-3 shadow-md"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir Peana de Mesa A5
                </Button>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={downloadPNG}
                    className="w-full text-xs font-semibold py-2.5"
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    PNG (1024px)
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={downloadSVG}
                    className="w-full text-xs font-semibold py-2.5"
                  >
                    <FileCode className="w-4 h-4 mr-1.5" />
                    SVG Vectorial
                  </Button>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                  Enlace público de la carta:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={publicUrl}
                    className="flex-1 text-xs font-mono px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 focus:outline-none select-all"
                  />
                  <Button
                    type="button"
                    variant={copied ? "primary" : "secondary"}
                    onClick={copyUrlToClipboard}
                    className="text-xs px-3 py-2 h-auto flex-shrink-0"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1 text-emerald-300" />
                        ¡Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 mr-1" />
                        Copiar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Tarjeta de Guía para el Hostelero */}
            <div className="bg-amber-500/10 dark:bg-amber-950/30 rounded-3xl p-5 border border-amber-500/20 space-y-3">
              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Consejos de colocación en el local</span>
              </h4>

              <ul className="text-xs text-zinc-600 dark:text-zinc-300 space-y-2 list-none">
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 dark:text-amber-400 font-bold">•</span>
                  <span>
                    <strong>Peana o caballete A5:</strong> Imprime en cartulina de 200g o introduce la hoja en un soporte de metacrilato estándar (15x21 cm).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 dark:text-amber-400 font-bold">•</span>
                  <span>
                    <strong>QR Permanente:</strong> Aunque modifiques platos, precios o alérgenos en el futuro, este código QR <em>nunca cambia ni caduca</em>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 dark:text-amber-400 font-bold">•</span>
                  <span>
                    <strong>Pegatinas de barra / terraza:</strong> Descarga el archivo <code>PNG (1024px)</code> si prefieres encargar vinilos adhesivos para mesas exteriores.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
