"use client";

/**
 * Garden モバイル — ログイン必須ゲート
 * 未ログインなら /login?returnTo=<現在地> へ送る。役割(role)は問わず、
 * 「ログインしている社員なら誰でも」モバイル経費申請に入れる。
 */

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuthUnified } from "@/app/_lib/auth-unified";

const centered: React.CSSProperties = {
  minHeight: "100dvh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#7b745f",
  fontSize: 14,
  background: "#f7f4ec",
};

export function MobileAuthGate({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated } = useAuthUnified();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading || isAuthenticated) return;
    const current = pathname || "/m";
    router.replace(`/login?returnTo=${encodeURIComponent(current)}`);
  }, [loading, isAuthenticated, pathname, router]);

  if (loading) return <div style={centered}>読み込み中…</div>;
  if (!isAuthenticated) return <div style={centered}>ログイン画面へ移動します…</div>;
  return <>{children}</>;
}
