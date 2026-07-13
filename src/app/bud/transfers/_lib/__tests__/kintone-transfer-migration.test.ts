import { describe, expect, it } from "vitest";

import {
  KINTONE_TRANSFER_FIELDS,
  applyExecutedDateSupplementNote,
  analyzeKintoneTransfers,
  computeTransferDuplicateKey,
  mapKintoneStatus,
  mapPaymentCategory,
  mapRegisteredMethod,
  normalizeBankName,
  resolveExecutedDate,
  resolveSourceAccountOverride,
  requiredMissingFields,
  type KintoneRecord,
  type TransferInsertPayload,
} from "../kintone-transfer-migration";

const f = KINTONE_TRANSFER_FIELDS;

function field(value: unknown) {
  return { value };
}

function record(overrides: Record<string, unknown> = {}): KintoneRecord {
  return {
    [f.recordNumber]: field("100"),
    [f.transferId]: field("FK-20260710-095947"),
    [f.status]: field("完了"),
    [f.paymentCategory]: field("振込"),
    [f.amount]: field("1200"),
    [f.payeeName]: field("テスト支払先"),
    [f.payeeBankName]: field("楽天銀行"),
    [f.payeeBranchName]: field("第一支店"),
    [f.payeeAccountNumber]: field("1234567"),
    [f.payeeAccountHolderKana]: field("テスト"),
    [f.requestDate]: field("2026-07-10"),
    [f.executedDate]: field("2026-07-11"),
    [f.requestCompanyName]: field("株式会社ヒュアラン"),
    [f.executeCompanyName]: field("株式会社ヒュアラン"),
    [f.executeBankName]: field("楽天銀行"),
    ...Object.fromEntries(Object.entries(overrides).map(([key, value]) => [key, field(value)])),
  };
}

const masters = {
  companies: [
    { company_id: "COMP-001", company_name: "株式会社ヒュアラン" },
    { company_id: "COMP-002", company_name: "株式会社センターライズ" },
  ],
  corps: [
    { id: "hyuaran", name_short: "ヒュアラン" },
    { id: "centerrise", name_short: "センターライズ" },
  ],
  bankAccounts: [
    { id: "bank-1", corp_code: "hyuaran", bank_name: "楽天銀行", branch_name: "第一営業支店" },
    { id: "bank-2", corp_code: "centerrise", bank_name: "PayPay銀行", branch_name: "ビジネス営業部" },
    { id: "bank-3", corp_code: "centerrise", bank_name: "みずほ銀行", branch_name: "四ツ橋支店", account_number: "3024334" },
    { id: "bank-4", corp_code: "hyuaran", bank_name: "みずほ銀行", branch_name: "四ツ橋支店", account_number: "1252992" },
  ],
  existingTransferIds: new Set<string>(),
  existingDuplicateKeys: new Set<string>(),
};

