"use client";
import { useSyncExternalStore } from "react";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import styles from "./ScopedTabs.module.css";
import { SystemViewButton, useSystemView } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
type Item = { key: string; label: string };
function subscribeUrlTab(read: () => void) {
  window.addEventListener("popstate", read);
  window.addEventListener("garden-tab-change", read);
  return () => {
    window.removeEventListener("popstate", read);
    window.removeEventListener("garden-tab-change", read);
  };
}
function readSearch() { return window.location.search; }
function serverSearch() { return ""; }

/** Keep tab navigation reloadable without adding a Suspense boundary to static pages. */
export function useUrlTab<T extends string>(fallback: T) {
  const search = useSyncExternalStore(subscribeUrlTab, readSearch, serverSearch);
  const tab = (new URLSearchParams(search).get("tab") || fallback) as T;
  const select = (value: T) => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", value);
    window.history.pushState(null, "", url);
    window.dispatchEvent(new Event("garden-tab-change"));
  };
  return [tab, select] as const;
}
export function TabHeadingAction({ items, active }: { items: Item[]; active?: string }) {
  const { allowedTab } = useSystemView();
  if (items.filter(item => allowedTab(item.key)).length > 1) return null;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><SystemViewButton tabKey={active} /></span>;
}
export default function ScopedTabs({ items, active, onChange, label }: { items: Item[]; active?: string; onChange: (key: string) => void; label: string }) {
  const { allowedTab } = useSystemView();
  const visible = items.filter(item => allowedTab(item.key));
  if (visible.length <= 1) return null;
  return <div className={styles.scoped}><SystemTabs aria-label={label} actions={<SystemViewButton tabKey={active} />}>
    {visible.map(item => <button key={item.key} type="button" role="tab" aria-selected={active === item.key} onClick={() => onChange(item.key)}>{item.label}</button>)}
  </SystemTabs></div>;
}
