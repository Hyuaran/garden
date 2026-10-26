import "server-only";
import { ChatworkClient } from "@/lib/chatwork";

export async function notifyViewerAdded(actor: string, employee: string, label: string) {
  const token = process.env.CHATWORK_API_TOKEN;
  if (!token) throw new Error("Garden通知の設定がありません");
  await new ChatworkClient(token).sendMessage(process.env.GARDEN_NOTICE_CHATWORK_ROOM_ID || "450125458", `${actor}さんが${employee}さんを『${label}』に追加しました`);
}
