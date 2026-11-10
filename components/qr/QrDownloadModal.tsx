"use client";

import React, { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getMenuPublicUrl, printQRTemplate } from "@/lib/qr-utils";
import { Button } from "@/components/ui/Button";
import { Download, Printer, X, ExternalLink, Check, FileCode, Mail, ShieldCheck, Loader2, QrCode } from "lucide-react";
import { linkEmailAction } from "@/app/actions/auth";

interface QrDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantName: string;
  slug: string;
}

export const QrDownloadModal: React.FC<QrDownloadModalProps> = ({
  isOpen,
  onClose,
  restaurantName,
  slug,
}) => {
  const qrRef = useRef<SVGSVGElement>(null);
  const [email, setEmail] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [linkSuccess, setLinkSuccess] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const handleLinkEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setLinkError("Por favor introduce un correo válido.");
      return;
    }
    setIsLinking(true);
    setLinkError(null);
    try {
      const res = await linkEmailAction(email);
      if (!res.success) {
        throw new Error(res.error || "No se pudo vincular el correo.");
      }
      setLinkSuccess(true);
    } catch (err: any) {
      setLinkError(err.message || "Error al vincular el correo.");
    } finally {
      setIsLinking(false);
    }
  };

  if (!isOpen) return null;

  const appUrl = getMenuPublicUrl(slug);

  const downloadPNG = () => {
    // Generates a 1024×1024 PNG bitmap via canvas (300 DPI for commercial printing)
    const svg = qrRef.current;
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = 1024;
    canvas.height = 1024;
    const img = new Image();
    img.onload = () => {
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
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const downloadSVG = () => {
    // Exports a lossless vector SVG file via Blob URL
    const svg = qrRef.current;
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    const a = document.createElement("a");
    a.href = svgUrl;
    a.download = `QR-${slug}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(svgUrl);
  };

  const handlePrint = () => printQRTemplate();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 print:p-0 print:bg-white print:static print:inset-auto">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6 print:border-none print:shadow-none print:p-0 print:max-w-none print:max-h-none print:overflow-visible print:bg-white">
        {/* Cabecera del Modal (oculta al imprimir) */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3 print:hidden">
          <div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <Check className="w-4 h-4" /> ¡Carta Publicada con Éxito!
            </span>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Código QR y Material de Mesa
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Enlace directo a la carta y página QR (oculto al imprimir) */}
        <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 print:hidden">
          <div className="truncate text-xs text-zinc-600 dark:text-zinc-300 min-w-0">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">Enlace de tu carta:</span>
            <span className="font-mono text-amber-600 dark:text-amber-400 truncate block">{appUrl}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 w-full sm:w-auto">
            <a
              href={`/qr/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-100 transition-colors"
              title="Abrir página dedicada del código QR"
            >
              <QrCode className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Página QR</span>
            </a>
            <a
              href={appUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-xs font-semibold text-zinc-800 dark:text-zinc-100 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Ver Carta</span>
            </a>
          </div>
        </div>

        {/* Plantilla A5 Imprimible / Peana de mesa */}
        <div
          id="nexo-a5-stand"
          className="border border-zinc-200 dark:border-zinc-700 rounded-3xl p-6 bg-white dark:bg-zinc-950 text-center space-y-4 shadow-sm print:m-0 print:border-2 print:border-zinc-900 print:rounded-3xl print:p-8 print:w-[148mm] print:min-h-[200mm] print:mx-auto print:shadow-none print:bg-white print:text-zinc-950 flex flex-col justify-between"
        >
          <div className="space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500 print:text-amber-700 block">
              Carta Digital · Menú Interactivo
            </span>
            <h4 className="text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-zinc-50 print:text-black">
              {restaurantName}
            </h4>
            <p className="text-xs text-zinc-500 print:text-zinc-600 font-medium max-w-xs mx-auto">
              Escanea con tu cámara móvil para consultar nuestra carta actualizada y lista de alérgenos
            </p>
          </div>

          <div className="flex justify-center p-4 bg-white rounded-2xl w-fit mx-auto border-2 border-zinc-900 shadow-sm print:shadow-none my-2">
            <QRCodeSVG
              ref={qrRef}
              value={appUrl}
              size={190}
              level="H"
              includeMargin={true}
            />
          </div>

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

          <div className="pt-3 border-t border-dashed border-zinc-200 dark:border-zinc-800 print:border-zinc-400 text-[10px] font-mono text-zinc-400 print:text-zinc-600">
            {appUrl}
          </div>

          {/* Guía física para corte o plegado en peana de mesa A5 */}
          <div className="hidden print:block pt-3 border-t border-dotted border-zinc-400 text-[9px] uppercase tracking-wider text-zinc-400">
            ✂️ Línea de doblado para soporte / peana de mesa A5 (148 x 210 mm)
          </div>
        </div>

        {/* Acciones de Descarga e Impresión (ocultas al imprimir) */}
        <div className="space-y-2 pt-1 print:hidden">
          <div className="grid grid-cols-2 gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={downloadPNG}
              className="w-full text-xs"
            >
              <Download className="w-4 h-4 mr-1.5" />
              QR en PNG (1024px)
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={downloadSVG}
              className="w-full text-xs"
            >
              <FileCode className="w-4 h-4 mr-1.5" />
              QR en SVG (Vector)
            </Button>
          </div>

          <Button
            type="button"
            variant="primary"
            onClick={handlePrint}
            className="w-full text-xs font-semibold py-2.5"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            Imprimir Plantilla Peana A5
          </Button>
        </div>

        {/* Vincular Email para guardar acceso (opcional, sin fricción) */}
        <div className="p-3.5 bg-amber-500/10 dark:bg-amber-950/30 rounded-2xl border border-amber-500/20 space-y-2.5 print:hidden">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-left">
              <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 block">
                ¿Quieres actualizar tus platos o precios más adelante?
              </span>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                Guarda tu carta introduciendo tu email. Te enviaremos un enlace de acceso seguro sin contraseñas.
              </p>
            </div>
          </div>

          {linkSuccess ? (
            <div className="flex items-center gap-1.5 p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-semibold">
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>¡Enlace enviado a {email}! Revisa tu bandeja de entrada.</span>
            </div>
          ) : (
            <form onSubmit={handleLinkEmail} className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@restaurante.com"
                  disabled={isLinking}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                disabled={isLinking || !email}
                className="text-xs px-3 py-1.5 h-auto flex-shrink-0"
              >
                {isLinking ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>Guardar</span>
                )}
              </Button>
            </form>
          )}

          {linkError && (
            <p className="text-[11px] text-red-600 dark:text-red-400">{linkError}</p>
          )}
        </div>
      </div>
    </div>
  );
};
