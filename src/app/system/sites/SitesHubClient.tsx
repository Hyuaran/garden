"use client";

import { useEffect, useMemo, useState } from "react";
import type { GardenRole } from "@/app/root/_constants/types";
import { MenuIcon } from "@/app/system/_components/ShachoShell/ShachoShell";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import SiteNewsPanel, { companiesForNews, type SiteNewsItem } from "./_components/SiteNewsPanel";
import {
  compareGoogleMapWithGarden,
  countByStatus,
  googleMapByCompany,
  groupSitesByCompany,
  statusLabel,
  type CorporateGoogleMap,
  type CorporateSite,
  type CorporateSitesData,
} from "./_lib/sites-registry";
import styles from "./sites.module.css";

const VIEW_MODE_KEY = "garden.sites.viewMode";
type ViewMode = "list" | "grid";
type TopTab = "sites" | "news";
type NewsSummary = { count: number; latestTitle: string | null; latestDate: string | null };
type PublicCompany = { company_name?: string | null; address?: string | null };

function ListViewIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><rect x="4" y="5" width="2" height="2" rx=".5"/><rect x="4" y="11" width="2" height="2" rx=".5"/><rect x="4" y="17" width="2" height="2" rx=".5"/></svg>;
}

function GridViewIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1.2"/><rect x="14" y="4" width="6" height="6" rx="1.2"/><rect x="4" y="14" width="6" height="6" rx="1.2"/><rect x="14" y="14" width="6" height="6" rx="1.2"/></svg>;
}

