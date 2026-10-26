import type { ReactNode } from "react";
import { BudView } from "@/lib/auth/bud-view.server";
export default function Layout({ children }: { children: ReactNode }) { return <BudView pageKey="bud-expenses" tabKey="submit">{children}</BudView>; }
