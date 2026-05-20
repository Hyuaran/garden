import { BlueprintOverview } from "./components/BlueprintOverview";
import { ModuleBlueprintGrid } from "./components/ModuleBlueprintGrid";
import { NotesPanel } from "./components/NotesPanel";
import { RoleAllocationPanel } from "./components/RoleAllocationPanel";
import { SourceLinksPanel } from "./components/SourceLinksPanel";

export default function BloomBlueprintPage() {
  return (
    <main style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <BlueprintOverview />
      <ModuleBlueprintGrid />
      <RoleAllocationPanel />
      <SourceLinksPanel />
      <NotesPanel />
    </main>
  );
}
