import { describe, expect, it, vi } from "vitest";

import { buildTransferId, buildTransferRecords, createTransfersForPayment, formalCompanyName, type TransferClient } from "./transfer";
import type { AccountSource, PlPaymentRecord } from "./types";

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
  driveUrl: "https://drive.example/file",
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

describe("transfer", () => {
  it("builds record fields and transfer id sequence", () => {
    expect(formalCompanyName("センターライズ")).toBe("株式会社センターライズ");
    expect(buildTransferId("2026-10-09", "FK-20261009-096115")).toBe("FK-20261009-096116");

    const built = buildTransferRecords(payment, account, "FK-20261009-096116", "2026-10-09");
    expect(built.dueDate).toBe("2026-10-09");
    expect(built.duplicateKey).toBe("20261009,株式会社センターライズ,0010,123,4567890,585200,");
    expect(built.identifier).toBe("00101234567890585200");
    expect(built.request["ドロップダウン_4"]).toEqual({ value: "ジャパンネット銀行" });
    expect(built.request["文字列__1行_"]).toEqual({ value: "FK-20261009-096116" });
  });

  it("does not create records when a duplicate exists", async () => {
    const client: TransferClient = {
      findLatestAccount: vi.fn().mockResolvedValue(account),
      findDuplicateRequest: vi.fn().mockResolvedValue("1773"),
      findDuplicateExecute: vi.fn().mockResolvedValue("1666"),
      nextTransferId: vi.fn().mockResolvedValue("FK-20261009-096116"),
      createRequest: vi.fn(),
      createExecute: vi.fn(),
    };
    const result = await createTransfersForPayment(payment, client, { apply: true, today: "2026-10-09" });
    expect(result.requestId).toBe("1773");
    expect(result.executeId).toBe("1666");
    expect(client.createRequest).not.toHaveBeenCalled();
    expect(client.createExecute).not.toHaveBeenCalled();
  });
});

// Claude レビューで追加（2026-10-09）：支払期日・金額が無いときは作らず理由を返す
describe("createTransfersForPayment の前提チェック", () => {
  const base = { id: "1", revision: "1", category: ["支払待ち"], status: "支払待ち", kind: "支払", vendor: "テスト", taskName: "", mfCompany: "センターライズ", owner: "", amount: 1000, fee: "", dueDate: "2026-10-10", periodDate: "2026-08-01", driveUrl: "", recordUrl: "" };
  const client = { findLatestAccount: async () => null, findDuplicateRequest: async () => null, findDuplicateExecute: async () => null, nextTransferId: async () => "FK-20261009-000001", createRequest: async () => "1", createExecute: async () => "1" };
  it("支払期日が無ければ理由を返す", async () => {
    const result = await createTransfersForPayment({ ...base, dueDate: "" }, client, { apply: false, today: "2026-10-09" });
    expect(result.note).toBe("支払期日が入っていません");
  });
  it("支払金額が 0 なら理由を返す", async () => {
    const result = await createTransfersForPayment({ ...base, amount: 0 }, client, { apply: false, today: "2026-10-09" });
    expect(result.note).toBe("支払金額が入っていません");
  });
});
