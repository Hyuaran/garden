import type {
  ActionCard,
  CompanySummary,
  ConsolidatedChart,
  GardenModuleProgress,
  ShojiStatus,
} from "./types";

const T = "/themes/garden-shell/images";

export const shojiStatus: ShojiStatus = {
  name: "東海林",
  status: "集中業務中",
  task: "Garden Bloom実装",
  until: "~12:30まで",
  avatar: `${T}/avatar/avatar_shoji.png`,
};

export const gardenProgress = {
  percent: 67,
  released: 3,
  developing: 5,
  pending: 2,
};

export const gardenModules: GardenModuleProgress[] = [
  { name: "Soil", status: "released", icon: `${T}/icons/soil.png` },
  { name: "Root", status: "released", icon: `${T}/icons/root.png` },
  { name: "Tree", status: "released", icon: `${T}/icons/tree.png` },
  { name: "Leaf", status: "developing", icon: `${T}/icons/leaf.png` },
  { name: "Bud", status: "developing", icon: `${T}/icons/bud.png` },
  { name: "Bloom", status: "developing", icon: `${T}/icons/bloom.png` },
  { name: "Seed", status: "pending", icon: `${T}/icons/seed.png` },
  { name: "Forest", status: "developing", icon: `${T}/icons/forest.png` },
  { name: "Rill", status: "developing", icon: `${T}/icons/rill.png` },
  { name: "Fruit", status: "pending", icon: `${T}/icons/fruit.png` },
];

export const companies: CompanySummary[] = [
  { name: "ヒュアラン", profit: "¥12,840,000", cash: "¥83,500,000", yoy: "+12.3%", bars: [50, 60, 55, 70, 75, 85] },
  { name: "センターライズ", profit: "¥8,230,000", cash: "¥56,200,000", yoy: "+6.7%", bars: [55, 50, 65, 60, 70, 75] },
  { name: "リンクサポート", profit: "¥6,510,000", cash: "¥42,300,000", yoy: "▲-2.4%", warning: true, bars: [75, 70, 65, 55, 50, 45] },
  { name: "ARATA", profit: "¥15,980,000", cash: "¥92,100,000", yoy: "+18.9%", bars: [55, 65, 70, 75, 85, 90] },
  { name: "たいよう", profit: "¥4,320,000", cash: "¥31,400,000", yoy: "+1.2%", bars: [55, 60, 55, 60, 65, 62] },
  { name: "壱", profit: "¥9,870,000", cash: "¥64,700,000", yoy: "+9.1%", bars: [50, 55, 60, 70, 75, 80] },
];

export const consolidatedCharts: ConsolidatedChart[] = [
  { title: "連結売上推移", subtitle: "直近6ヶ月", kind: "bar", values: [22, 27, 29, 35, 39, 45], labels: ["11月", "12月", "1月", "2月", "3月", "4月"] },
  { title: "連結利益推移", subtitle: "直近6ヶ月", kind: "bar", values: [17, 19, 15, 22, 27, 32], labels: ["11月", "12月", "1月", "2月", "3月", "4月"] },
  { title: "連結キャッシュ推移", subtitle: "直近6ヶ月", kind: "line", values: [40, 38, 32, 28, 22, 15], labels: ["11月", "12月", "1月", "2月", "3月", "4月"] },
];

export const actionCards: ActionCard[] = [
  {
    title: "経営判断待ち案件",
    target: "decisions",
    items: [
      { marker: "1.", text: "新規金契約条件の承認(小泉/4/29/重要)" },
      { marker: "2.", text: "採用予算の再配分(金/4/29/高)" },
      { marker: "3.", text: "新規取引先の与信判断(槙/4/30/中)" },
      { marker: "4.", text: "広告投資上限の見直し(宮永/5/1/中)" },
      { marker: "5.", text: "基幹改修の優先順位決定(上田/5/2/中)" },
    ],
  },
  {
    title: "業績アラート",
    target: "performance",
    items: [
      { marker: "▲", text: "売上進捗 目標比 92%(注視)" },
      { marker: "!", text: "入金遅延 2件(対応要)" },
      { marker: "!", text: "採用充足率 68%(要改善)" },
      { marker: "▼", text: "利益率低下 法人B(注意)" },
      { marker: "↑", text: "案件粗利 改善余地(改善要)" },
    ],
  },
  {
    title: "次回責任者会議 議題プレビュー",
    target: "decisions",
    items: [
      { marker: "📅", text: "4/30 責任者会議 10:00-11:30" },
      { marker: "1.", text: "4月締め確認" },
      { marker: "2.", text: "採用進捗共有" },
      { marker: "3.", text: "Bloom実装スケジュール" },
      { marker: "4.", text: "広告施策レビュー" },
      { marker: "5.", text: "キャッシュ見通し" },
    ],
  },
  {
    title: "後道代表への報告事項",
    target: "decisions",
    tone: "fuji",
    items: [
      { marker: "1.", text: "4月売上は前年比+12.3%で着地見込み" },
      { marker: "2.", text: "Bloom導入は5月第2週デモ予定" },
      { marker: "3.", text: "法人Cの採用未充足が継続" },
      { marker: "4.", text: "大型取引先の更新契約は承認待ち" },
    ],
  },
];
