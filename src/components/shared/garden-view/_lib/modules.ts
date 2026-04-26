/**
 * Garden 12 モジュール定義（3 レイヤー大樹ビュー用）
 *
 * 既存 9 + Fruit（実体化済 per memory project_garden_fruit_module）+ Sprout + Calendar の 12 モジュール。
 * enabled フラグは現実装状況に対応（true=実装済 / false=placeholder）。
 *
 * layer（memory project_garden_3layer_visual_model 準拠、2026-04-26 確定）:
 *   - 樹冠 (Layer 3): Bloom / Fruit / Seed / Forest / Calendar — 次のアクションを生むインサイトと拡張性
 *   - 地上 (Layer 2): Bud / Leaf / Tree / Sprout — 最適化された日常業務
 *   - 地下 (Layer 1): Soil / Root / Rill — 全データを支える盤石な基盤
 *
 * 旧 4 カテゴリ（NotebookLM「環境/成果/成長/基盤」）は Garden 真の正本ではなく置換。
 * → hover ラベル / aria-label で「ラベル（レイヤー）」表示、世界観整合
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
  href: string;
  color: string;
  enabled: boolean;
  layer: ModuleLayer;
};

export const MODULES: Record<ModuleKey, ModuleDef> = {
  // Layer 3 樹冠（5 modules: Bloom / Fruit / Seed / Forest / Calendar）
  bloom:    { emoji: "🌺", label: "Bloom",    href: "/bloom/workboard", color: "#C3447A", enabled: true,  layer: "樹冠" },
  fruit:    { emoji: "🍎", label: "Fruit",    href: "/fruit",           color: "#D4A340", enabled: false, layer: "樹冠" },
  seed:     { emoji: "🌰", label: "Seed",     href: "/seed",            color: "#D9BC92", enabled: false, layer: "樹冠" },
  forest:   { emoji: "🌳", label: "Forest",   href: "/forest",          color: "#1F5C3A", enabled: true,  layer: "樹冠" },
  calendar: { emoji: "📅", label: "Calendar", href: "/calendar",        color: "#9B86C9", enabled: false, layer: "樹冠" },
  // Layer 2 地上（4 modules: Bud / Leaf / Tree / Sprout）
  bud:      { emoji: "🌸", label: "Bud",      href: "/bud",             color: "#E07A9B", enabled: false, layer: "地上" },
  leaf:     { emoji: "🍃", label: "Leaf",     href: "/leaf",            color: "#7FC66D", enabled: false, layer: "地上" },
  tree:     { emoji: "🌲", label: "Tree",     href: "/tree",            color: "#3B9B5C", enabled: true,  layer: "地上" },
  sprout:   { emoji: "🌿", label: "Sprout",   href: "/sprout",          color: "#A8D87A", enabled: false, layer: "地上" },
  // Layer 1 地下（3 modules: Soil / Root / Rill）
  soil:     { emoji: "🌱", label: "Soil",     href: "/soil",            color: "#8B6F47", enabled: false, layer: "地下" },
  root:     { emoji: "🌿", label: "Root",     href: "/root",            color: "#5C4332", enabled: true,  layer: "地下" },
  rill:     { emoji: "🌊", label: "Rill",     href: "/rill",            color: "#4FA8C9", enabled: false, layer: "地下" },
};

export const MODULE_KEYS: ModuleKey[] = [
  "soil", "root", "tree", "leaf", "bud", "bloom",
  "seed", "forest", "rill", "fruit", "sprout", "calendar",
];
