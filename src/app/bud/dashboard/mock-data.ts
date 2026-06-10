const T = "/themes/garden-shell";

export const companyTabs = [
  "全法人合算",
  "ヒュアラン",
  "センターライズ",
  "リンクサポート",
  "ARATA",
  "たいよう",
  "壱",
] as const;

// 実務 / 監査 / 設定 は左メニューに独立しているため重複。タブのデザインを残すため
// 「全体 / Overview」1 タブのみを表示する。
export const dashboardTabs = [
  { id: "overview", label: "全体 / Overview" },
] as const;

export const kpis = [
  {
    icon: "¥",
    label: "売上",
    value: "¥48,250,000",
    note: "前月比 +8.3%",
    series: [34, 22, 39, 27, 48, 31, 41, 26, 33, 29, 54, 36, 46, 38, 28, 52],
    chart: "bars",
  },
  {
    icon: "経",
    label: "経費",
    value: "¥31,820,000",
    note: "前月比 +2.1%",
    series: [26, 36, 31, 43, 47, 33, 35, 29, 45, 41, 34, 27, 39, 31, 48, 52],
    chart: "bars",
  },
  {
    icon: "%",
    label: "利益",
    value: "¥16,430,000",
    note: "利益率 34.0%",
    series: [24, 31, 27, 30, 25, 34, 45, 37, 29, 23, 35, 46, 39, 32, 51, 66],
    chart: "line",
  },
  {
    icon: "銀",
    label: "銀行残高",
    value: "¥370,200,000",
    note: "前日比 +¥1,250,000",
    series: [24, 30, 38, 44, 37, 31, 40, 38, 49, 58, 54, 49, 61, 72],
    chart: "line",
  },
] as const;

export const profitTrend = {
  labels: ["1月", "2月", "3月", "4月", "5月", "6月"],
  datasets: [
    { label: "ヒュアラン", color: "#9eb35f", data: [820, 910, 960, 1040, 1180, 1290] },
    { label: "センターライズ", color: "#d5ac4f", data: [520, 570, 650, 710, 790, 860] },
    { label: "リンクサポート", color: "#6f9b70", data: [420, 480, 510, 540, 620, 690] },
  ],
};

export const waitingItems = [
  { icon: "仕", label: "仕訳待ち", count: "12件" },
  { icon: "振", label: "振込待ち", count: "5件" },
  { icon: "経", label: "経費精算承認待ち", count: "8件" },
  { icon: "請", label: "請求書発行待ち", count: "3件" },
  { icon: "給", label: "給与確認待ち", count: "2件" },
] as const;

export const quickActions = [
  { icon: "仕", label: "仕訳作成" },
  { icon: "振", label: "振込登録" },
  { icon: "給", label: "給与処理" },
  { icon: "弥", label: "弥生エクスポート" },
  { icon: "経", label: "経費精算入力" },
  { icon: "請", label: "請求書発行" },
] as const;

export const mirrorItems = [
  { icon: "月", title: "月次損益サマリ", body: "Bloom 経営状況 + Forest 決算" },
  { icon: "予", title: "振込予定", body: "Bloom 通知" },
  { icon: "銀", title: "銀行口座残高", body: "Bloom balance-overview" },
  { icon: "給", title: "給与配信状況", body: "Bloom 通知" },
] as const;

export const budActivityItems = [
  {
    time: "09:20",
    icon: `${T}/images/icons_bloom/orb_bud.png`,
    title: "自分の今日の処理",
    body: "仕訳 24件、振込 3件、経費精算 5件を確認できます。",
  },
  {
    time: "10:05",
    icon: `${T}/images/icons_bloom/orb_bloom.png`,
    title: "Bloom 連携",
    body: "月次損益サマリを経営状況にミラー予定です。",
  },
  {
    time: "11:30",
    icon: `${T}/images/icons_bloom/orb_forest.png`,
    title: "決算確認",
    body: "Forest 決算との照合ポイントを準備中です。",
  },
];
