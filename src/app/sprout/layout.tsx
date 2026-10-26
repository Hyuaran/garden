/**
 * Garden-Sprout モジュール共通レイアウト (2026-05-11、Task 3)
 *
 * /sprout 配下に共通の閲覧判定を適用。設定がなければ staff 以上の入口を維持。
 *
 * 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 3 §Step 3-7
 */

import type { ReactNode } from "react";

import { redirect } from "next/navigation";
import { canViewRecruitMail } from "@/lib/auth/sprout-rill-view.server";
import { viewPermissionContext } from "@/lib/auth/view-permission.server";
import { SproutNavigation } from "./view-navigation";

export const metadata = {
  title: "Garden-Sprout — 採用",
};

export default async function SproutLayout({ children }: { children: ReactNode }) {
  await viewPermissionContext();
  const value = Object.fromEntries(await Promise.all(["sprout-applicants", "sprout-postings"].map(async page => [page, await canViewRecruitMail(page, undefined, true)])));
  if (!Object.values(value).some(Boolean)) redirect("/access-denied?module=sprout");
  return <SproutNavigation value={value}>{children}</SproutNavigation>;
}
