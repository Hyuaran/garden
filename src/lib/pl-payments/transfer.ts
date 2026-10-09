import { createRecord, getRecords, type KintoneRecord } from "@/lib/kintone/records";

import { effectivePaymentDate, monthFromDate } from "./business-day";
import { kintoneText } from "./kintone-pl";
import type { AccountSource, PlPaymentRecord, TransferCreateResult } from "./types";

export type TransferClient = {
  findLatestAccount(record: PlPaymentRecord): Promise<AccountSource | null>;
  findDuplicateRequest(duplicateKey: string): Promise<string | null>;
  findDuplicateExecute(duplicateKey: string): Promise<string | null>;
  nextTransferId(date: string): Promise<string>;
  createRequest(record: KintoneRecord): Promise<string>;
  createExecute(record: KintoneRecord): Promise<string>;
};

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} が設定されていません`);
  return value;
}

function envOptional(name: string): string | undefined {
  return process.env[name];
}

function q(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function formalCompanyName(mfCompany: string): string {
  if (mfCompany === "センターライズ") return "株式会社センターライズ";
  if (mfCompany === "ヒュアラン") return "株式会社ヒュアラン";
  return mfCompany;
}

export function executionBank(mfCompany: string): string {
  if (mfCompany === "センターライズ") return "ジャパンネット銀行";
  if (mfCompany === "ヒュアラン") return "楽天銀行";
  return "";
}

export function duplicateKeyFor(record: PlPaymentRecord, account: AccountSource, dueDate: string): string {
  return `${dueDate.replace(/-/g, "")},${formalCompanyName(record.mfCompany)},${account.bankCode},${account.branchCode},${account.accountNumber},${record.amount},`;
}

export function identifierFor(account: AccountSource, amount: number): string {
  return `${account.bankCode}${account.branchCode}${account.accountNumber}${amount}`;
}

export function parseTransferSequence(raw: string): number {
  const match = /^FK-\d{8}-(\d{6})$/.exec(raw);
  return match ? Number(match[1]) : 0;
}

export function buildTransferId(date: string, previous: string | null): string {
  const next = parseTransferSequence(previous ?? "") + 1;
  return `FK-${date.replace(/-/g, "")}-${String(next).padStart(6, "0")}`;
}

export function buildTransferRecords(
  source: PlPaymentRecord,
  account: AccountSource,
  transferId: string,
  today: string,
): { request: KintoneRecord; execute: KintoneRecord; dueDate: string; duplicateKey: string; identifier: string } {
  const dueDate = effectivePaymentDate(source.dueDate);
  const company = formalCompanyName(source.mfCompany);
  const duplicateKey = duplicateKeyFor(source, account, dueDate);
  const identifier = identifierFor(account, source.amount);
  const period = source.periodDate ? monthFromDate(source.periodDate).replace("-", "年") + "月" : "";
  const content = `${period}分 ${source.taskName || source.vendor}`.trim();
  const common: KintoneRecord = {
    支払区分: { value: "振込" },
    ドロップダウン_6: { value: "支払待ち" },
    ドロップダウン_8: { value: "済み" },
    ドロップダウン_2: { value: company },
    ドロップダウン_3: { value: company },
    ドロップダウン_4: { value: executionBank(source.mfCompany) },
    ドロップダウン: { value: "東海林" },
    文字列__1行__0: { value: account.payee },
    文字列__1行__8: { value: content },
    数値: { value: String(source.amount) },
    数値_1: { value: account.fee || source.fee || "" },
    文字列__1行__2: { value: account.bankName },
    文字列__1行__3: { value: account.bankCode },
    文字列__1行__4: { value: account.branchName },
    文字列__1行__5: { value: account.branchCode },
    文字列__1行__6: { value: account.accountNumber },
    文字列__1行__7: { value: account.accountKana },
    ドロップダウン_7: { value: "1" },
    ドロップダウン_5: { value: "普通" },
    日付: { value: today },
    日付_0: { value: dueDate },
    文字列__1行__23: { value: dueDate.replace(/-/g, "").slice(4) },
    文字列__1行__36: { value: dueDate.replace(/-/g, "") },
    文字列__1行_: { value: transferId },
    文字列__1行__25: { value: "3" },
    文字列__1行__21: { value: "0" },
    リンク: { value: source.driveUrl || source.recordUrl },
  };

  return {
    request: { ...common, 重複キー: { value: duplicateKey } },
    execute: { ...common, 文字列__1行__26: { value: duplicateKey }, 文字列__1行__41: { value: identifier } },
    dueDate,
    duplicateKey,
    identifier,
  };
}

export class KintoneTransferClient implements TransferClient {
  private readonly requestApp = env("KINTONE_TRANSFER_REQUEST_APP_ID");
  private readonly requestToken = env("KINTONE_TRANSFER_REQUEST_TOKEN");
  private readonly executeApp = env("KINTONE_TRANSFER_EXECUTE_APP_ID");
  private readonly executeToken = env("KINTONE_TRANSFER_EXECUTE_TOKEN");

  async findLatestAccount(record: PlPaymentRecord): Promise<AccountSource | null> {
    const company = formalCompanyName(record.mfCompany);
    const vendor = q(record.vendor);
    const query =
      `(文字列__1行__7 like "${vendor}" or 文字列__1行__0 like "${vendor}") and ドロップダウン_2 in ("${q(company)}") order by $id desc limit 1`;
    const rows = await getRecords(this.requestApp, this.requestToken, query, [
      "$id",
      "文字列__1行__0",
      "文字列__1行__2",
      "文字列__1行__3",
      "文字列__1行__4",
      "文字列__1行__5",
      "文字列__1行__6",
      "文字列__1行__7",
      "数値_1",
    ]);
    if (!rows.length) return null;
    const row = rows[0];
    return {
      id: kintoneText(row, "$id"),
      payee: kintoneText(row, "文字列__1行__0"),
      bankName: kintoneText(row, "文字列__1行__2"),
      bankCode: kintoneText(row, "文字列__1行__3"),
      branchName: kintoneText(row, "文字列__1行__4"),
      branchCode: kintoneText(row, "文字列__1行__5"),
      accountNumber: kintoneText(row, "文字列__1行__6"),
      accountKana: kintoneText(row, "文字列__1行__7"),
      fee: kintoneText(row, "数値_1"),
    };
  }

  async findDuplicateRequest(duplicateKey: string): Promise<string | null> {
    const rows = await getRecords(this.requestApp, this.requestToken, `重複キー = "${q(duplicateKey)}" limit 1`, ["$id"]);
    return rows.length ? kintoneText(rows[0], "$id") : null;
  }

  async findDuplicateExecute(duplicateKey: string): Promise<string | null> {
    const rows = await getRecords(this.executeApp, this.executeToken, `文字列__1行__26 = "${q(duplicateKey)}" limit 1`, ["$id"]);
    return rows.length ? kintoneText(rows[0], "$id") : null;
  }

  async nextTransferId(date: string): Promise<string> {
    const rows = await getRecords(this.requestApp, this.requestToken, '文字列__1行_ like "FK-" order by 文字列__1行_ desc limit 1', ["文字列__1行_"]);
    return buildTransferId(date, rows.length ? kintoneText(rows[0], "文字列__1行_") : null);
  }

  async createRequest(record: KintoneRecord): Promise<string> {
    return (await createRecord(this.requestApp, this.requestToken, record)).id;
  }

  async createExecute(record: KintoneRecord): Promise<string> {
    return (await createRecord(this.executeApp, this.executeToken, record)).id;
  }
}

export async function createTransfersForPayment(
  source: PlPaymentRecord,
  client: TransferClient,
  options: { apply: boolean; today: string; existingRequestId?: string | null; transferId?: string | null },
): Promise<TransferCreateResult> {
  // 支払期日が無いと振込期日を決められない（Claude レビューで追加 2026-10-09）
  if (!source.dueDate) {
    return { transferId: "", duplicateKey: "", identifier: "", note: "支払期日が入っていません" };
  }
  if (!source.amount || source.amount <= 0) {
    return { transferId: "", duplicateKey: "", identifier: "", note: "支払金額が入っていません" };
  }
  const account = await client.findLatestAccount(source);
  if (!account) {
    return { transferId: "", duplicateKey: "", identifier: "", note: "口座が分かりません" };
  }
  const transferId = options.transferId || (await client.nextTransferId(effectivePaymentDate(source.dueDate)));
  const built = buildTransferRecords(source, account, transferId, options.today);
  const duplicateRequest = options.existingRequestId || (await client.findDuplicateRequest(built.duplicateKey));
  const duplicateExecute = await client.findDuplicateExecute(built.duplicateKey);

  if (!options.apply) {
    return {
      transferId,
      duplicateKey: built.duplicateKey,
      identifier: built.identifier,
      requestId: duplicateRequest ?? undefined,
      executeId: duplicateExecute ?? undefined,
      planned: true,
    };
  }

  const requestId = duplicateRequest ?? (await client.createRequest(built.request));
  const executeId = duplicateExecute ?? (await client.createExecute(built.execute));
  const subdomain = envOptional("KINTONE_SUBDOMAIN");
  const executeApp = envOptional("KINTONE_TRANSFER_EXECUTE_APP_ID");
  return {
    requestId,
    executeId,
    transferId,
    duplicateKey: built.duplicateKey,
    identifier: built.identifier,
    executeUrl: subdomain && executeApp ? `https://${subdomain}.cybozu.com/k/${executeApp}/show#record=${executeId}` : undefined,
  };
}
