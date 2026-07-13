export type PaymentCategory = "transfer" | "payeasy" | "cash" | "deposit" | "registered";
export type RegisteredMethod = "credit_card" | "direct_debit" | "auto_transfer";
export type GardenTransferStatus = "承認待ち" | "振込完了";

export type KintoneField<T = unknown> = { value?: T };
export type KintoneRecord = Record<string, KintoneField>;

export type CompanyMaster = {
  company_id: string;
  company_name: string | null;
};

export type CorpMaster = {
  id: string;
  name_short: string | null;
};

export type BankAccountMaster = {
  id: string;
  corp_code: string | null;
  bank_name: string | null;
  branch_name?: string | null;
  account_number?: string | null;
  sub_account_label?: string | null;
};

export type MigrationMasters = {
  companies: CompanyMaster[];
  corps: CorpMaster[];
  bankAccounts: BankAccountMaster[];
  existingTransferIds: Set<string>;
};

export type MigrationIssue = {
  recordNumber: string;
  transferId: string;
  amount: number | null;
  paymentCategory: PaymentCategory | null;
  reason: string;
  missingFields?: string[];
};

export type MigrationSupplement = {
  recordNumber: string;
  transferId: string;
  amount: number | null;
  payeeName: string;
  reason: string;
  value: string;
};

export type TransferInsertPayload = {
  transfer_id: string;
  status: GardenTransferStatus;
  data_source: string;
  transfer_category: "regular";
  transfer_type: null;
  request_date: string;
  due_date: string | null;
  scheduled_date: string | null;
  executed_date: string | null;
  company_id: string | null;
  request_company_id: string | null;
  execute_company_id: string | null;
  source_account_id: string | null;
  vendor_id: null;
  payee_name: string;
  payee_bank_name: string | null;
  payee_bank_code: string | null;
  payee_branch_name: string | null;
  payee_branch_code: string | null;
  payee_account_type: string | null;
  payee_account_number: string | null;
  payee_account_holder_kana: string | null;
  fee_bearer: null;
  amount: number;
  description: string | null;
  created_by: null;
  confirmed_by: null;
  confirmed_at: null;
  approved_by: null;
  approved_at: null;
  csv_exported_by: null;
  csv_exported_at: null;
  executed_by: null;
  rejection_reason: null;
  batch_code: null;
  duplicate_flag: false;
  duplicate_confirmed: false;
  scan_image_url: null;
  invoice_pdf_url: string | null;
  payee_mismatch_confirmed: false;
  payment_category: PaymentCategory;
  registered_method: RegisteredMethod | null;
  manual_paid_at: null;
  payeasy_biller_no: string | null;
  payeasy_customer_no: string | null;
  payeasy_confirm_no: string | null;
};

export type ConvertedTransfer = {
  recordNumber: string;
  transferId: string;
  payload: TransferInsertPayload;
  sourceAccountUnresolvedReason: string | null;
  sourceAccountSupplement: MigrationSupplement | null;
  executedDateSupplement: MigrationSupplement | null;
};

export type MigrationAnalysis = {
  total: number;
  statusCounts: Record<string, number>;
  insertable: ConvertedTransfer[];
  skipped: MigrationIssue[];
  duplicates: MigrationIssue[];
  missingRequired: MigrationIssue[];
  sourceAccountUnresolved: MigrationIssue[];
  sourceAccountSupplements: MigrationSupplement[];
  executedDateSupplements: MigrationSupplement[];
  samples: TransferInsertPayload[];
};

