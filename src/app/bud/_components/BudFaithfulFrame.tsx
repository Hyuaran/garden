"use client";

import { useEffect } from "react";

import GardenShell from "@/app/_components/layout/GardenShell/GardenShell";
import PageHeader from "@/app/_components/layout/GardenShell/PageHeader";

import { budActivityItems } from "../dashboard/mock-data";
import { useBudState } from "../_state/BudStateContext";
import { BudGate } from "./BudGate";
import { getBudGardenPageMenu } from "./bud-garden-menu";
import styles from "./BudFaithfulFrame.module.css";

const BUD_ICON = "/themes/garden-shell/images/icons_bloom/orb_bud.png";

function formatRoleLabel(role: string | null): string {
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
};

export function BudFaithfulFrame({
  route,
  title,
  titleJp,
  subtitle,
  sourceCss,
  sourceHtml,
}: BudFaithfulFrameProps) {
  const { sessionUser, signOut, budRole } = useBudState();
  const userName = sessionUser?.name ?? "東海林 美琴";

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(`[data-bud-port="${route}"]`);
    if (!root) return;

    const tabs = Array.from(root.querySelectorAll<HTMLElement>(".tab-item[data-tab]"));
    const contents = Array.from(root.querySelectorAll<HTMLElement>(".tab-content[id]"));

    const handleClick = (event: Event) => {
      const tab = event.currentTarget as HTMLElement;
      const target = tab.dataset.tab;
      if (!target) return;

      tabs.forEach((item) => {
        item.classList.toggle("active", item === tab);
        item.setAttribute("aria-selected", item === tab ? "true" : "false");
      });

      contents.forEach((content) => {
        content.classList.toggle("active", content.id === `tab-${target}`);
      });
    };

    tabs.forEach((tab, index) => {
      tab.setAttribute("type", "button");
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", tab.classList.contains("active") || index === 0 ? "true" : "false");
      tab.addEventListener("click", handleClick);
    });

    return () => {
      tabs.forEach((tab) => tab.removeEventListener("click", handleClick));
    };
  }, [route, sourceHtml]);

  return (
    <BudGate>
      <GardenShell
        activeModule="bud"
        pageMenu={getBudGardenPageMenu(route)}
        activityItems={budActivityItems}
        userName={userName}
        userEmail={sessionUser?.employee_number ? `${sessionUser.employee_number}@garden.local` : null}
        userRoleLabel={formatRoleLabel(budRole)}
        onLogout={signOut}
      >
        <div className={styles.pageStack}>
          <PageHeader
            title={title}
            titleJp={titleJp}
            subtitle={subtitle}
            accessBadge={{ icon: "♕", label: formatRoleLabel(budRole) }}
            moduleMark="bud"
            favoriteIcon={BUD_ICON}
          />
          <style dangerouslySetInnerHTML={{ __html: sourceCss }} />
          <main
            className={styles.htmlPort}
            data-bud-port={route}
            dangerouslySetInnerHTML={{ __html: sourceHtml }}
          />
        </div>
      </GardenShell>
    </BudGate>
  );
}
