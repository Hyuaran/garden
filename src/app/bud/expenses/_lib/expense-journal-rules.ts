import type { YayoiExportRow } from "@/shared/_lib/bank-csv-parsers/yayoi-csv-exporter";

export type ExpenseJournalInput = {
  id: string;
  receiptDate: string | null;
  categoryName: string | null;
  storeName: string | null;
  amount: number | null;
  qualifiedClass: string | null;
  applicantName: string | null;
};

export type ExpenseJournalResult = {
  id: string;
  ok: boolean;
  note: string;
  debitAccount: string;
  debitTaxClass: string;
  debitTaxAmount: number;
  creditAccount: "現金";
  creditTaxClass: "対象外";
  creditTaxAmount: 0;
  amount: number;
  description: string;
  transactionDate: string | null;
  source: "kubun" | "sonota" | "error";
  yayoiRow: YayoiExportRow | null;
};

type Mapping = { account: string; taxClass: string };

export const KUBUN_MAP: Record<string, Mapping> = {
  会議費: { account: "会議費", taxClass: "課税仕入 10%" },
  接待交際費: { account: "接待交際費", taxClass: "課税仕入 10%" },
  旅費交通費: { account: "旅費交通費", taxClass: "課税仕入 10%" },
  駐車場: { account: "旅費交通費", taxClass: "課税仕入 10%" },
  タクシー: { account: "旅費交通費", taxClass: "課税仕入 10%" },
  備品購入: { account: "消耗品費", taxClass: "課税仕入 10%" },
  社用車備品交換等: { account: "車両費", taxClass: "課税仕入 10%" },
  社用車罰金: { account: "車両費", taxClass: "対象外" },
  処分費: { account: "雑費", taxClass: "課税仕入 10%" },
};

export const SONOTA_MAP: Record<string, Mapping> = {
  KDDI: { account: "通信費", taxClass: "課税仕入 10%" },
  アサヒネット: { account: "システム費", taxClass: "課税仕入 10%" },
  朝日ネット: { account: "システム費", taxClass: "課税仕入 10%" },
  セブンイレブン: { account: "会議費", taxClass: "課税仕入 10%" },
  ソフトバンク: { account: "通信費", taxClass: "課税仕入 10%" },
  固定資産税: { account: "租税公課", taxClass: "対象外" },
  洗車: { account: "車両費", taxClass: "課税仕入 10%" },
};

const UNQUALIFIED_TAX_CLASS = "課対仕入80%控 10%";

export function classifyExpenseJournal(input: ExpenseJournalInput): ExpenseJournalResult {
  const amount = normalizeAmount(input.amount);
  const description = buildDescription(input.storeName, input.applicantName);
  const base = {
    id: input.id,
    creditAccount: "現金" as const,
    creditTaxClass: "対象外" as const,
    creditTaxAmount: 0 as const,
    amount,
    description,
    transactionDate: normalizeIsoDate(input.receiptDate),
  };

  if (amount <= 0) {
    return errorResult(base, "金額0円のため対象外");
  }
  if (!base.transactionDate) {
    return errorResult(base, "レシート日付が未設定");
  }

  const categoryName = (input.categoryName ?? "").trim();
  const storeName = input.storeName ?? "";
  const kubunMapping = categoryName && categoryName !== "その他" ? KUBUN_MAP[categoryName] : undefined;
  const sonotaHit = !kubunMapping ? findSonotaMapping(storeName) : null;
  const mapping = kubunMapping ?? sonotaHit?.mapping;
  const source = kubunMapping ? "kubun" : sonotaHit ? "sonota" : "error";

  if (!mapping) {
    return errorResult(base, "要確認: 区分または店名から科目を判定できません");
  }

  let debitAccount = mapping.account;
  let debitTaxClass = mapping.taxClass;
  const notes: string[] = [];

  if (source === "sonota" && sonotaHit) {
    notes.push(`店名「${sonotaHit.keyword}」で自動判定`);
  }

  if (input.qualifiedClass === "無" && debitTaxClass !== "対象外") {
    debitTaxClass = UNQUALIFIED_TAX_CLASS;
    notes.push("適格区分なし: 80%控除");
  }

  if (source !== "sonota") {
    const golf = /ゴルフ|ごるふ|golf/i.test(storeName);
    if (debitAccount === "会議費" && amount > 5000) {
      debitAccount = "接待交際費";
      notes.push("5,000円超: 会議費から接待交際費へ補正");
    } else if (debitAccount === "接待交際費" && amount <= 5000 && !golf) {
      debitAccount = "会議費";
      notes.push("5,000円以下: 接待交際費から会議費へ補正");
    } else if (debitAccount === "接待交際費" && amount <= 5000 && golf) {
      notes.push("ゴルフ関連: 接待交際費を維持");
    }
  }

  const debitTaxAmount = calculateIncludedTax(amount, debitTaxClass);
  const result: ExpenseJournalResult = {
    ...base,
    ok: true,
    note: notes.length > 0 ? notes.join(" / ") : "自動判定OK",
    debitAccount,
    debitTaxClass,
    debitTaxAmount,
    source,
    yayoiRow: {
      transaction_date: base.transactionDate,
      debit_account: debitAccount,
      debit_tax_class: debitTaxClass,
      debit_amount: amount,
      debit_tax_amount: debitTaxAmount,
      credit_account: "現金",
      credit_tax_class: "対象外",
      credit_amount: amount,
      credit_tax_amount: 0,
      description,
    },
  };
  return result;
}

export function toYayoiRows(results: ExpenseJournalResult[]): YayoiExportRow[] {
  return results
    .filter((result): result is ExpenseJournalResult & { yayoiRow: YayoiExportRow } => result.ok && result.yayoiRow !== null)
    .map((result, index) => ({ ...result.yayoiRow, denpyo_no: index + 1 }));
}

export function calculateIncludedTax(amount: number, taxClass: string) {
  if (taxClass.includes("10%")) return Math.floor(amount * 10 / 110);
  if (taxClass.includes("8%")) return Math.floor(amount * 8 / 108);
  return 0;
}

function findSonotaMapping(storeName: string) {
  for (const [keyword, mapping] of Object.entries(SONOTA_MAP)) {
    if (storeName.includes(keyword)) return { keyword, mapping };
  }
  return null;
}

function buildDescription(storeName: string | null, applicantName: string | null) {
  return `${storeName?.trim() || "店名未設定"} ${applicantName?.trim() || "申請者未設定"}`;
}

function normalizeAmount(value: number | null) {
  if (!value || !Number.isFinite(value)) return 0;
  return Math.floor(value);
}

function normalizeIsoDate(value: string | null) {
  if (!value) return null;
  const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? null;
}

function errorResult(
  base: Pick<ExpenseJournalResult, "id" | "creditAccount" | "creditTaxClass" | "creditTaxAmount" | "amount" | "description" | "transactionDate">,
  note: string,
): ExpenseJournalResult {
  return {
    ...base,
    ok: false,
    note,
    debitAccount: "要確認",
    debitTaxClass: "要確認",
    debitTaxAmount: 0,
    source: "error",
    yayoiRow: null,
  };
}
