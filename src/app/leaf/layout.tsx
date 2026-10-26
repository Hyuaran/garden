import type { ReactNode } from "react";

import { LeafForestLayout } from "@/lib/auth/leaf-forest-view.server";

export const metadata = {
  title: "Garden-Leaf — 商材",
};

export default function LeafLayout({ children }: { children: ReactNode }) {
  return <LeafForestLayout module="leaf">{children}</LeafForestLayout>;
}