export const KINTONE_TRANSFER_FIELDS = {
  recordNumber: "レコード番号",
  transferId: "文字列__1行_",
  status: "ドロップダウン_6",
  paymentCategory: "支払区分",
  registeredMethod: "決済登録区分",
  amount: "数値",
  payeeName: "文字列__1行__0",
  payeeBankName: "文字列__1行__2",
  payeeBankCode: "文字列__1行__3",
  payeeBranchName: "文字列__1行__4",
  payeeBranchCode: "文字列__1行__5",
  payeeAccountNumber: "文字列__1行__6",
  payeeAccountHolderKana: "文字列__1行__7",
  payeeAccountType: "ドロップダウン_7",
  payeeAccountTypeFallback: "文字列__1行__18",
  requestDate: "日付",
  dueDate: "日付_0",
  scheduledDate: "日付_5",
  executedDate: "日付_1",
  requestCompanyName: "ドロップダウン_2",
  executeCompanyName: "ドロップダウン_3",
  executeBankName: "ドロップダウン_4",
  description: "文字列__1行__8",
  note: "文字列__複数行__0",
  invoiceUrl: "リンク",
  payeasyBillerNo: "収納期間番号",
  payeasyCustomerNo: "納付番号_お客様番号",
  payeasyConfirmNo: "確認番号",
} as const;

const SKIPPED_STATUSES = new Set(["依頼廃止", "未確認", "経理待ち", "実行完了", "ステイ", "チェック待ち-使用不可-"]);

export function analyzeKintoneTransfers(records: KintoneRecord[], masters: MigrationMasters): MigrationAnalysis {
  const statusCounts: Record<string, number> = {};
  const insertable: ConvertedTransfer[] = [];
  const skipped: MigrationIssue[] = [];
  const duplicates: MigrationIssue[] = [];
  const missingRequired: MigrationIssue[] = [];
  const sourceAccountUnresolved: MigrationIssue[] = [];
  const sourceAccountSupplements: MigrationSupplement[] = [];
  const executedDateSupplements: MigrationSupplement[] = [];

  for (const record of records) {
    const source = readSource(record);
    statusCounts[source.rawStatus || "(blank)"] = (statusCounts[source.rawStatus || "(blank)"] ?? 0) + 1;
    const baseIssue = {
      recordNumber: source.recordNumber,
      transferId: source.transferId,
      amount: source.amount,
      paymentCategory: source.paymentCategory,
    };

    if (!source.gardenStatus) {
      skipped.push({ ...baseIssue, reason: statusSkipReason(source.rawStatus) });
      continue;
    }
    if (!source.transferId) {
      missingRequired.push({ ...baseIssue, reason: "振込IDが空", missingFields: ["transfer_id"] });
      continue;
    }
    if (masters.existingTransferIds.has(source.transferId)) {
      duplicates.push({ ...baseIssue, reason: "transfer_id already exists" });
      continue;
    }

    const requestCompanyId = resolveCompanyId(source.requestCompanyName, masters.companies);
    const executeCompanyId = resolveCompanyId(source.effectiveExecuteCompanyName, masters.companies);
    const sourceAccount =
      resolveSourceAccountOverride(source.recordNumber, masters) ??
      resolveSourceAccountId({
        status: source.gardenStatus,
        requestCompanyId,
        executeCompanyId,
        executeBankName: source.executeBankName,
        masters,
      });
    const executedDate = resolveExecutedDate(source.executedDate, source.dueDate);
    const description = applyExecutedDateSupplementNote(source.description, executedDate.supplemented);
    const payload = buildTransferPayload(source, requestCompanyId, executeCompanyId, sourceAccount.accountId, executedDate.value, description);
    const missing = requiredMissingFields(payload);
    if (missing.length > 0) {
      missingRequired.push({ ...baseIssue, reason: "必須項目不足", missingFields: missing });
      continue;
    }
    const sourceAccountSupplement = "supplemented" in sourceAccount && sourceAccount.supplemented
      ? supplement(source, sourceAccount.reason ?? "source_account_id 補完", sourceAccount.label)
      : null;
    const executedDateSupplement = executedDate.supplemented ? supplement(source, "executed_date 補完", executedDate.value ?? "") : null;
    if (sourceAccount.reason && !("supplemented" in sourceAccount && sourceAccount.supplemented)) sourceAccountUnresolved.push({ ...baseIssue, reason: sourceAccount.reason });
    if (sourceAccountSupplement) sourceAccountSupplements.push(sourceAccountSupplement);
    if (executedDateSupplement) executedDateSupplements.push(executedDateSupplement);
    insertable.push({
      recordNumber: source.recordNumber,
      transferId: source.transferId,
      payload,
      sourceAccountUnresolvedReason: sourceAccount.reason,
      sourceAccountSupplement,
      executedDateSupplement,
    });
  }

  return {
    total: records.length,
    statusCounts,
    insertable,
    skipped,
    duplicates,
    missingRequired,
    sourceAccountUnresolved,
    sourceAccountSupplements,
    executedDateSupplements,
    samples: insertable.slice(0, 5).map((row) => row.payload),
  };
}

