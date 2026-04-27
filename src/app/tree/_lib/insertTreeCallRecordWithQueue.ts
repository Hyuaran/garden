"use client";

/**
 * Tree Phase D-02 Step 7: オフライン対応ラッパー
 *
 * ネットワーク状態に応じて INSERT or enqueue を切替。
 * オフライン時は enqueue + 仮 success を返す（call_id は client 生成 ID）。
 * オーバーフロー（500 件超過）時は overflow エラーを返す。
 *
 * spec §5、判 0-2 確定
 */

import {
  insertTreeCallRecord,
  type InsertTreeCallRecordInput,
  type InsertTreeCallRecordResult,
} from "../_actions/insertTreeCallRecord";
import { enqueue } from "./offlineQueue";

export type InsertTreeCallRecordWithQueueResult = InsertTreeCallRecordResult & {
  offline?: boolean;
  overflow?: boolean;
};

export async function insertTreeCallRecordWithQueue(
  payload: InsertTreeCallRecordInput,
): Promise<InsertTreeCallRecordWithQueueResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const r = enqueue(payload);
    if (!r.ok && r.overflow) {
      return {
        success: false,
        errorCode: "UNKNOWN",
        errorMessage:
          "オフラインキューが上限（500 件）に達しました。業務を停止してネット復旧後に再開してください。",
        overflow: true,
      };
    }
    return {
      success: true,
      call_id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      offline: true,
    };
  }
  return insertTreeCallRecord(payload);
}
