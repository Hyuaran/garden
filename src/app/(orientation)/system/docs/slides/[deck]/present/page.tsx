import { notFound } from "next/navigation";
import SlideDeck from "@/app/system/docs/_components/SlideDeck";
import { loadSlideDeck } from "@/app/system/docs/_lib/slides.server";

export const metadata = { title: "スライド・オリエンテーション | Garden" };

export default async function SlideOrientationPage({ params }: { params: Promise<{ deck: string }> }) {
  const { deck: id } = await params;
  const deck = await loadSlideDeck(id, `/system/docs/slides/${id}/present`);
  if (!deck) notFound();
  return <div id="slides-top"><SlideDeck deck={deck} /></div>;
}
