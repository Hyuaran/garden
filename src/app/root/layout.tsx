import { rootViewNavigation } from "@/lib/auth/root-view.server";
import { ReactNode } from "react";
import { RootShell } from "./_components/RootShell";
import { RootGate } from "./_components/RootGate";
import { RootStateProvider } from "./_state/RootStateContext";

export const metadata = {
  title: "Garden Root — マスタ管理",
};

export default async function Layout({ children }: { children: ReactNode }) {
  const viewAccess = await rootViewNavigation();
  return (
    <RootStateProvider viewAccess={viewAccess}>
      <RootGate>
        <RootShell><div className="garden-table-head-center" style={{ display: "contents" }}>{children}</div></RootShell>
      </RootGate>
    </RootStateProvider>
  );
}
