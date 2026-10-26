"use client";
import { SystemViewButton } from '@/app/system/_components/ViewPermissionButton/SystemViewContext';


import { useBloomState } from "../../_state/BloomStateContext";
import { ShojiStatusWidget } from "../../../../components/shared/ShojiStatusWidget";
import { CeoStatusEditor } from "../../_components/CeoStatusEditor";

export default function CeoStatusDetailPage() {
  const { bloomUser } = useBloomState();
  const isSuperAdmin = bloomUser?.garden_role === "super_admin";

  return (
    <main style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><h1>東海林さん 現在のステータス</h1><SystemViewButton /></div>
      <ShojiStatusWidget mode="full" />
      {isSuperAdmin && <CeoStatusEditor isSuperAdmin={true} />}
    </main>
  );
}
