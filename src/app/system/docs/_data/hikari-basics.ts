import "server-only";

export type HikariTextPart = string | { strong: string };
export type HikariText = HikariTextPart[];
export type HikariTableCell = HikariText[];

export type HikariListItem = {
  title?: HikariText;
  body: HikariText[];
};

export type HikariTable = {
  headers: string[];
  rows: HikariTableCell[][];
};

export type HikariTerm = {
  term: HikariText;
  description: HikariText[];
};

export const hikariBasicsDocument = {
  title: "光回線・通信の基礎（新入社員研修）",
  heroTitle: "光回線・通信の基礎",
  description: "新入社員向けに、回線・プロバイダー・機器・工事・電話番号・解約の区分をまとめています。",
  updatedAt: "2026-09-18",
  eyebrow: "新入社員向け 通信の基礎知識",
};

export const hikariChapters = [
  { number: 1, id: "connection", title: "インターネット接続の基本構造と関係性", tocTitle: "接続の基本構造" },
  { number: 2, id: "history", title: "通信回線の歴史（古い順）", tocTitle: "回線の歴史" },
  { number: 3, id: "speed", title: "通信速度の単位と読み方", tocTitle: "速度の単位" },
  { number: 4, id: "line-types", title: "回線系統の違い（NTT系と電力系）", tocTitle: "NTT系と電力系" },
  { number: 5, id: "glossary", title: "新入社員向け 必須用語集", tocTitle: "必須用語集" },
  { number: 6, id: "phone-number", title: "電話番号の取り扱い（発番・乗り換え）", tocTitle: "電話番号の取扱い" },
  { number: 7, id: "cancellation", title: "回線をやめるときの呼び方と区分", tocTitle: "やめるときの区分" },
] as const;

export const hikariFigures = [
  { id: "01", title: "回線＝道路、プロバイダー＝料金所", alt: "回線を道路、プロバイダーを料金所として示した図" },
  { id: "02", title: "昔と今の契約のかたち", alt: "昔と今の契約形態の違いを示した図" },
  { id: "03", title: "通信回線の歴史", alt: "通信回線の歴史を古い順に示した図" },
  { id: "04", title: "通信速度の単位", alt: "通信速度の単位を階段状に示した図" },
  { id: "05", title: "NTT系と電力系は別々の道", alt: "NTT系と電力系の違いを示した図" },
  { id: "06", title: "家の中の機器のつながり", alt: "家の中の機器のつながりを示した図" },
  { id: "07", title: "有派遣工事と無派遣工事", alt: "有派遣工事と無派遣工事の違いを示した図" },
  { id: "08", title: "回線をやめるときの 4 つの区分", alt: "回線をやめるときの4つの区分を示した図" },
] as const;

export type HikariFigure = typeof hikariFigures[number] & { src: string };

export const connectionParagraph: HikariText = [
  "インターネットを利用するには、必ず",
  { strong: "「道路（回線）」" },
  "と",
  { strong: "「料金所（プロバイダー）」" },
  "の両方が必要です。",
];

export const connectionItems: HikariListItem[] = [
  {
    title: [{ strong: "回線事業者（NTT、関西電力グループなど）＝「道路」" }],
    body: [["自宅まで通信の線（光ファイバーなど）を引っ張ってくる会社。"]],
  },
  {
    title: [{ strong: "プロバイダー（ISP）＝「料金所・改札」" }],
    body: [["「この契約者は正規の会員です」と確認し、インターネットの世界（YouTubeやWebサイトなど）へ接続する通行証（IPアドレス）を発行する会社。"]],
  },
];

export const contractItems: HikariListItem[] = [
  {
    title: [{ strong: "昔（フレッツ光など）" }],
    body: [["：NTT（回線）とプロバイダー（OCNやBIGLOBEなど）の2社と別々に契約し、請求書も2通届いていた。"]],
  },
  {
    title: [{ strong: "今（光コラボレーションやeo光など）" }],
    body: [["：回線とプロバイダーが1つにまとまった「一体型」が主流。窓口が1本化され、請求も1つになり、セット割引が適用される。"]],
  },
];

export const historyParagraph: HikariText = ["通信は「音声を届けるための金属線」から「データを届けるための光の糸」へと進化してきました。"];

