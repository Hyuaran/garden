"use client";

/**
 * Garden-Tree 前確・後確・トス待ちサイドパネル
 *
 * プロトタイプの ConfirmSidePanel を TypeScript 化。
 * InCallScreen（通話画面）の右端に固定表示されるスライドパネル。
 *
 * - 「トス」タブ: クローザー待ちの案件一覧
 * - 「前後確」タブ: 前確・後確の案件一覧
 * - 右端の縦タブで開閉、パネル内で案件選択すると InCallScreen の顧客が切り替わる
 *
 * confirmMode が設定されている場合（前確/後確/トス通話中）のみ表示。
 */

import { C } from "../_constants/colors";
import { TREE_PATHS } from "../_constants/screens";

export type ConfirmItem = {
  id: string;
  type: string;
  customer: string;
  phone: string;
  closer: string;
  time: string;
  confirmer?: string;
  confirmerStatus?: string;
  scheduledTime?: string;
};

export type TossItem = {
  id: string;
  customer: string;
  phone: string;
  tosser: string;
  time: string;
  memo?: string;
};

export type ConfirmMode = {
  type: string;
  customer: string;
  phone: string;
  closer: string;
} | null;

type ConfirmSidePanelProps = {
  activeTab: string | null;
  onTabSelect: (tab: string | null) => void;
  confirmQueue: ConfirmItem[];
  tossQueue: TossItem[];
  currentConfirmMode: ConfirmMode;
  onSelectItem: (item: {
    type: string;
    customer: string;
    phone: string;
    closer: string;
  }) => void;
  onNavigate: (path: string) => void;
};

const PANEL_WIDTH = 300;
const TAB_WIDTH = 38;

function CardItem({
  item,
  color,
  isCurrent,
  extra,
  onClick,
}: {
  item: { customer: string };
  color: string;
  isCurrent: boolean;
  extra: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!isCurrent)
          e.currentTarget.style.background = `${color}08`;
      }}
      onMouseLeave={(e) => {
        if (!isCurrent)
          e.currentTarget.style.background = "rgba(255,255,255,0.8)";
      }}
      style={{
        padding: "10px 12px",
        marginBottom: 6,
        borderRadius: 10,
        borderLeft: `3px solid ${color}`,
        background: isCurrent
          ? `${color}18`
          : "rgba(255,255,255,0.8)",
        outline: isCurrent ? `2px solid ${color}` : "none",
        cursor: "pointer",
        transition: "all 0.15s ease",
        boxShadow: isCurrent ? `0 2px 8px ${color}25` : "none",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: C.textDark,
          }}
        >
          {item.customer}
        </span>
        {isCurrent && (
          <span
            style={{
              fontSize: 8,
              padding: "2px 6px",
              borderRadius: 4,
              background: color,
              color: "#fff",
              fontWeight: 700,
            }}
          >
            対応中
          </span>
        )}
      </div>
      {extra}
    </div>
  );
}

