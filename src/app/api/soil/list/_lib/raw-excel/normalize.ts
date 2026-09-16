const SPACE_RE = /[\s\u3000\u00A0]+/g;
const HYPHEN_RE = /[‐‑‒–—―−⁃˗﹘﹣－゠─━]/g;
const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

export type NameParts = { last: string; first: string; review?: string };
export type PostalHit = { prefecture: string; city?: string | null } | null;
export type PostalLookup = (postal7: string) => PostalHit | Promise<PostalHit>;
export type PostalResult = { value: string; review?: string; padded: boolean };
export type PhoneResult = { value: string; review?: string; usable: boolean };

export function text(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

export function normalizePhone(value: string): string {
  return value.normalize("NFKC").replace(/[^\d]/g, "");
}

export function normalizeAddress(value: string): string {
  let next = text(value).replace(/[\u200B-\u200D\u2060\uFEFF]/g, "");
  next = next.normalize("NFKC");
  next = next.replace(HYPHEN_RE, "-").replace(/(?<=\d)[ーｰ](?=\d)/g, "-");
  return next.replace(SPACE_RE, "").trim();
}

export function splitPrefecture(prefecture: string, city: string): { prefecture: string; city: string } {
  const pref = normalizeAddress(prefecture);
  const cityValue = normalizeAddress(city);
  if (pref) return { prefecture: pref, city: cityValue };
  const found = PREFECTURES.find((item) => cityValue.startsWith(item));
  if (!found) return { prefecture: pref, city: cityValue };
  return { prefecture: found, city: cityValue.slice(found.length) };
}

export function normalizeName(lastRaw: string, firstRaw: string): NameParts {
  const last = text(lastRaw);
  const first = text(firstRaw);
  if (last && first) return { last, first };
  const source = last || first;
  const parts = source.split(SPACE_RE).filter(Boolean);
  if (parts.length >= 2) return { last: parts[0], first: parts.slice(1).join("") };
  if (source) return { last: source, first: "", review: "氏名の区切りなし" };
  return { last: "", first: "", }; // 氏名が空の行は 026 でも要確認にしていない（電話番号があれば架電できる）
}

export async function normalizePostal(value: string, prefecture: string, lookup?: PostalLookup): Promise<PostalResult> {
  const raw = text(value);
  if (!raw) return { value: "", padded: false };
  const digits = raw.normalize("NFKC").replace(/\D/g, "");
  if (digits.length === 7) return { value: `${digits.slice(0, 3)}-${digits.slice(3)}`, padded: false };
  if (digits.length === 6) {
    const padded = `0${digits}`;
    const hit = lookup ? await lookup(padded) : null;
    if (!hit || hit.prefecture !== prefecture) return { value: raw, padded: true, review: "郵便番号と都道府県が合いません" };
    return { value: `${padded.slice(0, 3)}-${padded.slice(3)}`, padded: true };
  }
  return { value: raw, padded: false, review: "郵便番号の桁が違います" };
}

export function normalizePhoneForImport(value: string, label = "電話番号"): PhoneResult {
  const digits = normalizePhone(value);
  if (!digits) return { value: "", review: `${label}なし`, usable: false };
  if (digits.length !== 10 && digits.length !== 11) return { value: digits, review: `${label}の桁が違います`, usable: false };
  return { value: digits, usable: true };
}

export function normalizeBirthday(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear().toString().padStart(4, "0")}/${(value.getMonth() + 1).toString().padStart(2, "0")}/${value.getDate().toString().padStart(2, "0")}`;
  }
  const raw = text(value);
  const match = /(\d{4})\D(\d{1,2})\D(\d{1,2})/.exec(raw.normalize("NFKC"));
  if (!match) return raw;
  return `${match[1].padStart(4, "0")}/${match[2].padStart(2, "0")}/${match[3].padStart(2, "0")}`;
}

