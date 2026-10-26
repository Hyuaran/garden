import type { ReactNode } from "react";

import { LeafForestLayout } from "@/lib/auth/leaf-forest-view.server";

export const metadata = {
  title: "Garden-Fruit — 法人情報",
};

export default function FruitLayout({ children }: { children: ReactNode }) {
  return <LeafForestLayout module="fruit">{children}</LeafForestLayout>;
}
