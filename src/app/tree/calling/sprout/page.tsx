"use client";

/**
 * Garden-Tree Sprout 架電画面 (/tree/calling/sprout)
 *
 * プロトタイプの <CallingSproutScreen /> を移植。
 *
 * 構成:
 *  1. BreezeDualTimer（架電中 / 通話中 / 入力中）
 *  2. アクションボタン（Q&A検索 / 通話接続デモ / 切電 / 次の架電へ）
 *  3. 架電結果ボタン（SPROUT_BUTTONS — 上段5列 + 下段5列）
 *  4. NG その他 理由入力（選択時のみ表示）
 *  5. 次回対応日時（見込A/B/C・コイン選択時のみ表示、必須）
 *  6. 架電メモ（トス=必須、見込み=任意）
 *  7. 顧客情報パネル
 *  8. メモ欄パネル
 *  9. 見込み一覧サイドバー（ProspectList）
 *
 * - サイドバー・KPIヘッダーは TreeShell が描画するため、本ページは中身のみ。
 * - callPhase: "calling" → "talking" → "inputting" の3フェーズ制御
 * - コールシステム連動:
 *   1. 通話接続検知 → calling → talking (handleConnect)
 *   2. 顧客側切電検知 → talking → inputting (handleHangup)
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ActionButton } from "../../_components/ActionButton";
import { BreezeDualTimer } from "../../_components/BreezeDualTimer";
import { GlassPanel } from "../../_components/GlassPanel";
import { MapLink } from "../../_components/MapLink";
import { ProspectList } from "../../_components/ProspectList";
import { WireframeLabel } from "../../_components/WireframeLabel";
import { SPROUT_BUTTONS } from "../../_constants/callButtons";
import { C } from "../../_constants/colors";
import { SHOW_DEMO_CONTROLS } from "../../_constants/flags";
import { TREE_PATHS } from "../../_constants/screens";
import { insertCall } from "../../_lib/queries";
import { useTreeState } from "../../_state/TreeStateContext";
import { supabase } from "../../_lib/supabase";
import { insertTreeCallRecord } from "../../_actions/insertTreeCallRecord";
import { labelToResultCode, resultCodeToGroup, isMemoRequired } from "../../_lib/resultCodeMapping";
import { useCallShortcuts } from "../../_hooks/useCallShortcuts";
import { useCallRollback } from "../../_hooks/useCallRollback";

/** F キー → Sprout ボタンラベルのマッピング（spec §4 通り） */
const SPROUT_BUTTONS_BY_KEY: Record<string, string> = {
  F1: "トス",
  F2: "担不",
  F3: "見込 A",
  F4: "見込 B",
  F5: "見込 C",
  F6: "不通",
  F7: "NG お断り",
  F8: "NG クレーム",
  F9: "NG 契約済",
  F10: "NG その他",
};

/** デモ用顧客データ */
const DEMO_CUSTOMER = {
  name: "山田 太郎",
  address: "東京都渋谷区神南1-2-3",
  phone: "03-1234-5678",
};

