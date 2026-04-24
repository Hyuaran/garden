"use client";

import type { DigestPage } from "../../_types/monthly-digest";
import { DigestPageFrame } from "./DigestPageFrame";

type Props = {
  page: DigestPage;
  /** 親 MonthlyDigest の情報（digest_month など） */
  context?: { digestMonthLabel?: string; summary?: string | null };
  projection?: boolean;
};

export function DigestCoverPage({ page, context, projection = false }: Props) {
  return (
    <DigestPageFrame
      icon="🌸"
      title={page.title}
      projection={projection}
      accent="#1b4332"
    >
      {context?.digestMonthLabel && (
        <p style={{ fontSize: projection ? 26 : 14, color: "#40916c", margin: 0 }}>
          {context.digestMonthLabel}
        </p>
      )}
      {context?.summary && (
        <p style={{ whiteSpace: "pre-wrap", margin: "12px 0 0" }}>{context.summary}</p>
      )}
      {page.body && (
        <p style={{ whiteSpace: "pre-wrap", margin: "20px 0 0" }}>{page.body}</p>
      )}
    </DigestPageFrame>
  );
}
