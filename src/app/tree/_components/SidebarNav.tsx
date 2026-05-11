"use client";

/**
 * Garden-Tree サイドバーナビゲーション
 *
 * プロトタイプの <SidebarNav /> をそのまま移植しつつ、
 * Next.js App Router 向けに以下を置き換え：
 *
 *  - prop の currentScreen → usePathname() で取得
 *  - prop の onNavigate    → useRouter().push() で遷移
 *  - role / menuOrder / isAway などの共有状態は TreeStateContext から
 *  - LOGO_IMG (base64) → public/tree/logo.png を <img src="/tree/logo.png">
 *
 * 視覚的な再現度を優先しているため、スタイルはプロトタイプと同様に
 * インライン CSS-in-JS で記述している（Tailwind 化は将来対応）。
 */

import { usePathname, useRouter } from "next/navigation";
import { useMemo, useRef, useState, type ReactElement } from "react";

import { C } from "../_constants/colors";
import { SHOW_DEMO_CONTROLS } from "../_constants/flags";
import { LOGO_PATH } from "../_constants/logo";
import { ROLE_CONFIG, ROLES } from "../_constants/roles";
import { TREE_PATHS } from "../_constants/screens";
import { USER } from "../_constants/user";
import { useTreeState } from "../_state/TreeStateContext";
import { Icons, svgStyle } from "./Icons";

type MenuItem = {
  id: string;
  href: string;
  icon: ReactElement;
  label: string;
  badge?: number;
  fixed?: boolean;
};

