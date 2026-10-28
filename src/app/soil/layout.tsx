import type { ReactNode } from "react";

import { LeafForestLayout } from "@/lib/auth/leaf-forest-view.server";

export const metadata = {
  title: "Garden-Soil — データベース基盤",
};

export default function SoilLayout({ children }: { children: ReactNode }) {
  return <LeafForestLayout module="soil">{children}</LeafForestLayout>;
}
