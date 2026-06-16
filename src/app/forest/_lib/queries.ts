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
import type {
  Hankanhi,
  LastUpdatedAt,
  NouzeiFile,
  NouzeiItem,
  NouzeiScheduleDetail,
  NouzeiScheduleWithItems,
} from "./types";
import type { MonthYear } from "./tax-calendar";

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

/**
 * Forest 全体の「最終更新日」を取得する。
 *
 * `fiscal_periods` と `shinkouki` の両テーブルから `updated_at` の最新値を
 * 1 行だけ取り、より新しい方を返す。両テーブルが空の場合は epoch 0 で
 * フォールバック（UI 側で `―` 表示に変換される想定）。
 *
 * @returns source と at を持つ LastUpdatedAt
 * @throws どちらかのクエリが Supabase エラーを返した場合
 */
export async function fetchLastUpdated(): Promise<LastUpdatedAt> {
  const [fp, sk] = await Promise.all([
    supabase
      .from("fiscal_periods")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("shinkouki")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (fp.error) {
    throw new Error(`fetchLastUpdated fiscal_periods: ${fp.error.message}`);
  }
  if (sk.error) {
    throw new Error(`fetchLastUpdated shinkouki: ${sk.error.message}`);
  }

  const fpAt = fp.data?.updated_at ? new Date(fp.data.updated_at) : null;
  const skAt = sk.data?.updated_at ? new Date(sk.data.updated_at) : null;

  // 両方空 → epoch 0 フォールバック（UI で `―` 表示）
  if (!fpAt && !skAt) {
    return { source: "fiscal_periods", at: new Date(0) };
  }

  // 片方のみ
  if (fpAt && !skAt) return { source: "fiscal_periods", at: fpAt };
  if (!fpAt && skAt) return { source: "shinkouki", at: skAt };

  // 両方あり：同時刻なら both、そうでなければ新しい方
  const fpTime = fpAt!.getTime();
  const skTime = skAt!.getTime();
  if (fpTime === skTime) return { source: "both", at: fpAt! };
  if (fpTime > skTime) return { source: "fiscal_periods", at: fpAt! };
  return { source: "shinkouki", at: skAt! };
}

/* =====================================================================
 * T-F4-02 / T-F11-01: Nouzei queries
 * ===================================================================== */

/**
 * 納税カレンダー描画用：指定 (from, to) 月範囲の schedules + items を取得。
 *
 * Supabase 側では `gte('year', from.y).lte('year', to.y)` で年範囲を粗取得し、
 * クライアント側で月単位の (year, month) ペアによる絞り込みを行う。
 * （Supabase 単体クエリで月境界条件 OR 連結を表現できないため）
 */
export async function fetchNouzeiCalendar(
  from: MonthYear,
  to: MonthYear,
): Promise<NouzeiScheduleWithItems[]> {
  const { data, error } = await supabase
    .from("forest_nouzei_schedules")
    .select(`*, items:forest_nouzei_items(*)`)
    .gte("year", from.y)
    .lte("year", to.y)
    .order("year")
    .order("month")
    .order("company_id");

  if (error) {
    throw new Error(`fetchNouzeiCalendar: ${error.message}`);
  }

  const rows = (data ?? []) as NouzeiScheduleWithItems[];
  return rows.filter((s) => {
    const afterFrom = s.year > from.y || (s.year === from.y && s.month >= from.m);
    const beforeTo = s.year < to.y || (s.year === to.y && s.month <= to.m);
    return afterFrom && beforeTo;
  });
}

/**
 * 納税モーダル用：1 件の schedule + items + files を取得。
 *
 * - items は sort_order 昇順
 * - files は uploaded_at 降順
 * - 該当行なしは null（エラーではない）
 */
export async function fetchNouzeiDetail(
  scheduleId: string,
): Promise<NouzeiScheduleDetail | null> {
  const { data, error } = await supabase
    .from("forest_nouzei_schedules")
    .select(`*, items:forest_nouzei_items(*), files:forest_nouzei_files(*)`)
    .eq("id", scheduleId)
    .maybeSingle();

  if (error) {
    throw new Error(`fetchNouzeiDetail(${scheduleId}): ${error.message}`);
  }
  if (!data) return null;

  const raw = data as NouzeiScheduleDetail & {
    items: NouzeiItem[] | null;
    files: NouzeiFile[] | null;
  };
  return {
    ...raw,
    items: [...(raw.items ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    ),
    files: [...(raw.files ?? [])].sort((a, b) =>
      b.uploaded_at.localeCompare(a.uploaded_at),
    ),
  };
}

/**
 * 添付ファイルの Supabase Storage 署名 URL を発行する。
 *
 * @param storagePath - bucket 'forest-tax' 内の相対パス
 * @param expiresInSec - 既定 3600 秒（1 時間）
 */
export async function createNouzeiFileSignedUrl(
  storagePath: string,
  expiresInSec: number = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from("forest-tax")
    .createSignedUrl(storagePath, expiresInSec);

  if (error) {
    throw new Error(`createNouzeiFileSignedUrl: ${error.message}`);
  }
  if (!data?.signedUrl) {
    throw new Error("createNouzeiFileSignedUrl: empty signedUrl returned");
  }
  return data.signedUrl;
}
