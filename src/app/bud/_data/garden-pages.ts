export type BudGardenPageId =
  | "journal"
  | "transfers"
  | "profit"
  | "payroll"
  | "invoices"
  | "expenses"
  | "bank"
  | "masters"
  | "audit"
  | "settings";

type Metric = {
  label: string;
  value: string;
  note: string;
  icon: string;
  tone?: "gold" | "green" | "red";
};

type TableColumn = {
  key: string;
  label: string;
};

type TableRow = Record<string, string>;

type SideCard = {
  title: string;
  items: { label: string; value: string; note?: string }[];
};

export type BudGardenPageConfig = {
  id: BudGardenPageId;
  route: string;
  mockName: string;
  title: string;
  titleJp: string;
  subtitle: string;
  badge: string;
  tabs: string[];
  segmentTabs: string[];
  metrics: Metric[];
  chartTitle: string;
  chartType: "bars" | "line" | "matrix" | "timeline";
  chartSeries: number[];
  tableTitle: string;
  columns: TableColumn[];
  rows: TableRow[];
  sideTitle: string;
  sideCards: SideCard[];
  actions: string[];
  footerLinks: string[];
};

const companies = ["全法人合算", "ヒュアラン", "センターライズ", "リンクサポート", "ARATA", "たいよう", "壱"];

