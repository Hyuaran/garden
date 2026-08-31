import { COURT_LOCATIONS } from "./contract-court-locations";

// PDF由来の空白・改行を文字間に許容し、長い地名（大津/津など）から照合する。
const spaced = (text: string) => [...text].join("\\s*");
const location = COURT_LOCATIONS.slice().sort((a, b) => b.length - a.length).map(spaced).join("|");
const kind = ["地方", "簡易", "家庭", "高等"].map(spaced).join("|");
// 実原本にある地名の連結「仙台大阪」だけを明示的に許容する。
// 地名の任意反復は不可。「当社東京…」の「社」も裁判所地名なので条文を削ってしまう。
// 支部名も辞書で限定し、後続の「又は…」「支部を設置する」等は飲み込まない。
const COURT = new RegExp(`(?:${spaced("仙台大阪")}|${location})\\s*(${kind})\\s*${spaced("裁判所")}(?:\\s*(?:${location})\\s*${spaced("支部")})?`, "gu");

export function rewriteTemplateCourtNames(text: string): string {
  return text.replace(COURT, (_court, courtKind: string) => `大阪${courtKind.replace(/\s/g, "")}裁判所`);
}
