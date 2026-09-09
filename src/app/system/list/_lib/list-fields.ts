export const SOIL_LIST_TABLES = {
  phone: "soil_list_phone",
  purchase: "soil_list_purchase",
  call: "soil_list_call",
  condition: "soil_list_condition",
  export: "soil_list_export",
  option: "soil_list_option",
  assignment: "soil_list_assignment",
  upload: "soil_list_upload",
} as const;

/** 選択肢に出す値の上限（都道府県の列には 2,700 種類の表記ゆれがあるため、件数の多い順にここまで） */
export const MAX_OPTION_ITEMS = 60;

export const SOIL_LIST_COLUMNS = {
  phoneNumber: "電話番号",
  name: "氏名",
  nameKana: "氏名カナ",
  postalCode: "郵便番号",
  prefecture: "住所_都道府県",
  city: "住所_市区町村",
  town: "住所_町名",
  block: "住所_番地",
  mobileNumber: "携帯番号",
  birthday: "生年月日",
  industry: "業種",
  oldNumber: "旧No",
  listName: "リスト名",
  listLoadedOn: "リスト投入日",
  appointmentBlocked: "アポ禁",
  invalidCount: "無効回数",
  decisionResult: "判定結果",
  decisionItem: "判定項目",
  recheckedOn: "再判定日",
  managementLoaded: "管理マスタ投入済み",
  purchaseStatus: "購入状態",
  eastWest: "東西",
  originalLine: "元回線",
  lineIspExpected: "回線_ISP想定",
  elapsedMonths: "経過月数",
  elapsedLabel: "経過期間_表示",
  oldSegmentMemo: "旧区分メモ",
  auApplied: "AU光申込済み",
  complaintHistory: "クレーム履歴",
  auCallAvailability: "AU光架電可否",
  oldAuCallAvailability: "旧AU光架電可否",
  nameFromDirectory: "氏名_住ポン",
  addressFromDirectory: "住所_住ポン",
  directoryYear: "住所でポン_年版",
  directoryAcquiredOn: "住ポン_取得日",
  source: "データ出所",
  ispExpected: "ISP想定",
  ispInterview: "ISPヒアリングベース",
  purchaseVendor: "購入先",
  purchasedOn: "購入日",
  callCount: "コール回数合計",
  firstCalledOn: "初回コール日",
  lastCalledOn: "最終コール日_集約",
  lastCallResult: "最終結果",
  purchaseHistoryExists: "購入履歴あり",
} as const;

export type SoilListColumnKey = keyof typeof SOIL_LIST_COLUMNS;

export type SoilListOperator = "eq" | "contains" | "gte" | "lte" | "in" | "inOrEmpty" | "empty" | "notEmpty";

export type SoilListFilter = {
  field: SoilListColumnKey;
  op: SoilListOperator;
  value?: string | number | boolean | Array<string | number>;
};

export type SoilListConditionPayload = {
  filters: SoilListFilter[];
};

export type SoilListSortKey =
  | "listLoadedOnAsc"
  | "listLoadedOnDesc";

export type SoilListExportColumn = {
  key: SoilListColumnKey;
  label: string;
  defaultChecked: boolean;
};

export type SoilListFilterDefinition = {
  key: SoilListColumnKey;
  label: string;
  input: "select" | "contains" | "range";
  options?: string[];
};

export type SoilListOptionFieldKey = "prefecture" | "auCallAvailability" | "purchaseStatus" | "appointmentBlocked";

export type SoilListOptionItem = {
  value: string;
  label: string;
  count: number;
  empty: boolean;
};

export type SoilListOptionsPayload = Record<SoilListOptionFieldKey, SoilListOptionItem[]>;

export const EMPTY_OPTION_VALUE = "__soil_list_empty__";

