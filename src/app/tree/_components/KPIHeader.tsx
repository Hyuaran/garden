"use client";

/**
 * Garden-Tree KPI ヘッダー
 *
 * プロトタイプの <KPIHeader /> を移植。各画面の上部に貼り付く固定ヘッダー。
 *
 *  - 左: 時刻 + 権限ラベル
 *  - 中央: 当日/月間ゲージ + 本日P + 目標残P + 有効率
 *  - 右: アウト返し / スクリプト / 通知センター / 検索
 *
 * prop で受けていた stats/notifCenter 等は TreeStateContext 経由に置換。
 * 画面遷移は useRouter().push() を使う。
 */

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { C } from "../_constants/colors";
import { ROLE_CONFIG } from "../_constants/roles";
import { TREE_PATHS } from "../_constants/screens";
import { useTreeState, type NotifItem } from "../_state/TreeStateContext";
import { formatPoint as P } from "../_lib/format";
import { SemiGauge } from "./SemiGauge";

type KPIHeaderProps = {
  /** アウト返し集パネルを開く（任意） */
  onToggleOutReturn?: () => void;
  /** トークスクリプトパネルを開く（任意） */
  onToggleScript?: () => void;
};

const hdrBtn: CSSProperties = {
  border: "none",
  background: "rgba(255,255,255,0.1)",
  color: C.white,
  padding: "6px 10px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "'Noto Sans JP', sans-serif",
  display: "flex",
  alignItems: "center",
  gap: 4,
};

