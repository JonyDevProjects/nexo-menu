"use server";

import { revalidateTag, revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { ExtractedMenu, FullMenuData } from "../../lib/types";
import { saveLocalMenu } from "../../lib/data/localStore";

export interface SaveMenuPayload {
  restaurantName: string;
  slug: string;
  description?: string;
  menu: ExtractedMenu;
  legalConfirmed: boolean;
}

export async function saveMenuAction(
  payload: SaveMenuPayload
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    if (!payload.legalConfirmed) {
      return {
        success: false,
        error: "Debes confirmar y certificar la información de alérgenos antes de publicar.",
      };
    }

    if (!payload.slug || payload.slug.trim().length < 2) {
      return {
        success: false,
        error: "El slug del restaurante debe tener al menos 2 caracteres.",
      };
    }

    const cleanSlug = payload.slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-");

    // Construir objeto persistente FullMenuData con el 100% de platos y categorías
    const restaurantId = `res-${cleanSlug}`;
    const fullMenuData: FullMenuData = {
      restaurant: {
        id: restaurantId,
        user_id: "demo-anonymous-user",
        name: payload.restaurantName,
        slug: cleanSlug,
        description: payload.description || null,
        currency: "EUR",
        logo_url: null,
        is_published: true,
        subscription_tier: "free",
        ai_scans_today: 1,
        ai_scans_reset_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      categories: payload.menu.categories.map((cat, cIdx) => ({
        id: `cat-${cleanSlug}-${cIdx + 1}`,
        restaurant_id: restaurantId,
        name_es: cat.name_es,
        name_en: cat.name_en || null,
        order_index: cIdx,
        dishes: (cat.dishes || []).map((dish, dIdx) => ({
          id: `dish-${cleanSlug}-${cIdx + 1}-${dIdx + 1}`,
          restaurant_id: restaurantId,
          category_id: `cat-${cleanSlug}-${cIdx + 1}`,
          name_es: dish.name_es,
          name_en: dish.name_en || null,
          description_es: dish.description_es || null,
          description_en: dish.description_en || null,
          price: dish.price,
          allergens: dish.allergens || [],
          is_available: (dish as any).is_available ?? true,
          order_index: dIdx,
        })),
      })),
    };

    // Persistir siempre localmente en disco y memoria para garantizar fidelidad total
    saveLocalMenu(fullMenuData);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const isCloudSupabase = Boolean(supabaseUrl && supabaseUrl.includes("supabase.co"));

    if (isCloudSupabase) {
      const supabase = await createServerSupabaseClient();
      let user: any = null;

      try {
        const { data } = await supabase.auth.getUser();
        user = data?.user;
      } catch (e) {
        console.warn("[saveMenuAction] Advertencia al obtener usuario Supabase:", e);
      }

      if (!user) {
        // Garantizar sesión anónima transparente (Onboarding < 3 min sin fricción)
        try {
          const { data: anonData, error: anonError } =
            await supabase.auth.signInAnonymously();

          if (anonError || !anonData?.user) {
            console.warn("[saveMenuAction] Fallo en signInAnonymously cloud:", anonError);
          } else {
            user = anonData.user;
          }
        } catch (anonErr) {
          console.warn("[saveMenuAction] Error de red en signInAnonymously:", anonErr);
        }
      }

      const userId = user?.id || "demo-anonymous-user";

      // 1. Upsert Restaurant
      const { data: restaurant, error: resError } = await supabase
        .from("restaurants")
        .upsert(
          {
            user_id: userId,
            name: payload.restaurantName,
            slug: cleanSlug,
            description: payload.description || null,
            is_published: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "slug" }
        )
        .select()
        .single();

      if (resError || !restaurant) {
        throw new Error(resError?.message || "Error al guardar el restaurante.");
      }

      // 2. Clear old categories and dishes
      await supabase.from("categories").delete().eq("restaurant_id", restaurant.id);

      // 3. Insert new categories & dishes
      for (let i = 0; i < payload.menu.categories.length; i++) {
        const cat = payload.menu.categories[i];

        const { data: insertedCategory, error: catError } = await supabase
          .from("categories")
          .insert({
            restaurant_id: restaurant.id,
            name_es: cat.name_es,
            name_en: cat.name_en || null,
            order_index: i,
          })
          .select()
          .single();

        if (catError || !insertedCategory) {
          throw new Error(catError?.message || "Error al guardar categorías.");
        }

        if (cat.dishes && cat.dishes.length > 0) {
          const dishesToInsert = cat.dishes.map((dish, dIndex) => ({
            restaurant_id: restaurant.id,
            category_id: insertedCategory.id,
            name_es: dish.name_es,
            name_en: dish.name_en || null,
            description_es: dish.description_es || null,
            description_en: dish.description_en || null,
            price: dish.price,
            allergens: dish.allergens || [],
            is_available: true,
            order_index: dIndex,
          }));

          const { error: dishError } = await supabase
            .from("dishes")
            .insert(dishesToInsert);

          if (dishError) {
            throw new Error(dishError.message || "Error al insertar platos.");
          }
        }
      }
    } else {
      console.log(
        `[saveMenuAction] Modo local/contenedor (!supabase.co). Publicación exitosa para slug '${cleanSlug}' (userId: demo-anonymous-user).`
      );
    }

    // Invalidate edge cache tag and page routes for this restaurant
    try {
      revalidateTag(`menu-${cleanSlug}`);
      revalidatePath(`/m/${cleanSlug}`);
      revalidatePath(`/qr/${cleanSlug}`);
    } catch {
      // ignore in test/dev
    }

    return {
      success: true,
      url: `/m/${cleanSlug}`,
    };
  } catch (error: any) {
    console.error("Error en saveMenuAction:", error);
    return {
      success: false,
      error: error.message || "Ocurrió un error al guardar y publicar la carta.",
    };
  }
}
