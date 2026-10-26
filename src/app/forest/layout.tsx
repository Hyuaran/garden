import type { ReactNode } from "react";

import { LeafForestLayout } from "@/lib/auth/leaf-forest-view.server";
import { ForestShell } from "./_components/ForestShell";
import { ForestViewState } from "./_components/ForestViewState";

export default function ForestLayout({ children }: { children: ReactNode }) {
  return (
    <LeafForestLayout module="forest"><ForestViewState>
      
        <ForestShell>{children}</ForestShell>
      
    </ForestViewState></LeafForestLayout>
  );
}
