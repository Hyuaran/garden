/**
 * Garden Forest — Supabase クライアント
 *
 * 匿名キー（anon key）のみを使用してクライアントを生成する。
 * サービスロールキーは絶対に使用しない（クライアントサイドから
 * 使用するとすべての RLS ポリシーが無効化される）。
 *
 * 環境変数は .env.local に設定すること:
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
