import type { AlertData, CompanyDetailData, DivisionData, KpiData } from "./types";

export const performanceKpis: KpiData[] = [
  {
    icon: "📊",
    label: "連結売上",
    subLabel: "(4月実績)",
    prefix: "¥",
    value: "1,847",
    unit: "百万",
    yoyLabel: "前年比",
    yoy: "+12.3%",
    polylines: [
      { points: "5,45 22,42 40,40 58,38 75,36 92,33 110,30 128,27 145,22 163,18 180,14 195,10", stroke: "#7a9968", strokeWidth: "1.8" },
      { points: "5,52 22,50 40,48 58,46 75,44 92,42 110,40 128,38 145,36 163,34 180,32 195,30", stroke: "#b3a98f", strokeWidth: "1", dash: "3,2" },
    ],
  },
  {
    icon: "📈",
    label: "連結利益",
    subLabel: "(4月実績)",
    prefix: "¥",
    value: "247",
    unit: "百万",
    yoyLabel: "前年比",
    yoy: "+8.6%",
    polylines: [
      { points: "5,40 22,38 40,42 58,36 75,32 92,30 110,28 128,25 145,22 163,18 180,15 195,12", stroke: "#7a9968", strokeWidth: "1.8" },
      { points: "5,48 22,46 40,48 58,44 75,42 92,40 110,38 128,36 145,34 163,32 180,30 195,28", stroke: "#b3a98f", strokeWidth: "1", dash: "3,2" },
    ],
  },
  {
    icon: "🌿",
    label: "営業利益率",
    value: "13.4",
    unit: "%",
    yoyLabel: "前年比",
    yoy: "+0.8pt",
    polylines: [
      { points: "5,40 22,38 40,36 58,34 75,32 92,30 110,28 128,26 145,24 163,22 180,20 195,18", stroke: "#7a9968", strokeWidth: "1.8" },
    ],
  },
  {
    icon: "💰",
    label: "連結キャッシュ残高",
    prefix: "¥",
    value: "4,253",
    unit: "百万",
    yoyLabel: "前月比",
    yoy: "+¥87百万",
    polylines: [
      { points: "5,42 22,40 40,38 58,36 75,32 92,30 110,28 128,25 145,22 163,18 180,14 195,10", stroke: "#7a9968", strokeWidth: "1.8" },
    ],
  },
];

export const divisions: DivisionData[] = [
  { icon: "📞", name: "コールセンター事業", revenue: "¥950", revenueUnit: "百万 / 月", ratio: "比率 51%", yoy: "↑ +14.2%", yoyTone: "positive", status: "順調", statusTone: "success", chart: { type: "polyline", points: "5,30 40,28 75,26 110,22 145,18 195,12", stroke: "#7a9968" } },
  { icon: "⚡", name: "関電事業", revenue: "¥380", revenueUnit: "百万 / 月", ratio: "比率 21%", yoy: "↑ +18.5%", yoyTone: "positive", status: "急成長", statusTone: "fast", chart: { type: "polyline", points: "5,32 40,28 75,22 110,18 145,12 195,6", stroke: "#7a9968" } },
  { icon: "💻", name: "SES事業", revenue: "¥280", revenueUnit: "百万 / 月", ratio: "比率 15%", yoy: "↑ +6.8%", yoyTone: "positive", status: "順調", statusTone: "success", chart: { type: "polyline", points: "5,28 40,26 75,24 110,22 145,20 195,18", stroke: "#7a9968" } },
  { icon: "🔌", name: "ブレーカー事業", revenue: "¥167", revenueUnit: "百万 / 月", ratio: "比率 9%", yoy: "↓ -3.2%", yoyTone: "negative", status: "注視", statusTone: "warning", chart: { type: "polyline", points: "5,15 40,18 75,22 110,25 145,28 195,32", stroke: "#c95a4a" } },
  { icon: "👥", name: "派遣事業", revenue: "¥70", revenueUnit: "百万 / 月", ratio: "比率 4%", yoy: "↑ +28.5%", yoyTone: "positive", status: "新規拡大", statusTone: "new", chart: { type: "polyline", points: "5,35 40,30 75,25 110,18 145,10 195,4", stroke: "#5a8fa8" } },
  { icon: "🌱", name: "Garden販売事業", revenue: "2026 Q3", revenueUnit: " 公開予定", ratio: "売上計画策定中", yoy: "— 開発中", status: "開発中", statusTone: "future", future: true, chart: { type: "line", stroke: "#b3a98f" } },
];

