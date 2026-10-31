"use client";

import HelpButton from "@/app/system/_components/HelpButton/HelpButton";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import { SystemViewButton } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { colors } from "../_constants/colors";
import styles from "./root-shell.module.css";

export function PageHeader({ title, actions, titleAddon }: { title: string; description?: string; actions?: ReactNode; titleAddon?: ReactNode }) {
  const pathname = usePathname();
  return (
    <><div className={styles.pageHeader} style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
      <div className={styles.pageHeaderText} style={{ minWidth: 0 }}>
        <SystemBreadcrumb root={{ label: "Root", href: "/root" }} items={pathname === "/root" ? [] : [{ label: title }]} />
        <div className="garden-help-heading"><h1 style={{ fontSize: 30, fontWeight: 700, margin: 0, color: colors.heading, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {title}
          {titleAddon}
        </h1><HelpButton /></div>
      </div>
      <div className={styles.pageHeaderActions} style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>{actions}</div>
    </div><SystemTabs actions={<SystemViewButton />} /></>
  );
}