export const PREFECTURE_REGIONS: Array<{ label: string; prefectures: string[] }> = [
  { label: "北海道・東北", prefectures: ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"] },
  { label: "関東", prefectures: ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県"] },
  { label: "中部", prefectures: ["新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県"] },
  { label: "近畿", prefectures: ["三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"] },
  { label: "中国", prefectures: ["鳥取県", "島根県", "岡山県", "広島県", "山口県"] },
  { label: "四国", prefectures: ["徳島県", "香川県", "愛媛県", "高知県"] },
  { label: "九州・沖縄", prefectures: ["福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"] },
];

export const OFFICIAL_PREFECTURES = PREFECTURE_REGIONS.flatMap((region) => region.prefectures);

export const SOIL_LIST_OPTION_FIELDS: SoilListOptionFieldKey[] = [
  "prefecture",
  "auCallAvailability",
  "purchaseStatus",
  "appointmentBlocked",
];

export const SOIL_LIST_FILTER_DEFINITIONS: SoilListFilterDefinition[] = [
  {
    key: "prefecture",
    label: "都道府県",
    input: "select",
    options: [""],
  },
  {
    key: "auCallAvailability",
    label: "AU光架電可否",
    input: "select",
    options: [""],
  },
  {
    key: "purchaseStatus",
    label: "購入状態",
    input: "select",
    options: [""],
  },
  {
    key: "appointmentBlocked",
    label: "アポ禁",
    input: "select",
    options: [""],
  },
  { key: "listName", label: "リスト名", input: "contains" },
  { key: "listLoadedOn", label: "リスト投入日", input: "range" },
  { key: "recheckedOn", label: "再判定日", input: "range" },
  { key: "lastCalledOn", label: "最終コール日", input: "range" },
  { key: "callCount", label: "コール回数", input: "range" },
  {
    key: "purchaseHistoryExists",
    label: "購入履歴",
    input: "select",
    options: ["", "なし", "あり"],
  },
];

export const SOIL_LIST_SEARCH_COLUMNS: SoilListColumnKey[] = [
  "phoneNumber",
  "name",
  "prefecture",
  "city",
  "listName",
  "lastCalledOn",
  "callCount",
  "purchaseStatus",
];

export const SOIL_LIST_EXPORT_COLUMNS: SoilListExportColumn[] = [
  { key: "phoneNumber", label: "電話番号", defaultChecked: true },
  { key: "name", label: "氏名", defaultChecked: true },
  { key: "nameKana", label: "氏名カナ", defaultChecked: true },
  { key: "postalCode", label: "郵便番号", defaultChecked: true },
  { key: "prefecture", label: "都道府県", defaultChecked: true },
  { key: "city", label: "住所（市区町村）", defaultChecked: true },
  { key: "town", label: "町名", defaultChecked: true },
  { key: "block", label: "番地", defaultChecked: true },
  { key: "mobileNumber", label: "携帯番号", defaultChecked: false },
  { key: "listName", label: "リスト名", defaultChecked: true },
  { key: "listLoadedOn", label: "リスト投入日", defaultChecked: true },
  { key: "source", label: "データ出所", defaultChecked: true },
];

export const SOIL_LIST_SORT_OPTIONS: Array<{ key: SoilListSortKey; label: string }> = [
  { key: "listLoadedOnAsc", label: "リスト投入日が古い順" },
  { key: "listLoadedOnDesc", label: "リスト投入日が新しい順" },
];

export const DEFAULT_SOIL_LIST_CONDITION: SoilListConditionPayload = {
  filters: [
    { field: "auCallAvailability", op: "eq", value: "○" },
    { field: "appointmentBlocked", op: "empty" },
  ],
};

export const MAX_SEARCH_ROWS = 100;
export const DEFAULT_EXPORT_LIMIT = 5000;
export const MAX_EXPORT_LIMIT = 50000;

export function getColumnName(key: SoilListColumnKey): string {
  return SOIL_LIST_COLUMNS[key];
}

export function getColumnKeyByName(columnName: string): SoilListColumnKey | null {
  const found = (Object.keys(SOIL_LIST_COLUMNS) as SoilListColumnKey[]).find(
    (key) => SOIL_LIST_COLUMNS[key] === columnName,
  );
  return found ?? null;
}