export const historyTable: HikariTable = {
  headers: ["順序", "回線種別", "仕組みと特徴", "通信速度の目安", "当時の特徴・背景"],
  rows: [
    [
      [[{ strong: "1" }]],
      [[{ strong: "アナログ回線" }], ["（ダイヤルアップ）"]],
      [["音声通話と同じ電話線を使用"]],
      [["最大 56kbps"]],
      [["「ピーヒョロロ…」と電話をかけて接続。ネット中は家の電話が使えず、使った時間分だけ電話代がかかる従量制。"]],
    ],
    [
      [[{ strong: "2" }]],
      [[{ strong: "ISDN" }], ["（デジタル電話回線）"]],
      [["銅線を使ってデジタル信号を伝送"]],
      [["64kbps 〜 128kbps"]],
      [["1本の電話線で「電話とネットを同時に使う」ことが可能に。「テレホーダイ（深夜定額）」が大流行。"]],
    ],
    [
      [[{ strong: "3" }]],
      [[{ strong: "ADSL" }]],
      [["銅線の中の「通話で使わない高い周波数帯」を利用"]],
      [["1.5Mbps 〜 50Mbps"]],
      [[{ strong: "初の本格的な常時接続・高速ネット" }, "。モデムの無料配布等で爆発的に普及。※現在はサービス終了。"]],
    ],
    [
      [[{ strong: "4" }]],
      [[{ strong: "光回線" }], ["（FTTH）"]],
      [["銅線からガラスの細い糸（光ファイバー）へ全面刷新"]],
      [["1Gbps 〜 10Gbps"]],
      [["距離による速度低下や電磁波ノイズが消滅。動画配信やゲームの基盤となる現代の標準インフラ。"]],
    ],
  ],
};

export const speedParagraph: HikariText = ["速度は「bps（bits per second＝1秒間に運べるデータ量）」で表し、1,000倍ごとに単位が上がります（1,000k = 1M、1,000M = 1G）。"];

export const speedItems: HikariListItem[] = [
  { title: [{ strong: "64kbps" }], body: [["（ろくじゅうよん キロ・ビーピーエス）：昔の電話回線レベル"]] },
  { title: [{ strong: "1.5Mbps" }], body: [["（いってんご メガ・ビーピーエス）：ADSL初期の速度"]] },
  { title: [{ strong: "100Mbps" }], body: [["（ひゃく メガ・ビーピーエス）：マンションのVDSL方式など（G換算すると ", { strong: "0.1G" }, "）"]] },
  { title: [{ strong: "1Gbps" }], body: [["（いち ギガ・ビーピーエス / 1,000Mbps）：現在の一般的な光回線"]] },
  { title: [{ strong: "10Gbps" }], body: [["（じゅう ギガ・ビーピーエス）：最新の超高速光回線"]] },
];

export const lineTypeItems: HikariListItem[] = [
  {
    title: [{ strong: "NTT系（フレッツ光 / 光コラボレーション）" }],
    body: [["NTTの光ファイバー網を利用。ドコモ光やソフトバンク光など全国展開の事業者が多く、乗り換え時の工事が不要になりやすい。"]],
  },
  {
    title: [{ strong: "電力系（eo光など・独自回線）" }],
    body: [
      ["各地域の電力会社（関西ならオプテージ）が持つ独自の電柱・送電網を利用。"],
      ["NTTの回線と混ざらない専用道路のため混雑しにくく安定するが、エリアが限定され、NTT系との乗り換えには必ず引き込み・撤去工事が必要。"],
    ],
  },
];

export const equipmentTerms: HikariTerm[] = [
  { term: [{ strong: "光コンセント" }], description: [["外の電柱から引き込んだ光ファイバーの出口となる壁の差込口。「光」または「光コード」と印字されている。"]] },
  { term: [{ strong: "ONU（光回線終端装置）" }], description: [["光の「翻訳機」。光ファイバーを通ってくる「光信号」を、パソコンが読める「デジタル電気信号」に相互変換する箱。光回線では必ず置かれる。"]] },
  { term: [{ strong: "モデム" }], description: [["電話線（ADSL/VDSL）やケーブルテレビ（CATV）などの「アナログ電気信号」を「デジタル電気信号」に変換する翻訳機。※光回線では使わないが、昔の名残でONUをモデムと呼ぶお客様が多い。"]] },
  { term: [{ strong: "ルーター" }], description: [["データの「交通整理係」。ONUで変換されたネット通信を、スマホ・パソコン・ゲーム機など", { strong: "複数台へ同時に分配する" }, "ための機械。"]] },
  { term: [{ strong: "無線LANカード" }], description: [["NTTのホームゲートウェイ（一体型機器）などの専用スロットに差し込むことで、その機器からWi-Fiを飛ばせるようにする小型カード。"]] },
  { term: [{ strong: "LANケーブル" }], description: [["ONUやルーターと、パソコンなどの機器を有線で直接つなぐプラスチック端子付きのコード。"]] },
  { term: [{ strong: "有線" }], description: [["LANケーブルを使って直接機器をつなぐ方式。速度が速く、電波干渉を受けないため極めて安定する。"]] },
  { term: [{ strong: "無線（Wi-Fi）" }], description: [["電波を使って空中でデータをやり取りする方式。配線不要で家中どこでも使えるが、壁などの障害物や家電の電波干渉、距離によって不安定になることがある。"]] },
  { term: [{ strong: "Wi-Fi（ワイファイ）" }], description: [["電波を使って無線でインターネット通信を行う仕組みの国際規格名。"]] },
];

