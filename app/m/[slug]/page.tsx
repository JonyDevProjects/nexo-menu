import { notFound } from "next/navigation";
import { getPublicMenuBySlug } from "@/lib/data/menu";
import { MenuPublicView } from "@/components/menu/MenuPublicView";
import type { Metadata } from "next";

export const revalidate = 60; // ISR cache revalidation fallback (60 seconds)
export const dynamicParams = true; // Permite generar cartas de nuevos restaurantes bajo demanda (ISR)

export async function generateStaticParams() {
  return [{ slug: "bar-pepe" }];
}

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const menuData = await getPublicMenuBySlug(slug);

  if (!menuData) {
    return {
      title: "Carta no encontrada | Nexo",
    };
  }

  return {
    title: `${menuData.restaurant.name} · Carta Digital & Alérgenos`,
    description:
      menuData.restaurant.description ||
      `Consulta los platos, precios e información de alérgenos de ${menuData.restaurant.name}.`,
    openGraph: {
      title: `${menuData.restaurant.name} · Carta Digital`,
      description: `Consulta la carta y los alérgenos de ${menuData.restaurant.name}.`,
      images: [menuData.restaurant.logo_url || "/og-card.png"],
    },
  };
}

export default async function PublicMenuPage({ params }: PageProps) {
  const { slug } = await params;
  const menuData = await getPublicMenuBySlug(slug);

  if (!menuData) {
    notFound();
  }

  return <MenuPublicView data={menuData} />;
}
