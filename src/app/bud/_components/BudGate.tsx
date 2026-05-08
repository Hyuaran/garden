"use client";

/**
 * Garden-Bud — 認証ゲート
 *
 * 役割:
 * 1. BudStateContext の loading 中はローダー表示
 * 2. 未認証（isAuthenticated=false）なら /bud/login へリダイレクト
 * 3. Bud セッション（2時間）が切れていても /bud/login?reason=expired へ
 * 4. 全て OK なら children を表示
 */

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useBudState } from "../_state/BudStateContext";
import { isBudUnlocked } from "../_lib/auth";

export function BudGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { loading, isAuthenticated } = useBudState();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace("/bud/login");
      return;
    }
    if (!isBudUnlocked()) {
      router.replace("/bud/login?reason=expired");
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-gray-500 text-sm">読み込み中...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white rounded-lg shadow p-8 max-w-sm w-full text-center">
          <div className="text-3xl mb-3">🔒</div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            ログインが必要です
          </h2>
          <p className="text-sm text-gray-500">
            ログイン画面に移動します...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
