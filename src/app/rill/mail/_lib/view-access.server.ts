import "server-only";
import { canViewRecruitMail } from "@/lib/auth/sprout-rill-view.server";
import { SPROUT_RILL_TABS, rillBoxTab } from "@/lib/auth/sprout-rill-view-scopes";
import { ViewPermissionError } from "@/lib/auth/view-permission.server";
import { requireGardenUser, RillMailHttpError } from "./server-auth";
import { viewPermissionContext } from "@/lib/auth/view-permission.server";

export async function requireRillRead(box?: string) {
  try {
    if (!await canViewRecruitMail("rill-mail", box && ["all", "flagged", "me", "sent"].includes(box) ? rillBoxTab(box) : undefined)) throw new RillMailHttpError(403, "閲覧権限がありません");
    const tabs = await Promise.all(SPROUT_RILL_TABS["rill-mail"].map(async ([key]) => await canViewRecruitMail("rill-mail", key) ? key : ""));
    return { ...await requireGardenUser(), readTabs: tabs.filter(Boolean) };
  } catch (error) {
    if (error instanceof ViewPermissionError) throw new RillMailHttpError(error.status, error.message);
    throw error;
  }
}

/** 閲覧設定で追加された人に、従来 admin 以上の操作権限を付与しない。 */
export async function requireRillWrite() {
  try {
    const { viewer } = await viewPermissionContext();
    if (!["admin", "super_admin"].includes(viewer.role)) throw new RillMailHttpError(403, "操作する権限がありません");
    return requireGardenUser();
  } catch (error) {
    if (error instanceof ViewPermissionError) throw new RillMailHttpError(error.status, error.message);
    throw error;
  }
}
