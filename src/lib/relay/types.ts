export type RelayKind = "innovera" | "kot";

export type RelayStatus = "queued" | "running" | "done" | "failed" | "expired";

export type KotEmployeeCreate = { code: string; lastName: string; firstName: string; divisionCode: string; typeCode: string; gender: "male" | "female"; lastNamePhonetics?: string; firstNamePhonetics?: string; hiredDate?: string; birthDate?: string };

export type RelayRequest =
  | { method: "POST"; path: "/employees"; body: KotEmployeeCreate }
  | {
      method: "GET";
      path: string;
    }
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