export const budGardenPages: Record<BudGardenPageId, BudGardenPageConfig> = {
  journal: {
    id: "journal",
    route: "/bud/journal",
    mockName: "bud-02-仕訳帳画面.png",
    title: "仕訳帳",
    titleJp: "数字の物語を綴る",
    subtitle: "日々の取引を仕訳として整え、月次へつなぐ",
    badge: "全権管理者 + 経理担当",
    tabs: ["一覧 / Ledger", "承認待ち / Review", "タグ / Tags", "月次 / Monthly"],
    segmentTabs: companies,
    metrics: [
      { icon: "仕", label: "本日仕訳", value: "218件", note: "自動取込 142件" },
      { icon: "承", label: "承認待ち", value: "32件", note: "差戻し 4件" },
      { icon: "未", label: "未分類", value: "8件", note: "要確認" },
      { icon: "率", label: "自動化率", value: "87%", note: "前月比 +6pt" },
    ],
    chartTitle: "仕訳件数トレンド",
    chartType: "bars",
    chartSeries: [34, 46, 38, 52, 41, 64, 58, 72, 61, 78, 69, 84],
    tableTitle: "仕訳一覧",
    columns: [
      { key: "date", label: "日付" },
      { key: "desc", label: "摘要" },
      { key: "debit", label: "借方" },
      { key: "credit", label: "貸方" },
      { key: "amount", label: "金額" },
      { key: "status", label: "状態" },
    ],
    rows: [
      { date: "2026-06-10", desc: "広告運用費", debit: "広告宣伝費", credit: "普通預金", amount: "¥328,000", status: "確認済" },
      { date: "2026-06-10", desc: "売上入金", debit: "普通預金", credit: "売上高", amount: "¥1,248,000", status: "自動" },
      { date: "2026-06-09", desc: "交通費精算", debit: "旅費交通費", credit: "未払金", amount: "¥42,800", status: "承認待ち" },
      { date: "2026-06-09", desc: "SaaS利用料", debit: "通信費", credit: "カード未払", amount: "¥86,400", status: "確認済" },
    ],
    sideTitle: "月次へつなぐ",
    sideCards: [
      { title: "月次チェック", items: [{ label: "未承認", value: "32件" }, { label: "証憑不足", value: "6件" }] },
      { title: "CSVエクスポート", items: [{ label: "弥生形式", value: "準備OK" }, { label: "最終出力", value: "6/10 09:30" }] },
    ],
    actions: ["仕訳を追加", "CSV取込", "弥生へ出力", "承認依頼"],
    footerLinks: ["Bloom 月次損益へ", "Forest 決算確認へ", "監査ログへ"],
  },
  transfers: {
    id: "transfers",
    route: "/bud/transfers",
    mockName: "bud-03-振込画面.png",
    title: "振込管理",
    titleJp: "約束を、確かに届ける",
    subtitle: "振込予定、承認、実行ステータスを一画面で追う",
    badge: "全権管理者 + 経理担当",
    tabs: ["振込予定 / Schedule", "承認待ち / Approval", "実行済 / History", "銀行連携 / Banking"],
    segmentTabs: companies,
    metrics: [
      { icon: "予", label: "本日予定", value: "¥87,450,000", note: "42件" },
      { icon: "承", label: "承認待ち", value: "¥62,300,000", note: "18件" },
      { icon: "警", label: "要確認", value: "¥25,150,000", note: "6件", tone: "red" },
      { icon: "済", label: "実行済", value: "89%", note: "前日比 +4pt" },
    ],
    chartTitle: "振込カレンダー",
    chartType: "timeline",
    chartSeries: [2, 5, 3, 9, 4, 7, 2, 6, 8, 3, 5, 4],
    tableTitle: "振込予定一覧",
    columns: [
      { key: "date", label: "実行日" },
      { key: "vendor", label: "振込先" },
      { key: "bank", label: "銀行" },
      { key: "amount", label: "金額" },
      { key: "status", label: "状態" },
    ],
    rows: [
      { date: "6/10", vendor: "A社 広告費", bank: "みずほ", amount: "¥4,280,000", status: "承認待ち" },
      { date: "6/10", vendor: "B社 業務委託", bank: "楽天", amount: "¥1,120,000", status: "確認済" },
      { date: "6/11", vendor: "給与振込", bank: "PayPay", amount: "¥32,450,000", status: "実行予約" },
      { date: "6/12", vendor: "家賃", bank: "京都", amount: "¥980,000", status: "要確認" },
    ],
    sideTitle: "安全確認",
    sideCards: [
      { title: "二重振込チェック", items: [{ label: "候補", value: "2件" }, { label: "確認済", value: "16件" }] },
      { title: "承認ルート", items: [{ label: "上長確認", value: "12件" }, { label: "経理確認", value: "18件" }] },
    ],
    actions: ["振込登録", "FBデータ作成", "承認依頼", "銀行残高を見る"],
    footerLinks: ["Bloom 通知へ", "銀行口座管理へ", "監査ログへ"],
  },
  profit: {
    id: "profit",
    route: "/bud/profit",
    mockName: "bud-04-損益管理.png",
    title: "損益管理",
    titleJp: "数字が語る、経営の今",
    subtitle: "売上、経費、利益率を法人別に見比べる",
    badge: "全権管理者 + 経理担当",
    tabs: ["月次 / Monthly", "法人別 / Company", "科目別 / Account", "完成 / Completion"],
    segmentTabs: companies,
    metrics: [
      { icon: "売", label: "売上", value: "¥48,250,000", note: "前年比 +9.2%" },
      { icon: "費", label: "経費", value: "¥21,820,000", note: "売上比 45.2%" },
      { icon: "固", label: "固定費", value: "¥10,000,000", note: "前月比 -1.3%" },
      { icon: "利", label: "営業利益", value: "¥16,430,000", note: "利益率 34.0%" },
    ],
    chartTitle: "12か月推移",
    chartType: "line",
    chartSeries: [42, 48, 55, 58, 63, 69, 72, 78, 84, 91, 96, 104],
    tableTitle: "法人別サマリ",
    columns: [
      { key: "company", label: "法人" },
      { key: "sales", label: "売上" },
      { key: "expense", label: "経費" },
      { key: "profit", label: "利益" },
      { key: "rate", label: "利益率" },
    ],
    rows: [
      { company: "ヒュアラン", sales: "¥21,420,000", expense: "¥11,380,000", profit: "¥10,040,000", rate: "46.9%" },
      { company: "センターライズ", sales: "¥13,840,000", expense: "¥7,210,000", profit: "¥6,630,000", rate: "47.9%" },
      { company: "リンクサポート", sales: "¥8,520,000", expense: "¥5,140,000", profit: "¥3,380,000", rate: "39.7%" },
      { company: "ARATA", sales: "¥4,470,000", expense: "¥3,090,000", profit: "¥1,380,000", rate: "30.9%" },
    ],
    sideTitle: "6法人サマリ",
    sideCards: [
      { title: "利益アラート", items: [{ label: "改善候補", value: "2法人" }, { label: "好調", value: "4法人" }] },
      { title: "Bloom連携", items: [{ label: "経営状況", value: "更新済" }, { label: "通知", value: "3件" }] },
    ],
    actions: ["損益を更新", "月次レポート", "Bloomへ反映", "CSV出力"],
    footerLinks: ["Bloom 経営状況へ", "Forest 決算へ", "仕訳帳へ"],
  },
  payroll: {
    id: "payroll",
    route: "/bud/payroll",
    mockName: "bud-05-給与管理.png",
    title: "給与管理",
    titleJp: "一人ひとりの月を、確かに",
    subtitle: "給与計算、明細、振込、配信状況をまとめる",
    badge: "全権管理者 + 給与担当",
    tabs: ["今月 / Monthly", "給与 / Salary", "賞与 / Bonus", "マスタ / Master"],
    segmentTabs: companies,
    metrics: [
      { icon: "人", label: "対象人数", value: "87名", note: "前月比 +2" },
      { icon: "確", label: "確認済", value: "42名", note: "48.3%" },
      { icon: "未", label: "未処理", value: "18名", note: "勤怠待ち" },
      { icon: "配", label: "配信予約", value: "6/25 09:00", note: "明細メール" },
    ],
    chartTitle: "給与処理ステップ",
    chartType: "matrix",
    chartSeries: [90, 74, 62, 48, 35, 20],
    tableTitle: "給与対象者",
    columns: [
      { key: "name", label: "氏名" },
      { key: "company", label: "法人" },
      { key: "base", label: "基本給" },
      { key: "allowance", label: "手当" },
      { key: "status", label: "状態" },
    ],
    rows: [
      { name: "東海林 美琴", company: "ヒュアラン", base: "¥420,000", allowance: "¥35,000", status: "確認済" },
      { name: "後藤 玲", company: "センターライズ", base: "¥360,000", allowance: "¥18,000", status: "勤怠待ち" },
      { name: "佐藤 渚", company: "リンクサポート", base: "¥310,000", allowance: "¥22,000", status: "確認中" },
      { name: "田中 蒼", company: "ARATA", base: "¥285,000", allowance: "¥12,000", status: "承認待ち" },
    ],
    sideTitle: "給与実務",
    sideCards: [
      { title: "振込準備", items: [{ label: "総額", value: "¥25,180,000" }, { label: "FB作成", value: "未" }] },
      { title: "配信", items: [{ label: "明細", value: "42/87" }, { label: "通知", value: "予約済" }] },
    ],
    actions: ["給与計算", "勤怠取込", "明細配信", "振込データ"],
    footerLinks: ["Root 従業員へ", "振込管理へ", "監査ログへ"],
  },
  invoices: {
    id: "invoices",
    route: "/bud/invoices",
    mockName: "bud-06-請求書管理画面.png",
    title: "請求書管理",
    titleJp: "受け取り、届ける、約束のかたち",
    subtitle: "請求書の作成、プレビュー、送付、入金確認",
    badge: "全権管理者 + 経理担当",
    tabs: ["未発行 / Draft", "送付済 / Sent", "入金待ち / Waiting", "テンプレ / Template"],
    segmentTabs: companies,
    metrics: [
      { icon: "請", label: "未発行", value: "32件", note: "総額 ¥12,410,000" },
      { icon: "入", label: "入金待ち", value: "28件", note: "期限超過 4件" },
      { icon: "警", label: "要確認", value: "12件", note: "税区分確認", tone: "red" },
      { icon: "済", label: "今月回収", value: "76%", note: "前月比 +5pt" },
    ],
    chartTitle: "回収見込み",
    chartType: "bars",
    chartSeries: [44, 58, 62, 51, 73, 66, 82, 76, 88, 70, 92, 84],
    tableTitle: "請求書一覧",
    columns: [
      { key: "no", label: "請求No" },
      { key: "client", label: "取引先" },
      { key: "due", label: "期限" },
      { key: "amount", label: "金額" },
      { key: "status", label: "状態" },
    ],
    rows: [
      { no: "INV-2606-001", client: "A社", due: "6/30", amount: "¥1,045,000", status: "プレビュー" },
      { no: "INV-2606-002", client: "B社", due: "6/25", amount: "¥682,000", status: "送付済" },
      { no: "INV-2606-003", client: "C社", due: "6/20", amount: "¥428,000", status: "入金待ち" },
      { no: "INV-2606-004", client: "D社", due: "7/05", amount: "¥920,000", status: "下書き" },
    ],
    sideTitle: "請求書プレビュー",
    sideCards: [
      { title: "選択中", items: [{ label: "請求額", value: "¥1,045,000" }, { label: "税額", value: "¥95,000" }] },
      { title: "送付", items: [{ label: "メール", value: "未送信" }, { label: "承認", value: "OK" }] },
    ],
    actions: ["請求書作成", "PDF出力", "メール送付", "入金消込"],
    footerLinks: ["Bloom 通知へ", "仕訳帳へ", "Root 取引先へ"],
  },
  expenses: {
    id: "expenses",
    route: "/bud/expenses",
    mockName: "bud-07-経費精算画面.png",
    title: "経費精算",
    titleJp: "日々の足跡を、整えて返す",
    subtitle: "申請、承認、精算、仕訳化までを追跡",
    badge: "全権管理者 + 経理担当",
    tabs: ["未承認 / Review", "承認済 / Approved", "精算待ち / Payment", "ルール / Rules"],
    segmentTabs: companies,
    metrics: [
      { icon: "待", label: "承認待ち", value: "8件", note: "総額 ¥285,400" },
      { icon: "承", label: "承認済", value: "12件", note: "精算待ち" },
      { icon: "差", label: "差戻し", value: "1件", note: "領収書不足", tone: "red" },
      { icon: "平", label: "平均処理", value: "1.8日", note: "前月比 -0.4日" },
    ],
    chartTitle: "経費カテゴリ",
    chartType: "bars",
    chartSeries: [22, 45, 31, 28, 62, 37, 49, 56],
    tableTitle: "申請一覧",
    columns: [
      { key: "date", label: "申請日" },
      { key: "name", label: "申請者" },
      { key: "type", label: "種別" },
      { key: "amount", label: "金額" },
      { key: "status", label: "状態" },
    ],
    rows: [
      { date: "6/10", name: "佐藤 渚", type: "交通費", amount: "¥12,480", status: "承認待ち" },
      { date: "6/10", name: "田中 蒼", type: "会議費", amount: "¥28,600", status: "確認中" },
      { date: "6/09", name: "後藤 玲", type: "備品", amount: "¥54,200", status: "承認済" },
      { date: "6/08", name: "東海林 美琴", type: "出張", amount: "¥91,300", status: "精算待ち" },
    ],
    sideTitle: "申請詳細",
    sideCards: [
      { title: "領収書", items: [{ label: "添付", value: "2枚" }, { label: "OCR", value: "完了" }] },
      { title: "承認", items: [{ label: "上長", value: "済" }, { label: "経理", value: "待ち" }] },
    ],
    actions: ["承認する", "差戻し", "精算データ", "仕訳化"],
    footerLinks: ["給与管理へ", "仕訳帳へ", "監査ログへ"],
  },
  bank: {
    id: "bank",
    route: "/bud/bank",
    mockName: "bud-08-銀行口座管理画面.png",
    title: "銀行口座管理",
    titleJp: "お金の通り道を、見渡す",
    subtitle: "法人別の銀行残高、入出金、同期状態を確認",
    badge: "全権管理者 + 経理担当",
    tabs: ["残高 / Balance", "入出金 / Transactions", "同期 / Sync", "口座 / Accounts"],
    segmentTabs: companies,
    metrics: [
      { icon: "残", label: "総残高", value: "¥370,200,000", note: "前日比 +¥1,250,000" },
      { icon: "同", label: "同期口座", value: "6法人 / 18口座", note: "正常 16" },
      { icon: "入", label: "本日入金", value: "¥8,430,000", note: "12件" },
      { icon: "出", label: "本日出金", value: "¥7,820,000", note: "19件" },
    ],
    chartTitle: "残高推移",
    chartType: "line",
    chartSeries: [60, 63, 68, 72, 70, 78, 82, 88, 86, 91, 96, 103],
    tableTitle: "口座別残高",
    columns: [
      { key: "company", label: "法人" },
      { key: "bank", label: "銀行" },
      { key: "account", label: "口座" },
      { key: "balance", label: "残高" },
      { key: "sync", label: "同期" },
    ],
    rows: [
      { company: "ヒュアラン", bank: "みずほ", account: "普通 001", balance: "¥128,400,000", sync: "正常" },
      { company: "センターライズ", bank: "楽天", account: "普通 014", balance: "¥82,130,000", sync: "正常" },
      { company: "リンクサポート", bank: "PayPay", account: "普通 022", balance: "¥43,920,000", sync: "確認中" },
      { company: "ARATA", bank: "京都", account: "普通 109", balance: "¥31,840,000", sync: "正常" },
    ],
    sideTitle: "同期ステータス",
    sideCards: [
      { title: "API連携", items: [{ label: "正常", value: "16口座" }, { label: "再認証", value: "2口座" }] },
      { title: "次回取込", items: [{ label: "予定", value: "12:30" }, { label: "CSV待ち", value: "3件" }] },
    ],
    actions: ["CSV取込", "残高更新", "口座追加", "Bloomへ通知"],
    footerLinks: ["振込管理へ", "Bloom balanceへ", "Root 銀行口座へ"],
  },
  masters: {
    id: "masters",
    route: "/bud/masters",
    mockName: "bud-09-マスタ管理画面.png",
    title: "マスタ管理",
    titleJp: "仕組みの根を、整える",
    subtitle: "法人、取引先、勘定科目、税区分の運用マスタ",
    badge: "全権管理者 + 管理者",
    tabs: ["取引先 / Vendors", "科目 / Accounts", "税区分 / Tax", "法人 / Company"],
    segmentTabs: ["全マスタ", "取引先", "勘定科目", "税区分", "銀行", "従業員"],
    metrics: [
      { icon: "取", label: "取引先", value: "142件", note: "更新 8件" },
      { icon: "科", label: "勘定科目", value: "3件", note: "追加候補" },
      { icon: "税", label: "税区分", value: "24件", note: "有効" },
      { icon: "差", label: "差分", value: "11件", note: "Root同期待ち" },
    ],
    chartTitle: "マスタ完成度",
    chartType: "matrix",
    chartSeries: [92, 86, 78, 66, 83, 72],
    tableTitle: "マスタ一覧",
    columns: [
      { key: "kind", label: "種別" },
      { key: "name", label: "名称" },
      { key: "owner", label: "担当" },
      { key: "updated", label: "更新" },
      { key: "status", label: "状態" },
    ],
    rows: [
      { kind: "取引先", name: "A社", owner: "経理", updated: "6/10", status: "有効" },
      { kind: "科目", name: "広告宣伝費", owner: "管理", updated: "6/09", status: "確認済" },
      { kind: "税区分", name: "課税仕入10%", owner: "管理", updated: "6/08", status: "有効" },
      { kind: "銀行", name: "みずほ 普通", owner: "経理", updated: "6/07", status: "Root同期" },
    ],
    sideTitle: "入力補助",
    sideCards: [
      { title: "候補", items: [{ label: "未登録取引先", value: "4件" }, { label: "科目候補", value: "3件" }] },
      { title: "同期", items: [{ label: "Root", value: "11件待ち" }, { label: "最終", value: "6/10 10:10" }] },
    ],
    actions: ["マスタ追加", "CSVインポート", "Root同期", "差分確認"],
    footerLinks: ["Root マスタへ", "設定へ", "監査ログへ"],
  },
  audit: {
    id: "audit",
    route: "/bud/audit",
    mockName: "bud-10-監査ログ画面.png",
    title: "監査ログ",
    titleJp: "すべての操作に、光をあてる",
    subtitle: "承認、変更、出力、権限操作を追跡する",
    badge: "全権管理者 + 監査閲覧",
    tabs: ["全ログ / All", "承認 / Approval", "出力 / Export", "権限 / Admin"],
    segmentTabs: ["今日", "7日", "30日", "重要", "未確認", "ユーザー別"],
    metrics: [
      { icon: "操", label: "操作ログ", value: "1,248件", note: "24h" },
      { icon: "承", label: "承認操作", value: "18件", note: "差戻し 2" },
      { icon: "警", label: "警告", value: "3件", note: "要確認", tone: "red" },
      { icon: "出", label: "出力", value: "24件", note: "CSV/PDF" },
    ],
    chartTitle: "ログ量推移",
    chartType: "timeline",
    chartSeries: [24, 32, 28, 45, 38, 52, 49, 61, 58, 70, 64, 76],
    tableTitle: "監査ログ",
    columns: [
      { key: "time", label: "時刻" },
      { key: "user", label: "ユーザー" },
      { key: "area", label: "画面" },
      { key: "action", label: "操作" },
      { key: "status", label: "状態" },
    ],
    rows: [
      { time: "11:42", user: "東海林 美琴", area: "振込", action: "FBデータ作成", status: "成功" },
      { time: "11:18", user: "後藤 玲", area: "経費", action: "承認", status: "成功" },
      { time: "10:55", user: "佐藤 渚", area: "請求書", action: "PDF出力", status: "成功" },
      { time: "10:21", user: "田中 蒼", area: "マスタ", action: "取引先変更", status: "警告" },
    ],
    sideTitle: "リスク通知",
    sideCards: [
      { title: "重要", items: [{ label: "権限変更", value: "1件" }, { label: "高額振込", value: "2件" }] },
      { title: "レビュー", items: [{ label: "未確認", value: "3件" }, { label: "期限", value: "今日" }] },
    ],
    actions: ["ログ検索", "重要のみ表示", "CSV出力", "レビュー済みにする"],
    footerLinks: ["設定へ", "振込管理へ", "Root 権限へ"],
  },
  settings: {
    id: "settings",
    route: "/bud/settings",
    mockName: "bud-11-設定画面.png",
    title: "設定",
    titleJp: "Budを、働き方に合わせる",
    subtitle: "通知、承認経路、連携、権限の設定",
    badge: "全権管理者 + admin",
    tabs: ["通知 / Notification", "承認 / Approval", "連携 / Sync", "権限 / Roles"],
    segmentTabs: ["全体", "通知", "承認", "銀行", "CSV", "ユーザー"],
    metrics: [
      { icon: "通", label: "通知ルール", value: "21件", note: "有効 18" },
      { icon: "承", label: "承認経路", value: "6件", note: "法人別" },
      { icon: "管", label: "管理者", value: "12名", note: "閲覧 67名" },
      { icon: "連", label: "連携", value: "8件", note: "正常 7" },
    ],
    chartTitle: "設定ヘルス",
    chartType: "matrix",
    chartSeries: [94, 82, 76, 88, 91, 68],
    tableTitle: "設定一覧",
    columns: [
      { key: "area", label: "領域" },
      { key: "name", label: "設定" },
      { key: "value", label: "値" },
      { key: "owner", label: "担当" },
      { key: "status", label: "状態" },
    ],
    rows: [
      { area: "通知", name: "高額振込通知", value: "¥1,000,000以上", owner: "admin", status: "有効" },
      { area: "承認", name: "二段階承認", value: "ON", owner: "admin", status: "有効" },
      { area: "銀行", name: "CSV取込", value: "毎日", owner: "経理", status: "正常" },
      { area: "権限", name: "監査閲覧", value: "管理者のみ", owner: "admin", status: "確認中" },
    ],
    sideTitle: "admin 設定",
    sideCards: [
      { title: "通知", items: [{ label: "Chatwork", value: "ON" }, { label: "メール", value: "ON" }] },
      { title: "セキュリティ", items: [{ label: "2段階", value: "ON" }, { label: "監査", value: "必須" }] },
    ],
    actions: ["設定を保存", "テスト通知", "権限を確認", "監査ログを見る"],
    footerLinks: ["監査ログへ", "マスタ管理へ", "Root 権限へ"],
  },
};

export const budGardenPageOrder: BudGardenPageId[] = [
  "journal",
  "transfers",
  "profit",
  "payroll",
  "invoices",
  "expenses",
  "bank",
  "masters",
  "audit",
  "settings",
];
