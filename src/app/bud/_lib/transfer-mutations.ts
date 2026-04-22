/**
 * Garden-Bud / 振込データミューテーション
 *
 * 作成・更新・ステータス遷移のビジネスロジックを含む。
 * RLS（scripts/bud-rls-v2.sql）によって権限違反は DB 側で弾かれるが、
 * UI 体験向上のためここでも事前チェックを行う。
 */

import { supabase } from "./supabase";
import type {
  BudTransfer,
  TransferCategory,
  TransferStatus,
} from "../_constants/types";
import { canTransition } from "../_constants/transfer-status";
import {
  buildRegularTransferId,
  buildCashbackTransferId,
} from "./transfer-id";
import { fetchNextSequence } from "./transfer-queries";

export interface CreateTransferInput {
  transfer_category: TransferCategory;
  request_company_id: string;
  execute_company_id: string;
  source_account_id: string;
  vendor_id?: string | null;
  payee_name: string;
  payee_bank_name?: string | null;
  payee_bank_code: string;
  payee_branch_name?: string | null;
  payee_branch_code: string;
  payee_account_type: string;
  payee_account_number: string;
  payee_account_holder_kana: string;
  fee_bearer?: string | null;
  amount: number;
  description?: string | null;
  scheduled_date?: string | null;
  due_date?: string | null;
  payee_mismatch_confirmed?: boolean;

  // キャッシュバック時のみ
  cashback_applicant_name_kana?: string | null;
  cashback_applicant_name?: string | null;
  cashback_applicant_phone?: string | null;
  cashback_customer_id?: string | null;
  cashback_order_date?: string | null;
  cashback_opened_date?: string | null;
  cashback_product_name?: string | null;
  cashback_channel_name?: string | null;
  cashback_partner_code?: string | null;

  // 添付
  invoice_pdf_url?: string | null;
  scan_image_url?: string | null;
}

/**
 * 新規振込を作成（ステータス = 下書き）。
 *
 * @returns 作成された BudTransfer（採番された transfer_id 付き）
 */
export async function createTransfer(
  input: CreateTransferInput,
  currentUserId: string,
): Promise<BudTransfer> {
  const today = new Date();
  const sequence = await fetchNextSequence(input.transfer_category, today);
  const transferId =
    input.transfer_category === "regular"
      ? buildRegularTransferId(today, sequence)
      : buildCashbackTransferId(today, sequence);

  const { data, error } = await supabase
    .from("bud_transfers")
    .insert({
      transfer_id: transferId,
      status: "下書き" as TransferStatus,
      data_source: "デジタル入力",
      transfer_category: input.transfer_category,
      transfer_type: null, // Phase 1b では未使用（Phase 2/6 で給与/外注費分類時に使用）
      request_date: today.toISOString().substring(0, 10),
      due_date: input.due_date ?? null,
      scheduled_date: input.scheduled_date ?? null,
      company_id: input.execute_company_id, // 後方互換
      request_company_id: input.request_company_id,
      execute_company_id: input.execute_company_id,
      source_account_id: input.source_account_id,
      vendor_id: input.vendor_id ?? null,
      payee_name: input.payee_name,
      payee_bank_name: input.payee_bank_name ?? null,
      payee_bank_code: input.payee_bank_code,
      payee_branch_name: input.payee_branch_name ?? null,
      payee_branch_code: input.payee_branch_code,
      payee_account_type: input.payee_account_type,
      payee_account_number: input.payee_account_number,
      payee_account_holder_kana: input.payee_account_holder_kana,
      fee_bearer: input.fee_bearer ?? "当方負担",
      amount: input.amount,
      description: input.description ?? null,
      payee_mismatch_confirmed: input.payee_mismatch_confirmed ?? false,
      cashback_applicant_name_kana: input.cashback_applicant_name_kana ?? null,
      cashback_applicant_name: input.cashback_applicant_name ?? null,
      cashback_applicant_phone: input.cashback_applicant_phone ?? null,
      cashback_customer_id: input.cashback_customer_id ?? null,
      cashback_order_date: input.cashback_order_date ?? null,
      cashback_opened_date: input.cashback_opened_date ?? null,
      cashback_product_name: input.cashback_product_name ?? null,
      cashback_channel_name: input.cashback_channel_name ?? null,
      cashback_partner_code: input.cashback_partner_code ?? null,
      invoice_pdf_url: input.invoice_pdf_url ?? null,
      scan_image_url: input.scan_image_url ?? null,
      created_by: currentUserId,
    })
    .select("*")
    .single<BudTransfer>();

  if (error || !data) {
    throw new Error(`振込作成に失敗: ${error?.message ?? "unknown"}`);
  }

  return data;
}

