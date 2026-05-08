"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchCurrentPhase, fetchNextMilestone } from "../_lib/roadmap-queries";
import { useBloomState } from "../_state/BloomStateContext";
import type { DailyLog, PlannedItem } from "../_types/daily-log";
import type { RoadmapEntry } from "../_types/roadmap-entry";
import type { WorkerStatus, WorkerStatusKind } from "../_types/worker-status";
import { ShojiStatusWidget } from "../../../components/shared/ShojiStatusWidget";
import { NextMilestoneCard } from "./components/NextMilestoneCard";
import { RunningProjectCard } from "./components/RunningProjectCard";
import { TodayPlanList } from "./components/TodayPlanList";
import { WeeklyAchievement } from "./components/WeeklyAchievement";
import { WorkerStatusCard } from "./components/WorkerStatusCard";
import { fetchRecentLogs, fetchTodayLog } from "./_lib/daily-log-queries";
import { upsertMyStatus, upsertTodayPlannedItems } from "./_lib/mutations";
import { fetchMyWorkerStatus } from "./_lib/status-queries";

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function sevenDaysAgoISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}


export default function WorkboardPage() {
  const { bloomUser } = useBloomState();
  const userId = bloomUser?.user_id ?? null;

  const [status, setStatus] = useState<WorkerStatus | null>(null);
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null);
  const [recentLogs, setRecentLogs] = useState<DailyLog[]>([]);
  const [running, setRunning] = useState<RoadmapEntry | null>(null);
  const [milestone, setMilestone] = useState<RoadmapEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = todayISO();

  const loadAll = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const [s, tl, rl, phase, ms] = await Promise.all([
        fetchMyWorkerStatus(userId),
        fetchTodayLog(userId, today),
        fetchRecentLogs(userId, sevenDaysAgoISO()),
        fetchCurrentPhase(),
        fetchNextMilestone(),
      ]);
      setStatus(s);
      setTodayLog(tl);
      setRecentLogs(rl);
      setRunning(phase);
      setMilestone(ms);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "データ取得に失敗しました";
      console.error("[bloom/workboard] load error:", err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [userId, today]);

  useEffect(() => {
    if (!userId) return;
    void loadAll();
  }, [userId, loadAll]);

  const handleStatusUpdate = async (next: WorkerStatusKind) => {
    if (!userId) return;
    const updated = await upsertMyStatus(userId, next);
    if (updated) setStatus(updated);
  };

  const handlePlanChange = async (items: PlannedItem[]) => {
    if (!userId) return;
    const updated = await upsertTodayPlannedItems(userId, today, items);
    if (updated) setTodayLog(updated);
  };

  const weeklyStats = useMemo(() => {
    const all: PlannedItem[] = recentLogs.flatMap((l) => l.planned_items ?? []);
    const completed = all.filter((it) => it.done_bool).length;
    const hours = recentLogs.reduce((acc, l) => acc + (l.hours_logged ?? 0), 0);
    return {
      completedPlans: completed,
      totalPlans: all.length,
      hoursLogged: hours > 0 ? hours : null,
      spanDays: 7,
    };
  }, [recentLogs]);

  if (!userId) {
    return (
      <div style={{ padding: 24, color: "#6b8e75" }}>
        ユーザー情報を取得しています...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1b4332", margin: 0 }}>
          🧭 Workboard
        </h2>
        <p style={{ fontSize: 13, color: "#6b8e75", margin: "4px 0 0" }}>
          {bloomUser?.name ?? ""} さん / {today}
        </p>
      </header>

      <section aria-label="東海林さんステータス" style={{ marginBottom: 16 }}>
        <ShojiStatusWidget mode="compact" />
      </section>

      {error && (
        <div
          style={{
            padding: "10px 14px",
            marginBottom: 16,
            borderRadius: 8,
            background: "#fef2f2",
            color: "#7f1d1d",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: 13, color: "#6b8e75" }}>読み込み中...</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          <WorkerStatusCard
            status={status?.status ?? "available"}
            statusNote={status?.status_note ?? null}
            until={status?.until ?? null}
            updatedAt={status?.updated_at ?? null}
            onUpdate={handleStatusUpdate}
          />
          <TodayPlanList
            items={todayLog?.planned_items ?? []}
            onChange={handlePlanChange}
          />
          <RunningProjectCard project={running} />
          <WeeklyAchievement stats={weeklyStats} />
          <NextMilestoneCard milestone={milestone} />
        </div>
      )}
    </div>
  );
}
