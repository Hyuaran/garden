"use client";

/**
 * Garden-Tree 通話画面 (/tree/call)
 *
 * プロトタイプの <InCallScreen /> を移植。
 * Branch / Manager 権限で使用するメイン通話画面。
 *
 * 構成:
 *  1. QuadTimer（4フェーズ: waiting → calling → talking → inputting）
 *  2. アクションボタン（Q&A検索 / 発信 / 通話接続デモ / 切電 / 次の架電へ）
 *  3. 通話結果ボタン（RESULT_BUTTONS or 前確/後確用ボタン）
 *  4. NG理由入力 / 次回対応日時 / 架電メモ
 *  5. 顧客情報パネル + トークスクリプト（ピン止め可）
 *  6. ヒアリング項目（Sprout 以外）
 *  7. 見込み一覧サイドバー
 *  8. ConfirmSidePanel（前確/後確/トス通話時のみ表示）
 *
 * - confirmMode が設定されている場合、前確/後確/トスの専用UIになる
 * - コールシステム連動（将来）: callConnected/callDisconnected イベントで自動フェーズ遷移
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ActionButton } from "../_components/ActionButton";
import {
  ConfirmSidePanel,
  type ConfirmItem,
  type ConfirmMode,
  type TossItem,
} from "../_components/ConfirmSidePanel";
import { GlassPanel } from "../_components/GlassPanel";
import { MapLink } from "../_components/MapLink";
import { ProspectList } from "../_components/ProspectList";
import { QuadTimer } from "../_components/QuadTimer";
import { WireframeLabel } from "../_components/WireframeLabel";
import { RESULT_BUTTONS } from "../_constants/callButtons";
import { C } from "../_constants/colors";
import { SHOW_DEMO_CONTROLS } from "../_constants/flags";
import { ROLES } from "../_constants/roles";
import { TREE_PATHS } from "../_constants/screens";
import { useTreeState } from "../_state/TreeStateContext";

/** デモ用: 前確/後確キュー */
const DEMO_CONFIRM_QUEUE: ConfirmItem[] = [
  {
    id: "c1",
    type: "前確",
    customer: "田中 一郎",
    phone: "03-1111-2222",
    closer: "石原 孝志朗",
    time: "14:00",
  },
  {
    id: "c2",
    type: "後確",
    customer: "伊藤 美佳",
    phone: "06-3333-4444",
    closer: "萩尾 拓也",
    time: "15:30",
    scheduledTime: "16:00",
  },
];

/** デモ用: トス待ちキュー */
const DEMO_TOSS_QUEUE: TossItem[] = [
  {
    id: "t1",
    customer: "渡辺 太一",
    phone: "03-5555-6666",
    tosser: "東海林 美琴",
    time: "14:20",
    memo: "光コラボに興味あり、転用希望",
  },
];

