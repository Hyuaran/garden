const T = "/themes/garden-shell";

export type GardenModuleId =
  | "bloom"
  | "fruit"
  | "seed"
  | "forest"
  | "bud"
  | "leaf"
  | "tree"
  | "sprout"
  | "soil"
  | "root"
  | "rill"
  | "calendar";

export type GardenShellPageMenuItem = {
  label: string;
  href: string;
  icon?: string;
  active?: boolean;
  divider?: boolean;
};

export type GardenShellActivityItem = {
  time: string;
  icon?: string;
  title: string;
  body: string;
};

export type GardenShellModule = {
  id: GardenModuleId;
  name: string;
  icon: string;
  bgLight: string;
  bgDark: string;
};

export const GARDEN_SHELL_MODULES: GardenShellModule[] = [
  { id: "bloom", name: "Bloom", icon: `${T}/images/icons_bloom/orb_bloom.png`, bgLight: "bg_bloom_garden_light.png", bgDark: "bg_bloom_garden_dark.png" },
  { id: "fruit", name: "Fruit", icon: `${T}/images/icons_bloom/orb_fruit.png`, bgLight: "bg-fruit-light.png", bgDark: "bg-fruit-dark.png" },
  { id: "seed", name: "Seed", icon: `${T}/images/icons_bloom/orb_seed.png`, bgLight: "bg-seed-light.png", bgDark: "bg-seed-dark.png" },
  { id: "forest", name: "Forest", icon: `${T}/images/icons_bloom/orb_forest.png`, bgLight: "bg-forest-light.png", bgDark: "bg-forest-dark.png" },
  { id: "bud", name: "Bud", icon: `${T}/images/icons_bloom/orb_bud.png`, bgLight: "bg-bud-common-20260505.png", bgDark: "bg-bud-dark.png" },
  { id: "leaf", name: "Leaf", icon: `${T}/images/icons_bloom/orb_leaf.png`, bgLight: "bg-leaf-light.png", bgDark: "bg-leaf-dark.png" },
  { id: "tree", name: "Tree", icon: `${T}/images/icons_bloom/orb_tree.png`, bgLight: "bg-tree-light.png", bgDark: "bg-tree-dark.png" },
  { id: "sprout", name: "Sprout", icon: `${T}/images/icons_bloom/orb_sprout.png`, bgLight: "bg-sprout-light.png", bgDark: "bg-sprout-dark.png" },
  { id: "soil", name: "Soil", icon: `${T}/images/icons_bloom/orb_soil.png`, bgLight: "bg-soil-light.png", bgDark: "bg-soil-dark.png" },
  { id: "root", name: "Root", icon: `${T}/images/icons_bloom/orb_root.png`, bgLight: "bg-root-light.png", bgDark: "bg-root-dark.png" },
  { id: "rill", name: "Rill", icon: `${T}/images/icons_bloom/orb_rill.png`, bgLight: "bg-rill-light.png", bgDark: "bg-rill-dark.png" },
  { id: "calendar", name: "Calendar", icon: `${T}/images/icons_bloom/orb_calendar.png`, bgLight: "bg-calendar-light.png", bgDark: "bg-calendar-dark.png" },
];

export const DEFAULT_GARDEN_ACTIVITY_ITEMS: GardenShellActivityItem[] = [
  {
    time: "11:30",
    icon: `${T}/images/icons_bloom/bloom_workboard.png`,
    title: "残高UIを確認中",
    body: "後道さんに見せる画面として、Budで残高を見える化しています。",
  },
  {
    time: "10:45",
    icon: `${T}/images/icons_bloom/orb_bud.png`,
    title: "銀行CSV取込",
    body: "CSVはBudから入れ、データはRootに貯める方針です。",
  },
  {
    time: "10:05",
    icon: `${T}/images/icons_bloom/orb_bloom.png`,
    title: "Bloom連携",
    body: "経営向けの要約表示はBloom側に反映します。",
  },
  {
    time: "09:20",
    icon: `${T}/images/icons_bloom/orb_root.png`,
    title: "Root保存方針",
    body: "銀行口座の元データはRootに蓄積します。",
  },
  {
    time: "08:50",
    icon: `${T}/images/icons_bloom/orb_forest.png`,
    title: "ForestからBudへ整理",
    body: "仕訳帳ではなく残高確認はBudで進める整理にしました。",
  },
];

export function getGardenShellModule(moduleId: string): GardenShellModule {
  return GARDEN_SHELL_MODULES.find((module) => module.id === moduleId) ?? GARDEN_SHELL_MODULES[4];
}