/**
 * ステータス遷移を実行。
 * - 遷移ルール（transfer-status.ts の canTransition）で事前チェック
 * - 差戻し・却下時は reason 必須
 */
export async function updateTransferStatus(params: {
  transfer_id: string;
  current_status: TransferStatus;
  next_status: TransferStatus;
  actor_user_id: string;
  rejection_reason?: string | null;
}): Promise<BudTransfer> {
  // 1. 遷移ルール事前チェック
  if (!canTransition(params.current_status, params.next_status)) {
    throw new Error(
      `許可されない遷移: ${params.current_status} → ${params.next_status}`,
    );
  }

  // 2. 差戻し時は理由必須
  if (params.next_status === "差戻し" && !params.rejection_reason) {
    throw new Error("差戻し時は rejection_reason が必須です");
  }

  // 3. 更新フィールドをステータス別に用意
  type Updates = Record<string, unknown>;
  const updates: Updates = { status: params.next_status };

  switch (params.next_status) {
    case "確認済み":
      updates.confirmed_by = params.actor_user_id;
      updates.confirmed_at = new Date().toISOString();
      break;
    case "承認済み":
      updates.approved_by = params.actor_user_id;
      updates.approved_at = new Date().toISOString();
      break;
    case "CSV出力済み":
      updates.csv_exported_by = params.actor_user_id;
      updates.csv_exported_at = new Date().toISOString();
      break;
    case "振込完了":
      updates.executed_by = params.actor_user_id;
      updates.executed_date = new Date().toISOString().substring(0, 10);
      break;
    case "差戻し":
      updates.rejection_reason = params.rejection_reason;
      break;
  }

  // 4. DB 更新（RLS がダブルチェック）
  const { data, error } = await supabase
    .from("bud_transfers")
    .update(updates)
    .eq("transfer_id", params.transfer_id)
    .eq("status", params.current_status) // 楽観ロック
    .select("*")
    .single<BudTransfer>();

  if (error || !data) {
    throw new Error(
      `ステータス更新に失敗: ${error?.message ?? "レコードが見つからないか、ステータスが既に変更されています"}`,
    );
  }

  return data;
}

/**
 * super_admin による自起票の即承認スキップ。
 * 下書き → 承認済み へ 1 ステップで遷移。
 * RLS の bud_transfers_update_self_approve_super_admin ポリシーで保護。
 */
export async function selfApproveAsSuperAdmin(
  transferId: string,
  actorUserId: string,
): Promise<BudTransfer> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("bud_transfers")
    .update({
      status: "承認済み",
      confirmed_by: actorUserId,
      confirmed_at: now,
      approved_by: actorUserId,
      approved_at: now,
    })
    .eq("transfer_id", transferId)
    .eq("status", "下書き")
    .eq("created_by", actorUserId)
    .select("*")
    .single<BudTransfer>();

  if (error || !data) {
    throw new Error(
      `自己承認に失敗: ${error?.message ?? "権限不足またはステータス不一致"}`,
    );
  }

  return data;
}

/**
 * 振込 1 件を更新（編集、下書きステータス時のみ有効）。
 */
export async function updateDraftTransfer(
  transferId: string,
  updates: Partial<CreateTransferInput>,
): Promise<BudTransfer> {
  const { data, error } = await supabase
    .from("bud_transfers")
    .update(updates)
    .eq("transfer_id", transferId)
    .eq("status", "下書き")
    .select("*")
    .single<BudTransfer>();

  if (error || !data) {
    throw new Error(`下書き更新に失敗: ${error?.message ?? "unknown"}`);
  }

  return data;
}
