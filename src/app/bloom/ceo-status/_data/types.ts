export type CeoStatusTab = "overview" | "performance" | "decisions" | "settings";

export type GardenModuleStatus = "released" | "developing" | "pending";

export type ShojiStatus = {
  name: string;
  status: string;
  task: string;
  until: string;
  avatar: string;
};

export type GardenModuleProgress = {
  name: string;
  status: GardenModuleStatus;
  icon: string;
};

export type CompanySummary = {
  name: string;
  profit: string;
  cash: string;
  yoy: string;
  warning?: boolean;
  bars: number[];
};

export type ConsolidatedChart = {
  title: string;
  subtitle: string;
  kind: "bar" | "line";
  values: number[];
  labels: string[];
};

export type ActionItem = {
  marker: string;
  text: string;
};

export type ActionCard = {
  title: string;
  target: Exclude<CeoStatusTab, "overview" | "settings">;
  tone?: "fuji";
  items: ActionItem[];
};

export type KpiData = {
  icon: string;
  label: string;
  subLabel?: string;
  prefix?: string;
  value: string;
  unit?: string;
  yoyLabel: string;
  yoy: string;
  polylines: Array<{
    points: string;
    stroke: string;
    strokeWidth: string;
    dash?: string;
  }>;
};

export type DivisionData = {
  icon: string;
  name: string;
  revenue: string;
  revenueUnit: string;
  ratio: string;
  yoy: string;
  yoyTone?: "positive" | "negative";
  status: string;
  statusTone: "success" | "fast" | "warning" | "new" | "future";
  future?: boolean;
  chart: { type: "polyline" | "line"; points?: string; stroke: string };
};

export type CompanyDetailData = {
  name: string;
  status: string;
  statusTone: "ok" | "warn";
  rows: Array<{ label: string; value: string; tone?: "positive" | "negative" }>;
  chartPoints: string;
  chartStroke: string;
};

export type AlertData = {
  icon: string;
  title: string;
  detail: string;
  action: string;
  owner: string;
  status: string;
  statusTone: "watch" | "respond" | "improve" | "note" | "fix";
};

export type DecisionPriority = "critical" | "high" | "medium" | "low";

export type DecisionData = {
  number: string;
  priority: string;
  priorityTone: DecisionPriority;
  name: string;
  hoverDemo?: boolean;
  assignee: string;
  avatar: string;
  rows: Array<{ label: string; value: string; tone?: "deadline" | "assignee" }>;
};

export type AgendaItem = {
  number: string;
  name: string;
  owner: string;
  status: string;
  statusTone: "done" | "preparing" | "waiting";
};

export type ArchiveItem = {
  date: string;
  title: string;
  summary: string;
};

export type MeetingData = {
  title: string;
  details: Array<{ label: string; value: string }>;
  agenda: AgendaItem[];
  archives: ArchiveItem[];
};

export type ReportItem = {
  number: string;
  date: string;
  content: string;
  author: string;
  status: string;
  statusTone: "smooth" | "plan" | "respond" | "judge" | "done" | "thinking" | "proposing" | "progress";
};
