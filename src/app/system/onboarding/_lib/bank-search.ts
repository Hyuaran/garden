const BANK_KIND_REPLACEMENTS: readonly [string, string][] = [
  ["信用金庫", "信金"],
  ["信用組合", "信組"],
  ["農業協同組合", "農協"],
  ["労働金庫", "労金"],
  ["漁業協同組合", "漁協"],
];

const RENAMED_BANK_REPLACEMENTS: readonly [string, string][] = [
  ["住信SBIネット", "ドコモＳＭＴＢネット"],
  ["ジャパンネット", "ＰａｙＰａｙ"],
  ["三菱東京UFJ", "三菱ＵＦＪ"],
  ["近畿大阪", "関西みらい"],
];

// 台帳の金融機関名・支店名に記号は一つも入っていない。
// 絞り込みの区切りに使われる記号が混ざると検索そのものが失敗するため、先に落とす。
const FILTER_CHARS = /[,.()*%，．（）]/g;

function trimWideSpaces(value: string) {
  return value.replace(FILTER_CHARS, "").replace(/^[\s　]+|[\s　]+$/g, "");
}

export function toFullWidthAscii(value: string) {
  return value.replace(/[A-Za-z0-9]/g, char => String.fromCharCode(char.charCodeAt(0) + 0xfee0));
}

function unique(values: string[]) {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

export function normalizeBankSearchTerm(value: string) {
  let term = trimWideSpaces(value);
  for (const [from, to] of BANK_KIND_REPLACEMENTS) term = term.replaceAll(from, to);
  for (const [from, to] of RENAMED_BANK_REPLACEMENTS) term = term.replaceAll(from, to);
  term = term.replace(/(?:銀行|ぎんこう|ギンコウ)$/, "");
  return term;
}

export function bankSearchTerms(value: string) {
  const raw = trimWideSpaces(value);
  const normalized = normalizeBankSearchTerm(raw);
  return unique([raw, normalized, toFullWidthAscii(normalized)]);
}

export function normalizeBranchSearchTerm(value: string) {
  return trimWideSpaces(value).replace(/(?:支店|出張所|してん)$/, "");
}

export function branchSearchTerms(value: string) {
  const raw = trimWideSpaces(value);
  const normalized = normalizeBranchSearchTerm(raw);
  return unique([raw, normalized, toFullWidthAscii(normalized)]);
}
