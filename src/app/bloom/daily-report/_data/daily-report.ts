const AVATAR = "/themes/garden-shell/images/avatar";

export type DailyTab = {
  label: string;
  english: string;
  active?: boolean;
};

export type ReportBlock = {
  label: string;
  icon: string;
  body: string;
  tags: string[];
};

export type DailyReportItem = {
  date: string;
  weekday: string;
  owner: string;
  avatar: string;
  summary: string;
  tags: string[];
};

export type WeeklyReportDay = {
  day: string;
  hours: number;
  tasks: number;
};

export type DailyMember = {
  name: string;
  count: number;
  progress: number;
  avatar: string;
};

export const dailyTabs: DailyTab[] = [
  { label: "サマリ", english: "Summary", active: true },
  { label: "達成事項", english: "Achievements" },
  { label: "進捗グラフ", english: "Progress" },
  { label: "次の目標", english: "Next Goals" },
];

export const reportBlocks: ReportBlock[] = [
  {
    label: "A. 本日の作業ログ",
    icon: "✎",
    body: "Garden 設計図段階 1 マージ済（PR #212）。段階 2-1 着手し Bloom Top の GardenShell 化完了（PR #213）。並行で決算 CC 仕訳完了。",
    tags: ["#Bloom", "#GardenShell", "#決算"],
  },
  {
    label: "B. 気づき・課題",
    icon: "☼",
    body: "ログイン UI が古いまま。/forest/login の刷新は別フェーズで要対応。",
    tags: [],
  },
  {
    label: "C. 明日への申し送り",
    icon: "✈",
    body: "段階 2-2-A（経営状況突合）の Codex Dispatch 起案。Garden 設計図の ChatGPT デザインも並走。",
    tags: [],
  },
];

export const recentReports: DailyReportItem[] = [
  {
    date: "5/19",
    weekday: "月曜日",
    owner: "東海林 美琴",
    avatar: `${AVATAR}/avatar_shoji.png`,
    summary: "Memory 分配完了。54 件中 53 件処理済。",
    tags: ["Memory", "整理"],
  },
  {
    date: "5/18",
    weekday: "日曜日",
    owner: "後道 翔太",
    avatar: `${AVATAR}/avatar_koizumi.png`,
    summary: "Forest 仕訳帳実装中。弥生 CSV 出力完成。",
    tags: ["Forest", "決算"],
  },
  {
    date: "5/17",
    weekday: "土曜日",
    owner: "東海林 美琴",
    avatar: `${AVATAR}/avatar_shoji.png`,
    summary: "Garden 概要 7 ファイル整備。",
    tags: ["Memory"],
  },
  {
    date: "5/16",
    weekday: "金曜日",
    owner: "田中 太郎",
    avatar: `${AVATAR}/avatar_ueda.png`,
    summary: "Bud 監査ログ画面完成。",
    tags: ["Bud"],
  },
  {
    date: "5/15",
    weekday: "木曜日",
    owner: "佐藤 花子",
    avatar: `${AVATAR}/avatar_kin.png`,
    summary: "月次ダイジェスト 4 月版 PDF 出力完了。",
    tags: ["Bloom"],
  },
];

export const weeklyReportDays: WeeklyReportDay[] = [
  { day: "月", hours: 7, tasks: 4 },
  { day: "火", hours: 11, tasks: 8 },
  { day: "水", hours: 11, tasks: 8 },
  { day: "木", hours: 10, tasks: 9 },
  { day: "金", hours: 12, tasks: 11 },
  { day: "土", hours: 4, tasks: 3 },
  { day: "日", hours: 8, tasks: 5 },
];

export const dailyMembers: DailyMember[] = [
  {
    name: "東海林 美琴",
    count: 7,
    progress: 100,
    avatar: `${AVATAR}/avatar_shoji.png`,
  },
  {
    name: "後道 翔太",
    count: 5,
    progress: 71,
    avatar: `${AVATAR}/avatar_koizumi.png`,
  },
  {
    name: "田中 太郎",
    count: 4,
    progress: 57,
    avatar: `${AVATAR}/avatar_ueda.png`,
  },
  {
    name: "佐藤 花子",
    count: 3,
    progress: 43,
    avatar: `${AVATAR}/avatar_kin.png`,
  },
];

export const summaryCounters = [
  { label: "PR", value: "2 件", icon: "⌘" },
  { label: "Dispatch", value: "4 件", icon: "▱" },
  { label: "Daily", value: "4 件", icon: "□" },
  { label: "Review", value: "2 件", icon: "○" },
];
