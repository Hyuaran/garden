/**
 * Bloom 共有ロードマップクエリ
 *
 * Workboard（T4）と Roadmap 画面（T5）の両方が参照する。
 * bloom_roadmap_entries テーブルを薄くラップし、kind 別の取得と
 * 進行中判定ロジックを一箇所にまとめる。
 */

import { supabase } from "./supabase";
import type { RoadmapEntry, RoadmapEntryKind } from "../_types/roadmap-entry";

type FetchOptions = {
  includeArchived?: boolean;
  /** 絞り込み: 完了していない（または完了日が未来）のエントリのみ */
  activeOnly?: boolean;
  /** 並び順: 既定は sort_order 昇順 */
  order?: "sort_order" | "due_on";
};

async function fetchByKind(
  kind: RoadmapEntryKind,
  options: FetchOptions = {},
): Promise<RoadmapEntry[]> {
  let query = supabase.from("bloom_roadmap_entries").select("*").eq("kind", kind);

  if (!options.includeArchived) {
    query = query.eq("is_archived", false);
  }

  if (options.activeOnly) {
    const today = new Date().toISOString().slice(0, 10);
    query = query.or(`completed_on.is.null,completed_on.gte.${today}`);
  }

  if (options.order === "due_on") {
    query = query.order("due_on", { ascending: true, nullsFirst: false });
  } else {
    query = query.order("sort_order", { ascending: true });
  }

  const { data, error } = await query;
  if (error) {
    console.error(`[bloom] fetch roadmap(${kind}) failed:`, error.message);
    return [];
  }
  return (data ?? []) as RoadmapEntry[];
}

export function fetchPhases(options?: FetchOptions) {
  return fetchByKind("phase", options);
}

export function fetchMilestones(options?: FetchOptions) {
  return fetchByKind("milestone", options);
}

export function fetchModuleEntries(options?: FetchOptions) {
  return fetchByKind("module", options);
}

export function fetchRisks(options?: FetchOptions) {
  return fetchByKind("risk", { ...options, order: options?.order ?? "sort_order" });
}

export function fetchBanners(options?: FetchOptions) {
  return fetchByKind("banner", options);
}

/** すべての非アーカイブエントリをまとめて取得（Roadmap 画面用） */
export async function fetchAllActive(): Promise<RoadmapEntry[]> {
  const { data, error } = await supabase
    .from("bloom_roadmap_entries")
    .select("*")
    .eq("is_archived", false)
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[bloom] fetchAllActive failed:", error.message);
    return [];
  }
  return (data ?? []) as RoadmapEntry[];
}

/** 現在進行中の Phase 1 件（Workboard の RunningProjectCard 用） */
export async function fetchCurrentPhase(): Promise<RoadmapEntry | null> {
  const phases = await fetchPhases({ activeOnly: true });
  return phases[0] ?? null;
}

/** 最も近い未完了マイルストーン 1 件（Workboard の NextMilestoneCard 用） */
export async function fetchNextMilestone(): Promise<RoadmapEntry | null> {
  const milestones = await fetchMilestones({ activeOnly: true, order: "due_on" });
  return milestones[0] ?? null;
}
