"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SystemViewButton, useSystemView } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
import HelpButton from "@/app/system/_components/HelpButton/HelpButton";
import SystemTabs, { TabActionButton } from "@/app/system/_components/SystemTabs/SystemTabs";
import styles from "@/app/system/_components/SystemTabs/system-tabs.module.css";

/** 旧 HTML のタブ列にも共通の閲覧設定ボタンを配置する。 */
export function BudViewChrome({ children, tabKey }: { children: ReactNode; tabKey?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const { state } = useSystemView();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState(tabKey ?? "");
  const [helpSlot, setHelpSlot] = useState<HTMLElement | null>(null);
  const [hasNav, setHasNav] = useState(false);
  useEffect(() => {
    const node = root.current;
    if (!node || !state || node.querySelector("[data-bud-managed-tabs], [data-system-tabs]")) return;
    const update = () => {
      if (node.querySelector("[data-bud-managed-tabs]")) { setSlot(null); return; }
      const nav = node.querySelector<HTMLElement>(".tab-nav, [role=tablist]");
      const heading = node.querySelector<HTMLElement>("h1");
      const parent = nav?.parentElement ?? heading?.closest("header") ?? heading?.parentElement;
      if (!parent) return;
      if (parent.closest("[data-bud-view-root]") !== node) return;
      if (heading && !heading.parentElement?.querySelector("[data-garden-help]")) {
        let help = heading.parentElement?.querySelector<HTMLElement>("[data-bud-help]");
        if (!help) { help = document.createElement("span"); help.dataset.budHelp = "true"; heading.after(help); }
        setHelpSlot(current => current === help ? current : help);
      }
      let target = node.querySelector<HTMLElement>("[data-bud-view-settings]");
      if (!target) {
        target = document.createElement("div");
        target.dataset.budViewSettings = "true";
        if (nav) {
          const row = document.createElement("div");
          row.className = styles.row;
          nav.before(row); row.append(nav, target);
          nav.classList.add(styles.tabs, styles.inRow);
          target.className = styles.actions;
        } else if (parent === node) { heading?.after(target); } else { parent.after(target); }
      }
      setSlot(current => current === target ? current : target);
      setHasNav(Boolean(nav));
      const selected = nav?.querySelector<HTMLElement>("[data-tab].active, [data-tab][aria-selected=true]")?.dataset.tab;
      if (selected) setActive(selected);
      else {
        const first = nav?.querySelector<HTMLElement>(".tab-item[data-tab]");
        if (first?.dataset.tab) {
          first.classList.add("active");
          first.setAttribute("aria-selected", "true");
          node.querySelector<HTMLElement>(`#tab-${first.dataset.tab}`)?.classList.add("active");
          setActive(first.dataset.tab);
        }
      }
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(node, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "aria-selected"] });
    return () => observer.disconnect();
  }, [state]);
  return <div ref={root} data-bud-view-root>{children}{helpSlot && createPortal(<HelpButton />, helpSlot)}{slot && createPortal(hasNav ? <><TabActionButton icon="sort" label="並べ替え" disabled disabledReason="この画面は並べ替えがありません" /><SystemViewButton tabKey={active} /></> : <SystemTabs actions={<SystemViewButton tabKey={active} />} />, slot)}</div>;
}

export function BudViewTab({ tabKey, children }: { tabKey: string; children: ReactNode }) {
  const { allowedTab } = useSystemView();
  return allowedTab(tabKey) ? children : null;
}
