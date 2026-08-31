import "server-only";

export const companyDocument = {
  title: "会社説明",
  companyName: "株式会社ヒュアラン",
  description: "会社の歩み、事業、そして共に働く仲間をご紹介します。",
  updatedAt: "2026-08-31",
  asOf: "2026年9月1日 現在",
  employeeCount: "約40名",
  eyebrow: "WELCOME TO HYUARAN",
  welcome: ["はじめまして。株式会社ヒュアランです。", "この度はご入社おめでとうございます＾＾", "これから共に働いていけること、心より嬉しくおもいます！"],
  closing: [
    "分からないこと、不安なこともあると思いますが、周りの先輩たちがしっかりとサポートします。",
    "最初は慣れないことも多いと思いますが、「分からないことはすぐ聞く」が成長の近道です。",
    "私たちも新しい視点やアイデアを楽しみにしています。",
    "楽しく、前向きに、一緒に成長し、会社を盛り上げていきましょう！",
  ],
  philosophy: {
    title: "個人力・人間力の創造",
    paragraphs: [
      "「目覚めの先にある価値を創造する」をモットーに、忍耐強く本当の価値を作る経営を目指し、個人の創造力を活かす社風を貫いております。",
      "私たちが大切にしていることは、顧客の成功を最優先に考え、革新的なアプローチで市場に新しい価値を提供することです。私たちはチームとして協力し、成長し続けることを大切にしています。",
    ],
  },
};

export function formatDocumentDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

// 将来Gardenの登録人数を利用するときは、この関数の返却値だけを置き換える。
export function getEmployeeCountLabel() {
  return `${companyDocument.employeeCount}（${companyDocument.asOf}）`;
}

export const chapters = [
  { number: 1, id: "overview", title: "会社概要" },
  { number: 2, id: "business", title: "事業内容" },
  { number: 3, id: "organization", title: "組織について" },
  { number: 4, id: "strengths", title: "弊社の強み" },
  { number: 5, id: "results", title: "事業実績" },
  { number: 6, id: "members", title: "共に働く仲間" },
] as const;

export function getCompanyOverview() {
  return [
    { label: "社名", value: companyDocument.companyName },
    { label: "所在地", value: "〒541-0054　大阪府大阪市中央区南本町2-6-12　サンマリオンタワー地上2階西号室" },
    { label: "代表者", value: "後道　翔太" },
    { label: "設立", value: "2016年4月8日" },
    { label: "事業内容", value: "新規アウトバウンドテレマーケティング事業／訪問販売事業／自社コンテンツ開発事業／SES事業\nその他、NTT東西認定事業者・関西電力業務委託" },
    { label: "従業員数", value: getEmployeeCountLabel() },
  ];
}

export const history = [
  { year: "2016年", text: "代表取締役 後道翔太が会社を設立" },
  { year: "2018年", text: "事業拡大により難波フロントビルに本社を移転" },
  { year: "2019年", text: "事業拡大により NLC心斎橋アースビルへ本社を移転" },
  { year: "2020年", text: "自社コンテンツサービスの提供開始（ARATA光）" },
  { year: "2021年", text: "関西電力業務委託事業の開始" },
  { year: "2022年", text: "自社コンテンツサービスの提供開始（スマートブレーカー）" },
  { year: "2023年", text: "SES事業の開始／自社コンテンツサービスの提供開始（JUST光）" },
  { year: "2024年", text: "アライアンス事業の開始" },
  { year: "2025年", text: "健康経営優良法人認定／本社をサンマリオンタワーへ移転" },
  { year: "2026年", text: "自社コンテンツサービスの提供開始（Ichi光）／労働者派遣事業の開始" },
];