describe("kintone transfer migration mapping", () => {
  it("maps Kintone statuses to Garden statuses", () => {
    expect(mapKintoneStatus("完了")).toBe("振込完了");
    expect(mapKintoneStatus("支払待ち")).toBe("承認待ち");
    expect(mapKintoneStatus("依頼廃止")).toBeNull();
  });

  it("maps payment category and registered method", () => {
    expect(mapPaymentCategory("振込")).toBe("transfer");
    expect(mapPaymentCategory("ペイジー")).toBe("payeasy");
    expect(mapPaymentCategory("現金")).toBe("deposit");
    expect(mapPaymentCategory("決済登録済")).toBe("registered");
    expect(mapRegisteredMethod("クレジットカード")).toBe("credit_card");
    expect(mapRegisteredMethod("口座振替")).toBe("direct_debit");
    expect(mapRegisteredMethod("自動振込")).toBe("auto_transfer");
  });

  it("skips duplicate transfer_id before insert", () => {
    const result = analyzeKintoneTransfers([record()], {
      ...masters,
      existingTransferIds: new Set(["FK-20260710-095947"]),
    });
    expect(result.insertable).toHaveLength(0);
    expect(result.duplicates[0]?.transferId).toBe("FK-20260710-095947");
  });

  it("computes duplicate_key with PostgreSQL concat_ws null semantics", () => {
    expect(
      computeTransferDuplicateKey(
        payload({
          scheduled_date: "2026-07-10",
          payee_bank_code: "0001",
          payee_branch_code: null,
          payee_account_number: "1234567",
          amount: 1200,
        }),
      ),
    ).toBe("20260710,0001,1234567,1200");
    expect(
      computeTransferDuplicateKey(
        payload({
          scheduled_date: null,
          payee_bank_code: "",
          payee_branch_code: null,
          payee_account_number: null,
          amount: 1200,
        }),
      ),
    ).toBe(",1200");
  });

  it("flags only the second transfer_id for the same duplicate_key in stable order", () => {
    const shared = {
      [f.scheduledDate]: "2026-07-10",
      [f.payeeBankCode]: "0001",
      [f.payeeBranchCode]: "100",
      [f.payeeAccountNumber]: "1234567",
    };
    const result = analyzeKintoneTransfers(
      [
        record({ ...shared, [f.transferId]: "FK-002" }),
        record({ ...shared, [f.transferId]: "FK-001" }),
        record({ ...shared, [f.transferId]: "FK-003", [f.amount]: "1300" }),
      ],
      masters,
    );
    const flags = Object.fromEntries(result.insertable.map((row) => [row.transferId, row.payload.duplicate_flag]));
    expect(flags).toEqual({ "FK-002": true, "FK-001": false, "FK-003": false });
    expect(result.insertable.find((row) => row.transferId === "FK-002")?.payload.duplicate_confirmed).toBe(true);
  });

  it("flags a new transfer when its duplicate_key already exists", () => {
    const input = record({
      [f.scheduledDate]: "2026-07-10",
      [f.payeeBankCode]: "0001",
      [f.payeeBranchCode]: "100",
      [f.payeeAccountNumber]: "1234567",
    });
    const result = analyzeKintoneTransfers([input], {
      ...masters,
      existingDuplicateKeys: new Set(["20260710,0001,100,1234567,1200"]),
    });
    expect(result.insertable[0]?.payload).toMatchObject({ duplicate_flag: true, duplicate_confirmed: true });
  });

  it("requires bank account fields only for transfer payments", () => {
    const transfer = payload({ payment_category: "transfer", payee_account_number: null });
    const cash = payload({ payment_category: "cash", payee_account_number: null });
    expect(requiredMissingFields(transfer)).toContain("payee_account_number");
    expect(requiredMissingFields(cash)).not.toContain("payee_account_number");
  });

  it("normalizes old bank names to current bank names", () => {
    expect(normalizeBankName("ジャパンネット銀行")).toBe("PayPay銀行");
    expect(normalizeBankName("三菱東京ＵＦＪ銀行")).toBe("三菱UFJ銀行");
    expect(normalizeBankName("楽天銀行")).toBe("楽天銀行");
  });

  it.each([
    ["994", "bank-3", "centerrise みずほ銀行 四ツ橋支店 3024334"],
    ["1018", "bank-3", "centerrise みずほ銀行 四ツ橋支店 3024334"],
    ["1580", "bank-4", "hyuaran みずほ銀行 四ツ橋支店 1252992"],
  ])("overrides source account for Kintone record %s", (recordNumber, accountId, label) => {
    expect(resolveSourceAccountOverride(recordNumber, masters)).toMatchObject({
      accountId,
      label,
      reason: "source_account_id 確定補正",
      supplemented: true,
    });
  });

  it("fails when a source account override is missing from the master", () => {
    expect(() => resolveSourceAccountOverride("994", { bankAccounts: [] })).toThrow("rec994");
  });

  it("applies the record override before normal source account resolution", () => {
    const result = analyzeKintoneTransfers(
      [
        record({
          [f.recordNumber]: "994",
          [f.requestCompanyName]: "株式会社センターライズ",
          [f.executeCompanyName]: "株式会社センターライズ",
          [f.executeBankName]: "楽天銀行",
        }),
      ],
      masters,
    );
    expect(result.insertable[0]?.payload.source_account_id).toBe("bank-3");
    expect(result.sourceAccountSupplements[0]).toMatchObject({
      recordNumber: "994",
      reason: "source_account_id 確定補正",
      value: "centerrise みずほ銀行 四ツ橋支店 3024334",
    });
  });

  it("supplements executed_date from due_date and appends an audit note", () => {
    const resolved = resolveExecutedDate("", "2025-04-18");
    expect(resolved).toEqual({ value: "2025-04-18", supplemented: true });
    expect(applyExecutedDateSupplementNote("既存備考", resolved.supplemented)).toBe("既存備考\n※移行時に実行日を支払期日で補完");
  });

  it("requires executed_date for every insert target after supplementation", () => {
    expect(requiredMissingFields(payload({ executed_date: null }))).toContain("executed_date");
  });

  it("uses request company when execute company is blank", () => {
    const result = analyzeKintoneTransfers([record({ [f.executeCompanyName]: "" })], masters);
    expect(result.insertable[0]?.payload).toMatchObject({
      company_id: "COMP-001",
      request_company_id: "COMP-001",
      execute_company_id: "COMP-001",
    });
  });

  it("supplements completed source accounts from request company when execute bank is blank", () => {
    const result = analyzeKintoneTransfers(
      [
        record({
          [f.requestCompanyName]: "株式会社センターライズ",
          [f.executeCompanyName]: "",
          [f.executeBankName]: "",
        }),
      ],
      masters,
    );
    expect(result.insertable[0]?.payload.source_account_id).toBe("bank-2");
    expect(result.sourceAccountSupplements[0]).toMatchObject({
      transferId: "FK-20260710-095947",
      reason: "source_account_id 補完",
    });
  });

  it("converts insertable transfer records", () => {
    const result = analyzeKintoneTransfers([record()], masters);
    expect(result.insertable).toHaveLength(1);
    expect(result.insertable[0]?.payload).toMatchObject({
      transfer_id: "FK-20260710-095947",
      status: "振込完了",
      payment_category: "transfer",
      source_account_id: "bank-1",
      request_company_id: "COMP-001",
      execute_company_id: "COMP-001",
    });
  });
});

