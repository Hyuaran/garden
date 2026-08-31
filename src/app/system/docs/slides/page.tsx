import Link from "next/link";
import { groupSlideDecks } from "../_data/slides";
import { loadSlideDecks } from "../_lib/slides.server";
import styles from "../docs.module.css";
import slideStyles from "./slides.module.css";

export const metadata = { title: "スライド | Garden" };

export default async function SlidesPage() {
  const decks = await loadSlideDecks();
  return <div className={styles.pageShell}>
    <header className={styles.header}><p className={styles.eyebrow}>System ／ 資料</p><h1>スライド</h1></header>
    <p className={styles.lead}>研修の内容を、1枚ずつの絵でご覧いただけます。</p>
    <div className={slideStyles.library}>{groupSlideDecks(decks).map((group, index) => <section key={group.category} aria-labelledby={`slide-category-${index}`}>
      <h2 id={`slide-category-${index}`}>{group.category}</h2>
      <div className={slideStyles.deckList}>{group.decks.map(deck => <Link className={slideStyles.deckCard} href={`/system/docs/slides/${deck.id}`} key={deck.id} aria-labelledby={`slide-deck-${deck.id}`}>
        {deck.coverUrl ? <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={slideStyles.cover} src={deck.coverUrl} alt={`${deck.title}の表紙`} referrerPolicy="no-referrer" />
        </> : <span className={slideStyles.coverPlaceholder}>表紙を読み込めませんでした</span>}
        <span className={slideStyles.deckDetails}>
          <span className={slideStyles.deckTitle} id={`slide-deck-${deck.id}`}>{deck.title}</span>
          <span>{deck.description}</span>
        </span>
        <span className={slideStyles.slideCount}>全{deck.slideCount}枚</span>
        <span className={slideStyles.arrow} aria-hidden="true">→</span>
      </Link>)}</div>
    </section>)}</div>
    <Link className={styles.backToTop} href="/system/docs">資料の一覧へ戻る</Link>
  </div>;
}
