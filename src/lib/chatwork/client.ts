/**
 * Chatwork API クライアント（fetch ベース、依存追加なし）
 *
 * 設計方針:
 *   - Node ランタイム前提（§10.3 判2）。Edge でも動くが file upload は Buffer 依存で Node 限定。
 *   - 構造化エラーを投げる（ChatworkError）。呼び出し側で status code 別制御可能。
 *   - self_unread は既定 false（送信者自身を未読にしない）。
 *   - API トークンはコンストラクタ引数で受け取り、モジュールスコープに保持しない。
 */

import type {
  ChatworkFileUploadResult,
  ChatworkMessageSendResult,
  ChatworkRoom,
  ChatworkRoomId,
  ChatworkSendMessageOptions,
} from "./types";

const API_BASE = "https://api.chatwork.com/v2";

export class ChatworkError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`Chatwork API ${status}: ${body.slice(0, 200)}`);
    this.name = "ChatworkError";
    this.status = status;
    this.body = body;
  }
}

export type ChatworkClientOptions = {
  fetchImpl?: typeof fetch;
  /**
   * true のときは実 API を呼ばず、sendMessage / uploadFile を
   * no-op（ダミー message_id を返す）に差し替える。
   * Cron Phase 1 テスト期間の誤送信防止用。
   */
  dryRun?: boolean;
  /** Dry-run 時のログ出力先（既定 console.log） */
  logger?: (entry: { method: string; roomId: string; body?: string }) => void;
};

export class ChatworkClient {
  private readonly apiToken: string;
  private readonly fetchImpl: typeof fetch;
  readonly dryRun: boolean;
  private readonly logger: NonNullable<ChatworkClientOptions["logger"]>;

  constructor(apiToken: string, options: ChatworkClientOptions = {}) {
    if (!apiToken) {
      throw new Error("ChatworkClient: apiToken is required");
    }
    this.apiToken = apiToken;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.dryRun = options.dryRun ?? false;
    this.logger =
      options.logger ??
      ((entry) => {
        // eslint-disable-next-line no-console
        console.log("[chatwork:dry-run]", entry);
      });
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const url = `${API_BASE}${path}`;
    const headers = new Headers(init.headers);
    headers.set("X-ChatWorkToken", this.apiToken);

    // FormData のときは Content-Type を fetch に自動設定させる
    if (
      init.body &&
      !(init.body instanceof FormData) &&
      !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/x-www-form-urlencoded");
    }

    const res = await this.fetchImpl(url, { ...init, headers });
    const text = await res.text();
    if (!res.ok) {
      throw new ChatworkError(res.status, text);
    }
    if (!text) {
      return {} as T;
    }
    try {
      return JSON.parse(text) as T;
    } catch (err) {
      throw new ChatworkError(
        res.status,
        `JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** GET /rooms/:room_id */
  getRoom(roomId: ChatworkRoomId): Promise<ChatworkRoom> {
    return this.request<ChatworkRoom>(`/rooms/${roomId}`);
  }

  /** POST /rooms/:room_id/messages */
  async sendMessage(
    roomId: ChatworkRoomId,
    body: string,
    options: ChatworkSendMessageOptions = {},
  ): Promise<ChatworkMessageSendResult> {
    if (this.dryRun) {
      this.logger({ method: "sendMessage", roomId: String(roomId), body });
      return { message_id: `dry-run-${Date.now()}` };
    }
    const params = new URLSearchParams();
    params.set("body", body);
    params.set("self_unread", options.selfUnread ? "1" : "0");
    return this.request<ChatworkMessageSendResult>(
      `/rooms/${roomId}/messages`,
      {
        method: "POST",
        body: params,
      },
    );
  }

  /** POST /rooms/:room_id/files */
  async uploadFile(
    roomId: ChatworkRoomId,
    file: Blob,
    opts: { filename: string; message?: string },
  ): Promise<ChatworkFileUploadResult> {
    if (this.dryRun) {
      this.logger({
        method: "uploadFile",
        roomId: String(roomId),
        body: `[file: ${opts.filename} (${file.size} bytes)] ${opts.message ?? ""}`,
      });
      return { file_id: 0 };
    }
    const form = new FormData();
    form.append("file", file, opts.filename);
    if (opts.message) form.append("message", opts.message);
    return this.request<ChatworkFileUploadResult>(
      `/rooms/${roomId}/files`,
      {
        method: "POST",
        body: form,
      },
    );
  }

  /** GET /me — トークン有効性チェック用 */
  getMe(): Promise<{ account_id: number; name: string }> {
    return this.request<{ account_id: number; name: string }>("/me");
  }
}
