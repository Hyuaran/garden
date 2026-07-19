import type { RillMailMessage } from "./types";

export type MailMoveOperation = "archive" | "delete" | "restore";
export type MoveExclusion = { expiresAt: number };
export type MoveExclusionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const MOVE_EXCLUSION_TTL_MS = 60_000;
export const MOVE_UNDO_MS = 5_000;

export function moveDestination(operation: MailMoveOperation) {
  if (operation === "archive") return "archive";
  if (operation === "delete") return "deleteditems";
  return "inbox";
}

export function moveMessagePath(boxId: string, messageId: string) {
  const message = boxId === "me"
    ? `/me/messages/${encodeURIComponent(messageId)}`
    : `/users/${encodeURIComponent(boxId)}/messages/${encodeURIComponent(messageId)}`;
  return `${message}/move`;
}

export function applyMoveExclusions<T extends Pick<RillMailMessage, "id" | "box">>(
  messages: T[], exclusions: ReadonlyMap<string, MoveExclusion>, now: number,
) {
  const active = new Map([...exclusions].filter(([, value]) => value.expiresAt > now));
  return {
    messages: messages.filter((message) => !active.has(`${message.box.id}:${message.id}`)),
    exclusions: active,
  };
}

export function removeMovedMessages<T extends Pick<RillMailMessage, "id" | "box">>(messages: T[], keys: ReadonlySet<string>) {
  return messages.filter((message) => !keys.has(`${message.box.id}:${message.id}`));
}

export function restoreMovedMessages<T extends RillMailMessage>(messages: T[], restored: T[]) {
  const byKey = new Map(messages.map((message) => [`${message.box.id}:${message.id}`, message]));
  restored.forEach((message) => byKey.set(`${message.box.id}:${message.id}`, message));
  return [...byKey.values()].sort((a, b) => Date.parse(b.receivedDateTime) - Date.parse(a.receivedDateTime));
}

export function moveExclusionStorageKey(userId: string) { return `rill-mail-move-exclusions:${userId}`; }

export function loadMoveExclusions(storage: MoveExclusionStorage | null, userId: string, now: number) {
  const active = new Map<string, MoveExclusion>();
  if (!storage || !userId) return active;
  try {
    const parsed = JSON.parse(storage.getItem(moveExclusionStorageKey(userId)) ?? "{}") as Record<string, MoveExclusion>;
    Object.entries(parsed).forEach(([key, value]) => {
      if (typeof value?.expiresAt === "number" && value.expiresAt > now) active.set(key, value);
    });
    writeMoveExclusions(storage, userId, active);
  } catch { try { storage.removeItem(moveExclusionStorageKey(userId)); } catch { /* storage unavailable */ } }
  return active;
}

export function saveMoveExclusions(storage: MoveExclusionStorage | null, userId: string, keys: string[], now: number) {
  const active = loadMoveExclusions(storage, userId, now);
  keys.forEach((key) => active.set(key, { expiresAt: now + MOVE_EXCLUSION_TTL_MS }));
  if (storage && userId) writeMoveExclusions(storage, userId, active);
  return active;
}

export function removeMoveExclusions(storage: MoveExclusionStorage | null, userId: string, keys: string[], now: number) {
  const active = loadMoveExclusions(storage, userId, now);
  keys.forEach((key) => active.delete(key));
  if (storage && userId) writeMoveExclusions(storage, userId, active);
  return active;
}

function writeMoveExclusions(storage: MoveExclusionStorage, userId: string, exclusions: ReadonlyMap<string, MoveExclusion>) {
  try {
    const key = moveExclusionStorageKey(userId);
    if (!exclusions.size) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(Object.fromEntries(exclusions)));
  } catch { /* private mode/quota failures must not break mail moves */ }
}

export function scheduleMoveUndoWindow(onExpire: () => void, delay = MOVE_UNDO_MS) {
  let active = true;
  const timer = setTimeout(() => { if (active) { active = false; onExpire(); } }, delay);
  return {
    undo() { if (!active) return false; active = false; clearTimeout(timer); return true; },
    dispose() { active = false; clearTimeout(timer); },
  };
}
