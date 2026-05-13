"use client";

/**
 * Garden Series ホーム画面 (`/`) admin/super_admin 限定ゲート
 *
 * dispatch main- No. 89 §a-root-002 連携 #2 (2026-05-07) 準拠:
 *   - admin / super_admin → 通過 (children render = 12 モジュール円環表示)
 *   - 他の role → ROLE_LANDING_MAP で role landing 画面へ redirect
 *   - 未認証 → /login?returnTo=/ へ redirect
 *
 * dev (NODE_ENV=development) ではバイパス (Chrome MCP 視覚確認用)。
 * 本番 NODE_ENV=production では garden_role を root_employees から取得して判定。
 *
 * 認証 backend 共通化 (signInGarden / supabase-client.ts) は a-root-002 が
 * 5/9-12 で実装予定。本ゲートはその合流まで暫定実装、合流後に共通 Gate に置換予定。
 */

import { useEffect, useState, type ReactNode } from "react";
import { ROLE_LANDING_MAP } from "../_lib/auth-redirect";
import { supabase } from "../bloom/_lib/supabase";

const ADMIN_ROLES = new Set(["admin", "super_admin"]);

export function GardenHomeGate({ children }: { children: ReactNode }) {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  const isDevBypass = process.env.NODE_ENV === "development";

  useEffect(() => {
    if (isDevBypass) {
      setAllowed(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        if (!cancelled) {
          const returnTo = encodeURIComponent("/");
          window.location.replace(`/login?returnTo=${returnTo}`);
        }
        return;
      }

      const { data: emp } = await supabase
        .from("root_employees")
        .select("garden_role")
        .eq("user_id", session.user.id)
        .maybeSingle();

      const role = emp?.garden_role ?? "default";

      if (ADMIN_ROLES.has(role)) {
        if (!cancelled) {
          setAllowed(true);
          setLoading(false);
        }
        return;
      }

      const target = ROLE_LANDING_MAP[role] ?? ROLE_LANDING_MAP.default;
      if (!cancelled) {
        window.location.replace(target);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isDevBypass]);

  if (allowed) {
    return <>{children}</>;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #1a1a2e 0%, #2a2540 50%, #3a2845 100%)",
        color: "#fdfbf3",
        fontFamily: "var(--font-cormorant), 'Noto Serif JP', serif",
        fontStyle: "italic",
        fontSize: 18,
        letterSpacing: "0.04em",
        textShadow: "0 2px 12px rgba(0,0,0,0.6)",
      }}
    >
      <p style={{ margin: 0 }}>
        {loading ? "Garden Series — 認証確認中…" : "Garden Series — 移動中…"}
      </p>
    </div>
  );
}
