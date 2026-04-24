"use client";

import type { DigestPage } from "../../_types/monthly-digest";
import { DigestPageFrame } from "./DigestPageFrame";

export function ProgressGraphPage({
  page,
  projection = false,
}: {
  page: DigestPage;
  projection?: boolean;
}) {
  return (
    <DigestPageFrame icon="📊" title={page.title} projection={projection}>
      <div style={{ whiteSpace: "pre-wrap" }}>{page.body || "（グラフ説明 未記入）"}</div>

      {page.image_url ? (
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
      ) : (
        <div
          style={{
            marginTop: 24,
            padding: 24,
            background: "#f1f8f4",
            borderRadius: 12,
            fontSize: projection ? 18 : 12,
            color: "#6b8e75",
            textAlign: "center",
          }}
        >
          📉 グラフ画像未登録 — data_payload または image_url で差し込み
        </div>
      )}
    </DigestPageFrame>
  );
}
