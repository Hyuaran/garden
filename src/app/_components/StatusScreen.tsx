"use client";

/**
 * 離席中 / 休憩中 共通ステータス画面（v7 Group C、2026-04-27）
 *
 * 中央配置レイアウト + variant 別の配色 + 文言。
 * 参考画像: _shared/.../status-screens/away-ref.png + break-ref.png
 *
 * 5/5 デモ用: 静的表示。post-5/5 で実時刻 / 再開時刻 / 動的状態 連携。
 */

import Link from "next/link";

type Variant = "away" | "break";

const CONTENT: Record<Variant, {
  badge: string;
  title: string;
  description1: string;
  description2: string;
  statusLabel: string;
  timeRow: { icon: string; label: string; value: string };
  bgGradient: string;
  badgeColor: string;
  emoji: string;
}> = {
  away: {
    badge: "Green Screen",
    title: "離席中",
    description1: "ただいま席を外しています。しばらくお待ちください。",
    description2: "業務は Garden Series が静かに見守っています。",
    statusLabel: "ステータス：一時離席",
    timeRow: { icon: "🕐", label: "更新時刻", value: "10:42" },
    bgGradient: "radial-gradient(circle at 30% 30%, #C9E8C9 0%, #A8D8A0 35%, #6CAE7E 80%, #3B7F4B 100%)",
    badgeColor: "#3B9B5C",
    emoji: "🍃",
  },
  break: {
    badge: "Take a gentle break",
    title: "休憩中",
    description1: "ただいま休憩をいただいています。再開までしばらくお待ちください。",
    description2: "少し整えて、また心地よく業務を再開します。",
    statusLabel: "ステータス：休憩",
    timeRow: { icon: "🕐", label: "再開予定", value: "13:30" },
    bgGradient: "radial-gradient(circle at 50% 30%, #FBF6E1 0%, #F4E8B5 35%, #E5C97A 75%, #C0A04F 100%)",
    badgeColor: "#B5942A",
    emoji: "🍃",
  },
};

export function StatusScreen({ variant }: { variant: Variant }) {
  const c = CONTENT[variant];

  return (
    <main
      data-testid={`status-screen-${variant}`}
      data-variant={variant}
      style={{
        minHeight: "100vh",
        background: c.bgGradient,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* 光粒子（疑似 — opacity gradient overlay） */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.6) 0%, transparent 30%), radial-gradient(circle at 20% 80%, rgba(255,255,255,0.4) 0%, transparent 35%)",
          pointerEvents: "none",
        }}
      />

      {/* 円形ロゴ */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: 96,
          height: 96,
          borderRadius: "50%",
          background: "rgba(255, 255, 255, 0.85)",
          backdropFilter: "blur(8px)",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 18,
        }}
      >
        <span style={{ fontSize: 48 }} aria-hidden>
          {variant === "away" ? "🍃" : "🍵"}
        </span>
      </div>

      {/* ロゴ下キャッチ */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          fontSize: 14,
          color: "#3D4D40",
          fontStyle: "italic",
          letterSpacing: 1,
          marginBottom: 18,
        }}
      >
        {c.badge}
      </div>

      {/* 大文字タイトル */}
      <h1
        style={{
          position: "relative",
          zIndex: 1,
          fontSize: 64,
          fontWeight: 700,
          letterSpacing: "0.4em",
          color: "#1F2A24",
          margin: "0 0 20px",
          textAlign: "center",
        }}
      >
        {c.title}
      </h1>

      {/* 説明文 */}
      <p
        style={{
          position: "relative",
          zIndex: 1,
          fontSize: 14,
          color: "#3D4D40",
          textAlign: "center",
          margin: "0 0 4px",
          maxWidth: 480,
          lineHeight: 1.7,
        }}
      >
        {c.description1}
      </p>
      <p
        style={{
          position: "relative",
          zIndex: 1,
          fontSize: 14,
          color: "#3D4D40",
          textAlign: "center",
          margin: "0 0 28px",
          maxWidth: 480,
          lineHeight: 1.7,
        }}
      >
        {c.description2}
      </p>

      {/* ステータス pill */}
      <div
        data-testid="status-pill"
        style={{
          position: "relative",
          zIndex: 1,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 18px",
          background: "rgba(255, 255, 255, 0.85)",
          border: `1.5px solid ${c.badgeColor}`,
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 600,
          color: c.badgeColor,
          marginBottom: 12,
        }}
      >
        <span aria-hidden>{c.emoji}</span>
        <span>{c.statusLabel}</span>
      </div>

      {/* 時刻 row */}
      <div
        data-testid="status-time"
        style={{
          position: "relative",
          zIndex: 1,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          color: "#3D4D40",
          marginBottom: 22,
        }}
      >
        <span aria-hidden>{c.timeRow.icon}</span>
        <span>{c.timeRow.label} {c.timeRow.value}</span>
      </div>

      {/* 戻るボタン */}
      <Link
        href="/"
        data-testid="status-home-link"
        style={{
          position: "relative",
          zIndex: 1,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 26px",
          background: "rgba(255, 255, 255, 0.92)",
          border: `1.5px solid ${c.badgeColor}`,
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 600,
          color: c.badgeColor,
          textDecoration: "none",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
        }}
      >
        <span aria-hidden>🍃</span>
        <span>ホームへ戻る</span>
      </Link>
    </main>
  );
}
