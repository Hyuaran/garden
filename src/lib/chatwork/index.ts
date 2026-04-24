/**
 * Garden 共有 Chatwork ライブラリ（src/lib/chatwork）
 *
 * Bloom 専用ではなく、将来 Rill（チャット本体モジュール）や他モジュールから
 * 再利用可能にするため src/app 外に配置している（scaffold §4.1）。
 *
 * 使用例:
 *   import { ChatworkClient, renderDaily, resolveSecrets } from "@/lib/chatwork";
 *
 *   const secrets = await resolveSecrets();
 *   const cw = new ChatworkClient(secrets.apiToken);
 *   const body = renderDaily({ ... });
 *   await cw.sendMessage(secrets.roomIdProgress, body);
 */

export { ChatworkClient, ChatworkError } from "./client";
export {
  CHATWORK_SIGNATURE_HEADER,
  verifyChatworkWebhook,
} from "./webhook";
export {
  readSecretsFromEnv,
  tryReadSecretsFromEnv,
  readSecretsFromDb,
  resolveSecrets,
  ChatworkSecretsMissingError,
  type ChatworkSecrets,
  type ChatworkSecretsPartial,
} from "./secrets";
export * from "./types";
export * from "./templates";
