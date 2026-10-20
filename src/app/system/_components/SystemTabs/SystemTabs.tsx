"use client";
import type { HTMLAttributes } from "react";
import styles from "./system-tabs.module.css";

/** Shared panel navigation. Children retain their handlers, IDs and link destinations. */
export default function SystemTabs({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div role="tablist" {...props} className={[styles.tabs, className].filter(Boolean).join(" ")}>{children}</div>;
}
