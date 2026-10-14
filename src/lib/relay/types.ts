export type RelayKind = "innovera" | "kot";

export type RelayStatus = "queued" | "running" | "done" | "failed" | "expired";

export type RelayRequest =
  | {
      ckey: string;
      akey: string;
      params?: Record<string, unknown>;
    }
  | {
      api: string;
      params?: Record<string, unknown>;
    };

export type RelayResult = unknown;

export type RelayJobRow = {
  id: string;
  kind: RelayKind;
  request: RelayRequest;
  status: RelayStatus;
  result: RelayResult | null;
  error: string | null;
  requested_by: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  expires_at: string;
};

export type RelayHeartbeatRow = {
  id: string;
  last_seen_at: string;
  agent_version: string | null;
  notified_down_at: string | null;
  updated_at: string | null;
};
