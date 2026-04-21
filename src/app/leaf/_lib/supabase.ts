/**
 * Garden-Leaf — Supabase クライアント
 * root モジュールと同じ URL/Key を使用（同一 Supabase プロジェクト）
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
