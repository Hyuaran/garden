export type KpiCard = {
  label: string;
  sub: string;
  prefix?: string;
  value: string;
  unit?: string;
  yoy: string;
  yoyTone: "up" | "down";
  trend: number[];
};

export type CompanyKpi = {
  key: string;
  name: string;
  en: string;
  kpis: KpiCard[];
};

export type IdentityRow = {
  name: string;
  revenue: string;
  profit: string;
  margin: string;
  yoy: string;
  yoyTone: "up" | "down";
  status: string;
  statusTone: "good" | "watch" | "alert";
};

export type ActionItem = {
  icon: string;
  title: string;
  detail: string;
  owner: string;
  tone: "alert" | "watch" | "info";
};

export const targetMonth = "2026年6月";

/** SVG polyline points helper data — 各 trend は 0-100 正規化済の 6 点 */
const t = (...v: number[]) => v;

export const companyKpis: CompanyKpi[] = [
  {
    key: "all",
    name: "全社",
    en: "Summary",
    kpis: [
      { label: "売上（全社）", sub: "Total Revenue", prefix: "¥", value: "85,420,000", yoy: "+11.8%", yoyTone: "up", trend: t(48, 52, 58, 64, 72, 80) },
      { label: "今月粗利", sub: "Gross Profit", prefix: "¥", value: "57,750,000", yoy: "+9.4%", yoyTone: "up", trend: t(40, 44, 48, 52, 58, 64) },
      { label: "取引件数", sub: "Transactions", value: "12,485", unit: "件", yoy: "+6.2%", yoyTone: "up", trend: t(50, 55, 53, 60, 66, 72) },
      { label: "新規リード", sub: "New Leads", value: "3,245", unit: "件", yoy: "+18.1%", yoyTone: "up", trend: t(30, 38, 44, 52, 60, 74) },
    ],
  },
  {
    key: "huaran",
    name: "ヒュアラン",
    en: "Huaran",
    kpis: [
      { label: "売上", sub: "Revenue", prefix: "¥", value: "28,300,000", yoy: "+12.3%", yoyTone: "up", trend: t(50, 56, 55, 64, 70, 80) },
      { label: "粗利", sub: "Gross Profit", prefix: "¥", value: "18,400,000", yoy: "+8.9%", yoyTone: "up", trend: t(46, 50, 52, 58, 62, 70) },
      { label: "粗利率", sub: "Margin", value: "65.0", unit: "%", yoy: "+1.4pt", yoyTone: "up", trend: t(58, 60, 61, 63, 64, 65) },
      { label: "現預金", sub: "Cash", prefix: "¥", value: "83,500,000", yoy: "+5.6%", yoyTone: "up", trend: t(60, 62, 65, 70, 74, 78) },
    ],
  },
  {
    key: "centerize",
    name: "センターライズ",
    en: "Centerize",
    kpis: [
      { label: "売上", sub: "Revenue", prefix: "¥", value: "16,800,000", yoy: "+6.7%", yoyTone: "up", trend: t(52, 50, 58, 56, 64, 70) },
      { label: "粗利", sub: "Gross Profit", prefix: "¥", value: "9,900,000", yoy: "+4.1%", yoyTone: "up", trend: t(48, 50, 49, 54, 56, 60) },
      { label: "粗利率", sub: "Margin", value: "58.9", unit: "%", yoy: "+0.6pt", yoyTone: "up", trend: t(55, 56, 57, 57, 58, 59) },
      { label: "現預金", sub: "Cash", prefix: "¥", value: "56,200,000", yoy: "+3.2%", yoyTone: "up", trend: t(54, 56, 58, 60, 63, 66) },
    ],
  },
  {
    key: "linksupport",
    name: "リンクサポート",
    en: "LinkSupport",
    kpis: [
      { label: "売上", sub: "Revenue", prefix: "¥", value: "11,200,000", yoy: "▲2.4%", yoyTone: "down", trend: t(72, 70, 66, 60, 55, 50) },
      { label: "粗利", sub: "Gross Profit", prefix: "¥", value: "6,000,000", yoy: "▲3.8%", yoyTone: "down", trend: t(66, 64, 60, 56, 52, 48) },
      { label: "粗利率", sub: "Margin", value: "53.6", unit: "%", yoy: "▲1.2pt", yoyTone: "down", trend: t(58, 57, 56, 55, 54, 53) },
      { label: "現預金", sub: "Cash", prefix: "¥", value: "42,300,000", yoy: "▲1.1%", yoyTone: "down", trend: t(60, 58, 57, 55, 54, 53) },
    ],
  },
  {
    key: "arata",
    name: "ARATA",
    en: "Arata",
    kpis: [
      { label: "売上", sub: "Revenue", prefix: "¥", value: "21,500,000", yoy: "+18.9%", yoyTone: "up", trend: t(44, 52, 58, 66, 76, 88) },
      { label: "粗利", sub: "Gross Profit", prefix: "¥", value: "15,900,000", yoy: "+15.2%", yoyTone: "up", trend: t(42, 50, 56, 64, 72, 84) },
      { label: "粗利率", sub: "Margin", value: "74.0", unit: "%", yoy: "+2.1pt", yoyTone: "up", trend: t(66, 68, 70, 71, 73, 74) },
      { label: "現預金", sub: "Cash", prefix: "¥", value: "92,100,000", yoy: "+9.8%", yoyTone: "up", trend: t(58, 62, 68, 74, 82, 90) },
    ],
  },
  {
    key: "taiyo",
    name: "たいよう",
    en: "Taiyo",
    kpis: [
      { label: "売上", sub: "Revenue", prefix: "¥", value: "7,620,000", yoy: "+1.2%", yoyTone: "up", trend: t(55, 58, 55, 58, 62, 62) },
      { label: "粗利", sub: "Gross Profit", prefix: "¥", value: "4,200,000", yoy: "+0.8%", yoyTone: "up", trend: t(52, 53, 52, 54, 55, 55) },
      { label: "粗利率", sub: "Margin", value: "55.1", unit: "%", yoy: "+0.2pt", yoyTone: "up", trend: t(54, 54, 55, 55, 55, 55) },
      { label: "現預金", sub: "Cash", prefix: "¥", value: "31,400,000", yoy: "+1.0%", yoyTone: "up", trend: t(56, 57, 57, 58, 59, 60) },
    ],
  },
];

