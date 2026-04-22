"use client";

/**
 * Garden-Root アプリ全体の認証状態
 *
 * - Supabase Auth セッション + root_employees 参照結果を保持
 * - canWrite / hasRoleAtLeast ヘルパーを公開
 * - タイマーを駆動し、残り WARNING_OFFSET_MS で警告 state を立てる
 * - 2 時間経過で自動ログアウト
 *
 * パターン: Tree の TreeStateContext を踏襲。Root は Tree にない
 *   「canWrite」「warningActive」「extendSession」を追加。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  ROOT_VIEW_ROLES,
  ROOT_WRITE_ROLES,
  isRoleAtLeast,
  type GardenRole,
} from "../_constants/types";
import {
  clearRootUnlock,
  getSession,
  getSessionElapsedMs,
  isRootUnlocked,
  signOutRoot as signOutRootLib,
  touchRootSession,
} from "../_lib/auth";
import { writeAudit } from "../_lib/audit";
import { fetchRootUser, type RootUser } from "../_lib/queries";
import {
  SESSION_TIMEOUT_MS,
  TIMER_POLL_INTERVAL_MS,
  WARNING_OFFSET_MS,
} from "../_lib/session-timer";

export type LogoutReason = "manual" | "timeout" | "role_changed" | "forbidden";

type RootStateValue = {
  loading: boolean;
  isAuthenticated: boolean;
  rootUser: RootUser | null;
  gardenRole: GardenRole | null;
  canWrite: boolean;
  warningActive: boolean;
  remainingMs: number;
  refreshAuth: () => Promise<{ success: boolean; error?: string }>;
  signOut: (reason?: LogoutReason) => Promise<void>;
  extendSession: () => void;
  hasRoleAtLeast: (baseline: GardenRole) => boolean;
};

const RootStateContext = createContext<RootStateValue | null>(null);

export function RootStateProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [rootUser, setRootUser] = useState<RootUser | null>(null);
  const [warningActive, setWarningActive] = useState(false);
  const [remainingMs, setRemainingMs] = useState(SESSION_TIMEOUT_MS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshAuth = useCallback(async () => {
    setLoading(true);
    try {
      const session = await getSession();
      if (!session?.user) {
        setIsAuthenticated(false);
        setRootUser(null);
        return { success: false, error: "セッションがありません" };
      }
      const user = await fetchRootUser(session.user.id);
      if (!user) {
        setIsAuthenticated(false);
        setRootUser(null);
        return {
          success: false,
          error: "Garden-Root へのアクセス権限がありません",
        };
      }
      // 閲覧権限 (manager 以上) を確認
      if (!ROOT_VIEW_ROLES.includes(user.garden_role)) {
        await writeAudit({
          action: "login_denied",
          actorUserId: user.user_id,
          actorEmpNum: user.employee_number,
          payload: { role: user.garden_role, required: "manager" },
        });
        setIsAuthenticated(false);
        setRootUser(null);
        clearRootUnlock();
        return {
          success: false,
          error:
            "Garden-Root へのアクセス権限がありません。責任者以上の方にお問い合わせください",
        };
      }
      setRootUser(user);
      setIsAuthenticated(true);
      return { success: true };
    } catch (e) {
      console.error("[refreshAuth]", e);
      setIsAuthenticated(false);
      setRootUser(null);
      return { success: false, error: "認証エラーが発生しました" };
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(
    async (reason: LogoutReason = "manual") => {
      const actorUserId = rootUser?.user_id ?? null;
      const actorEmpNum = rootUser?.employee_number ?? null;
      await writeAudit({
        action: "logout",
        actorUserId,
        actorEmpNum,
        payload: { reason },
      });
      await signOutRootLib();
      setIsAuthenticated(false);
      setRootUser(null);
      setWarningActive(false);
    },
    [rootUser],
  );

  const extendSession = useCallback(() => {
    touchRootSession();
    setWarningActive(false);
    setRemainingMs(SESSION_TIMEOUT_MS);
  }, []);

  const hasRoleAtLeast = useCallback(
    (baseline: GardenRole) => {
      const gr = rootUser?.garden_role;
      if (!gr) return false;
      return isRoleAtLeast(gr, baseline);
    },
    [rootUser],
  );

  const canWrite = useMemo(() => {
    const gr = rootUser?.garden_role;
    if (!gr) return false;
    return ROOT_WRITE_ROLES.includes(gr);
  }, [rootUser]);

  // 初回マウント時に認証確認
  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  // ユーザー操作でタイマー延長
  useEffect(() => {
    if (!isAuthenticated) return;
    const handler = () => {
      touchRootSession();
      // 警告表示中でも操作があれば閉じる
      setWarningActive(false);
    };
    const events = ["mousedown", "keydown", "click"];
    events.forEach((ev) => window.addEventListener(ev, handler));
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handler));
    };
  }, [isAuthenticated]);

  // タイマー駆動 (警告 + 自動ログアウト)
  //   signOut への参照は rootUser 更新の度に変わるが、interval 自体を
  //   作り直すとタイミングがずれる可能性があるため ref 経由で最新版を呼ぶ。
  const signOutRef = useRef(signOut);
  useEffect(() => {
    signOutRef.current = signOut;
  }, [signOut]);

  useEffect(() => {
    if (!isAuthenticated) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      const elapsed = getSessionElapsedMs();
      const remaining = SESSION_TIMEOUT_MS - elapsed;
      setRemainingMs(Math.max(0, remaining));
      if (!isRootUnlocked()) {
        // タイムアウト
        void signOutRef.current("timeout");
        return;
      }
      if (remaining <= WARNING_OFFSET_MS) {
        setWarningActive(true);
      }
    }, TIMER_POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isAuthenticated]);

  const value = useMemo<RootStateValue>(
    () => ({
      loading,
      isAuthenticated,
      rootUser,
      gardenRole: rootUser?.garden_role ?? null,
      canWrite,
      warningActive,
      remainingMs,
      refreshAuth,
      signOut,
      extendSession,
      hasRoleAtLeast,
    }),
    [
      loading,
      isAuthenticated,
      rootUser,
      canWrite,
      warningActive,
      remainingMs,
      refreshAuth,
      signOut,
      extendSession,
      hasRoleAtLeast,
    ],
  );

  return (
    <RootStateContext.Provider value={value}>
      {children}
    </RootStateContext.Provider>
  );
}

export function useRootState(): RootStateValue {
  const ctx = useContext(RootStateContext);
  if (!ctx) {
    throw new Error("useRootState must be used within RootStateProvider");
  }
  return ctx;
}
