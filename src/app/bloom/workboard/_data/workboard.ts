const AVATAR = "/themes/garden-shell/images/avatar";

export type RunningProject = {
  title: string;
  progress: number;
  status: string;
  statusTone: "done" | "active" | "smooth";
  owner: string;
  updated: string;
  next: string;
};

export type StatusOption = {
  label: string;
  tone: "available" | "busy" | "focus" | "away";
};

export type PlanItem = {
  time: string;
  title: string;
  tag: string;
  done: boolean;
  active?: boolean;
};

export type WeeklyDay = {
  day: string;
  date: string;
  completed: number;
  total: number;
  flower: "sakura" | "bud" | "muted";
};

export type TeamMember = {
  name: string;
  status: string;
  tone: "focus" | "available" | "busy";
  task: string;
  avatar: string;
};

export const runningProjects: RunningProject[] = [
  {
    title: "Garden 開発 段階 2-1",
    progress: 100,
    status: "完了",
    statusTone: "done",
    owner: "東海林 美琴",
    updated: "5/20 14:30",
    next: "PR レビュー",
  },
  {
    title: "ヒュアラン決算 CC 仕訳",
    progress: 100,
    status: "完了",
    statusTone: "done",
    owner: "後道 翔太",
    updated: "5/20 13:10",
    next: "経営報告",
  },
  {
    title: "Bloom サブページ展開",
    progress: 30,
    status: "進行中",
    statusTone: "active",
    owner: "東海林 美琴",
    updated: "5/20 11:45",
    next: "UI 仕上げ",
  },
  {
    title: "Forest 仕訳帳実装",
    progress: 70,
    status: "順調",
    statusTone: "smooth",
    owner: "田中 太郎",
    updated: "5/20 12:20",
    next: "結合確認",
  },
];

export const statusOptions: StatusOption[] = [
  { label: "対応可能", tone: "available" },
  { label: "取り込み中", tone: "busy" },
  { label: "集中業務中", tone: "focus" },
  { label: "外出中", tone: "away" },
];

export const planItems: PlanItem[] = [
  { time: "10:00", title: "Bloom ワークボード確認", tag: "Bloom", done: true },
  { time: "11:30", title: "ステータス更新", tag: "Bloom", done: true },
  { time: "14:30", title: "PR #213 レビュー", tag: "Bloom", done: false, active: true },
  { time: "16:00", title: "月次ダイジェスト編集", tag: "Bloom", done: false },
  { time: "18:00", title: "段階 2-2 計画レビュー", tag: "Bloom", done: false },
];

export const weeklyDays: WeeklyDay[] = [
  { day: "月", date: "5/14", completed: 8, total: 8, flower: "sakura" },
  { day: "火", date: "5/15", completed: 12, total: 12, flower: "sakura" },
  { day: "水", date: "5/16", completed: 10, total: 10, flower: "sakura" },
  { day: "木", date: "5/17", completed: 9, total: 9, flower: "sakura" },
  { day: "金", date: "5/18", completed: 11, total: 11, flower: "sakura" },
  { day: "土", date: "5/19", completed: 0, total: 0, flower: "muted" },
  { day: "日", date: "5/20", completed: 5, total: 8, flower: "bud" },
];

export const teamMembers: TeamMember[] = [
  {
    name: "東海林 美琴",
    status: "集中業務中",
    tone: "focus",
    task: "Garden 設計図デザイン依頼中",
    avatar: `${AVATAR}/avatar_shoji.png`,
  },
  {
    name: "後道 翔太",
    status: "対応可能",
    tone: "available",
    task: "—",
    avatar: `${AVATAR}/avatar_koizumi.png`,
  },
  {
    name: "田中 太郎",
    status: "取り込み中",
    tone: "busy",
    task: "ヒュアラン経営精算",
    avatar: `${AVATAR}/avatar_ueda.png`,
  },
  {
    name: "佐藤 花子",
    status: "集中業務中",
    tone: "focus",
    task: "月次ダイジェスト編集",
    avatar: `${AVATAR}/avatar_kin.png`,
  },
];
