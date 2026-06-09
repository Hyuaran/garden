import { createBrowserClient as createSsrBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ブラウザ用 Supabase クライアントの共有シングルトン。
 *
 * 以前は各モジュール（bloom / forest / tree / bud / root ...）が
 * createBrowserClient() を個別に呼び、別々の GoTrueClient インスタンスを
 * 生成していた。@supabase/ssr の cookie ベースセッションでは、ログインを
 * 行ったインスタンス以外は、マウント直後のクエリで認証トークンを
 * 添付できず auth.uid() = NULL となり RLS に弾かれることがある
 * （Forest で「ログイン済みなのに権限が読めずログアウトされる」事象の原因）。
 *
 * ブラウザ内では 1 つのインスタンスを共有して常に同じ認証状態を使う。
 * SSR（サーバ）側ではユーザー間でインスタンスを共有しないよう、
 * window 有無で memo を切り替える。
 */
// The project does not generate a typed Supabase Database schema yet.
// Keep this boundary loose so existing per-query result typing continues to work.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BrowserSupabaseClient = SupabaseClient<any, "public">;

let cachedClient: BrowserSupabaseClient | undefined;

export function createBrowserClient(
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
): BrowserSupabaseClient {
  if (typeof window !== "undefined" && cachedClient) {
    return cachedClient;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase environment variables NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set.",
    );
  }

  const client = createSsrBrowserClient(supabaseUrl, supabaseAnonKey);

  if (typeof window !== "undefined") {
    cachedClient = client;
  }

  return client;
}
