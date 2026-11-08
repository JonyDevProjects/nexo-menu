import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://nexo.restaurant"),
  title: "Nexo · Cartas Digitales Inteligentes para Bares y Restaurantes",
  description:
    "Crea la carta digital de tu restaurante en 3 minutos con una foto. Detección automática de los 14 alérgenos de la UE, multiidioma y código QR listo para imprimir.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export const maxDuration = 60;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased min-h-screen bg-neutral-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
