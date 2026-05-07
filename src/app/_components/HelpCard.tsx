/**
 * ホーム画面 左下「ヘルプ」カード
 *
 * Phase 2-2 候補 8 Step 6: 旧「成長のヒント」を Help エントリポイントに改修。
 * KING OF TIME 風のオンラインヘルプ入口。memory project_garden_help_module 参照。
 */

import Link from "next/link";

export function HelpCard() {
  return (
    <section
      aria-label="ヘルプ"
      data-testid="help-card"
      style={{
        padding: "12px 14px",
        background: "rgba(248, 250, 247, 0.92)",
        borderRadius: 10,
        border: "1px solid #DEE5DE",
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.04)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span aria-hidden>💡</span>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#1F5C3A" }}>ヘルプ</h3>
      </div>
      <p style={{ fontSize: 11, color: "#5C6E5F", lineHeight: 1.5, margin: 0 }}>
        Garden の使い方が分からない時はこちら。Q&amp;A 検索・操作ガイド・動画解説。
      </p>
      <Link
        href="/help"
        style={{
          display: "inline-block",
          marginTop: 8,
          padding: "5px 12px",
          background: "#3B9B5C",
          color: "#fff",
          fontSize: 11,
          fontWeight: 600,
          borderRadius: 6,
          textDecoration: "none",
        }}
      >
        ヘルプを開く
      </Link>
    </section>
  );
}
