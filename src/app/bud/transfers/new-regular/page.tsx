import { BudGate } from "../../_components/BudGate";
import { BudShell } from "../../_components/BudShell";
import { TransferFormRegular } from "../_components/TransferFormRegular";

type NewRegularPageProps = {
  searchParams: Promise<{ inboxId?: string | string[] }>;
};

export default async function NewRegularPage({
  searchParams,
}: NewRegularPageProps) {
  const params = await searchParams;
  const inboxId = Array.isArray(params.inboxId)
    ? params.inboxId[0]
    : params.inboxId;

  return (
    <BudGate>
      <BudShell>
        <div className="p-6">
          <TransferFormRegular inboxId={inboxId ?? null} />
        </div>
      </BudShell>
    </BudGate>
  );
}
