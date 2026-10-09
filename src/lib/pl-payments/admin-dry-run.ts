import { isRoleAtLeast } from "@/app/root/_constants/types";
import { requireCallAccess } from "@/lib/innovera/calls.server";

/**
 * 管理者以上がログインしていれば true（損益の見張りのドライランを本番で見るため・2026-10-09）。
 * 書き込みを伴う本運転は cron の合言葉（CRON_SECRET）だけで動かす。
 */
export async function allowAdminDryRun(): Promise<boolean> {
  try {
    const ctx = await requireCallAccess();
    return isRoleAtLeast(ctx.role, "admin");
  } catch {
    return false;
  }
}
