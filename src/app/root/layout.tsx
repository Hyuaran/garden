import { ReactNode } from "react";
import { RootShell } from "./_components/RootShell";
import { RootGate } from "./_components/RootGate";
import { RootStateProvider } from "./_state/RootStateContext";

export const metadata = {
  title: "Garden Root — マスタ管理",
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RootStateProvider>
      <RootGate>
        <RootShell><div className="garden-table-head-center" style={{ display: "contents" }}>{children}</div></RootShell>
      </RootGate>
    </RootStateProvider>
  );
}
