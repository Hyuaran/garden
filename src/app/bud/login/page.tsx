"use client";

/**
 * Bud login redirect stub (2026-05-11、Task 1)
 *
 * 旧 /bud/login (社員番号 + パスワードフォーム) は
 * page.legacy-20260511.tsx に保管。
 *
 * 本ファイルは Garden Series 統一ログイン画面 /login への redirect stub。
 * - returnTo は /bud/dashboard を既定
 * - ?reason=expired をそのまま forward (期限切れ警告 banner 表示用)
 *
 * 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 1 §Step 5
 */

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

const DEFAULT_RETURN_TO = "/bud/dashboard";

function BudLoginRedirect() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const returnTo = searchParams.get("returnTo") ?? DEFAULT_RETURN_TO;
    const reason = searchParams.get("reason");
    const qs = new URLSearchParams({ returnTo });
    if (reason) qs.set("reason", reason);
    window.location.replace(`/login?${qs.toString()}`);
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 text-sm text-gray-600">
      ログインページに移動しています…
    </div>
  );
}

export default function BudLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <BudLoginRedirect />
    </Suspense>
  );
}
