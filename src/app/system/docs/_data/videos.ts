export type DocVideo = {
  id: string;
  category: string;
  title: string;
  description: string;
  duration: string;
  visible: boolean;
  order: number;
};

export type PlayableDocVideo = DocVideo & { videoUrl?: string; posterUrl?: string };

// 追加時は1行追加し、非公開system-docsに videos/<id>.mp4 と videos/posters/<id>.webp を置く。
export const videos: readonly DocVideo[] = [
  { id: "00-company-intro", category: "面接のとき", title: "会社紹介", description: "面接の待ち時間にご覧いただく会社紹介の動画です。", duration: "1分40秒", visible: true, order: 1 },
  { id: "01-orientation", category: "入社したら", title: "アルバイト入社オリエンテーション", description: "入社時に必要な説明事項をまとめた動画です。", duration: "4分09秒", visible: true, order: 2 },
  { id: "03-refresh-time", category: "入社したら", title: "リフレッシュタイム", description: "休憩時間（リフレッシュタイム）の取り方やルールの説明です。", duration: "4分07秒", visible: true, order: 3 },
  { id: "04-sales-guide", category: "入社したら", title: "営業導入ガイド", description: "営業の仕事を始めるにあたっての流れとポイントをまとめた動画です。", duration: "4分15秒", visible: true, order: 4 },
  { id: "02-rakuten-hayatoku", category: "入社したら", title: "楽天早トク給与", description: "給与の前払いサービス「楽天早トク給与」の使い方の説明です。", duration: "2分40秒", visible: true, order: 5 },
];

// 区分は最初に現れる順、区分内もorder順。非表示項目はクライアントでも出さない。
export function groupVideos<T extends DocVideo>(items: readonly T[]) {
  const groups = new Map<string, T[]>();
  for (const video of items.filter(video => video.visible).sort((a, b) => a.order - b.order)) {
    const group = groups.get(video.category) ?? [];
    group.push(video);
    groups.set(video.category, group);
  }
  return [...groups].map(([category, videos]) => ({ category, videos }));
}
