import { normalizeBankNameForCompare, normalizeBranchNameForCompare, normalizeCode } from "./normalize";

export type BankAccountPayload = {
  bank_name?: unknown;
  bank_code?: unknown;
  branch_name?: unknown;
  branch_code?: unknown;
  account_type?: unknown;
  account_number?: unknown;
  holder_kana?: unknown;
  account_holder_kana?: unknown;
  sub_account?: unknown;
  slot?: unknown;
};

export type MasterBank = { bankCode: string; bankName: string; bankKana?: string | null; validTo?: string | null };
export type MasterBranch = { bankCode: string; branchCode: string; branchName: string; branchKana?: string | null; validTo?: string | null };
export type BankSuccessor = {
  oldBankCode: string;
  oldBranchCode: string | null;
  newBankCode: string;
  newBranchCode: string | null;
  effectiveDate?: string | null;
  note?: string | null;
};

export type BankMasterLookup = {
  banksByCode: Map<string, MasterBank>;
  branchesByCode: Map<string, MasterBranch>;
  successors?: BankSuccessor[];
  findBanksByName?: (name: string) => MasterBank[];
  findBranchesByName?: (bankCode: string, name: string) => MasterBranch[];
};

export type BankCheckIssue = "missing_code" | "not_found" | "expired" | "name_mismatch" | "missing_branch_name";

export type BankCheckResult = {
  issues: BankCheckIssue[];
  candidate: Partial<BankAccountPayload>;
  candidateLabel: string;
  successor?: BankSuccessor;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function branchKey(bankCode: string, branchCode: string) {
  return `${bankCode}:${branchCode}`;
}

function successorFor(bankCode: string, branchCode: string, lookup: BankMasterLookup) {
  return (lookup.successors ?? []).find((row) => row.oldBankCode === bankCode && (row.oldBranchCode === branchCode || row.oldBranchCode === null));
}

export function checkBankAccount(payload: BankAccountPayload, lookup: BankMasterLookup): BankCheckResult {
  const bankName = text(payload.bank_name);
  const branchName = text(payload.branch_name);
  const bankCode = normalizeCode(payload.bank_code, 4);
  const branchCode = normalizeCode(payload.branch_code, 3);
  const issues: BankCheckIssue[] = [];
  const candidate: Partial<BankAccountPayload> = {};
  let candidateLabel = "要確認";
  let successor: BankSuccessor | undefined;

  if (!bankCode || !branchCode) {
    issues.push("missing_code");
    // 金融機関：コードがあればそれ、無ければ名前で 1 件に決まるとき
    let resolvedBank: MasterBank | undefined = bankCode ? lookup.banksByCode.get(bankCode) : undefined;
    if (!resolvedBank && !bankCode && bankName && lookup.findBanksByName) {
      const matches = lookup.findBanksByName(bankName).filter((row) => !row.validTo);
      if (matches.length === 1) resolvedBank = matches[0];
    }
    if (resolvedBank && !bankCode) {
      candidate.bank_code = resolvedBank.bankCode;
      candidate.bank_name = resolvedBank.bankName;
    }
    // 支店：コードがあればそれ、無ければその金融機関の中で名前が 1 件に決まるとき
    let resolvedBranch: MasterBranch | undefined = resolvedBank && branchCode ? lookup.branchesByCode.get(branchKey(resolvedBank.bankCode, branchCode)) : undefined;
    if (!resolvedBranch && resolvedBank && !branchCode && branchName && lookup.findBranchesByName) {
      const matches = lookup.findBranchesByName(resolvedBank.bankCode, branchName).filter((row) => !row.validTo);
      if (matches.length === 1) resolvedBranch = matches[0];
    }
    if (resolvedBranch && !branchCode) {
      candidate.branch_code = resolvedBranch.branchCode;
      candidate.branch_name = resolvedBranch.branchName;
    }
    if (resolvedBank && resolvedBranch) {
      candidateLabel = `${resolvedBank.bankCode} ${resolvedBank.bankName} ／ ${resolvedBranch.branchCode} ${resolvedBranch.branchName}`;
    } else if (resolvedBank) {
      candidateLabel = `${resolvedBank.bankCode} ${resolvedBank.bankName}（支店は要確認）`;
    } else {
      candidateLabel = "要確認";
    }
    return { issues, candidate, candidateLabel };
  }

  const bank = lookup.banksByCode.get(bankCode);
  const branch = lookup.branchesByCode.get(branchKey(bankCode, branchCode));
  if (!bank || !branch) {
    issues.push("not_found");
    candidateLabel = "台帳にありません";
    return { issues, candidate, candidateLabel };
  }

  if (bank.validTo || branch.validTo) {
    issues.push("expired");
    successor = successorFor(bankCode, branchCode, lookup);
    if (successor) {
      candidate.bank_code = successor.newBankCode;
      candidate.branch_code = successor.newBranchCode ?? branchCode;
      const nextBank = lookup.banksByCode.get(successor.newBankCode);
      const nextBranch = lookup.branchesByCode.get(branchKey(successor.newBankCode, successor.newBranchCode ?? branchCode));
      if (nextBank) candidate.bank_name = nextBank.bankName;
      if (nextBranch) candidate.branch_name = nextBranch.branchName;
      candidateLabel = `後継：${successor.newBankCode} ${nextBank?.bankName ?? ""}${candidate.branch_code ? ` ／ ${candidate.branch_code} ${nextBranch?.branchName ?? ""}` : ""}`.trim();
    } else {
      candidateLabel = "後継：未登録";
    }
    return { issues, candidate, candidateLabel, successor };
  }

  const bankMatches = !bankName || normalizeBankNameForCompare(bankName) === normalizeBankNameForCompare(bank.bankName);
  const branchMatches = !branchName || normalizeBranchNameForCompare(branchName) === normalizeBranchNameForCompare(branch.branchName);
  if (!bankMatches || !branchMatches) {
    issues.push("name_mismatch");
    candidate.bank_name = bank.bankName;
    candidate.branch_name = branch.branchName;
    candidateLabel = `${bank.bankName} ／ ${branch.branchName}`;
  }
  if (!branchName) {
    issues.push("missing_branch_name");
    candidate.branch_name = branch.branchName;
    candidateLabel = `${branch.branchCode} ${branch.branchName}`;
  }

  if (issues.length === 0) candidateLabel = "台帳と一致";
  return { issues, candidate, candidateLabel };
}
