import { createClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase para consultas públicas anónimas (lectura de cartas por comensales).
 * Al no usar cookies de sesión, permite la renderización estática e ISR en el Edge CDN de Vercel.
 */
export function createPublicSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy-key";

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
