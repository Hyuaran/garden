import type { ReactNode } from "react";

import { TossGate } from "./_components/TossGate";

export default function TossLayout({ children }: { children: ReactNode }) {
  return <TossGate>{children}</TossGate>;
}

