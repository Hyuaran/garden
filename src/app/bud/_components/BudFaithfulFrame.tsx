"use client";

import type { MouseEvent as ReactMouseEvent } from "react";

import GardenShell from "@/app/_components/layout/GardenShell/GardenShell";
import PageHeader from "@/app/_components/layout/GardenShell/PageHeader";

import { budActivityItems } from "../dashboard/mock-data";
import { useBudState } from "../_state/BudStateContext";
import { BudGate } from "./BudGate";
import { getBudGardenPageMenu } from "./bud-garden-menu";
import styles from "./BudFaithfulFrame.module.css";

const BUD_ICON = "/themes/garden-shell/images/icons_bloom/orb_bud.png";
const nativeTabRoots = new WeakSet<HTMLElement>();

function activateInjectedTab(root: HTMLElement, eventTarget: EventTarget | null): boolean {
  const targetElement =
    eventTarget instanceof Element ? eventTarget : eventTarget instanceof Node ? eventTarget.parentElement : null;
  const tab = targetElement?.closest<HTMLElement>(".tab-item[data-tab]");
  if (!tab || !root.contains(tab)) return false;

  const target = tab.dataset.tab;
  if (!target) return false;

  const tabs = Array.from(root.querySelectorAll<HTMLElement>(".tab-item[data-tab]"));
  const contents = Array.from(root.querySelectorAll<HTMLElement>(".tab-content[id]"));

  tabs.forEach((item) => {
    const selected = item === tab;
    item.classList.toggle("active", selected);
    item.setAttribute("aria-selected", selected ? "true" : "false");
  });

  contents.forEach((content) => {
    content.classList.toggle("active", content.id === `tab-${target}`);
  });

  return true;
}

function handleNativeTabClick(event: globalThis.MouseEvent) {
  if (activateInjectedTab(event.currentTarget as HTMLElement, event.target)) {
    event.preventDefault();
  }
}

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

  const bindTabClick = (node: HTMLElement | null) => {
    if (!node || nativeTabRoots.has(node)) return;
    node.addEventListener("click", handleNativeTabClick);
    nativeTabRoots.add(node);
  };

  const handleTabClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (activateInjectedTab(event.currentTarget, event.target)) {
      event.preventDefault();
    }
  };

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
            ref={bindTabClick}
            className={styles.htmlPort}
            data-bud-port={route}
            onClick={handleTabClick}
            dangerouslySetInnerHTML={{ __html: sourceHtml }}
          />
        </div>
      </GardenShell>
    </BudGate>
  );
}
