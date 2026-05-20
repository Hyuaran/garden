export type BlueprintStage =
  | "種まき"
  | "芽吹き"
  | "つぼみ"
  | "咲きはじめ"
  | "満開";

export type ModuleBlueprint = {
  code: string;
  name: string;
  usage: string;
  description: string;
  stage: BlueprintStage;
  percent: number;
  iconSrc: string;
  folder: string;
};

export const stageTone: Record<
  BlueprintStage,
  { background: string; border: string; color: string }
> = {
  種まき: { background: "#f8f6f0", border: "#e3dccd", color: "#78624a" },
  芽吹き: { background: "#f1f8f4", border: "#cde8d5", color: "#3f7b55" },
  つぼみ: { background: "#eef8f1", border: "#b8dfc3", color: "#2f6d45" },
  咲きはじめ: { background: "#fff7df", border: "#ead391", color: "#7d651d" },
  満開: { background: "#d8f3dc", border: "#95d5b2", color: "#1b4332" },
};

export const moduleBlueprints: ModuleBlueprint[] = [
  {
    code: "bloom",
    name: "Bloom",
    usage: "案件 KPI",
    description: "開発進捗、日報、経営状況、ワークボードを見える化する。",
    stage: "咲きはじめ",
    percent: 65,
    iconSrc: "/images/icons_bloom/orb_bloom.png",
    folder: "080_Bloom_案件KPI",
  },
  {
    code: "fruit",
    name: "Fruit",
    usage: "法人実態情報",
    description: "法人ごとの法的実体、基本情報、証跡を扱う構想枠。",
    stage: "種まき",
    percent: 0,
    iconSrc: "/images/icons_bloom/orb_fruit.png",
    folder: "120_Fruit_法人実態情報",
  },
  {
    code: "seed",
    name: "Seed",
    usage: "新事業",
    description: "新規事業や新商材の構想を育てるための初期枠。",
    stage: "種まき",
    percent: 0,
    iconSrc: "/images/icons_bloom/orb_seed.png",
    folder: "090_Seed_新事業",
  },
  {
    code: "forest",
    name: "Forest",
    usage: "全法人決算",
    description: "全法人の決算、会計、経営ダッシュボードを束ねる。",
    stage: "咲きはじめ",
    percent: 70,
    iconSrc: "/images/icons_bloom/orb_forest.png",
    folder: "100_Forest_全法人決算",
  },
  {
    code: "bud",
    name: "Bud",
    usage: "経理収支",
    description: "経理、収支、仕訳、振込、請求書管理を担う。",
    stage: "つぼみ",
    percent: 55,
    iconSrc: "/images/icons_bloom/orb_bud.png",
    folder: "070_Bud_経理収支",
  },
  {
    code: "leaf",
    name: "Leaf",
    usage: "個別アプリ",
    description: "関電など個別商材・個別業務アプリを扱う。",
    stage: "咲きはじめ",
    percent: 60,
    iconSrc: "/images/icons_bloom/orb_leaf.png",
    folder: "060_Leaf_個別アプリ",
  },
  {
    code: "tree",
    name: "Tree",
    usage: "架電",
    description: "架電、確認、営業現場のオペレーションを支える。",
    stage: "満開",
    percent: 100,
    iconSrc: "/images/icons_bloom/orb_tree.png",
    folder: "050_Tree_架電",
  },
  {
    code: "sprout",
    name: "Sprout",
    usage: "採用",
    description: "採用から面接、内定、入社準備までを扱う構想枠。",
    stage: "種まき",
    percent: 0,
    iconSrc: "/images/icons_bloom/orb_sprout.png",
    folder: "130_Sprout_採用",
  },
  {
    code: "soil",
    name: "Soil",
    usage: "DB 基盤",
    description: "大量データ、インポート、基盤データの土台を担う。",
    stage: "種まき",
    percent: 0,
    iconSrc: "/images/icons_bloom/orb_soil.png",
    folder: "030_Soil_DB基盤",
  },
  {
    code: "root",
    name: "Root",
    usage: "組織マスタ",
    description: "従業員、顧客、権限、組織マスタの正本を支える。",
    stage: "満開",
    percent: 100,
    iconSrc: "/images/icons_bloom/orb_root.png",
    folder: "040_Root_組織マスタ",
  },
  {
    code: "rill",
    name: "Rill",
    usage: "メッセージ",
    description: "社内連絡、通知、メッセージング連携を担う構想枠。",
    stage: "芽吹き",
    percent: 35,
    iconSrc: "/images/icons_bloom/orb_rill.png",
    folder: "110_Rill_メッセージ",
  },
  {
    code: "calendar",
    name: "Calendar",
    usage: "予定管理",
    description: "営業予定、面接枠、シフトを横断管理する構想枠。",
    stage: "種まき",
    percent: 0,
    iconSrc: "/images/icons_bloom/orb_calendar.png",
    folder: "140_Calendar_予定管理",
  },
];
