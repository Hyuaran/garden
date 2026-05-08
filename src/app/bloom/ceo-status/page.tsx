"use client";

import { useBloomState } from "../_state/BloomStateContext";
import { ShojiStatusWidget } from "../../../components/shared/ShojiStatusWidget";
import { CeoStatusEditor } from "../_components/CeoStatusEditor";

export default function CeoStatusPage() {
  const { bloomUser } = useBloomState();
  const isSuperAdmin = bloomUser?.garden_role === "super_admin";

  return (
    <main style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
      <h1>東海林さん 現在のステータス</h1>
      <ShojiStatusWidget mode="full" />
      {isSuperAdmin && <CeoStatusEditor isSuperAdmin={true} />}
    </main>
  );
}
