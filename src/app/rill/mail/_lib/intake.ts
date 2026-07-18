export const INTAKE_KINDS = ["請求", "入金", "条件", "周知"] as const;
export type IntakeKind = typeof INTAKE_KINDS[number];

export type IntakeItem = {
  id: string;
  kind: IntakeKind;
  attachment_id: string;
  created_by_name: string;
  created_at: string;
};

export function isIntakeKind(value: unknown): value is IntakeKind {
  return typeof value === "string" && INTAKE_KINDS.includes(value as IntakeKind);
}

export function intakeStoragePath(kind: IntakeKind, date: Date, id: string, fileName: string) {
  const safeName = fileName.replace(/[\\/\u0000-\u001f]/g, "_").replace(/^\.+/, "").replace(/_+/g, "_").replace(/^_+/, "") || "attachment";
  return `${kind}/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${id}_${safeName}`;
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
    label: `${item.kind} 済`,
    title: `${item.created_by_name}・${new Date(item.created_at).toLocaleString("ja-JP")}`,
  }]));
}
