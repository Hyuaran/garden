import Link from "next/link";
import {
  businesses, chapters, companyDocument, formatDocumentDate, getCompanyOverview, groupCompanies,
  history, organization, organizationNote, results, strengths,
} from "../_data/company-doc";
import { showsMemberField, visibleMembers, type Member } from "../_data/members";
import MemberPhoto from "./MemberPhoto";
import OrganizationChart from "./OrganizationChart";
import styles from "../docs.module.css";

export function MemberCard({ member, photo }: { member: Member; photo?: string }) {
  if (!member.visible) return null;
  const rows = [
    { field: "joinedLabel" as const, label: "社歴", value: member.joinedLabel },
    { field: "department" as const, label: "所属", value: member.department },
    { field: "title" as const, label: "役職", value: member.title },
    { field: "title" as const, label: "兼務", value: member.alsoRepresents },
    { field: "hobbies" as const, label: "趣味", value: member.hobbies },
  ].filter(row => showsMemberField(member, row.field) && row.value?.trim());
  return <article className={styles.memberCard} data-member-id={member.id} aria-labelledby={`member-${member.id}`}>
    <MemberPhoto key={photo} name={member.name} src={showsMemberField(member, "photo") ? photo : undefined} />
    <div className={styles.memberBody}>
      <p className={styles.kana}>{member.kana}</p>
      <h3 id={`member-${member.id}`}>{member.name}</h3>
      <dl className={styles.memberDetails}>{rows.map(row => <div key={row.field + row.label} data-field={row.field}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
    </div>
  </article>;
}

function ChapterHeading({ index }: { index: number }) {
  const chapter = chapters[index];
  return <h2 id={`${chapter.id}-heading`} className={styles.chapterHeading}><span>{chapter.number}</span>{chapter.title}</h2>;
}

export default function CompanyDocument({ members, photos = {}, presentation = false }: { members: Member[]; photos?: Record<string, string>; presentation?: boolean }) {
  const visible = visibleMembers(members);
  return <div className={styles.pageShell} data-company-document>
    <header className={presentation ? styles.presentationHeader : styles.header}>{!presentation && <p className={styles.eyebrow}>System ／ 資料</p>}<h1>{companyDocument.title}</h1></header>
    {!presentation && <div className={styles.presentationEntry}>
      <Link href="/system/docs/company/present" className={styles.presentationButton}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h18M5 4v12h14V4M12 16v5M8 21l4-3 4 3"/><path d="m10 8 5 3-5 3z"/></svg>
        オリエンテーション表示
      </Link>
    </div>}
    <div className={styles.hero}>
      <p className={styles.eyebrow}>{companyDocument.eyebrow}</p>
      <p className={styles.heroTitle}>{companyDocument.companyName}</p>
      <p className={styles.heroMessage}>{companyDocument.philosophy.title}</p>
      <p className={styles.updated}>最終更新日 <time dateTime={companyDocument.updatedAt}>{formatDocumentDate(companyDocument.updatedAt)}</time></p>
    </div>
    <div className={styles.readingLayout}>
      <nav className={styles.toc} aria-label="会社説明の目次">
        <p>目次</p><ol>{chapters.map(chapter => <li key={chapter.id}><a href={`#${chapter.id}`}><span>{chapter.number}</span>{chapter.title}</a></li>)}</ol>
      </nav>
      <div className={styles.content}>
        <section className={styles.welcome} aria-labelledby="welcome-heading"><h2 id="welcome-heading">はじめに</h2>{companyDocument.welcome.map(text => <p key={text}>{text}</p>)}</section>
        <section id="overview" aria-labelledby="overview-heading" className={styles.chapter}>
          <ChapterHeading index={0} />
          <dl className={styles.overview}>{getCompanyOverview().map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
          <div className={styles.philosophy}><p className={styles.eyebrow}>経営理念</p><h3>{companyDocument.philosophy.title}</h3>{companyDocument.philosophy.paragraphs.map(text => <p key={text}>{text}</p>)}</div>
          <h3>沿革</h3><ol className={styles.timeline}>{history.map(item => <li key={`${item.year}:${item.text}`}><strong>{item.year}</strong><p>{item.text}</p></li>)}</ol>
        </section>
        <section id="business" aria-labelledby="business-heading" className={styles.chapter}>
          <ChapterHeading index={1} /><div className={styles.stack}>{businesses.map((business, index) => <article className={styles.panel} key={business.title}>
            <p className={styles.eyebrow}>BUSINESS {String(index + 1).padStart(2, "0")}</p><h3>{business.title}</h3>
            {business.note && <p className={styles.sub}>{business.note}</p>}
            {business.items.map(item => <div key={item.text}>{"title" in item && <h4>{item.title}</h4>}<p>{item.text}</p></div>)}
          </article>)}</div>
        </section>
        <section id="organization" aria-labelledby="organization-heading" className={styles.chapter}>
          <ChapterHeading index={2} /><p>{organizationNote}</p>
          <OrganizationChart root={organization} />
          <h3>グループ会社</h3><div className={styles.groupGrid}>{groupCompanies.map(company => <article className={styles.panel} key={company.name} data-group-company>
            <h4>{company.name}</h4><dl className={styles.memberDetails}><div><dt>代表者</dt><dd>{company.representative}</dd></div><div><dt>設立</dt><dd>{company.established}</dd></div></dl>
          </article>)}</div>
        </section>
        <section id="strengths" aria-labelledby="strengths-heading" className={styles.chapter}>
          <ChapterHeading index={3} /><div className={styles.stack}>{strengths.map(strength => <article className={styles.panel} key={strength.title}>
            <h3>{strength.title}</h3><ol className={styles.numberedList}>{strength.items.map(item => <li key={item}>{item}</li>)}</ol>
          </article>)}</div>
        </section>
        <section id="results" aria-labelledby="results-heading" className={styles.chapter}>
          <ChapterHeading index={4} /><div className={styles.stack}>{results.map(result => <article className={styles.panel} key={result.title}>
            <h3>{result.title}</h3>{result.examples.map(example => <p key={example}>{example}</p>)}
          </article>)}</div>
        </section>
        <section id="members" aria-labelledby="members-heading" className={styles.chapter}>
          <ChapterHeading index={5} /><div className={styles.memberGrid}>{visible.map(member => <MemberCard key={member.id} member={member} photo={photos[member.id]} />)}</div>
        </section>
        <section className={styles.closing} aria-labelledby="closing-heading"><h2 id="closing-heading">さいごに</h2>{companyDocument.closing.map(text => <p key={text}>{text}</p>)}</section>
        <a className={styles.backToTop} href="#company-top">目次へ戻る ↑</a>
      </div>
    </div>
  </div>;
}
