import { ReactNode } from "react";
import { RootShell } from "./_components/RootShell";
import { RootStateProvider } from "./_state/RootStateContext";

export const metadata = {
  title: "Garden Root — マスタ管理",
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RootStateProvider>
      <RootShell>{children}</RootShell>
    </RootStateProvider>
  );
}
