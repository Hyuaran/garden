export type ProgressTab = "overview" | "modules" | "history";
export type ModuleStatus = "released" | "developing" | "pending";
export type Workstyle = "office" | "home" | "irregular";

export type ProgressModule = {
  code: string;
  name: string;
  purpose: string;
  group: string;
  percent: number;
  status: ModuleStatus;
  phase: string;
  release: string;
  iconSrc: string;
  done: string;
  now: string;
  next: string;
};

export const progressSummary = {
  percent: 67,
  released: 3,
  developing: 5,
  pending: 4,
};

export const progressModules: ProgressModule[] = [
  {
    code: "tree",
    name: "Tree",
    purpose: "架電アプリ、コールセンターの見える化",
    group: "地上層 / 業務オペレーション",
    percent: 100,
    status: "released",
    phase: "満開",
    release: "稼働中",
    iconSrc: "/themes/garden-shell/images/icons_bloom/orb_tree.png",
    done: "架電アプリ初版リリース、通話履歴の自動保存、誕生日4桁の自動ログイン認証",
    now: "本番稼働・運用改善",
    next: "架電システムの内製化",
  },
  {
    code: "root",
    name: "Root",
    purpose: "従業員・権限・組織マスタ",
    group: "地下層 / 基盤",
    percent: 100,
    status: "released",
    phase: "満開",
    release: "稼働中",
    iconSrc: "/themes/garden-shell/images/icons_bloom/orb_root.png",
    done: "従業員・権限・組織マスタ整備、勤怠（King of Time）自動取込",
    now: "会社マスタ統合の運用、マネーフォワード電子契約連携",
    next: "全モジュールへのマスタ供給の拡充",
  },
  {
    code: "forest",
    name: "Forest",
    purpose: "全法人決算、経営指標の一元管理",
    group: "樹冠 / 経営層",
    percent: 70,
    status: "released",
    phase: "咲きはじめ",
    release: "稼働中",
    iconSrc: "/themes/garden-shell/images/icons_bloom/orb_forest.png",
    done: "経営ダッシュボード v1 公開",
    now: "会社マスタ統合の設計、月次決算の整備",
    next: "全法人決算の自動集計",
  },
  {
    code: "bloom",
    name: "Bloom",
    purpose: "グループ全体の動きと業績を見える化",
    group: "樹冠 / 経営層",
    percent: 65,
    status: "developing",
    phase: "咲きはじめ",
    release: "26/08",
    iconSrc: "/themes/garden-shell/images/icons_bloom/orb_bloom.png",
    done: "経営状況・日報・ワークボード・月次まとめ・設計図・開発進捗・統合KPI の画面",
    now: "美意識とタブ機能の仕上げ、デモ品質化",
    next: "未実装タブの実装、実データ連動",
  },
  {
    code: "leaf",
    name: "Leaf",
    purpose: "個別業務アプリ、関連会社ワークフロー",
    group: "地上層 / 業務オペレーション",
    percent: 60,
    status: "developing",
    phase: "咲きはじめ",
    release: "26/07",
    iconSrc: "/themes/garden-shell/images/icons_bloom/orb_leaf.png",
    done: "関電（Kanden）案件ステータス・業務フロー・Backoffice 検索",
    now: "関連業務委託 v1 の作り込み",
    next: "他部門への個別アプリ展開",
  },
  {
    code: "bud",
    name: "Bud",
    purpose: "経理・収支・仕訳・振込管理",
    group: "地上層 / 業務オペレーション",
    percent: 55,
    status: "developing",
    phase: "つぼみ",
    release: "26/06",
    iconSrc: "/themes/garden-shell/images/icons_bloom/orb_bud.png",
    done: "経理画面の認証・DB設計、給与処理ロジックの骨格",
    now: "振込管理画面、給与処理 v1",
    next: "請求書管理、マネーフォワード連携、法人別経理",
  },
  {
    code: "rill",
    name: "Rill",
    purpose: "社内メッセージ、通知、連携導線",
    group: "地下層 / 基盤",
    percent: 35,
    status: "developing",
    phase: "芽吹き",
    release: "26/10",
    iconSrc: "/themes/garden-shell/images/icons_bloom/orb_rill.png",
    done: "通知導線の初期仕様の棚卸し",
    now: "社内メッセージ・通知の実装",
    next: "チャット特化UIの本格化、各モジュール連携",
  },
  {
    code: "soil",
    name: "Soil",
    purpose: "DB 基盤、大量データ、インポート",
    group: "地下層 / 基盤",
    percent: 0,
    status: "pending",
    phase: "種まき",
    release: "未定",
    iconSrc: "/themes/garden-shell/images/icons_bloom/orb_soil.png",
    done: "―",
    now: "構想（大量データ基盤の要件整理）",
    next: "インポート基盤の設計",
  },
  {
    code: "sprout",
    name: "Sprout",
    purpose: "採用、面接、入社準備",
    group: "地上層 / 業務オペレーション",
    percent: 0,
    status: "pending",
    phase: "種まき",
    release: "未定",
    iconSrc: "/themes/garden-shell/images/icons_bloom/orb_sprout.png",
    done: "―",
    now: "構想（採用フローの整理）",
    next: "応募・面接・入社準備の設計",
  },
  {
    code: "calendar",
    name: "Calendar",
    purpose: "営業予定、面接枠、シフト統合",
    group: "地上層 / 業務オペレーション",
    percent: 0,
    status: "pending",
    phase: "種まき",
    release: "未定",
    iconSrc: "/themes/garden-shell/images/icons_bloom/orb_calendar.png",
    done: "―",
    now: "構想（予定・シフト要件の整理）",
    next: "横断カレンダーの設計",
  },
  {
    code: "fruit",
    name: "Fruit",
    purpose: "法人の法的実態情報、証跡管理",
    group: "樹冠 / 経営層",
    percent: 0,
    status: "pending",
    phase: "種まき",
    release: "未定",
    iconSrc: "/themes/garden-shell/images/icons_bloom/orb_fruit.png",
    done: "―",
    now: "構想（法人実態台帳の要件整理）",
    next: "法人プロフィール・証跡の設計",
  },
  {
    code: "seed",
    name: "Seed",
    purpose: "新規事業、新商材の構想枠",
    group: "樹冠 / 経営層",
    percent: 0,
    status: "pending",
    phase: "種まき",
    release: "未定",
    iconSrc: "/themes/garden-shell/images/icons_bloom/orb_seed.png",
    done: "―",
    now: "構想（新規事業枠の整理）",
    next: "アイデア管理の設計",
  },
];

