"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { BloomShell } from "./BloomShell";

const GARDEN_SHELL_PATHS = new Set([
  "/bloom",
  "/bloom/ceo-status",
  "/bloom/workboard",
  "/bloom/daily-report",
  "/bloom/monthly-digest",
  "/bloom/blueprint",
  "/bloom/progress",
  "/bloom/kpi",
]);

export function BloomLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  const normalizedPathname = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;

  if (GARDEN_SHELL_PATHS.has(normalizedPathname)) {
    return <>{children}</>;
  }

  return <BloomShell>{children}</BloomShell>;
}
