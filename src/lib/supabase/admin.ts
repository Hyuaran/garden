/**
 * Server-only Supabase クライアント（service role key 使用 / RLS バイパス）
 *
 * 使用許可される場所:
 *   - Route Handler (src/app/api/...route.ts)
 *   - Cron ジョブ
 *   - 管理用スクリプト
 *
 * 使用禁止:
 *   - "use client" コンポーネント
 *   - フロントから import されるコード全般
 *
 * RLS をバイパスするため、必ず呼び出し前に:
 *   1. CRON_SECRET / 管理者権限等でリクエストを検証すること
 *   2. service role で書き込む対象行・列を最小化すること
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase admin client: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are required",
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
