"use client";

import { useEffect } from "react";
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

  useEffect(() => {
    if (!isValidProjectId || !employeeNumber) return;
    ensureClarityQueue()("identify", employeeNumber, undefined, pathname, employeeNumber);
  }, [employeeNumber, pathname]);

  if (!isValidProjectId) return null;

  return (
    <Script
      id="microsoft-clarity"
      src={`https://www.clarity.ms/tag/${projectId}`}
      strategy="afterInteractive"
    />
  );
}
