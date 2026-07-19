export const COMPOSE_MODES = ["new", "reply", "replyAll", "forward"] as const;
export type ComposeMode = typeof COMPOSE_MODES[number];

export type ComposeSendInput = {
  mode: ComposeMode;
  box: string;
  sourceMessageId?: string;
  to: string[];
  cc: string[];
  subject: string;
  bodyText: string;
};

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const SIMPLE_ATTACHMENT_BYTES = 3 * 1024 * 1024;
export type ComposeAttachment = { id: string; name: string; size: number; type: string; file: File };
export type ComposeDraft = ComposeSendInput & { id: string; quote: string; fromLabel: string; ccVisible: boolean; attachments: ComposeAttachment[] };

export function attachmentUploadMethod(size: number) {
  return size <= SIMPLE_ATTACHMENT_BYTES ? "simple" as const : "session" as const;
}

export function validateAttachmentSizes(existing: Array<{ size: number }>, incoming: Array<{ size: number }>) {
  if (incoming.some((file) => file.size > MAX_ATTACHMENT_BYTES)) throw new Error("1ファイルは25MB以下にしてください");
  const total = [...existing, ...incoming].reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_ATTACHMENT_BYTES) throw new Error("添付ファイルの合計は25MB以下にしてください");
}

export function appendAttachments(existing: ComposeAttachment[], files: File[], makeId = () => crypto.randomUUID()) {
  validateAttachmentSizes(existing, files);
  return [...existing, ...files.map((file) => ({ id: makeId(), name: file.name, size: file.size, type: file.type || "application/octet-stream", file }))];
}

export const removeAttachment = (attachments: ComposeAttachment[], id: string) => attachments.filter((attachment) => attachment.id !== id);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
export const isValidEmailAddress = (value: string) => EMAIL.test(value.trim());

export function validateRecipients(values: string[]) {
  return values.length > 0 && values.every(isValidEmailAddress);
}

export function validateComposeInput(value: unknown): ComposeSendInput {
  if (!value || typeof value !== "object") throw new Error("Invalid compose input");
  const body = value as Partial<ComposeSendInput>;
  if (!COMPOSE_MODES.includes(body.mode as ComposeMode)) throw new Error("Invalid mode");
  if (typeof body.box !== "string" || !body.box) throw new Error("box is required");
  if (body.mode !== "new" && (typeof body.sourceMessageId !== "string" || !body.sourceMessageId)) throw new Error("sourceMessageId is required");
  if (!Array.isArray(body.to) || !validateRecipients(body.to)) throw new Error("Valid recipients are required");
  if (!Array.isArray(body.cc) || !body.cc.every(isValidEmailAddress)) throw new Error("Invalid cc recipient");
  if (typeof body.subject !== "string" || !body.subject.trim()) throw new Error("subject is required");
  if (typeof body.bodyText !== "string") throw new Error("bodyText is required");
  return { mode: body.mode as ComposeMode, box: body.box, sourceMessageId: body.sourceMessageId, to: body.to.map((item) => item.trim()), cc: body.cc.map((item) => item.trim()), subject: body.subject.trim(), bodyText: body.bodyText };
}

export function recipientSuggestions(addresses: string[], query: string) {
  const prefix = query.trim().toLocaleLowerCase("en-US");
  const seen = new Set<string>();
  const unique = addresses.filter((address) => {
    const key = address.toLocaleLowerCase("en-US");
    if (!isValidEmailAddress(address) || seen.has(key)) return false;
    seen.add(key); return true;
  });
  return unique.filter((address) => !prefix || address.toLocaleLowerCase("en-US").startsWith(prefix));
}

export function replyAllRecipients(
  source: { fromAddress: string; to: string[]; cc: string[] },
  ownAddress: string | undefined,
) {
  const own = ownAddress?.trim().toLocaleLowerCase("en-US") ?? "";
  const seen = new Set<string>();
  const unique = (values: string[]) => values.filter((address) => {
    const normalized = address.trim().toLocaleLowerCase("en-US");
    if (!normalized || normalized === own || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
  const to = unique([source.fromAddress, ...source.to]);
  const cc = unique(source.cc);
  return { to, cc };
}

export function scheduleDelayedSend(
  draft: ComposeDraft,
  send: (draft: ComposeDraft) => Promise<void>,
  callbacks: { cancelled: (draft: ComposeDraft) => void; succeeded: () => void; failed: (draft: ComposeDraft) => void },
  delay = 10_000,
) {
  let pending = true;
  const timer = setTimeout(() => {
    if (!pending) return;
    pending = false;
    void send(draft).then(callbacks.succeeded).catch(() => callbacks.failed(draft));
  }, delay);
  return {
    cancel() {
      if (!pending) return false;
      pending = false;
      clearTimeout(timer);
      callbacks.cancelled(draft);
      return true;
    },
    dispose() {
      pending = false;
      clearTimeout(timer);
    },
  };
}
