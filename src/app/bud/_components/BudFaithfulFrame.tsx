"use client";
import { useInjectedBudTabs } from "./useInjectedBudTabs";

import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";

import type { ReactNode } from "react";

import { useSystemView } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
import { filterBudViewHtml } from "@/lib/auth/bud-view-html";
import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import PageHeader from "@/app/_components/layout/GardenShell/PageHeader";

import { useBudState } from "../_state/BudStateContext";
import { BudGate } from "./BudGate";
import styles from "./BudFaithfulFrame.module.css";

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
  titleJp,
  subtitle,
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
        <div data-bud-managed-tabs className={styles.pageStack}>
          <SystemBreadcrumb root={{ label: "Bud", href: "/bud/dashboard" }} items={[{ label: title }]} />
          <PageHeader
            titleAddon={injected.count <= 1 ? injected.headingAction : undefined}
            title={title}
            titleJp={titleJp}
            subtitle={subtitle}
            accessBadge={{ icon: route === "/bud/expenses" ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m3 6 4 4 5-6 5 6 4-4-2 12H5Z M5 21h14" /></svg> : "♕", label: formatBudRoleLabel(budRole) }}
            moduleMark="bud"
            outlineFavorite={route === "/bud/expenses"}
            favoriteIcon={BUD_ICON}
          />
          {topSlot ? <div className={styles.topSlot}>{topSlot}</div> : null}
          <style dangerouslySetInnerHTML={{ __html: sourceCss }} />
          {injected.navigation}
          <main
            ref={injected.root}
            className={styles.htmlPort}
            data-bud-port={route}
            {...CLARITY_MASK}
            dangerouslySetInnerHTML={{ __html: injected.html }}
          />
          {children}
        </div>
    </BudGate>
  );
}