export function ConfirmSidePanel({
  activeTab,
  onTabSelect,
  confirmQueue,
  tossQueue,
  currentConfirmMode,
  onSelectItem,
  onNavigate,
}: ConfirmSidePanelProps) {
  const isOpen = activeTab !== null;

  const maeList = confirmQueue.filter((c) => c.type === "前確");
  const atoList = confirmQueue
    .filter((c) => c.type === "後確")
    .sort((a, b) =>
      (a.scheduledTime || "").localeCompare(b.scheduledTime || ""),
    );
  const tossList = tossQueue;
  const totalConfirm = maeList.length + atoList.length;
  const totalToss = tossList.length;

  const currentKey = currentConfirmMode
    ? `${currentConfirmMode.type}-${currentConfirmMode.customer}-${currentConfirmMode.phone}`
    : null;
  const isCurrentItem = (
    item: { customer: string; phone: string; type?: string },
    type?: string,
  ) =>
    `${type || item.type}-${item.customer}-${item.phone}` ===
    currentKey;

  const TABS = [
    {
      id: "toss",
      label: "クローザー待ち",
      shortLabel: "トス",
      color: C.midGreen,
      bgAlpha: "rgba(45,106,79,",
      count: totalToss,
    },
    {
      id: "confirm",
      label: "前確・後確",
      shortLabel: "前後確",
      color: "#8a5ac6",
      bgAlpha: "rgba(138,90,198,",
      count: totalConfirm,
    },
  ];

  const activeTabData = TABS.find((t) => t.id === activeTab);

  return (
    <>
      {/* スライドパネル本体 */}
      <div
        style={{
          position: "fixed",
          right: 0,
          top: 64,
          bottom: 0,
          width: isOpen ? PANEL_WIDTH : 0,
          zIndex: 200,
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(24px)",
          borderLeft: isOpen ? "1px solid rgba(0,0,0,0.08)" : "none",
          boxShadow: isOpen
            ? "-4px 0 24px rgba(0,0,0,0.08)"
            : "none",
          transition: "width 0.3s cubic-bezier(0.4,0,0.2,1)",
          overflow: "hidden",
          fontFamily: "'Noto Sans JP', sans-serif",
        }}
      >
        <div
          style={{
            width: PANEL_WIDTH,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* ヘッダー */}
          <div
            style={{
              padding: "16px 16px 12px",
              borderBottom: `2px solid ${activeTabData?.color || C.midGreen}22`,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: activeTabData?.color || C.darkGreen,
                }}
              >
                {activeTabData?.label || ""}
              </div>
              <button
                onClick={() => onTabSelect(null)}
                style={{
                  border: "none",
                  background: "rgba(0,0,0,0.04)",
                  borderRadius: 6,
                  width: 24,
                  height: 24,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  color: C.textMuted,
                }}
              >
                ✕
              </button>
            </div>

            {/* サマリー */}
            {activeTab === "confirm" && (
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  {
                    label: "前確",
                    count: maeList.length,
                    color: "#3478c6",
                  },
                  {
                    label: "後確",
                    count: atoList.length,
                    color: "#e67e22",
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    style={{
                      flex: 1,
                      padding: "6px 8px",
                      borderRadius: 8,
                      textAlign: "center",
                      background: `${s.color}0a`,
                      border: `1px solid ${s.color}20`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        color: C.textMuted,
                        marginBottom: 1,
                      }}
                    >
                      {s.label}
                    </div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: s.color,
                      }}
                    >
                      {s.count}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {activeTab === "toss" && (
              <div
                style={{
                  padding: "6px 8px",
                  borderRadius: 8,
                  textAlign: "center",
                  background: `${C.midGreen}0a`,
                  border: `1px solid ${C.midGreen}20`,
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    color: C.textMuted,
                    marginBottom: 1,
                  }}
                >
                  待ち件数
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: C.midGreen,
                  }}
                >
                  {totalToss}
                  <span style={{ fontSize: 11, fontWeight: 600 }}>
                    件
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* リスト本体 */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "8px 12px 16px",
            }}
          >
            {activeTab === "confirm" && (
              <>
                {maeList.length > 0 && (
                  <>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#3478c6",
                        padding: "8px 4px 4px",
                        letterSpacing: 1,
                      }}
                    >
                      前確
                    </div>
                    {maeList.map((c) => (
                      <CardItem
                        key={c.id}
                        item={c}
                        color="#3478c6"
                        isCurrent={isCurrentItem(c, "前確")}
                        onClick={() =>
                          onSelectItem({
                            type: "前確",
                            customer: c.customer,
                            phone: c.phone,
                            closer: c.closer,
                          })
                        }
                        extra={
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 10,
                                color: C.textMuted,
                              }}
                            >
                              CL: {c.closer}
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                color: C.textMuted,
                              }}
                            >
                              {c.time}
                            </span>
                          </div>
                        }
                      />
                    ))}
                  </>
                )}
                {atoList.length > 0 && (
                  <>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#e67e22",
                        padding: "8px 4px 4px",
                        letterSpacing: 1,
                      }}
                    >
                      後確
                    </div>
                    {atoList.map((c) => (
                      <CardItem
                        key={c.id}
                        item={c}
                        color="#e67e22"
                        isCurrent={isCurrentItem(c, "後確")}
                        onClick={() =>
                          onSelectItem({
                            type: "後確",
                            customer: c.customer,
                            phone: c.phone,
                            closer: c.closer,
                          })
                        }
                        extra={
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 10,
                                color: C.textMuted,
                              }}
                            >
                              CL: {c.closer}
                            </span>
                            {c.scheduledTime && (
                              <span
                                style={{
                                  fontSize: 10,
                                  color: "#e67e22",
                                  fontWeight: 600,
                                }}
                              >
                                予定 {c.scheduledTime}
                              </span>
                            )}
                          </div>
                        }
                      />
                    ))}
                  </>
                )}
                {totalConfirm === 0 && (
                  <div
                    style={{
                      padding: "32px 16px",
                      textAlign: "center",
                      color: C.textMuted,
                      fontSize: 12,
                    }}
                  >
                    前確・後確の待ちはありません
                  </div>
                )}
              </>
            )}
            {activeTab === "toss" && (
              <>
                {tossList.length > 0 ? (
                  tossList.map((t) => (
                    <CardItem
                      key={t.id}
                      item={{ customer: t.customer }}
                      color={C.midGreen}
                      isCurrent={
                        currentConfirmMode?.type === "クローザー" &&
                        currentConfirmMode?.customer === t.customer
                      }
                      onClick={() =>
                        onSelectItem({
                          type: "クローザー",
                          customer: t.customer,
                          phone: t.phone,
                          closer: "",
                        })
                      }
                      extra={
                        <>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 10,
                                color: C.textMuted,
                              }}
                            >
                              トス: {t.tosser}
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                color: C.textMuted,
                              }}
                            >
                              {t.time}
                            </span>
                          </div>
                          {t.memo && (
                            <div
                              style={{
                                fontSize: 9,
                                color: C.textSub,
                                marginTop: 4,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                maxWidth: 240,
                              }}
                            >
                              {t.memo}
                            </div>
                          )}
                        </>
                      }
                    />
                  ))
                ) : (
                  <div
                    style={{
                      padding: "32px 16px",
                      textAlign: "center",
                      color: C.textMuted,
                      fontSize: 12,
                    }}
                  >
                    クローザー待ちはありません
                  </div>
                )}
              </>
            )}
          </div>

          {/* フッター */}
          <div
            style={{
              padding: "10px 16px",
              borderTop: "1px solid rgba(0,0,0,0.06)",
              flexShrink: 0,
            }}
          >
            <button
              onClick={() =>
                onNavigate(
                  activeTab === "confirm"
                    ? TREE_PATHS.CONFIRM_WAIT
                    : TREE_PATHS.TOSS_WAIT,
                )
              }
              style={{
                width: "100%",
                padding: "8px",
                border: `1px solid ${activeTabData?.color || C.midGreen}33`,
                borderRadius: 8,
                background: `${activeTabData?.color || C.midGreen}08`,
                color: activeTabData?.color || C.midGreen,
                fontSize: 10,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'Noto Sans JP', sans-serif",
              }}
            >
              {activeTab === "confirm"
                ? "前確・後確一覧を開く →"
                : "クローザー待ち一覧を開く →"}
            </button>
          </div>
        </div>
      </div>

      {/* 右端の縦タブ */}
      <div
        style={{
          position: "fixed",
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 201,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <div
              key={tab.id}
              onClick={() => onTabSelect(isActive ? null : tab.id)}
              onMouseEnter={(e) => {
                if (!isActive)
                  e.currentTarget.style.background = `${tab.bgAlpha}1)`;
              }}
              onMouseLeave={(e) => {
                if (!isActive)
                  e.currentTarget.style.background = `${tab.bgAlpha}0.85)`;
              }}
              style={{
                width: TAB_WIDTH,
                padding: "14px 4px",
                background: isActive
                  ? tab.color
                  : `${tab.bgAlpha}0.85)`,
                backdropFilter: "blur(12px)",
                borderRadius: "10px 0 0 10px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                boxShadow: isActive
                  ? `-3px 0 16px ${tab.color}40`
                  : "-2px 0 12px rgba(0,0,0,0.08)",
                transition: "all 0.2s ease",
                border: isActive
                  ? `2px solid ${tab.color}`
                  : "2px solid transparent",
                borderRight: "none",
              }}
            >
              <span
                style={{
                  writingMode: "vertical-rl",
                  textOrientation: "mixed",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#fff",
                  letterSpacing: 2,
                  fontFamily: "'Noto Sans JP', sans-serif",
                }}
              >
                {tab.shortLabel}
              </span>
              {tab.count > 0 && (
                <span
                  style={{
                    minWidth: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: isActive
                      ? "rgba(255,255,255,0.3)"
                      : "#fff",
                    color: isActive ? "#fff" : tab.color,
                    fontSize: 10,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {tab.count}
                </span>
              )}
              <span style={{ fontSize: 12, color: "#fff" }}>
                {isActive ? "▶" : "◀"}
              </span>
            </div>
          );
        })}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </>
  );
}
