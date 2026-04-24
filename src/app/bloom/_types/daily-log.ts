export type PlannedItem = {
  title: string;
  estimate_min?: number;
  done_bool?: boolean;
};

export type CompletedItem = {
  title: string;
  actual_min?: number;
  notes?: string;
};

export type NextStep = {
  title: string;
  target_date?: string;
};

export type DailyLog = {
  id: string;
  user_id: string;
  log_date: string;
  planned_items: PlannedItem[];
  completed_items: CompletedItem[];
  next_steps: NextStep[];
  highlights: string | null;
  hours_logged: number | null;
  created_at: string;
  updated_at: string;
};