export default function CallingSproutPage() {
  const router = useRouter();
  const { treeUser } = useTreeState();

  // --- タイマーリセット用キー ---
  const [timerKey, setTimerKey] = useState(0);
  const [talkTimerKey, setTalkTimerKey] = useState(0);
  const [inputTimerKey, setInputTimerKey] = useState(0);

  // --- フェーズ制御 ---
  const [callPhase, setCallPhase] = useState<
    "calling" | "talking" | "inputting"
  >("calling");

  // --- 結果入力 ---
  const [selectedResult, setSelectedResult] = useState<string | null>(null);
  const [callMemo, setCallMemo] = useState("");
  const [ngReason, setNgReason] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [nextTime, setNextTime] = useState("");

  // --- 通話時刻（DB保存用） ---
  const [connectedAt, setConnectedAt] = useState<Date | null>(null);
  const [hangupAt, setHangupAt] = useState<Date | null>(null);

  // --- 保存中・エラー ---
  const [savingCall, setSavingCall] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // --- Step 6: 巻き戻し hook ---
  const { armRollback, performRollback, canRollback } = useCallRollback();

  // --- Step 5: FM 互換ショートカット ---
  useCallShortcuts(SPROUT_BUTTONS_BY_KEY, {
    onResult: (label) => setSelectedResult(label),
    onRollback: () => {
      if (canRollback) {
        performRollback().then((res) => {
          if (!res.success) setSaveError(res.error ?? "巻き戻しに失敗しました");
          else setSaveError(null);
        });
      }
    },
    onCancelMemo: () => setCallMemo(""),
    onConfirmMemo: () => {},
  });

  // --- 派生フラグ ---
  const isProspect =
    selectedResult !== null &&
    (selectedResult.startsWith("見込") || selectedResult === "コイン");
  const needsMemo = selectedResult === "トス" || isProspect;
  const memoRequired = selectedResult === "トス";
  const ngOtherSelected = selectedResult === "NG その他";
  const canProceed =
    (!memoRequired || callMemo.trim().length > 0) &&
    (!isProspect || (nextDate !== "" && nextTime !== ""));
  const canProceedNg = !ngOtherSelected || ngReason.trim().length > 0;

  // --- フェーズ遷移ハンドラ ---
  const handleConnect = () => {
    setConnectedAt(new Date());
    setCallPhase("talking");
    setTalkTimerKey((k) => k + 1);
  };

  const handleHangup = () => {
    setHangupAt(new Date());
    setCallPhase("inputting");
    setInputTimerKey((k) => k + 1);
  };

  const handleSubmit = async () => {
    if (!canProceed || !canProceedNg) return;
    if (savingCall) return;
    if (!selectedResult) return;
    if (!treeUser) {
      setSaveError("認証情報が取得できません。再ログインしてください");
      return;
    }

    setSavingCall(true);
    setSaveError(null);

    // 時刻を確定
    const endAt = hangupAt ?? new Date();
    const startAt = connectedAt ?? endAt; // 未接続の場合は 0秒扱い

    // 見込み選択時の次回対応日時
    const nextContact =
      isProspect && nextDate && nextTime
        ? new Date(`${nextDate}T${nextTime}:00`)
        : undefined;

    const result = await insertCall({
      employee_id: treeUser.employee_id,
      started_at: startAt,
      ended_at: endAt,
      result_code: selectedResult,
      call_mode: "sprout",
      customer_name: cu.name,
      phone: cu.phone,
      next_contact_at: nextContact,
      ng_reason: ngReason || undefined,
      memo: callMemo || undefined,
    });

    if (!result.success) {
      setSaveError(result.error ?? "保存に失敗しました");
      setSavingCall(false);
      return;
    }

    // D-02 Step 3: tree_call_records への INSERT（既存 insertCall と並走）
    const tcrCode = labelToResultCode(selectedResult);
    if (tcrCode) {
      // トス時メモ必須（UI 側でも canProceed で担保済みだが念のため確認）
      if (isMemoRequired(tcrCode) && !callMemo.trim()) {
        setSaveError("トス時はメモが必須です");
        setSavingCall(false);
        return;
      }

      const sessionId = typeof window !== "undefined"
        ? window.localStorage.getItem("tree.current_session_id")
        : null;
      const campaignCode = typeof window !== "undefined"
        ? window.localStorage.getItem("tree.current_campaign_code")
        : null;

      if (sessionId && campaignCode) {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token ?? "";

        const durationSec =
          connectedAt && hangupAt
            ? Math.round((hangupAt.getTime() - connectedAt.getTime()) / 1000)
            : null;

        const tcrResult = await insertTreeCallRecord({
          session_id: sessionId,
          campaign_code: campaignCode,
          result_code: tcrCode,
          result_group: resultCodeToGroup(tcrCode),
          memo: callMemo || undefined,
          duration_sec: durationSec,
          accessToken,
        });

        if (!tcrResult.success) {
          console.error("[sprout] insertTreeCallRecord failed:", tcrResult);
          setSaveError(tcrResult.errorMessage);
          setSavingCall(false);
          return;
        }

        // Step 6: INSERT 成功後 5s 間の巻き戻しを有効化
        armRollback(tcrResult.call_id);
      } else {
        console.warn("[sprout] no active session in localStorage, tree_call_records INSERT skipped");
      }
    }

    // 保存成功 → 入力リセット・次の架電へ
    setSelectedResult(null);
    setCallMemo("");
    setNgReason("");
    setNextDate("");
    setNextTime("");
    setConnectedAt(null);
    setHangupAt(null);
    setCallPhase("calling");
    setTimerKey((k) => k + 1);
    setSavingCall(false);
  };

  const cu = DEMO_CUSTOMER;

  return (
    <div
      style={{
        padding: "24px 40px 80px",
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      {/* ワイヤーフレームラベル */}
      <div style={{ position: "relative", marginBottom: 20 }}>
        <WireframeLabel color={C.lightGreen}>
          画面4: 架電画面（Sprout / Breeze）
        </WireframeLabel>
        <div style={{ paddingTop: 8 }} />
      </div>

      {/* タイマーバー + アクションボタン */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          gap: 8,
        }}
      >
        <div
          key={`${timerKey}-${talkTimerKey}-${inputTimerKey}`}
          style={{ flex: 1 }}
        >
          <BreezeDualTimer
            callPhase={callPhase}
            callTimerKey={timerKey}
            talkTimerKey={talkTimerKey}
            inputTimerKey={inputTimerKey}
            threshold={20}
            inputThreshold={60}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <ActionButton
            label="Q&A検索"
            color={C.bgWarm2}
            textColor={C.midGreen}
            icon="❓"
            onClick={() => router.push(TREE_PATHS.QA_SEARCH)}
          />
          {SHOW_DEMO_CONTROLS && callPhase === "calling" && (
            <ActionButton
              label="通話接続（※デモ用）"
              color="#3478c6"
              icon="📞"
              onClick={handleConnect}
            />
          )}
          {(callPhase === "calling" || callPhase === "talking") && (
            <ActionButton
              label="切電"
              color={C.red}
              icon="📴"
              onClick={handleHangup}
            />
          )}
          {callPhase === "inputting" && (
            <ActionButton
              label={savingCall ? "保存中..." : "次の架電へ"}
              color={
                canProceed && canProceedNg && !savingCall
                  ? `linear-gradient(135deg, ${C.darkGreen}, ${C.midGreen})`
                  : "#ccc"
              }
              icon="→"
              onClick={handleSubmit}
              disabled={savingCall || !canProceed || !canProceedNg}
            />
          )}
        </div>
      </div>

      {/* 保存エラー表示 */}
      {saveError && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 14px",
            background: "rgba(196,74,74,0.08)",
            border: `1px solid ${C.red}`,
            borderRadius: 10,
            color: C.red,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          ⚠️ 保存に失敗しました: {saveError}
        </div>
      )}

      {/* Step 6: 巻き戻しボタン（5s 以内のみ表示） */}
      {canRollback && (
        <div
          style={{
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <button
            onClick={() =>
              performRollback().then((res) => {
                if (!res.success) setSaveError(res.error ?? "巻き戻しに失敗しました");
                else setSaveError(null);
              })
            }
            style={{
              padding: "8px 18px",
              border: `1px solid ${C.gold}`,
              borderRadius: 10,
              background: "rgba(201,168,76,0.08)",
              color: C.goldDark ?? C.gold,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'Noto Sans JP', sans-serif",
              transition: "all 0.15s ease",
            }}
          >
            ↩ 巻き戻し（Ctrl+Z）
          </button>
          <span style={{ fontSize: 11, color: C.textMuted }}>
            5秒以内のみ有効
          </span>
        </div>
      )}

      {/* pulse アニメーション（タイマードット用） */}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>

      {/* 架電結果ボタン + 見込み一覧 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 260px",
          gap: 16,
          marginBottom: 16,
        }}
      >
        {/* 左: 架電結果パネル */}
        <GlassPanel style={{ padding: 16 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: C.textSub,
              marginBottom: 12,
            }}
          >
            架電結果
          </div>

          {/* 上段ボタン（5列） */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 8,
              marginBottom: 8,
            }}
          >
            {SPROUT_BUTTONS.filter((b) => b.group === "top").map((b) => (
              <button
                key={b.label}
                onClick={() => setSelectedResult(b.label)}
                onMouseEnter={(e) => {
                  if (selectedResult !== b.label)
                    e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                }}
                style={{
                  padding: "14px 8px",
                  border:
                    selectedResult === b.label
                      ? `2px solid ${b.color}`
                      : "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 14,
                  background:
                    selectedResult === b.label ? b.color : C.white,
                  color:
                    selectedResult === b.label ? C.white : b.color,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Noto Sans JP', sans-serif",
                  transition: "all 0.2s ease",
                  boxShadow:
                    selectedResult === b.label
                      ? `0 4px 16px ${b.color}33`
                      : "none",
                }}
              >
                {b.label}
              </button>
            ))}
          </div>

          {/* 下段ボタン（5列） */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 8,
            }}
          >
            {SPROUT_BUTTONS.filter((b) => b.group === "bottom").map((b) => (
              <button
                key={b.label}
                onClick={() => setSelectedResult(b.label)}
                onMouseEnter={(e) => {
                  if (selectedResult !== b.label)
                    e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                }}
                style={{
                  padding: "14px 8px",
                  border:
                    selectedResult === b.label
                      ? `2px solid ${b.color}`
                      : "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 14,
                  background:
                    selectedResult === b.label ? b.color : C.white,
                  color:
                    selectedResult === b.label ? C.white : b.color,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Noto Sans JP', sans-serif",
                  transition: "all 0.2s ease",
                  boxShadow:
                    selectedResult === b.label
                      ? `0 4px 16px ${b.color}33`
                      : "none",
                }}
              >
                {b.label}
              </button>
            ))}
          </div>

          {/* NG その他 理由入力 */}
          {ngOtherSelected && (
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  fontSize: 11,
                  color: ngReason.trim() ? C.textMuted : C.red,
                  marginBottom: 4,
                  fontWeight: 600,
                }}
              >
                その他の理由{" "}
                <span style={{ color: C.red }}>※必須</span>
              </div>
              <input
                type="text"
                placeholder="NGの理由を入力してください（入力しないと次に進めません）"
                value={ngReason}
                onChange={(e) => setNgReason(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: `1px solid ${ngReason.trim() ? "#dcedc8" : C.red}`,
                  borderRadius: 10,
                  fontSize: 13,
                  boxSizing: "border-box",
                  fontFamily: "'Noto Sans JP', sans-serif",
                  background: C.white,
                }}
              />
            </div>
          )}

          {/* 次回対応日時（見込A/B/C・コイン選択時） */}
          {isProspect && (
            <div
              style={{
                marginTop: 12,
                padding: "12px 16px",
                background: "rgba(52,120,198,0.04)",
                borderRadius: 10,
                border: `1px solid ${
                  !nextDate || !nextTime
                    ? "rgba(196,74,74,0.3)"
                    : "rgba(52,120,198,0.15)"
                }`,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#3478c6",
                  whiteSpace: "nowrap",
                }}
              >
                次回対応日時{" "}
                <span style={{ color: C.red }}>※必須</span>
              </div>
              <input
                type="date"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
                style={{
                  padding: "6px 8px",
                  border: `1px solid ${nextDate ? "#dcedc8" : C.red}`,
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: "'Noto Sans JP', sans-serif",
                  background: C.white,
                }}
              />
              <input
                type="time"
                value={nextTime}
                onChange={(e) => setNextTime(e.target.value)}
                style={{
                  padding: "6px 8px",
                  border: `1px solid ${nextTime ? "#dcedc8" : C.red}`,
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: "'Noto Sans JP', sans-serif",
                  background: C.white,
                }}
              />
              {nextDate && nextTime && (
                <div
                  style={{
                    fontSize: 10,
                    color: "#3478c6",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  → {nextDate} {nextTime}
                </div>
              )}
            </div>
          )}

          {/* 架電メモ（トス=必須、見込み=任意） */}
          {needsMemo && (
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  fontSize: 11,
                  color:
                    memoRequired && !callMemo.trim()
                      ? C.red
                      : C.textMuted,
                  marginBottom: 4,
                  fontWeight: 600,
                }}
              >
                架電メモ（コール履歴に記録）
                {memoRequired && (
                  <span style={{ color: C.red }}> ※必須</span>
                )}
              </div>
              <textarea
                placeholder={
                  memoRequired
                    ? "通話内容を入力してください（入力しないと次に進めません）"
                    : "通話内容や気づいたことをメモ（任意）"
                }
                rows={2}
                value={callMemo}
                onChange={(e) => setCallMemo(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: `1px solid ${
                    memoRequired && !callMemo.trim()
                      ? C.red
                      : "#dcedc8"
                  }`,
                  borderRadius: 10,
                  fontSize: 13,
                  boxSizing: "border-box",
                  resize: "vertical",
                  fontFamily: "'Noto Sans JP', sans-serif",
                  background: C.white,
                }}
              />
            </div>
          )}
        </GlassPanel>

        {/* 右: 見込み一覧 */}
        <GlassPanel
          style={{ padding: 16, maxHeight: 400, overflowY: "auto" }}
        >
          <ProspectList mode="sprout" />
        </GlassPanel>
      </div>

      {/* 顧客情報 + メモ欄 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
        }}
      >
        <GlassPanel>
          <div
            style={{
              fontSize: 11,
              color: C.textMuted,
              marginBottom: 12,
              fontWeight: 600,
            }}
          >
            顧客情報
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: C.textDark,
              marginBottom: 12,
            }}
          >
            {cu.name}{" "}
            <span style={{ fontSize: 14 }}>様</span>
          </div>
          <div
            style={{
              fontSize: 14,
              color: C.textSub,
              marginBottom: 8,
            }}
          >
            <MapLink address={cu.address} />
          </div>
          <div
            style={{
              fontSize: 16,
              color: C.textDark,
              fontWeight: 600,
            }}
          >
            📞 {cu.phone}
          </div>
          <div
            style={{
              marginTop: 20,
              padding: 10,
              background: "rgba(45,106,79,0.04)",
              borderRadius: 10,
              fontSize: 11,
              color: C.textMuted,
              textAlign: "center",
            }}
          >
            【過去の履歴：完全非表示】
          </div>
        </GlassPanel>

        <GlassPanel>
          <div
            style={{
              fontSize: 11,
              color: C.textMuted,
              marginBottom: 16,
              fontWeight: 600,
            }}
          >
            メモ欄
          </div>
          <div
            style={{
              background: "rgba(45,106,79,0.03)",
              borderRadius: 12,
              padding: 20,
              fontSize: 13,
              lineHeight: 1.8,
              color: C.textMuted,
              minHeight: 180,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ※ トークスクリプトはヘッダーの📜アイコンからご利用ください
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
