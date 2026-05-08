import { describe, it, expect } from "vitest";
import {
  validateRegularCreate,
  validateCashbackCreate,
  validateAttachment,
  validateNotes,
  canSaveAsConfirmed,
  ATTACHMENT_MAX_BYTES,
} from "../transfer-create-schema";

function makeRegularInput() {
  return {
    request_company_id: "COMP-001",
    execute_company_id: "COMP-001",
    source_account_id: "ACC-001",
    payee_name: "株式会社山田",
    payee_bank_code: "0001",
    payee_branch_code: "100",
    payee_account_type: "1",
    payee_account_number: "1234567",
    payee_account_holder_kana: "ヤマダ タロウ",
    amount: 10000,
    scheduled_date: "2026-04-28",
  };
}

function makeCashbackInput() {
  return {
    ...makeRegularInput(),
    cashback_applicant_name: "山田太郎",
    cashback_applicant_name_kana: "ヤマダ タロウ",
    cashback_product_name: "au光sonnet",
    cashback_channel_name: "DPリンク",
  };
}

const MONDAY_2026_04_27 = new Date(2026, 3, 27);

describe("validateRegularCreate — 基本", () => {
  it("正常な入力は valid", () => {
    const r = validateRegularCreate(makeRegularInput(), {
      dataSource: "デジタル入力",
      today: MONDAY_2026_04_27,
    });
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual({});
  });

  it("base validateRegularForm のエラーも反映（payee_name 空）", () => {
    const r = validateRegularCreate(
      { ...makeRegularInput(), payee_name: "" },
      { dataSource: "デジタル入力", today: MONDAY_2026_04_27 },
    );
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveProperty("payee_name");
  });
});

describe("validateRegularCreate — V8 翌営業日", () => {
  it("月曜当日は NG", () => {
    const r = validateRegularCreate(
      { ...makeRegularInput(), scheduled_date: "2026-04-27" },
      { dataSource: "デジタル入力", today: MONDAY_2026_04_27 },
    );
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveProperty("scheduled_date");
  });

  it("金曜 → 週末は NG", () => {
    const fri = new Date(2026, 3, 24);
    const r = validateRegularCreate(
      { ...makeRegularInput(), scheduled_date: "2026-04-25" },
      { dataSource: "デジタル入力", today: fri },
    );
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveProperty("scheduled_date");
  });

  it("金曜 → 月曜は OK", () => {
    const fri = new Date(2026, 3, 24);
    const r = validateRegularCreate(
      { ...makeRegularInput(), scheduled_date: "2026-04-27" },
      { dataSource: "デジタル入力", today: fri },
    );
    expect(r.valid).toBe(true);
  });
});

describe("validateRegularCreate — dueDate", () => {
  it("dueDate < scheduledDate は NG", () => {
    const r = validateRegularCreate(
      {
        ...makeRegularInput(),
        scheduled_date: "2026-05-08",
        due_date: "2026-05-01",
      },
      { dataSource: "デジタル入力", today: MONDAY_2026_04_27 },
    );
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveProperty("due_date");
  });

  it("dueDate === scheduledDate は OK", () => {
    const r = validateRegularCreate(
      {
        ...makeRegularInput(),
        scheduled_date: "2026-05-08",
        due_date: "2026-05-08",
      },
      { dataSource: "デジタル入力", today: MONDAY_2026_04_27 },
    );
    expect(r.valid).toBe(true);
  });

  it("dueDate 省略は OK（任意）", () => {
    const r = validateRegularCreate(makeRegularInput(), {
      dataSource: "デジタル入力",
      today: MONDAY_2026_04_27,
    });
    expect(r.valid).toBe(true);
  });
});

