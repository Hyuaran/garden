"use client";

/**
 * Tree login redirect stub (2026-05-11、Task 1)
 *
 * 旧 /tree/login (社員番号 + パスワードフォーム) は
 * page.legacy-20260511.tsx に保管。
 *
 * 本ファイルは Garden Series 統一ログイン画面 /login への redirect stub。
 * returnTo は /tree/dashboard を既定とし、既存ブックマーク互換のために残置。
 *
 * 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 1 §Step 5
 */

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

const DEFAULT_RETURN_TO = "/tree/dashboard";

function TreeLoginRedirect() {
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
        background: "#f0fdf4",
        fontFamily: "'Noto Sans JP', sans-serif",
        fontSize: 14,
        color: "#1b4332",
      }}
    >
      ログインページに移動しています…
    </div>
  );
}

export default function TreeLoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#f0fdf4" }} />}>
      <TreeLoginRedirect />
    </Suspense>
  );
}
