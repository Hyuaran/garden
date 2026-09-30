import rawCorporateSitesData from "../_data/corporate-sites.json";

export type CorporateSiteStatus =
  | "live"
  | "pending_migration"
  | "restored_pending_migration"
  | "pending_migration_and_new"
  | "planned_new";

export type CorporateSiteOldServer = {
  plan?: string;
  contract?: string;
  yen_per_year?: number;
  action?: string;
  onamae_id?: string;
};

export type CorporateSite = {
  company_id?: string;
  public_slug?: string;
  company: string;
  kind: string;
  product?: string;
  domain?: string | null;
  url?: string;
  status: CorporateSiteStatus;
  live_since?: string;
  stack?: string;
  github?: string;
  vercel_project?: string;
  kintone_app?: number;
  kintone_app_name?: string;
  source?: string;
  chatwork_to?: string[];
  /** 通知先の Chatwork ルーム（会社HPの問い合わせルームと別のときに入れる。例：採用ページ） */
  chatwork_room?: string;
  chatwork_sender?: string;
  mail?: string;
  old_server?: CorporateSiteOldServer;
  notes?: string[];
  highlight?: string;
};

export type CorporateGoogleMapStatus = "registered" | "unclaimed" | "unregistered";

export type CorporateGoogleMap = {
  company: string;
  status: CorporateGoogleMapStatus;
  url?: string;
  map_name?: string;
  map_address?: string;
  map_phone?: string;
  map_website?: string;
  map_category?: string;
  owner_claimed?: boolean;
  checked_on: string;
  notes?: string[];
};

export type CorporateSitesData = {
  as_of: string;
  common: {
    hosting: string;
    dns_policy: string;
    form: string;
  };
  sites: CorporateSite[];
  google_maps?: CorporateGoogleMap[];
  excluded: string[];
};

export type CorporateSiteStatusTone = "active" | "pending" | "upcoming";

export type CorporateSiteStatusLabel = {
  label: string;
  tone: CorporateSiteStatusTone;
};

export const CORPORATE_SITES_DATA = rawCorporateSitesData as CorporateSitesData;

const STATUS_LABELS: Record<CorporateSiteStatus, CorporateSiteStatusLabel> = {
  live: { label: "稼働", tone: "active" },
  pending_migration: { label: "移管待ち", tone: "pending" },
  restored_pending_migration: { label: "移管待ち（原サーバーで稼働中）", tone: "pending" },
  pending_migration_and_new: { label: "新規作成待ち（商品ページは移管）", tone: "upcoming" },
  planned_new: { label: "新規作成待ち", tone: "upcoming" },
};

function siteKindRank(site: CorporateSite) {
  if (site.kind === "会社HP" || site.kind === "会社HP+商品") return 0;
  // 採用ページは会社HPのすぐ後（2026-09-30 ヒュアラン採用ページ）
  if (site.kind === "採用ページ") return 1;
  return 2;
}

export function groupSitesByCompany(data: CorporateSitesData) {
  const groups: { company: string; sites: CorporateSite[] }[] = [];
  const groupIndex = new Map<string, { company: string; sites: CorporateSite[] }>();

  data.sites.forEach((site) => {
    let group = groupIndex.get(site.company);
    if (!group) {
      group = { company: site.company, sites: [] };
      groupIndex.set(site.company, group);
      groups.push(group);
    }
    group.sites.push(site);
  });

  return groups.map((group) => ({
    company: group.company,
    sites: [...group.sites].sort((left, right) => siteKindRank(left) - siteKindRank(right)),
  }));
}

export function statusLabel(status: CorporateSiteStatus): CorporateSiteStatusLabel {
  return STATUS_LABELS[status];
}

export function countByStatus(data: CorporateSitesData) {
  return data.sites.reduce(
    (counts, site) => {
      const tone = statusLabel(site.status).tone;
      if (tone === "active") counts.live += 1;
      if (tone === "pending") counts.pending += 1;
      if (tone === "upcoming") counts.planned += 1;
      return counts;
    },
    { live: 0, pending: 0, planned: 0 },
  );
}

export function googleMapByCompany(data: CorporateSitesData) {
  return new Map((data.google_maps ?? []).map((map) => [map.company, map]));
}

/** 1 社ぶんの並び：会社HP → Googleマップ → 採用ページ・LP など（2026-09-30 東海林さん指定）。会社HP が無い会社は Googleマップを先頭に */
export function orderCompanyCards(sites: CorporateSite[], googleMap?: CorporateGoogleMap): (CorporateSite | CorporateGoogleMap)[] {
  if (!googleMap) return sites;
  const companyHp = sites.filter((site) => siteKindRank(site) === 0);
  const others = sites.filter((site) => siteKindRank(site) !== 0);
  return [...companyHp, googleMap, ...others];
}

export function normalizeCompanyNameForComparison(value: string) {
  return value.normalize("NFKC").replace(/\s/g, "");
}

export function extractAddressBlockForComparison(value: string) {
  // 空白と「号」は区切り（|）として残す。消してしまうと「2-25 701」「2番25号701」の部屋番号が番地の数字にくっつく
  const normalized = value
    .normalize("NFKC")
    .replace(/〒\d{3}-?\d{4}/g, "")
    .replace(/丁目|番地|番/g, "-")
    .replace(/号|\s+/g, "|")
    .replace(/[−‐‑‒–—―ーｰ－]/g, "-")
    .replace(/-+/g, "-");
  return (normalized.match(/^.*?\d+(?:-\d+)+/)?.[0] ?? normalized).replace(/\|/g, "");
}

export function compareGoogleMapWithGarden(
  googleMap: Pick<CorporateGoogleMap, "map_name" | "map_address">,
  garden: { company_name?: string | null; address?: string | null },
) {
  const mapName = googleMap.map_name ?? "";
  const gardenName = garden.company_name ?? "";
  const mapAddress = googleMap.map_address ?? "";
  const gardenAddress = garden.address ?? "";

  return {
    companyNameMatches: normalizeCompanyNameForComparison(mapName) === normalizeCompanyNameForComparison(gardenName),
    addressMatches: extractAddressBlockForComparison(mapAddress) === extractAddressBlockForComparison(gardenAddress),
  };
}
