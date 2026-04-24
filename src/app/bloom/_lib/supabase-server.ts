/**
 * Bloom サーバーサイド Supabase クライアント（JWT 転送版・A2 スコープ）
 *
 * Route Handler から呼び出す。request の Authorization: Bearer <jwt> を
 * 抽出し、ブラウザのログインセッションを RLS に引き継ぐ。
 *
 * service_role_key は使わない（Bloom §10.3 方針）。
 * 将来 A1（@supabase/ssr cookie セッション）に移行時は不要になる。
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function createSupabaseFromRequest(request: Request): SupabaseClient {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    throw new Error("missing or invalid Authorization header");
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
