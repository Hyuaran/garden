export type GardenCheckRuleId = "R1" | "R2-1" | "R2-2" | "R2-3" | "R2-4" | "R2-5" | "R3" | "R4" | "R5" | "R6" | "R7" | "R8" | "R9" | "R10";
export type GardenCheckSeverity = "blocking" | "notice" | "warning";

export type SalesMasterRecord = {
  salesId: string; flag: string | null; mobileNumber: string | null; mobileCarrier: string | null; mobileDeviceType: string | null;
  productCategory1: string | null; productCategory2: string | null; salesCommentLine: string | null;
  applicationCode: string | null; applicationPlanName: string | null; constructionType: string | null; applicationIsp: string | null;
  wirelessUsage: string | null; wirelessLanCard: string | null; phonePlanName: string | null;
  phoneCallerId: string | null; phoneCallWaiting: string | null; phoneNumberRequest: string | null; phoneNuisanceBlock: string | null;
  phoneCallForwarding: string | null; phoneAdditionalNumber: string | null; phoneMultipleChannels: string | null;
  phoneIncomingMail: string | null; phoneFaxMail: string | null; tvApplication: string | null; terrestrialTvEnvironment: string | null;
  quotedPrice: string | number | null; existingContractInfo: string | null; existingContractContinuation: string | null; existingLineType: string | null;
  applicantBirthday: string | null; thirdPartyLastNameKana: string | null; thirdPartyFirstNameKana: string | null;
  thirdPartyLastName: string | null; thirdPartyFirstName: string | null; thirdPartyBirthday: string | null;
  thirdPartyAge: string | number | null; thirdPartyGender: string | null; thirdPartyRelationship: string | null; thirdPartyTalkedAt: string | null;
  transferApprovalNumber: string | null; providerChangeApprovalNumber: string | null; cafNumber: string | null;
  installationPostalCode: string | null; installationPrefecture: string | null; installationCity: string | null; installationTown: string | null;
  installationCityKana: string | null; installationTownKana: string | null; shippingPostalCode: string | null; shippingPrefecture: string | null;
  shippingCity: string | null; shippingTown: string | null; shippingCityKana: string | null; shippingTownKana: string | null;
};

export type PostalAddressCandidate = { prefecture: string; city: string; town: string; cityKana: string; townKana: string; special: boolean };
export type PostalCheckContext = { byPostalCode: Record<string, PostalAddressCandidate[]>; sourceDate?: string | null; importedAt?: string | null; enabled?: boolean };

export type DuplicateSalesCase = { caseId: string; productName: string; registeredDate: string };
export type GardenCheckIssue = { ruleId: GardenCheckRuleId; severity: GardenCheckSeverity; message: string; missingFields?: string[] };
export type GardenCheckResult = { blocking: GardenCheckIssue[]; notices: GardenCheckIssue[]; warnings: GardenCheckIssue[]; deferredRuleIds: GardenCheckRuleId[]; postalData?: { sourceDate: string | null; importedAt: string | null } };

