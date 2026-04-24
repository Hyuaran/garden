/**
 * Chatwork API v2 型定義（使用するエンドポイントに必要な最小セット）
 *
 * 公式ドキュメント: https://developer.chatwork.com/reference/
 * 注: Chatwork は数値 ID を返すが、ルーム ID は文字列扱いしても許容される。
 *     本型では number を正、string → number 変換は client 側で吸収する。
 */

export type ChatworkRoomId = string | number;

export type ChatworkMessageSendResult = {
  message_id: string;
};

export type ChatworkFileUploadResult = {
  file_id: number;
};

export type ChatworkRoom = {
  room_id: number;
  name: string;
  type: "my" | "direct" | "group";
  role: string;
  sticky: boolean;
  unread_num: number;
  mention_num: number;
  mytask_num: number;
  message_num: number;
  file_num: number;
  task_num: number;
  icon_path: string;
  last_update_time: number;
};

export type ChatworkMessage = {
  message_id: string;
  account: {
    account_id: number;
    name: string;
    avatar_image_url: string;
  };
  body: string;
  send_time: number;
  update_time: number;
};

export type ChatworkSendMessageOptions = {
  /** Chatwork の self_unread フラグ。true で自分宛も未読にする */
  selfUnread?: boolean;
};

export type ChatworkNotificationKind = "daily" | "weekly" | "monthly" | "alert";
