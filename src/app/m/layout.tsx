import { MobileAuthGate } from "./_components/MobileAuthGate";
import { MobileBottomNav } from "./_components/MobileBottomNav";
import { NoticeBell } from "@/app/_components/notices/NoticeBell";

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <MobileAuthGate>
      <header style={{ display: "flex", justifyContent: "flex-end", padding: "8px 16px", background: "var(--bg-shacho)" }}><NoticeBell /></header>
      <div style={{ minHeight: "100dvh", paddingBottom: "calc(78px + env(safe-area-inset-bottom))" }}>{children}</div>
      <MobileBottomNav />
    </MobileAuthGate>
  );
}
