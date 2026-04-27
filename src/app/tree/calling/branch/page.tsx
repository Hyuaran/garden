"use client";

/**
 * Garden-Tree Branch 架電画面 (/tree/calling/branch)
 *
 * プロトタイプの <CallingBranchScreen /> を移植。
 *
 * 構成:
 *  1. アクションボタン（Q&A検索 / 通話接続デモ / 切電 / 次の架電へ）
 *  2. 顧客情報 + CallTimer（コンパクト）+ PF バッジ + 警告タグ
 *  3. フェーズ別アクションパネル（発信 / 留守・不通 / 通話中 / 結果入力中）
 *  4. 3カラムレイアウト:
 *     - 左: コール履歴 + アポ禁設定
 *     - 中央: トークスクリプト（ピン止め可） + 架電リスト
 *     - 右: 自動取得情報（PF）
 *
 * - サイドバー・KPIヘッダーは TreeShell が描画するため、本ページは中身のみ。
 * - phase: "waiting" → "calling" → "talking" → "inputting" の4フェーズ制御
 * - コールシステム連動:
 *   1. 通話接続検知 → calling → talking (handleConnect)
 *   2. 顧客側切電検知 → talking → inputting (handleHangup)
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ActionButton } from "../../_components/ActionButton";
import { CallTimer } from "../../_components/CallTimer";
import { GlassPanel } from "../../_components/GlassPanel";
import { MapLink } from "../../_components/MapLink";
import { WireframeLabel } from "../../_components/WireframeLabel";
import { RESULT_BUTTONS } from "../../_constants/callButtons";
import { C } from "../../_constants/colors";
import { SHOW_DEMO_CONTROLS } from "../../_constants/flags";
import { TREE_PATHS } from "../../_constants/screens";
import { insertCall } from "../../_lib/queries";
import { useTreeState } from "../../_state/TreeStateContext";
import { supabase } from "../../_lib/supabase";
import { insertTreeCallRecordWithQueue } from "../../_lib/insertTreeCallRecordWithQueue";
import { labelToResultCode, resultCodeToGroup } from "../../_lib/resultCodeMapping";
import { useCallShortcuts } from "../../_hooks/useCallShortcuts";
import { useCallRollback } from "../../_hooks/useCallRollback";
import { useCallGuard } from "../../_hooks/useCallGuard";
import { useOfflineQueue } from "../../_hooks/useOfflineQueue";
import { NetworkStatusBadge } from "../../_components/NetworkStatusBadge";

/** F キー → Branch ボタンラベルのマッピング（spec §4 通り） */
const BRANCH_BUTTONS_BY_KEY: Record<string, string> = {
  F1: "受注",
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

/** デモ用顧客リストデータ */
type Customer = {
  name: string;
  address: string;
  phone: string;
  pf: string;
  judge: string;
};

const DEMO_CUSTOMERS: Customer[] = [
  {
    name: "佐藤 花子",
    address: "大阪府大阪市北区梅田1-1-1",
    phone: "06-9876-5432",
    pf: "提供可",
    judge: "優良顧客",
  },
  {
    name: "鈴木 一郎",
    address: "東京都新宿区西新宿2-8-1",
    phone: "03-5555-1234",
    pf: "提供可",
    judge: "新規",
  },
  {
    name: "高橋 美咲",
    address: "神奈川県横浜市中区山下町1",
    phone: "045-222-3456",
    pf: "要確認",
    judge: "再コール",
  },
];

/** デモ用コール履歴 */
const DEMO_HISTORY = [
  { date: "2024.10.25", result: "留守", tag: "光コラボ", warn: false },
  {
    date: "2024.09.12",
    result: "再コール",
    tag: "他社契約中",
    warn: false,
  },
  {
    date: "2024.07.30",
    result: "NG",
    tag: "クレーム気味",
    warn: true,
  },
];

/** デモ用警告タグ */
const WARN_TAGS: [string, string, string][] = [
  ["クレーム気味", "#fde8e8", C.red],
  ["リテラシー低", "#fff3e0", C.gold],
];

/** デモ用 PF 情報 */
const PF_ITEMS = (pf: string) => [
  { label: "エリア", value: "NTT西日本", hl: false },
  { label: "回線種別", value: "フレッツ光ネクスト", hl: false },
  { label: "提供判定", value: pf, hl: pf === "提供可" },
  { label: "現契約", value: "他社光コラボ", hl: false },
  { label: "他商材", value: "電気：未契約 / ガス：契約中", hl: false },
];

export default function CallingBranchPage() {
  const router = useRouter();
  const { treeUser } = useTreeState();

  // --- フェーズ制御 ---
  const [phase, setPhase] = useState<
    "waiting" | "calling" | "talking" | "inputting"
  >("waiting");
  const [timerKey, setTimerKey] = useState(0);

  // --- 顧客選択 ---
  const [selectedCustomer, setSelectedCustomer] = useState(0);

  // --- スクリプト開閉 ---
  const [scriptOpen, setScriptOpen] = useState(false);
  const [scriptPinned, setScriptPinned] = useState(false);

  // --- 通話時刻（DB保存用） ---
  const [connectedAt, setConnectedAt] = useState<Date | null>(null);
  const [hangupAt, setHangupAt] = useState<Date | null>(null);

  // --- 保存中・エラー ---
  const [savingCall, setSavingCall] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // --- Step 6: 巻き戻し hook ---
  const { armRollback, performRollback, canRollback } = useCallRollback();

  // --- Step 7: オフラインキュー ---
  const { queueSize } = useOfflineQueue();

  // --- Step 8: 画面遷移ガード（beforeunload） ---
  // 巻き戻しウィンドウ中 or オフラインキューあり = 通話中扱い
  useCallGuard({
    isCalling: canRollback,
    hasOfflineQueue: queueSize > 0,
  });

  const cu = DEMO_CUSTOMERS[selectedCustomer];

  // --- フェーズ遷移ハンドラ ---
  const handleDial = () => {
    setPhase("calling");
    setTimerKey((k) => k + 1);
  };
  const handleConnect = () => {
    setConnectedAt(new Date());
    setPhase("talking");
    setTimerKey((k) => k + 1);
  };
  const handleHangup = () => {
    setHangupAt(new Date());
    setPhase("inputting");
    setTimerKey((k) => k + 1);
  };

  /**
   * 結果を保存してフォームをリセットする共通処理。
   * - 留守 / 不通（未接続）: startAt = endAt = 現在時刻（0秒扱い）
   * - 通話後の結果選択: startAt = connectedAt, endAt = hangupAt
   */
  const saveAndReset = async (resultCode: string) => {
    if (savingCall) return;
    if (!treeUser) {
      setSaveError("認証情報が取得できません。再ログインしてください");
      return;
    }
    setSavingCall(true);
    setSaveError(null);

    const endAt = hangupAt ?? new Date();
    const startAt = connectedAt ?? endAt;

    const result = await insertCall({
      employee_id: treeUser.employee_id,
      started_at: startAt,
      ended_at: endAt,
      result_code: resultCode,
      call_mode: "branch",
      customer_name: cu.name,
      phone: cu.phone,
    });

    if (!result.success) {
      setSaveError(result.error ?? "保存に失敗しました");
      setSavingCall(false);
      return;
    }

    // D-02 Step 4: tree_call_records への INSERT（既存 insertCall と並走）
    const tcrCode = labelToResultCode(resultCode);
    if (tcrCode) {
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

        const tcrResult = await insertTreeCallRecordWithQueue({
          session_id: sessionId,
          campaign_code: campaignCode,
          result_code: tcrCode,
          result_group: resultCodeToGroup(tcrCode),
          duration_sec: durationSec,
          accessToken,
        });

        if (!tcrResult.success) {
          console.error("[branch] insertTreeCallRecord failed:", tcrResult);
          setSaveError(tcrResult.errorMessage);
          setSavingCall(false);
          return;
        }

        // Step 6: INSERT 成功後 5s 間の巻き戻しを有効化（オフラインキュー分は対象外）
        if (!tcrResult.offline) {
          armRollback(tcrResult.call_id);
        }
      } else {
        console.warn("[branch] no active session in localStorage, tree_call_records INSERT skipped");
      }
    }

    setConnectedAt(null);
    setHangupAt(null);
    setPhase("waiting");
    setTimerKey((k) => k + 1);
    setSavingCall(false);
  };

  // --- Step 5: FM 互換ショートカット ---
  useCallShortcuts(BRANCH_BUTTONS_BY_KEY, {
    onResult: (label) => {
      if (phase === "calling" && (label === "留守" || label === "不通")) {
        saveAndReset(label);
      } else if (phase === "inputting") {
        saveAndReset(label);
      }
    },
    onRollback: () => {
      if (canRollback) {
        performRollback().then((res) => {
          if (!res.success) setSaveError(res.error ?? "巻き戻しに失敗しました");
          else setSaveError(null);
        });
      }
    },
  });

  return (
    <div
      style={{
        padding: "24px 24px 80px",
        maxWidth: 1400,
        margin: "0 auto",
      }}
    >
      {/* ワイヤーフレームラベル + ネットワーク状態バッジ */}
      <div
        style={{
          position: "relative",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <WireframeLabel color={C.goldDark}>
          画面4: 架電画面（Branch / Dew）
        </WireframeLabel>
        <NetworkStatusBadge />
      </div>

      {/* アクションボタン行 */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <ActionButton
          label="Q&A検索"
          color={C.bgWarm2}
          textColor={C.midGreen}
          icon="❓"
          onClick={() => router.push(TREE_PATHS.QA_SEARCH)}
        />
        {SHOW_DEMO_CONTROLS && phase === "calling" && (
          <ActionButton
            label="通話接続（※デモ用）"
            color="#3478c6"
            icon="📞"
            onClick={handleConnect}
          />
        )}
        {(phase === "calling" || phase === "talking") && (
          <ActionButton
            label="切電"
            color={C.red}
            icon="📴"
            onClick={handleHangup}
          />
        )}
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

      {/* 顧客情報パネル + フェーズ別アクション */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 16,
          marginBottom: 16,
        }}
      >
        {/* 左: 顧客情報 */}
        <GlassPanel style={{ padding: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <div key={timerKey} style={{ marginBottom: 12 }}>
                <CallTimer
                  phase={phase}
                  threshold={phase === "waiting" ? 60 : 20}
                />
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: C.textMuted,
                  marginBottom: 8,
                  fontWeight: 600,
                }}
              >
                顧客情報
              </div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: C.textDark,
                  marginBottom: 6,
                }}
              >
                {cu.name}{" "}
                <span style={{ fontSize: 14 }}>様</span>
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: C.textSub,
                  marginBottom: 4,
                }}
              >
                <MapLink address={cu.address} />
              </div>
              <div
                style={{
                  fontSize: 15,
                  color: C.textDark,
                  fontWeight: 600,
                }}
              >
                📞 {cu.phone}
              </div>
            </div>

            {/* PF バッジ + 警告タグ */}
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  background: "rgba(45,106,79,0.06)",
                  borderRadius: 12,
                  padding: "8px 14px",
                  fontSize: 11,
                  color: C.midGreen,
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                PF: {cu.pf}
                <br />
                <span style={{ fontSize: 13, fontWeight: 800 }}>
                  {cu.judge}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 4,
                  justifyContent: "center",
                }}
              >
                {WARN_TAGS.map(([text, bg, color]) => (
                  <span
                    key={text}
                    style={{
                      fontSize: 9,
                      padding: "2px 8px",
                      borderRadius: 10,
                      background: bg,
                      color,
                      fontWeight: 600,
                    }}
                  >
                    {text}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </GlassPanel>

        {/* 右: フェーズ別アクションパネル */}
        <GlassPanel
          style={{
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            justifyContent: "center",
            minWidth: 180,
          }}
        >
          {phase === "waiting" && (
            <ActionButton
              label="発信"
              color={`linear-gradient(135deg, ${C.darkGreen}, ${C.midGreen})`}
              large
              icon="📞"
              onClick={handleDial}
            />
          )}
          {phase === "calling" && (
            <>
              <ActionButton
                label={savingCall ? "保存中..." : "留守"}
                color={C.goldDark}
                icon="📱"
                onClick={() => saveAndReset("留守")}
                disabled={savingCall}
              />
              <ActionButton
                label={savingCall ? "保存中..." : "不通"}
                color="#999"
                onClick={() => saveAndReset("不通")}
                disabled={savingCall}
              />
            </>
          )}
          {phase === "talking" && (
            <div
              style={{
                fontSize: 12,
                color: C.textMuted,
                textAlign: "center",
                padding: 8,
              }}
            >
              通話中...
            </div>
          )}
          {phase === "inputting" && (
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: C.textMuted,
                  marginBottom: 8,
                  fontWeight: 600,
                  textAlign: "center",
                }}
              >
                結果を選択
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 6,
                }}
              >
                {RESULT_BUTTONS.map((b) => (
                  <button
                    key={b.label}
                    onClick={() => saveAndReset(b.label)}
                    disabled={savingCall}
                    style={{
                      padding: "8px 4px",
                      border: "none",
                      borderRadius: 8,
                      background: b.color,
                      color: C.white,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: savingCall ? "not-allowed" : "pointer",
                      opacity: savingCall ? 0.5 : 1,
                      fontFamily: "'Noto Sans JP', sans-serif",
                      transition: "opacity 0.2s",
                    }}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </GlassPanel>
      </div>

      {/* 3カラム: コール履歴 | スクリプト+リスト | PF情報 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px 1fr 280px",
          gap: 16,
        }}
      >
        {/* 左カラム: コール履歴 + アポ禁設定 */}
        <div
          style={{
            background: "rgba(255,255,255,0.5)",
            backdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.6)",
            borderRadius: 20,
            padding: 16,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: C.textSub,
              marginBottom: 10,
            }}
          >
            コール履歴
          </div>
          {DEMO_HISTORY.map((h, i) => (
            <div
              key={i}
              style={{
                padding: "8px 10px",
                marginBottom: 6,
                background: "rgba(255,255,255,0.6)",
                borderRadius: 10,
                fontSize: 12,
                color: C.textSub,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 2 }}>
                {h.date} — {h.result}
              </div>
              <span
                style={{
                  display: "inline-block",
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 8,
                  background: h.warn
                    ? "rgba(214,48,49,0.1)"
                    : "rgba(45,106,79,0.08)",
                  color: h.warn ? C.red : C.midGreen,
                }}
              >
                {h.tag}
              </span>
            </div>
          ))}

          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: C.textSub,
              marginTop: 16,
              marginBottom: 8,
            }}
          >
            アポ禁設定
          </div>
          <select
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #dcedc8",
              fontSize: 12,
              background: "rgba(255,255,255,0.8)",
              fontFamily: "'Noto Sans JP', sans-serif",
            }}
          >
            <option>設定なし</option>
            <option>3ヶ月</option>
            <option>6ヶ月</option>
            <option>1年</option>
          </select>
        </div>

        {/* 中央カラム: トークスクリプト + 架電リスト */}
        <div>
          {/* トークスクリプト */}
          <div
            style={{
              background: "rgba(255,255,255,0.5)",
              backdropFilter: "blur(20px)",
              border: scriptPinned
                ? `2px solid ${C.midGreen}`
                : "1px solid rgba(255,255,255,0.6)",
              borderRadius: 20,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <button
                onClick={() => {
                  if (!scriptPinned) setScriptOpen(!scriptOpen);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  border: "none",
                  background: "transparent",
                  cursor: scriptPinned ? "default" : "pointer",
                  fontFamily: "'Noto Sans JP', sans-serif",
                  padding: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: C.textSub,
                  }}
                >
                  トークスクリプト
                </span>
                {!scriptPinned && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background:
                        scriptOpen || scriptPinned
                          ? "rgba(214,48,49,0.06)"
                          : "rgba(45,106,79,0.06)",
                      color:
                        scriptOpen || scriptPinned
                          ? C.red
                          : C.midGreen,
                      fontSize: 16,
                      fontWeight: 800,
                    }}
                  >
                    {scriptOpen || scriptPinned ? "−" : "＋"}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setScriptPinned(!scriptPinned);
                  if (!scriptPinned) setScriptOpen(true);
                }}
                title={
                  scriptPinned
                    ? "ピン解除"
                    : "ピン止め（常時表示）"
                }
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 10px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  background: scriptPinned
                    ? "rgba(45,106,79,0.1)"
                    : "rgba(0,0,0,0.03)",
                  color: scriptPinned ? C.midGreen : C.textMuted,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: "'Noto Sans JP', sans-serif",
                  transition: "all 0.15s ease",
                }}
              >
                📌 {scriptPinned ? "固定中" : "固定"}
              </button>
            </div>
            {(scriptOpen || scriptPinned) && (
              <div
                style={{
                  marginTop: 12,
                  background: "rgba(45,106,79,0.02)",
                  borderRadius: 12,
                  padding: 16,
                  fontSize: 14,
                  lineHeight: 2,
                  color: C.textDark,
                }}
              >
                佐藤様、以前お電話いただいた件の続きでございます。
                <br />
                現在ご契約中の回線状況を確認させていただきましたところ…
                <br />
                <br />
                <span
                  style={{
                    color: C.midGreen,
                    fontWeight: 600,
                  }}
                >
                  → PF情報を基に提案へ
                </span>
              </div>
            )}
          </div>

          {/* 架電リスト */}
          <div
            style={{
              background: "rgba(255,255,255,0.5)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.6)",
              borderRadius: 20,
              padding: 16,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: C.textSub,
                marginBottom: 10,
              }}
            >
              架電リスト
            </div>
            {DEMO_CUSTOMERS.map((c, i) => (
              <button
                key={i}
                onClick={() => {
                  setSelectedCustomer(i);
                  setPhase("waiting");
                  setTimerKey((k) => k + 1);
                }}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                  padding: "10px 14px",
                  marginBottom: 6,
                  border:
                    selectedCustomer === i
                      ? `2px solid ${C.midGreen}`
                      : "1px solid rgba(0,0,0,0.06)",
                  borderRadius: 12,
                  background:
                    selectedCustomer === i
                      ? "rgba(45,106,79,0.04)"
                      : "rgba(255,255,255,0.6)",
                  cursor: "pointer",
                  fontFamily: "'Noto Sans JP', sans-serif",
                  textAlign: "left",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: C.textDark,
                    }}
                  >
                    {c.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: C.textMuted,
                    }}
                  >
                    {c.phone}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    padding: "2px 10px",
                    borderRadius: 10,
                    background:
                      c.pf === "提供可"
                        ? "rgba(45,106,79,0.08)"
                        : "rgba(201,168,76,0.1)",
                    color:
                      c.pf === "提供可" ? C.midGreen : C.gold,
                    fontWeight: 600,
                  }}
                >
                  {c.pf}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 右カラム: PF 自動取得情報 */}
        <div
          style={{
            background: "rgba(255,255,255,0.5)",
            backdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.6)",
            borderRadius: 20,
            padding: 16,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: C.textSub,
              marginBottom: 10,
            }}
          >
            自動取得情報（PF）
          </div>
          {PF_ITEMS(cu.pf).map((item, i) => (
            <div
              key={i}
              style={{
                padding: "8px 10px",
                marginBottom: 6,
                background: "rgba(255,255,255,0.6)",
                borderRadius: 10,
              }}
            >
              <div style={{ fontSize: 10, color: C.textMuted }}>
                {item.label}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: item.hl ? C.midGreen : C.textDark,
                }}
              >
                {item.value}
              </div>
            </div>
          ))}
          <div
            style={{
              marginTop: 12,
              padding: 6,
              background: "rgba(45,106,79,0.04)",
              borderRadius: 8,
              fontSize: 10,
              color: C.textMuted,
              textAlign: "center",
            }}
          >
            Root層で自動取得済み
          </div>
        </div>
      </div>
    </div>
  );
}
