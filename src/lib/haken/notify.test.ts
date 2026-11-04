import { expect, it, vi } from "vitest";
import { deliverHakenNotices } from "./notify";
it("0件では送らず、重複する知らせは送らない", async () => {
  const claimed = new Set<string>();
  const store = {
    claim: async (key: string) => {
      if (claimed.has(key)) return false;
      claimed.add(key);
      return true;
    },
    sent: vi.fn(async () => {}),
  };
  const send = vi.fn(async () => {});
  await deliverHakenNotices([], "2026-11-04", false, store, send);
  expect(send).not.toHaveBeenCalled();
  const notices = [
    {
      key: "a",
      due: "2026-11-04",
      kind: "契約の更新確認",
      content: "社員A",
      workerId: "a",
    },
  ];
  await Promise.all([
    deliverHakenNotices(notices, "2026-11-04", false, store, send),
    deliverHakenNotices(notices, "2026-11-04", false, store, send),
  ]);
  expect(send).toHaveBeenCalledTimes(1);
});
it("送信失敗の知らせも１回、確認だけなら予約も送信もしない", async () => {
  const keys = new Set<string>();
  const store = {
    claim: vi.fn(async (key: string) => {
      if (keys.has(key)) return false;
      keys.add(key);
      return true;
    }),
    sent: vi.fn(async () => {}),
  };
  const send = vi.fn(async () => {
    throw new Error("送信失敗");
  });
  const notices = [
    {
      key: "missing:a",
      due: "2026-11-01",
      kind: "個別契約書",
      content: "社員A",
      workerId: "a",
    },
  ];
  await deliverHakenNotices(notices, "2026-11-04", true, store, send);
  expect(store.claim).not.toHaveBeenCalled();
  await deliverHakenNotices(notices, "2026-11-04", false, store, send);
  await deliverHakenNotices(notices, "2026-11-04", false, store, send);
  expect(send).toHaveBeenCalledTimes(2);
});