export const identityRows: IdentityRow[] = [
  { name: "ヒュアラン", revenue: "¥28,300,000", profit: "¥18,400,000", margin: "65.0%", yoy: "+12.3%", yoyTone: "up", status: "順調", statusTone: "good" },
  { name: "センターライズ", revenue: "¥16,800,000", profit: "¥9,900,000", margin: "58.9%", yoy: "+6.7%", yoyTone: "up", status: "順調", statusTone: "good" },
  { name: "リンクサポート", revenue: "¥11,200,000", profit: "¥6,000,000", margin: "53.6%", yoy: "▲2.4%", yoyTone: "down", status: "要注視", statusTone: "alert" },
  { name: "ARATA", revenue: "¥21,500,000", profit: "¥15,900,000", margin: "74.0%", yoy: "+18.9%", yoyTone: "up", status: "好調", statusTone: "good" },
  { name: "たいよう", revenue: "¥7,620,000", profit: "¥4,200,000", margin: "55.1%", yoy: "+1.2%", yoyTone: "up", status: "横ばい", statusTone: "watch" },
  { name: "壱", revenue: "¥9,870,000", profit: "¥5,400,000", margin: "54.7%", yoy: "+9.1%", yoyTone: "up", status: "順調", statusTone: "good" },
];

export const developmentProgress = {
  percent: 67,
  released: 2,
  developing: 5,
  seeding: 5,
  note: "Garden 12 モジュールの平均到達度。経営の数字と開発の数字を同じ画面で見渡せます。",
};

export const actionItems: ActionItem[] = [
  { icon: "▲", title: "リンクサポート 売上前年割れ", detail: "3 ヶ月連続の減収。商材構成の見直しが必要。", owner: "槙", tone: "alert" },
  { icon: "!", title: "入金遅延 2 件", detail: "大型取引先 2 社の入金が期日超過。", owner: "金", tone: "watch" },
  { icon: "!", title: "採用充足率 68%", detail: "現場人員の不足が続き、現場稼働に影響。", owner: "宮永", tone: "watch" },
  { icon: "↑", title: "ARATA 粗利改善余地", detail: "高採算案件の比率が上昇。投資拡大を検討。", owner: "上田", tone: "info" },
];
