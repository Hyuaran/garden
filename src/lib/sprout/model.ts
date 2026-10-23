export type KRecord = Record<string, { type?: string; value: unknown }>;
export function flatten(record: KRecord): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).map(([key, field]) => [key,
    field.type === "SUBTABLE" && Array.isArray(field.value)
      ? field.value.map((row: { id: string; value: KRecord }) => ({ id: row.id, ...flatten(row.value) }))
      : field.value]));
}
export const str = (raw: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) if (typeof raw[key] === "string" && raw[key]) return raw[key] as string;
  return "";
};
const date = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s ? s : null;
const instant = (s: string) => s && !isNaN(Date.parse(s)) ? new Date(s).toISOString() : null;
export function applicant(record: KRecord) {
  const raw = flatten(record);
  const name = str(raw, "従業員名_姓名", "文字列__1行__12");
  const kana = str(raw, "従業員名_姓名カナ", "文字列__1行__11");
  const parts = name.trim().split(/[\s　]+/), kanaParts = kana.trim().split(/[\s　]+/);
  return {
    kintone_record_id: str(raw, "$id"), name, kana,
    last_name: str(raw, "従業員名_姓") || parts[0] || "", first_name: str(raw, "従業員名_名") || parts.slice(1).join(" "),
    last_name_kana: str(raw, "従業員名_姓カナ") || kanaParts[0] || "", first_name_kana: str(raw, "従業員名_名カナ") || kanaParts.slice(1).join(" "),
    birthday: date(str(raw, "日付", "生年月日")), gender: str(raw, "性別", "文字列__1行__9"),
    phone: str(raw, "連絡先_ハイフンなし", "連絡先", "文字列__1行__20"),
    email: str(raw, "メールアドレス", "文字列__1行__22", "文字列__1行__21"),
    address: str(raw, "住所合体") || ["住所_都道府県", "住所_市町村", "住所_町域", "住所_建物名", "住所_部屋番号"].map(k => str(raw, k)).join(""),
    applied_date: date(str(raw, "日付_0")), application_methods: Array.isArray(raw["チェックボックス_3"]) ? raw["チェックボックス_3"] as string[] : [],
    status: str(raw, "ドロップダウン_1"), interview_at: instant(str(raw, "日時_2")), interview_date: date(str(raw, "日付_4")),
    training_at: instant(str(raw, "日時_3")), training_date: date(str(raw, "日付_2")), hire_date: date(str(raw, "入社日")),
    age_group: str(raw, "ドロップダウン"), raw, kintone_updated_at: instant(str(raw, "更新日時")),
  };
}
export type Applicant = ReturnType<typeof applicant>;
export type Relation = { field: string; relatedField: string };
const normalize = (s: string) => s.normalize("NFKC").replace(/[\s　]/g, "");
const phoneKey = (s: string) => s.replace(/\D/g, "");
export function hearing(record: KRecord, applicants: Applicant[], relation?: Relation) {
  const raw = flatten(record), name = str(raw, "従業員名_姓名"), phone = str(raw, "連絡先_ハイフンなし");
  const matches = relation && str(raw, relation.relatedField)
    ? applicants.filter(a => str(a.raw, relation.field) === str(raw, relation.relatedField))
    : applicants.filter(a => normalize(name) && phoneKey(phone) && normalize(a.name) === normalize(name) && phoneKey(a.phone) === phoneKey(phone));
  return { kintone_record_id: str(raw, "$id"), name, kana: str(raw, "従業員名_姓名カナ"), phone, raw,
    applicant_record_id: matches.length === 1 ? matches[0].kintone_record_id : null };
}
export type Hearing = ReturnType<typeof hearing>;
export const canViewSprout = (role: unknown) => role === "super_admin";
export const canSend = (status: string) => ["⑧▼研修待ち", "⑩入社"].includes(status);
export function hireValues(a: Applicant) {
  if (!canSend(a.status)) throw new Error("研修待ち・入社の方を選んでください");
  if (![a.last_name, a.first_name, a.last_name_kana, a.first_name_kana, a.birthday, a.training_date || a.hire_date].every(Boolean) || !["男性", "女性"].includes(a.gender))
    throw new Error("氏名・カナ・生年月日・性別・研修日または入社日を確認してください");
  return { source_applicant_id: a.kintone_record_id, last_name: a.last_name, first_name: a.first_name,
    last_name_kana: a.last_name_kana, first_name_kana: a.first_name_kana, birthday: a.birthday,
    gender: a.gender === "男性" ? "male" : "female", hire_date: a.training_date || a.hire_date, employment_type: "アルバイト", status: "planned" };
}
export function filterApplicants(rows: Applicant[], tab: string, month: string, statuses: string[], search: string, today: string) {
  const schedule = (a: Applicant) => tab === "interviews" ? a.interview_at : a.training_at || a.training_date;
  return rows.filter(a => (!statuses.length || statuses.includes(a.status)) && (!search || normalize(a.name + a.phone).includes(normalize(search)) || phoneKey(search) && phoneKey(a.phone).includes(phoneKey(search))) &&
    (tab === "applicants" ? !month || a.applied_date?.startsWith(month) : !!schedule(a) && new Date(schedule(a)!).getTime() >= new Date(today + "T00:00:00+09:00").getTime()))
    .sort((a,b) => tab === "applicants" ? (b.applied_date || "").localeCompare(a.applied_date || "") : (schedule(a) || "").localeCompare(schedule(b) || ""));
}
