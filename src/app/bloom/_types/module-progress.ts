export type ModuleCode =
  | 'soil'
  | 'root'
  | 'tree'
  | 'leaf'
  | 'bud'
  | 'bloom'
  | 'forest'
  | 'rill'
  | 'seed';

export type ModuleStatus = 'planned' | 'in_progress' | 'at_risk' | 'done';

export type ModuleProgress = {
  module_code: ModuleCode;
  label_dev: string;
  label_ops: string;
  phase_label: string | null;
  progress_pct: number;
  status: ModuleStatus | null;
  last_updated_at: string;
  last_commit_sha: string | null;
  last_commit_at: string | null;
  display_order: number;
};

export const MODULE_DEFAULT_ORDER: ModuleCode[] = [
  'soil',
  'root',
  'tree',
  'leaf',
  'bud',
  'bloom',
  'forest',
  'rill',
  'seed',
];