export const constructionTerms: HikariTerm[] = [
  { term: [{ strong: "有派遣（派遣工事）" }], description: [["宅内に光コンセントがない場合などに、工事業者がお客様の自宅に訪問して線を引き込み、開通確認を行う工事（立ち会いが必要）。"]] },
  { term: [{ strong: "無派遣（無派遣工事）" }], description: [["すでに宅内に光コンセントや配線設備が整っている場合、NTT等の局内作業のみで開通させ、機器はお客様自身がコンセントに差すだけで完了する工事（立ち会い不要）。"]] },
  { term: [{ strong: "初期契約解除制度" }], description: [["契約書面を受け取った日（または開通日）から", { strong: "8日以内" }, "であれば、お客様都合でも契約を解除できる法律上のルール（通信版のクーリングオフ）。"]] },
];

export const phoneNumberParagraph: HikariText = ["光回線と一緒に申し込まれることが多い「ひかり電話（光IP電話）」に関する重要手続きです。"];

export const phoneNumberItems: HikariListItem[] = [
  { title: [{ strong: "新規発番" }], body: [["これまで固定電話を持っていなかった場合や、新しい番号で契約する場合に、新しく電話番号を発行すること。"]] },
  {
    title: [{ strong: "番号ポータビリティ（番ポ / LNP）" }],
    body: [
      ["今使っている固定電話の番号を、回線会社を変えてもそのまま引き継いで使う手続き。"],
      [{ strong: "注意点" }, "：NTTのアナログ電話で作った番号は他社へ引き継ぎやすいが、光回線専用として新規発番した番号は、他社へ引き継げない（番号が変わる）ケースがある。"],
    ],
  },
];

export const cancellationParagraph: HikariText = ["単に「解約」と一言で言っても、手続きの目的によって業界・実務上の呼び方が厳格に分かれます。"];

export const cancellationTable: HikariTable = {
  headers: ["呼び方", "内容・目的", "手続きのポイント", "電話番号の行方"],
  rows: [
    [
      [[{ strong: "廃止（純解約）" }]],
      [["インターネットそのものを完全に撤去して終了する"]],
      [["回線の引き抜き・撤去や機器返却を行い、契約関係をすべて精算する。"]],
      [["電話番号も完全に消滅する。"]],
    ],
    [
      [[{ strong: "解約（乗り換え）" }]],
      [["他社の回線網へ切り替えるため、現契約を終了する"], ["（例：NTT系 ⇔ eo光）"]],
      [["別の線を引き直すため、工事と機器返却が必要。"]],
      [["番号ポータビリティを行えば番号を引き継げる場合がある。"]],
    ],
    [
      [[{ strong: "事業者変更" }]],
      [["NTTの光コラボから別の光コラボへ契約先を切り替える"], ["（例：ドコモ光 → ソフトバンク光）"]],
      [["回線設備（光コンセント・光配線）はそのまま使い回すため、", { strong: "工事不要・機器返却不要" }, "で乗り換え可能。"]],
      [["ひかり電話の番号も工事なしでそのまま引き継がれる。"]],
    ],
    [
      [[{ strong: "アナログ戻し" }]],
      [["ひかり電話で使っていた番号を、NTTの「通常のアナログ電話回線」へ戻す手続き"]],
      [["光回線を完全に解約したいが、「昔から使っている大事な電話番号だけは消さずに残したい」という場合に行う。※NTTで元々発番した番号のみ可能。"]],
      [["アナログ電話として電話番号が手元に残る。"]],
    ],
  ],
};
