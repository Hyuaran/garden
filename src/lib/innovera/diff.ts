import type { KintoneRecord } from "@/lib/kintone/records";
import type { InnoveraCircuit, InnoveraDiffAction, KintoneHistoryRow, KintoneInnoveraRecord } from "./types";

const GARDEN_USER = { value: [{ code: "Garden" }] };

function text(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

export function normalizeCircuitNum(value: unknown): string | null {
  const raw = text(value).trim();
  if (!/^\d+$/.test(raw)) return null;
  return raw.padStart(3, "0");
}

function digits(value: unknown): string {
  return text(value).replace(/\D/g, "");
}

function field(record: KintoneInnoveraRecord, code: keyof KintoneInnoveraRecord): string {
  const value = record[code];
  if (value && typeof value === "object" && "value" in value) return text(value.value);
  return "";
}

function recordId(record: KintoneInnoveraRecord): string {
  return field(record, "$id");
}

function currentStatus(record: KintoneInnoveraRecord): string {
  return field(record, "最終番号ステータス") || "未使用";
}

function maxHistoryLine(record: KintoneInnoveraRecord): number {
  const table = Array.isArray(record.テーブル?.value) ? record.テーブル.value : [];
  const fromRows = table
    .map((row) => Number(row.value.行番号?.value ?? 0))
    .filter((value) => Number.isFinite(value));
  const direct = Number(field(record, "最終行番号") || 0);
  return Math.max(direct, 0, ...fromRows);
}

export function fdNumber(circuit: Pick<InnoveraCircuit, "free_number" | "related_number" | "number">): string {
  return text(circuit.free_number).trim() || text(circuit.related_number).trim() || text(circuit.number).trim();
}

function issuedDate(circuit: InnoveraCircuit): string {
  const inserted = text(circuit.inserted).trim();
  return /^\d{4}-\d{2}-\d{2}/.test(inserted) ? inserted.slice(0, 10) : "";
}

function historyRow(name: string, nowIso: string, line: number, status: string, includeUser = true): KintoneHistoryRow {
  const value: KintoneHistoryRow["value"] = {
    回線名称: { value: name },
    入力日時: { value: nowIso },
    行番号: { value: String(line) },
    番号ステータス: { value: status },
  };
  if (includeUser) value.入力者 = GARDEN_USER;
  return { value };
}

function existingHistory(record: KintoneInnoveraRecord): KintoneHistoryRow[] {
  return Array.isArray(record.テーブル?.value) ? record.テーブル.value : [];
}

export function normalizeHistoryRows(rows: KintoneHistoryRow[]): KintoneHistoryRow[] {
  return rows.map((row) => ({
    ...(row.id ? { id: row.id } : {}),
    value: Object.fromEntries(Object.entries(row.value).map(([key, fieldValue]) => [key, { value: fieldValue?.value }])) as KintoneHistoryRow["value"],
  }));
}

export function stripHistoryUser(record: KintoneRecord): KintoneRecord {
  const table = record.テーブル;
  if (!table || typeof table !== "object" || !("value" in table) || !Array.isArray(table.value)) return record;
  return {
    ...record,
    テーブル: {
      value: normalizeHistoryRows(table.value as KintoneHistoryRow[]).map((row) => {
        const { 入力者, ...value } = row.value;
        return row.id ? { id: row.id, value } : { value };
      }),
    },
  };
}

function newRecord(circuit: InnoveraCircuit, circuitNum: string, nowIso: string): KintoneRecord {
  const name = text(circuit.name).trim();
  const line = text(circuit.number).trim();
  const fd = fdNumber(circuit);
  return {
    識別番号: { value: circuitNum },
    回線番号: { value: line },
    FD番号: { value: fd },
    最終回線名称: { value: name },
    最終番号ステータス: { value: "未使用" },
    発番日: { value: issuedDate(circuit) },
    最終入力日時: { value: nowIso },
    最終行番号: { value: "1" },
    テーブル: { value: [historyRow(name, nowIso, 1, "未使用")] },
  };
}

function renamedRecord(record: KintoneInnoveraRecord, circuit: InnoveraCircuit, nowIso: string): KintoneRecord {
  const nextLine = maxHistoryLine(record) + 1;
  const status = currentStatus(record);
  const nextName = text(circuit.name).trim();
  return {
    最終回線名称: { value: nextName },
    最終入力日時: { value: nowIso },
    最終行番号: { value: String(nextLine) },
    テーブル: { value: [...normalizeHistoryRows(existingHistory(record)), historyRow(nextName, nowIso, nextLine, status)] },
  };
}

function retiredRecord(record: KintoneInnoveraRecord, nowIso: string, today: string): KintoneRecord {
  const nextLine = maxHistoryLine(record) + 1;
  const name = field(record, "最終回線名称");
  return {
    最終番号ステータス: { value: "削除" },
    廃止日: { value: field(record, "廃止日") || today },
    ドロップダウン: { value: "" },
    最終入力日時: { value: nowIso },
    最終行番号: { value: String(nextLine) },
    テーブル: { value: [...normalizeHistoryRows(existingHistory(record)), historyRow(name, nowIso, nextLine, "削除")] },
  };
}

export function diffInnoveraKintone(
  circuits: InnoveraCircuit[],
  records: KintoneInnoveraRecord[],
  options: { nowIso: string; today: string },
): InnoveraDiffAction[] {
  const actions: InnoveraDiffAction[] = [];
  const kintoneByCircuit = new Map<string, KintoneInnoveraRecord>();
  const innoveraByCircuit = new Map<string, InnoveraCircuit>();

  for (const record of records) {
    const key = normalizeCircuitNum(field(record, "識別番号"));
    if (key && !kintoneByCircuit.has(key)) kintoneByCircuit.set(key, record);
  }
  for (const circuit of circuits) {
    const key = normalizeCircuitNum(circuit.circuit_num);
    if (key && !innoveraByCircuit.has(key)) innoveraByCircuit.set(key, circuit);
  }

  for (const [circuitNum, circuit] of innoveraByCircuit) {
    const record = kintoneByCircuit.get(circuitNum);
    const lineNumber = text(circuit.number).trim();
    const nextName = text(circuit.name).trim();
    if (!record) {
      actions.push({
        kind: "added",
        circuitNum,
        lineNumber,
        fdNumber: fdNumber(circuit),
        issuedDate: issuedDate(circuit),
        nextName,
        innovera: circuit,
        writeRecord: newRecord(circuit, circuitNum, options.nowIso),
      });
      continue;
    }

    const status = currentStatus(record);
    const previousLineNumber = field(record, "回線番号");
    if (status === "削除") {
      actions.push({ kind: "needs_review", circuitNum, lineNumber, previousLineNumber, nextName, kintoneId: recordId(record), record, innovera: circuit, reason: "restored_deleted" });
      continue;
    }
    if (digits(lineNumber) !== digits(previousLineNumber)) {
      actions.push({ kind: "needs_review", circuitNum, lineNumber, previousLineNumber, nextName, kintoneId: recordId(record), record, innovera: circuit, reason: "number_mismatch" });
      continue;
    }

    const previousName = field(record, "最終回線名称");
    if (nextName.trim() !== previousName.trim()) {
      actions.push({
        kind: "renamed",
        circuitNum,
        lineNumber,
        previousName,
        nextName,
        kintoneId: recordId(record),
        record,
        innovera: circuit,
        writeRecord: renamedRecord(record, circuit, options.nowIso),
      });
    }
  }

  for (const [circuitNum, record] of kintoneByCircuit) {
    if (!innoveraByCircuit.has(circuitNum) && currentStatus(record) !== "削除") {
      actions.push({
        kind: "retired",
        circuitNum,
        lineNumber: field(record, "回線番号"),
        previousName: field(record, "最終回線名称"),
        kintoneId: recordId(record),
        record,
        writeRecord: retiredRecord(record, options.nowIso, options.today),
      });
    }
  }

  return actions;
}
