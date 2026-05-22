export type Milestone = {
  date: string;
  title: string;
  detail: string;
  done: boolean;
};

export type ProgressBarChart = {
  title: string;
  subtitle: string;
  unit: string;
  bars: Array<{ label: string; value: number }>;
};

export const overallProgress = {
  percent: 67,
  released: 2,
  developing: 5,
  seeding: 5,
  caption: "12 モジュールの平均到達度",
};

export const milestones: Milestone[] = [
  { date: "2026/04/21", title: "Forest 全法人決算ダッシュボード公開", detail: "6 法人の決算・会計を横断集計", done: true },
  { date: "2026/05/05", title: "Bloom トップ 桜世界観リブランディング", detail: "GardenShell 統一デザインへ移行", done: true },
  { date: "2026/05/11", title: "Garden 統一ログイン基盤", detail: "12 モジュール共通の認証ゲート", done: true },
  { date: "2026/05/20", title: "Bloom 設計図 MVP", detail: "モジュール構造・AI 体制を可視化", done: true },
  { date: "2026/05/22", title: "Bloom 段階 2-2 経営・日報・月次", detail: "経営状況 4 タブ + 業務 3 ページ", done: true },
  { date: "2026/05/29", title: "Bloom 段階 2-2-C 設計図・進捗・統合 KPI", detail: "3 ページの桜デザイン化", done: false },
  { date: "2026/06/12", title: "Bud 経理収支 機能拡充", detail: "仕訳・振込・請求の自動化を強化", done: false },
];

export const progressCharts: ProgressBarChart[] = [
  {
    title: "月別 完了タスク",
    subtitle: "直近 6 ヶ月",
    unit: "件",
    bars: [
      { label: "12月", value: 38 },
      { label: "1月", value: 44 },
      { label: "2月", value: 52 },
      { label: "3月", value: 61 },
      { label: "4月", value: 73 },
      { label: "5月", value: 86 },
    ],
  },
  {
    title: "週別 リリース",
    subtitle: "直近 6 週",
    unit: "本",
    bars: [
      { label: "W18", value: 3 },
      { label: "W19", value: 5 },
      { label: "W20", value: 4 },
      { label: "W21", value: 7 },
      { label: "W22", value: 6 },
      { label: "W23", value: 9 },
    ],
  },
  {
    title: "領域別 進捗",
    subtitle: "基盤 / 現場 / 経営",
    unit: "%",
    bars: [
      { label: "基盤", value: 82 },
      { label: "組織", value: 100 },
      { label: "現場", value: 74 },
      { label: "経理", value: 55 },
      { label: "経営", value: 68 },
      { label: "新規", value: 18 },
    ],
  },
];
