"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { createBrowserClient } from "@/app/_lib/supabase/browser";

import { getMobileTodoCounts } from "../_lib/mobile-expenses";
import { isActiveMobileNav, MOBILE_NAV_ITEMS } from "../_lib/mobile-nav";

export function MobileBottomNav() {
  const pathname = usePathname();
  const supabase = useMemo(() => createBrowserClient(), []);
  const [todoCount, setTodoCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const counts = await getMobileTodoCounts(supabase);
        if (!cancelled) setTodoCount(counts.returned + counts.submitted + counts.finalPending);
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [supabase]);

  return (
    <nav aria-label="モバイル共通ナビ" style={nav}>
      {MOBILE_NAV_ITEMS.map((item) => {
        const active = isActiveMobileNav(pathname, item.href);
        const badge = item.key === "todo" ? todoCount : 0;
        return (
          <Link key={item.key} href={item.href} style={navLink(active)} aria-current={active ? "page" : undefined}>
            <span style={iconWrap}>
              <span aria-hidden>{item.icon}</span>
              {badge > 0 && <span style={badgeStyle}>{badge > 99 ? "99+" : badge}</span>}
            </span>
            <span style={labelStyle}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

const nav: React.CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 50,
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  padding: "7px 8px calc(7px + env(safe-area-inset-bottom))",
  background: "rgba(255, 253, 246, 0.96)",
  borderTop: "1px solid rgba(180, 165, 130, 0.28)",
  boxShadow: "0 -8px 24px rgba(61, 53, 40, 0.08)",
  backdropFilter: "blur(14px)",
};

const navLink = (active: boolean): React.CSSProperties => ({
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 3,
  padding: "5px 2px",
  borderRadius: 12,
  color: active ? "#a97916" : "#756f62",
  background: active ? "rgba(212, 165, 65, 0.16)" : "transparent",
  textDecoration: "none",
  fontWeight: active ? 700 : 500,
});

const iconWrap: React.CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 19,
  lineHeight: 1,
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  lineHeight: 1,
  whiteSpace: "nowrap",
};

const badgeStyle: React.CSSProperties = {
  position: "absolute",
  top: -8,
  right: -14,
  minWidth: 16,
  height: 16,
  padding: "0 4px",
  borderRadius: 999,
  background: "#c54a3a",
  color: "#fff",
  fontSize: 9,
  lineHeight: "16px",
  textAlign: "center",
  fontWeight: 700,
};
