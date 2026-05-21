import type { DecisionData, MeetingData, ReportItem } from "./types";

const T = "/themes/garden-shell/images/avatar";

export const decisions: DecisionData[] = [
  { number: "01", priority: "重要", priorityTone: "critical", name: "新規金契約条件の承認", hoverDemo: true, assignee: "小泉 翔", avatar: `${T}/avatar_koizumi.png`, rows: [{ label: "背景:", value: "大手金融機関との3年契約更新、契約金額¥48百万 / 年" }, { label: "担当:", value: "小泉 翔", tone: "assignee" }, { label: "必要判断:", value: "契約条件の最終承認" }, { label: "資料:", value: "契約書ドラフト v3 / 取引実績" }, { label: "期限:", value: "2026/04/29(明日)", tone: "deadline" }, { label: "推奨:", value: "承認 / 差戻 / 再交渉指示" }] },
  { number: "02", priority: "高", priorityTone: "high", name: "採用予算の再配分", assignee: "金 亜奈", avatar: `${T}/avatar_kin.png`, rows: [{ label: "背景:", value: "派遣事業の急成長、当初¥12百万→¥18百万" }, { label: "担当:", value: "金 亜奈", tone: "assignee" }, { label: "必要判断:", value: "予算追加の承認(¥6百万)" }, { label: "資料:", value: "採用計画書 / 派遣事業成長予測" }, { label: "期限:", value: "2026/04/29(明日)", tone: "deadline" }, { label: "推奨:", value: "承認 / 減額承認 / 差戻" }] },
  { number: "03", priority: "高", priorityTone: "high", name: "法人C 採用未充足の対策承認", assignee: "金 亜奈", avatar: `${T}/avatar_kin.png`, rows: [{ label: "背景:", value: "法人Cで3ヶ月連続採用未充足、業務遅延リスク" }, { label: "担当:", value: "金 亜奈", tone: "assignee" }, { label: "必要判断:", value: "外注比率引き上げの承認" }, { label: "資料:", value: "現状報告 / 外注プラン3案" }, { label: "期限:", value: "2026/05/03", tone: "deadline" }, { label: "推奨:", value: "プランA / B / C 承認" }] },
  { number: "04", priority: "中", priorityTone: "medium", name: "新規取引先の与信判断", assignee: "槙 俊介", avatar: `${T}/avatar_maki.png`, rows: [{ label: "背景:", value: "株式会社エクシード(年商¥320百万)、与信枠¥15百万要請" }, { label: "担当:", value: "槙 俊介", tone: "assignee" }, { label: "必要判断:", value: "取引可否+与信枠の決定" }, { label: "資料:", value: "与信調査レポート / 同業他社比較" }, { label: "期限:", value: "2026/04/30", tone: "deadline" }, { label: "推奨:", value: "全額承認 / 減額承認 / 取引拒否" }] },
  { number: "05", priority: "中", priorityTone: "medium", name: "広告投資上限の見直し", assignee: "宮永 ひかり", avatar: `${T}/avatar_miyanaga.png`, rows: [{ label: "背景:", value: "Q1の広告費¥45百万、目標CV達成つつもCPA上昇" }, { label: "担当:", value: "宮永 ひかり", tone: "assignee" }, { label: "必要判断:", value: "Q2広告予算の上限変更" }, { label: "資料:", value: "Q1広告効果レポート / Q2予算案" }, { label: "期限:", value: "2026/05/01", tone: "deadline" }, { label: "推奨:", value: "据え置き / 増額 / 減額" }] },
  { number: "06", priority: "中", priorityTone: "medium", name: "基幹改修の優先順位決定", assignee: "上田 基人", avatar: `${T}/avatar_ueda.png`, rows: [{ label: "背景:", value: "Garden Bloom実装と並行、基幹改修要望3件発生" }, { label: "担当:", value: "上田 基人", tone: "assignee" }, { label: "必要判断:", value: "改修順序の確定" }, { label: "資料:", value: "改修要望リスト / 工数見積" }, { label: "期限:", value: "2026/05/02", tone: "deadline" }, { label: "推奨:", value: "案A優先 / 案B優先 / 案C優先" }] },
  { number: "07", priority: "中", priorityTone: "medium", name: "大型取引先の更新契約", assignee: "槙 俊介", avatar: `${T}/avatar_maki.png`, rows: [{ label: "背景:", value: "株式会社グランデ(年¥85百万)との3年契約更新" }, { label: "担当:", value: "槙 俊介", tone: "assignee" }, { label: "必要判断:", value: "契約条件の承認" }, { label: "資料:", value: "現契約書 / 新契約案 / 取引実績" }, { label: "期限:", value: "2026/05/05", tone: "deadline" }, { label: "推奨:", value: "承認 / 差戻 / 再交渉指示" }] },
  { number: "08", priority: "低", priorityTone: "low", name: "オフィス契約更新", assignee: "東海林 美琴", avatar: `${T}/avatar_shoji.png`, rows: [{ label: "背景:", value: "本社オフィス賃貸契約の更新時期、賃料据え置き" }, { label: "担当:", value: "東海林 美琴", tone: "assignee" }, { label: "必要判断:", value: "更新承認" }, { label: "資料:", value: "現契約書 / 更新案" }, { label: "期限:", value: "2026/05/15" }, { label: "推奨:", value: "承認" }] },
];

