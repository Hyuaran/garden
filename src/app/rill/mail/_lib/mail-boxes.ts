import type { RillMailBox } from "./types";

export const SENT_BOX_ID = "sent";

export function sentBox(own: RillMailBox): RillMailBox {
  return { ...own, id: SENT_BOX_ID, label: "送信済み" };
}

export const isSentBox = (box: Pick<RillMailBox, "id">) => box.id === SENT_BOX_ID;

export function boxesForRequest(inboxBoxes: RillMailBox[], requested: string) {
  if (requested === "all") return inboxBoxes;
  if (requested === SENT_BOX_ID) return inboxBoxes[0] ? [sentBox(inboxBoxes[0])] : [];
  return inboxBoxes.filter((box) => box.id === requested || box.address === requested);
}

export function folderMessagePath(box: RillMailBox) {
  if (isSentBox(box)) return "/me/mailFolders/sentitems/messages";
  return box.id === "me" ? "/me/mailFolders/inbox/messages" : `/users/${encodeURIComponent(box.address)}/mailFolders/inbox/messages`;
}

export function searchMessagePath(box: RillMailBox) {
  if (isSentBox(box)) return "/me/mailFolders/sentitems/messages";
  return box.id === "me" ? "/me/messages" : `/users/${encodeURIComponent(box.address)}/messages`;
}

export function oneMessagePath(boxId: string, id: string) {
  return boxId === "me" || boxId === SENT_BOX_ID ? `/me/messages/${encodeURIComponent(id)}` : `/users/${encodeURIComponent(boxId)}/messages/${encodeURIComponent(id)}`;
}
