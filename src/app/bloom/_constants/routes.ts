export const BLOOM_PATHS = {
  HOME: "/bloom",
  WORKBOARD: "/bloom/workboard",
  ROADMAP: "/bloom/roadmap",
  MONTHLY_DIGEST: "/bloom/monthly-digest",
  DAILY_REPORTS: "/bloom/daily-report",
  CEO_STATUS: "/bloom/ceo-status",
  PROGRESS: "/bloom/progress",
  KPI: "/bloom/kpi",
  LOGIN: "/bloom/login",
  FOREST_LOGIN: "/forest/login",
  UNIFIED_LOGIN: "/login",
} as const;

export type BloomPath = (typeof BLOOM_PATHS)[keyof typeof BLOOM_PATHS];
