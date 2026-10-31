import type { ReactNode } from "react";
import { createServerClient } from "@/app/_lib/supabase/server";
import { isTossPreparingFor, TOSS_PREPARING_MESSAGE } from "@/app/p/_lib/server-auth";

export const dynamic = "force-dynamic";

// 作り直しの間は、全権管理者以外には「準備中です」だけを出す（2026-11-01）。ログイン前はページ側のログイン案内に任せる
export default async function TossLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user || !(await isTossPreparingFor(data.user.id))) return children;
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "var(--bg-paper-soft)", color: "var(--text-main)" }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 8px" }}>{TOSS_PREPARING_MESSAGE}</h1>
        <p style={{ color: "var(--text-sub)", margin: 0 }}>公開までしばらくお待ちください。</p>
      </div>
    </main>
  );
}
