"use client";

/**
 * Garden モバイル — Bud 画面
 * 「申請」「詳細(Drive)」を選択。Bud 権限ありのアカウントには簡易レビュー(3タブ)入口も表示。
 * ※権限判定の本接続は後続。現状はリンクのみ用意。
 */

import Link from "next/link";

const CARD: React.CSSProperties = {
  display: "block",
  textDecoration: "none",
  background: "rgba(255,255,255,0.92)",
  border: "2px solid #E07A9B",
  borderRadius: 18,
  padding: "20px 18px",
  boxShadow: "0 3px 10px rgba(0,0,0,0.05)",
  color: "#2b2b2b",
};

export default function MobileBudHome() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(180deg, #f7f4ec 0%, #f3e9ee 100%)",
        padding: "20px 16px 40px",
        maxWidth: 560,
        margin: "0 auto",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Link href="/m" style={{ textDecoration: "none", color: "#7b745f", fontSize: 22, lineHeight: 1 }} aria-label="ホームへ戻る">
          ‹
        </Link>
        <img src="/themes/module-icons/bud.webp" alt="" aria-hidden width={32} height={32} style={{ objectFit: "contain" }} />
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#3d3528" }}>Bud — 経理・収支</div>
          <div style={{ fontSize: 11, color: "#7b745f" }}>経費精算</div>
        </div>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* 申請 */}
        <Link href="/m/bud/submit" style={CARD}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 30 }}>📸</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>申請する</div>
              <div style={{ fontSize: 12, color: "#6d6356", marginTop: 2 }}>レシートを枠カメラで撮って送る</div>
            </div>
            <span style={{ color: "#E07A9B", fontSize: 20 }}>›</span>
          </div>
        </Link>

        {/* 申請状況（アプリ内で自分の申請と状態を見る） */}
        <Link href="/m/bud/drive" style={{ ...CARD, border: "2px solid #C9A24B" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 30 }}>🗂</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>申請状況をみる</div>
              <div style={{ fontSize: 12, color: "#6d6356", marginTop: 2 }}>自分の領収書と承認・差戻しの状態</div>
            </div>
            <span style={{ color: "#C9A24B", fontSize: 20 }}>›</span>
          </div>
        </Link>

        {/* 簡易レビュー（Bud 権限ありのみ・本接続は後続） */}
        <Link href="/m/bud/review" style={{ ...CARD, border: "2px solid #6f9b70" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 30 }}>✅</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>
                レビュー <span style={{ fontSize: 10, color: "#6f9b70", fontWeight: 600 }}>（権限者）</span>
              </div>
              <div style={{ fontSize: 12, color: "#6d6356", marginTop: 2 }}>承認待ち / 完了待ち / 仕訳化（簡易）</div>
            </div>
            <span style={{ color: "#6f9b70", fontSize: 20 }}>›</span>
          </div>
        </Link>
      </div>
    </main>
  );
}
