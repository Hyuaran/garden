"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchAllActive,
  fetchBanners,
  fetchRisks,
} from "../_lib/roadmap-queries";
import type { ModuleProgress } from "../_types/module-progress";
import type { RoadmapEntry, RoadmapEntryKind } from "../_types/roadmap-entry";
import { AnnouncementBanner } from "./components/AnnouncementBanner";
import { ModuleProgressGrid } from "./components/ModuleProgressGrid";
import { OverallProgressBar } from "./components/OverallProgressBar";
import { RiskCardList } from "./components/RiskCardList";
import { TimelineChart } from "./components/TimelineChart";
import {
  aggregateByMonth,
  calculateOverallProgress,
  sortBySeverityDesc,
} from "./_lib/progress-aggregator";
import { fetchModuleProgress } from "./_lib/module-progress-queries";

const KIND_FILTERS: Array<{ value: "all" | RoadmapEntryKind; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "phase", label: "Phase" },
  { value: "milestone", label: "マイルストーン" },
  { value: "module", label: "モジュール" },
  { value: "risk", label: "リスク" },
];

export default function RoadmapPage() {
  const [entries, setEntries] = useState<RoadmapEntry[]>([]);
  const [risks, setRisks] = useState<RoadmapEntry[]>([]);
  const [banners, setBanners] = useState<RoadmapEntry[]>([]);
  const [modules, setModules] = useState<ModuleProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | RoadmapEntryKind>("all");

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [all, rks, bns, mods] = await Promise.all([
        fetchAllActive(),
        fetchRisks({ activeOnly: true }),
        fetchBanners({ activeOnly: true }),
        fetchModuleProgress(),
      ]);
      setEntries(all);
      setRisks(sortBySeverityDesc(rks));
      setBanners(sortBySeverityDesc(bns));
      setModules(mods);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "データ取得に失敗しました";
      console.error("[bloom/roadmap] load error:", err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const overall = useMemo(() => calculateOverallProgress(entries), [entries]);
  const buckets = useMemo(() => aggregateByMonth(entries), [entries]);

  const filteredBuckets = useMemo(() => {
    if (filter === "all") return buckets;
    return buckets
      .map((b) => ({ ...b, entries: b.entries.filter((e) => e.kind === filter) }))
      .filter((b) => b.entries.length > 0);
  }, [buckets, filter]);

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1b4332", margin: 0 }}>
          🗺️ ロードマップ
        </h2>
        <p style={{ fontSize: 13, color: "#6b8e75", margin: "4px 0 0" }}>
          Garden 全体の進捗と M1〜M8 のタイムライン
        </p>
      </header>

      <AnnouncementBanner banners={banners} />

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
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <OverallProgressBar percent={overall} />
          <TimelineChart buckets={filteredBuckets} />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {KIND_FILTERS.map((k) => {
              const active = filter === k.value;
              return (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setFilter(k.value)}
                  style={{
                    padding: "6px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 16,
                    border: active ? "1px solid #40916c" : "1px solid #d8f3dc",
                    background: active ? "#40916c" : "#fff",
                    color: active ? "#fff" : "#1b4332",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {k.label}
                </button>
              );
            })}
          </div>

          <ModuleProgressGrid modules={modules} />
          <RiskCardList risks={risks} />
        </div>
      )}
    </div>
  );
}
