"use client";

/**
 * Garden-Tree アプリ全体の共有状態
 *
 * 2026-04-21 改訂:
 *   Supabase Auth + root_employees.garden_role に接続。
 *   従来の localStorage ベースのダミーロールは廃止し、
 *   認証後に fetchTreeUser で取得する garden_role を正とする。
 *
 * レイヤー:
 *   1. Supabase Auth（認証情報）
 *   2. root_employees（garden_role 含む従業員マスタ）
 *   3. TreeStateContext（Tree 内の共有状態）
 *
 * 各画面・サイドバー・KPI ヘッダーは useTreeState() で参照する。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  GARDEN_ROLE_ORDER,
  isRoleAtLeast,
  type GardenRole,
} from "../../root/_constants/types";
import { ROLES, type Role } from "../_constants/roles";
import { getSession, signOutTree as signOutTreeLib } from "../_lib/auth";
import { fetchTreeUser, type TreeUser } from "../_lib/queries";

/** KPI ヘッダーで使う各種統計値（Phase C で Supabase 連携予定、現状はデモ値） */
export type TreeStats = {
  calls: number;
  remaining: number;
  efficiency: number;
  efficiencyVsAvg: number;
  monthPts: number;
  monthTarget: number;
};

/** 通知センターのアイテム */
export type NotifItem = {
  id: string;
  title: string;
  body: string;
  time: Date | string;
  read: boolean;
  color?: string;
};

type TreeStateValue = {
  // ============================================================
  // 認証状態（2026-04-21 追加）
  // ============================================================
  /** 認証確認中（初回レンダー〜refreshAuth 完了まで true） */
  loading: boolean;
  /** Supabase Auth セッション + root_employees 参照 OK */
  isAuthenticated: boolean;
  /** 認証済ユーザーの root_employees 行 */
  treeUser: TreeUser | null;
  /** ユーザーの garden_role（7段階） */
  gardenRole: GardenRole | null;
  /** ログイン後/セッション復帰時の認証再確認 */
  refreshAuth: () => Promise<{ success: boolean; error?: string }>;
  /** ログアウト + セッションクリア */
  signOut: () => Promise<void>;
  /** 指定以上の garden_role を持つか判定 */
  hasRoleAtLeast: (baseline: GardenRole) => boolean;

  // ============================================================
  // Tree UI 用の簡易Role（画面別表示切替に使用）
  // ============================================================
  role: Role;
  /** デモ用の role 手動切替（開発時のみ） */
  setRole: (r: Role) => void;
  /** デモ用の role サイクル切替（開発時のみ） */
  cycleRole: () => void;

  // ============================================================
  // KPI・ステータス（現状デモ値、Phase C で実データへ）
  // ============================================================
  stats: TreeStats;
  fbRemaining: number;
  tossWaitCount: number;
  confirmWaitCount: number;
  alertCount: number;

  isAway: boolean;
  setIsAway: (v: boolean) => void;

  /** 休憩開始（lunch / short）。当面はロギングのみ */
  startBreak: (type: "lunch" | "short") => void;

  /** F12: メニュー並べ替え用 ID 順 */
  menuOrder: string[];
  setMenuOrder: (order: string[]) => void;

  /** 通知センター */
  notifCenter: NotifItem[];
  markRead: (id: string) => void;
  markAllRead: () => void;
  notifCenterOpen: boolean;
  setNotifCenterOpen: (open: boolean) => void;

  /**
   * マイページ 定期確認ロック
   * - 3ヶ月に1度、ログイン直後に個人情報の再確認を要求する
   */
  mypageLocked: boolean;
  unlockMypage: () => void;
  triggerMypageLock: () => void;
};

const TreeStateContext = createContext<TreeStateValue | null>(null);

const ROLE_CYCLE: Role[] = [ROLES.SPROUT, ROLES.BRANCH, ROLES.MANAGER];

