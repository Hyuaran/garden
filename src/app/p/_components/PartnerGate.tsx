"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { supabase } from "@/app/bloom/_lib/supabase";
import { fetchPartnerOrStaff, type PartnerSession } from "../_lib/auth";

const PartnerSessionContext = createContext<PartnerSession | null>(null);

export function usePartnerSession() {
  return useContext(PartnerSessionContext);
}

export function PartnerGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/p/login";
  const [allowed, setAllowed] = useState(false);
  const [session, setSession] = useState<PartnerSession | null>(null);

  useEffect(() => {
    if (isLoginPage) return;

    let cancelled = false;

    const verify = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;

      if (error || !data.user) {
        const current = `${window.location.pathname}${window.location.search}`;
        router.replace(`/p/login?returnTo=${encodeURIComponent(current)}`);
        return;
      }

      try {
        const access = await fetchPartnerOrStaff(data.user.id);
        if (cancelled) return;
        if (!access) {
          router.replace("/p/login");
          return;
        }
        setSession(access);
        setAllowed(true);
      } catch {
        if (!cancelled) router.replace("/p/login");
      }
    };

    void verify();
    return () => { cancelled = true; };
  }, [isLoginPage, pathname, router]);

  if (isLoginPage) return <>{children}</>;
  return allowed ? <PartnerSessionContext.Provider value={session}>{children}</PartnerSessionContext.Provider> : <main aria-label="認証確認中" />;
}
