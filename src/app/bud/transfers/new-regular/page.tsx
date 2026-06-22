import { BudGardenFrame } from "../../_components/BudGardenFrame";
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
    <BudGardenFrame
      route="/bud/transfers"
      title="振込依頼 新規作成"
      titleJp="請求書から、支払いの段取りへ"
      subtitle="請求書アップロードとOCR補助で、振込依頼を作成します。"
    >
      <div className="p-6">
        <TransferFormRegular inboxId={inboxId ?? null} />
      </div>
    </BudGardenFrame>
  );
}
