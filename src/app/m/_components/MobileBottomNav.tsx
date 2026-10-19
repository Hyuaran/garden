"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MobileIcon } from "./MobileIcon";
import styles from "../mobile.module.css";
import { useNotices } from "@/app/_components/notices/NoticeProvider";
import { usePathname } from "next/navigation";

import { createBrowserClient } from "@/app/_lib/supabase/browser";

import { getMobileTodoCounts } from "../_lib/mobile-expenses";
import { isActiveMobileNav, MOBILE_NAV_ITEMS } from "../_lib/mobile-nav";

export function MobileBottomNav() {
  const noticeCount = useNotices()?.unreadCount ?? 0;
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
    <nav aria-label="モバイル共通ナビ" className={styles.nav}>
      {MOBILE_NAV_ITEMS.map((item) => {
        const active = isActiveMobileNav(pathname, item.href);
        const badge = item.key === "todo" ? todoCount : item.key === "news" ? noticeCount : 0;
        return (
          <Link key={item.key} href={item.href} aria-label={item.label} aria-current={active ? "page" : undefined}>
            <span style={iconWrap}>
              <MobileIcon name={item.key}/>
              {badge > 0 && <span style={badgeStyle}>{badge > 99 ? "99+" : badge}</span>}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

const iconWrap: React.CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 19,
  lineHeight: 1,
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
