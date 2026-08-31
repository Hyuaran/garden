export type SlideDeckInfo = {
  id: string;
  category: string;
  title: string;
  description: string;
  slideCount: number;
  visible: boolean;
  order: number;
};

export type SlideImage = {
  index: number;
  src: string;
};

export type ListedSlideDeck = SlideDeckInfo & { coverUrl?: string };
export type PlayableSlideDeck = SlideDeckInfo & { slides: SlideImage[] };

// 追加時は1行追加し、非公開system-docsに slides/<id>/s_01.webp から必要枚数までを置く。
export const slides: readonly SlideDeckInfo[] = [
  { id: "01-orientation", category: "入社したら", title: "アルバイト入社オリエンテーション", description: "入社時に必要な説明事項をまとめています。", slideCount: 14, visible: true, order: 1 },
  { id: "03-refresh-time", category: "入社したら", title: "リフレッシュタイム", description: "休憩時間（リフレッシュタイム）の取り方やルールの説明です。", slideCount: 10, visible: true, order: 2 },
  { id: "04-sales-guide", category: "入社したら", title: "営業導入ガイド", description: "営業の仕事を始めるにあたっての流れとポイントをまとめています。", slideCount: 10, visible: true, order: 3 },
];

// 区分は最初に現れる順、区分内もorder順。非表示項目はクライアントでも出さない。
export function groupSlideDecks<T extends SlideDeckInfo>(items: readonly T[]) {
  const groups = new Map<string, T[]>();
  for (const deck of items.filter(deck => deck.visible).sort((a, b) => a.order - b.order)) {
    const group = groups.get(deck.category) ?? [];
    group.push(deck);
    groups.set(deck.category, group);
  }
  return [...groups].map(([category, decks]) => ({ category, decks }));
}

export function findVisibleSlideDeck(id: string) {
  return slides.find(deck => deck.visible && deck.id === id);
}

export function slideImagePath(id: string, index: number) {
  return `slides/${id}/s_${String(index).padStart(2, "0")}.webp`;
}
