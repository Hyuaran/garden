"use client";

/**
 * 残り 10 分 (dev: 10 秒) でセッション切れを警告するモーダル。
 *
 * 表示条件: useRootState().warningActive === true
 * 操作:
 *   - [作業を続ける] → extendSession() 呼び出し (タイマーリセット)
 *   - [ログアウト] → signOut("manual") 呼び出し
 */

import { colors } from "../_constants/colors";
import { IS_DEV_MODE } from "../_lib/session-timer";
import { useRootState } from "../_state/RootStateContext";

function formatRemaining(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  if (min > 0) return `${min} 分 ${rem} 秒`;
  return `${rem} 秒`;
}

export function SessionWarningModal() {
  const { warningActive, remainingMs, extendSession, signOut } = useRootState();
  if (!warningActive) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: colors.bgPanel,
          padding: 32,
          borderRadius: 12,
          maxWidth: 480,
          width: "90%",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        }}
      >
        {IS_DEV_MODE && (
          <div
            style={{
              background: colors.warningBg,
              color: colors.warning,
              padding: "4px 12px",
              borderRadius: 6,
              fontSize: 11,
              display: "inline-block",
              marginBottom: 12,
            }}
          >
            ⚠️ 開発モード中 (タイマー短縮)
          </div>
        )}
        <h2 style={{ margin: "0 0 12px", fontSize: 20, color: colors.text }}>
          ⏰ セッションの有効期限が近づいています
        </h2>
        <p
          style={{
            margin: "0 0 24px",
            color: colors.textMuted,
            lineHeight: 1.6,
          }}
        >
          あと <strong style={{ color: colors.danger }}>
            {formatRemaining(remainingMs)}
          </strong>{" "}
          で自動ログアウトします。作業を続けますか？
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => signOut("manual")}
            style={{
              padding: "10px 20px",
              background: colors.bgPanel,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              cursor: "pointer",
              color: colors.textMuted,
            }}
          >
            ログアウト
          </button>
          <button
            type="button"
            onClick={extendSession}
            style={{
              padding: "10px 20px",
              background: colors.primary,
              color: colors.textOnDark,
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            作業を続ける
          </button>
        </div>
      </div>
    </div>
  );
}
