import { bloomRead } from './view-read';
/**
 * Bloom 共有ロードマップクエリ
 *
 * Workboard（T4）と Roadmap 画面（T5）の両方が参照する。
 * bloom_roadmap_entries テーブルを薄くラップし、kind 別の取得と
 * 進行中判定ロジックを一箇所にまとめる。
 */

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
let rows = await bloomRead<RoadmapEntry[]>('roadmap');
 rows = rows.filter(row => row.kind === kind && (options.includeArchived || !row.is_archived));
 if (options.activeOnly) rows = rows.filter(row => !row.completed_on || row.completed_on >= new Date().toISOString().slice(0,10));
 if (options.order === 'due_on') rows.sort((a,b) => (a.due_on ?? '9999').localeCompare(b.due_on ?? '9999'));
 return rows;
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
return (await bloomRead<RoadmapEntry[]>('roadmap')).filter(row => !row.is_archived);
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
