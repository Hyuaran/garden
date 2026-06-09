"use client";

/**
 * Garden-Bud page-level gate.
 *
 * ModuleGate handles Garden auth and minimum role checks. BudGate adds Bud's
 * own permission and two-hour unlock checks without confusing Bud denial with
 * a Garden-wide logout.
 */

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { isBudUnlocked } from "../_lib/auth";
import { useBudState } from "../_state/BudStateContext";

const isBudDevBypass =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_AUTH_DEV_BYPASS === "1";

export function BudGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { loading, isAuthenticated, hasPermission } = useBudState();

  useEffect(() => {
    if (loading || isBudDevBypass) return;
    if (!isAuthenticated) {
      router.replace("/bud/login");
      return;
    }
    if (!hasPermission) {
      router.replace("/access-denied?module=bud");
      return;
    }
    if (!isBudUnlocked()) {
      router.replace("/bud/login?reason=expired");
    }
  }, [loading, isAuthenticated, hasPermission, router]);

  if (isBudDevBypass) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-gray-500 text-sm">読み込み中...</div>
      </div>
    );
  }

  if (!isAuthenticated || !hasPermission) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white rounded-lg shadow p-8 max-w-sm w-full text-center">
          <div className="text-3xl mb-3">Bud</div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            Bud の利用権限を確認しています
          </h2>
          <p className="text-sm text-gray-500">
            必要な画面へ移動しています...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
