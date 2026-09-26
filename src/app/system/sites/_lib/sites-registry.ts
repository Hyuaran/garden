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
  mail?: string;
  old_server?: CorporateSiteOldServer;
  notes?: string[];
  highlight?: string;
};

export type CorporateSitesData = {
  as_of: string;
  common: {
    hosting: string;
    dns_policy: string;
    form: string;
  };
  sites: CorporateSite[];
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
  return site.kind === "会社HP" || site.kind === "会社HP+商品" ? 0 : 1;
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
