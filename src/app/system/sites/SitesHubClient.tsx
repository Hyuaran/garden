"use client";

import { useState } from "react";
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
    if (typeof window === "undefined") return "list";
    return window.localStorage.getItem(VIEW_MODE_KEY) === "grid" ? "grid" : "list";
  } catch {
    return "list";
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

function StatusBadge({ site }: { site: CorporateSite }) {
  const status = statusLabel(site.status);
  return <span className={`${styles.statusBadge} ${styles[status.tone]}`}>{status.label}</span>;
}

function SiteLink({ site }: { site: CorporateSite }) {
  if (!site.url) return <span className={styles.domainText}>{domainLabel(site)}</span>;
  return <a className={styles.siteLink} href={site.url} target="_blank" rel="noopener noreferrer">{domainLabel(site)} ↗</a>;
}

function kintoneLabel(site: CorporateSite) {
  if (!site.kintone_app) return "";
  return [`app${site.kintone_app}`, site.kintone_app_name].filter(Boolean).join(" ");
}

function oldServerLabel(site: CorporateSite) {
  const oldServer = site.old_server;
  if (!oldServer) return "";

  const head = ["旧サーバー", oldServer.plan, oldServer.contract].filter(Boolean).join(" ");
  const details = [
    oldServer.yen_per_year ? `年 ${oldServer.yen_per_year.toLocaleString("ja-JP")} 円` : "",
    oldServer.action ? `＝${oldServer.action}` : "",
    oldServer.onamae_id ? `別ID ${oldServer.onamae_id}` : "",
  ].filter(Boolean);

  return details.length > 0 ? `${head}（${details.join("／")}）` : head;
}

function joinDetails(items: Array<string | undefined>) {
  return items.filter(Boolean).join(" ／ ");
}

function SecondaryLine({ site }: { site: CorporateSite }) {
  const text = joinDetails([
    site.github ? `GitHub ${site.github}` : undefined,
    site.vercel_project ? `Vercel ${site.vercel_project}` : undefined,
    site.source ? `流入元 ${site.source}` : undefined,
    site.chatwork_to?.length ? `TO ${site.chatwork_to.join("・")}` : undefined,
  ]);
  if (!text) return null;
  return <p className={styles.subLine}>{text}</p>;
}

function TertiaryLine({ site }: { site: CorporateSite }) {
  const text = joinDetails([
    oldServerLabel(site) || undefined,
    site.notes?.length ? `備考：${site.notes.join("・")}` : undefined,
  ]);
  if (!text) return null;
  return <p className={styles.subLine}>{text}</p>;
}

function ListSiteRow({ site }: { site: CorporateSite }) {
  return <article className={styles.siteRow}>
    <div className={styles.primaryLine}>
      <strong className={styles.siteKind}>{siteTitle(site)}</strong>
      <SiteLink site={site} />
      <StatusBadge site={site} />
      {site.live_since ? <span>{site.live_since}〜</span> : null}
      {site.mail ? <span>{site.mail}</span> : null}
      {kintoneLabel(site) ? <span>{kintoneLabel(site)}</span> : null}
    </div>
    <SecondaryLine site={site} />
    <TertiaryLine site={site} />
  </article>;
}

function CardDetail({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function SiteCard({ site }: { site: CorporateSite }) {
  return <article className={styles.siteCard}>
    <div className={styles.cardHeading}>
      <h3>{siteTitle(site)}</h3>
      <StatusBadge site={site} />
    </div>
    <div className={styles.cardMeta}>
      <SiteLink site={site} />
      {site.live_since ? <span>{site.live_since}〜</span> : null}
      {site.mail ? <span>{site.mail}</span> : null}
    </div>
    <dl className={styles.cardDetails}>
      <CardDetail label="Kintone" value={kintoneLabel(site)} />
      <CardDetail label="GitHub" value={joinDetails([
        site.github ? `GitHub ${site.github}` : undefined,
        site.vercel_project ? `Vercel ${site.vercel_project}` : undefined,
      ])} />
      <CardDetail label="TO" value={site.chatwork_to?.join("・")} />
      <CardDetail label="旧サーバー" value={oldServerLabel(site)} />
      <CardDetail label="備考" value={site.notes?.join("・")} />
    </dl>
  </article>;
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
      <div>
        <SystemBreadcrumb items={[{ label: "コーポレートサイト" }]} />
        <h1>コーポレートサイト</h1>
        <p className={styles.lead}>グループ各社の会社HPと商品ページ。稼働中のサイトは URL から開けます。</p>
      </div>
      <div className={styles.headerAside}>
        <span>更新日：{formatDate(data.as_of)}</span>
        <div className={styles.viewToggle} role="group" aria-label="表示形式">
          <button type="button" aria-label="一覧表示にする" aria-pressed={viewMode === "list"} onClick={() => changeViewMode("list")}><ListViewIcon /></button>
          <button type="button" aria-label="カード表示にする" aria-pressed={viewMode === "grid"} onClick={() => changeViewMode("grid")}><GridViewIcon /></button>
        </div>
      </div>
    </header>

    <details className={styles.commonBox}>
      <summary>共通の仕組み（ホスティング・DNS・問い合わせの流れ）</summary>
      <dl>
        <div><dt>ホスティング</dt><dd>{data.common.hosting}</dd></div>
        <div><dt>DNS</dt><dd>{data.common.dns_policy}</dd></div>
        <div><dt>問い合わせ</dt><dd>{data.common.form}</dd></div>
      </dl>
    </details>

    <div className={styles.countStrip}>
      <span>稼働 {counts.live}</span>
      <span>移管待ち {counts.pending}</span>
      <span>新規作成待ち {counts.planned}</span>
    </div>

    <div className={styles.groups} data-testid={viewMode === "grid" ? "sites-grid-view" : "sites-list-view"}>
      {groups.map((group) => <section className={styles.companySection} key={group.company}>
        <h2>{group.company}</h2>
        {viewMode === "grid" ? (
          <div className={styles.siteGrid}>
            {group.sites.map((site) => <SiteCard site={site} key={`${site.company}-${site.kind}-${site.product ?? site.domain ?? "domain"}`} />)}
          </div>
        ) : (
          <div className={styles.siteList}>
            {group.sites.map((site) => <ListSiteRow site={site} key={`${site.company}-${site.kind}-${site.product ?? site.domain ?? "domain"}`} />)}
          </div>
        )}
      </section>)}
    </div>

    <section className={styles.excluded} aria-label="対象外・解約">
      <h2>対象外・解約</h2>
      <ul>
        {data.excluded.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  </div>;
}
