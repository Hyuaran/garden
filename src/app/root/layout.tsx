import { ReactNode } from "react";
import { RootShell } from "./_components/RootShell";

export const metadata = {
  title: "Garden Root — マスタ管理",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <RootShell>{children}</RootShell>;
}
