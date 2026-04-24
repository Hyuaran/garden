"use client";

import type { DigestPage } from "../../_types/monthly-digest";
import { DigestPageFrame } from "./DigestPageFrame";

export function NextMonthGoalsPage({
  page,
  projection = false,
}: {
  page: DigestPage;
  projection?: boolean;
}) {
  return (
    <DigestPageFrame
      icon="🎯"
      title={page.title}
      projection={projection}
      accent="#95d5b2"
    >
      <div style={{ whiteSpace: "pre-wrap" }}>{page.body || "（来月の目標 未記入）"}</div>
    </DigestPageFrame>
  );
}
