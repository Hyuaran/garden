"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { supabase } from "@/app/bloom/_lib/supabase";
import { fetchTossPartner } from "../_lib/auth";

export function TossGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/toss/login";
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (isLoginPage) return;

    let cancelled = false;

    const verify = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;

      if (error || !data.user) {
        const current = `${window.location.pathname}${window.location.search}`;
        router.replace(`/toss/login?returnTo=${encodeURIComponent(current)}`);
        return;
      }

      try {
        const partner = await fetchTossPartner(data.user.id);
        if (cancelled) return;
        if (!partner?.is_active) {
          router.replace("/toss/login");
          return;
        }
        setAllowed(true);
      } catch {
        if (!cancelled) router.replace("/toss/login");
      }
    };

    void verify();
    return () => { cancelled = true; };
  }, [isLoginPage, pathname, router]);

  if (isLoginPage) return <>{children}</>;
  return allowed ? <>{children}</> : <main aria-label="認証確認中" />;
}
