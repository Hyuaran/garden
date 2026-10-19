"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuthUnified } from "@/app/_lib/auth-unified";
import { createBrowserClient } from "@/app/_lib/supabase/browser";
import {
  acknowledgeNotices, excludedNoticePath, fetchNotices, japanDate,
  publishNotice, setNoticeUnpublished, snoozeNotices, visibleNotices, type NoticeSnapshot,
} from "@/lib/notices";

function useNoticeState() {
  const excluded = excludedNoticePath(usePathname());
  const { userId, role, loading } = useAuthUnified();
  const [result, setResult] = useState<{ userId: string; snapshot: NoticeSnapshot } | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const snapshot = result?.userId === userId ? result.snapshot : null;

  useEffect(() => {
    if (!userId || loading || excluded) return;
    let cancelled = false;
    // Start after the page paints; never block the application on notices.
    const timer = window.setTimeout(() => {
      setError(false);
      void fetchNotices(createBrowserClient(), userId).then(snapshot => {
        if (!cancelled) setResult({ userId, snapshot });
      }).catch(() => {
        if (!cancelled) setError(true);
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [userId, loading, revision, excluded]);

  const refresh = useCallback(() => setRevision(n => n + 1), []);

  function acknowledge(ids: string[]) {
    if (!snapshot || !userId) return;
    setResult({ userId, snapshot: {
      ...snapshot, readIds: [...new Set([...snapshot.readIds, ...ids])],
    } });
    // Keep the optimistic state on failure. The next visit reloads persisted state.
    void acknowledgeNotices(createBrowserClient(), snapshot.employeeId, ids).catch(() => {});
  }

  function snooze() {
    if (!snapshot || !userId) return;
    const day = japanDate();
    setResult({ userId, snapshot: { ...snapshot, snoozedOn: day } });
    void snoozeNotices(createBrowserClient(), snapshot.employeeId, day).catch(() => {});
  }

  async function publish(id: string) {
    await publishNotice(createBrowserClient(), id);
    refresh();
  }

  async function unpublish(id: string, status: "draft" | "hidden" = "hidden") {
    await setNoticeUnpublished(createBrowserClient(), id, status);
    refresh();
  }

  const published = visibleNotices(snapshot?.notices ?? [], role);
  const unreadCount = published.filter(n => !snapshot?.readIds.includes(n.id)).length;
  return { snapshot, published, unreadCount, error, refresh, acknowledge, snooze, publish, unpublish };
}

const Context = createContext<ReturnType<typeof useNoticeState> | null>(null);

export function NoticeProvider({ children }: { children: ReactNode }) {
  const state = useNoticeState();
  return <Context.Provider value={state}>{children}</Context.Provider>;
}

export function useNotices() {
  return useContext(Context);
}
