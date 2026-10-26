import type { ReactNode } from "react";

import { LeafForestLayout } from "@/lib/auth/leaf-forest-view.server";

export const metadata = {
  title: "Garden-Seed — 新事業",
};

export default function SeedLayout({ children }: { children: ReactNode }) {
  return <LeafForestLayout module="seed">{children}</LeafForestLayout>;
}
