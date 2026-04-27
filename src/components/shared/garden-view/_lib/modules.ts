/**
 * Garden 12 モジュール定義（3 レイヤー大樹ビュー用）
 *
 * 既存 9 + Fruit（実体化済 per memory project_garden_fruit_module）+ Sprout + Calendar の 12 モジュール。
 * enabled フラグは現実装状況に対応（true=実装済 / false=placeholder）。
 *
 * layer（memory project_garden_3layer_visual_model 準拠、2026-04-26 確定）:
 *   - 樹冠 (Layer 3): Bloom / Fruit / Seed / Forest / Calendar
 *   - 地上 (Layer 2): Bud / Leaf / Tree / Sprout
 *   - 地下 (Layer 1): Soil / Root / Rill
 *
 * description（Phase 2-2 候補 8 Step 2 で追加、2026-04-27）: 各モジュールの役割を 13 文字程度の日本語で。
 * MODULE_KEYS の順序は CLAUDE.md §モジュール構成 公式 1-12 順（aria / Tab / iteration order に影響）。
 */

export type ModuleKey =
  | "soil"
  | "root"
  | "tree"
  | "leaf"
  | "bud"
  | "bloom"
  | "seed"
  | "forest"
  | "rill"
  | "fruit"
  | "sprout"
  | "calendar";

export type ModuleLayer = "樹冠" | "地上" | "地下";

export type ModuleDef = {
  emoji: string;
  label: string;
  /** 13 文字程度の日本語役割説明（候補 8 Step 2） */
  description: string;
  href: string;
  color: string;
  enabled: boolean;
  layer: ModuleLayer;
};

export const MODULES: Record<ModuleKey, ModuleDef> = {
  // Layer 3 樹冠（5 modules）
  bloom:    { emoji: "🌺", label: "Bloom",    description: "案件一覧・KPI",            href: "/bloom/workboard", color: "#C3447A", enabled: true,  layer: "樹冠" },
  fruit:    { emoji: "🍎", label: "Fruit",    description: "法人実体（番号系・許認可）", href: "/fruit",           color: "#D4A340", enabled: false, layer: "樹冠" },
  seed:     { emoji: "🌰", label: "Seed",     description: "新事業",                  href: "/seed",            color: "#D9BC92", enabled: false, layer: "樹冠" },
  forest:   { emoji: "🌳", label: "Forest",   description: "全法人決算",              href: "/forest",          color: "#1F5C3A", enabled: true,  layer: "樹冠" },
  calendar: { emoji: "📅", label: "Calendar", description: "時間軸・スケジュール",     href: "/calendar",        color: "#9B86C9", enabled: false, layer: "樹冠" },
  // Layer 2 地上（4 modules）
  bud:      { emoji: "🌸", label: "Bud",      description: "経理・収支",              href: "/bud",             color: "#E07A9B", enabled: false, layer: "地上" },
  leaf:     { emoji: "🍃", label: "Leaf",     description: "個別アプリ・トスアップ",   href: "/leaf",            color: "#7FC66D", enabled: false, layer: "地上" },
  tree:     { emoji: "🌲", label: "Tree",     description: "架電アプリ",              href: "/tree",            color: "#3B9B5C", enabled: true,  layer: "地上" },
  sprout:   { emoji: "🌿", label: "Sprout",   description: "新商材オンボーディング",   href: "/sprout",          color: "#A8D87A", enabled: false, layer: "地上" },
  // Layer 1 地下（3 modules）
  soil:     { emoji: "🌱", label: "Soil",     description: "DB 本体・大量データ基盤",  href: "/soil",            color: "#8B6F47", enabled: false, layer: "地下" },
  root:     { emoji: "🌿", label: "Root",     description: "組織・マスタデータ",       href: "/root",            color: "#5C4332", enabled: true,  layer: "地下" },
  rill:     { emoji: "🌊", label: "Rill",     description: "Chatwork 連携",          href: "/rill",            color: "#4FA8C9", enabled: false, layer: "地下" },
};

// CLAUDE.md §モジュール構成 公式 1-12 順（候補 8 Step 2 で reorder、2026-04-27）
export const MODULE_KEYS: ModuleKey[] = [
  "soil", "root", "tree", "leaf",
  "bud", "bloom", "seed", "forest",
  "rill", "fruit", "sprout", "calendar",
];
