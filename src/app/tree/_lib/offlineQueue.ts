"use client";

/**
 * Tree Phase D-02 オフラインキュー
 * spec §5、判 0-2 確定: 500 件上限、超過は業務停止扱い
 */

import type { InsertTreeCallRecordInput, InsertTreeCallRecordResult } from "../_actions/insertTreeCallRecord";

const QUEUE_KEY = "tree_offline_queue_v1";
const MANUAL_QUEUE_KEY = "tree_offline_queue_manual_v1";
export const QUEUE_MAX = 500;

export type QueuedItem = {
  id: string;
  payload: InsertTreeCallRecordInput;
  ts: number;
  retries: number;
};

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readQueue(): QueuedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export function enqueue(
  payload: InsertTreeCallRecordInput,
): { ok: boolean; size: number; overflow: boolean } {
  const queue = readQueue();
  if (queue.length >= QUEUE_MAX) {
    return { ok: false, size: queue.length, overflow: true };
  }
  const item: QueuedItem = {
    id: generateId(),
    payload,
    ts: Date.now(),
    retries: 0,
  };
  queue.push(item);
  writeQueue(queue);
  return { ok: true, size: queue.length, overflow: false };
}

export function getQueueSize(): number {
  return readQueue().length;
}

export function getQueue(): QueuedItem[] {
  return readQueue();
}

/**
 * キュー先頭から flush 試行。
 * @param sender 実行関数（通常は insertTreeCallRecord）
 * @returns 成功件数 / 失敗件数 / 手動復旧モードのアイテム
 */
export async function flush(
  sender: (payload: InsertTreeCallRecordInput) => Promise<InsertTreeCallRecordResult>,
): Promise<{
  succeeded: number;
  failed: number;
  needsManualRecovery: QueuedItem[];
}> {
  let queue = readQueue();
  let succeeded = 0;
  let failed = 0;
  const needsManualRecovery: QueuedItem[] = [];

  while (queue.length > 0) {
    const item = queue[0];
    let success = false;
    let lastError: string | undefined;

    const attemptsRemaining = Math.max(1, 3 - item.retries);
    for (let attempt = 0; attempt < attemptsRemaining; attempt++) {
      try {
        const result = await sender(item.payload);
        if (result.success) {
          success = true;
          break;
        }
        lastError = result.errorMessage;
      } catch (e) {
        lastError = e instanceof Error ? e.message : "unknown";
      }
    }

    if (success) {
      queue.shift();
      writeQueue(queue);
      succeeded += 1;
    } else {
      item.retries += attemptsRemaining;
      needsManualRecovery.push(item);
      queue.shift();
      writeQueue(queue);
      failed += 1;
      console.warn(
        "[offlineQueue] flush failed (manual recovery needed):",
        item.id,
        lastError,
      );
    }

    queue = readQueue();
  }

  if (needsManualRecovery.length > 0) {
    try {
      const existing: QueuedItem[] = JSON.parse(
        localStorage.getItem(MANUAL_QUEUE_KEY) ?? "[]",
      );
      localStorage.setItem(
        MANUAL_QUEUE_KEY,
        JSON.stringify([...existing, ...needsManualRecovery]),
      );
    } catch {
      // localStorage 書き込み失敗は無視（ログのみ）
      console.error("[offlineQueue] failed to persist manual recovery queue");
    }
  }

  return { succeeded, failed, needsManualRecovery };
}

export function getManualRecoveryQueue(): QueuedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MANUAL_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearManualRecoveryQueue(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(MANUAL_QUEUE_KEY);
}

export function clearQueue(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(QUEUE_KEY);
}
