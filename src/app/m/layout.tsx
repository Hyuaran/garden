import { MobileAuthGate } from "./_components/MobileAuthGate";
import { MobileBottomNav } from "./_components/MobileBottomNav";

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <MobileAuthGate>
      <div style={{ minHeight: "100dvh", paddingBottom: "calc(78px + env(safe-area-inset-bottom))" }}>{children}</div>
      <MobileBottomNav />
    </MobileAuthGate>
  );
}
