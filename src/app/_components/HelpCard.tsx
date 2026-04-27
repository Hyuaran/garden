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
        position: "absolute",
        left: 16,
        bottom: 16,
        zIndex: 5,
        maxWidth: 280,
        padding: "14px 16px",
        background: "rgba(255, 255, 255, 0.92)",
        borderRadius: 12,
        border: "1px solid #DEE5DE",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span aria-hidden>💡</span>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1F5C3A" }}>ヘルプ</h3>
      </div>
      <p style={{ fontSize: 11, color: "#5C6E5F", lineHeight: 1.5, margin: 0 }}>
        Garden の使い方が分からない時はこちら。Q&amp;A 検索・操作ガイド・動画解説が揃っています。
      </p>
      <Link
        href="/help"
        style={{
          display: "inline-block",
          marginTop: 10,
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
