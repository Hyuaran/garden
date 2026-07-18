import type { RillMailBox, RillMailMessage } from "./types";

export const MAIL_STATES = ["要対応", "確認中", "処理済"] as const;
export type MailState = typeof MAIL_STATES[number];
export type MailWriteOperation = "flag" | "state" | "confirm" | "read";

export function replaceMailState(categories: string[], state: MailState | null) {
  const kept = categories.filter((category) => !MAIL_STATES.includes(category as MailState));
  return state ? [...kept, state] : kept;
}

export function assertOwnConfirmationName(requestedName: string, ownName: string) {
  if (requestedName !== ownName) throw new Error("他の利用者の確認印は変更できません");
}

export function toggleOwnConfirmation(categories: string[], ownName: string, on: boolean) {
  const kept = categories.filter((category) => category !== ownName);
  return on ? [...kept, ownName] : kept;
}

export function isPersonalMailbox(box: Pick<RillMailBox, "id" | "kind">) {
  return box.id === "me" && box.kind === "personal";
}

export function isMessageUnread(message: RillMailMessage, ownName: string) {
  return isPersonalMailbox(message.box) ? !message.isRead : !message.categories.includes(ownName);
}

export function selectionRange<T>(items: T[], anchor: T, target: T) {
  const from = items.indexOf(anchor);
  const to = items.indexOf(target);
  if (from < 0 || to < 0) return [target];
  return items.slice(Math.min(from, to), Math.max(from, to) + 1);
}

export function isMailState(value: unknown): value is MailState {
  return typeof value === "string" && MAIL_STATES.includes(value as MailState);
}

export function applyLocalMailMutation(message: RillMailMessage, op: MailWriteOperation, value: boolean | MailState | null, ownName: string): RillMailMessage {
  if (op === "flag") return { ...message, flag: { flagStatus: value ? "flagged" : "notFlagged" } };
  if (op === "read") return { ...message, isRead: Boolean(value) };
  if (op === "state") return { ...message, categories: replaceMailState(message.categories, value as MailState | null) };
  return { ...message, categories: toggleOwnConfirmation(message.categories, ownName, Boolean(value)) };
}