/** 画面内で計算時に必要になる細かいインラインアイコン */
const InlineIcons = {
  search: (
    <svg viewBox="0 0 24 24" style={svgStyle}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  tossWait: (
    <svg viewBox="0 0 24 24" style={svgStyle}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  confirmWait: (
    <svg viewBox="0 0 24 24" style={svgStyle}>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  followCall: (
    <svg viewBox="0 0 24 24" style={svgStyle}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
      <path d="M14.05 2a9 9 0 0 1 8 7.94" />
      <path d="M14.05 6A5 5 0 0 1 18 10" />
    </svg>
  ),
  fbList: (
    <svg viewBox="0 0 24 24" style={svgStyle}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M14 9l-5 5" />
      <path d="M9 9l5 5" />
    </svg>
  ),
  breeze: (
    <svg viewBox="0 0 24 24" style={svgStyle}>
      <path d="M17.7 7.7A7.1 7.1 0 0 0 12 5c-4 0-7 3-7 7s3 7 7 7a7 7 0 0 0 5-2" />
      <path d="M21 5c-1.5 1.5-3 3-5 3s-3.5-1.5-5-3" />
    </svg>
  ),
  feedbackEdit: (
    <svg viewBox="0 0 24 24" style={svgStyle}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  ),
  monitoring: (
    <svg viewBox="0 0 24 24" style={svgStyle}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  scriptManage: (
    <svg viewBox="0 0 24 24" style={svgStyle}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  alerts: (
    <svg viewBox="0 0 24 24" style={svgStyle}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  break: (
    <svg viewBox="0 0 24 24" style={svgStyle}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
};

/** 常に固定の "離席" ボタン用アイコン */
const AwaySmallIcon = (
  <svg
    viewBox="0 0 24 24"
    style={{
      width: 13,
      height: 13,
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }}
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

/** "休憩" ボタン用アイコン */
const BreakSmallIcon = (
  <svg
    viewBox="0 0 24 24"
    style={{
      width: 13,
      height: 13,
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }}
  >
    <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z" />
    <line x1="6" y1="2" x2="6" y2="4" />
    <line x1="10" y1="2" x2="10" y2="4" />
    <line x1="14" y1="2" x2="14" y2="4" />
  </svg>
);

/** 折りたたみ時の小さい離席 / 休憩アイコン */
const AwayCollapsedIcon = (
  <svg
    viewBox="0 0 24 24"
    style={{
      width: 14,
      height: 14,
      fill: "none",
      stroke: "#ffffff",
      strokeWidth: 2.2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }}
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const BreakCollapsedIcon = (
  <svg
    viewBox="0 0 24 24"
    style={{
      width: 14,
      height: 14,
      fill: "none",
      stroke: "#ffffff",
      strokeWidth: 2.2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }}
  >
    <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z" />
    <line x1="6" y1="2" x2="6" y2="4" />
    <line x1="10" y1="2" x2="10" y2="4" />
    <line x1="14" y1="2" x2="14" y2="4" />
  </svg>
);

/** 昼休憩メニュー用アイコン */
const LunchMenuIcon = (
  <svg
    viewBox="0 0 24 24"
    style={{
      width: 14,
      height: 14,
      fill: "none",
      stroke: "#1b4332",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      verticalAlign: "middle",
      marginRight: 4,
    }}
  >
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    <line x1="12" y1="11" x2="12" y2="17" />
    <line x1="9" y1="14" x2="15" y2="14" />
  </svg>
);

const ShortBreakMenuIcon = (
  <svg
    viewBox="0 0 24 24"
    style={{
      width: 14,
      height: 14,
      fill: "none",
      stroke: "#1b4332",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      verticalAlign: "middle",
      marginRight: 4,
    }}
  >
    <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z" />
    <line x1="6" y1="2" x2="6" y2="4" />
    <line x1="10" y1="2" x2="10" y2="4" />
    <line x1="14" y1="2" x2="14" y2="4" />
  </svg>
);

export function SidebarNav() {
  const pathname = usePathname() || "";
  const router = useRouter();

  const {
    role,
    cycleRole,
    fbRemaining,
    tossWaitCount,
    confirmWaitCount,
    alertCount,
    isAway,
    setIsAway,
    startBreak,
    menuOrder,
    setMenuOrder,
    treeUser,
    signOut,
  } = useTreeState();

  const handleLogout = async () => {
    if (!confirm("ログアウトしますか？（退勤打刻は別途「退勤・日報」画面から行ってください）")) return;
    await signOut();
    router.push("/tree/login");
  };

  const [isExpanded, setIsExpanded] = useState(false);
  const [showBreakMenu, setShowBreakMenu] = useState(false);
  const [menuEditMode, setMenuEditMode] = useState(false);
  const breakRowRef = useRef<HTMLDivElement | null>(null);

  const rc = ROLE_CONFIG[role];

  const items = useMemo<MenuItem[]>(() => {
    const base: MenuItem[] = [
      {
        id: "search",
        href: TREE_PATHS.SEARCH,
        icon: InlineIcons.search,
        label: "検索",
        fixed: true,
      },
      {
        id: "dashboard",
        href: TREE_PATHS.DASHBOARD,
        icon: Icons.dashboard,
        label: "ダッシュボード",
      },
      {
        id: "aporan",
        href: TREE_PATHS.APORAN,
        icon: Icons.trophy,
        label: "アポラン",
      },
      {
        id: "eff_ranking",
        href: TREE_PATHS.EFF_RANKING,
        icon: Icons.chart,
        label: "有効率",
      },
      {
        id: "calling",
        href:
          role === ROLES.SPROUT
            ? TREE_PATHS.CALLING_SPROUT
            : TREE_PATHS.CALLING_BRANCH,
        icon: Icons.phone,
        label: "架電画面",
      },
      {
        id: "toss_wait",
        href: TREE_PATHS.TOSS_WAIT,
        icon: InlineIcons.tossWait,
        label: "クローザー待ち",
        badge: tossWaitCount,
      },
    ];

    if (role !== ROLES.SPROUT) {
      base.push({
        id: "in_call",
        href: TREE_PATHS.IN_CALL,
        icon: Icons.headset,
        label: "通話画面",
      });
    }

    if (role === ROLES.MANAGER) {
      base.push({
        id: "confirm_wait",
        href: TREE_PATHS.CONFIRM_WAIT,
        icon: InlineIcons.confirmWait,
        label: "前確・後確待ち",
        badge: confirmWaitCount,
      });
    }

    if (role !== ROLES.SPROUT) {
      base.push({
        id: "follow_call",
        href: TREE_PATHS.FOLLOW_CALL,
        icon: InlineIcons.followCall,
        label: "フォローコール",
      });
    }

    base.push(
      {
        id: "chatwork",
        href: TREE_PATHS.CHATWORK,
        icon: Icons.chat,
        label: "Chatwork情報",
      },
      {
        id: "wrap_up",
        href: TREE_PATHS.WRAP_UP,
        icon: Icons.clipboard,
        label: "業務終了報告",
      },
      {
        id: "qa_search",
        href: TREE_PATHS.QA_SEARCH,
        icon: Icons.help,
        label: "Q&A検索",
      },
      {
        id: "video_portal",
        href: TREE_PATHS.VIDEO_PORTAL,
        icon: Icons.video,
        label: "動画ポータル",
      },
      {
        id: "mypage",
        href: TREE_PATHS.MYPAGE,
        icon: Icons.user,
        label: "マイページ",
      },
      {
        id: "fb_list",
        href: TREE_PATHS.FB_LIST,
        icon: InlineIcons.fbList,
        label: "フィードバック一覧",
      },
    );

    if (role !== ROLES.SPROUT) {
      base.push({
        id: "breeze",
        href: TREE_PATHS.BREEZE,
        icon: InlineIcons.breeze,
        label: "Breeze",
      });
    }

    if (role === ROLES.MANAGER) {
      base.push(
        {
          id: "feedback",
          href: TREE_PATHS.FEEDBACK,
          icon: InlineIcons.feedbackEdit,
          label: "フィードバック入力",
          badge: fbRemaining,
        },
        {
          id: "monitoring",
          href: TREE_PATHS.MONITORING,
          icon: InlineIcons.monitoring,
          label: "モニタリング",
        },
        {
          id: "script_manage",
          href: TREE_PATHS.SCRIPT_MANAGE,
          icon: InlineIcons.scriptManage,
          label: "スクリプト管理",
        },
        {
          id: "alerts",
          href: TREE_PATHS.ALERTS,
          icon: InlineIcons.alerts,
          label: "要フォロー",
          badge: alertCount || 0,
        },
        {
          id: "break_schedule",
          href: TREE_PATHS.BREAK_SCHEDULE,
          icon: InlineIcons.break,
          label: "休憩スケジュール",
        },
      );
    }

    return base;
  }, [role, tossWaitCount, confirmWaitCount, fbRemaining, alertCount]);

  // 並べ替え適用後のアイテム配列
  const orderedItems = useMemo(() => {
    const fixedItems = items.filter((i) => i.fixed);
    const sortableItems = items.filter((i) => !i.fixed);
    if (!menuOrder || menuOrder.length === 0) return items;
    const ordered = menuOrder
      .map((id) => sortableItems.find((i) => i.id === id))
      .filter((v): v is MenuItem => Boolean(v));
    const remaining = sortableItems.filter((i) => !menuOrder.includes(i.id));
    return [...fixedItems, ...ordered, ...remaining];
  }, [items, menuOrder]);

  const fixedCount = orderedItems.filter((i) => i.fixed).length;

  /** アクティブ判定：架電画面は URL 先頭一致、それ以外は完全一致 */
  const isActive = (item: MenuItem): boolean => {
    if (item.id === "calling") return pathname.startsWith("/tree/calling/");
    return pathname === item.href;
  };

  /** 並べ替え: 上下移動 */
  const moveItem = (idx: number, dir: 1 | -1) => {
    const sortable = orderedItems.filter((i) => !i.fixed);
    const realIdx = idx - fixedCount;
    if (realIdx + dir < 0 || realIdx + dir >= sortable.length) return;
    const newOrder = sortable.map((i) => i.id);
    [newOrder[realIdx], newOrder[realIdx + dir]] = [
      newOrder[realIdx + dir],
      newOrder[realIdx],
    ];
    setMenuOrder(newOrder);
  };

  const handleNavigate = (href: string) => {
    if (!menuEditMode) router.push(href);
  };

  // ユーザーアイコン表示用（認証済なら treeUser.name の姓、未認証時は USER fallback）
  const surname = treeUser?.name.split(/[\s　]/)[0] ?? USER.name;
  const len = surname.length;
  const isTwoLine = len >= 4;
  const displayText = len >= 5 ? surname.slice(0, 4) : surname;
  const iconSize = isExpanded ? 32 : 30;
  const fontSize =
    len === 1 ? 13 : len === 2 ? 11 : len === 3 ? 9 : 8;

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 500,
        width: isExpanded ? 200 : 56,
        background: `linear-gradient(180deg, ${C.darkGreen} 0%, ${C.midGreen} 60%, ${C.lightGreen} 100%)`,
        transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
        display: "flex",
        flexDirection: "column",
        boxShadow: "2px 0 20px rgba(0,0,0,0.15)",
        overflow: "hidden",
      }}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => {
        setIsExpanded(false);
        setShowBreakMenu(false);
        setMenuEditMode(false);
      }}
    >
      {/* ロゴ */}
      <div
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: isExpanded ? "flex-start" : "center",
          paddingLeft: isExpanded ? 14 : 0,
          gap: 8,
          height: 56,
          boxSizing: "border-box",
          flexShrink: 0,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LOGO_PATH}
          alt=""
          style={{
            width: 28,
            height: 28,
            objectFit: "contain",
            borderRadius: 6,
            flexShrink: 0,
          }}
        />
        {isExpanded && (
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: C.paleGreen,
              whiteSpace: "nowrap",
            }}
          >
            Garden Tree
          </span>
        )}
      </div>

      {/* ユーザー情報セクション（名前・離席・休憩） */}
      <div
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.12)",
          padding: isExpanded ? "12px 14px" : "10px 0",
          flexShrink: 0,
          transition: "padding 0.25s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            justifyContent: isExpanded ? "flex-start" : "center",
            marginBottom: isExpanded ? 10 : 6,
          }}
        >
          <div
            style={{
              width: iconSize,
              height: iconSize,
              borderRadius: "50%",
              background: rc.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: isTwoLine ? "column" : "row",
              fontSize,
              fontWeight: 800,
              color: C.white,
              boxShadow: `0 2px 6px ${rc.color}44`,
              flexShrink: 0,
              transition: "all 0.2s ease",
              lineHeight: isTwoLine ? 1.1 : 1,
              letterSpacing: len >= 3 ? -0.5 : 0,
            }}
          >
            {isTwoLine ? (
              <>
                {displayText.slice(0, 2)}
                <br />
                {displayText.slice(2)}
              </>
            ) : (
              displayText
            )}
          </div>
          {isExpanded && (
            <div style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>
                {treeUser?.employment_type ?? USER.employmentType} / {rc.fullLabel}
              </div>
              <div
                style={{ fontSize: 12, fontWeight: 700, color: C.white }}
              >
                {treeUser?.name ?? USER.fullName}
              </div>
            </div>
          )}
        </div>
        {isExpanded ? (
          <div
            ref={breakRowRef}
            style={{ display: "flex", gap: 6 }}
            onMouseEnter={() => setShowBreakMenu(true)}
            onMouseLeave={() => setShowBreakMenu(false)}
          >
            <button
              onClick={() => setIsAway(true)}
              style={{
                flex: 1,
                padding: "5px 0",
                borderRadius: 7,
                border: "1px solid rgba(255,255,255,0.25)",
                background: "rgba(255,255,255,0.08)",
                color: C.white,
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'Noto Sans JP', sans-serif",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              {AwaySmallIcon} 離席
            </button>
            <button
              onClick={() => setShowBreakMenu(true)}
              style={{
                flex: 1,
                padding: "5px 0",
                borderRadius: 7,
                border: "1px solid rgba(255,255,255,0.25)",
                background: "rgba(82,183,136,0.2)",
                color: C.white,
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'Noto Sans JP', sans-serif",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              {BreakSmallIcon} 休憩
            </button>
            {/* eslint-disable-next-line react-hooks/refs */}
            {showBreakMenu && (() => {
              const rect = breakRowRef.current
                ? breakRowRef.current.getBoundingClientRect()
                : ({ bottom: 0, left: 14, width: 172 } as DOMRect);
              return (
                <div
                  style={{
                    position: "fixed",
                    top: rect.bottom,
                    left: rect.left,
                    width: rect.width,
                    paddingTop: 4,
                    zIndex: 99999,
                  }}
                  onMouseEnter={() => setShowBreakMenu(true)}
                  onMouseLeave={() => setShowBreakMenu(false)}
                >
                  <div
                    style={{
                      background: "#fff",
                      borderRadius: 10,
                      padding: "10px 12px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                      fontFamily: "'Noto Sans JP', sans-serif",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#1b4332",
                        marginBottom: 8,
                      }}
                    >
                      休憩の種類を選択
                    </div>
                    <div
                      onClick={() => {
                        startBreak("lunch");
                        setShowBreakMenu(false);
                      }}
                      style={{
                        padding: "8px 10px",
                        marginBottom: 4,
                        borderRadius: 6,
                        background: "rgba(45,106,79,0.06)",
                        color: "#1b4332",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {LunchMenuIcon}昼休憩（打刻あり）
                    </div>
                    <div
                      onClick={() => {
                        startBreak("short");
                        setShowBreakMenu(false);
                      }}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 6,
                        background: "rgba(45,106,79,0.06)",
                        color: "#1b4332",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {ShortBreakMenuIcon}10-15分休憩
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <button
              onClick={() => setIsAway(true)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                border: "1px solid rgba(255,255,255,0.25)",
                background: "rgba(255,255,255,0.1)",
                color: C.white,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
              title="離席"
            >
              {AwayCollapsedIcon}
            </button>
            <button
              onClick={() => startBreak("short")}
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                border: "1px solid rgba(255,255,255,0.25)",
                background: "rgba(82,183,136,0.25)",
                color: C.white,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
              title="休憩"
            >
              {BreakCollapsedIcon}
            </button>
          </div>
        )}
      </div>

      {/* メニュー */}
      <div
        className="sidebar-menu-scroll"
        style={{ flex: 1, padding: "6px 0", overflowY: "auto" }}
      >
        {/* 責任者のみ — 並べ替えモードトグル */}
        {role === ROLES.MANAGER && isExpanded && (
          <button
            onClick={() => setMenuEditMode((p) => !p)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "6px 16px",
              border: "none",
              background: menuEditMode
                ? "rgba(201,168,76,0.2)"
                : "transparent",
              color: menuEditMode ? C.gold : "rgba(255,255,255,0.4)",
              cursor: "pointer",
              fontFamily: "'Noto Sans JP', sans-serif",
              fontSize: 10,
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            ⚙️ {menuEditMode ? "並べ替え完了" : "メニュー並べ替え"}
          </button>
        )}
        {orderedItems.map((item, idx) => {
          const active = isActive(item);
          return (
            <div
              key={item.id}
              style={{ display: "flex", alignItems: "center" }}
            >
              <button
                onClick={() => handleNavigate(item.href)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flex: 1,
                  padding: "9px 16px",
                  border: "none",
                  background: active
                    ? "rgba(255,255,255,0.15)"
                    : menuEditMode
                      ? "rgba(255,255,255,0.03)"
                      : "transparent",
                  color: active ? C.white : "rgba(255,255,255,0.65)",
                  cursor: menuEditMode ? "default" : "pointer",
                  fontFamily: "'Noto Sans JP', sans-serif",
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  borderLeft: active
                    ? `3px solid ${C.accentGreen}`
                    : "3px solid transparent",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                  }}
                >
                  {item.icon}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -8,
                        minWidth: 15,
                        height: 15,
                        borderRadius: "50%",
                        padding: "0 3px",
                        background: C.red,
                        color: C.white,
                        fontSize: 8,
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </span>
                {isExpanded && item.label}
              </button>
              {/* 並べ替えボタン */}
              {menuEditMode && isExpanded && !item.fixed && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    marginRight: 6,
                  }}
                >
                  <button
                    onClick={() => moveItem(idx, -1)}
                    style={{
                      border: "none",
                      background: "rgba(255,255,255,0.15)",
                      color: C.white,
                      width: 18,
                      height: 14,
                      borderRadius: 3,
                      cursor: "pointer",
                      fontSize: 8,
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveItem(idx, 1)}
                    style={{
                      border: "none",
                      background: "rgba(255,255,255,0.15)",
                      color: C.white,
                      width: 18,
                      height: 14,
                      borderRadius: 3,
                      cursor: "pointer",
                      fontSize: 8,
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ▼
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <style>{`
        .sidebar-menu-scroll::-webkit-scrollbar { display: none; }
        .sidebar-menu-scroll { -ms-overflow-style: none; scrollbar-width: none; }
        .notif-read-summary::-webkit-details-marker { display: none; }
        .notif-read-summary::before { content: "＋"; font-size: 12px; font-weight: 700; margin-right: 4px; }
        .notif-read-details[open] > .notif-read-summary::before { content: "−"; }
      `}</style>
      {/* 権限切替（デモ用：本番では SHOW_DEMO_CONTROLS=false で非表示） */}
      {SHOW_DEMO_CONTROLS && (
        <div
          style={{
            padding: 10,
            borderTop: "1px solid rgba(255,255,255,0.12)",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={cycleRole}
            title={`権限切替（現在: ${rc.fullLabel}）`}
            aria-label="権限切替"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: isExpanded ? "flex-start" : "center",
              gap: isExpanded ? 10 : 0,
              width: "100%",
              minHeight: 36,
              padding: isExpanded ? "8px 12px" : "6px 0",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 10,
              background: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.85)",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "'Noto Sans JP', sans-serif",
              whiteSpace: "nowrap",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.16)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
            }}
          >
            <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1 }}>
              🔄
            </span>
            {isExpanded && "権限切替"}
          </button>
        </div>
      )}

      {/* ログアウトボタン（認証時のみ表示） */}
      {treeUser && (
        <div
          style={{
            padding: 10,
            borderTop: "1px solid rgba(255,255,255,0.12)",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={handleLogout}
            title={`ログアウト（${treeUser.name}）`}
            aria-label="ログアウト"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: isExpanded ? "flex-start" : "center",
              gap: isExpanded ? 10 : 0,
              width: "100%",
              minHeight: 36,
              padding: isExpanded ? "8px 12px" : "6px 0",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 10,
              background: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.85)",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "'Noto Sans JP', sans-serif",
              whiteSpace: "nowrap",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(196,74,74,0.25)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
            }}
          >
            <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1 }}>
              🚪
            </span>
            {isExpanded && "ログアウト"}
          </button>
        </div>
      )}

      {/* isAway はまだ UI なし（TODO: オーバーレイ実装） */}
      {isAway && null}
    </div>
  );
}
