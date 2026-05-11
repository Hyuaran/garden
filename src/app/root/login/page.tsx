"use client";

/**
 * Root login redirect stub (2026-05-11、Task 1)
 *
 * 旧 /root/login (社員番号 + パスワードフォーム + popReturnTo) は
 * page.legacy-20260511.tsx に保管。
 *
 * 本ファイルは Garden Series 統一ログイン画面 /login への redirect stub。
 * returnTo は searchParams から優先取得、無ければ /root を既定。
 *
 * 注: 旧実装の popReturnTo() (sessionStorage 経由復帰 URL) は本 Task では未対応。
 *     searchParams.returnTo が無い場合は /root にフォールバックする。
 *     Phase B-5 (Auth セキュリティ強化) で再検討予定。
 *
 * 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 1 §Step 5
 */

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

const DEFAULT_RETURN_TO = "/root";

function RootLoginRedirect() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const returnTo = searchParams.get("returnTo") ?? DEFAULT_RETURN_TO;
    const reason = searchParams.get("reason");
    const qs = new URLSearchParams({ returnTo });
    if (reason) qs.set("reason", reason);
    window.location.replace(`/login?${qs.toString()}`);
  }, [searchParams]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#fff",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Meiryo, sans-serif",
        fontSize: 14,
        color: "#555",
      }}
    >
      ログインページに移動しています…
    </div>
  );
}

export default function RootLoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#fff" }} />}>
      <RootLoginRedirect />
    </Suspense>
  );
}