export const businesses = [
  { title: "アウトテレマーケティング事業", items: [
    { title: "既存顧客へのCRM事業（電話やメールでお客様と関係を作る仕事）／toC（個人のお客様向け）", text: "自社サービスをご利用中のお客様へ、現状よりも良いサービスの提案を行う" },
    { title: "新規顧客へのアポイントメント事業／toB（会社向け）", text: "弊社独自の検索方法やコミュニケーション技術を駆使し、さまざまなクライアント企業の希望する商品【お客様契約件数】を提供" },
  ] },
  { title: "訪問販売事業", note: "アウトテレマーケティングの派生", items: [{ text: "電話やNETだけでの契約履行に不安を持つお客様に対して、顔を合わせての説明を行う。契約時のみならず、商品の操作方法やご質問等にも訪問し丁寧に対応" }] },
  { title: "自社コンテンツ開発事業", items: [{ text: "「全く同じクオリティを、より安く、より満足していただく」をコンセプトに、大手通信キャリアのバックボーンをそのままエンドユーザー様に提供" }] },
  { title: "SES事業", items: [{ text: "システムやソフトウェアの開発・保守・運用といった、クライアント企業が指定した業務に対してエンジニアを派遣。IT技術は業種に関わらず様々な場面で利用されているため、取引先にはシステム開発や通信関連企業だけでなく、製造業や卸売業を行っている企業もある" }] },
];

export type OrganizationMember = { name: string; role?: string };
export type OrganizationNode = { label: string; members?: OrganizationMember[]; children?: OrganizationNode[] };
export const organizationNote = "ヒュアラングループの組織は図の通り。";
export const organization: OrganizationNode = {
  label: "代表取締役", members: [{ name: "後道　翔太" }], children: [
    { label: "SES事業部", members: [{ role: "SES事業部長", name: "金　亜奈" }], children: [
      { label: "SES課" },
    ] },
    { label: "営業部", members: [{ role: "営業部長", name: "上田　基人" }], children: [
      { label: "テレマ課", members: [
        { role: "チームリーダー", name: "宮永　ひかり" },
        { role: "チームリーダー", name: "小泉　翔" },
        { role: "チームリーダー", name: "石原　孝志朗" },
      ] },
      { label: "訪問販売課", members: [{ role: "営業", name: "萩尾　拓也" }, { role: "営業", name: "桐井　大輔" }] },
    ] },
    { label: "総務部", members: [{ role: "総務部長", name: "東海林　美琴" }], children: [
      { label: "総務課（バックヤード）", members: [
        { role: "BY", name: "簡　棣榮" },
        { role: "BY", name: "小谷　庵" },
      ] },
      { label: "企画部", members: [{ role: "BY補佐・システム開発", name: "槙　俊介" }] },
    ] },
  ],
};

export const groupCompanies = [
  { name: "株式会社ヒュアラン", representative: "後道　翔太", established: "2016年4月" },
  { name: "株式会社センターライズ", representative: "上田　菜桜", established: "2018年10月" },
  { name: "株式会社ARATA", representative: "南野　真央", established: "2019年12月" },
  { name: "株式会社リンクサポート", representative: "萩尾　拓也", established: "2020年6月" },
  { name: "株式会社たいよう", representative: "上田　基人", established: "2021年1月" },
  { name: "株式会社壱", representative: "南薗　優樹", established: "2025年6月" },
  { name: "株式会社ストーンベース", representative: "足立　真美", established: "2026年6月" },
];

export const strengths = [
  { title: "商品・サービスに関する強み", items: [
    "高品質・高性能な製品を安定供給でき、取り扱いの商品についても大手サービスのため、認知度が高い",
    "商材が多いため、顧客ニーズに柔軟に対応できるカスタマイズ性が高い",
    "スピードと柔軟性のあるコンサル力（ワンストップでコンサルを行うことで、取引先からエンドユーザー様までお待たせすることなく、スピード感のある応対が可能）",
  ] },
  { title: "顧客対応・サポートに関する強み", items: ["丁寧で迅速なカスタマーサポート", "顧客満足度の高いアフターフォローサービス", "長期的な顧客関係を築ける仕組み"] },
];

export const results = [
  { title: "新規アウトテレマ事業", examples: ["NTT東西・KDDI など大手キャリア企業との代理店契約の締結・販売"] },
  { title: "SES事業", examples: ["某大手保険会社様（日本生命様）の現場へ出向し、チームリーダーも任されている（杉山正義）", "某銀行様（滋賀銀行）にてデータを取り扱う業務をしながら、新人教育係もしている（勝田來杜）"] },
  { title: "自社コンテンツ開発事業", examples: ["大手通信キャリアのバックボーンをそのままエンドユーザー様へ提供／大手メーカーとのOEM（他社の名前で商品を作ること）共同開発"] },
  { title: "訪問販売事業", examples: ["関西電力などの地域電力に関する業務委託営業"] },
];
