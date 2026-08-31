import Link from "next/link";
import { notFound } from "next/navigation";
import SlideDeck from "../../_components/SlideDeck";
import { loadSlideDeck } from "../../_lib/slides.server";
import styles from "../../docs.module.css";

export const metadata = { title: "スライド | Garden" };

export default async function SlideDeckPage({ params }: { params: Promise<{ deck: string }> }) {
  const { deck: id } = await params;
  const deck = await loadSlideDeck(id);
  if (!deck) notFound();
  return <div className={styles.pageShell}>
    <header className={styles.header}>
      <p className={styles.eyebrow}>System ／ 資料 ／ スライド</p>
      <h1>{deck.title}</h1>
    </header>
    <div className={styles.presentationEntry}>
      <Link href={`/system/docs/slides/${deck.id}/present`} className={styles.presentationButton}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h18M5 4v12h14V4M12 16v5M8 21l4-3 4 3" /><path d="m10 8 5 3-5 3z" /></svg>
        オリエンテーション表示
      </Link>
    </div>
    <p className={styles.lead}>全{deck.slideCount}枚 ／ 下へスクロールしてご覧ください</p>
    <SlideDeck deck={deck} />
    <Link className={styles.backToTop} href="/system/docs/slides">スライドの一覧へ戻る</Link>
  </div>;
}
