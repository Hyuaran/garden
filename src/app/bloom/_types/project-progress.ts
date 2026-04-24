export type ProjectProgress = {
  id: string;
  roadmap_entry_id: string;
  snapshot_on: string;
  progress_pct: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};
