"use client";

import type { ReactNode } from "react";

import GardenShell from "@/app/_components/layout/GardenShell/GardenShell";
import PageHeader from "@/app/_components/layout/GardenShell/PageHeader";

import { budActivityItems } from "../dashboard/mock-data";
import { useBudState } from "../_state/BudStateContext";
import { BudGate } from "./BudGate";
import { formatBudRoleLabel } from "./BudFaithfulFrame";
import { getBudGardenPageMenu } from "./bud-garden-menu";
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
  const { sessionUser, signOut, budRole } = useBudState();
  const userName = sessionUser?.name ?? "Garden User";

  return (
    <BudGate>
      <GardenShell
        activeModule="bud"
        pageMenu={getBudGardenPageMenu(route)}
        activityItems={budActivityItems}
        userName={userName}
        userEmail={sessionUser?.employee_number ? `${sessionUser.employee_number}@garden.local` : null}
        userRoleLabel={formatBudRoleLabel(budRole)}
        onLogout={signOut}
      >
        <div className={styles.pageStack}>
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
      </GardenShell>
    </BudGate>
  );
}
