"use client";

/**
 * /bloom/progress — Garden 開発進捗 (v29 取り込み、5/8 デモ向け)
 *
 * dispatch main- No.48 (2026-05-05) で claude.ai 作業日報セッションが完成させた
 * v29 HTML を /_proto/bloom-dev-progress/ に静的配置し、本 page から iframe で描画。
 *
 * 構成:
 *   - BloomShell 配下 (Topbar / Sidebar 維持)
 *   - main 領域に full-height iframe で v29 HTML 表示
 */

export default function BloomProgressPage() {
  return (
    <iframe
      src="/_proto/bloom-dev-progress/index.html"
      style={{
        width: "100%",
        height: "100vh",
        border: "none",
        display: "block",
      }}
      title="Garden 開発進捗 v29"
    />
  );
}
