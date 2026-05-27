/**
 * Garden Bloom — Supabase クライアント
 *
 * 匿名キー（anon key）のみを使用してクライアントを生成する。
 * サービスロールキーは絶対に使用しない（クライアントサイドから
 * 使用するとすべての RLS ポリシーが無効化される）。
 *
 * 環境変数は .env.local に設定すること:
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
 */

import { createBrowserClient } from "../../_lib/supabase/browser";

export const supabase = createBrowserClient();
