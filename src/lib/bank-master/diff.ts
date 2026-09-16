export type BankMasterBank = {
  bank_code: string;
  bank_name: string;
  bank_kana: string | null;
  valid_to?: string | null;
};

export type BankMasterBranch = {
  bank_code: string;
  branch_code: string;
  branch_name: string;
  branch_kana: string | null;
  valid_to?: string | null;
};

export type BankMasterSnapshot = {
  banks: BankMasterBank[];
  branchesByBank: Record<string, BankMasterBranch[]>;
};

export type BankMasterDiff = {
  banksAdded: BankMasterBank[];
  banksRenamed: BankMasterBank[];
  banksExpired: BankMasterBank[];
  banksRestored: BankMasterBank[];
  branchesAdded: BankMasterBranch[];
  branchesRenamed: BankMasterBranch[];
  branchesExpired: BankMasterBranch[];
  branchesRestored: BankMasterBranch[];
};

const bankKey = (row: Pick<BankMasterBank, "bank_code">) => row.bank_code;
const branchKey = (row: Pick<BankMasterBranch, "bank_code" | "branch_code">) => `${row.bank_code}:${row.branch_code}`;

function changedBank(current: BankMasterBank, incoming: BankMasterBank) {
  return current.bank_name !== incoming.bank_name || (current.bank_kana ?? "") !== (incoming.bank_kana ?? "");
}

function changedBranch(current: BankMasterBranch, incoming: BankMasterBranch) {
  return current.branch_name !== incoming.branch_name || (current.branch_kana ?? "") !== (incoming.branch_kana ?? "");
}

export function flattenBranchesByBank(branchesByBank: Record<string, BankMasterBranch[]>) {
  return Object.entries(branchesByBank).flatMap(([bankCode, rows]) => rows.map((row) => ({ ...row, bank_code: row.bank_code || bankCode })));
}

export function diffBankMaster(current: BankMasterSnapshot, incoming: BankMasterSnapshot): BankMasterDiff {
  const currentBanks = new Map(current.banks.map((row) => [bankKey(row), row]));
  const incomingBanks = new Map(incoming.banks.map((row) => [bankKey(row), row]));
  const currentBranches = new Map(flattenBranchesByBank(current.branchesByBank).map((row) => [branchKey(row), row]));
  const incomingBranches = new Map(flattenBranchesByBank(incoming.branchesByBank).map((row) => [branchKey(row), row]));
  const diff: BankMasterDiff = {
    banksAdded: [],
    banksRenamed: [],
    banksExpired: [],
    banksRestored: [],
    branchesAdded: [],
    branchesRenamed: [],
    branchesExpired: [],
    branchesRestored: [],
  };

  for (const incomingRow of incomingBanks.values()) {
    const currentRow = currentBanks.get(bankKey(incomingRow));
    if (!currentRow) diff.banksAdded.push(incomingRow);
    else if (currentRow.valid_to) diff.banksRestored.push(incomingRow);
    else if (changedBank(currentRow, incomingRow)) diff.banksRenamed.push(incomingRow);
  }
  for (const currentRow of currentBanks.values()) {
    if (!currentRow.valid_to && !incomingBanks.has(bankKey(currentRow))) diff.banksExpired.push(currentRow);
  }

  for (const incomingRow of incomingBranches.values()) {
    const currentRow = currentBranches.get(branchKey(incomingRow));
    if (!currentRow) diff.branchesAdded.push(incomingRow);
    else if (currentRow.valid_to) diff.branchesRestored.push(incomingRow);
    else if (changedBranch(currentRow, incomingRow)) diff.branchesRenamed.push(incomingRow);
  }
  for (const currentRow of currentBranches.values()) {
    if (!currentRow.valid_to && !incomingBranches.has(branchKey(currentRow))) diff.branchesExpired.push(currentRow);
  }

  return diff;
}

export function countDiff(diff: BankMasterDiff) {
  return {
    banksAdded: diff.banksAdded.length,
    banksExpired: diff.banksExpired.length,
    banksRenamed: diff.banksRenamed.length,
    branchesAdded: diff.branchesAdded.length,
    branchesExpired: diff.branchesExpired.length,
    branchesRenamed: diff.branchesRenamed.length,
  };
}
