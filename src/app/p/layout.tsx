import type { ReactNode } from "react";

import { PartnerGate } from "./_components/PartnerGate";

export default function PartnerLayout({ children }: { children: ReactNode }) {
  return <PartnerGate>{children}</PartnerGate>;
}

