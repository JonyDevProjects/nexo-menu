import { z } from "zod";

export interface Restaurant {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description?: string | null;
  currency: string;
  logo_url?: string | null;
  is_published: boolean;
  subscription_tier: "free" | "starter" | "pro";
  ai_scans_today: number;
  ai_scans_reset_at: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  restaurant_id: string;
  name_es: string;
  name_en?: string | null;
  order_index: number;
  created_at?: string;
  dishes?: Dish[];
}

export interface Dish {
  id: string;
  category_id: string;
  restaurant_id: string;
  name_es: string;
  name_en?: string | null;
  description_es?: string | null;
  description_en?: string | null;
  price: number;
  allergens: string[];
  is_available: boolean;
  image_url?: string | null;
  order_index: number;
  created_at?: string;
  updated_at?: string;
}

export interface FullMenuData {
  restaurant: Restaurant;
  categories: (Category & { dishes: Dish[] })[];
}

// Zod schema for extracted items with robust preprocessing for local LLM output variances
export const ExtractedDishSchema = z.preprocess((val: any) => {
  if (val && typeof val === "object") {
    const name_es = val.name_es || val.name || val.nombre || val.dish_name || val.nombre_es || "";
    const name_en = val.name_en || val.english_name || null;
    const description_es = val.description_es || val.description || val.descripcion || val.descripcion_es || null;
    const description_en = val.description_en || val.english_description || null;
    let price = val.price ?? val.precio ?? 0;
    if (typeof price === "string") {
      price = parseFloat(price.replace(/[^0-9.,]/g, "").replace(",", ".")) || 0;
    }
    const allergens = Array.isArray(val.allergens || val.alergenos) ? (val.allergens || val.alergenos) : [];
    return {
      ...val,
      name_es,
      name_en,
      description_es,
      description_en,
      price: Number(price) || 0,
      allergens,
    };
  }
  return val;
}, z.object({
  name_es: z.string().min(1, "El nombre del plato es obligatorio"),
  name_en: z.string().optional().nullable(),
  description_es: z.string().optional().nullable(),
  description_en: z.string().optional().nullable(),
  price: z.number().min(0, "El precio debe ser un número positivo"),
  allergens: z.array(z.string()).default([]),
}));

export const ExtractedCategorySchema = z.preprocess((val: any) => {
  if (val && typeof val === "object") {
    const name_es = val.name_es || val.name || val.nombre || val.categoria || val.category || val.nombre_es || "";
    const name_en = val.name_en || val.english_name || null;
    const dishes = Array.isArray(val.dishes || val.platos || val.items) ? (val.dishes || val.platos || val.items) : [];
    return {
      ...val,
      name_es,
      name_en,
      dishes,
    };
  }
  return val;
}, z.object({
  name_es: z.string().min(1, "El nombre de la categoría es obligatorio"),
  name_en: z.string().optional().nullable(),
  dishes: z.array(ExtractedDishSchema),
}));

export const ExtractedMenuSchema = z.object({
  categories: z.array(ExtractedCategorySchema),
});

export type ExtractedMenu = z.infer<typeof ExtractedMenuSchema>;
export type ExtractedCategory = z.infer<typeof ExtractedCategorySchema>;
export type ExtractedDish = z.infer<typeof ExtractedDishSchema>;
