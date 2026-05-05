"use client";

import Link from "next/link";

import { useBloomState } from "../_state/BloomStateContext";

export default function DailyReportPage() {
  const { bloomUser } = useBloomState();
  const userName = bloomUser?.display_name ?? "（未ログイン）";

  return (
    <main style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
      <h1>日報</h1>
      <p style={{ color: "#6b8e75" }}>
        ようこそ、{userName} さん。日報の登録・閲覧画面は準備中です。
      </p>
      <section
        style={{
          padding: 16,
          borderRadius: 12,
          background: "#f8f6f0",
          border: "1px solid #e3dccd",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <h2 style={{ fontSize: 16, margin: 0 }}>関連ページ</h2>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
          <li>
            <Link href="/bloom/workboard">ワークボード</Link>
            <small style={{ marginLeft: 8, color: "#92857a" }}>
              当日の予定・進捗・稼働状況
            </small>
          </li>
          <li>
            <Link href="/bloom/monthly-digest">月次まとめ</Link>
            <small style={{ marginLeft: 8, color: "#92857a" }}>
              月単位の達成サマリ
            </small>
          </li>
          <li>
            <Link href="/bloom/ceo-status">経営状況</Link>
            <small style={{ marginLeft: 8, color: "#92857a" }}>
              東海林さんの現在ステータス
            </small>
          </li>
        </ul>
      </section>
    </main>
  );
}
