import { beforeEach, describe, expect, it, vi } from "vitest";

import { runPlPaymentsCron, runPlPaymentsDaily, type PlPaymentRepository } from "./run";
import type { AccountSource, PaymentTaskRow, PlPaymentRecord } from "./types";

const payment: PlPaymentRecord = {
  id: "554",
  revision: "1",
  category: ["支払待ち"],
  status: "支払待ち",
  kind: "支払",
  vendor: "エンジンポット",
  taskName: "センターライズ",
  mfCompany: "センターライズ",
  owner: "金",
  amount: 585200,
  fee: "",
  dueDate: "2026-10-10",
  periodDate: "2026-08-01",
  driveUrl: "",
  recordUrl: "https://kintone.example/554",
};

const account: AccountSource = {
  id: "100",
  payee: "エンジンポット",
  bankName: "テスト銀行",
  bankCode: "0010",
  branchName: "本店",
  branchCode: "123",
  accountNumber: "4567890",
  accountKana: "エンジンポット",
  fee: "",
};

function repo(initial: PaymentTaskRow[] = []) {
  const rows = new Map(initial.map((row) => [row.pl_record_id, row]));
  const mock: PlPaymentRepository & { rows: Map<string, PaymentTaskRow> } = {
    rows,
    listTasks: vi.fn(async (ids?: string[]) => (ids?.length ? [...rows.values()].filter((row) => ids.includes(row.pl_record_id)) : [...rows.values()])),
    listTransferTasks: vi.fn(async () => [...rows.values()].filter((row) => row.transfer_request_id)),
    upsertTask: vi.fn(async (row) => {
      rows.set(row.pl_record_id, row);
    }),
    updateTask: vi.fn(async (id, patch) => {
      rows.set(id, { ...rows.get(id), ...patch, pl_record_id: id });
    }),
  };
  return mock;
}

function notifier() {
  return { send: vi.fn(async () => undefined) };
}

describe("pl payment run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PL_INVOICE_DRIVE_FOLDER_ID = "root";
  });

  it("sends new notice once, fills drive link, and creates 51 then 98", async () => {
    const calls: string[] = [];
    const store = repo();
    const note = notifier();
    const transferClient = {
      findLatestAccount: vi.fn().mockResolvedValue(account),
      findDuplicateRequest: vi.fn().mockResolvedValue(null),
      findDuplicateExecute: vi.fn().mockResolvedValue(null),
      nextTransferId: vi.fn().mockResolvedValue("FK-20261009-096116"),
      createRequest: vi.fn(async () => {
        calls.push("51");
        return "1773";
      }),
      createExecute: vi.fn(async () => {
        calls.push("98");
        return "1666";
      }),
    };

    await runPlPaymentsCron(
      { apply: true, trigger: "cron" },
      {
        fetchRecords: async () => [payment],
        repo: store,
        notifier: note,
        transferClient,
        driveLister: async (id) => {
          if (id === "root") return [{ id: "fiscal", name: "【決算第1期】", mimeType: "application/vnd.google-apps.folder", webViewLink: null, modifiedTime: null }];
          if (id === "fiscal") return [{ id: "month", name: "２０２６年０８月", mimeType: "application/vnd.google-apps.folder", webViewLink: null, modifiedTime: null }];
          return [{ id: "file1", name: "エンジンポット_202608.pdf", mimeType: "application/pdf", webViewLink: null, modifiedTime: null }];
        },
        updateDriveUrl: vi.fn(),
        updateTransferId: vi.fn(),
        now: new Date("2026-10-09T00:00:00.000Z"),
      },
    );

    expect(calls).toEqual(["51", "98"]);
    expect(note.send).toHaveBeenCalledTimes(2);
    expect(store.rows.get("554")?.transfer_request_id).toBe("1773");

    await runPlPaymentsCron(
      { apply: true, trigger: "cron" },
      {
        fetchRecords: async () => [{ ...payment, driveUrl: "https://drive.google.com/file/d/file1/view?usp=sharing" }],
        repo: store,
        notifier: note,
        transferClient,
        now: new Date("2026-10-09T00:00:00.000Z"),
      },
    );
    expect(note.send).toHaveBeenCalledTimes(2);
  });

  it("resumes with 98 when 51 was already recorded", async () => {
    const store = repo([{ pl_record_id: "554", transfer_request_id: "1773", transfer_id: "FK-20261009-096116" }]);
    const transferClient = {
      findLatestAccount: vi.fn().mockResolvedValue(account),
      findDuplicateRequest: vi.fn().mockResolvedValue("1773"),
      findDuplicateExecute: vi.fn().mockResolvedValue(null),
      nextTransferId: vi.fn(),
      createRequest: vi.fn(),
      createExecute: vi.fn().mockResolvedValue("1666"),
    };
    await runPlPaymentsCron(
      { apply: true, trigger: "cron" },
      { fetchRecords: async () => [{ ...payment, driveUrl: "u" }], repo: store, notifier: notifier(), transferClient, updateTransferId: vi.fn() },
    );
    expect(transferClient.createRequest).not.toHaveBeenCalled();
    expect(transferClient.createExecute).toHaveBeenCalled();
  });

  it("sends daily reminders and skips completed executions", async () => {
    const store = repo([
      { pl_record_id: "1", vendor: "エンジンポット", amount: 100, effective_due_date: "2026-10-13", transfer_request_id: "51", transfer_execute_id: "98" },
      { pl_record_id: "2", vendor: "完了先", amount: 200, effective_due_date: "2026-10-13", transfer_request_id: "52", transfer_execute_id: "99" },
    ]);
    const note = notifier();
    await runPlPaymentsDaily(
      { apply: true, trigger: "daily" },
      {
        repo: store,
        notifier: note,
        fetchExecuteStatus: async (id) => (id === "99" ? "完了" : "支払待ち"),
        now: new Date("2026-10-09T00:00:00.000Z"),
      },
    );
    expect(note.send).toHaveBeenCalledTimes(2);
    expect(store.rows.get("1")?.unreserved_alert_sent_on).toBe("2026-10-09");
    expect(store.rows.get("2")?.unreserved_alert_sent_on).toBeUndefined();
  });

  it("does not repeat the same drive problem notice", async () => {
    const store = repo([{ pl_record_id: "554", drive_match_note: "請求書が見つかりません" }]);
    const note = notifier();
    await runPlPaymentsCron(
      { apply: true, trigger: "cron" },
      {
        fetchRecords: async () => [payment],
        repo: store,
        notifier: note,
        transferClient: {
          findLatestAccount: vi.fn().mockResolvedValue(null),
          findDuplicateRequest: vi.fn(),
          findDuplicateExecute: vi.fn(),
          nextTransferId: vi.fn(),
          createRequest: vi.fn(),
          createExecute: vi.fn(),
        },
        driveLister: async () => [],
      },
    );
    expect(note.send).not.toHaveBeenCalledWith(expect.stringContaining("請求書リンク"));
  });
});