export const milestones = {
  recent: [
    { date: "26/04/30", title: "Forest 経営ダッシュボード v1 公開" },
    { date: "26/04/26", title: "Bloom homepage v2.8a 完成" },
    { date: "26/04/22", title: "Bud 給与処理ロジック骨格" },
    { date: "26/04/15", title: "Root マスタ整備完了" },
    { date: "26/04/10", title: "Tree 架電アプリ初版リリース" },
  ],
  next: [
    { date: "26/05/08", title: "後進代表向け Bloom デモ" },
    { date: "26/05/29", title: "Leaf 関連業務委託 v1" },
    { date: "26/06/30", title: "Bud 給与処理 v1" },
  ],
};

export const historyLogs = [
  {
    date: "2026/04/24",
    day: "金",
    workstyle: "irregular" as Workstyle,
    special: "横断する共通仕様の整理、作業ルール整備、引き継ぎ資料作成。",
    work: [
      { module: "Forest", code: "forest", text: "進行期編集機能の本番運用フロー、会社マスタ統合機能の設計準備。" },
      { module: "Tree", code: "tree", text: "誕生日4件で自動ログインできる認証システムを完成。" },
      { module: "Root", code: "root", text: "勤怠管理システムとの自動データ取込機能を実装。" },
      { module: "Bloom", code: "bloom", text: "画面切替、Chatwork通知基盤、月次レポートPDF生成の土台を整理。" },
    ],
    tomorrow: [
      { module: "Forest", code: "forest", text: "会社マスタ統合の設計着手。" },
      { module: "Bud", code: "bud", text: "振込管理の主要画面実装。" },
    ],
  },
  {
    date: "2026/04/23",
    day: "木",
    workstyle: "office" as Workstyle,
    special: "",
    work: [
      { module: "Bud", code: "bud", text: "経理画面の認証機能とデータベース設計を確認。" },
      { module: "Leaf", code: "leaf", text: "新規案件登録画面のステータス操作 UI を追加。" },
      { module: "Root", code: "root", text: "従業員情報テーブルと権限段階の整理。" },
    ],
    tomorrow: [
      { module: "Forest", code: "forest", text: "本番公開前の確認、会社マスタ統合の設計着手。" },
    ],
  },
  {
    date: "2026/04/22",
    day: "水",
    workstyle: "home" as Workstyle,
    special: "",
    work: [
      { module: "Tree", code: "tree", text: "通話履歴の自動保存機能を実装。" },
      { module: "Rill", code: "rill", text: "通知導線の初期仕様を棚卸し。" },
    ],
    tomorrow: [
      { module: "Tree", code: "tree", text: "誕生日認証の実地テスト。" },
    ],
  },
];
