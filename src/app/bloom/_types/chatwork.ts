export type ChatworkKind = 'daily' | 'weekly' | 'monthly' | 'alert';

export type ChatworkConfig = {
  id: 1;
  api_token: string | null;
  room_id_progress: string | null;
  room_id_alert: string | null;
  enabled: boolean;
  last_success_at: string | null;
  last_error: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type ChatworkMessage = {
  kind: ChatworkKind;
  room_id: string;
  body: string;
  file_path?: string;
  send_at?: string;
};