export default function InCallPage() {
  const router = useRouter();
  const { role } = useTreeState();

  // --- フェーズ制御 ---
  const [phase, setPhase] = useState<
    "waiting" | "calling" | "talking" | "inputting"
  >("waiting");
  const [waitKey, setWaitKey] = useState(0);
  const [callKey, setCallKey] = useState(0);
  const [talkKey, setTalkKey] = useState(0);
  const [inputKey, setInputKey] = useState(0);

  // --- スクリプト ---
  const [scriptOpen, setScriptOpen] = useState(role === ROLES.SPROUT);
  const [scriptPinned, setScriptPinned] = useState(false);

  // --- 結果入力 ---
  const [selectedResult, setSelectedResult] = useState<string | null>(
    null,
  );
  const [ngReason, setNgReason] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [nextTime, setNextTime] = useState("");

  // --- 確認モード ---
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>(null);
  const [sidePanelTab, setSidePanelTab] = useState<string | null>(null);

  // --- 派生値 ---
  const isConfirm =
    !!confirmMode && confirmMode.type !== "クローザー";
  const isFromToss =
    !!confirmMode && confirmMode.type === "クローザー";
  const cType = confirmMode?.type || "";
  const prefix = cType;

  const isProspectResult =
    !isConfirm &&
    selectedResult !== null &&
    (selectedResult.startsWith("見込") || selectedResult === "コイン");

  const canProceed = isConfirm
    ? (selectedResult !== `${prefix}NG その他` ||
        ngReason.trim().length > 0) &&
      (selectedResult !== "時間指定" || (!!scheduleDate && !!scheduleTime))
    : (selectedResult !== "NG その他" ||
        ngReason.trim().length > 0) &&
      (!isProspectResult || (!!nextDate && !!nextTime));

  const cu =
    isConfirm || isFromToss
      ? {
          name: confirmMode!.customer,
          address: "",
          phone: confirmMode!.phone,
        }
      : {
          name: "山田 太郎",
          address: "東京都渋谷区神南1-2-3",
          phone: "03-1234-5678",
        };

  // --- 前確/後確用ボタン定義 ---
  const confirmButtons = isConfirm
    ? {
        top: [
          { label: `${prefix}OK`, color: C.midGreen },
          { label: "担不", color: "#888" },
          { label: "時間指定", color: "#3478c6" },
        ],
        bottom: [
          { label: "返却", color: C.gold },
          { label: `${prefix}NG お断り`, color: "#c44a4a" },
          { label: `${prefix}NG クレーム`, color: "#c44a4a" },
          { label: `${prefix}NG 契約済`, color: "#c44a4a" },
          { label: `${prefix}NG その他`, color: "#c44a4a" },
        ],
      }
    : null;

  // --- フェーズ遷移ハンドラ ---
  const handleDial = () => {
    setPhase("calling");
    setCallKey((k) => k + 1);
  };
  const handleConnect = () => {
    setPhase("talking");
    setTalkKey((k) => k + 1);
  };
  const handleHangup = () => {
    setPhase("inputting");
    setInputKey((k) => k + 1);
  };
  const handleSubmit = () => {
    if (canProceed) {
      if (isConfirm) {
        setConfirmMode(null);
        router.push(TREE_PATHS.CONFIRM_WAIT);
      } else if (isFromToss) {
        setConfirmMode(null);
        router.push(TREE_PATHS.TOSS_WAIT);
      } else {
        setPhase("waiting");
        setWaitKey((k) => k + 1);
      }
      setSelectedResult(null);
      setNgReason("");
      setScheduleDate("");
      setScheduleTime("");
      setNextDate("");
      setNextTime("");
    }
  };

  const handlePanelSelect = (item: {
    type: string;
    customer: string;
    phone: string;
    closer: string;
  }) => {
    setConfirmMode(item);
    setPhase("waiting");
    setWaitKey((k) => k + 1);
    setSelectedResult(null);
    setNgReason("");
    setScheduleDate("");
    setScheduleTime("");
    setNextDate("");
    setNextTime("");
  };

  // --- レンダーヘルパー: 結果ボタン ---
  const renderResultButton = (
    b: { label: string; color: string },
  ) => (
    <button
      key={b.label}
      onClick={() => setSelectedResult(b.label)}
      style={{
        padding: "12px 8px",
        border:
          selectedResult === b.label
            ? `2px solid ${b.color}`
            : "1px solid rgba(0,0,0,0.08)",
        borderRadius: 12,
        background:
          selectedResult === b.label ? b.color : C.white,
        color: selectedResult === b.label ? C.white : b.color,
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "'Noto Sans JP', sans-serif",
      }}
    >
      {b.label}
    </button>
  );

  return (
    <div
      style={{
        padding: "24px 40px 80px",
        maxWidth: 1200,
        margin: "0 auto",
        marginRight: sidePanelTab ? 320 : "auto",
        transition: "margin-right 0.3s ease",
      }}
    >
      {/* ワイヤーフレームラベル */}
      <div style={{ position: "relative", marginBottom: 20 }}>
        <WireframeLabel
          color={
            isConfirm
              ? cType === "前確"
                ? "#3478c6"
                : "#e67e22"
              : isFromToss
                ? "#e67e22"
                : "#2d6a8a"
          }
        >
          {isConfirm
            ? `${prefix}通話画面 — ${cu.name} 様`
            : isFromToss
              ? `クローザー通話画面 — ${cu.name} 様`
              : "画面5: 通話画面（クローザー・責任者）"}
        </WireframeLabel>
        <div style={{ paddingTop: 8 }} />
      </div>

      {/* タイマー + アクションボタン */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          gap: 8,
        }}
      >
        <div style={{ flex: 1 }}>
          <QuadTimer
            phase={phase}
            waitKey={waitKey}
            callKey={callKey}
            talkKey={talkKey}
            inputKey={inputKey}
            waitThreshold={60}
            callThreshold={20}
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
          {phase === "waiting" && (
            <ActionButton
              label="発信"
              color={`linear-gradient(135deg, ${C.darkGreen}, ${C.midGreen})`}
              icon="📞"
              onClick={handleDial}
            />
          )}
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
          {phase === "inputting" && (
            <ActionButton
              label={
                isConfirm ? `${prefix}結果を保存` : "次の架電へ"
              }
              color={
                canProceed
                  ? `linear-gradient(135deg, ${C.darkGreen}, ${C.midGreen})`
                  : "#ccc"
              }
              icon="→"
              onClick={handleSubmit}
            />
          )}
        </div>
      </div>

      {/* pulse アニメーション */}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>

      {/* 通話結果ボタン + 見込み一覧 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 260px",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <GlassPanel style={{ padding: 16 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: C.textSub,
              marginBottom: 12,
            }}
          >
            {isConfirm ? `${prefix}結果` : "通話結果"}
          </div>

          {isConfirm && confirmButtons ? (
            <>
              {/* 前確/後確用ボタン: 上段 */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, 1fr)",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                {confirmButtons.top.map(renderResultButton)}
                {selectedResult === "時間指定" ? (
                  <>
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) =>
                        setScheduleDate(e.target.value)
                      }
                      style={{
                        padding: "8px 10px",
                        border: "1px solid #dcedc8",
                        borderRadius: 8,
                        fontSize: 12,
                        fontFamily: "'Noto Sans JP', sans-serif",
                        background: C.white,
                        boxSizing: "border-box",
                      }}
                    />
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) =>
                        setScheduleTime(e.target.value)
                      }
                      style={{
                        padding: "8px 10px",
                        border: "1px solid #dcedc8",
                        borderRadius: 8,
                        fontSize: 12,
                        fontFamily: "'Noto Sans JP', sans-serif",
                        background: C.white,
                        boxSizing: "border-box",
                      }}
                    />
                  </>
                ) : (
                  <>
                    <div />
                    <div />
                  </>
                )}
              </div>
              {scheduleDate &&
                scheduleTime &&
                selectedResult === "時間指定" && (
                  <div
                    style={{
                      marginBottom: 8,
                      fontSize: 11,
                      color: "#3478c6",
                      fontWeight: 600,
                      textAlign: "right",
                    }}
                  >
                    → {scheduleDate} {scheduleTime}{" "}
                    に後確として再登録
                  </div>
                )}
              {/* 前確/後確用ボタン: 下段 */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, 1fr)",
                  gap: 8,
                }}
              >
                {confirmButtons.bottom.map(renderResultButton)}
              </div>
            </>
          ) : (
            <>
              {/* 通常通話: RESULT_BUTTONS 上段（6列） */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(6, 1fr)",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                {RESULT_BUTTONS.filter((b) => b.group === "top").map(
                  renderResultButton,
                )}
              </div>
              {/* 通常通話: RESULT_BUTTONS 下段（5列） */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, 1fr)",
                  gap: 8,
                }}
              >
                {RESULT_BUTTONS.filter(
                  (b) => b.group === "bottom",
                ).map(renderResultButton)}
              </div>
            </>
          )}

          {/* NG その他 理由入力 */}
          {(selectedResult === "NG その他" ||
            selectedResult === `${prefix}NG その他`) && (
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

          {/* 次回対応日時（見込A/B/C・コイン選択時・通常通話のみ） */}
          {isProspectResult && (
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

          {/* 架電メモ */}
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                fontSize: 11,
                color: C.textMuted,
                marginBottom: 4,
                fontWeight: 600,
              }}
            >
              架電メモ（コール履歴に記録）
            </div>
            <textarea
              placeholder="通話内容や気づいたことをメモ（任意）"
              rows={2}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #dcedc8",
                borderRadius: 10,
                fontSize: 13,
                boxSizing: "border-box",
                resize: "vertical",
                fontFamily: "'Noto Sans JP', sans-serif",
                background: C.white,
              }}
            />
          </div>
        </GlassPanel>

        {/* 見込み一覧 */}
        <GlassPanel
          style={{ padding: 16, maxHeight: 400, overflowY: "auto" }}
        >
          <ProspectList mode="branch" />
        </GlassPanel>
      </div>

      {/* 顧客情報 + トークスクリプト */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          marginBottom: 16,
        }}
      >
        <GlassPanel style={{ padding: 20 }}>
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
              fontSize: 24,
              fontWeight: 800,
              color: C.textDark,
              marginBottom: 8,
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
              marginBottom: 12,
            }}
          >
            📞 {cu.phone}
          </div>
          {role !== ROLES.SPROUT && (
            <div
              style={{
                fontSize: 11,
                color: C.textMuted,
                padding: "8px 10px",
                background: "rgba(45,106,79,0.04)",
                borderRadius: 8,
              }}
            >
              PF判定: 提供可 / NTT西日本 / フレッツ光ネクスト
            </div>
          )}
        </GlassPanel>

        <GlassPanel style={{ padding: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom:
                scriptOpen || scriptPinned ? 12 : 0,
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
              <span style={{ color: C.midGreen, fontWeight: 600 }}>
                → PF情報を基に提案へ
              </span>
            </div>
          )}
        </GlassPanel>
      </div>

      {/* ヒアリング項目（Sprout 以外） */}
      {role !== ROLES.SPROUT && (
        <GlassPanel style={{ padding: 16 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: C.textSub,
              marginBottom: 12,
            }}
          >
            ヒアリング項目
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 12,
            }}
          >
            {[
              "現在の回線状況",
              "月額料金",
              "契約満了時期",
              "利用人数",
              "要望・課題",
              "備考",
            ].map((label) => (
              <div key={label}>
                <div
                  style={{
                    fontSize: 11,
                    color: C.textMuted,
                    marginBottom: 4,
                  }}
                >
                  {label}
                </div>
                <input
                  type="text"
                  placeholder={`${label}を入力`}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #dcedc8",
                    borderRadius: 10,
                    fontSize: 13,
                    boxSizing: "border-box",
                    fontFamily: "'Noto Sans JP', sans-serif",
                    background: C.white,
                  }}
                />
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* ConfirmSidePanel（前確/後確/トス通話時のみ） */}
      {(isConfirm || isFromToss) && (
        <ConfirmSidePanel
          activeTab={sidePanelTab}
          onTabSelect={setSidePanelTab}
          confirmQueue={DEMO_CONFIRM_QUEUE}
          tossQueue={DEMO_TOSS_QUEUE}
          currentConfirmMode={confirmMode}
          onSelectItem={handlePanelSelect}
          onNavigate={(path) => router.push(path)}
        />
      )}
    </div>
  );
}
