import type { RawImportRow } from "./build-import";

export type ExistingHit = { phone: string; source: "assignment" | "order"; listName?: string | null; occurredOn?: string | null };
export type RawCheckSummary = {
  readRows: number;
  importRows: number;
  excludedRows: number;
  needsReviewRows: number;
  excludedAssignment: number;
  excludedOrder: number;
};

function rowIdentity(row: RawImportRow): string {
  return JSON.stringify(Object.entries(row).filter(([key]) => !["rowNumber", "reviewReasons", "checkReason"].includes(key)));
}

export function applyRawChecks(rows: RawImportRow[], existingHits: ExistingHit[] = []): { rows: RawImportRow[]; excluded: RawImportRow[]; summary: RawCheckSummary } {
  const assignmentPhones = new Set(existingHits.filter((hit) => hit.source === "assignment").map((hit) => hit.phone));
  const orderPhones = new Set(existingHits.filter((hit) => hit.source === "order").map((hit) => hit.phone));
  const seenIdentity = new Set<string>();
  const byPhone = new Map<string, RawImportRow[]>();
  const kept: RawImportRow[] = [];
  const excluded: RawImportRow[] = [];
  let excludedAssignment = 0;
  let excludedOrder = 0;

  for (const row of rows) {
    const identity = rowIdentity(row);
    if (seenIdentity.has(identity)) continue;
    seenIdentity.add(identity);
    if (row.normalizedPhone && assignmentPhones.has(row.normalizedPhone)) {
      excluded.push({ ...row, excludedReason: "過去に配った番号" });
      excludedAssignment += 1;
      continue;
    }
    if (row.normalizedPhone && orderPhones.has(row.normalizedPhone)) {
      excluded.push({ ...row, excludedReason: "案件あり" });
      excludedOrder += 1;
      continue;
    }
    kept.push(row);
    if (row.normalizedPhone) {
      const current = byPhone.get(row.normalizedPhone) ?? [];
      current.push(row);
      byPhone.set(row.normalizedPhone, current);
    }
  }

  for (const group of byPhone.values()) {
    if (group.length < 2) continue;
    for (const row of group) {
      row.reviewReasons = [...new Set([...row.reviewReasons, `同じ番号が ${group.length} 行`])];
      row.checkReason = row.reviewReasons.join("／");
    }
  }

  return {
    rows: kept,
    excluded,
    summary: {
      readRows: rows.length,
      importRows: kept.filter((row) => row.normalizedPhone && !row.reviewReasons.some((reason) => reason.includes("電話番号の桁"))).length,
      excludedRows: excluded.length,
      needsReviewRows: kept.filter((row) => row.reviewReasons.length > 0).length,
      excludedAssignment,
      excludedOrder,
    },
  };
}