function MapPinIcon() {
  return <svg className={styles.mapPinIcon} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.4"/></svg>;
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

function readTab(): TopTab {
  try {
    if (typeof window === "undefined") return "sites";
    return new URLSearchParams(window.location.search).get("tab") === "news" ? "news" : "sites";
  } catch {
    return "sites";
  }
}

function storeTab(tab: TopTab) {
  try {
    const url = new URL(window.location.href);
    if (tab === "news") url.searchParams.set("tab", "news");
    else url.searchParams.delete("tab");
    window.history.replaceState(null, "", url);
  } catch {
    // URL を更新できない環境でもタブ切替は継続する。
  }
}

function formatDate(value: string) {
  return value.replaceAll("-", "/");
}

function siteTitle(site: CorporateSite) {
  return [site.kind, site.product].filter(Boolean).join(" ");
}

type KindTone = "hp" | "recruit" | "product";

function kindChip(site: CorporateSite): { label: string; tone: KindTone } {
  if (site.kind === "会社HP") return { label: "会社HP", tone: "hp" };
  if (site.kind === "会社HP+商品") return { label: "会社HP＋商品", tone: "hp" };
  if (site.kind === "採用ページ") return { label: "採用ページ", tone: "recruit" };
  return { label: "商品ページ", tone: "product" };
}

const KIND_TONE_CLASS: Record<KindTone, string> = { hp: styles.kindHp, recruit: styles.kindRecruit, product: styles.kindProduct };

function KindChip({ site }: { site: CorporateSite }) {
  const chip = kindChip(site);
  return <span className={`${styles.kindChip} ${KIND_TONE_CLASS[chip.tone]}`}>{chip.label}</span>;
}

function MapKindChip() {
  return <span className={`${styles.kindChip} ${styles.kindMap}`}>Googleマップ</span>;
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
  if (site.kintone_app) {
    // 申込の受付アプリが主のサイト（例：Ichi光＝app247 申込／app248 問い合わせ）は「申込→」と書き、問い合わせ先を後ろに添える
    const name = site.kintone_app_name ?? "";
    const verb = site.kind === "採用ページ" ? "応募" : name.includes("申込受付") ? "申込" : "問い合わせ";
    const inquiryApp = verb === "申込" ? name.match(/問い合わせは\s*app(\d+)/)?.[1] : undefined;
    return `${verb}→${kintoneLabel(site)}${inquiryApp ? `／問い合わせ→app${inquiryApp}` : ""}`;
  }
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

function newsSummaryLabel(summary?: NewsSummary) {
  if (!summary || summary.count === 0) return "お知らせ なし";
  return `お知らせ ${summary.count} 件（最新：${summary.latestTitle} ${summary.latestDate}）`;
}

function StatusBadge({ site }: { site: CorporateSite }) {
  const status = statusMeta(site);
  return <span className={`${styles.statusBadge} ${styles[status.tone]}`}>{status.label}</span>;
}

function googleMapStatusLabel(map: CorporateGoogleMap) {
  if (map.status === "registered") return { label: "登録済み", tone: "active" };
  if (map.status === "unclaimed") return { label: "オーナー未確認", tone: "pending" };
  return { label: "未登録", tone: "unregistered" };
}

function GoogleMapStatusBadge({ map }: { map: CorporateGoogleMap }) {
  const status = googleMapStatusLabel(map);
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
      <KindChip site={site} />
    </div>
    <p className={styles.cardDescription}>
      <span>{domainLabel(site)}</span>
      {contactLabel(site) ? <span>{contactLabel(site)}</span> : null}
      {toLabel(site) ? <span>{toLabel(site)}</span> : null}
    </p>
    {site.highlight ? <p className={styles.highlight}>{site.highlight}</p> : null}
    <details className={styles.wiring}>
      <summary>配線・契約の詳細</summary>
      <dl>
        <DetailItem label="GitHub" value={site.github ? `GitHub ${site.github}` : undefined} />
        <DetailItem label="Vercel" value={site.vercel_project} />
        <DetailItem label="受付アプリ" value={site.kintone_app_name} />
        <DetailItem label="流入元" value={site.source} />
        <DetailItem label="通知ルーム" value={site.chatwork_room} />
        <DetailItem label="通知の送り手" value={site.chatwork_sender} />
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

function GoogleMapCard({ map, garden }: { map: CorporateGoogleMap; garden?: PublicCompany }) {
  const canCompare = map.status !== "unregistered" && garden;
  const comparison = canCompare ? compareGoogleMapWithGarden(map, garden) : null;
  const detailItems = [
    { label: "業種", value: map.map_category },
    { label: "ウェブサイト", value: map.map_website },
    { label: "オーナー確認", value: map.owner_claimed === undefined ? undefined : map.owner_claimed ? "済み" : "されていない" },
    { label: "備考", value: map.notes?.join("・") },
  ];

  return <article className={styles.formCard} data-testid="google-map-card">
    <div className={styles.cardHeading}>
      <span className={styles.iconPlate}><MapPinIcon /></span>
      <h2>Googleマップ</h2>
      <MapKindChip />
    </div>
    <p className={`${styles.cardDescription} ${styles.mapDescription}`}>
      {map.status === "unregistered" ? <span>Google マップに登録がありません</span> : <>
        {map.map_name ? <span>{map.map_name}</span> : null}
        {map.map_address ? <span>{map.map_address}</span> : null}
        {map.map_phone ? <span>{map.map_phone}</span> : null}
      </>}
    </p>
    {garden && map.status !== "unregistered" ? <p className={styles.gardenRegistry}>Garden の登録：{garden.company_name}／{garden.address}</p> : null}
    {comparison && !comparison.companyNameMatches ? <p className={styles.highlight}>社名が Garden の組織台帳と違います</p> : null}
    {comparison && !comparison.addressMatches ? <p className={styles.highlight}>住所（番地まで）が Garden の組織台帳と違います</p> : null}
    <details className={styles.wiring}>
      <summary>登録の詳細</summary>
      <dl>
        {detailItems.map((item) => <DetailItem key={item.label} label={item.label} value={item.value} />)}
      </dl>
    </details>
    <div className={styles.cardFooter}>
      <span className={styles.footerMeta}><GoogleMapStatusBadge map={map} /><span>確認 {map.checked_on}</span></span>
      {map.url ? <a href={map.url} target="_blank" rel="noopener noreferrer">開く</a> : null}
    </div>
  </article>;
}

function companySlug(group: { sites: CorporateSite[] }) {
  return group.sites.find((site) => site.public_slug)?.public_slug;
}

function SiteTable({ data }: { data: CorporateSitesData }) {
  const googleMaps = googleMapByCompany(data);
  const rows = groupSitesByCompany(data).flatMap((group) => {
    const map = googleMaps.get(group.company);
    return map ? [...group.sites, map] : group.sites;
  });

  return <div className={styles.tableWrap} data-testid="sites-list-view">
    <table>
      <thead>
        <tr><th>会社</th><th>サイト</th><th>ドメイン</th><th>状態</th><th>問い合わせ先</th><th></th></tr>
      </thead>
      <tbody>
        {rows.map((row) => "kind" in row ? <tr key={`${row.company}-${row.kind}-${row.product ?? row.domain ?? "domain"}`}>
          <td>{row.company}</td>
          <td><KindChip site={row} /> {siteTitle(row)}</td>
          <td>{domainLabel(row)}</td>
          <td><StatusBadge site={row} /></td>
          <td>{[kintoneLabel(row), toLabel(row)].filter(Boolean).join("・")}</td>
          <td>{canOpen(row) ? <a href={row.url} target="_blank" rel="noopener noreferrer">開く</a> : null}</td>
        </tr> : <tr key={`${row.company}-google-map`}>
          <td>{row.company}</td>
          <td><MapKindChip /> Googleマップ</td>
          <td>—</td>
          <td><GoogleMapStatusBadge map={row} /></td>
          <td>{row.map_address ?? "Google マップに登録がありません"}</td>
          <td>{row.url ? <a href={row.url} target="_blank" rel="noopener noreferrer">開く</a> : null}</td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}

export default function SitesHubClient({ data, role }: { data: CorporateSitesData; role: GardenRole }) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewMode());
  const [tab, setTab] = useState<TopTab>(() => readTab());
  const [summaries, setSummaries] = useState<Record<string, NewsSummary>>({});
  const [publicCompanies, setPublicCompanies] = useState<Record<string, PublicCompany>>({});
  const groups = useMemo(() => groupSitesByCompany(data), [data]);
  const googleMaps = useMemo(() => googleMapByCompany(data), [data]);
  const counts = countByStatus(data);
  const newsCompanies = useMemo(() => companiesForNews(data), [data]);
  const publicSlugs = useMemo(() => groups
    .filter((group) => {
      const map = googleMaps.get(group.company);
      return map?.status === "registered" || map?.status === "unclaimed";
    })
    .map((group) => companySlug(group))
    .filter((slug): slug is string => Boolean(slug)), [groups, googleMaps]);

  function changeViewMode(mode: ViewMode) {
    setViewMode(mode);
    storeViewMode(mode);
  }

  function changeTab(nextTab: TopTab) {
    setTab(nextTab);
    storeTab(nextTab);
  }

  useEffect(() => {
    let cancelled = false;
    async function loadSummaries() {
      const entries = await Promise.all(newsCompanies.map(async (company) => {
        try {
          const response = await fetch(`/api/system/sites/news?company_id=${encodeURIComponent(company.company_id)}`);
          const body = await response.json().catch(() => null) as { news?: SiteNewsItem[] } | null;
          const news = response.ok ? body?.news ?? [] : [];
          return [company.company_id, {
            count: news.length,
            latestTitle: news[0]?.title ?? null,
            latestDate: news[0]?.published_on ?? null,
          }] as const;
        } catch {
          return [company.company_id, { count: 0, latestTitle: null, latestDate: null }] as const;
        }
      }));
      if (!cancelled) setSummaries(Object.fromEntries(entries));
    }
    loadSummaries();
    return () => {
      cancelled = true;
    };
  }, [newsCompanies]);

  useEffect(() => {
    let cancelled = false;
    async function loadPublicCompanies() {
      const entries = await Promise.all(publicSlugs.map(async (slug) => {
        try {
          const response = await fetch(`/api/public/company/${encodeURIComponent(slug)}`);
          if (!response.ok) return null;
          const body = await response.json().catch(() => null) as PublicCompany | null;
          return body ? [slug, body] as const : null;
        } catch {
          return null;
        }
      }));
      if (!cancelled) setPublicCompanies(Object.fromEntries(entries.filter((entry): entry is readonly [string, PublicCompany] => Boolean(entry))));
    }
    loadPublicCompanies();
    return () => {
      cancelled = true;
    };
  }, [publicSlugs]);

  return <div className={styles.pageShell}>
    <header className={styles.header}>
      <SystemBreadcrumb items={[{ label: "コーポレートサイト" }]} />
      <h1>コーポレートサイト</h1>
      <p className={styles.lead}>グループ各社の会社HP・商品ページと、Google マップの登録状況。稼働中のサイトは［開く］で開けます。</p>
    </header>

    <div className={styles.topTabs} role="tablist" aria-label="コーポレートサイト表示">
      <button type="button" role="tab" aria-selected={tab === "sites"} onClick={() => changeTab("sites")}>サイト一覧</button>
      <button type="button" role="tab" aria-selected={tab === "news"} onClick={() => changeTab("news")}>お知らせ</button>
    </div>

    {tab === "news" ? <SiteNewsPanel data={data} role={role} /> : <>
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
          <h3><span>{group.company}</span><small>{newsSummaryLabel(summaries[group.sites.find((site) => site.company_id)?.company_id ?? ""])}</small></h3>
          <div className={styles.formGrid}>
            {group.sites.map((site) => <SiteCard site={site} key={`${site.company}-${site.kind}-${site.product ?? site.domain ?? "domain"}`} />)}
            {googleMaps.get(group.company) ? <GoogleMapCard
              map={googleMaps.get(group.company)!}
              garden={publicCompanies[companySlug(group) ?? ""]}
              key={`${group.company}-google-map`}
            /> : null}
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
    </>}
  </div>;
}
