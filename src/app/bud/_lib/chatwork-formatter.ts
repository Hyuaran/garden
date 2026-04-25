import type { TransferStatus } from "../_constants/types";

export interface TransferNotifyContext {
  transferId: string;
  payeeName: string;
  amount: number;
  fromStatus?: TransferStatus | null;
  toStatus: TransferStatus;
  reason?: string | null;
  actorName?: string | null;
}

const GARDEN_URL_NOTE =
  "詳細は Garden にログインして確認してください: /bud/transfers/";

export function formatApprovedMessage(ctx: TransferNotifyContext): string {
  const lines = [
    "[info][title]✓ 振込が承認されました[/title]",
    `振込ID: ${ctx.transferId}`,
    `お支払い先: ${ctx.payeeName}`,
    `金額: ¥${ctx.amount.toLocaleString()}`,
  ];
  if (ctx.actorName) lines.push(`承認者: ${ctx.actorName}`);
  lines.push(`${GARDEN_URL_NOTE}${ctx.transferId}`);
  lines.push("[/info]");
  return lines.join("\n");
}

export function formatRejectedMessage(ctx: TransferNotifyContext): string {
  const reason = ctx.reason?.trim() || "（理由未記入）";
  const lines = [
    "[info][title]✗ 振込が差戻されました[/title]",
    `振込ID: ${ctx.transferId}`,
    `お支払い先: ${ctx.payeeName}`,
    `金額: ¥${ctx.amount.toLocaleString()}`,
    `理由: ${reason}`,
  ];
  if (ctx.actorName) lines.push(`差戻し者: ${ctx.actorName}`);
  lines.push(`${GARDEN_URL_NOTE}${ctx.transferId}`);
  lines.push("[/info]");
  return lines.join("\n");
}

export interface BatchNotifyContext {
  transferIds: string[];
  toStatus: TransferStatus;
  reason?: string | null;
  actorName?: string | null;
}

export function formatBatchApprovedMessage(ctx: BatchNotifyContext): string {
  const lines = [
    "[info][title]✓ 振込が一括承認されました[/title]",
    `件数: ${ctx.transferIds.length} 件`,
    `対象 ID:`,
    ...ctx.transferIds.slice(0, 20).map((id) => `  - ${id}`),
  ];
  if (ctx.transferIds.length > 20) {
    lines.push(`  ... 他 ${ctx.transferIds.length - 20} 件`);
  }
  if (ctx.actorName) lines.push(`承認者: ${ctx.actorName}`);
  lines.push(`詳細は Garden /bud/transfers にログインして確認してください`);
  lines.push("[/info]");
  return lines.join("\n");
}

export function formatBatchRejectedMessage(ctx: BatchNotifyContext): string {
  const reason = ctx.reason?.trim() || "（理由未記入）";
  const lines = [
    "[info][title]✗ 振込が一括差戻されました[/title]",
    `件数: ${ctx.transferIds.length} 件`,
    `理由: ${reason}`,
    `対象 ID:`,
    ...ctx.transferIds.slice(0, 20).map((id) => `  - ${id}`),
  ];
  if (ctx.transferIds.length > 20) {
    lines.push(`  ... 他 ${ctx.transferIds.length - 20} 件`);
  }
  if (ctx.actorName) lines.push(`差戻し者: ${ctx.actorName}`);
  lines.push(`詳細は Garden /bud/transfers にログインして確認してください`);
  lines.push("[/info]");
  return lines.join("\n");
}
