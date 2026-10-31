"use client";
import HelpButton from "@/app/system/_components/HelpButton/HelpButton";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import { SystemViewButton } from '@/app/system/_components/ViewPermissionButton/SystemViewContext';


import { useBloomState } from "../../_state/BloomStateContext";
import { ShojiStatusWidget } from "../../../../components/shared/ShojiStatusWidget";
import { CeoStatusEditor } from "../../_components/CeoStatusEditor";

export default function CeoStatusDetailPage() {
  const { bloomUser } = useBloomState();
  const isSuperAdmin = bloomUser?.garden_role === "super_admin";

  return (
    <main style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><div className="garden-help-heading"><h1>東海林さん 現在のステータス</h1><HelpButton /></div></div><SystemTabs actions={<SystemViewButton />} />
      <ShojiStatusWidget mode="full" />
      {isSuperAdmin && <CeoStatusEditor isSuperAdmin={true} />}
    </main>
  );
}
