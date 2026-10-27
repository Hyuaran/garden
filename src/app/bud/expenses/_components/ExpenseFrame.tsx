"use client";
import { useInjectedBudTabs } from "../../_components/useInjectedBudTabs";

import type { ReactNode } from "react";

import { useSystemView } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
import { filterBudViewHtml } from "@/lib/auth/bud-view-html";
import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import PageHeader from "@/app/_components/layout/GardenShell/PageHeader";

import { useBudState } from "../../_state/BudStateContext";
import { BudGate } from "../../_components/BudGate";

import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import expenseStyles from "../expenses.module.css";

const BUD_ICON = "/themes/garden-shell/images/icons_bloom/orb_bud.png";
export function formatBudRoleLabel(role: string | null): string {
  if (role === "admin") return "全権管理 + 経理担当";
  if (role === "approver") return "承認者 + 経理担当";
  if (role === "staff") return "経理担当";
  return "Bud";
}

type BudFaithfulFrameProps = {
  route: string;
  title: string;
  titleJp: string;
  subtitle: string;
  sourceCss: string;
  sourceHtml: string;
  topSlot?: ReactNode;
  children?: ReactNode;
};

export function BudFaithfulFrame({
  route,
  title,
  sourceCss,
  sourceHtml,
  topSlot,
  children,
}: BudFaithfulFrameProps) {
  const { budRole } = useBudState();
  const { state } = useSystemView();
  sourceHtml = filterBudViewHtml(sourceHtml, state?.tabs ?? []);

  const injected = useInjectedBudTabs(sourceHtml);

  return (
    <BudGate>
        <div data-bud-managed-tabs className={`${expenseStyles.pageStack} ${expenseStyles.pageShell}`}>
          <SystemBreadcrumb root={{ label: "Bud", href: "/bud/dashboard" }} items={[{ label: "経費精算" }]} />
          <PageHeader
            titleAddon={injected.count <= 1 ? injected.headingAction : undefined}
            title={title}
            accessBadge={{ label: formatBudRoleLabel(budRole) }}
            moduleMark="bud"
            favoriteIcon={BUD_ICON}
          />
          {topSlot ? <div className={expenseStyles.topSlot}>{topSlot}</div> : null}
          <style dangerouslySetInnerHTML={{ __html: sourceCss }} />
          <main
            ref={injected.root}
            className={expenseStyles.htmlPort}
            data-bud-port={route}
            {...CLARITY_MASK}
            >
            {injected.navigation}
            <div dangerouslySetInnerHTML={{ __html: injected.html }} />
          </main>
          {children}
        </div>
    </BudGate>
  );
}
