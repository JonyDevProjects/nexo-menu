import React from "react";

export function downloadQRAsPNG(qrRef: React.RefObject<SVGSVGElement | null>, slug: string): void {
  const svg = qrRef.current;
  if (!svg) return;

  const svgData = new XMLSerializer().serializeToString(svg);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const img = new Image();
  canvas.width = 1024;
  canvas.height = 1024;

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
}

export function downloadQRAsSVG(qrRef: React.RefObject<SVGSVGElement | null>, slug: string): void {
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
}

export function printQRTemplate(): void {
  window.print();
}

export function getMenuPublicUrl(slug: string): string {
  if (typeof window === "undefined") {
    return "https://nexo-menu.vercel.app/m/" + slug;
  }
  return `${window.location.origin}/m/${slug}`;
}

export function useCopyUrl(url: string): [boolean, () => Promise<void>] {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return [copied, copy];
}
