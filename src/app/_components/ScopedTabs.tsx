"use client";
import { useSyncExternalStore } from "react";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import styles from "./ScopedTabs.module.css";
import { SystemViewButton, useSystemView } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
type Item = { key: string; label: string };
export { useUrlTab } from "@/app/system/_components/SystemTabs/useUrlTab";
export function TabHeadingAction({ items, active }: { items: Item[]; active?: string }) {
  return null;
}
export default function ScopedTabs({ items, active, onChange, label }: { items: Item[]; active?: string; onChange: (key: string) => void; label: string }) {
  const { allowedTab } = useSystemView();
  const visible = items.filter(item => allowedTab(item.key));
  return <div className={styles.scoped}><SystemTabs aria-label={label} actions={<SystemViewButton tabKey={active} />}>
    {visible.map(item => <button key={item.key} type="button" role="tab" aria-selected={active === item.key} onClick={() => onChange(item.key)}>{item.label}</button>)}
  </SystemTabs></div>;
}