export function mapKintoneStatus(value: string): GardenTransferStatus | null {
  if (value === "完了") return "振込完了";
  if (value === "支払待ち") return "承認待ち";
  return null;
}

export function mapPaymentCategory(value: string): PaymentCategory {
  if (value === "ペイジー") return "payeasy";
  if (value === "現金") return "deposit";
  if (value === "決済登録済") return "registered";
  return "transfer";
}

export function mapRegisteredMethod(value: string): RegisteredMethod | null {
  if (value === "クレジットカード") return "credit_card";
  if (value === "口座振替") return "direct_debit";
  if (value === "自動振込") return "auto_transfer";
  return null;
}

export function resolveCompanyId(companyName: string, companies: CompanyMaster[]) {
  const normalized = normalizeName(companyName);
  if (!normalized) return null;
  return (
    companies.find((company) => normalizeName(company.company_name ?? "") === normalized)?.company_id ??
    companies.find((company) => normalized.includes(normalizeName(company.company_name ?? "")) || normalizeName(company.company_name ?? "").includes(normalized))?.company_id ??
    null
  );
}

export function normalizeBankName(value: string) {
  const normalized = value.normalize("NFKC").trim();
  if (normalized === "ジャパンネット銀行") return "PayPay銀行";
  if (normalized === "三菱東京UFJ銀行") return "三菱UFJ銀行";
  return normalized;
}

const SOURCE_ACCOUNT_OVERRIDES: Record<string, { corpCode: string; bankName: string; branchName: string; accountNumber: string }> = {
  "994": { corpCode: "centerrise", bankName: "みずほ銀行", branchName: "四ツ橋支店", accountNumber: "3024334" },
  "1018": { corpCode: "centerrise", bankName: "みずほ銀行", branchName: "四ツ橋支店", accountNumber: "3024334" },
  "1580": { corpCode: "hyuaran", bankName: "みずほ銀行", branchName: "四ツ橋支店", accountNumber: "1252992" },
};

export function resolveSourceAccountOverride(
  recordNumber: string,
  masters: Pick<MigrationMasters, "bankAccounts">,
) {
  const normalizedRecordNumber = recordNumber.replace(/^rec/i, "");
  const override = SOURCE_ACCOUNT_OVERRIDES[normalizedRecordNumber];
  if (!override) return null;
  const bank = normalizeName(normalizeBankName(override.bankName));
  const branch = normalizeName(override.branchName);
  const accountNumber = digits(override.accountNumber);
  const account = masters.bankAccounts.find(
    (row) =>
      row.corp_code === override.corpCode &&
      normalizeName(normalizeBankName(row.bank_name ?? "")) === bank &&
      normalizeName(row.branch_name ?? "") === branch &&
      digits(row.account_number ?? "") === accountNumber,
  );
  if (!account) {
    throw new Error(
      `source_account_id 確定補正の口座がマスタにありません: rec${normalizedRecordNumber} ${override.corpCode} ${override.bankName} ${override.branchName} ${override.accountNumber}`,
    );
  }
  return {
    accountId: account.id,
    reason: "source_account_id 確定補正",
    supplemented: true as const,
    label: `${override.corpCode} ${override.bankName} ${override.branchName} ${override.accountNumber}`,
  };
}

