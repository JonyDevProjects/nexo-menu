import { unstable_cache } from "next/cache";
import { createPublicSupabaseClient } from "../supabase/public";
import { FullMenuData } from "../types";
import { getLocalMenu } from "./localStore";

export const DEMO_RESTAURANT_MENU: FullMenuData = {
  restaurant: {
    id: "demo-res-01",
    user_id: "demo-user",
    name: "Bar Pepe & Tapas",
    slug: "bar-pepe",
    description: "Cervecería de barrio con tapas caseras, raciones y las mejores croquetas de la ciudad.",
    currency: "EUR",
    logo_url: null,
    is_published: true,
    subscription_tier: "free",
    ai_scans_today: 1,
    ai_scans_reset_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  categories: [
    {
      id: "cat-1",
      restaurant_id: "demo-res-01",
      name_es: "Tapas y Raciones",
      name_en: "Tapas and Sharing Plates",
      order_index: 0,
      dishes: [
        {
          id: "dish-1",
          restaurant_id: "demo-res-01",
          category_id: "cat-1",
          name_es: "Croquetas Caseras de Jamón Ibérico",
          name_en: "Homemade Iberian Ham Croquettes",
          description_es: "6 unidades con bechamel extra cremosa y jamón de bellota crujiente.",
          description_en: "6 pieces with extra creamy bechamel and crispy acorn-fed ham.",
          price: 9.5,
          allergens: ["gluten", "dairy", "eggs"],
          is_available: true,
          order_index: 0,
        },
        {
          id: "dish-2",
          restaurant_id: "demo-res-01",
          category_id: "cat-1",
          name_es: "Patatas Bravas de la Casa",
          name_en: "House Special Spicy Bravas Potatoes",
          description_es: "Patatas agrias cortadas a mano con salsa brava ahumada y alioli casero.",
          description_en: "Hand-cut crispy potatoes with smoky spicy brava sauce and homemade garlic alioli.",
          price: 6.0,
          allergens: ["gluten", "eggs"],
          is_available: true,
          order_index: 1,
        },
        {
          id: "dish-3",
          restaurant_id: "demo-res-01",
          category_id: "cat-1",
          name_es: "Calamares Frescos a la Andaluza",
          name_en: "Andalusian Style Fried Squid",
          description_es: "Anillas de calamar fresco enharinadas y fritas en aceite de oliva virgen.",
          description_en: "Fresh squid rings lightly battered and fried in extra virgin olive oil.",
          price: 11.5,
          allergens: ["gluten", "molluscs"],
          is_available: true,
          order_index: 2,
        },
      ],
    },
    {
      id: "cat-2",
      restaurant_id: "demo-res-01",
      name_es: "Carnes y Platos Fuertes",
      name_en: "Meats and Mains",
      order_index: 1,
      dishes: [
        {
          id: "dish-4",
          restaurant_id: "demo-res-01",
          category_id: "cat-2",
          name_es: "Smash Burger Especial Nexo",
          name_en: "Nexo Special Smash Burger",
          description_es: "180g de vaca rubia gallega madurada, cheddar madurado, bacon crujiente y pan brioche.",
          description_en: "180g aged Galician beef patty, aged cheddar, crispy bacon in a toasted brioche bun.",
          price: 10.9,
          allergens: ["gluten", "dairy", "eggs", "sesame", "mustard"],
          is_available: true,
          order_index: 0,
        },
        {
          id: "dish-5",
          restaurant_id: "demo-res-01",
          category_id: "cat-2",
          name_es: "Secreto Ibérico a la Brasa",
          name_en: "Grilled Iberian Pork Secret",
          description_es: "Corte jugoso a la brasa con pimientos de Padrón y escamas de sal marina.",
          description_en: "Juicy cut grilled with Padrón peppers and sea salt flakes.",
          price: 14.5,
          allergens: [],
          is_available: true,
          order_index: 1,
        },
      ],
    },
    {
      id: "cat-3",
      restaurant_id: "demo-res-01",
      name_es: "Postres y Cafés",
      name_en: "Desserts & Coffee",
      order_index: 2,
      dishes: [
        {
          id: "dish-6",
          restaurant_id: "demo-res-01",
          category_id: "cat-3",
          name_es: "Tarta de Queso Fluida al Horno",
          name_en: "Baked Creamy Cheesecake",
          description_es: "Receta tradicional donostiarra con corazón fundente.",
          description_en: "Traditional recipe with a creamy melting core.",
          price: 5.5,
          allergens: ["dairy", "eggs", "gluten"],
          is_available: true,
          order_index: 0,
        },
      ],
    },
  ],
};

async function fetchPublicMenuFromSource(slug: string): Promise<FullMenuData | null> {
  // 1. Prioridad: Consultar el almacén persistente local de cartas creadas
  const localMenu = getLocalMenu(slug);
  if (localMenu) {
    return localMenu;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const isCloudSupabase = Boolean(supabaseUrl && supabaseUrl.includes("supabase.co"));

  if (!isCloudSupabase) {
    if (slug === "bar-pepe" || slug === "demo" || slug === "mibar") {
      return DEMO_RESTAURANT_MENU;
    }
    return null;
  }

  try {
    const supabase = createPublicSupabaseClient();

    const { data: restaurant, error: resError } = await supabase
      .from("restaurants")
      .select("*")
      .eq("slug", slug)
      .eq("is_published", true)
      .single();

    if (resError || !restaurant) {
      if (slug === "bar-pepe" || slug === "demo" || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("supabase.co")) {
        console.warn(`[Public Menu] Supabase REST no disponible o restaurante no encontrado. Usando fallback de Bar Pepe para /m/${slug}.`);
        return DEMO_RESTAURANT_MENU;
      }
      return null;
    }

    const { data: categories, error: catError } = await supabase
      .from("categories")
      .select("*, dishes(*)")
      .eq("restaurant_id", restaurant.id)
      .order("order_index", { ascending: true });

    if (catError) {
      console.error("Error al obtener categorías:", catError);
      if (slug === "bar-pepe" || slug === "demo" || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("supabase.co")) {
        return DEMO_RESTAURANT_MENU;
      }
      return null;
    }

    return {
      restaurant,
      categories: categories || [],
    };
  } catch (error) {
    console.error("Error en getPublicMenuBySlug:", error);
    if (slug === "bar-pepe" || slug === "demo" || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("supabase.co")) {
      return DEMO_RESTAURANT_MENU;
    }
    return null;
  }
}

/**
 * Consulta la carta pública con cache atómico en Data Cache e ISR Edge.
 * Invalida mediante revalidateTag(`menu-${slug}`).
 */
export async function getPublicMenuBySlug(slug: string): Promise<FullMenuData | null> {
  const getCachedMenu = unstable_cache(
    async (targetSlug: string) => fetchPublicMenuFromSource(targetSlug),
    ["public-menu", slug],
    {
      revalidate: 60,
      tags: [`menu-${slug}`],
    }
  );

  return getCachedMenu(slug);
}
