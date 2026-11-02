"use client";

import { BudGardenFrame } from "../../_components/BudGardenFrame";
import { TransferFormCashback } from "../_components/TransferFormCashback";

export default function NewCashbackPage() {
  return (
    <BudGardenFrame
      route="/bud/transfers"
      title="振込依頼 新規（キャッシュバック）"
      titleJp="返金を、きちんと戻す"
      subtitle="キャッシュバック用の振込依頼を作成します。"
    >
      <div className="p-6">
        <TransferFormCashback />
      </div>
    </BudGardenFrame>
  );
}
