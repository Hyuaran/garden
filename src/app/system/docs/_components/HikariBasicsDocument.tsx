import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import { formatDocumentDate } from "../_data/company-doc";
import {
  cancellationParagraph,
  cancellationTable,
  connectionItems,
  connectionParagraph,
  constructionTerms,
  contractItems,
  equipmentTerms,
  hikariBasicsDocument,
  hikariChapters,
  historyParagraph,
  historyTable,
  lineTypeItems,
  phoneNumberItems,
  phoneNumberParagraph,
  speedItems,
  speedParagraph,
  type HikariFigure,
  type HikariListItem,
  type HikariTable,
  type HikariTableCell,
  type HikariTerm,
  type HikariText,
} from "../_data/hikari-basics";
import styles from "../docs.module.css";

function RichText({ value }: { value: HikariText }) {
  return <>{value.map((part, index) => typeof part === "string" ? <span key={index}>{part}</span> : <strong key={index}>{part.strong}</strong>)}</>;
}

function Paragraph({ value }: { value: HikariText }) {
  return <p><RichText value={value} /></p>;
}

function BulletList({ items }: { items: HikariListItem[] }) {
  return <ul className={styles.hikariList}>{items.map((item, index) => <li key={index}>
    {item.title && <><RichText value={item.title} /><br /></>}
    {item.body.map((line, lineIndex) => lineIndex === 0
      ? <RichText key={lineIndex} value={line} />
      : <p key={lineIndex}><RichText value={line} /></p>)}
  </li>)}</ul>;
}

function CellLines({ value }: { value: HikariTableCell }) {
  return <>{value.map((line, index) => <span className={styles.tableLine} key={index}><RichText value={line} /></span>)}</>;
}

function DataTable({ table }: { table: HikariTable }) {
  return <div className={styles.tableScroller}>
    <table className={styles.hikariTable}>
      <thead><tr>{table.headers.map(header => <th key={header}>{header}</th>)}</tr></thead>
      <tbody>{table.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}><CellLines value={cell} /></td>)}</tr>)}</tbody>
    </table>
  </div>;
}

function TermList({ terms }: { terms: HikariTerm[] }) {
  return <dl className={styles.termList}>{terms.map((term, index) => <div key={index}>
    <dt><RichText value={term.term} /></dt>
    <dd>{term.description.map((line, lineIndex) => <Paragraph key={lineIndex} value={line} />)}</dd>
  </div>)}</dl>;
}

function ChapterHeading({ index }: { index: number }) {
  const chapter = hikariChapters[index];
  return <h2 id={`${chapter.id}-heading`} className={styles.chapterHeading}><span>{chapter.number}</span>{chapter.title}</h2>;
}

function Figure({ figure }: { figure?: HikariFigure }) {
  if (!figure) return null;
  return <figure className={styles.docFigure}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={figure.src} alt={figure.alt} loading="lazy" referrerPolicy="no-referrer" />
    <figcaption>{figure.title}</figcaption>
  </figure>;
}

export default function HikariBasicsDocument({ figures = [] }: { figures?: HikariFigure[] }) {
  const figureById = new Map(figures.map(figure => [figure.id, figure]));
  return <div className={styles.pageShell} data-hikari-basics-document>
    <header className={styles.header}>
      <SystemBreadcrumb items={[{ label: "資料", href: "/system/docs" }, { label: hikariBasicsDocument.title }]} />
      <h1>{hikariBasicsDocument.title}</h1>
    </header>
    <div className={styles.hero}>
      <p className={styles.eyebrow}>{hikariBasicsDocument.eyebrow}</p>
      <p className={styles.heroTitle}>{hikariBasicsDocument.heroTitle}</p>
      <p className={styles.updated}>最終更新日 <time dateTime={hikariBasicsDocument.updatedAt}>{formatDocumentDate(hikariBasicsDocument.updatedAt)}</time></p>
    </div>
    <div className={styles.readingLayout}>
      <nav className={styles.toc} aria-label="光回線・通信の基礎の目次">
        <p>目次</p>
        <ol>{hikariChapters.map(chapter => <li key={chapter.id}><a href={`#${chapter.id}`}><span>{chapter.number}</span>{chapter.tocTitle}</a></li>)}</ol>
      </nav>
      <div className={styles.content}>
        <section id="connection" aria-labelledby="connection-heading" className={styles.chapter}>
          <ChapterHeading index={0} />
          <Paragraph value={connectionParagraph} />
          <BulletList items={connectionItems} />
          <Figure figure={figureById.get("01")} />
          <h3>昔と今の契約形態の違い</h3>
          <BulletList items={contractItems} />
          <Figure figure={figureById.get("02")} />
        </section>
        <section id="history" aria-labelledby="history-heading" className={styles.chapter}>
          <ChapterHeading index={1} />
          <Paragraph value={historyParagraph} />
          <Figure figure={figureById.get("03")} />
          <DataTable table={historyTable} />
        </section>
        <section id="speed" aria-labelledby="speed-heading" className={styles.chapter}>
          <ChapterHeading index={2} />
          <Paragraph value={speedParagraph} />
          <BulletList items={speedItems} />
          <Figure figure={figureById.get("04")} />
        </section>
        <section id="line-types" aria-labelledby="line-types-heading" className={styles.chapter}>
          <ChapterHeading index={3} />
          <BulletList items={lineTypeItems} />
          <Figure figure={figureById.get("05")} />
        </section>
        <section id="glossary" aria-labelledby="glossary-heading" className={styles.chapter}>
          <ChapterHeading index={4} />
          <Figure figure={figureById.get("06")} />
          <h3>機器・配線まわり</h3>
          <TermList terms={equipmentTerms} />
          <h3>工事・制度</h3>
          <TermList terms={constructionTerms.slice(0, 2)} />
          <Figure figure={figureById.get("07")} />
          <TermList terms={constructionTerms.slice(2)} />
        </section>
        <section id="phone-number" aria-labelledby="phone-number-heading" className={styles.chapter}>
          <ChapterHeading index={5} />
          <Paragraph value={phoneNumberParagraph} />
          <BulletList items={phoneNumberItems} />
        </section>
        <section id="cancellation" aria-labelledby="cancellation-heading" className={styles.chapter}>
          <ChapterHeading index={6} />
          <Paragraph value={cancellationParagraph} />
          <DataTable table={cancellationTable} />
          <Figure figure={figureById.get("08")} />
        </section>
        <a className={styles.backToTop} href="#hikari-basics-top">目次へ戻る ↑</a>
      </div>
    </div>
  </div>;
}
