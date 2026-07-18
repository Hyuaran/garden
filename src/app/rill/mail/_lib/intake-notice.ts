export const MAX_NOTICE_PAGES = 20;

export type NoticePageInput = { base64: string };

export function assertNoticeKind(kind: unknown): asserts kind is "周知" {
  if (kind !== "周知") throw new Error("Only 周知 intake is supported");
}

export function noticeTemplate(pageCount: number, salesPerson = "", projectName = "") {
  return `FAX${pageCount}枚到着のため、ご確認ください。\n営業担当：${salesPerson}\n案件名：${projectName}`;
}

export function noticeTemplateFields(value: string) {
  return {
    salesPerson: /^営業担当：(.*)$/m.exec(value)?.[1]?.trim() ?? "",
    projectName: /^案件名：(.*)$/m.exec(value)?.[1]?.trim() ?? "",
  };
}

export type NoticeProgress =
  | { stage: "intake" | "reading" | "saving" }
  | { stage: "converting"; done: number; total: number }
  | null;

export type NoticeProgressEvent =
  | { type: "intake" | "reading" | "saving" }
  | { type: "converting"; done: number; total: number }
  | { type: "complete" | "cancel" };

export function reduceNoticeProgress(_current: NoticeProgress, event: NoticeProgressEvent): NoticeProgress {
  if (event.type === "complete" || event.type === "cancel") return null;
  if (event.type === "converting") return { stage: event.type, done: event.done, total: event.total };
  return { stage: event.type };
}

export function noticeProgressLabel(progress: Exclude<NoticeProgress, null>) {
  if (progress.stage === "converting") return `画像に変換中… ${progress.done}/${progress.total}枚`;
  if (progress.stage === "reading") return "内容を読み取り中…";
  if (progress.stage === "saving") return "保存中…";
  return "取り込み中…";
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
