export const INTAKE_KINDS = ["請求", "入金", "条件", "周知"] as const;
export type IntakeKind = typeof INTAKE_KINDS[number];

export type IntakeItem = {
  id: string;
  kind: IntakeKind;
  attachment_id: string;
  created_by_name: string;
  created_at: string;
  notice_saved: boolean;
};

export function isIntakeKind(value: unknown): value is IntakeKind {
  return typeof value === "string" && INTAKE_KINDS.includes(value as IntakeKind);
}

// Supabase Storage のオブジェクトキーは非ASCII文字（日本語など）を受け付けない
// （実機で "Invalid key: 周知/..." を実測）。フォルダは英字スラッグ、ファイル名は
// id+拡張子のみとし、元のファイル名は garden_intake_items.file_name 側に保持する。
const KIND_SLUGS: Record<IntakeKind, string> = { 請求: "seikyu", 入金: "nyukin", 条件: "joken", 周知: "shuchi" };

export function intakeStoragePath(kind: IntakeKind, date: Date, id: string, fileName: string) {
  const extension = (/\.[A-Za-z0-9]{1,10}$/.exec(fileName)?.[0] ?? "").toLowerCase();
  return `${KIND_SLUGS[kind]}/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${id}${extension}`;
}

export function isDuplicateIntakeError(error: { code?: string } | null | undefined) {
  return error?.code === "23505";
}

export function intakeItemFromPost(status: number, item: IntakeItem | undefined) {
  return (status >= 200 && status < 300) || status === 409 ? item ?? null : null;
}

export function intakeMarks(items: IntakeItem[]) {
  return new Map(items.map((item) => [item.attachment_id, {
    kind: item.kind,
    complete: item.kind !== "周知" || item.notice_saved,
    label: item.kind === "周知" && !item.notice_saved ? "周知 未完" : `${item.kind} 済`,
    title: `${item.created_by_name}・${new Date(item.created_at).toLocaleString("ja-JP")}`,
  }]));
}

export function intakeButtonLabel(item: IntakeItem | undefined) {
  if (!item) return "Garden取込実行";
  return item.kind === "周知" && !item.notice_saved ? "周知を続ける" : "取込済";
}
