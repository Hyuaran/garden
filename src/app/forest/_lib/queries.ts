/**
 * Garden Forest — Supabase データ取得クエリ
 *
 * Forest モジュールで使用するすべてのデータ取得関数を定義する。
 * 各関数はエラー発生時に説明的なメッセージとともに例外をスローする。
 * RLS ポリシーにより、forest_users に登録済みのユーザーのみが
 * データを取得できる。
 */

import type {
  Company,
  FiscalPeriod,
  ForestUser,
  Shinkouki,
} from "../_constants/companies";
import { supabase } from "./supabase";

/**
 * 法人マスタを sort_order 順に全件取得する。
 *
 * @returns Company 配列
 * @throws Supabase エラー発生時
 */
export async function fetchCompanies(): Promise<Company[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .order("sort_order");

  if (error) {
    throw new Error(`fetchCompanies failed: ${error.message}`);
  }

  return data as Company[];
}

/**
 * 確定決算期を company_id・ki 順に全件取得する。
 *
 * @returns FiscalPeriod 配列
 * @throws Supabase エラー発生時
 */
export async function fetchFiscalPeriods(): Promise<FiscalPeriod[]> {
  const { data, error } = await supabase
    .from("fiscal_periods")
    .select("*")
    .order("company_id")
    .order("ki");

  if (error) {
    throw new Error(`fetchFiscalPeriods failed: ${error.message}`);
  }

  return data as FiscalPeriod[];
}

/**
 * 進行期データを全件取得する。
 *
 * @returns Shinkouki 配列
 * @throws Supabase エラー発生時
 */
export async function fetchShinkouki(): Promise<Shinkouki[]> {
  const { data, error } = await supabase.from("shinkouki").select("*");

  if (error) {
    throw new Error(`fetchShinkouki failed: ${error.message}`);
  }

  return data as Shinkouki[];
}

/**
 * 指定ユーザーの Forest アクセス権情報を取得する。
 *
 * @param userId - 検索対象のユーザー ID（UUID 文字列）
 * @returns ForestUser オブジェクト、または未登録の場合 null
 * @throws Supabase エラー発生時
 */
export async function fetchForestUser(
  userId: string
): Promise<ForestUser | null> {
  const { data, error } = await supabase
    .from("forest_users")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`fetchForestUser failed: ${error.message}`);
  }

  return data as ForestUser | null;
}
