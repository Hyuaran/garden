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
import type { Hankanhi } from "./types";

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

/**
 * 指定法人 × 期の販管費内訳を 1 件取得する。
 *
 * @param companyId - companies.id（'hyuaran' 等）
 * @param ki - 期数（1 以上の整数）
 * @returns 該当行の Hankanhi、存在しなければ null
 * @throws 入力不正または Supabase エラー発生時
 */
export async function fetchHankanhi(
  companyId: string,
  ki: number,
): Promise<Hankanhi | null> {
  if (!companyId) {
    throw new Error("fetchHankanhi: companyId is required");
  }
  if (!Number.isInteger(ki) || ki < 1) {
    throw new Error(
      `fetchHankanhi: ki must be a positive integer, got ${ki}`,
    );
  }

  const { data, error } = await supabase
    .from("forest_hankanhi")
    .select("*")
    .eq("company_id", companyId)
    .eq("ki", ki)
    .maybeSingle();

  if (error) {
    throw new Error(
      `fetchHankanhi(${companyId}, ki=${ki}) failed: ${error.message}`,
    );
  }

  return data as Hankanhi | null;
}

/**
 * 複数の (companyId, ki) ペアに対する販管費内訳を一括取得する。
 *
 * Supabase の in/gte/lte で広めに取得し、クライアント側で正確な
 * (company_id, ki) ペアに絞り込む。存在しないペアは単に結果に含まれない。
 *
 * @param requests - 取得したい (companyId, ki) の配列
 * @returns 見つかった Hankanhi の配列（順序は Supabase の返却順に準ずる）
 * @throws Supabase エラー発生時
 */
export async function fetchHankanhiBatch(
  requests: Array<{ companyId: string; ki: number }>,
): Promise<Hankanhi[]> {
  if (requests.length === 0) return [];

  const uniqueCompanies = Array.from(
    new Set(requests.map((r) => r.companyId)),
  );
  const kis = requests.map((r) => r.ki);
  const minKi = Math.min(...kis);
  const maxKi = Math.max(...kis);

  const { data, error } = await supabase
    .from("forest_hankanhi")
    .select("*")
    .in("company_id", uniqueCompanies)
    .gte("ki", minKi)
    .lte("ki", maxKi);

  if (error) {
    throw new Error(`fetchHankanhiBatch failed: ${error.message}`);
  }

  const wantedKey = new Set(
    requests.map((r) => `${r.companyId}:${r.ki}`),
  );
  return (data as Hankanhi[]).filter((row) =>
    wantedKey.has(`${row.company_id}:${row.ki}`),
  );
}
