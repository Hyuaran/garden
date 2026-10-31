import { isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";
import type { SystemIcon } from "@/app/system/_components/ShachoShell/shacho-shell-config";

export type ManualDocKey = "operation" | "flow" | "summary" | "overview" | "engineer" | "claude";

export type ManualDoc = {
  key: ManualDocKey;
  label: string;
  file: string;
  kind: "html" | "md";
  minRole: GardenRole;
};

export type ManualModule = {
  slug: string;
  name: string;
  description: string;
  icon: SystemIcon;
};

export type ManualDefinition = {
  moduleSlug: string;
  slug: string;
  name: string;
  description: string;
  paths: string[];
  storagePrefix: string;
  docs: ManualDoc[];
  extraDocs?: ManualDoc[];
};

// 使い方はログイン中の在籍者全員、⓪②③④は全権管理者のみ。
export const MANUAL_DOCS: ManualDoc[] = [
  { key: "operation", label: "使い方", file: "1_operation.html", kind: "html", minRole: "toss" },
  { key: "summary", label: "要点", file: "0_summary.html", kind: "html", minRole: "super_admin" },
  { key: "overview", label: "仕組み", file: "2_overview.html", kind: "html", minRole: "super_admin" },
  { key: "engineer", label: "仕様", file: "3_engineer.html", kind: "html", minRole: "super_admin" },
  { key: "claude", label: "Claude 用", file: "4_claude.md", kind: "md", minRole: "super_admin" },
];

export const MANUAL_MODULES: ManualModule[] = [
  { slug: "system", name: "System", description: "社内システム", icon: "home" },
  { slug: "bud", name: "Bud", description: "経理収支", icon: "salary" },
  { slug: "root", name: "Root", description: "組織台帳", icon: "person" },
];

const MANUAL_PATHS: Record<string, string[]> = {
  "system/docs": [
    "/system/docs"
  ],
  "system/onboarding": [
    "/system/onboarding"
  ],
  "system/mypage": [
    "/system/mypage",
    "/my",
    "/m/account"
  ],
  "system/kot-attendance": [
    "/system/attendance",
    "/my?tab=attendance"
  ],
  "system/shift": [
    "/system/shift",
    "/my?tab=shift"
  ],
  "system/zenkaku": [
    "/system/zenkaku", "/my?tab=zenkaku"
  ],
  "system/call-metrics": [
    "/system/call-metrics"
  ],
  "system/shukkin": [
    "/system/forms/shukkin"
  ],
  "system/payroll-notice": [
    "/system/payroll-notice",
    "/system/forms/payroll-notice"
  ],
  "system/nhk-visit": [
    "/system/forms/nhk-visit", "/m/nhk"
  ],
  "system/expense": [
    "/system/forms/expense", "/m/expense"
  ],
  "system/ap-daily": [
    "/my?tab=report",
    "/my?tab=review"
  ],
  "system/line": [
    "/system/line"
  ],
  "system/global-search": [],
  "system/innovera": [
    "/system/innovera"
  ],
  "system/host-relay": [],
  "system/vercel-usage": [],
  "system/innovera-calls": [
    "/system/innovera-calls", "/my?tab=calls"
  ],
  "system/pl-payments": [],
  "system/mail-payment-check": [],
  "system/mail-ndr-watch": [],
  "system/notices": [
    "/system/notices",
    "/my?tab=notices"
  ],
  "system/doc-save-check": [],
  "system/transfer-duplicate-check": [
    "/bud/transfers"
  ],
  "system/manuals-screen": [
    "/system/manuals"
  ],
  "system/contracts": [
    "/system/contracts"
  ],
  "system/sites": [
    "/system/sites"
  ],
  "system/toss": [
    "/p/toss"
  ],
  "system/deliveries": [
    "/system/deliveries"
  ],
  "system/kanri": [
    "/system/kanri"
  ],
  "system/list": [
    "/system/list"
  ],
  "bud/expense": [
    "/bud/expenses",
    "/m/bud"
  ],
  "bud/broadband": [
    "/bud/profit/broadband"
  ],
  "bud/bank": [
    "/bud/bank"
  ],
  "root/mail-forwarding": [
    "/root/mail-forwarding"
  ]
};

function manual(moduleSlug: string, slug: string, name: string, description: string, extraDocs: ManualDoc[] = []): ManualDefinition {
  return { moduleSlug, slug, name, description, paths: MANUAL_PATHS[`${moduleSlug}/${slug}`], storagePrefix: `${moduleSlug}/${slug}`, extraDocs, docs: [MANUAL_DOCS[0], ...extraDocs, ...MANUAL_DOCS.slice(1)] };
}

// 並びは System の左メニューと同じ。資料の本体は Storage（system-manuals）の storagePrefix 配下に置く
export const SYSTEM_MANUALS: ManualDefinition[] = [
  manual("system", "docs", "資料", "会社説明・スライド・研修動画など、社内で読む資料の見方。"),
  manual("system", "onboarding", "入社手続き", "入社時の情報入力と、提出した内容の確認のしかた。", [{ key: "flow", label: "応募から入社までの流れ", file: "5_flow.html", kind: "html", minRole: "staff" }]),
  manual("system", "mypage", "自分の情報と届出", "登録情報の確認と、住所・口座・交通費などの届出の出し方。"),
  manual("system", "kot-attendance", "勤怠打刻と KING OF TIME 取込", "出勤・退勤の打刻と、KING OF TIME へ取り込む CSV の作り方。"),
  manual("system", "shift", "シフト", "シフトの提出と勤務予定の確認のしかた。"),
  manual("system", "zenkaku", "前確依頼", "営業IDの登録内容の確認と、取次先への前確依頼の出し方。"),
  manual("system", "call-metrics", "テレマ コール集計", "架電の件数や結果の見方と、コールセンターへの共有。"),
  manual("system", "shukkin", "業務管理ツール（出勤表・シフトLINE連絡テキスト生成）", "KING OF TIME の日別データから出勤表と翌日のシフト連絡の文面を作り、Chatwork・公式 LINE へ送るまでの手順。並びの設定と LINE の紐づけ。"),
  manual("system", "payroll-notice", "業務管理ツール（給与計算連絡）", "月に一度の給与計算に関する連絡の送り方と、送信履歴の見方。"),
  manual("system", "nhk-visit", "業務管理ツール（NHK訪問業務 報告）", "NHK 訪問業務の当日の報告の入力と送信、集計の受け取り方（Chatwork・LINE）。"),
  manual("system", "expense", "業務管理ツール（経費 報告）", "立て替えた経費・会社クレジットカードの利用の報告のしかた。3 種類のフォームとスマホの入口、Kintone 経費一覧への写り方。"),
  manual("system", "ap-daily", "AP日報", "マイページの「AP日報」タブで日報を入力し、Chatwork のスタッフ連絡用のルームへ送る仕組み。コール履歴からの自動の数字と、振り返りタブ。"),
  manual("system", "line", "公式LINE", "従業員向けの公式 LINE を人ごとに運用する設定画面。タグ・あいさつ文・一斉送信・連絡先・リッチメニューの反映と、LINE の中の申告・シフトのページ。"),
  manual("system", "global-search", "Garden全体の検索", "右上の虫眼鏡（Ctrl+K）で、画面で入力した内容・画面の名前・マニュアルの題名を Garden 全体から探す使い方と仕組み。表の右上の検索窓（今の画面の中の検索）も。"),
  manual("system", "innovera", "業務管理ツール（INNOVERA番号の同期）", "INNOVERA の回線一覧を Kintone の番号一覧へ 5 分ごとに写す仕組み。差分の見方と「今すぐ反映」の使い方。"),
  manual("system", "host-relay", "業務管理ツール（ホスト PC 中継）", "INNOVERA への通信を社内ホスト PC から出す仕組み。ホスト PC の常駐の止め方・動かし方・ログの見方と、止まったときの対処・設置し直す手順。"),
  manual("system", "vercel-usage", "業務管理ツール（Vercel 料金の見張り）", "Garden のサーバー（Vercel）の料金を毎日 18:05 に確かめ、込み分を超えそう・急に増えたときに Garden通知で知らせる仕組み。知らせの読み方と、増えたときの調べ方。"),
  manual("system", "innovera-calls", "INNOVERA履歴・録音", "INNOVERA の通話履歴の見方、切断後の録音の再生、自分の発信番号の切り替え。権限の段階と Root での紐づけ。"),
  manual("system", "pl-payments", "業務管理ツール（損益の見張り）", "Kintone【損益】センターライズの支払待ちを 5 分ごとに見張り、通知・請求書の Drive リンク入力・振込依頼／振込実行の自動作成・前日通知を行う仕組み。"),
  manual("system", "mail-payment-check", "業務管理ツール（支払漏れチェック）", "各社の経理メール 24 箱に届いた請求書を平日 10:00 に調べ、振込依頼の予約漏れと Drive の保存漏れを Chatwork で知らせる仕組み。知らせの読み方と対処。"),
  manual("system", "mail-ndr-watch", "業務管理ツール（メール送信失敗の知らせ）", "Microsoft 365 で送ったメールが「配信不能」で返ってきたら、15 分以内に Garden通知へ知らせる仕組み。知らせの読み方と再送の手順、テスト送信のやり方。"),
  manual("system", "notices", "お知らせ（新機能のお知らせ）", "新しい機能や変更をお知らせするモーダル・ベル・お知らせページの見方と、全権の人がお知らせを公開する／しないを決める手順。"),
  manual("system", "doc-save-check", "業務管理ツール（契約書・条件表の保存チェック）", "各社の経理メール 24 箱に届いた・送った契約書と条件表が Google ドライブに保存されているかを平日 10:10 に調べ、保存漏れを Chatwork で知らせる仕組み。知らせの読み方と対処。"),
  manual("system", "transfer-duplicate-check", "業務管理ツール（振込依頼の二重払い防止チェック）", "振込依頼を保存するときに出る二重払い・添付間違いの確認の意味と対処、「実績期間」欄の入れ方。"),
  manual("system", "manuals-screen", "マニュアル画面", "マニュアルの読み方と、全権の人が資料を差し替える・新しい機能の資料を載せる手順。"),
  manual("system", "contracts", "契約書管理", "上位店との契約書の登録と、パートナー配布用ひな形の作り方。"),
  manual("system", "sites", "コーポレートサイト", "グループ各社の会社HPと商品ページの一覧。稼働状態・問い合わせの配線・旧サーバー契約の見方と、一覧の更新のしかた。"),
  manual("system", "toss", "関電トスポータル", "関西電力のトスアップの受け付けと、Kintone への連携。"),
  manual("system", "deliveries", "自動配信", "決まった時刻に Chatwork へ自動で送っている連絡の中身と確認のしかた。"),
  manual("system", "kanri", "管理表ポータル", "毎日の管理表を KING OF TIME・Kintone のデータから作り、TV・Excel・Chatwork へ出す手順。"),
  manual("system", "list", "リストマスタ", "営業リストを絞って Excel／CSV／.mer に書き出す・日々のリスト投入を登録する・購入先やリストごとの成績を見る（リスト｜アップロード｜分析｜履歴検索｜自社アポ禁｜管理方法）。"),
  manual("bud", "expense", "経費精算", "領収書の申請から承認・仕訳までの流れ。"),
  manual("bud", "broadband", "事業の収支", "Kintone の入金・支払いの予定を月×事業×取引先の表で見る・口座と合わない（赤）と予定日前（グレー）の見方・金額を押して中身と明細を開く・並べ替えと見てよい人の設定。"),
  manual("bud", "bank", "口座残高・カード利用", "マネーフォワードの口座残高を法人×銀行の表で見る・0 時からの増減と未仕訳の件数の読み方・カードの利用の見方と、全権の人の並び替え・見てよい人の設定。"),
  manual("root", "mail-forwarding", "郵便の転送", "事務所や代表者の住所から届く郵便の転送（e転居）の期限を管理する。転送の登録・届け直したときの記録・期限前の Garden通知の読み方。"),
];

export function getVisibleManualDocs(manual: ManualDefinition, role: GardenRole) {
  return manual.docs.filter((doc) => isRoleAtLeast(role, doc.minRole));
}

export function getVisibleManuals(role: GardenRole) {
  return SYSTEM_MANUALS.filter((manual) => getVisibleManualDocs(manual, role).length > 0);
}

export function getManualModules(role: GardenRole) {
  const visibleManuals = getVisibleManuals(role);
  return MANUAL_MODULES.map((module) => ({
    ...module,
    count: visibleManuals.filter((manual) => manual.moduleSlug === module.slug).length,
  })).filter((module) => module.count > 0);
}

export function findManualModule(moduleSlug: string) {
  return MANUAL_MODULES.find((module) => module.slug === moduleSlug) ?? null;
}

export function findManual(moduleSlug: string, slug: string) {
  return SYSTEM_MANUALS.find((manual) => manual.moduleSlug === moduleSlug && manual.slug === slug) ?? null;
}

export function findManualDoc(manual: ManualDefinition, file: string) {
  return manual.docs.find((doc) => doc.file === file) ?? null;
}

// 追加資料は使い方の閲覧設定を引き継ぐ。
export function manualDocPermissionKey(key: ManualDocKey) {
  return key === "flow" ? "operation" : key;
}

/** Prefer the most specific route and query match; match route segments, not similar names. */
export function findManualForPath(path: string, manuals: ManualDefinition[] = SYSTEM_MANUALS) {
  const current = new URL(path, "https://garden.invalid");
  let best: ManualDefinition | null = null;
  let longest = -1;
  for (const manual of manuals) for (const prefix of manual.paths) {
    const candidate = new URL(prefix, current.origin);
    const routeMatches = current.pathname === candidate.pathname || current.pathname.startsWith(`${candidate.pathname}/`);
    const queryMatches = [...candidate.searchParams].every(([key, value]) => current.searchParams.get(key) === value);
    if (routeMatches && queryMatches && prefix.length > longest) { best = manual; longest = prefix.length; }
  }
  return best;
}