export const DEFERRED_ADDRESS_RULE_IDS: GardenCheckRuleId[] = ["R2-5"];
export const NTT_EAST_PREFECTURES = ["北海道", "青森", "岩手", "宮城", "秋田", "山形", "福島", "茨城", "栃木", "群馬", "埼玉", "千葉", "東京", "神奈川", "新潟", "山梨", "長野"] as const;
export const NTT_WEST_PREFECTURES = ["富山", "石川", "福井", "岐阜", "静岡", "愛知", "三重", "滋賀", "京都", "大阪", "兵庫", "奈良", "和歌山", "鳥取", "島根", "岡山", "広島", "山口", "徳島", "香川", "愛媛", "高知", "福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "沖縄"] as const;

const requiredLineFields: Array<[keyof SalesMasterRecord, string]> = [
  ["productCategory2", "商材区分2"], ["salesCommentLine", "営コメ 回線"], ["applicationCode", "申込コード"], ["applicationPlanName", "申込プラン名"],
  ["constructionType", "工事種別"], ["applicationIsp", "申込ISP"], ["wirelessUsage", "無線利用方法"], ["wirelessLanCard", "無線LANカード"],
  ["phonePlanName", "申込電話プラン"], ["phoneCallerId", "発信者番号表示ND"], ["phoneCallWaiting", "通話中着信通知CH"], ["phoneNumberRequest", "ナンバーリクエスト"],
  ["phoneNuisanceBlock", "迷惑電話ブロック"], ["phoneCallForwarding", "自動転送VW"], ["phoneAdditionalNumber", "追加番号"], ["phoneMultipleChannels", "複数チャネル"],
  ["phoneIncomingMail", "着信お知らせメール"], ["phoneFaxMail", "FAXお知らせメール"], ["tvApplication", "TV申込"], ["terrestrialTvEnvironment", "地デジ環境"],
  ["quotedPrice", "案内料金"], ["existingContractInfo", "既契約情報"], ["existingContractContinuation", "既契約継続有無"], ["existingLineType", "既契約回線タイプ"],
];
const thirdPartyFields: Array<[keyof SalesMasterRecord, string]> = [
  ["thirdPartyLastNameKana", "第三者確認 姓カナ"], ["thirdPartyFirstNameKana", "第三者確認 名カナ"], ["thirdPartyLastName", "第三者確認 姓"],
  ["thirdPartyFirstName", "第三者確認 名"], ["thirdPartyBirthday", "第三者確認 生年月日"], ["thirdPartyAge", "第三者確認 年齢"],
  ["thirdPartyGender", "第三者確認 性別"], ["thirdPartyRelationship", "第三者確認 続柄"], ["thirdPartyTalkedAt", "第三者と話した日時"],
];

const blank = (value: unknown) => value === null || value === undefined || (typeof value === "string" && value.trim() === "");
const normalized = (value: string | null) => (value ?? "").replace(/[\s　]+/g, "");
const missing = (record: SalesMasterRecord, fields: Array<[keyof SalesMasterRecord, string]>) => fields.filter(([key]) => blank(record[key])).map(([, label]) => label);
const blocking = (ruleId: GardenCheckRuleId, message: string, missingFields?: string[]): GardenCheckIssue => ({ ruleId, severity: "blocking", message, missingFields });
const notice = (ruleId: GardenCheckRuleId, message: string): GardenCheckIssue => ({ ruleId, severity: "notice", message });
export const normalizeAddressText = (value: string | null | undefined) => (value ?? "").normalize("NFKC").replace(/[\s　]+/g, "").replace(/[ヶケヵカ]/g, "ケ").toUpperCase();
export const normalizePostalCode = (value: string | null | undefined) => (value ?? "").normalize("NFKC").replace(/\D/g, "");
export const normalizePostalTownCandidate = (value: string | null | undefined) => normalizeAddressText(value).split("(", 1)[0];

function evaluateAddressSide(record: SalesMasterRecord, prefix: "installation" | "shipping", context: PostalCheckContext, issues: GardenCheckIssue[]) {
  if (!context.enabled) return;
  const postal = normalizePostalCode(record[prefix === "installation" ? "installationPostalCode" : "shippingPostalCode"]);
  if (!postal) return;
  const candidates = context.byPostalCode[postal] ?? [];
  if (!candidates.length) { issues.push(notice("R2-4", "この郵便番号が見つかりません。ご確認ください。")); return; }
  const normal = candidates.filter((candidate) => !candidate.special);
  if (!normal.length) return;
  const prefecture = normalizeAddressText(record[prefix === "installation" ? "installationPrefecture" : "shippingPrefecture"]);
  const city = normalizeAddressText(record[prefix === "installation" ? "installationCity" : "shippingCity"]);
  const town = normalizeAddressText(record[prefix === "installation" ? "installationTown" : "shippingTown"]);
  const cityKana = normalizeAddressText(record[prefix === "installation" ? "installationCityKana" : "shippingCityKana"]);
  const townKana = normalizeAddressText(record[prefix === "installation" ? "installationTownKana" : "shippingTownKana"]);
  if (!normal.some((candidate) => normalizeAddressText(candidate.prefecture) === prefecture && normalizeAddressText(candidate.city) === city)) issues.push(notice("R2-1", "郵便番号と住所が合っていないようです。ご確認ください。"));
  const townCandidates = normal.map((candidate) => normalizePostalTownCandidate(candidate.town)).filter(Boolean);
  if (townCandidates.length && !townCandidates.some((candidate) => town.includes(candidate))) issues.push(notice("R2-2", "大字が抜けているかもしれません。ご確認ください。"));
  const kanaCandidates = normal.map((candidate) => ({ city: normalizeAddressText(candidate.cityKana), town: normalizePostalTownCandidate(candidate.townKana) })).filter((candidate) => candidate.town);
  if (kanaCandidates.length && !kanaCandidates.some((candidate) => candidate.city === cityKana && townKana.includes(candidate.town))) issues.push(notice("R2-3", "住所のカナをご確認ください。"));
}

export function ageOnDate(birthday: string | null, checkedAt: Date): number | null {
  if (!birthday || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return null;
  const [year, month, day] = birthday.split("-").map(Number);
  const born = new Date(Date.UTC(year, month - 1, day));
  if (born.getUTCFullYear() !== year || born.getUTCMonth() !== month - 1 || born.getUTCDate() !== day) return null;
  const current = { year: checkedAt.getFullYear(), month: checkedAt.getMonth() + 1, day: checkedAt.getDate() };
  return current.year - year - (current.month < month || (current.month === month && current.day < day) ? 1 : 0);
}

export function nttArea(prefecture: string | null): "east" | "west" | null {
  const raw = (prefecture ?? "").trim();
  if ((NTT_EAST_PREFECTURES as readonly string[]).includes(raw)) return "east";
  if ((NTT_WEST_PREFECTURES as readonly string[]).includes(raw)) return "west";
  const value = raw.replace(/[都府県]$/, "");
  if ((NTT_EAST_PREFECTURES as readonly string[]).includes(value)) return "east";
  if ((NTT_WEST_PREFECTURES as readonly string[]).includes(value)) return "west";
  return null;
}

export function evaluateGardenCheck(record: SalesMasterRecord, duplicates: DuplicateSalesCase[] = [], checkedAt = new Date(), postalContext: PostalCheckContext = { byPostalCode: {} }): GardenCheckResult {
  const issues: GardenCheckIssue[] = [];
  if (record.flag !== "獲得") issues.push(blocking("R1", "フラグ が「獲得」になっていません。獲得に変更してください。"));
  if (!blank(record.mobileNumber)) {
    const fields = missing(record, [["mobileCarrier", "携帯キャリア営業用"], ["mobileDeviceType", "携帯端末タイプ"]]);
    if (fields.length) issues.push(blocking("R3", "携帯番号が入力されているため、次の項目を入力してください。", fields));
  }
  if (record.productCategory1 === "回線") {
    const fields = missing(record, requiredLineFields);
    if (fields.length) issues.push(blocking("R4", "回線商材のため、次の項目を入力してください。", fields));
  }
  const age = ageOnDate(record.applicantBirthday, checkedAt);
  if (age !== null && age >= 65) {
    const fields = missing(record, thirdPartyFields);
    if (fields.length) issues.push(blocking("R5", "申込者が65歳以上のため、第三者確認が必要です。次の項目を入力してください。", fields));
  }
  if (["転用他社転用", "転用自社転用"].includes(normalized(record.constructionType)) && blank(record.transferApprovalNumber)) {
    issues.push(blocking("R6", "次の項目を入力してください。", ["転用承諾番号"]));
  }
  if (normalized(record.constructionType) === "事業者間変更" && blank(record.providerChangeApprovalNumber)) {
    issues.push(blocking("R7", "次の項目を入力してください。", ["事業者番号"]));
  }
  if (record.productCategory2 === "BIGLOBE光" && nttArea(record.installationPrefecture) === "west" && blank(record.cafNumber)) {
    issues.push(blocking("R8", "次の項目を入力してください。", ["CAF番号"]));
  }
  if (blank(record.installationPostalCode)) issues.push(blocking("R9", "次の項目を入力してください。", ["郵便番号"]));
  evaluateAddressSide(record, "installation", postalContext, issues);
  evaluateAddressSide(record, "shipping", postalContext, issues);
  for (const duplicate of duplicates) issues.push({ ruleId: "R10", severity: "warning", message: `この営業IDは既に登録されています（案件ID ${duplicate.caseId} ／ ${duplicate.productName} ／ ${duplicate.registeredDate}）。別商材の追加契約であれば、そのまま進めてください。` });
  return {
    blocking: issues.filter((issue) => issue.severity === "blocking"), notices: issues.filter((issue) => issue.severity === "notice"),
    warnings: issues.filter((issue) => issue.severity === "warning"), deferredRuleIds: [...DEFERRED_ADDRESS_RULE_IDS], postalData: { sourceDate: postalContext.sourceDate ?? null, importedAt: postalContext.importedAt ?? null },
  };
}

export function createValidSalesMasterRecord(overrides: Partial<SalesMasterRecord> = {}): SalesMasterRecord {
  const base = Object.fromEntries(Object.keys({
    salesId: "", flag: "", mobileNumber: "", mobileCarrier: "", mobileDeviceType: "", productCategory1: "", productCategory2: "", salesCommentLine: "",
    applicationCode: "", applicationPlanName: "", constructionType: "", applicationIsp: "", wirelessUsage: "", wirelessLanCard: "", phonePlanName: "",
    phoneCallerId: "", phoneCallWaiting: "", phoneNumberRequest: "", phoneNuisanceBlock: "", phoneCallForwarding: "", phoneAdditionalNumber: "", phoneMultipleChannels: "",
    phoneIncomingMail: "", phoneFaxMail: "", tvApplication: "", terrestrialTvEnvironment: "", quotedPrice: "", existingContractInfo: "", existingContractContinuation: "", existingLineType: "",
    applicantBirthday: "", thirdPartyLastNameKana: "", thirdPartyFirstNameKana: "", thirdPartyLastName: "", thirdPartyFirstName: "", thirdPartyBirthday: "", thirdPartyAge: "",
    thirdPartyGender: "", thirdPartyRelationship: "", thirdPartyTalkedAt: "", transferApprovalNumber: "", providerChangeApprovalNumber: "", cafNumber: "", installationPostalCode: "", installationPrefecture: "", installationCity: "", installationTown: "", installationCityKana: "", installationTownKana: "", shippingPostalCode: "", shippingPrefecture: "", shippingCity: "", shippingTown: "", shippingCityKana: "", shippingTownKana: "",
  }).map((key) => [key, "入力済み"])) as SalesMasterRecord;
  return { ...base, salesId: "L26000001", flag: "獲得", mobileNumber: null, productCategory1: "回線以外", productCategory2: "その他", constructionType: "新規", applicantBirthday: "1990-01-01", installationPostalCode: "100-0001", installationPrefecture: "東京都", installationCity: "千代田区", installationTown: "千代田", installationCityKana: "チヨダク", installationTownKana: "チヨダ", ...overrides };
}
