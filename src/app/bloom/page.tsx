"use client";

/**
 * Garden Bloom top — GardenShell migration stage 2-1.
 *
 * The Bloom top page now uses the shared GardenShell frame. Bloom subpages still
 * remain under BloomShell through BloomLayoutClient until the next migration stage.
 */

import GardenShell from "../_components/layout/GardenShell/GardenShell";

import BloomPageHeader from "./_components/BloomPageHeader";
import BloomKpiGrid from "./_components/BloomKpiGrid";
import BloomNavGrid from "./_components/BloomNavGrid";
import { BLOOM_GARDEN_PAGE_MENU } from "./_components/bloom-garden-menu";
import { useBloomState } from "./_state/BloomStateContext";

function formatRoleLabel(role: string | null): string {
  if (!role) return "Garden Bloom";
  if (role === "super_admin") return "全権管理者";
  return `Garden role: ${role}`;
}

export default function BloomTopPage() {
  const { bloomUser, userEmail, role, lockAndLogout } = useBloomState();
  const userName = bloomUser?.name ?? userEmail ?? "東海林 美琴";

  return (
    <GardenShell
      activeModule="bloom"
      pageMenu={BLOOM_GARDEN_PAGE_MENU}
      userName={userName}
      userEmail={userEmail}
      userRoleLabel={formatRoleLabel(role)}
      onLogout={() => lockAndLogout("manual")}
    >
      <BloomPageHeader />
      <BloomKpiGrid />
      <BloomNavGrid />
    </GardenShell>
  );
}
