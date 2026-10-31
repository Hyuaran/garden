"use client";
import { Children, isValidElement, createContext, useContext, type ReactNode } from "react";
import HelpButton from "../HelpButton/HelpButton";
import ViewPermissionButton from "./ViewPermissionButton";
import styles from "./view-permission.module.css";

type State = { pageKey: string; admin: boolean; tabs: { key: string; label: string; allowed: boolean; canAdd: boolean }[]; canAdd: boolean };
const Context = createContext<State | null>(null);
export function SystemViewProvider({ value, children }: { value: State; children: ReactNode }) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useSystemView() {
  const state = useContext(Context);
  return { state, allowedTab: (key: string, defaultAllowed = true) => state?.tabs.find(tab => tab.key === key)?.allowed ?? defaultAllowed };
}
export function SystemViewButton({ tabKey = "" }: { tabKey?: string }) {
  const state = useContext(Context);
  if (!state) return null;
  const tab = state.tabs.find(tab => tab.key === tabKey);
  if (!state.admin && !(tab?.canAdd ?? state.canAdd)) return null;
  return <ViewPermissionButton key={`${state.pageKey}:${tabKey}`} pageKey={state.pageKey} tabKey={tabKey} tabLabel={tab?.label ?? ""} admin={state.admin} canAdd={tab?.canAdd ?? state.canAdd} />;
}
export function SystemViewHeading({ children }: { children: ReactNode; actions?: ReactNode; showActions?: boolean }) {
  return <div className={styles.headingRow}>{Children.map(children, child => isValidElement(child) && child.type === "h1" ? <>{child}<HelpButton /></> : child)}</div>;
}
