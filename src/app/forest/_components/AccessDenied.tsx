"use client";

/**
 * アクセス権限なし画面
 *
 * forest_users に登録されていないユーザー向け。
 */

import { FOREST_THEME } from "../_constants/theme";
import { C } from "../_constants/colors";

export function AccessDenied() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: FOREST_THEME.background,
        fontFamily: "'Noto Sans JP', sans-serif",
      }}
    >
      <div
        style={{
          background: FOREST_THEME.panelBg,
          backdropFilter: "blur(20px)",
          border: `1px solid ${FOREST_THEME.panelBorder}`,
          borderRadius: FOREST_THEME.panelRadius,
          padding: 48,
          textAlign: "center",
          maxWidth: 400,
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: C.darkGreen,
            marginBottom: 12,
          }}
        >
          アクセス権限がありません
        </h2>
        <p style={{ fontSize: 14, color: FOREST_THEME.textSecondary, lineHeight: 1.8 }}>
          このページは許可されたユーザーのみアクセスできます。
          <br />
          管理者にお問い合わせください。
        </p>
      </div>
    </div>
  );
}
