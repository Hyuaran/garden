import type { ReactNode } from "react";
import { RootView } from "@/lib/auth/root-view.server";

export default function Layout({ children }: { children: ReactNode }) {
  return <RootView pageKey="root-minimum-wages">{children}</RootView>;
}
