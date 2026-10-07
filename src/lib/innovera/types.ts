import type { KintoneRecord } from "@/lib/kintone/records";

export type InnoveraCircuit = {
  circuit_num: string | number | null;
  name: string | null;
  number: string | null;
  free_number?: string | null;
  related_number?: string | null;
  inserted?: string | null;
  updtdate?: string | null;
  status?: string | null;
};

export type KintoneInnoveraRecord = KintoneRecord & {
  $id?: { value: string | number };
  識別番号?: { value: unknown };
  回線番号?: { value: unknown };
  FD番号?: { value: unknown };
  最終回線名称?: { value: unknown };
  最終番号ステータス?: { value: unknown };
  発番日?: { value: unknown };
  廃止日?: { value: unknown };
  ドロップダウン?: { value: unknown };
  最終入力日時?: { value: unknown };
  最終行番号?: { value: unknown };
  テーブル?: { value: KintoneHistoryRow[] };
};

export type KintoneHistoryRow = {
  id?: string;
  value: {
    回線名称?: { value: unknown; type?: string };
    入力日時?: { value: unknown; type?: string };
    入力者?: { value: unknown; type?: string };
    行番号?: { value: unknown; type?: string };
    番号ステータス?: { value: unknown; type?: string };
  };
};

export type InnoveraActionKind = "added" | "renamed" | "retired" | "needs_review";

export type InnoveraDiffAction = {
  kind: InnoveraActionKind;
  circuitNum: string;
  lineNumber: string;
  fdNumber?: string;
  issuedDate?: string;
  previousName?: string;
  nextName?: string;
  previousLineNumber?: string;
  reason?: "number_mismatch" | "restored_deleted";
  kintoneId?: string;
  record?: KintoneInnoveraRecord;
  innovera?: InnoveraCircuit;
  writeRecord?: KintoneRecord;
};

export type InnoveraSyncLogRow = {
  id?: number;
  ran_at: string;
  trigger: "cron" | "manual";
  applied: boolean;
  ok: boolean;
  innovera_count: number | null;
  kintone_count: number | null;
  added: number;
  renamed: number;
  retired: number;
  needs_review: number;
  failed: number;
  details: unknown;
  error: string | null;
  actor_employee_id: string | null;
};

export type InnoveraSyncResult = {
  ok: boolean;
  error?: string;
  applied: boolean;
  trigger: "cron" | "manual";
  ranAt: string;
  innoveraCount: number | null;
  kintoneCount: number | null;
  counts: {
    added: number;
    renamed: number;
    retired: number;
    needsReview: number;
    failed: number;
  };
  actions: InnoveraDiffAction[];
  details: InnoveraSyncDetail[];
  latestLogs?: InnoveraSyncLogRow[];
};

export type InnoveraSyncDetail = {
  kind: InnoveraActionKind;
  circuitNum: string;
  lineNumber: string;
  fdNumber?: string;
  issuedDate?: string;
  previousName?: string;
  nextName?: string;
  previousLineNumber?: string;
  reason?: string;
  result: "pending" | "skipped" | "created" | "updated" | "failed";
  error?: string;
};
