export type DigestTab = {
  label: string;
  english: string;
  active?: boolean;
};

export type DigestMetric = {
  label: string;
  value: string;
  note: string;
  icon: string;
  tone: "pink" | "gold" | "green";
};

export type DigestAchievement = {
  date: string;
  title: string;
  body: string;
  tag: string;
  tone: "forest" | "bloom" | "bud" | "root" | "tree";
};

export type DigestGoal = {
  rank: number;
  title: string;
  due: string;
  tag: string;
  status: string;
  tone: "bloom" | "forest" | "bud" | "tree" | "sprout";
};

export const digestMonth = "2026-04";

export const digestTabs: DigestTab[] = [
  { label: "サマリ", english: "Summary", active: true },
  { label: "達成リスト", english: "Achievements" },
  { label: "進捗グラフ", english: "Progress" },
  { label: "次月目標", english: "Next Goals" },
];

export const digestMetrics: DigestMetric[] = [
  { label: "完了タスク", value: "124 件", note: "先月比 +18%", icon: "✿", tone: "pink" },
  { label: "稼働日", value: "20 日", note: "平日のみ稼働", icon: "▦", tone: "gold" },
  { label: "マイルストーン達成", value: "3 / 4 件", note: "目標達成率 75%", icon: "⚑", tone: "green" },
];

export const monthlyHighlights = [
  "Garden 設計図段階 1 完了（PR #212 マージ）",
  "Bloom Top GardenShell 化完了（PR #213 マージ）",
  "ヒュアラン決算 CC 仕訳完了",
  "Memory 分配 53 件完了",
  "新体制 Dispatch ルール正式運用開始",
  "Bloom デザインシステム v1.0 完成",
];

export const specialNotes = [
  "Bloom Top の桜世界観化が完了し、ブランド体験が大きく向上しました。",
  "経理連携の自動化により、CC 仕訳の精度とスピードが改善。",
  "Dispatch 体制の安定運用が始まり、業務効率が向上しています。",
];

export const digestAchievements: DigestAchievement[] = [
  {
    date: "4/30",
    title: "Forest 経営ダッシュボード v1 公開",
    body: "Forest モジュールの初版公開。経営陣向けの月次ダッシュボードが見えるように。",
    tag: "Forest",
    tone: "forest",
  },
  {
    date: "4/26",
    title: "Bloom homepage v2.8a 完成",
    body: "UI/UX 改善と桜世界観の演出を強化。体験品質を向上。",
    tag: "Bloom",
    tone: "bloom",
  },
  {
    date: "4/22",
    title: "Bud 給与処理ロジック骨格",
    body: "給与計算のコアロジック実装完了。テスト設計も開始。",
    tag: "Bud",
    tone: "bud",
  },
  {
    date: "4/15",
    title: "Root マスタ整備完了",
    body: "全マスタの整備と正規化を完了。データ品質が向上。",
    tag: "Root",
    tone: "root",
  },
  {
    date: "4/10",
    title: "Tree 架電アプリ初版リリース",
    body: "架電アプリの初版をリリース。現場運用を開始。",
    tag: "Tree",
    tone: "tree",
  },
];

export const digestGoals: DigestGoal[] = [
  { rank: 1, title: "Bloom 段階 2-2 完了", due: "2026/05/31", tag: "Bloom", status: "計画中", tone: "bloom" },
  { rank: 2, title: "Forest 月次レポート自動生成", due: "2026/05/25", tag: "Forest", status: "着手済", tone: "forest" },
  { rank: 3, title: "Bud 給与処理ロジック完成", due: "2026/05/20", tag: "Bud", status: "順調", tone: "bud" },
  { rank: 4, title: "Tree 架電 API 公開", due: "2026/05/15", tag: "Tree", status: "順調", tone: "tree" },
  { rank: 5, title: "Sprout 採用ページ構想", due: "2026/05/31", tag: "Sprout", status: "計画中", tone: "sprout" },
];

export const progressActual = [0, 12, 18, 32, 32, 40, 48, 57, 63, 75, 84, 95, 100, 104, 110, 118, 124];
export const progressTarget = [0, 8, 16, 24, 32, 38, 44, 50, 58, 65, 72, 80, 86, 92, 98, 102, 105];
