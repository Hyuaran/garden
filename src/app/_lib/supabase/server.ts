/**
 * Garden Server-side Supabase Client（2026-05-11、Task 2 で新規作成）
 *
 * 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 2 §Step 2-2
 *
 * 用途:
 *   - Next.js App Router の Server Component / Route Handler から呼び出す Supabase クライアント
 *   - cookies() で Supabase Auth セッション cookie を読み取り、SSR で role 判定する
 *
 * memory project_rls_server_client_audit §「Route Handler でブラウザ用 anon supabase 流用すると RLS 100% ブロック」
 *   → 本 helper を経由して server context の cookies と紐づくこと
 *
 * 既存 ./_lib/supabase（存在しない）/ bloom/_lib/supabase（client 専用）とは別経路。
 * @supabase/ssr の createServerClient を thin wrap している。
 */

import { cookies } from "next/headers";
import { createServerClient as createSsrServerClient } from "@supabase/ssr";

/**
 * Server Component / Route Handler 向け Supabase クライアント
 *
 * Next.js 14+ の `cookies()` は async (Promise) 環境と sync 環境が混在するが、
 * @supabase/ssr の型は `() => Cookie[]` 系を期待するため、await した上で渡す。
 */
export async function createServerClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase 環境変数 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定です",
    );
  }

  return createSsrServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Server Component は cookie を書き込めない（Next.js の制約）。
        // Route Handler / Server Action から呼ばれた場合に限り書き込みを試みる。
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component context: ignore（Middleware で refresh する想定）
        }
      },
    },
  });
}
