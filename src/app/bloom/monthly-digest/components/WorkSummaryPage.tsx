"use client";

import type { DigestPage } from "../../_types/monthly-digest";
import { DigestPageFrame } from "./DigestPageFrame";

export function WorkSummaryPage({
  page,
  projection = false,
}: {
  page: DigestPage;
  projection?: boolean;
}) {
  return (
    <DigestPageFrame icon="🧮" title={page.title} projection={projection}>
      <div style={{ whiteSpace: "pre-wrap" }}>{page.body || "（稼働サマリ 未記入）"}</div>
    </DigestPageFrame>
  );
}