export const meeting: MeetingData = {
  title: "次回 4/30 責任者会議",
  details: [
    { label: "日時:", value: "2026/04/30(水) 10:00-11:30" },
    { label: "出席予定:", value: "12名(東海林・後道代表・上田・小泉・宮永・金・槙 +他5名)" },
    { label: "議事進行:", value: "東海林" },
    { label: "想定所要時間:", value: "90分" },
  ],
  agenda: [
    { number: "1.", name: "4月締め確認", owner: "東海林", status: "準備完了 / 資料あり", statusTone: "done" },
    { number: "2.", name: "採用進捗共有", owner: "金", status: "準備完了 / 資料あり", statusTone: "done" },
    { number: "3.", name: "Bloom実装スケジュール", owner: "東海林", status: "準備中 / 資料作成中", statusTone: "preparing" },
    { number: "4.", name: "広告施策レビュー", owner: "宮永", status: "資料待ち", statusTone: "waiting" },
    { number: "5.", name: "キャッシュ見通し", owner: "槙", status: "準備完了 / 資料あり", statusTone: "done" },
  ],
  archives: [
    { date: "2026/04/16", title: "第7回責任者会議", summary: "Q2広告予算¥45百万承認、新規派遣事業展開承認" },
    { date: "2026/04/02", title: "第6回責任者会議", summary: "Bloom実装計画承認、基幹改修優先順位決定" },
    { date: "2026/03/19", title: "第5回責任者会議", summary: "FY2026 Q1総括、新規金契約方針決定" },
  ],
};

export const reports: ReportItem[] = [
  { number: "1", date: "2026/04/28 11:20", content: "4月売上は前年比+12.3%で着地見込み", author: "小泉 翔", status: "順調", statusTone: "smooth" },
  { number: "2", date: "2026/04/28 11:10", content: "Bloom導入は5月第2週デモ予定", author: "東海林 美琴", status: "計画通り", statusTone: "plan" },
  { number: "3", date: "2026/04/28 10:50", content: "法人Cの採用未充足が継続", author: "金 亜奈", status: "対応中", statusTone: "respond" },
  { number: "4", date: "2026/04/28 10:30", content: "大型取引先の更新契約は承認待ち", author: "槙 俊介", status: "要判断", statusTone: "judge" },
  { number: "5", date: "2026/04/26(日)", content: "Q1業績サマリ報告", author: "東海林 美琴", status: "報告完了", statusTone: "done" },
  { number: "6", date: "2026/04/24(金)", content: "Garden開発進捗報告", author: "上田 基人", status: "報告完了", statusTone: "done" },
  { number: "7", date: "2026/04/21(火)", content: "新規事業の企画案+市場調査結果", author: "宮永 ひかり", status: "検討中", statusTone: "thinking" },
  { number: "8", date: "2026/04/18(土)", content: "組織体制見直し案", author: "東海林 美琴", status: "提案中", statusTone: "proposing" },
  { number: "9", date: "2026/04/15(水)", content: "重要リスクレポート", author: "上田 基人", status: "報告完了", statusTone: "done" },
  { number: "10", date: "2026/04/12(日)", content: "採用戦略の中間報告", author: "金 亜奈", status: "進行中", statusTone: "progress" },
];
