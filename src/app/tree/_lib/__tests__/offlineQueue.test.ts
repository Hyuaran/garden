/**
 * offlineQueue.ts — ユニットテスト
 *
 * テストケース（最低 6 件）:
 *   1. enqueue — 1件エンキューして size=1 が返る
 *   2. 上限 (QUEUE_MAX=500) 到達時は overflow=true が返りキューに追加されない
 *   3. flush 成功 — sender が success:true → succeeded 増加、キューから削除
 *   4. flush 失敗 → 手動復旧 — sender が 3 回失敗 → needsManualRecovery に入る
 *   5. clearQueue — クリア後に getQueueSize() = 0
 *   6. getQueueSize — enqueue 後に正しいサイズが返る
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  enqueue,
  flush,
  getQueue,
  getQueueSize,
  clearQueue,
  QUEUE_MAX,
  type QueuedItem,
} from "../offlineQueue";
import type {
  InsertTreeCallRecordInput,
  InsertTreeCallRecordResult,
} from "../../_actions/insertTreeCallRecord";

type SenderFn = (payload: InsertTreeCallRecordInput) => Promise<InsertTreeCallRecordResult>;

beforeEach(() => {
  localStorage.clear();
});

const DUMMY_PAYLOAD: InsertTreeCallRecordInput = {
  session_id: "session-001",
  campaign_code: "CAMP-001",
  result_code: "toss",
  result_group: "positive",
  memo: "テストメモ",
  accessToken: "dummy-token",
};

describe("enqueue", () => {
  it("1件エンキューして ok=true、size=1 が返る", () => {
    const result = enqueue(DUMMY_PAYLOAD);
    expect(result.ok).toBe(true);
    expect(result.overflow).toBe(false);
    expect(result.size).toBe(1);
  });

  it("enqueue した item が getQueue() に含まれる", () => {
    enqueue(DUMMY_PAYLOAD);
    const queue = getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].payload.session_id).toBe("session-001");
    expect(queue[0].retries).toBe(0);
    expect(typeof queue[0].id).toBe("string");
    expect(queue[0].id.length).toBeGreaterThan(0);
  });

  it("複数件エンキューして size が正しい", () => {
    enqueue(DUMMY_PAYLOAD);
    enqueue(DUMMY_PAYLOAD);
    const result = enqueue(DUMMY_PAYLOAD);
    expect(result.size).toBe(3);
    expect(getQueueSize()).toBe(3);
  });
});

describe("上限 (QUEUE_MAX=500)", () => {
  it("QUEUE_MAX 件に達したら overflow=true が返りキューが増えない", () => {
    const items: QueuedItem[] = Array.from({ length: QUEUE_MAX }, (_, i) => ({
      id: `id-${i}`,
      payload: DUMMY_PAYLOAD,
      ts: Date.now(),
      retries: 0,
    }));
    localStorage.setItem("tree_offline_queue_v1", JSON.stringify(items));

    const result = enqueue(DUMMY_PAYLOAD);
    expect(result.ok).toBe(false);
    expect(result.overflow).toBe(true);
    expect(result.size).toBe(QUEUE_MAX);
    expect(getQueueSize()).toBe(QUEUE_MAX);
  });

  it("QUEUE_MAX 件未満であれば enqueue できる", () => {
    const items: QueuedItem[] = Array.from({ length: QUEUE_MAX - 1 }, (_, i) => ({
      id: `id-${i}`,
      payload: DUMMY_PAYLOAD,
      ts: Date.now(),
      retries: 0,
    }));
    localStorage.setItem("tree_offline_queue_v1", JSON.stringify(items));

    const result = enqueue(DUMMY_PAYLOAD);
    expect(result.ok).toBe(true);
    expect(result.overflow).toBe(false);
    expect(result.size).toBe(QUEUE_MAX);
  });
});

describe("flush — 成功", () => {
  it("sender が success:true を返すと succeeded が増加しキューが空になる", async () => {
    enqueue(DUMMY_PAYLOAD);
    enqueue(DUMMY_PAYLOAD);
    expect(getQueueSize()).toBe(2);

    const mockSender = vi.fn<SenderFn>().mockResolvedValue({
      success: true,
      call_id: "call-uuid-001",
    });

    const result = await flush(mockSender);

    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.needsManualRecovery).toHaveLength(0);
    expect(getQueueSize()).toBe(0);
    expect(mockSender).toHaveBeenCalledTimes(2);
  });

  it("flush 後にキューが空になっていること", async () => {
    enqueue(DUMMY_PAYLOAD);

    const mockSender = vi.fn<SenderFn>().mockResolvedValue({
      success: true,
      call_id: "call-uuid-002",
    });

    await flush(mockSender);
    expect(getQueue()).toHaveLength(0);
  });
});

describe("flush — 失敗 → 手動復旧", () => {
  it("sender が常に失敗すると needsManualRecovery にアイテムが入る", async () => {
    enqueue(DUMMY_PAYLOAD);
    expect(getQueueSize()).toBe(1);

    const mockSender = vi.fn<SenderFn>().mockResolvedValue({
      success: false,
      errorCode: "DB_ERROR",
      errorMessage: "DB接続エラー",
    });

    const result = await flush(mockSender);

    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.needsManualRecovery).toHaveLength(1);
    expect(getQueueSize()).toBe(0);
  });

  it("sender が例外を投げた場合も手動復旧モードになる", async () => {
    enqueue(DUMMY_PAYLOAD);

    const mockSender = vi.fn<SenderFn>().mockRejectedValue(new Error("Network error"));

    const result = await flush(mockSender);

    expect(result.failed).toBe(1);
    expect(result.needsManualRecovery).toHaveLength(1);
    expect(getQueueSize()).toBe(0);
  });

  it("手動復旧アイテムが tree_offline_queue_manual_v1 に保存される", async () => {
    enqueue(DUMMY_PAYLOAD);

    const mockSender = vi.fn<SenderFn>().mockResolvedValue({
      success: false,
      errorCode: "DB_ERROR",
      errorMessage: "DB接続エラー",
    });

    await flush(mockSender);

    const manualRaw = localStorage.getItem("tree_offline_queue_manual_v1");
    expect(manualRaw).not.toBeNull();
    const manual = JSON.parse(manualRaw!);
    expect(Array.isArray(manual)).toBe(true);
    expect(manual).toHaveLength(1);
  });
});

describe("clearQueue", () => {
  it("clearQueue 後に getQueueSize() = 0", () => {
    enqueue(DUMMY_PAYLOAD);
    enqueue(DUMMY_PAYLOAD);
    expect(getQueueSize()).toBe(2);

    clearQueue();
    expect(getQueueSize()).toBe(0);
    expect(getQueue()).toHaveLength(0);
  });
});

describe("getQueueSize", () => {
  it("空の場合は 0 を返す", () => {
    expect(getQueueSize()).toBe(0);
  });

  it("enqueue 後に正しいサイズを返す", () => {
    enqueue(DUMMY_PAYLOAD);
    expect(getQueueSize()).toBe(1);

    enqueue(DUMMY_PAYLOAD);
    expect(getQueueSize()).toBe(2);
  });
});
