"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SystemViewButton, useSystemView } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";

/** 旧 HTML のタブ列にも共通の閲覧設定ボタンを配置する。 */
export function BudViewChrome({ children, tabKey }: { children: ReactNode; tabKey?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const { state } = useSystemView();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState(tabKey ?? "");
  useEffect(() => {
    const node = root.current;
    if (!node || !state || node.querySelector("[data-bud-managed-tabs]")) return;
    const update = () => {
      if (node.querySelector("[data-bud-managed-tabs]")) { setSlot(null); return; }
      const nav = node.querySelector<HTMLElement>(".tab-nav, [role=tablist]");
      const heading = node.querySelector<HTMLElement>("h1");
      const parent = nav ?? heading?.parentElement;
      if (!parent) return;
      if (parent.closest("[data-bud-view-root]") !== node) return;
      let target = parent.querySelector<HTMLElement>(":scope > [data-bud-view-settings]");
      if (!target) {
        target = document.createElement("span");
        target.dataset.budViewSettings = "true";
        target.style.marginLeft = "auto";
        target.style.display = "inline-flex";
        parent.append(target);
      }
      setSlot(current => current === target ? current : target);
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
  return <div ref={root} data-bud-view-root>{children}{slot && createPortal(<SystemViewButton tabKey={active} />, slot)}</div>;
}

export function BudViewTab({ tabKey, children }: { tabKey: string; children: ReactNode }) {
  const { allowedTab } = useSystemView();
  return allowedTab(tabKey) ? children : null;
}
