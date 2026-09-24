"use client";

import { useState } from "react";
import { MenuIcon } from "@/app/system/_components/ShachoShell/ShachoShell";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import {
  countByStatus,
  groupSitesByCompany,
  statusLabel,
  type CorporateSite,
  type CorporateSitesData,
} from "./_lib/sites-registry";
import styles from "./sites.module.css";

const VIEW_MODE_KEY = "garden.sites.viewMode";
type ViewMode = "list" | "grid";

function ListViewIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><rect x="4" y="5" width="2" height="2" rx=".5"/><rect x="4" y="11" width="2" height="2" rx=".5"/><rect x="4" y="17" width="2" height="2" rx=".5"/></svg>;
}

function GridViewIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1.2"/><rect x="14" y="4" width="6" height="6" rx="1.2"/><rect x="4" y="14" width="6" height="6" rx="1.2"/><rect x="14" y="14" width="6" height="6" rx="1.2"/></svg>;
}

function readViewMode(): ViewMode {
  try {
    if (typeof window === "undefined") return "grid";
    return window.localStorage.getItem(VIEW_MODE_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

function storeViewMode(mode: ViewMode) {
  try {
    window.localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    // 保存できない環境でも、現在の画面では表示形式を切り替えられるようにする。
  }
}

function formatDate(value: string) {
  return value.replaceAll("-", "/");
}

function siteTitle(site: CorporateSite) {
  return [site.kind, site.product].filter(Boolean).join(" ");
}

function domainLabel(site: CorporateSite) {
  return site.domain ?? "ドメイン未定";
}

function statusMeta(site: CorporateSite) {
  return statusLabel(site.status);
}

function canOpen(site: CorporateSite) {
  return Boolean(site.url) && statusMeta(site).tone === "active";
}

function kintoneLabel(site: CorporateSite) {
  if (!site.kintone_app) return "";
  return `Kintone app${site.kintone_app}`;
}

function contactLabel(site: CorporateSite) {
  if (site.kintone_app) return `問い合わせ→${kintoneLabel(site)}`;
  return [site.stack, site.mail].filter(Boolean).join("・");
}

function toLabel(site: CorporateSite) {
  if (site.chatwork_to?.length) return `TO ${site.chatwork_to.join("・")}`;
  return site.notes?.[0] ?? "";
}

function oldServerLabel(site: CorporateSite) {
  const oldServer = site.old_server;
  if (!oldServer) return "";

  const head = [oldServer.plan, oldServer.contract].filter(Boolean).join(" ");
  const details = [
    oldServer.yen_per_year ? `年 ${oldServer.yen_per_year.toLocaleString("ja-JP")} 円` : "",
    oldServer.action ?? "",
    oldServer.onamae_id ? `別ID ${oldServer.onamae_id}` : "",
  ].filter(Boolean);

  if (!head) return details.join("／");
  return details.length > 0 ? `${head}（${details.join("／")}）` : head;
}

function DetailItem({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function StatusBadge({ site }: { site: CorporateSite }) {
  const status = statusMeta(site);
  return <span className={`${styles.statusBadge} ${styles[status.tone]}`}>{status.label}</span>;
}

function OpenAction({ site }: { site: CorporateSite }) {
  if (!canOpen(site)) return <span className={styles.unpublished}>未公開</span>;
  return <a href={site.url} target="_blank" rel="noopener noreferrer">開く</a>;
}

function SiteCard({ site }: { site: CorporateSite }) {
  return <article className={styles.formCard} data-testid="site-card">
    <div className={styles.cardHeading}>
      <span className={styles.iconPlate}><MenuIcon icon="folder" /></span>
      <h2>{siteTitle(site)}</h2>
    </div>
    <p className={styles.cardDescription}>
      <span>{domainLabel(site)}</span>
      {contactLabel(site) ? <span>{contactLabel(site)}</span> : null}
      {toLabel(site) ? <span>{toLabel(site)}</span> : null}
    </p>
    <details className={styles.wiring}>
      <summary>配線・契約の詳細</summary>
      <dl>
        <DetailItem label="GitHub" value={site.github ? `GitHub ${site.github}` : undefined} />
        <DetailItem label="Vercel" value={site.vercel_project} />
        <DetailItem label="流入元" value={site.source} />
        <DetailItem label="メール" value={site.mail} />
        <DetailItem label="旧サーバー" value={oldServerLabel(site)} />
        <DetailItem label="備考" value={site.notes?.join("・")} />
      </dl>
    </details>
    <div className={styles.cardFooter}>
      <span className={styles.footerMeta}><StatusBadge site={site} />{site.live_since ? <span>{site.live_since}〜</span> : null}</span>
      <OpenAction site={site} />
    </div>
  </article>;
}

function SiteTable({ data }: { data: CorporateSitesData }) {
  const rows = groupSitesByCompany(data).flatMap((group) => group.sites);

  return <div className={styles.tableWrap} data-testid="sites-list-view">
    <table>
      <thead>
        <tr><th>会社</th><th>サイト</th><th>ドメイン</th><th>状態</th><th>問い合わせ先</th><th></th></tr>
      </thead>
      <tbody>
        {rows.map((site) => <tr key={`${site.company}-${site.kind}-${site.product ?? site.domain ?? "domain"}`}>
          <td>{site.company}</td>
          <td>{siteTitle(site)}</td>
          <td>{domainLabel(site)}</td>
          <td><StatusBadge site={site} /></td>
          <td>{[kintoneLabel(site), toLabel(site)].filter(Boolean).join("・")}</td>
          <td>{canOpen(site) ? <a href={site.url} target="_blank" rel="noopener noreferrer">開く</a> : null}</td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}

export default function SitesHubClient({ data }: { data: CorporateSitesData }) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewMode());
  const groups = groupSitesByCompany(data);
  const counts = countByStatus(data);

  function changeViewMode(mode: ViewMode) {
    setViewMode(mode);
    storeViewMode(mode);
  }

  return <div className={styles.pageShell}>
    <header className={styles.header}>
      <SystemBreadcrumb items={[{ label: "コーポレートサイト" }]} />
      <h1>コーポレートサイト</h1>
      <p className={styles.lead}>グループ各社の会社HPと商品ページ。稼働中のサイトは［開く］で開けます。</p>
    </header>

    <div className={styles.listHeading}>
      <h2>サイトの一覧（稼働 {counts.live}／移管待ち {counts.pending}／新規作成待ち {counts.planned}）</h2>
      <div className={styles.headerAside}>
        <span>更新日 {formatDate(data.as_of)}</span>
        <div className={styles.viewToggle} role="group" aria-label="表示形式">
          <button type="button" aria-label="リスト表示にする" aria-pressed={viewMode === "list"} onClick={() => changeViewMode("list")}><ListViewIcon /></button>
          <button type="button" aria-label="グリッド表示にする" aria-pressed={viewMode === "grid"} onClick={() => changeViewMode("grid")}><GridViewIcon /></button>
        </div>
      </div>
    </div>

    <details className={styles.commonBox}>
      <summary>共通の仕組み（ホスティング・DNS・問い合わせの流れ）</summary>
      <dl>
        <div><dt>ホスティング</dt><dd>{data.common.hosting}</dd></div>
        <div><dt>DNS</dt><dd>{data.common.dns_policy}</dd></div>
        <div><dt>問い合わせ</dt><dd>{data.common.form}</dd></div>
      </dl>
    </details>

    {viewMode === "grid" ? (
      <div className={styles.groups} data-testid="sites-grid-view">
        {groups.map((group) => <section className={styles.companySection} key={group.company}>
          <h3>{group.company}</h3>
          <div className={styles.formGrid}>
            {group.sites.map((site) => <SiteCard site={site} key={`${site.company}-${site.kind}-${site.product ?? site.domain ?? "domain"}`} />)}
          </div>
        </section>)}
      </div>
    ) : <SiteTable data={data} />}

    <section className={styles.excluded} aria-label="対象外・解約">
      <h2>対象外・解約</h2>
      <ul>
        {data.excluded.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  </div>;
}
