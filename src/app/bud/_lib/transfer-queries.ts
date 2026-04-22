/**
 * Garden-Bud / 振込データ取得クエリ
 *
 * 一覧・詳細・重複チェック用のクエリをまとめる。
 * ミューテーション（作成・更新）は transfer-mutations.ts を参照。
 *
 * RLS:
 *   - SELECT は bud_has_access() が許可する全行（Phase 0 RLS）
 *   - 実際の表示制御は UI 側で garden_role / bud_role に応じた行フィルタ
 */

import { supabase } from "./supabase";
import type { BudTransfer, TransferCategory } from "../_constants/types";
import type { TransferStatus } from "../_constants/transfer-status";

export interface TransferListFilter {
  /** 振込種別（null/undefined=両方） */
  category?: TransferCategory | null;
  /** ステータス絞り込み（未指定=全て） */
  statuses?: TransferStatus[];
  /** 実行会社（振込元会社） */
  execute_company_id?: string | null;
  /** 依頼会社（費用計上先） */
  request_company_id?: string | null;
  /** 起票者 */
  created_by?: string | null;
  /** 期間（以上） */
  scheduled_date_from?: string | null;
  /** 期間（以下） */
  scheduled_date_to?: string | null;
  /** テキスト検索（受取人名 / 金額 / 備考） */
  search?: string | null;
  /** ページサイズ */
  limit?: number;
  /** オフセット */
  offset?: number;
}

/**
 * 振込一覧を取得。フィルタは AND 条件で絞り込み。
 * 既定の並び順: scheduled_date DESC, created_at DESC
 */
export async function fetchTransferList(
  filter: TransferListFilter = {},
): Promise<{ rows: BudTransfer[]; total: number }> {
  let query = supabase
    .from("bud_transfers")
    .select("*", { count: "exact" })
    .order("scheduled_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (filter.category) {
    query = query.eq("transfer_category", filter.category);
  }
  if (filter.statuses && filter.statuses.length > 0) {
    query = query.in("status", filter.statuses);
  }
  if (filter.execute_company_id) {
    query = query.eq("execute_company_id", filter.execute_company_id);
  }
  if (filter.request_company_id) {
    query = query.eq("request_company_id", filter.request_company_id);
  }
  if (filter.created_by) {
    query = query.eq("created_by", filter.created_by);
  }
  if (filter.scheduled_date_from) {
    query = query.gte("scheduled_date", filter.scheduled_date_from);
  }
  if (filter.scheduled_date_to) {
    query = query.lte("scheduled_date", filter.scheduled_date_to);
  }
  if (filter.search) {
    // OR 条件: payee_name ILIKE or description ILIKE
    const s = `%${filter.search}%`;
    query = query.or(`payee_name.ilike.${s},description.ilike.${s}`);
  }
  if (typeof filter.limit === "number") {
    query = query.limit(filter.limit);
  }
  if (typeof filter.offset === "number") {
    query = query.range(
      filter.offset,
      filter.offset + (filter.limit ?? 100) - 1,
    );
  }

  const { data, error, count } = await query;
  if (error) {
    throw new Error(`振込一覧取得に失敗: ${error.message}`);
  }

  return {
    rows: (data ?? []) as BudTransfer[],
    total: count ?? 0,
  };
}

/**
 * 振込 1 件を ID で取得。存在しない場合は null。
 */
export async function fetchTransferById(
  transferId: string,
): Promise<BudTransfer | null> {
  const { data, error } = await supabase
    .from("bud_transfers")
    .select("*")
    .eq("transfer_id", transferId)
    .maybeSingle<BudTransfer>();

  if (error) {
    throw new Error(`振込詳細取得に失敗: ${error.message}`);
  }

  return data;
}

/**
 * 重複判定キーで既存レコードを検索。
 * UI 側で「重複の可能性あり」警告を出すのに使用。
 * duplicate_flag=true（意図的重複）は除外。
 */
export async function fetchTransferByDuplicateKey(
  duplicateKey: string,
): Promise<BudTransfer | null> {
  const { data, error } = await supabase
    .from("bud_transfers")
    .select("*")
    .eq("duplicate_key", duplicateKey)
    .eq("duplicate_flag", false)
    .maybeSingle<BudTransfer>();

  if (error) {
    throw new Error(`重複検索に失敗: ${error.message}`);
  }

  return data;
}

/**
 * 当日の次の連番（最大連番+1）を返す。ID 生成用。
 */
export async function fetchNextSequence(
  category: TransferCategory,
  date: Date,
): Promise<number> {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const datePrefix = `${y}${m}${d}`;

  const idPrefix = category === "regular" ? `FK-${datePrefix}-` : `CB-${datePrefix}-G-`;

  const { data, error } = await supabase
    .from("bud_transfers")
    .select("transfer_id")
    .like("transfer_id", `${idPrefix}%`)
    .order("transfer_id", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`連番取得に失敗: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return 1;
  }

  const lastId = data[0].transfer_id as string;
  const seqStr = lastId.substring(idPrefix.length);
  const seq = parseInt(seqStr, 10);
  if (isNaN(seq)) {
    return 1;
  }
  return seq + 1;
}
