"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useAuthUnified } from "@/app/_lib/auth-unified";

type ClarityFunction = ((
  command: string,
  customId?: string,
  customSessionId?: string,
  customPageId?: string,
  friendlyName?: string,
) => void) & { q?: unknown[] };

declare global {
  interface Window {
    clarity?: ClarityFunction;
  }
}

const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
const isValidProjectId = typeof projectId === "string" && /^[a-z0-9]+$/i.test(projectId);

function ensureClarityQueue() {
  window.clarity = window.clarity || function clarityQueue(...args: unknown[]) {
    (window.clarity!.q = window.clarity!.q || []).push(args);
  } as ClarityFunction;
  return window.clarity;
}

export default function ClarityTracker() {
  const pathname = usePathname();
  const { employeeNumber } = useAuthUnified();
  // 記録するのはログインしている 18 歳以上の人だけ（Clarity の規約・2026-10-26）。ログイン前の画面は記録しない
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    if (!isValidProjectId || !employeeNumber) { setEligible(false); return; }
    const key = `garden.clarity.eligible.${employeeNumber}`;
    try { const cached = sessionStorage.getItem(key); if (cached !== null) { setEligible(cached === "1"); return; } } catch {}
    let cancelled = false;
    fetch("/api/analytics/clarity-eligibility", { cache: "no-store" })
      .then(r => r.ok ? r.json() : { eligible: false })
      .then((j: { eligible?: boolean }) => {
        if (cancelled) return;
        const ok = j.eligible === true;
        setEligible(ok);
        try { sessionStorage.setItem(key, ok ? "1" : "0"); } catch {}
      })
      .catch(() => { if (!cancelled) setEligible(false); });
    return () => { cancelled = true; };
  }, [employeeNumber]);

  useEffect(() => {
    if (!isValidProjectId || !employeeNumber || !eligible) return;
    ensureClarityQueue()("identify", employeeNumber, undefined, pathname, employeeNumber);
  }, [employeeNumber, pathname, eligible]);

  if (!isValidProjectId || !employeeNumber || !eligible) return null;

  return (
    <Script
      id="microsoft-clarity"
      src={`https://www.clarity.ms/tag/${projectId}`}
      strategy="afterInteractive"
    />
  );
}
