export type KpiSubTab = "summary" | "forest" | "tree" | "bud";

export const entityTabs = ["全社統合", "ヒュアラン", "センターライズ", "リンクサポート", "ARATA", "たいよう", "壱"];

export const entityKpis: Record<string, {
  sales: string;
  profit: string;
  calls: string;
  journals: string;
  salesDelta: string;
  profitDelta: string;
  callsDelta: string;
  journalsDelta: string;
  chart: number[];
  bars: number[];
}> = {
  全社統合: { sales: "¥85,420,000", profit: "¥57,750,000", calls: "12,485 件", journals: "3,245 件", salesDelta: "+18.5%", profitDelta: "+12.3%", callsDelta: "+8.7%", journalsDelta: "+5.2%", chart: [22, 32, 24, 28, 36, 42, 50, 44, 40, 58], bars: [54, 42, 46, 50, 56, 42, 34] },
  ヒュアラン: { sales: "¥28,500,000", profit: "¥12,840,000", calls: "3,480 件", journals: "820 件", salesDelta: "+12.3%", profitDelta: "+9.8%", callsDelta: "+6.1%", journalsDelta: "+3.2%", chart: [18, 24, 22, 30, 34, 39, 42, 38, 43, 50], bars: [42, 38, 44, 47, 49, 40, 45] },
  センターライズ: { sales: "¥18,200,000", profit: "¥8,230,000", calls: "2,210 件", journals: "540 件", salesDelta: "+6.7%", profitDelta: "+5.4%", callsDelta: "+4.0%", journalsDelta: "+2.4%", chart: [16, 18, 20, 22, 24, 26, 25, 28, 31, 34], bars: [32, 35, 33, 36, 39, 34, 37] },
  リンクサポート: { sales: "¥15,400,000", profit: "¥6,510,000", calls: "1,960 件", journals: "480 件", salesDelta: "-2.4%", profitDelta: "-1.6%", callsDelta: "+1.2%", journalsDelta: "-0.8%", chart: [40, 39, 36, 34, 32, 31, 29, 30, 28, 27], bars: [38, 35, 36, 34, 32, 30, 31] },
  ARATA: { sales: "¥9,800,000", profit: "¥15,980,000", calls: "2,640 件", journals: "610 件", salesDelta: "+18.9%", profitDelta: "+20.4%", callsDelta: "+13.1%", journalsDelta: "+7.7%", chart: [20, 28, 31, 35, 42, 44, 48, 52, 58, 64], bars: [40, 48, 52, 58, 63, 57, 66] },
  たいよう: { sales: "¥7,500,000", profit: "¥4,320,000", calls: "1,120 件", journals: "390 件", salesDelta: "+1.2%", profitDelta: "+0.9%", callsDelta: "+2.2%", journalsDelta: "+1.1%", chart: [20, 21, 20, 22, 23, 24, 24, 25, 26, 27], bars: [28, 29, 31, 30, 32, 31, 33] },
  壱: { sales: "¥6,020,000", profit: "¥9,870,000", calls: "1,075 件", journals: "405 件", salesDelta: "+9.1%", profitDelta: "+8.4%", callsDelta: "+5.6%", journalsDelta: "+4.3%", chart: [14, 16, 18, 20, 24, 27, 29, 31, 33, 36], bars: [31, 34, 37, 39, 41, 38, 43] },
};

export const entityRows = [
  { name: "ヒュアラン", sales: "¥28,500,000", profit: "¥12,840,000", cash: "¥83,500,000", yoy: "+12.3%", status: "順調" },
  { name: "センターライズ", sales: "¥18,200,000", profit: "¥8,230,000", cash: "¥56,200,000", yoy: "+6.7%", status: "順調" },
  { name: "リンクサポート", sales: "¥15,400,000", profit: "¥6,510,000", cash: "¥42,300,000", yoy: "-2.4%", status: "要注意", negative: true },
  { name: "ARATA", sales: "¥9,800,000", profit: "¥15,980,000", cash: "¥92,100,000", yoy: "+18.9%", status: "好調" },
  { name: "たいよう", sales: "¥7,500,000", profit: "¥4,320,000", cash: "¥31,400,000", yoy: "+1.2%", status: "順調" },
  { name: "壱", sales: "¥6,020,000", profit: "¥9,870,000", cash: "¥64,700,000", yoy: "+9.1%", status: "順調" },
  { name: "全社統合", sales: "¥85,420,000", profit: "¥57,750,000", cash: "¥370,200,000", yoy: "+10.8%", status: "順調" },
];

export const trendSeries = [
  { title: "連結売上推移", max: 100, lines: [[62, 66, 71, 72, 72, 85], [28, 32, 36, 38, 35, 52], [20, 22, 23, 24, 26, 31]], labels: ["全社統合", "ヒュアラン", "ARATA"] },
  { title: "連結利益推移", max: 80, lines: [[38, 41, 43, 45, 51, 58], [20, 21, 22, 23, 25, 34], [12, 14, 16, 18, 22, 29]], labels: ["全社統合", "ヒュアラン", "壱"] },
  { title: "連結キャッシュ推移", max: 500, lines: [[310, 328, 333, 345, 370, 370], [150, 158, 162, 170, 181, 195], [90, 94, 102, 108, 116, 128]], labels: ["全社統合", "ヒュアラン", "センターライズ"] },
];

export const sectionPanels = {
  summary: {
    title: "SUMMARY / 統合サマリ",
    body: "売上・利益・架電・仕訳を横断して、今月の意思決定に必要な数字だけを確認します。",
  },
  forest: {
    title: "FOREST / 売上",
    body: "法人別売上と現預金の推移を中心に、経営判断に必要な資金の見通しを確認します。",
  },
  tree: {
    title: "TREE / 架電",
    body: "架電件数、接続率、折り返し対応を見ながら、営業現場の動きを点検します。",
  },
  bud: {
    title: "BUD / 経理",
    body: "仕訳件数、振込、請求書、月次締めの進み具合を確認します。",
  },
};

export const actionItems = [
  { title: "経営判断待ち案件", body: "新規金契約条件の承認", note: "期限: 4/29、重要", icon: "/themes/garden-shell/images/header_icons/header_calendar.png" },
  { title: "業績アラート", body: "売上進捗 目標比 92%（注視）", note: "リンクサポートを確認", icon: "/themes/garden-shell/images/header_icons/D-02_help_simple.png" },
  { title: "次回責任者会議", body: "4/30 責任者会議 10:00-11:30", note: "議題プレビュー", icon: "/themes/garden-shell/images/header_icons/D-03_mypage_simple.png" },
  { title: "後進代表への報告事項", body: "4月売上は前年比 +12.3% で着地", note: "詳細を確認", icon: "/themes/garden-shell/images/header_icons/header_bell.png" },
];