export function resolveExecutedDate(executedDate: string | null | undefined, dueDate: string | null | undefined) {
  if (executedDate) return { value: executedDate, supplemented: false };
  if (dueDate) return { value: dueDate, supplemented: true };
  return { value: null, supplemented: false };
}

export function applyExecutedDateSupplementNote(description: string | null, supplemented: boolean) {
  if (!supplemented) return description;
  const note = "※移行時に実行日を支払期日で補完";
  return description ? `${description}\n${note}` : note;
}

export function resolveSourceAccountId({
  status,
  requestCompanyId,
  executeCompanyId,
  executeBankName,
  masters,
}: {
  status: GardenTransferStatus | null;
  requestCompanyId: string | null;
  executeCompanyId: string | null;
  executeBankName: string;
  masters: Pick<MigrationMasters, "companies" | "corps" | "bankAccounts">;
}) {
  if (!executeCompanyId) return { accountId: null, reason: "実行会社を解決できないため source_account_id 未解決" };
  const corpCode = resolveCorpCode(executeCompanyId, masters.companies, masters.corps);
  if (!corpCode) return { accountId: null, reason: `corp_code 未解決: ${executeCompanyId}` };
  const bankName = normalizeBankName(executeBankName);
  const bank = normalizeName(bankName);
  const candidates = masters.bankAccounts.filter((account) => account.corp_code === corpCode);
  if (!bank && status === "承認待ち") return { accountId: null, reason: "承認待ちのため source_account_id 未設定" };
  if (!bank && status === "振込完了") {
    const fallback = resolveCompletedSourceAccountFallback(requestCompanyId, masters);
    if (fallback) return { ...fallback, reason: "source_account_id 補完", supplemented: true };
  }
  const matched = bank
    ? candidates.filter((account) => normalizeName(normalizeBankName(account.bank_name ?? "")).includes(bank) || bank.includes(normalizeName(normalizeBankName(account.bank_name ?? ""))))
    : candidates;
  if (matched.length === 1) return { accountId: matched[0].id, reason: null };
  if (matched.length === 0) return { accountId: null, reason: `source_account_id 未解決: corp_code=${corpCode}, bank=${bankName || "(blank)"}` };
  return { accountId: null, reason: `source_account_id 複数候補: corp_code=${corpCode}, bank=${bankName || "(blank)"}, count=${matched.length}` };
}

