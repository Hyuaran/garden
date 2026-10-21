"use client";

import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";

import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import PageHeader from "@/app/_components/layout/GardenShell/PageHeader";

import { useBudState } from "../../_state/BudStateContext";
import { BudGate } from "../../_components/BudGate";

import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import expenseStyles from "../expenses.module.css";

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
        <div className={`${expenseStyles.pageStack} ${expenseStyles.pageShell}`}>
          <SystemBreadcrumb root={{ label: "Bud", href: "/bud/dashboard" }} items={[{ label: "経費精算" }]} />
          <PageHeader
            title={title}
            accessBadge={{ label: formatBudRoleLabel(budRole) }}
            moduleMark="bud"
            favoriteIcon={BUD_ICON}
          />
          {topSlot ? <div className={expenseStyles.topSlot}>{topSlot}</div> : null}
          <style dangerouslySetInnerHTML={{ __html: sourceCss }} />
          <main
            ref={bindTabClick}
            className={expenseStyles.htmlPort}
            data-bud-port={route}
            onClick={handleTabClick}
            {...CLARITY_MASK}
            >
            <SystemTabs className="tab-nav" dangerouslySetInnerHTML={{ __html: sourceHtml.slice(sourceHtml.indexOf(">") + 1, sourceHtml.indexOf("</nav>")) }} />
            <div dangerouslySetInnerHTML={{ __html: sourceHtml.slice(sourceHtml.indexOf("</nav>") + 6) }} />
          </main>
          {children}
        </div>
    </BudGate>
  );
}
