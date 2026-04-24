/**
 * 用語マッピング (scaffold §5.2)
 *
 * 👥みんな向け (simple) と ⚙️開発向け (detail) の呼称を切替える。
 * モジュール名・Phase・Git 用語など、同一概念の 2 表記をまとめて管理。
 */

import type { ModuleCode } from "../_types/module-progress";
import type { ViewMode } from "../_state/ViewModeContext";

type TermEntry = { simple: string; detail: string };

export const TERM_MAP: Record<string, TermEntry> = {
  // ---- Phase ----
  phase_a: { simple: "経理総務の効率化", detail: "Phase A" },
  phase_b: { simple: "事務業務の効率化", detail: "Phase B" },
  phase_c: { simple: "補完モジュール", detail: "Phase C" },
  phase_d: { simple: "コールシステム切替", detail: "Phase D" },

  // ---- Module (module.<code>) ----
  "module.bud": { simple: "経理ソフト", detail: "Garden-Bud" },
  "module.forest": { simple: "経営ダッシュボード", detail: "Garden-Forest" },
  "module.root": { simple: "従業員マスタ", detail: "Garden-Root" },
  "module.leaf": { simple: "関電業務アプリ", detail: "Garden-Leaf" },
  "module.tree": { simple: "架電アプリ", detail: "Garden-Tree" },
  "module.soil": { simple: "データ基盤", detail: "Garden-Soil" },
  "module.bloom": { simple: "進捗ダッシュボード", detail: "Garden-Bloom" },
  "module.rill": { simple: "チャット連携", detail: "Garden-Rill" },
  "module.seed": { simple: "新事業枠", detail: "Garden-Seed" },

  // ---- Git / PR 用語 ----
  branch: { simple: "作業コース", detail: "ブランチ" },
  commit: { simple: "作業の保存", detail: "コミット" },
  pr: { simple: "変更反映の依頼", detail: "Pull Request" },

  // ---- Status（RoadmapEntry / ModuleProgress 共通） ----
  "status.planned": { simple: "計画中", detail: "Planned" },
  "status.in_progress": { simple: "進行中", detail: "In Progress" },
  "status.at_risk": { simple: "要注意", detail: "At Risk" },
  "status.done": { simple: "完了", detail: "Done" },
};

/** 用語キー → モード別の表示文字列。未定義キーはキーをそのまま返す */
export function t(key: string, mode: ViewMode): string {
  const entry = TERM_MAP[key];
  if (!entry) return key;
  const picked = entry[mode];
  return picked !== "" ? picked : entry.detail;
}

/**
 * ModuleCode を画面ラベルに変換（simple → label_ops 等と併用する用）
 * DB 側 label_dev / label_ops が未設定のときのフォールバックに使う。
 */
export function moduleLabel(code: ModuleCode, mode: ViewMode): string {
  return t(`module.${code}`, mode);
}

/**
 * 進捗率にモード別の文脈を付ける補助
 * simple: "22%"
 * detail: "22% (Phase A / M1 目標 30%)"
 */
export function progressLabel(
  percent: number,
  mode: ViewMode,
  context?: { phaseKey?: string; targetPct?: number },
): string {
  const pct = `${Math.max(0, Math.min(100, Math.round(percent)))}%`;
  if (mode === "simple") return pct;
  const parts: string[] = [pct];
  if (context?.phaseKey) parts.push(t(context.phaseKey, "detail"));
  if (context?.targetPct != null) parts.push(`目標 ${context.targetPct}%`);
  return parts.length > 1 ? `${parts[0]} (${parts.slice(1).join(" / ")})` : pct;
}
