import Link from "next/link";

import { BLOOM_PATHS } from "./_constants/routes";

const TILES: Array<{ href: string; title: string; description: string; icon: string }> = [
  {
    href: BLOOM_PATHS.WORKBOARD,
    title: "Workboard",
    description: "現在のステータス・本日の予定・今週の実績・次のマイルストーン",
    icon: "🧭",
  },
  {
    href: BLOOM_PATHS.ROADMAP,
    title: "ロードマップ",
    description: "全体進捗・M1〜M8 タイムライン・モジュール別進捗・リスク",
    icon: "🗺️",
  },
  {
    href: BLOOM_PATHS.MONTHLY_DIGEST,
    title: "月次ダイジェスト",
    description: "毎月15-20日の責任者会議用レポート（投影モード・PDF エクスポート）",
    icon: "📅",
  },
  {
    href: BLOOM_PATHS.DAILY_REPORTS,
    title: "日報",
    description: "日次作業ログ（send_report.py と共存）",
    icon: "📝",
  },
];

export default function BloomHome() {
  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1b4332", margin: 0 }}>
          🌸 Bloom ダッシュボード
        </h2>
        <p style={{ fontSize: 13, color: "#6b8e75", margin: "4px 0 0" }}>
          4 つの画面から選んでください。
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        {TILES.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            style={{
              display: "block",
              padding: 20,
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #d8f3dc",
              boxShadow: "0 2px 8px rgba(64, 145, 108, 0.06)",
              textDecoration: "none",
              color: "#1b4332",
              transition: "transform 0.1s ease, box-shadow 0.1s ease",
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>{tile.icon}</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
              {tile.title}
            </div>
            <p style={{ fontSize: 12, color: "#6b8e75", margin: 0, lineHeight: 1.6 }}>
              {tile.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
