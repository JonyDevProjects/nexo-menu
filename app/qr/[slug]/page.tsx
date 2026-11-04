import { notFound } from "next/navigation";
import { getPublicMenuBySlug } from "@/lib/data/menu";
import { QrDedicatedView } from "@/components/qr/QrDedicatedView";
import type { Metadata } from "next";

export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [{ slug: "bar-pepe" }];
}

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const menuData = await getPublicMenuBySlug(slug);

  if (!menuData) {
    return {
      title: "Código QR no encontrado | Nexo",
    };
  }

  return {
    title: `Código QR y Peana de Mesa · ${menuData.restaurant.name}`,
    description: `Descarga el código QR e imprime la peana de mesa A5 lista para colocar en ${menuData.restaurant.name}.`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function QrDedicatedPage({ params }: PageProps) {
  const { slug } = await params;
  const menuData = await getPublicMenuBySlug(slug);

  if (!menuData) {
    notFound();
  }

  return <QrDedicatedView data={menuData} />;
}
