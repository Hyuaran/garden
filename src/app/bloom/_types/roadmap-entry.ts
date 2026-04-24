export type RoadmapEntryKind = 'phase' | 'milestone' | 'module' | 'risk' | 'banner';

export type BannerSeverity = 'info' | 'warn' | 'critical';

export type RoadmapEntry = {
  id: string;
  kind: RoadmapEntryKind;
  parent_id: string | null;
  sort_order: number;
  label_dev: string;
  label_ops: string | null;
  description: string | null;
  target_month: string | null;
  starts_on: string | null;
  due_on: string | null;
  completed_on: string | null;
  progress_pct: number | null;
  banner_severity: BannerSeverity | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};