export const companyDetails: CompanyDetailData[] = [
  { name: "ヒュアラン", status: "順調", statusTone: "ok", rows: [{ label: "当月売上", value: "¥128,400,000" }, { label: "前年比", value: "+12.3%", tone: "positive" }, { label: "月利益", value: "¥23,500,000" }, { label: "利益率", value: "18.3%", tone: "positive" }, { label: "現預金", value: "¥1,520,000,000" }], chartPoints: "5,22 40,20 75,18 110,15 145,10 195,6", chartStroke: "#7a9968" },
  { name: "センターライズ", status: "順調", statusTone: "ok", rows: [{ label: "当月売上", value: "¥82,300,000" }, { label: "前年比", value: "+6.7%", tone: "positive" }, { label: "月利益", value: "¥12,600,000" }, { label: "利益率", value: "15.3%", tone: "positive" }, { label: "現預金", value: "¥1,210,000,000" }], chartPoints: "5,22 40,20 75,22 110,18 145,15 195,10", chartStroke: "#7a9968" },
  { name: "リンクサポート", status: "要改善", statusTone: "warn", rows: [{ label: "当月売上", value: "¥65,100,000", tone: "negative" }, { label: "前年比", value: "▲-2.4%", tone: "negative" }, { label: "月利益", value: "¥2,300,000", tone: "negative" }, { label: "利益率", value: "3.5%", tone: "negative" }, { label: "現預金", value: "¥480,000,000" }], chartPoints: "5,8 40,12 75,16 110,20 145,24 195,28", chartStroke: "#c95a4a" },
  { name: "ARATA", status: "順調", statusTone: "ok", rows: [{ label: "当月売上", value: "¥159,800,000" }, { label: "前年比", value: "+18.9%", tone: "positive" }, { label: "月利益", value: "¥27,100,000" }, { label: "利益率", value: "17.0%", tone: "positive" }, { label: "現預金", value: "¥1,830,000,000" }], chartPoints: "5,28 40,22 75,18 110,12 145,8 195,4", chartStroke: "#7a9968" },
  { name: "たいよう", status: "順調", statusTone: "ok", rows: [{ label: "当月売上", value: "¥43,200,000" }, { label: "前年比", value: "+1.2%", tone: "positive" }, { label: "月利益", value: "¥4,320,000" }, { label: "利益率", value: "10.0%" }, { label: "現預金", value: "¥760,000,000" }], chartPoints: "5,20 40,18 75,20 110,18 145,16 195,15", chartStroke: "#7a9968" },
  { name: "壱", status: "順調", statusTone: "ok", rows: [{ label: "当月売上", value: "¥98,700,000" }, { label: "前年比", value: "+9.1%", tone: "positive" }, { label: "月利益", value: "¥9,870,000" }, { label: "利益率", value: "10.0%" }, { label: "現預金", value: "¥1,830,000,000" }], chartPoints: "5,25 40,22 75,18 110,15 145,12 195,8", chartStroke: "#7a9968" },
];

export const performanceAlerts: AlertData[] = [
  { icon: "📊", title: "売上進捗 目標比 92%", detail: "4月累計:目標比-8%", action: "5/2責任者会議で議題化", owner: "後道代表", status: "注視", statusTone: "watch" },
  { icon: "⚠", title: "入金遅延 2件", detail: "合計¥2,850,000", action: "槙俊介に督促依頼済み", owner: "槙 俊介", status: "対応要", statusTone: "respond" },
  { icon: "👥", title: "採用充足率 68%", detail: "目標85%に未達", action: "採用予算再配分検討中", owner: "金 亜奈", status: "要改善", statusTone: "improve" },
  { icon: "📉", title: "利益率低下 法人B", detail: "前月比-3.2pt", action: "原価分析実施中", owner: "上田 基人", status: "注意", statusTone: "note" },
  { icon: "📈", title: "案件粗利 改善余地", detail: "平均粗利率21.3%", action: "営業会議で施策検討", owner: "宮永 ひかり", status: "改善要", statusTone: "fix" },
];