function readSource(record: KintoneRecord) {
  const rawStatus = text(record, KINTONE_TRANSFER_FIELDS.status);
  const paymentCategory = mapPaymentCategory(text(record, KINTONE_TRANSFER_FIELDS.paymentCategory));
  const requestCompanyName = text(record, KINTONE_TRANSFER_FIELDS.requestCompanyName);
  const executeCompanyName = text(record, KINTONE_TRANSFER_FIELDS.executeCompanyName);
  const dueDate = dateText(record, KINTONE_TRANSFER_FIELDS.dueDate);
  return {
    recordNumber: text(record, KINTONE_TRANSFER_FIELDS.recordNumber),
    transferId: text(record, KINTONE_TRANSFER_FIELDS.transferId),
    rawStatus,
    gardenStatus: mapKintoneStatus(rawStatus),
    paymentCategory,
    registeredMethod: mapRegisteredMethod(text(record, KINTONE_TRANSFER_FIELDS.registeredMethod)),
    amount: numberValue(record, KINTONE_TRANSFER_FIELDS.amount),
    payeeName: text(record, KINTONE_TRANSFER_FIELDS.payeeName),
    payeeBankName: normalizeBankName(text(record, KINTONE_TRANSFER_FIELDS.payeeBankName)),
    payeeBankCode: text(record, KINTONE_TRANSFER_FIELDS.payeeBankCode),
    payeeBranchName: text(record, KINTONE_TRANSFER_FIELDS.payeeBranchName),
    payeeBranchCode: text(record, KINTONE_TRANSFER_FIELDS.payeeBranchCode),
    payeeAccountType: text(record, KINTONE_TRANSFER_FIELDS.payeeAccountType) || text(record, KINTONE_TRANSFER_FIELDS.payeeAccountTypeFallback),
    payeeAccountNumber: text(record, KINTONE_TRANSFER_FIELDS.payeeAccountNumber),
    payeeAccountHolderKana: text(record, KINTONE_TRANSFER_FIELDS.payeeAccountHolderKana),
    requestDate: dateText(record, KINTONE_TRANSFER_FIELDS.requestDate),
    dueDate,
    scheduledDate: dateText(record, KINTONE_TRANSFER_FIELDS.scheduledDate) || dueDate,
    executedDate: dateText(record, KINTONE_TRANSFER_FIELDS.executedDate),
    requestCompanyName,
    executeCompanyName,
    effectiveExecuteCompanyName: executeCompanyName || requestCompanyName,
    executeBankName: normalizeBankName(text(record, KINTONE_TRANSFER_FIELDS.executeBankName)),
    description: joinText([text(record, KINTONE_TRANSFER_FIELDS.description), text(record, KINTONE_TRANSFER_FIELDS.note)]),
    invoiceUrl: text(record, KINTONE_TRANSFER_FIELDS.invoiceUrl),
    payeasyBillerNo: digits(text(record, KINTONE_TRANSFER_FIELDS.payeasyBillerNo)),
    payeasyCustomerNo: digits(text(record, KINTONE_TRANSFER_FIELDS.payeasyCustomerNo)),
    payeasyConfirmNo: digits(text(record, KINTONE_TRANSFER_FIELDS.payeasyConfirmNo)),
  };
}

function buildTransferPayload(
  source: ReturnType<typeof readSource>,
  requestCompanyId: string | null,
  executeCompanyId: string | null,
  sourceAccountId: string | null,
  executedDate: string | null,
  description: string | null,
): TransferInsertPayload {
  return {
    transfer_id: source.transferId,
    status: source.gardenStatus ?? "承認待ち",
    data_source: "Kintone移行",
    transfer_category: "regular",
    transfer_type: null,
    request_date: source.requestDate,
    due_date: source.dueDate,
    scheduled_date: source.scheduledDate,
    executed_date: executedDate,
    company_id: executeCompanyId,
    request_company_id: requestCompanyId,
    execute_company_id: executeCompanyId,
    source_account_id: sourceAccountId,
    vendor_id: null,
    payee_name: source.payeeName,
    payee_bank_name: source.paymentCategory === "transfer" ? source.payeeBankName || null : null,
    payee_bank_code: source.paymentCategory === "transfer" ? source.payeeBankCode || null : null,
    payee_branch_name: source.paymentCategory === "transfer" ? source.payeeBranchName || null : null,
    payee_branch_code: source.paymentCategory === "transfer" ? source.payeeBranchCode || null : null,
    payee_account_type: source.paymentCategory === "transfer" ? source.payeeAccountType || null : null,
    payee_account_number: source.paymentCategory === "transfer" ? source.payeeAccountNumber || null : null,
    payee_account_holder_kana: source.paymentCategory === "transfer" ? source.payeeAccountHolderKana || null : null,
    fee_bearer: null,
    amount: source.amount ?? 0,
    description,
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
    invoice_pdf_url: source.invoiceUrl || null,
    payee_mismatch_confirmed: false,
    payment_category: source.paymentCategory,
    registered_method: source.paymentCategory === "registered" ? source.registeredMethod : null,
    manual_paid_at: null,
    payeasy_biller_no: source.paymentCategory === "payeasy" ? source.payeasyBillerNo || null : null,
    payeasy_customer_no: source.paymentCategory === "payeasy" ? source.payeasyCustomerNo || null : null,
    payeasy_confirm_no: source.paymentCategory === "payeasy" ? source.payeasyConfirmNo || null : null,
  };
}

