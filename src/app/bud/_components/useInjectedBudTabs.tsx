"use client";
import { useLayoutEffect, useRef } from "react";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import { useUrlTab } from "@/app/system/_components/SystemTabs/useUrlTab";
import { SystemViewButton } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";

/** Read only the navigation; category chips and permission-filtered panels stay intact. */
export function useInjectedBudTabs(sourceHtml: string) {
  const nav = sourceHtml.match(/<nav\b[^>]*class=["'][^"']*\btab-nav\b[^"']*["'][^>]*>[\s\S]*?<\/nav>/i)?.[0] ?? "";
  const tabs = [...nav.matchAll(/<(button|a)\b([^>]*data-tab=["']([^"']+)["'][^>]*)>([\s\S]*?)<\/\1>/gi)].map(match => ({
    key: match[3],
    label: (match[4].match(/<span\b[^>]*class=["']tab-item-jp["'][^>]*>([\s\S]*?)<\/span>/)?.[1] ?? match[4]).replace(/<[^>]+>/g, "").trim(),
    badge: match[4].match(/<span\b[^>]*class=["'][^"']*tab-badge[^"']*["'][^>]*>([\s\S]*?)<\/span>/)?.[1].replace(/<[^>]+>/g, "").trim(),
  }));
  const [active, select] = useUrlTab(tabs[0]?.key ?? "", key => tabs.some(tab => tab.key === key));
  const selected = tabs.some(tab => tab.key === active) ? active : tabs[0]?.key ?? "";
  const root = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const node = root.current;
    if (!node || !selected) return;
    node.querySelectorAll<HTMLElement>(".tab-content[id]").forEach(panel => panel.classList.toggle("active", panel.id === "tab-" + selected));
  }, [sourceHtml, selected]);
  return {
    root,
    html: nav ? sourceHtml.replace(nav, "") : sourceHtml,
    count: tabs.length,
    headingAction: <SystemViewButton tabKey={selected} />,
    navigation: <SystemTabs aria-label="表示切替" actions={<SystemViewButton tabKey={selected} />}>{tabs.map(tab => <button key={tab.key} type="button" role="tab" data-tab={tab.key} aria-selected={selected === tab.key} onClick={() => select(tab.key)}>{tab.label}{tab.badge && <span>{tab.badge}</span>}</button>)}</SystemTabs>,
  };
}
