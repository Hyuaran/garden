/**
 * Garden 12 モジュール定義（盆栽ビュー用）
 *
 * 既存 9 + Fruit（実体化済 per memory project_garden_fruit_module）+ Sprout + Calendar の 12 モジュール。
 * enabled フラグは現実装状況に対応（true=実装済 / false=placeholder）。
 * 後の Phase 2-1 以降で a-auto / 東海林さんが Sprout/Calendar/Fruit 役割整理 → enabled=true 切替。
 *
 * category（NotebookLM 4 分類、2026-04-26 確定）:
 *   - 環境: Rill / Forest / Calendar
 *   - 成果: Bud / Bloom / Fruit / Seed
 *   - 成長: Sprout / Tree / Leaf
 *   - 基盤: Soil / Root
 * → hover ラベル / aria-label に活用、世界観の整合性向上
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

export type ModuleCategory = "環境" | "成果" | "成長" | "基盤";

export type ModuleDef = {
  emoji: string;
  label: string;
  href: string;
  color: string;
  enabled: boolean;
  category: ModuleCategory;
};

export const MODULES: Record<ModuleKey, ModuleDef> = {
  soil:     { emoji: "🌱", label: "Soil",     href: "/soil",            color: "#8B6F47", enabled: false, category: "基盤" },
  root:     { emoji: "🌿", label: "Root",     href: "/root",            color: "#5C4332", enabled: true,  category: "基盤" },
  tree:     { emoji: "🌲", label: "Tree",     href: "/tree",            color: "#3B9B5C", enabled: true,  category: "成長" },
  leaf:     { emoji: "🍃", label: "Leaf",     href: "/leaf",            color: "#7FC66D", enabled: false, category: "成長" },
  bud:      { emoji: "🌸", label: "Bud",      href: "/bud",             color: "#E07A9B", enabled: false, category: "成果" },
  bloom:    { emoji: "🌺", label: "Bloom",    href: "/bloom/workboard", color: "#C3447A", enabled: true,  category: "成果" },
  seed:     { emoji: "🌰", label: "Seed",     href: "/seed",            color: "#D9BC92", enabled: false, category: "成果" },
  forest:   { emoji: "🌳", label: "Forest",   href: "/forest",          color: "#1F5C3A", enabled: true,  category: "環境" },
  rill:     { emoji: "🌊", label: "Rill",     href: "/rill",            color: "#4FA8C9", enabled: false, category: "環境" },
  fruit:    { emoji: "🍎", label: "Fruit",    href: "/fruit",           color: "#D4A340", enabled: false, category: "成果" },
  sprout:   { emoji: "🌿", label: "Sprout",   href: "/sprout",          color: "#A8D87A", enabled: false, category: "成長" },
  calendar: { emoji: "📅", label: "Calendar", href: "/calendar",        color: "#9B86C9", enabled: false, category: "環境" },
};

export const MODULE_KEYS: ModuleKey[] = [
  "soil", "root", "tree", "leaf", "bud", "bloom",
  "seed", "forest", "rill", "fruit", "sprout", "calendar",
];
