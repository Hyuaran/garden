import Link from "next/link";
import { MenuIcon } from "../_components/ShachoShell/ShachoShell";
import { companyDocument, formatDocumentDate } from "./_data/company-doc";
import { requireDocsUser } from "./_lib/company-doc.server";
import styles from "./docs.module.css";

export const metadata = { title: "資料 | Garden" };

// 資料追加時はこの一覧に1件追加する。
const documents = [{ ...companyDocument, href: "/system/docs/company" }];

export default async function DocsPage() {
  await requireDocsUser();
  return <div className={styles.pageShell}>
    <header className={styles.header}><p className={styles.eyebrow}>System</p><h1>資料</h1></header>
    <p className={styles.lead}>会社説明など、社内で読む資料をまとめています。</p>
    <div className={styles.documentGrid}>{documents.map(document => <Link className={styles.documentCard} href={document.href} key={document.href}>
      <span className={styles.bookBadge}><MenuIcon icon="book" /></span><h2>{document.title}</h2><p>{document.description}</p>
      <p className={styles.updated}>最終更新日 <time dateTime={document.updatedAt}>{formatDocumentDate(document.updatedAt)}</time></p><span className={styles.readLink}>資料を読む →</span>
    </Link>)}</div>
  </div>;
}
