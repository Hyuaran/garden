"use client";

import { BudGate } from "../../_components/BudGate";
import { BudShell } from "../../_components/BudShell";
import { TransferFormCashback } from "../_components/TransferFormCashback";

export default function NewCashbackPage() {
  return (
    <BudGate>
      <BudShell>
        <div className="p-6">
          <TransferFormCashback />
        </div>
      </BudShell>
    </BudGate>
  );
}
