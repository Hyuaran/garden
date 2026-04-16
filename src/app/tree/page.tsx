/**
 * Garden-Tree ルート（/tree）
 *
 * サイドバー・KPIヘッダー付きのレイアウト（layout.tsx + TreeShell）に乗る。
 * 本格的なダッシュボードは /tree/dashboard 側で実装予定。
 * ここでは移植進行中であることを示すプレースホルダを表示する。
 */

import { C } from "./_constants/colors";

export default function TreeHomePage() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
        background: C.bgWarm1,
      }}
    >
      <div
        style={{
          maxWidth: 640,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div style={{ fontSize: 64 }}>🌳</div>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: C.darkGreen,
            letterSpacing: 1,
          }}
        >
          Garden Tree
        </h1>
        <p style={{ fontSize: 14, color: C.textDark, lineHeight: 1.7 }}>
          架電アプリ — プロトタイプから移植中です。
          <br />
          左側のサイドバーから画面を選択してください。
        </p>
        <p style={{ fontSize: 12, color: C.textMuted }}>
          Under construction — feature/tree-foundation
        </p>
      </div>
    </div>
  );
}
