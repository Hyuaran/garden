"use client";

/**
 * Garden-Tree アプリ全体の共有状態
 *
 * プロトタイプでは最上位コンポーネントで useState を並べていたが、
 * Next.js App Router では layout.tsx 配下で Provider を敷き、
 * 各画面・サイドバー・KPI ヘッダーが useTreeState() で参照する。
 *
 * 現時点ではデモ値で固定されているものが多いが、
 * 今後 Supabase のリアルデータ／Auth と接続していく拡張ポイントになる。
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

import { ROLES, type Role } from "../_constants/roles";

/** KPI ヘッダーで使う各種統計値（デモ値） */
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
  role: Role;
  setRole: (r: Role) => void;
  cycleRole: () => void;

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
   * - ロック中は他画面への遷移に警告を出す（後続タスク）
   */
  mypageLocked: boolean;
  /** 「変更はありません」で確認完了 → ロック解除 + 確認日保存 */
  unlockMypage: () => void;
  /** ダッシュボードからの強制ロック（3ヶ月経過検知時など） */
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

const LS_ROLE = "gardenTree_role";
const LS_MENU_ORDER = "gardenTree_menuOrder";
const LS_MYPAGE_LAST_CONFIRM = "gardenTree_mypageLastConfirm";

/** 3ヶ月（= 90日）間隔で定期確認 */
const MYPAGE_CONFIRM_INTERVAL_DAYS = 90;

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
  // 権限：localStorage 永続化（初期値は SPROUT）
  const [role, setRoleState] = useState<Role>(ROLES.SPROUT);
  const [menuOrder, setMenuOrderState] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // クライアント hydration 後に localStorage を反映
  useEffect(() => {
    setRoleState(readLocalStorage<Role>(LS_ROLE, ROLES.SPROUT));
    setMenuOrderState(readLocalStorage<string[]>(LS_MENU_ORDER, []));
    setHydrated(true);
  }, []);

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    writeLocalStorage(LS_ROLE, r);
  }, []);

  const cycleRole = useCallback(() => {
    setRoleState((prev) => {
      const idx = ROLE_CYCLE.indexOf(prev);
      const next = ROLE_CYCLE[(idx + 1) % ROLE_CYCLE.length];
      writeLocalStorage(LS_ROLE, next);
      return next;
    });
  }, []);

  const setMenuOrder = useCallback((order: string[]) => {
    setMenuOrderState(order);
    writeLocalStorage(LS_MENU_ORDER, order);
  }, []);

  const [isAway, setIsAwayState] = useState(false);
  const setIsAway = useCallback((v: boolean) => setIsAwayState(v), []);

  const startBreak = useCallback((type: "lunch" | "short") => {
    // TODO: 打刻 API 連携
    // eslint-disable-next-line no-console
    console.log("[TreeState] startBreak", type);
  }, []);

  // 通知センター：デモ用に空配列スタート
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

  // マイページ定期確認ロック：初期値 false。hydration 後に localStorage を読んで判定
  const [mypageLocked, setMypageLockedState] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(LS_MYPAGE_LAST_CONFIRM);
      if (!raw) {
        // 未確認：初回ログイン時は lock を ON にして確認を促す
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

  const value = useMemo<TreeStateValue>(
    () => ({
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

  // hydration 前でもレンダーは行うが、localStorage 依存箇所は
  // useEffect 後に再レンダーされるため表示のブレは最小限。
  void hydrated;

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
