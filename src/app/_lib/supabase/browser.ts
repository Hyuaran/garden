import { createBrowserClient as createSsrBrowserClient } from "@supabase/ssr";

export function createBrowserClient(
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase environment variables NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set.",
    );
  }

  return createSsrBrowserClient(supabaseUrl, supabaseAnonKey);
}
