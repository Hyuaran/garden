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
  data_source?: "紙スキャン" | "デジタル入力" | "CSVインポート";
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
      data_source: input.data_source ?? "デジタル入力",
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
 * @deprecated 2026-04-25 a-review 指摘 B3（二重実装）対応。
 *
 * 本関数は Phase 1b.1 時点の遷移実装で、以下の問題があるため
 * 新規呼出は **transitionTransferStatus()** を使用すること。
 *
 * 1. 監査漏れ: 直接 UPDATE するため bud_transfer_status_history への INSERT がない
 * 2. V6 自己承認禁止チェックなし（DB の RLS policy 4 で防御されるが TS 層で警告できない）
 * 3. ロール非依存の canTransition のため super_admin 自起票スキップを判定できない
 *
 * 移行手順:
 *   - 単件遷移: transitionTransferStatus({ transferId, toStatus, fromStatus, createdBy, actorUserId, reason })
 *   - super_admin 自起票即承認: transitionTransferStatus({ ..., fromStatus: '下書き', toStatus: '承認済み' })
 *   - 一括遷移: batchApproveTransfers / batchRejectTransfers
 *
 * 既存呼出箇所: 現時点で 0 件（src/ 内全文検索で確認済）。
 * 互換性のため当面残置するが、将来の major upgrade で削除予定。
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
 * @deprecated 2026-04-25 a-review 指摘 B3（二重実装・監査漏れ）+ 2026-04-27 a-review #55 R3（経理事故レベル）対応で実装本体を RPC 経由へ全面置換。
 *
 * super_admin による自起票の即承認スキップ（下書き → 承認済み）。
 *
 * **修正履歴**:
 * - 2026-04-25 (a-bud): @deprecated マーク + JSDoc 警告追加（実装はそのまま）
 * - 2026-04-27 (a-bud, #55 R3 修正): 直接 UPDATE 実装を撤去し、`bud_transition_transfer_status` RPC 経由に統一。
 *   旧実装は status のみ UPDATE して `bud_transfer_status_history` への INSERT が一切発生しないため、
 *   super_admin 自起票即承認が監査ログに残らず**金融監査の要件を満たせない経理事故レベル**の欠陥だった。
 *   RPC は SECURITY DEFINER で UPDATE + history INSERT を単一トランザクション、
 *   かつ `bud_can_transition` で super_admin 自起票特例を判定、reason='自起票' 自動挿入する
 *   （scripts/bud-a03-status-history-migration.sql §3-§5）。
 *
 * **挙動の設計判断（#55 R4 design decision、design-decision で容認）**:
 * - `confirmed_by` / `confirmed_at` は NULL のまま（二重チェックをスキップしたという事実の fingerprint、I-2 B 案）
 * - `approved_by` / `approved_at` も RPC は更新しない（status_changed_by / status_changed_at + status_history で代替監査可能）
 * - 集約 query で「super_admin スキップ件数」を出す場合は `confirmed_at IS NULL` で抽出可能
 *
 * **後続作業**: 呼出箇所ゼロを再確認の上、当関数自体を削除予定（PR #85 merge 後の次フェーズ）。
 */
export async function selfApproveAsSuperAdmin(
  transferId: string,
  // actorUserId は API 互換のため残置するが、RPC 内部で auth.uid() から取得するため未使用。
  // 将来削除時に併せて引数撤去予定。
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _actorUserId: string,
): Promise<BudTransfer> {
  // 直接 UPDATE を撤去し、RPC 経由に統一（#55 R3 修正）。
  // RPC は status + status_changed_* + status_history INSERT を atomic に実行。
  const transitionResult = await transitionTransferStatus({
    transferId,
    toStatus: "承認済み",
    reason: "自起票（super_admin スキップ）",
  });

  if (!transitionResult.success) {
    throw new Error(
      `自己承認に失敗: ${transitionResult.error ?? "権限不足またはステータス不一致"}`,
    );
  }

  // 遷移後のレコードを返却（旧 API 契約互換）
  const { data, error } = await supabase
    .from("bud_transfers")
    .select("*")
    .eq("transfer_id", transferId)
    .single<BudTransfer>();

  if (error || !data) {
    throw new Error(
      `自己承認後の再取得に失敗: ${error?.message ?? "transfer not found"}`,
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

/**
 * A-03: 振込ステータス遷移（atomic RPC 呼出版）。
 *
 * scripts/bud-a03-status-history-migration.sql で定義された
 * bud_transition_transfer_status() RPC を呼び、
 * bud_transfers.status の UPDATE と
 * bud_transfer_status_history への INSERT を単一トランザクションで実行。
 */

export type { TransitionErrorCode, TransitionParams } from "./transition-validator";
import {
  validateTransitionInput,
  mapPostgresErrorCode,
  type TransitionErrorCode,
  type TransitionParams,
} from "./transition-validator";

export type TransitionResult =
  | {
      success: true;
      newStatus: TransferStatus;
      historyId: string;
      effectiveReason: string | null;
    }
  | {
      success: false;
      error: string;
      code: TransitionErrorCode;
    };

import type { BatchTransitionResult } from "./batch-transitions";
import { validateBatchSize } from "./batch-transitions";

export async function batchApproveTransfers(params: {
  transferIds: string[];
}): Promise<BatchTransitionResult> {
  const sizeCheck = validateBatchSize(params.transferIds);
  if (!sizeCheck.ok) {
    return {
      succeeded: [],
      failed: params.transferIds.map((id) => ({
        transferId: id,
        error: sizeCheck.message,
        code: "INVALID_TRANSITION" as const,
      })),
    };
  }
  const succeeded: string[] = [];
  const failed: BatchTransitionResult["failed"] = [];
  for (const id of params.transferIds) {
    const r = await transitionTransferStatus({
      transferId: id,
      toStatus: "承認済み",
    });
    if (r.success) {
      succeeded.push(id);
    } else {
      failed.push({ transferId: id, error: r.error, code: r.code });
    }
  }
  return { succeeded, failed };
}

export async function batchRejectTransfers(params: {
  transferIds: string[];
  reason: string;
}): Promise<BatchTransitionResult> {
  const sizeCheck = validateBatchSize(params.transferIds);
  if (!sizeCheck.ok) {
    return {
      succeeded: [],
      failed: params.transferIds.map((id) => ({
        transferId: id,
        error: sizeCheck.message,
        code: "INVALID_TRANSITION" as const,
      })),
    };
  }
  const succeeded: string[] = [];
  const failed: BatchTransitionResult["failed"] = [];
  for (const id of params.transferIds) {
    const r = await transitionTransferStatus({
      transferId: id,
      toStatus: "差戻し",
      reason: params.reason,
    });
    if (r.success) {
      succeeded.push(id);
    } else {
      failed.push({ transferId: id, error: r.error, code: r.code });
    }
  }
  return { succeeded, failed };
}

export async function transitionTransferStatus(
  params: TransitionParams,
): Promise<TransitionResult> {
  const validation = validateTransitionInput(params);
  if (!validation.ok) {
    return {
      success: false,
      error: validation.error,
      code: validation.code,
    };
  }

  const { data, error } = await supabase.rpc("bud_transition_transfer_status", {
    p_transfer_id: params.transferId,
    p_to_status: params.toStatus,
    p_reason: params.reason ?? null,
  });

  if (error) {
    return {
      success: false,
      error: error.message,
      code: mapPostgresErrorCode(
        (error as { code?: string }).code,
        error.message,
      ),
    };
  }

  const result = data as {
    history_id: string;
    from_status: string;
    to_status: string;
    effective_reason: string | null;
  };

  return {
    success: true,
    newStatus: result.to_status as TransferStatus,
    historyId: result.history_id,
    effectiveReason: result.effective_reason,
  };
}
