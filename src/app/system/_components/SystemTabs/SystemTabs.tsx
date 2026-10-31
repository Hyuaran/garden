"use client";
import { Children, Fragment, isValidElement, type HTMLAttributes, type ReactNode } from "react";
import { SystemViewButton } from "../ViewPermissionButton/SystemViewContext";
import ViewPermissionButton from "../ViewPermissionButton/ViewPermissionButton";
import styles from "./system-tabs.module.css";

type Props = HTMLAttributes<HTMLDivElement> & {
  /** タブの行の右端に置く操作（並び替え・設定などの線画アイコン）。下線はタブと共通で右端まで続く */
  actions?: ReactNode;
  variant?: "text" | "icons";
  pageActions?: boolean;
  sortUnavailableReason?: string;
};

/** Shared panel navigation. Children retain their handlers, IDs and link destinations. */
export default function SystemTabs({ children, className, actions, variant = "text", pageActions = true, sortUnavailableReason = "この画面は並べ替えがありません", ...props }: Props) {
  const visible = Children.toArray(children);
  const hasTabs = visible.length > 1;
  const flatten = (nodes: ReactNode): ReactNode[] => Children.toArray(nodes).flatMap(node => isValidElement<{ children?: ReactNode }>(node) && node.type === Fragment ? flatten(node.props.children) : [node]);
  const actionNodes = flatten(actions);
  const hasAction = (node: ReactNode, kind: "sort" | "gear"): boolean => {
    if (!isValidElement<{ icon?: string; children?: ReactNode }>(node)) return false;
    if (kind === "gear" && (node.type === SystemViewButton || node.type === ViewPermissionButton)) return true;
    if (kind === "gear" && node.props.icon === "settings") return true;
    if (kind === "sort" && node.props.icon === "sort") return true;
    return Children.toArray(node.props.children).some(child => hasAction(child, kind));
  };
  const sort = actionNodes.filter(node => hasAction(node, "sort"));
  const rest = actionNodes.filter(node => !hasAction(node, "sort") && !hasAction(node, "gear"));
  const gears = actionNodes.filter(node => hasAction(node, "gear"));
  const gear = actionNodes.some(node => hasAction(node, "gear"));
  const tablist = hasTabs ? <div role="tablist" {...props} className={[styles.tabs, variant === "icons" ? styles.icons : "", styles.inRow, className].filter(Boolean).join(" ")}>{children}</div> : <div className={styles.spacer} />;
  if (!pageActions && !hasTabs && !actions) return null;
  return <div className={styles.row} data-system-tabs>{tablist}<div className={styles.actions}>{rest}{sort.length ? sort : pageActions && <TabActionButton icon="sort" label="並べ替え" disabled disabledReason={sortUnavailableReason} />}{gears}{pageActions && !gear && <SystemViewButton />}</div></div>;
}

/** タブの行の右端に置く線画アイコンのボタン（社長スタイル §2.5） */
export function TabActionButton({ label, pressed, icon, title, disabledReason, ...props }: Omit<HTMLAttributes<HTMLButtonElement>, "children"> & { label: string; pressed?: boolean; icon: "sort" | "settings" | "plus" | "help"; disabled?: boolean; disabledReason?: string }) {
  const button = <button type="button" {...props} className={styles.actionButton} aria-label={label} title={props.disabled && icon !== "help" ? undefined : title ?? label} aria-pressed={pressed}>
    {icon === "help" ? <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1-1.5 2.5M12 16.5h.01" /></svg> : icon === "plus" ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg> : icon === "sort"
      ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4v16M8 4 4.5 7.5M8 4l3.5 3.5M16 20V4M16 20l-3.5-3.5M16 20l3.5-3.5" /></svg>
      : <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>}
  </button>;
  return props.disabled ? <span className={styles.unavailable} tabIndex={0}>{button}<span className={styles.tooltip} role="tooltip">{disabledReason ?? title ?? label}</span></span> : button;
}
