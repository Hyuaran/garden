import type { OnboardingInput } from "./onboarding";

export type WarekiDate = {
  era: "明" | "大" | "昭" | "平" | "令";
  year: string;
  month: string;
  day: string;
};

const ERAS = [
  { era: "令" as const, start: "2019-05-01", baseYear: 2019 },
  { era: "平" as const, start: "1989-01-08", baseYear: 1989 },
  { era: "昭" as const, start: "1926-12-25", baseYear: 1926 },
  { era: "大" as const, start: "1912-07-30", baseYear: 1912 },
];

function validYmd(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : value;
}

export function toWarekiDate(value: string): WarekiDate | null {
  const date = validYmd(value);
  if (!date) return null;
  const [year, month, day] = date.split("-").map(Number);
  const era = ERAS.find((candidate) => date >= candidate.start);
  if (!era) return { era: "明", year: String(year - 1868 + 1), month: String(month), day: String(day) };
  return { era: era.era, year: String(year - era.baseYear + 1), month: String(month), day: String(day) };
}

export function splitPostalCode(value: string) {
  const digits = value.replace(/\D/g, "");
  return {
    first: digits.length >= 3 ? digits.slice(0, 3) : "",
    last: digits.length >= 7 ? digits.slice(3, 7) : "",
  };
}

export function hasSpouse(values: Pick<OnboardingInput, "dependents">) {
  return values.dependents.some((dependent) => dependent.relation.trim() === "配偶者");
}

export function fuyouPdfFilename(name: string) {
  const employeeName = name.replace(/[\s　]+/g, "") || "氏名未入力";
  return `【扶養控除申告書】${employeeName}_令和8年分_給与所得者の扶養控除等(異動)申告書.pdf`;
}

export function safeFuyouErrorMessage(status: number) {
  if (status === 401) return "ログインし直してください。";
  if (status === 403) return "この書類を作れる権限がありません。責任者へ依頼してください。";
  if (status === 404) return "入社手続きの入力が見つかりませんでした。";
  if (status === 409) return "扶養控除申告書を作るための情報が不足しています。入力内容を確認してください。";
  if (status === 503) return "扶養控除申告書の用紙を読み込めませんでした。管理者へお問い合わせください。";
  return "保存先のフォルダに書き込めませんでした。管理者へお問い合わせください。";
}