function payload(overrides: Partial<TransferInsertPayload>): TransferInsertPayload {
  return {
    transfer_id: "FK-1",
    status: "振込完了",
    data_source: "Kintone移行",
    transfer_category: "regular",
    transfer_type: null,
    request_date: "2026-07-10",
    due_date: null,
    scheduled_date: null,
    executed_date: "2026-07-10",
    company_id: "COMP-001",
    request_company_id: "COMP-001",
    execute_company_id: "COMP-001",
    source_account_id: null,
    vendor_id: null,
    payee_name: "テスト",
    payee_bank_name: "銀行",
    payee_bank_code: null,
    payee_branch_name: "支店",
    payee_branch_code: null,
    payee_account_type: null,
    payee_account_number: "123",
    payee_account_holder_kana: "テスト",
    fee_bearer: null,
    amount: 100,
    description: null,
    created_by: null,
    confirmed_by: null,
    confirmed_at: null,
    approved_by: null,
    approved_at: null,
    csv_exported_by: null,
    csv_exported_at: null,
    executed_by: null,
    rejection_reason: null,
    batch_code: null,
    duplicate_flag: false,
    duplicate_confirmed: false,
    scan_image_url: null,
    invoice_pdf_url: null,
    payee_mismatch_confirmed: false,
    payment_category: "transfer",
    registered_method: null,
    manual_paid_at: null,
    payeasy_biller_no: null,
    payeasy_customer_no: null,
    payeasy_confirm_no: null,
    ...overrides,
  };
}
