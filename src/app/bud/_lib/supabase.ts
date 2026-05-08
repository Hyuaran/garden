/**
 * Garden-Bud — Supabase クライアント
 *
 * 匿名キー（anon key）のみを使用してブラウザから呼び出す。
 * RLSポリシーによりロール別のデータアクセス制御が効く。
 *
 * サービスロールキーはクライアントサイドで絶対に使用しない
 * （RLSがバイパスされ全データが露出する）。
 *
 * 環境変数（.env.local）:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
