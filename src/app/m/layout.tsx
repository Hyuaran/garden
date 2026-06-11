import { MobileAuthGate } from "./_components/MobileAuthGate";

/**
 * /m 配下（Garden モバイル）はログイン必須。
 */
export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return <MobileAuthGate>{children}</MobileAuthGate>;
}