describe("validateRegularCreate — 確認済み保存の可否（判8）", () => {
  it("デジタル入力で saveAsConfirmed=true は OK", () => {
    const r = validateRegularCreate(makeRegularInput(), {
      dataSource: "デジタル入力",
      saveAsConfirmed: true,
      today: MONDAY_2026_04_27,
    });
    expect(r.valid).toBe(true);
  });

  it("紙スキャンで saveAsConfirmed=true は NG", () => {
    const r = validateRegularCreate(makeRegularInput(), {
      dataSource: "紙スキャン",
      saveAsConfirmed: true,
      today: MONDAY_2026_04_27,
    });
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveProperty("save_as_confirmed");
  });

  it("CSVインポートで saveAsConfirmed=true は NG", () => {
    const r = validateRegularCreate(makeRegularInput(), {
      dataSource: "CSVインポート",
      saveAsConfirmed: true,
      today: MONDAY_2026_04_27,
    });
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveProperty("save_as_confirmed");
  });

  it("紙スキャンで saveAsConfirmed=false/未指定は OK", () => {
    const r = validateRegularCreate(makeRegularInput(), {
      dataSource: "紙スキャン",
      today: MONDAY_2026_04_27,
    });
    expect(r.valid).toBe(true);
  });
});

describe("validateAttachment", () => {
  it("添付なしは OK", () => {
    expect(validateAttachment(null).ok).toBe(true);
    expect(validateAttachment(undefined).ok).toBe(true);
  });

  it("PDF / JPG / PNG は OK", () => {
    const types = ["application/pdf", "image/jpeg", "image/png"] as const;
    for (const mimeType of types) {
      const r = validateAttachment({ name: `f.${mimeType}`, size: 1000, mimeType });
      expect(r.ok).toBe(true);
    }
  });

  it("未対応 MIME は NG", () => {
    const r = validateAttachment({
      name: "f.txt",
      size: 100,
      mimeType: "text/plain",
    });
    expect(r.ok).toBe(false);
  });

  it("10MB 超過は NG", () => {
    const r = validateAttachment({
      name: "big.pdf",
      size: ATTACHMENT_MAX_BYTES + 1,
      mimeType: "application/pdf",
    });
    expect(r.ok).toBe(false);
  });

  it("空ファイル（0 byte）は NG", () => {
    const r = validateAttachment({
      name: "empty.pdf",
      size: 0,
      mimeType: "application/pdf",
    });
    expect(r.ok).toBe(false);
  });
});

describe("validateNotes", () => {
  it("空は OK", () => {
    expect(validateNotes(null).ok).toBe(true);
    expect(validateNotes("").ok).toBe(true);
  });

  it("500 文字ちょうどは OK", () => {
    expect(validateNotes("あ".repeat(500)).ok).toBe(true);
  });

  it("501 文字は NG", () => {
    expect(validateNotes("あ".repeat(501)).ok).toBe(false);
  });
});

describe("canSaveAsConfirmed", () => {
  it("デジタル入力は可", () => {
    expect(canSaveAsConfirmed("デジタル入力")).toBe(true);
  });

  it("紙スキャン・CSVインポートは不可", () => {
    expect(canSaveAsConfirmed("紙スキャン")).toBe(false);
    expect(canSaveAsConfirmed("CSVインポート")).toBe(false);
  });
});

describe("validateCashbackCreate", () => {
  it("正常入力は valid", () => {
    const r = validateCashbackCreate(makeCashbackInput(), {
      dataSource: "デジタル入力",
      today: MONDAY_2026_04_27,
    });
    expect(r.valid).toBe(true);
  });

  it("cashback_applicant_name 空は NG", () => {
    const r = validateCashbackCreate(
      { ...makeCashbackInput(), cashback_applicant_name: "" },
      { dataSource: "デジタル入力", today: MONDAY_2026_04_27 },
    );
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveProperty("cashback_applicant_name");
  });

  it("scheduled_date が当日は NG（V8）", () => {
    const r = validateCashbackCreate(
      { ...makeCashbackInput(), scheduled_date: "2026-04-27" },
      { dataSource: "デジタル入力", today: MONDAY_2026_04_27 },
    );
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveProperty("scheduled_date");
  });
});
