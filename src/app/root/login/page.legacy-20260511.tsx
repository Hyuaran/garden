"use client";

/**
 * Garden-Root ログイン画面 (/root/login)
 *
 * フロー:
 *   1. 社員番号 + パスワード入力
 *   2. signInRoot() で擬似メールに変換 → Supabase Auth
 *   3. 成功: refreshAuth() で garden_role を取得 (manager+ チェック込み)
 *   4. 成功 & 権限 OK: popReturnTo() で復帰 URL へ遷移
 *   5. 失敗/権限拒否: エラーメッセージ + 監査ログ
 */

import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";

import { colors } from "../_constants/colors";
import {
  popReturnTo,
  signInRoot,
  signOutRoot,
  toSyntheticEmail,
} from "../_lib/auth";
import { writeAudit } from "../_lib/audit";
import { useRootState } from "../_state/RootStateContext";

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  fontSize: 16,
  outline: "none",
  boxSizing: "border-box",
  background: colors.bgPanel,
  color: colors.text,
};

export default function RootLoginPage() {
  const router = useRouter();
  const { isAuthenticated, refreshAuth } = useRootState();
  const [empId, setEmpId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(popReturnTo());
    }
  }, [isAuthenticated, router]);

  const handleLogin = async () => {
    if (loading) return;
    if (!empId || !password) {
      setError("社員番号とパスワードを入力してください");
      return;
    }
    setLoading(true);
    setError("");

    // 1. Supabase Auth サインイン
    const signInResult = await signInRoot(empId, password);
    if (!signInResult.success) {
      // login_failed 監査ログ (社員番号が存在しない場合も含む)
      await writeAudit({
        action: "login_failed",
        actorEmpNum: empId,
        payload: { email: toSyntheticEmail(empId), reason: signInResult.error },
      });
      setError(signInResult.error ?? "ログインに失敗しました");
      setLoading(false);
      return;
    }

    // 2. garden_role 確認 (refreshAuth 内で login_denied 監査ログも書かれる)
    const authResult = await refreshAuth();
    if (!authResult.success) {
      // refreshAuth の内側で login_denied ログは権限拒否時のみ書かれる。
      // 通信エラー・root_employees 行なし等の「権限拒否以外の失敗」の場合、
      // Supabase Auth セッションは生きたままなので、ここで強制的にサインアウト
      // してセッションを破棄する (残留セッションによる権限不一致を防止)。
      await signOutRoot();
      await writeAudit({
        action: "login_failed",
        actorUserId: signInResult.userId,
        actorEmpNum: empId,
        payload: { reason: authResult.error ?? "refreshAuth failed" },
      });
      setError(authResult.error ?? "権限情報の取得に失敗しました");
      setLoading(false);
      return;
    }

    // 3. login_success 監査ログ
    await writeAudit({
      action: "login_success",
      actorUserId: signInResult.userId,
      actorEmpNum: empId,
    });

    // 4. 復帰 URL への遷移は useEffect (isAuthenticated 監視) が行う
    //    ここで router.replace すると useEffect の popReturnTo と二重発火になり
    //    2 回目は空になるため /root にフォールバックしてしまう。
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: colors.bg,
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Meiryo, sans-serif",
      }}
    >
      <div
        style={{
          width: 380,
          padding: 40,
          background: colors.bgPanel,
          borderRadius: 12,
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        }}
      >
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: colors.text,
            margin: "0 0 8px",
            textAlign: "center",
          }}
        >
          Garden Root
        </h1>
        <p
          style={{
            fontSize: 12,
            color: colors.textMuted,
            margin: "0 0 32px",
            textAlign: "center",
          }}
        >
          マスタ管理画面 ログイン
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleLogin();
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                fontSize: 12,
                color: colors.textMuted,
                display: "block",
                marginBottom: 4,
              }}
            >
              社員番号
            </label>
            <input
              type="text"
              placeholder="4桁の社員番号"
              maxLength={4}
              value={empId}
              onChange={(e) => setEmpId(e.target.value)}
              style={inputStyle}
              inputMode="numeric"
              autoComplete="username"
              disabled={loading}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                fontSize: 12,
                color: colors.textMuted,
                display: "block",
                marginBottom: 4,
              }}
            >
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {error && (
            <div
              style={{
                color: colors.danger,
                background: colors.dangerBg,
                padding: "10px 12px",
                borderRadius: 6,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: colors.primary,
              color: colors.textOnDark,
              border: "none",
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "認証中..." : "ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}
