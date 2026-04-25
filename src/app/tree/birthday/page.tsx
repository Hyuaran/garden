"use client";

/**
 * Garden-Tree 初回ログイン時の誕生日入力画面 (/tree/birthday)
 *
 * フロー:
 *   1. 認証済だが root_employees.birthday が null のユーザーがここへ誘導される（TreeAuthGate）
 *   2. YYYY-MM-DD を入力 → updateBirthday() で Supabase に保存
 *   3. refreshAuth() で treeUser を再取得 → dashboard へ遷移
 *
 * 副作用:
 *   - Supabase Auth パスワードも同時に MMDD へ更新する（/api/tree/update-password 経由、service_role_key 必須）
 *
 * /tree/birthday は TreeShell で「bare screen」扱い（サイドバー・KPIヘッダー非表示）。
 */

import { useRouter } from "next/navigation";
import {
  useState,
  type CSSProperties,
  type FocusEvent,
} from "react";

import { ActionButton } from "../_components/ActionButton";
import { GlassPanel } from "../_components/GlassPanel";
import { WireframeLabel } from "../_components/WireframeLabel";
import { C } from "../_constants/colors";
import { TREE_PATHS } from "../_constants/screens";
import { updateBirthday, updatePasswordFromBirthday } from "../_lib/queries";
import { useTreeState } from "../_state/TreeStateContext";

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  border: "2px solid #dcedc8",
  borderRadius: 12,
  fontSize: 16,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "'Noto Sans JP', sans-serif",
  background: C.white,
  color: C.textDark,
};

export default function TreeBirthdayPage() {
  const router = useRouter();
  const { treeUser, refreshAuth } = useTreeState();
  const [birthday, setBirthday] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (saving) return;
    if (!birthday) {
      setError("誕生日を入力してください");
      return;
    }
    if (!treeUser) {
      setError("認証情報が取得できません。再ログインしてください");
      return;
    }

    setSaving(true);
    setError("");

    const result = await updateBirthday(treeUser.user_id, birthday);
    if (!result.success) {
      setError(result.error ?? "保存に失敗しました");
      setSaving(false);
      return;
    }

    const pwResult = await updatePasswordFromBirthday(birthday);
    if (!pwResult.success) {
      setError(
        pwResult.error ??
          "誕生日は保存されましたが、パスワードの更新に失敗しました",
      );
      setSaving(false);
      return;
    }

    const authResult = await refreshAuth();
    if (!authResult.success) {
      setError(authResult.error ?? "情報の更新に失敗しました");
      setSaving(false);
      return;
    }

    router.push(TREE_PATHS.DASHBOARD);
  };

  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = C.midGreen;
  };
  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "#dcedc8";
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(160deg, ${C.bgWarm1} 0%, ${C.bgWarm2} 50%, ${C.bgWarm3} 100%)`,
        fontFamily: "'Noto Sans JP', sans-serif",
      }}
    >
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: `linear-gradient(90deg, ${C.darkGreen}, ${C.midGreen}, ${C.accentGreen}, ${C.midGreen}, ${C.darkGreen})`,
        }}
      />

      <div style={{ position: "relative" }}>
        <WireframeLabel>画面1-β: 初回ログイン・誕生日入力</WireframeLabel>
        <GlassPanel style={{ width: 420, padding: 40, textAlign: "center" }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: C.darkGreen,
              margin: "0 0 12px",
            }}
          >
            はじめてのログイン
          </h1>
          <p
            style={{
              fontSize: 13,
              color: C.textSub,
              lineHeight: 1.7,
              margin: "0 0 28px",
            }}
          >
            {treeUser?.name ? `${treeUser.name} さん、ようこそ。` : "ようこそ。"}
            <br />
            ご本人確認のため、誕生日を登録してください。
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <div style={{ marginBottom: 20, textAlign: "left" }}>
              <label
                style={{
                  fontSize: 12,
                  color: C.textSub,
                  display: "block",
                  marginBottom: 4,
                }}
              >
                誕生日
              </label>
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                style={inputStyle}
                disabled={saving}
                max={new Date().toISOString().slice(0, 10)}
              />
            </div>

            {error && (
              <div
                style={{
                  color: C.red,
                  fontSize: 12,
                  marginBottom: 16,
                  fontWeight: 600,
                  textAlign: "center",
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "center" }}>
              <ActionButton
                label={saving ? "保存中..." : "登録する"}
                large
                type="submit"
                color={`linear-gradient(135deg, ${C.darkGreen}, ${C.midGreen})`}
                onClick={handleSave}
                disabled={saving}
              />
            </div>
          </form>

          <p
            style={{
              marginTop: 20,
              fontSize: 11,
              color: "#b0b0b0",
              lineHeight: 1.7,
              textAlign: "center",
            }}
          >
            ※登録後はダッシュボード画面に自動遷移します
            <br />
            誕生日は後から変更可能です
          </p>
        </GlassPanel>
      </div>
    </div>
  );
}