const DEFAULT_STATS: TreeStats = {
  calls: 25,
  remaining: 17,
  efficiency: 78,
  efficiencyVsAvg: 3,
  monthPts: 1.2,
  monthTarget: 3.0,
};

const LS_MENU_ORDER = "gardenTree_menuOrder";
const LS_MYPAGE_LAST_CONFIRM = "gardenTree_mypageLastConfirm";

/** 3ヶ月（= 90日）間隔で定期確認 */
const MYPAGE_CONFIRM_INTERVAL_DAYS = 90;

/**
 * garden_role (8段階) → Tree UI Role (3段階) マッピング
 *
 * - toss    → SPROUT（架電アポインター画面）
 * - closer  → BRANCH（クロージング画面）
 * - cs/staff/outsource/manager/admin/super_admin → MANAGER（モニタリング等）
 *
 * ※ 細粒度の権限チェック（例: 前確画面は CS 以上）は hasRoleAtLeast で
 *    直接 garden_role を判定する。このマッピングはサイドバー・画面表示の大枠用。
 *
 * ※ outsource は Phase A-3-g 追加。GARDEN_ROLE_ORDER で staff と manager の
 *    間（types.ts §198）。両端とも MANAGER 写像のため outsource も MANAGER。
 *
 * exhaustiveness: switch 末尾の `_exhaustive: never` で将来 GardenRole 追加時
 * に TypeScript がここで型エラーを出し、ケース漏れを防ぐ。
 */
export function mapGardenRoleToTreeRole(gr: GardenRole): Role {
  switch (gr) {
    case "toss":
      return ROLES.SPROUT;
    case "closer":
      return ROLES.BRANCH;
    case "cs":
    case "staff":
    case "outsource":
    case "manager":
    case "admin":
    case "super_admin":
      return ROLES.MANAGER;
  }
  // すべてのケースが網羅されていれば gr の型は never に narrowing される。
  // 新しい GardenRole が追加されると下の代入が型エラーになり、
  // 上の switch にケースを追加するよう促される。
  const _exhaustive: never = gr;
  throw new Error(`Unknown GardenRole: ${String(_exhaustive)}`);
}

function readLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocalStorage(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function TreeStateProvider({ children }: { children: ReactNode }) {
  // ============================================================
  // 認証状態
  // ============================================================
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [treeUser, setTreeUser] = useState<TreeUser | null>(null);

  // Tree UI 用の Role（garden_role から導出）
  const [role, setRoleState] = useState<Role>(ROLES.SPROUT);

  const refreshAuth = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    setLoading(true);
    try {
      const session = await getSession();
      if (!session?.user) {
        setIsAuthenticated(false);
        setTreeUser(null);
        return { success: false, error: "セッションがありません" };
      }
      const user = await fetchTreeUser(session.user.id);
      if (!user) {
        setIsAuthenticated(false);
        setTreeUser(null);
        return { success: false, error: "Tree利用権限がありません" };
      }
      setTreeUser(user);
      setRoleState(mapGardenRoleToTreeRole(user.garden_role));
      setIsAuthenticated(true);
      return { success: true };
    } catch (e) {
      console.error("[refreshAuth]", e);
      setIsAuthenticated(false);
      setTreeUser(null);
      return { success: false, error: "認証エラーが発生しました" };
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await signOutTreeLib();
    setIsAuthenticated(false);
    setTreeUser(null);
    setRoleState(ROLES.SPROUT);
  }, []);

  const hasRoleAtLeast = useCallback(
    (baseline: GardenRole) => {
      const gr = treeUser?.garden_role;
      if (!gr) return false;
      return isRoleAtLeast(gr, baseline);
    },
    [treeUser],
  );

  // 初回マウント時に認証確認
  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  // ============================================================
  // デモ用 role 切替（開発者ツール）
  // ============================================================
  const setRole = useCallback((r: Role) => {
    setRoleState(r);
  }, []);

  const cycleRole = useCallback(() => {
    setRoleState((prev) => {
      const idx = ROLE_CYCLE.indexOf(prev);
      return ROLE_CYCLE[(idx + 1) % ROLE_CYCLE.length];
    });
  }, []);

  // ============================================================
  // メニュー並べ替え（localStorage 永続化）
  // ============================================================
  const [menuOrder, setMenuOrderState] = useState<string[]>([]);

  useEffect(() => {
    setMenuOrderState(readLocalStorage<string[]>(LS_MENU_ORDER, []));
  }, []);

  const setMenuOrder = useCallback((order: string[]) => {
    setMenuOrderState(order);
    writeLocalStorage(LS_MENU_ORDER, order);
  }, []);

  // ============================================================
  // 離席・休憩
  // ============================================================
  const [isAway, setIsAwayState] = useState(false);
  const setIsAway = useCallback((v: boolean) => setIsAwayState(v), []);

  const startBreak = useCallback((type: "lunch" | "short") => {
    // TODO: 打刻 API 連携（Phase B で KoT API 同期）
    // eslint-disable-next-line no-console
    console.log("[TreeState] startBreak", type);
  }, []);

  // ============================================================
  // 通知センター（デモ用に空配列）
  // ============================================================
  const [notifCenter, setNotifCenter] = useState<NotifItem[]>([]);
  const [notifCenterOpen, setNotifCenterOpen] = useState(false);

  const markRead = useCallback((id: string) => {
    setNotifCenter((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifCenter((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  // ============================================================
  // マイページ定期確認ロック
  // ============================================================
  const [mypageLocked, setMypageLockedState] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(LS_MYPAGE_LAST_CONFIRM);
      if (!raw) {
        setMypageLockedState(true);
        return;
      }
      const last = new Date(raw);
      const days = (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24);
      if (days >= MYPAGE_CONFIRM_INTERVAL_DAYS) {
        setMypageLockedState(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const unlockMypage = useCallback(() => {
    setMypageLockedState(false);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          LS_MYPAGE_LAST_CONFIRM,
          new Date().toISOString(),
        );
      } catch {
        /* ignore */
      }
    }
  }, []);

  const triggerMypageLock = useCallback(() => {
    setMypageLockedState(true);
  }, []);

  // ============================================================
  // Context value
  // ============================================================
  const value = useMemo<TreeStateValue>(
    () => ({
      loading,
      isAuthenticated,
      treeUser,
      gardenRole: treeUser?.garden_role ?? null,
      refreshAuth,
      signOut,
      hasRoleAtLeast,
      role,
      setRole,
      cycleRole,
      stats: DEFAULT_STATS,
      fbRemaining: 0,
      tossWaitCount: 0,
      confirmWaitCount: 0,
      alertCount: 0,
      isAway,
      setIsAway,
      startBreak,
      menuOrder,
      setMenuOrder,
      notifCenter,
      markRead,
      markAllRead,
      notifCenterOpen,
      setNotifCenterOpen,
      mypageLocked,
      unlockMypage,
      triggerMypageLock,
    }),
    [
      loading,
      isAuthenticated,
      treeUser,
      refreshAuth,
      signOut,
      hasRoleAtLeast,
      role,
      setRole,
      cycleRole,
      isAway,
      setIsAway,
      startBreak,
      menuOrder,
      setMenuOrder,
      notifCenter,
      markRead,
      markAllRead,
      notifCenterOpen,
      mypageLocked,
      unlockMypage,
      triggerMypageLock,
    ],
  );

  // 未使用変数抑止（GARDEN_ROLE_ORDER は将来用に保持）
  void GARDEN_ROLE_ORDER;

  return (
    <TreeStateContext.Provider value={value}>
      {children}
    </TreeStateContext.Provider>
  );
}

export function useTreeState(): TreeStateValue {
  const ctx = useContext(TreeStateContext);
  if (!ctx) {
    throw new Error("useTreeState must be used within TreeStateProvider");
  }
  return ctx;
}
