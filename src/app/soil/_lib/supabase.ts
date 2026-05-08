/**
 * Garden-Soil — Supabase クライアント
 *
 * 匿名キー（anon key）のみを使用してブラウザから呼び出す。
 * RLS ポリシーによりロール別のデータアクセス制御が効く。
 *
 * Soil 主要 RLS:
 *   - soil_lists: manager+ 全件 / staff- 担当案件のみ（migration 20260507000003）
 *   - soil_imports_*: admin / super_admin のみ（migration 20260507000007）
 *
 * 作成: 2026-05-08（Phase B-01 第 4 弾、a-soil）
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
