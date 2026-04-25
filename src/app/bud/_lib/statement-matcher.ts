import type { TransferStatus } from "../_constants/types";

export interface MatchableStatement {
  transaction_date: string;
  amount: number;
  description: string;
}

export interface MatchableTransfer {
  transfer_id: string;
  amount: number;
  scheduled_date: string | null;
  payee_name: string;
  vendor_name?: string | null;
  status: TransferStatus;
  executed_date?: string | null;
}

export type MatchConfidence = "exact" | "high";

export interface MatchResult {
  transferId: string;
  confidence: MatchConfidence;
}

const MATCHABLE_STATUSES: TransferStatus[] = [
  "承認済み",
  "CSV出力済み",
];

function daysDiff(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.round((da - db) / 86400000);
}

function nameContains(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const cleanHay = haystack.replace(/\s+/g, "");
  const cleanNeedle = needle.replace(/\s+/g, "");
  if (cleanNeedle.length < 2) return false;
  return cleanHay.includes(cleanNeedle);
}

export function findMatchingTransfer(
  statement: MatchableStatement,
  candidates: MatchableTransfer[],
): MatchResult | null {
  const targetAmount = Math.abs(statement.amount);

  const eligible = candidates.filter(
    (t) =>
      MATCHABLE_STATUSES.includes(t.status) &&
      !t.executed_date &&
      t.amount === targetAmount,
  );

  if (eligible.length === 0) return null;

  // 1) Exact: 同日 + 取引先名含有
  const exactMatches = eligible.filter((t) => {
    if (!t.scheduled_date) return false;
    if (t.scheduled_date !== statement.transaction_date) return false;
    const refName = t.vendor_name ?? t.payee_name;
    return nameContains(statement.description, refName);
  });
  if (exactMatches.length === 1) {
    return { transferId: exactMatches[0].transfer_id, confidence: "exact" };
  }

  // 2) High: 同日 + 名前一致なしでも候補唯一なら
  const sameDateMatches = eligible.filter(
    (t) => t.scheduled_date === statement.transaction_date,
  );
  if (sameDateMatches.length === 1) {
    return { transferId: sameDateMatches[0].transfer_id, confidence: "high" };
  }

  // 3) High: ±3 日 + 名前含有
  const window = eligible.filter((t) => {
    if (!t.scheduled_date) return false;
    const diff = Math.abs(daysDiff(statement.transaction_date, t.scheduled_date));
    return diff <= 3;
  });
  const windowNamed = window.filter((t) => {
    const refName = t.vendor_name ?? t.payee_name;
    return nameContains(statement.description, refName);
  });
  if (windowNamed.length === 1) {
    return { transferId: windowNamed[0].transfer_id, confidence: "high" };
  }

  // 4) High: ±3 日 内で唯一なら
  if (window.length === 1) {
    return { transferId: window[0].transfer_id, confidence: "high" };
  }

  return null;
}

export interface BulkMatchSummary {
  matched: Array<{ statementIndex: number; result: MatchResult }>;
  unmatched: number[];
  exactCount: number;
  highCount: number;
}

export function bulkMatch(
  statements: MatchableStatement[],
  candidates: MatchableTransfer[],
): BulkMatchSummary {
  const matched: BulkMatchSummary["matched"] = [];
  const unmatched: number[] = [];
  let exactCount = 0;
  let highCount = 0;
  const usedTransferIds = new Set<string>();

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (stmt.amount >= 0) {
      // 入金は照合対象外（出金=振込のみ）
      unmatched.push(i);
      continue;
    }
    const remainingCandidates = candidates.filter(
      (c) => !usedTransferIds.has(c.transfer_id),
    );
    const result = findMatchingTransfer(stmt, remainingCandidates);
    if (result) {
      matched.push({ statementIndex: i, result });
      usedTransferIds.add(result.transferId);
      if (result.confidence === "exact") exactCount++;
      else highCount++;
    } else {
      unmatched.push(i);
    }
  }

  return { matched, unmatched, exactCount, highCount };
}
