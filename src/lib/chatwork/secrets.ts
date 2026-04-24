/**
 * Chatwork シークレット読み出し
 *
 * 優先順位:
 *   1. bloom_chatwork_config テーブル（§10.3 判1: pgcrypto 暗号化予定）
 *   2. 環境変数（開発・初期セットアップ向けフォールバック）
 *
 * 現状の実装方針（T8 基盤）:
 *   - DB 読み取りは Supabase service role 経由が必要（Cron / Route Handler 側）
 *   - T8 では env ベースのフォールバックのみ提供
 *   - DB からの取得は呼び出し側で getConfigFromDb() を経由させる設計（後付け容易）
 *
 * 環境変数:
 *   - CHATWORK_API_TOKEN         : Chatwork API トークン（必須）
 *   - CHATWORK_BLOOM_ROOM_ID     : Garden 開発進捗ルーム ID（日次/週次/月次）
 *   - CHATWORK_ALERT_ROOM_ID     : 重要アラート用ルーム ID（任意、未設定時 progress と共用）
 *   - CHATWORK_WEBHOOK_SECRET    : Webhook 署名検証用シークレット
 *   - BLOOM_PUBLIC_URL           : Chatwork メッセージ内で配布する URL ベース
 */

export type ChatworkSecrets = {
  apiToken: string;
  roomIdProgress: string;
  roomIdAlert: string;
  webhookSecret: string | null;
  bloomPublicUrl: string;
};

export type ChatworkSecretsPartial = Partial<ChatworkSecrets>;

class ChatworkSecretsMissingError extends Error {
  constructor(keys: string[]) {
    super(`Chatwork secrets missing: ${keys.join(", ")}`);
    this.name = "ChatworkSecretsMissingError";
  }
}

/**
 * env ベースの読み出し。未設定キーはそのままエラーで通知。
 * Cron や Route Handler は起動時にこの関数を呼び、不備があれば 500 で失敗させる。
 */
export function readSecretsFromEnv(): ChatworkSecrets {
  const apiToken = process.env.CHATWORK_API_TOKEN;
  const roomIdProgress = process.env.CHATWORK_BLOOM_ROOM_ID;
  const roomIdAlert =
    process.env.CHATWORK_ALERT_ROOM_ID ?? roomIdProgress ?? "";
  const webhookSecret = process.env.CHATWORK_WEBHOOK_SECRET ?? null;
  const bloomPublicUrl =
    process.env.BLOOM_PUBLIC_URL ?? "https://garden.hyuaran.com/bloom";

  const missing: string[] = [];
  if (!apiToken) missing.push("CHATWORK_API_TOKEN");
  if (!roomIdProgress) missing.push("CHATWORK_BLOOM_ROOM_ID");

  if (missing.length > 0) {
    throw new ChatworkSecretsMissingError(missing);
  }

  return {
    apiToken: apiToken as string,
    roomIdProgress: roomIdProgress as string,
    roomIdAlert,
    webhookSecret,
    bloomPublicUrl,
  };
}

/**
 * 安全版: 不備時に null を返す（UI 側で configured フラグに使う等）。
 */
export function tryReadSecretsFromEnv(): ChatworkSecrets | null {
  try {
    return readSecretsFromEnv();
  } catch {
    return null;
  }
}

/**
 * bloom_chatwork_config からの読み出し（TODO: T9 で実装）
 *
 * 想定実装:
 *   - Supabase service role client から SELECT
 *   - api_token 列は pgp_sym_decrypt(api_token, $KEY) で復号
 *   - $KEY はサーバ側環境変数 BLOOM_CHATWORK_SECRET_KEY
 *
 * T8 時点では未実装。呼び出し側は readSecretsFromEnv() を使用する。
 */
export async function readSecretsFromDb(): Promise<ChatworkSecrets | null> {
  // intentional: T9 scope — 実装は Cron route 設計と合わせる
  return null;
}

/**
 * 優先順位ラッパー: DB → env の順で解決。T8 では env のみ機能。
 */
export async function resolveSecrets(): Promise<ChatworkSecrets> {
  const fromDb = await readSecretsFromDb();
  if (fromDb) return fromDb;
  return readSecretsFromEnv();
}

export { ChatworkSecretsMissingError };
