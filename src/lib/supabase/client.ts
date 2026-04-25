/**
 * Garden 横断共通 Supabase ブラウザクライアント（anon key 使用 / RLS 適用）
 *
 * **ブラウザ専用**。Route Handler / Server Component では使用禁止。
 *
 * 使用許可される場所:
 *   - "use client" コンポーネント
 *   - ブラウザで実行される hooks / 状態管理
 *   - Edge Function でも anon 認証で十分な場合
 *
 * 使用禁止:
 *   - Route Handler (src/app/api/.../route.ts) → src/lib/supabase/server.ts (Phase B 追加予定) を使う
 *   - Cron ジョブ / 管理用スクリプト → src/lib/supabase/admin.ts を使う
 *
 * RLS が auth.uid() を解決するため、ブラウザ側でログイン済セッションが必要。
 * 認証されていないユーザーから本クライアントを使うとほぼすべての RLS で block される。
 *
 * see:
 *   - docs/specs/cross-cutting/spec-cross-rls-audit.md §2 パターン A
 *   - docs/superpowers/specs/2026-04-23-leaf-a1c-attachment-design.md §2.5
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * 横断共通の anon Supabase クライアントを返す（singleton）。
 *
 * 各モジュールから直接呼び出し可能:
 * ```typescript
 * import { getSupabaseClient } from '@/lib/supabase/client';
 * const supabase = getSupabaseClient();
 * const { data } = await supabase.from('xxx').select('*');
 * ```
 *
 * もしくは、モジュール固有の薄いラッパで再エクスポート可能（後方互換用）:
 * ```typescript
 * // src/app/<module>/_lib/supabase.ts
 * export { getSupabaseClient as getSupabase } from '@/lib/supabase/client';
 * ```
 */
export function getSupabaseClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase browser client: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are required",
    );
  }

  cached = createClient(url, anonKey);
  return cached;
}

/**
 * 後方互換用の named export。新規コードは `getSupabaseClient()` を呼ぶことを推奨。
 *
 * @deprecated 将来的に削除予定。`getSupabaseClient()` を使用すること。
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, _receiver) {
    return Reflect.get(getSupabaseClient(), prop, getSupabaseClient());
  },
});
