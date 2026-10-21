"use client";

import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";

import type { ReactNode } from "react";

import PageHeader from "@/app/_components/layout/GardenShell/PageHeader";

import { useBudState } from "../_state/BudStateContext";
import { BudGate } from "./BudGate";
import { formatBudRoleLabel } from "./BudFaithfulFrame";
import styles from "./BudFaithfulFrame.module.css";

const BUD_ICON = "/themes/garden-shell/images/icons_bloom/orb_bud.png";

type BudGardenFrameProps = {
  route: string;
  title: string;
  titleJp: string;
  subtitle: string;
  children: ReactNode;
};

export function BudGardenFrame({
  route,
  title,
  titleJp,
  subtitle,
  children,
}: BudGardenFrameProps) {
  const { budRole } = useBudState();

  return (
    <BudGate>
        <div className={styles.pageStack}>
          <SystemBreadcrumb root={{ label: "Bud", href: "/bud/dashboard" }} items={[{ label: title }]} />
          <PageHeader
            title={title}
            titleJp={titleJp}
            subtitle={subtitle}
            accessBadge={{ icon: "♕", label: formatBudRoleLabel(budRole) }}
            moduleMark="bud"
            favoriteIcon={BUD_ICON}
          />
          {children}
        </div>
    </BudGate>
  );
}
