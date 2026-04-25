export interface ParsedStatementRow {
  transaction_date: string;
  transaction_time: string | null;
  amount: number;
  balance_after: number | null;
  description: string;
  transaction_type: string | null;
  raw_row: Record<string, string>;
}

export interface ParseError {
  rowIndex: number;
  message: string;
  rawLine: string;
}

export interface ParseResult {
  rows: ParsedStatementRow[];
  errors: ParseError[];
}

export type StatementSourceType = "rakuten_csv" | "mizuho_csv" | "paypay_csv";

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result.map((s) => s.trim());
}

function normalizeDate(input: string): string | null {
  const cleaned = input.replace(/[\u3000\s]/g, "");
  const match = cleaned.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (!match) return null;
  const [, y, m, d] = match;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function parseAmount(input: string): number | null {
  if (!input || input.trim() === "") return null;
  const cleaned = input
    .replace(/[¥￥,，\s\u3000]/g, "")
    .replace(/[−–—]/g, "-");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function buildRawRow(headers: string[], values: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    obj[headers[i]] = values[i] ?? "";
  }
  return obj;
}

export function detectSourceType(csvText: string): StatementSourceType | null {
  const firstLine = csvText.split(/\r?\n/)[0] ?? "";
  if (
    firstLine.includes("入出金（円）") ||
    firstLine.includes("入出金(円)") ||
    firstLine.includes("取引後残高")
  ) {
    return "rakuten_csv";
  }
  if (
    firstLine.includes("お引出し") ||
    firstLine.includes("お預入") ||
    firstLine.includes("お取引内容")
  ) {
    return "mizuho_csv";
  }
  if (firstLine.includes("入金額") && firstLine.includes("出金額")) {
    return "paypay_csv";
  }
  return null;
}

interface FieldMap {
  date: string[];
  time?: string[];
  amount?: string[];
  withdrawal?: string[];
  deposit?: string[];
  balance?: string[];
  description: string[];
  type?: string[];
}

const RAKUTEN_FIELDS: FieldMap = {
  date: ["取引日"],
  amount: ["入出金（円）", "入出金(円)"],
  balance: ["取引後残高（円）", "取引後残高(円)"],
  description: ["取引内容", "摘要"],
};

const MIZUHO_FIELDS: FieldMap = {
  date: ["日付", "お取引日"],
  description: ["お取引内容", "摘要"],
  withdrawal: ["お引出し", "出金"],
  deposit: ["お預入", "入金"],
  balance: ["残高"],
  type: ["メモ", "種別"],
};

const PAYPAY_FIELDS: FieldMap = {
  date: ["取引日", "日付"],
  description: ["摘要", "取引内容"],
  withdrawal: ["出金額"],
  deposit: ["入金額"],
  balance: ["残高"],
};

function findIndex(headers: string[], candidates: string[] | undefined): number {
  if (!candidates) return -1;
  for (const c of candidates) {
    const idx = headers.indexOf(c);
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseGenericCsv(
  csvText: string,
  fieldMap: FieldMap,
): ParseResult {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) {
    return {
      rows: [],
      errors: [
        {
          rowIndex: 0,
          message: "ヘッダー行 + データ行が必要です",
          rawLine: csvText.substring(0, 100),
        },
      ],
    };
  }

  const headers = splitCsvLine(lines[0]);
  const dateIdx = findIndex(headers, fieldMap.date);
  const descIdx = findIndex(headers, fieldMap.description);
  const amountIdx = findIndex(headers, fieldMap.amount);
  const withdrawalIdx = findIndex(headers, fieldMap.withdrawal);
  const depositIdx = findIndex(headers, fieldMap.deposit);
  const balanceIdx = findIndex(headers, fieldMap.balance);
  const typeIdx = findIndex(headers, fieldMap.type);

  if (dateIdx < 0 || descIdx < 0) {
    return {
      rows: [],
      errors: [
        {
          rowIndex: 0,
          message: `必須ヘッダーが見つかりません（日付: ${dateIdx}, 摘要: ${descIdx}）`,
          rawLine: lines[0],
        },
      ],
    };
  }
  if (amountIdx < 0 && withdrawalIdx < 0 && depositIdx < 0) {
    return {
      rows: [],
      errors: [
        {
          rowIndex: 0,
          message: "金額カラムが見つかりません（入出金 / お引出し / お預入 のいずれか）",
          rawLine: lines[0],
        },
      ],
    };
  }

  const rows: ParsedStatementRow[] = [];
  const errors: ParseError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values = splitCsvLine(line);
    const dateRaw = values[dateIdx] ?? "";
    const date = normalizeDate(dateRaw);
    if (!date) {
      errors.push({
        rowIndex: i,
        message: `日付パースエラー: "${dateRaw}"`,
        rawLine: line,
      });
      continue;
    }

    let amount: number | null = null;
    if (amountIdx >= 0) {
      amount = parseAmount(values[amountIdx] ?? "");
    } else {
      const withdrawal = withdrawalIdx >= 0 ? parseAmount(values[withdrawalIdx] ?? "") : null;
      const deposit = depositIdx >= 0 ? parseAmount(values[depositIdx] ?? "") : null;
      if (withdrawal && withdrawal > 0) amount = -withdrawal;
      else if (deposit && deposit > 0) amount = deposit;
      else amount = 0;
    }

    if (amount === null) {
      errors.push({
        rowIndex: i,
        message: `金額パースエラー`,
        rawLine: line,
      });
      continue;
    }

    const description = (values[descIdx] ?? "").trim();
    if (!description) {
      errors.push({
        rowIndex: i,
        message: "摘要が空です",
        rawLine: line,
      });
      continue;
    }

    const balance =
      balanceIdx >= 0 ? parseAmount(values[balanceIdx] ?? "") : null;
    const type =
      typeIdx >= 0 ? (values[typeIdx] ?? "").trim() || null : null;

    rows.push({
      transaction_date: date,
      transaction_time: null,
      amount,
      balance_after: balance,
      description,
      transaction_type: type,
      raw_row: buildRawRow(headers, values),
    });
  }

  return { rows, errors };
}

export function parseRakutenCsv(csvText: string): ParseResult {
  return parseGenericCsv(csvText, RAKUTEN_FIELDS);
}

export function parseMizuhoCsv(csvText: string): ParseResult {
  return parseGenericCsv(csvText, MIZUHO_FIELDS);
}

export function parsePayPayCsv(csvText: string): ParseResult {
  return parseGenericCsv(csvText, PAYPAY_FIELDS);
}

export function parseStatementCsv(
  csvText: string,
  sourceType: StatementSourceType,
): ParseResult {
  switch (sourceType) {
    case "rakuten_csv":
      return parseRakutenCsv(csvText);
    case "mizuho_csv":
      return parseMizuhoCsv(csvText);
    case "paypay_csv":
      return parsePayPayCsv(csvText);
  }
}