/** 時刻を "HH:mm" 形式で返す */
function formatClock(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function KPIHeader({
  onToggleOutReturn,
  onToggleScript,
}: KPIHeaderProps = {}) {
  const router = useRouter();
  const {
    role,
    stats,
    notifCenter,
    notifCenterOpen,
    setNotifCenterOpen,
    markRead,
    markAllRead,
  } = useTreeState();

  // ── 計算値 ──────────────────────────────
  const effArrow =
    stats.efficiencyVsAvg > 0 ? "↑" : stats.efficiencyVsAvg < 0 ? "↓" : "→";
  const arrowColor =
    stats.efficiencyVsAvg > 0
      ? C.arrowUp
      : stats.efficiencyVsAvg < 0
        ? C.arrowDown
        : C.arrowFlat;

  const totalCalls = stats.calls + stats.remaining;
  const dailyPercent =
    totalCalls > 0 ? Math.round((stats.calls / totalCalls) * 100) : 0;

  const monthPts = stats.monthPts ?? 1.2;
  const monthTarget = stats.monthTarget ?? 3.0;
  const monthlyPercent = Math.min(
    100,
    monthTarget > 0 ? Math.round((monthPts / monthTarget) * 100) : 0,
  );
  const monthAchieved = monthTarget > 0 && monthPts >= monthTarget;

  // B案: 本日ポイント + 目標まであと X P
  const todayPoints = stats.calls * 0.1;
  const targetPoints = totalCalls * 0.1;
  const remainingPoints = targetPoints - todayPoints;
  const isAchieved = remainingPoints <= 0;
  const achvColor = isAchieved ? C.gold : "rgba(255,255,255,0.9)";

  // ── 時刻（1分ごとに更新） ───────────────
  const [nowTime, setNowTime] = useState<string>("");
  useEffect(() => {
    setNowTime(formatClock(new Date()));
    const iv = setInterval(() => {
      setNowTime(formatClock(new Date()));
    }, 10_000);
    return () => clearInterval(iv);
  }, []);

  // ── 通知パネル：外部クリックで閉じる ────
  const bellRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!notifCenterOpen) return;
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setNotifCenterOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifCenterOpen, setNotifCenterOpen]);

  const unreadCount = notifCenter.filter((n) => !n.read).length;

  // ── ヘッダー検索 ─────────────────────────
  const [headerSearch, setHeaderSearch] = useState("");

  const NotifCard = ({ n }: { n: NotifItem }) => (
    <div
      style={{
        padding: "10px 14px 10px 16px",
        borderBottom: "1px solid #f0f0f0",
        borderLeft: `4px solid ${n.read ? "#ccc" : n.color || C.midGreen}`,
        background: n.read
          ? "#f8f8f8"
          : `${n.color || C.midGreen}08`,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        opacity: n.read ? 0.6 : 1,
      }}
    >
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: n.read ? 500 : 700,
            color: n.read ? "#999" : n.color || C.textDark,
            marginBottom: 2,
          }}
        >
          {n.title}
        </div>
        <div
          style={{
            fontSize: 11,
            color: n.read ? "#bbb" : C.textMuted,
            marginBottom: 3,
          }}
        >
          {n.body}
        </div>
        <div style={{ fontSize: 10, color: "#bbb" }}>
          {n.time instanceof Date
            ? `${String(n.time.getHours()).padStart(2, "0")}:${String(n.time.getMinutes()).padStart(2, "0")}`
            : n.time || ""}
        </div>
      </div>
      {!n.read && (
        <button
          onClick={() => markRead(n.id)}
          style={{
            border: "1px solid #ddd",
            background: "#fff",
            color: C.midGreen,
            fontSize: 10,
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: 6,
            cursor: "pointer",
            whiteSpace: "nowrap",
            fontFamily: "'Noto Sans JP', sans-serif",
            marginTop: 2,
          }}
        >
          既読
        </button>
      )}
    </div>
  );

  const unread = notifCenter.filter((n) => !n.read);
  const read = notifCenter.filter((n) => n.read);

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: `linear-gradient(135deg, ${C.darkGreen} 0%, ${C.midGreen} 60%, ${C.lightGreen} 100%)`,
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        padding: "0 28px",
        height: 56,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontFamily: "'Noto Sans JP', sans-serif",
        color: C.white,
      }}
    >
      {/* ── 左: 時刻 + 権限 ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          minWidth: 120,
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {nowTime || "--:--"}
        </span>
        <span
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.45)",
            fontWeight: 600,
            padding: "2px 8px",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 6,
          }}
        >
          {ROLE_CONFIG[role]?.fullLabel}
        </span>
      </div>

      {/* ── 中央: ゲージ + 数値エリア + グラフ ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <SemiGauge
          label="当日目標"
          percent={dailyPercent}
          sub={`${P(todayPoints)} / ${P(targetPoints)}`}
          color={isAchieved ? C.gold : "rgba(255,255,255,0.9)"}
        />
        <SemiGauge
          label="月間目標"
          percent={monthlyPercent}
          sub={`${P(monthPts)} / ${P(monthTarget)}`}
          color={monthAchieved ? C.red : C.gold}
        />
        {/* 数値エリア: 本日P + 残りP */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            padding: "0 8px",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 9,
                color: "rgba(255,255,255,0.5)",
                marginBottom: 2,
                fontWeight: 600,
              }}
            >
              本日ポイント
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: achvColor,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
              }}
            >
              {todayPoints.toFixed(1)}
              <span style={{ fontSize: 11, fontWeight: 700 }}>P</span>
            </div>
          </div>
          <div
            style={{
              width: 1,
              height: 28,
              background: "rgba(255,255,255,0.15)",
            }}
          />
          <div style={{ textAlign: "center" }}>
            {isAchieved ? (
              <>
                <div
                  style={{
                    fontSize: 9,
                    color: C.gold,
                    marginBottom: 2,
                    fontWeight: 600,
                  }}
                >
                  本日目標
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: C.gold,
                    lineHeight: 1,
                  }}
                >
                  🎉 達成
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    fontSize: 9,
                    color: "rgba(255,255,255,0.5)",
                    marginBottom: 2,
                    fontWeight: 600,
                  }}
                >
                  目標まで
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600 }}>あと</span>
                  {remainingPoints.toFixed(1)}
                  <span style={{ fontSize: 11, fontWeight: 700 }}>P</span>
                </div>
              </>
            )}
          </div>
        </div>
        {/* 有効率ミニ表示 */}
        <div style={{ textAlign: "center", padding: "0 4px" }}>
          <div
            style={{
              fontSize: 9,
              color: "rgba(255,255,255,0.5)",
              marginBottom: 2,
              fontWeight: 600,
            }}
          >
            有効率
          </div>
          <div
            style={{ display: "flex", alignItems: "baseline", gap: 3 }}
          >
            <span style={{ fontSize: 17, fontWeight: 700 }}>
              {stats.efficiency}
              <span style={{ fontSize: 9, fontWeight: 600 }}>%</span>
            </span>
            <span
              style={{ fontSize: 14, fontWeight: 900, color: arrowColor }}
            >
              {effArrow}
            </span>
          </div>
        </div>
        {/* 📊 グラフアイコン（将来: ミニパネル表示） */}
        <button
          onClick={() => router.push(TREE_PATHS.EFF_RANKING)}
          style={{ ...hdrBtn, padding: "6px 8px" }}
          title="データ分析"
        >
          <svg
            viewBox="0 0 24 24"
            style={{
              width: 18,
              height: 18,
              fill: "none",
              stroke: "currentColor",
              strokeWidth: 2,
              strokeLinecap: "round",
              strokeLinejoin: "round",
            }}
          >
            <rect x="3" y="12" width="4" height="9" rx="1" />
            <rect x="10" y="7" width="4" height="14" rx="1" />
            <rect x="17" y="3" width="4" height="18" rx="1" />
          </svg>
        </button>
      </div>

      {/* ── 右: ツール群 ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {onToggleOutReturn && (
          <button
            onClick={onToggleOutReturn}
            style={hdrBtn}
            title="アウト返し集"
          >
            📝
          </button>
        )}
        {onToggleScript && (
          <button onClick={onToggleScript} style={hdrBtn} title="トークスクリプト">
            📜
          </button>
        )}
        {/* 通知センター（ベルアイコン + ドロップダウンパネル） */}
        <div ref={bellRef} style={{ position: "relative" }}>
          <button
            onClick={() => setNotifCenterOpen(!notifCenterOpen)}
            style={{ ...hdrBtn, position: "relative" }}
            title="通知センター"
          >
            <svg
              viewBox="0 0 24 24"
              style={{
                width: 18,
                height: 18,
                fill: "none",
                stroke: "currentColor",
                strokeWidth: 2,
                strokeLinecap: "round",
                strokeLinejoin: "round",
              }}
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  minWidth: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: "#e3382e",
                  fontSize: 9,
                  fontWeight: 800,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 3px",
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>
          {/* ドロップダウンパネル */}
          {notifCenterOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                width: 360,
                maxHeight: 480,
                background: "#fff",
                borderRadius: 12,
                boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                border: "1px solid #e0e0e0",
                display: "flex",
                flexDirection: "column",
                zIndex: 200,
                fontFamily: "'Noto Sans JP', sans-serif",
                color: C.textDark,
              }}
            >
              <div
                style={{
                  padding: "14px 16px 10px",
                  borderBottom: "1px solid #eee",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: C.darkGreen,
                    }}
                  >
                    通知
                  </span>
                  {unreadCount > 0 && (
                    <span
                      style={{
                        fontSize: 11,
                        color: "#e3382e",
                        fontWeight: 600,
                      }}
                    >
                      未読 {unreadCount}件
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    style={{
                      border: "none",
                      background: "none",
                      color: C.midGreen,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontFamily: "'Noto Sans JP', sans-serif",
                    }}
                  >
                    すべて既読
                  </button>
                )}
              </div>
              <div
                style={{ overflowY: "auto", flex: 1, maxHeight: 420 }}
              >
                {unread.length === 0 && read.length === 0 && (
                  <div
                    style={{
                      padding: 32,
                      textAlign: "center",
                      color: C.textMuted,
                      fontSize: 12,
                    }}
                  >
                    通知はありません
                  </div>
                )}
                {unread.map((n) => (
                  <NotifCard key={n.id} n={n} />
                ))}
                {read.length > 0 && (
                  <details
                    style={{
                      borderTop:
                        unread.length > 0 ? "1px solid #e0e0e0" : "none",
                    }}
                    className="notif-read-details"
                  >
                    <summary
                      className="notif-read-summary"
                      style={{
                        padding: "8px 16px",
                        fontSize: 11,
                        color: C.textMuted,
                        fontWeight: 600,
                        cursor: "pointer",
                        background: "#fafafa",
                        userSelect: "none",
                        listStyle: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      既読 {read.length}件
                    </summary>
                    {read.map((n) => (
                      <NotifCard key={n.id} n={n} />
                    ))}
                  </details>
                )}
              </div>
            </div>
          )}
        </div>
        <div style={{ position: "relative" }}>
          <input
            type="text"
            placeholder="検索..."
            value={headerSearch}
            onChange={(e) => setHeaderSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && headerSearch.trim()) {
                router.push(TREE_PATHS.SEARCH);
              }
            }}
            style={{
              padding: "6px 12px 6px 28px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.1)",
              color: "#fff",
              fontSize: 11,
              width: 150,
              fontFamily: "'Noto Sans JP', sans-serif",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <svg
            viewBox="0 0 24 24"
            style={{
              position: "absolute",
              left: 8,
              top: "50%",
              transform: "translateY(-50%)",
              width: 13,
              height: 13,
              fill: "none",
              stroke: "rgba(255,255,255,0.5)",
              strokeWidth: 2,
              pointerEvents: "none",
            }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
      </div>
    </div>
  );
}
