export const MAX_NOTICE_PAGES = 20;

export type NoticePageInput = { base64: string };

export function assertNoticeKind(kind: unknown): asserts kind is "周知" {
  if (kind !== "周知") throw new Error("Only 周知 intake is supported");
}

export function noticeFallbackText(sender: string, pageCount: number) {
  return `FAXが届きました。\n送信元：${sender.trim() || "不明"}\n${pageCount}枚\n\n内容をご確認ください。`;
}

export function noticeDraftText(sender: string, pageCount: number, summary?: string | null) {
  const fallback = noticeFallbackText(sender, pageCount);
  const cleaned = summary?.trim();
  return cleaned ? `${fallback}\n\n内容の要点：\n${cleaned}` : fallback;
}

export function limitNoticePages(value: unknown) {
  if (!Array.isArray(value)) return { pages: [] as NoticePageInput[], truncated: false };
  const valid = value.filter((page): page is NoticePageInput => {
    if (!page || typeof page !== "object") return false;
    const base64 = (page as { base64?: unknown }).base64;
    return typeof base64 === "string" && /^(?:data:image\/png;base64,)?[A-Za-z0-9+/=]+$/.test(base64);
  });
  return { pages: valid.slice(0, MAX_NOTICE_PAGES), truncated: valid.length > MAX_NOTICE_PAGES };
}

export function noticeStoragePath(intakeId: string, receivedAt: string, page: number) {
  const date = new Date(receivedAt);
  if (!Number.isFinite(date.getTime()) || !/^[-0-9a-f]{36}$/i.test(intakeId) || page < 1 || !Number.isInteger(page)) {
    throw new Error("Invalid notice storage path input");
  }
  return `shuchi/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${intakeId}_p${page}.png`;
}

export function noticeDriveNames(basePdfName: string, pageCount: number) {
  const base = basePdfName.replace(/\.[A-Za-z0-9]{1,10}$/i, "");
  return {
    pages: Array.from({ length: pageCount }, (_, index) => `${base}_p${index + 1}.png`),
    text: `${base}_周知文.txt`,
  };
}

export function decodeNoticePng(value: string) {
  return Buffer.from(value.replace(/^data:image\/png;base64,/, ""), "base64");
}
