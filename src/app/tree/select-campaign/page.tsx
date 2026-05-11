"use client";

/**
 * Garden Tree Phase D-02 — キャンペーン選択画面
 *
 * path: /tree/select-campaign
 *
 * 設計判断（spec §3.1 からの変更点）:
 *   - 既存 /tree/call（InCallScreen）を破壊しないため、新 path /tree/select-campaign に新設
 *   - /tree/call は変更なし（既存動作維持）
 *
 * 機能:
 *   - ログイン後の最初の画面（キャンペーン選択 + モード選択）
 *   - garden_role に基づくモード自動判定（toss→sprout, closer→branch）
 *   - 前日最終キャンペーンを localStorage から復元（判断 0-1）
 *   - セッション開始で openSession Server Action 呼出 → calling 画面へ遷移
 *
 * キャンペーン一覧はハードコード（Phase D-1 は関電のみ）:
 *   D-2 で hikari 追加、D-3 で credit 追加
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTreeState } from "../_state/TreeStateContext";
import { supabase } from "../_lib/supabase";
import { openSession, type SessionMode } from "../_actions/session";

// ============================================================
// 定数
// ============================================================

const CAMPAIGNS = [
  { code: "kanden", label: "関電業務委託" },
  // D-2 で追加: { code: 'hikari', label: '光回線' },
  // D-3 で追加: { code: 'credit', label: 'クレカ' },
] as const;

type CampaignCode = (typeof CAMPAIGNS)[number]["code"];

const MODES: { value: SessionMode; label: string }[] = [
  { value: "sprout", label: "アポインター（Sprout）" },
  { value: "branch", label: "クローザー（Branch）" },
  { value: "breeze", label: "呼吸モード（Breeze）" },
];

const LS_LAST_CAMPAIGN = "tree.last_campaign_code";

// ============================================================
// garden_role → デフォルト SessionMode マッピング
// ============================================================

function defaultModeFromRole(gardenRole: string | null | undefined): SessionMode {
  if (gardenRole === "toss") return "sprout";
  if (gardenRole === "closer") return "branch";
  return "sprout";
}

// ============================================================
// ページコンポーネント
// ============================================================

export default function SelectCampaignPage() {
  const router = useRouter();
  const { treeUser, gardenRole } = useTreeState();

  const [campaignCode, setCampaignCode] = useState<CampaignCode>("kanden");
  const [mode, setMode] = useState<SessionMode>(() =>
    defaultModeFromRole(gardenRole),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  // gardenRole が非同期で確定した後にモードを更新
  useEffect(() => {
    setMode(defaultModeFromRole(gardenRole));
  }, [gardenRole]);

  // 前日最終キャンペーンを localStorage から復元（判断 0-1）
  useEffect(() => {
    if (typeof window === "undefined") return;
    const last = window.localStorage.getItem(LS_LAST_CAMPAIGN) as CampaignCode | null;
    if (last && CAMPAIGNS.some((c) => c.code === last)) {
      setCampaignCode(last);
    }
  }, []);

  const handleStart = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");

    try {
      // accessToken を取得（Server Action 検証用）
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token ?? "";

      if (!accessToken) {
        setError("認証セッションが見つかりません。再ログインしてください。");
        return;
      }

      const result = await openSession({ campaign_code: campaignCode, mode, accessToken });

      if (result.success) {
        // 次回のために選択キャンペーンを保存
        if (typeof window !== "undefined") {
          window.localStorage.setItem(LS_LAST_CAMPAIGN, campaignCode);
          // D-02 Step 3: 結果 INSERT 時に参照できるよう session_id / campaign_code を保存
          window.localStorage.setItem("tree.current_session_id", result.session_id);
          window.localStorage.setItem("tree.current_campaign_code", campaignCode);
        }
        // モード別に遷移先を分岐
        const target =
          mode === "branch"
            ? "/tree/calling/branch"
            : mode === "breeze"
            ? "/tree/breeze"
            : "/tree/calling/sprout";
        router.push(target);
      } else {
        setError(result.errorMessage ?? "セッション開始に失敗しました");
      }
    } catch (e) {
      console.error("[SelectCampaignPage] handleStart error:", e);
      setError("予期せぬエラーが発生しました。もう一度お試しください。");
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // レンダリング
  // ============================================================

  return (
    <div
      style={{
        padding: 24,
        maxWidth: 560,
        margin: "40px auto",
        fontFamily: "'Noto Sans JP', sans-serif",
        color: "#1a1a1a",
      }}
    >
      <h1
        style={{
          fontSize: 20,
          fontWeight: 700,
          marginBottom: 8,
          color: "#234d20",
        }}
      >
        本日のキャンペーン選択
      </h1>

      <p style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>
        {treeUser?.name ?? "—"} さん（{gardenRole ?? "—"}）
      </p>

      {/* キャンペーン選択 */}
      <fieldset
        style={{
          border: "1px solid #ccc",
          borderRadius: 8,
          padding: "12px 16px",
          marginBottom: 16,
        }}
      >
        <legend style={{ fontWeight: 600, fontSize: 13, padding: "0 4px" }}>
          キャンペーン
        </legend>
        {CAMPAIGNS.map((c) => (
          <label
            key={c.code}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 0",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            <input
              type="radio"
              name="campaign"
              value={c.code}
              checked={campaignCode === c.code}
              onChange={(e) => setCampaignCode(e.target.value as CampaignCode)}
              style={{ accentColor: "#234d20" }}
            />
            {c.label}
          </label>
        ))}
      </fieldset>

      {/* モード選択 */}
      <fieldset
        style={{
          border: "1px solid #ccc",
          borderRadius: 8,
          padding: "12px 16px",
          marginBottom: 20,
        }}
      >
        <legend style={{ fontWeight: 600, fontSize: 13, padding: "0 4px" }}>
          モード
        </legend>
        {MODES.map((m) => (
          <label
            key={m.value}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 0",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            <input
              type="radio"
              name="mode"
              value={m.value}
              checked={mode === m.value}
              onChange={(e) => setMode(e.target.value as SessionMode)}
              style={{ accentColor: "#234d20" }}
            />
            {m.label}
          </label>
        ))}
      </fieldset>

      {/* エラー表示 */}
      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            background: "#fff0f0",
            color: "#a00",
            border: "1px solid #f5c0c0",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* セッション開始ボタン */}
      <button
        type="button"
        onClick={handleStart}
        disabled={submitting}
        style={{
          display: "block",
          width: "100%",
          padding: "14px 24px",
          fontSize: 15,
          fontWeight: 700,
          background: submitting ? "#6a9a67" : "#234d20",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          cursor: submitting ? "wait" : "pointer",
          transition: "background 0.15s",
        }}
      >
        {submitting ? "セッション開始中..." : "セッション開始"}
      </button>
    </div>
  );
}
