"use client";

import { BudGate } from "../../_components/BudGate";
import { BudShell } from "../../_components/BudShell";
import { TransferFormRegular } from "../_components/TransferFormRegular";

export default function NewRegularPage() {
  return (
    <BudGate>
      <BudShell>
        <div className="p-6">
          <TransferFormRegular />
        </div>
      </BudShell>
    </BudGate>
  );
}