export function requiredMissingFields(payload: TransferInsertPayload) {
  const missing: string[] = [];
  if (!payload.transfer_id) missing.push("transfer_id");
  if (!payload.status) missing.push("status");
  if (!payload.request_date) missing.push("request_date");
  if (!payload.payee_name) missing.push("payee_name");
  if (!payload.amount || payload.amount <= 0) missing.push("amount");
  if (!payload.executed_date) missing.push("executed_date");
  if (payload.payment_category === "transfer") {
    if (!payload.payee_bank_name) missing.push("payee_bank_name");
    if (!payload.payee_branch_name) missing.push("payee_branch_name");
    if (!payload.payee_account_number) missing.push("payee_account_number");
    if (!payload.payee_account_holder_kana) missing.push("payee_account_holder_kana");
  }
  if (payload.payment_category === "registered" && !payload.registered_method) missing.push("registered_method");
  return missing;
}

function resolveCompletedSourceAccountFallback(requestCompanyId: string | null, masters: Pick<MigrationMasters, "companies" | "corps" | "bankAccounts">) {
  if (!requestCompanyId) return null;
  const corpCode = resolveCorpCode(requestCompanyId, masters.companies, masters.corps);
  if (corpCode === "hyuaran") return findBankAccount(masters.bankAccounts, corpCode, "楽天銀行", "第一営業支店");
  if (corpCode === "centerrise") return findBankAccount(masters.bankAccounts, corpCode, "PayPay銀行", "ビジネス営業部");
  return null;
}

function findBankAccount(bankAccounts: BankAccountMaster[], corpCode: string, bankName: string, branchName: string) {
  const bank = normalizeName(normalizeBankName(bankName));
  const branch = normalizeName(branchName);
  const account = bankAccounts.find(
    (row) =>
      row.corp_code === corpCode &&
      normalizeName(normalizeBankName(row.bank_name ?? "")).includes(bank) &&
      normalizeName(row.branch_name ?? "").includes(branch),
  );
  return account ? { accountId: account.id, label: `${corpCode} ${normalizeBankName(bankName)} ${branchName}` } : null;
}

function supplement(source: ReturnType<typeof readSource>, reason: string, value: string): MigrationSupplement {
  return {
    recordNumber: source.recordNumber,
    transferId: source.transferId,
    amount: source.amount,
    payeeName: source.payeeName,
    reason,
    value,
  };
}

function statusSkipReason(status: string) {
  if (!status) return "ステータス空欄";
  if (SKIPPED_STATUSES.has(status)) return `移行対象外ステータス: ${status}`;
  return `未知ステータス: ${status}`;
}

function resolveCorpCode(companyId: string, companies: CompanyMaster[], corps: CorpMaster[]) {
  const company = companies.find((row) => row.company_id === companyId);
  const normalizedCompanyName = normalizeName(company?.company_name ?? "");
  return (
    corps.find((corp) => normalizeName(corp.name_short ?? "") === normalizedCompanyName)?.id ??
    corps.find((corp) => normalizedCompanyName.includes(normalizeName(corp.name_short ?? "")) || normalizeName(corp.name_short ?? "").includes(normalizedCompanyName))?.id ??
    null
  );
}

function text(record: KintoneRecord, code: string) {
  const value = record[code]?.value;
  if (Array.isArray(value)) return value.map((item) => (typeof item === "object" && item && "name" in item ? String(item.name) : String(item))).join(",");
  return value == null ? "" : String(value).trim();
}

function dateText(record: KintoneRecord, code: string) {
  const value = text(record, code);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function numberValue(record: KintoneRecord, code: string) {
  const value = text(record, code).replace(/,/g, "");
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function joinText(values: string[]) {
  const joined = values.filter(Boolean).join("\n");
  return joined || null;
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeName(value: string) {
  return value
    .normalize("NFKC")
    .replace(/株式会社|有限会社|合同会社|（株）|\(株\)|\s/g, "")
    .toLowerCase();
}
