"use client";

import type { DigestPage } from "../../_types/monthly-digest";
import { DigestPageFrame } from "./DigestPageFrame";

export function CustomPage({
  page,
  projection = false,
}: {
  page: DigestPage;
  projection?: boolean;
}) {
  return (
    <DigestPageFrame icon="📄" title={page.title} projection={projection}>
      <div style={{ whiteSpace: "pre-wrap" }}>{page.body || "（内容 未記入）"}</div>
      {page.image_url && (
        <img
          src={page.image_url}
          alt=""
          style={{
            marginTop: 24,
            maxWidth: "100%",
            borderRadius: 12,
            border: "1px solid #d8f3dc",
          }}
        />
      )}
    </DigestPageFrame>
  );
}
