import "server-only";

export type MemberField = "photo" | "department" | "hobbies" | "joinedLabel" | "title";
export type Member = {
  id: string;
  name: string;
  kana: string;
  joinedLabel: string;
  department: string;
  hobbies: string;
  title?: string;
  alsoRepresents?: string;
  isRepresentative?: boolean;
  visible: boolean;
  hidden?: MemberField[];
  order: number;
};

// 人の追加は1件追加、非掲載は visible:false。hidden は項目の行ごと非表示にする。
// 社歴はKintone従業員名簿を正とした承認済みの値。写真は同じidのStorageファイルを参照する。
export const members: Member[] = [
  { order: 1, id: "ueda-moto", name: "上田　基人", kana: "うえだ　もと", joinedLabel: "2017年入社", department: "営業部", hobbies: "釣り、サーフィン", title: "営業部長（ちいさな営業部長＾＾）", alsoRepresents: "株式会社たいようの代表取締役", visible: true, hidden: ["photo"] },
  { order: 2, id: "shoji-mikoto", name: "東海林　美琴", kana: "しょうじ　みこと", joinedLabel: "2018年入社", department: "総務部（バックヤード）", hobbies: "ジャニーズ箱推し、SixTONES", visible: true },
  { order: 3, id: "hagio-takuya", name: "萩尾　拓也", kana: "はぎお　たくや", joinedLabel: "2018年入社", department: "訪問営業部", hobbies: "旅行、サウナ", alsoRepresents: "株式会社リンクサポートの代表取締役", visible: true },
  { order: 4, id: "matsumoto-minari", name: "松本　美菜里", kana: "まつもと　みなり", joinedLabel: "2019年入社", department: "総務部（バックヤード）", hobbies: "ライブ、カラオケ、ご飯", visible: false },
  { order: 5, id: "miyanaga-hikari", name: "宮永　ひかり", kana: "みやなが　ひかり", joinedLabel: "2020年入社", department: "営業部", hobbies: "ゲーム、アニメ、読書", visible: true },
  { order: 6, id: "maki-shunsuke", name: "槙　俊介", kana: "まき　しゅんすけ", joinedLabel: "2021年入社", department: "訪問販売部／総務部（バックヤード）", hobbies: "ゴルフ、アウトドア全般、BBQ、海", alsoRepresents: "株式会社colorsの代表取締役", visible: true },
  { order: 7, id: "koizumi-sho", name: "小泉　翔", kana: "こいずみ　しょう", joinedLabel: "2022年入社", department: "営業部", hobbies: "ゴルフ、野球、お酒", visible: true },
  { order: 8, id: "tsuji-mayuko", name: "辻　舞由子", kana: "つじ　まゆこ", joinedLabel: "2022年入社", department: "営業部", hobbies: "お酒、K-POP", visible: false },
  { order: 9, id: "kin-ana", name: "金　亜奈", kana: "きん　あな", joinedLabel: "2023年入社", department: "SES事業部", hobbies: "デザイン、アート、サウナ", title: "SES事業部長", alsoRepresents: "株式会社HALコンサルティングの代表取締役", visible: true },
  { order: 10, id: "kan-taiei", name: "簡　棣榮", kana: "かん　たいえい", joinedLabel: "2025年入社", department: "", hobbies: "ゲーム、アニメ", visible: true, hidden: ["photo", "department"] },
  { order: 11, id: "kirii-daisuke", name: "桐井　大輔", kana: "きりい　だいすけ", joinedLabel: "2025年入社", department: "", hobbies: "", visible: true, hidden: ["photo", "department", "hobbies"] },
  { order: 12, id: "ishihara-koshiro", name: "石原　孝志朗", kana: "いしはら　こうしろう", joinedLabel: "2026年入社", department: "", hobbies: "サッカー観戦", visible: true, hidden: ["photo", "department"] },
  { order: 13, id: "kotani-iori", name: "小谷　庵", kana: "こたに　いおり", joinedLabel: "2026年入社", department: "", hobbies: "散歩", visible: true, hidden: ["photo", "department"] },
  { order: 99, id: "goto-shota", name: "後道　翔太", kana: "ごとう　しょうた", joinedLabel: "2016年 会社設立", department: "", hobbies: "ゴルフ、麻雀", title: "代表取締役", isRepresentative: true, visible: true, hidden: ["department"] },
];

export function visibleMembers(source: Member[] = members) {
  return source.filter(member => member.visible).toSorted((a, b) => a.order - b.order);
}

export function showsMemberField(member: Member, field: MemberField) {
  return !member.hidden?.includes(field);
}
