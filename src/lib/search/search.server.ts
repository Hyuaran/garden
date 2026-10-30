import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { readViewPermissions, viewPermissionContext } from "@/lib/auth/view-permission.server";
import { resolveCanView } from "@/lib/auth/view-permission";
import { SYSTEM_MANUALS, manualDocPermissionKey } from "@/app/system/manuals/_lib/manuals-registry";
import { ROOT_VIEW_SCOPES } from "@/lib/auth/root-view-scopes";
import { SYSTEM_VIEW_SCOPES } from "@/lib/auth/system-view-scopes";
import { BUD_VIEW_SCOPES, BUD_DEFAULT_ROLES } from "@/lib/auth/bud-view-scopes";
import { SPROUT_RILL_VIEW_SCOPES } from "@/lib/auth/sprout-rill-view-scopes";
import { BLOOM_TREE_PAGES, BLOOM_TREE_VIEW_SCOPES } from "@/lib/auth/bloom-tree-view-scopes";
import { LEAF_FOREST_PAGES, LEAF_FOREST_VIEW_SCOPES } from "@/lib/auth/leaf-forest-view-scopes";
import { SYSTEM_FORMS } from "@/app/system/forms/_lib/forms-registry";
import { MY_TABS } from "@/app/my/tabs";
import { SYSTEM_MENU_ITEMS } from "@/app/system/_components/ShachoShell/shacho-shell-config";
import { PERMISSION_ENTRIES } from "@/lib/auth/permission-registry";
import { isRoleAtLeast } from "@/app/root/_constants/types";
import { visibleAccounts } from "@/lib/bud/mf/balances";
import type { MfAccount, GroupViewers } from "@/lib/bud/mf/types";
import { SEARCH_SOURCES, type SearchSource } from "./catalog";
import { limitHits, normalizeSearch, searchRank, type SearchGroup, type SearchHit } from "./match";

const scopes = [...ROOT_VIEW_SCOPES, ...SYSTEM_VIEW_SCOPES, ...BUD_VIEW_SCOPES, ...SPROUT_RILL_VIEW_SCOPES, ...BLOOM_TREE_VIEW_SCOPES, ...LEAF_FOREST_VIEW_SCOPES];
const paths = new Map<string, string>([...BLOOM_TREE_PAGES, ...LEAF_FOREST_PAGES].map(([key, href]) => [key, href]));
function pagePath(page: string) { return paths.get(page) ?? (page === "bud-journal" ? "/bud/shiwakechou" : `/${page.replace("-", "/")}`.replace(/\/home$/, "")); }
export function resultHref(source: SearchSource, row: Record<string, unknown>, query: string) {
  let path = source.href;
  if (source.table === "bloom_monthly_digests") path = `/bloom/monthly-digest/${String(row.digest_month).slice(0, 7)}`;
  if (source.table === "shinkouki") path = `/forest/shinkouki/${encodeURIComponent(String(row.company_id))}`;
  const params = new URLSearchParams({ q: query });
  if (source.table === "soil_list_internal_block") params.set("includeReleased", "true");
  if (source.tab) params.set("tab", source.tab);
  if (["root_employees", "root_employee_team_history", "root_employee_profile_history"].includes(source.table)) params.set("employeeId", String(row.employee_id));
  return `${path}?${params}`;
}
function printable(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(printable).join(" / ");
  if (typeof value === "object") return Object.values(value).map(printable).join(" / ");
  return String(value);
}
export function rowHit(source: SearchSource, row: Record<string, unknown>, query: string): SearchHit | null {
  const matches = source.fields.map(field => ({ ...field, value: printable(row[field.column]), rank: searchRank(printable(row[field.column]), query, field.phone) })).filter(field => field.value && field.rank >= 0).sort((a, b) => a.rank - b.rank);
  const match = matches[0];
  if (!match) return null;
  const normalized = normalizeSearch(match.value, match.phone), offset = normalized.indexOf(normalizeSearch(query, match.phone));
  const start = Math.max(0, offset - 45);
  let title = printable(row[source.title]) || `${source.label} ${row[source.pk]}`;
  if (source.table === "root_employees") title = `${row.name}（${row.employee_number ?? row.employee_id}）`;
  if (source.table === "system_hire_candidates") title = `${row.last_name} ${row.first_name}`;
  if (source.table === "bud_expense_requests") title = `${row.receipt_date ?? ""} ${row.store_name ?? "経費"} ${Number(row.amount ?? 0).toLocaleString("ja-JP")} 円`;
  const suffix = source.table === "bud_mf_axis_order" ? `:${row.axis}` : source.table === "system_line_tag_member" ? `:${row.tag_id}` : "";
  return { id: `${source.table}:${row[source.pk]}${suffix}`, title, label: match.label, value: match.value.slice(start, start + 180), phone: match.phone, module: source.module, href: resultHref(source, row, query), rank: match.rank, updated: printable(row.updated_at ?? row.created_at ?? row[source.date]) };
}
export async function gardenSearch(query: string, expanded: Set<string>): Promise<SearchGroup[]> {
  const context = await viewPermissionContext();
  // Route handlers do not share React's render cache. Read permissions exactly once per request.
  const [permissions, budAccess] = await Promise.all([readViewPermissions(), context.db.rpc("bud_has_access")]);
  const hasBud = !budAccess.error && budAccess.data === true;
  const allowed = async (page: string, tab = "", fallback?: boolean): Promise<boolean> => {
    if (page === "system-line") return context.viewer.role === "super_admin";
    if (page === "bud-bank") return hasBud;
    if (page === "bud-broadband") return context.viewer.role === "super_admin";
    const tabs = !tab ? scopes.filter(scope => scope.pageKey === page && scope.tabKey) : [];
    if (tabs.length) return (await Promise.all(tabs.map(scope => allowed(page, scope.tabKey)))).some(Boolean);
    let defaults = fallback;
    if (page.startsWith("bud-")) defaults = hasBud && BUD_DEFAULT_ROLES.includes(context.viewer.role) && !(tab === "deleted" && context.viewer.role !== "super_admin");
    if (page.startsWith("sprout-")) defaults = context.viewer.role === "super_admin";
    if (page.startsWith("rill-")) defaults = isRoleAtLeast(context.viewer.role, "admin");
    return resolveCanView(permissions, page, tab, context.viewer, defaults);
  };
  const pools = new Map<string, { key: string; label: string; hits: SearchHit[] }>();
  const add = (key: string, label: string, hits: SearchHit[], kind = key) => {
    if (!hits.length) return;
    const pool = pools.get(kind);
    if (pool) pool.hits.push(...hits); else pools.set(kind, { key, label, hits });
  };
  const screens = await Promise.all(scopes.map(async scope => {
    const path = pagePath(scope.pageKey);
    if (path.includes("[") || !await allowed(scope.pageKey, scope.tabKey)) return null;
    const parent = scopes.find(item => item.pageKey === scope.pageKey && !item.tabKey);
    const title = scope.tabKey ? `${parent?.label} ＞ ${scope.label}` : scope.label;
    const rank = searchRank(title, query);
    if (rank < 0) return null;
    return { id: `${scope.pageKey}:${scope.tabKey}`, title, label: "画面", value: title, module: scope.pageKey.split("-")[0], href: `${path}${scope.tabKey ? `?tab=${encodeURIComponent(scope.tabKey)}` : ""}`, rank, updated: "" };
  }));
  const screenHits = screens.filter((hit): hit is SearchHit => hit !== null);
  for (const item of SYSTEM_MENU_ITEMS) {
    if (!item.href || item.upcoming || searchRank(item.label, query) < 0) continue;
    const entry = PERMISSION_ENTRIES.find(entry => entry.key === `system-menu-${item.href}`);
    const scope = scopes.find(scope => pagePath(scope.pageKey) === item.href && !scope.tabKey);
    if (scope ? !await allowed(scope.pageKey) : !entry?.allows(context.viewer.role)) continue;
    if (!screenHits.some(hit => hit.href === item.href)) screenHits.push({ id: `menu:${item.href}`, title: item.label, label: "画面", value: item.label, module: "System", href: item.href, rank: searchRank(item.label, query), updated: "" });
  }
  for (const tab of MY_TABS) {
    const page = ({profile:"system-mypage",attendance:"system-attendance",shift:"system-shift",zenkaku:"system-zenkaku",calls:"system-innovera-calls",report:"system-mypage",review:"system-mypage"})[tab.id];
    const title = `マイページ ＞ ${tab.label}`, rank = searchRank(title, query);
    if (rank >= 0 && await allowed(page)) screenHits.push({ id: `my:${tab.id}`, title, label: "画面", value: title, module: "My", href: `/my?tab=${tab.id}`, rank, updated: "" });
  }
  const bankTitle = "口座残高・カード利用";
  if (hasBud && searchRank(bankTitle, query) >= 0) screenHits.push({ id: "bud-bank", title: bankTitle, label: "画面", value: bankTitle, module: "Bud", href: "/bud/bank", rank: searchRank(bankTitle, query), updated: "" });
  const broadbandTitle = "損益管理 ＞ ブロードバンド収支";
  if (searchRank(broadbandTitle, query) >= 0) {
    const access = await context.db.rpc("bud_bb_can_view");
    if (!access.error && access.data === true) screenHits.push({ id: "bud-broadband", title: broadbandTitle, label: "画面", value: broadbandTitle, module: "Bud", href: "/bud/profit/broadband", rank: searchRank(broadbandTitle, query), updated: "" });
  }
  if (await allowed("system-onboarding")) {
    for (const [tab, title] of [["self", "自分の入社手続き"], ["candidates", "入社予定者"], ["confirmations", "入社後の確認"], ["all", "みんなの入社手続き"]]) {
      if (await allowed("system-onboarding", tab) && searchRank(title, query) >= 0) screenHits.push({ id: `onboarding:${tab}`, title: `入社手続き ＞ ${title}`, label: "画面", value: title, module: "System", href: `/system/onboarding?tab=${tab}`, rank: searchRank(title, query), updated: "" });
    }
  }
  if (await allowed("system-forms", "input")) for (const form of SYSTEM_FORMS) {
    const rank = searchRank(form.name, query);
    if (rank >= 0 && (!form.minRole || isRoleAtLeast(context.viewer.role, form.minRole))) screenHits.push({ id: `form:${form.slug}`, title: form.name, value: form.name, label: "画面", module: "System", href: `/system/forms/${form.slug}`, rank, updated: "" });
  }
  add("screens", "画面", screenHits);
  const manuals = await Promise.all(SYSTEM_MANUALS.map(async manual => ({ ...manual, docs: (await Promise.all(manual.docs.map(async doc => await allowed("system-manuals", manualDocPermissionKey(doc.key), isRoleAtLeast(context.viewer.role, doc.minRole)) ? doc : null))).filter(doc => doc !== null) })));
  add("manuals", "マニュアル", manuals.flatMap(manual => manual.docs.flatMap(doc => {
    const title = `${manual.name} ＞ ${doc.label}`, rank = searchRank(title, query);
    return rank < 0 ? [] : [{ id: `${manual.moduleSlug}:${manual.slug}:${doc.key}`, title, label: "題名", value: title, module: manual.moduleSlug, href: `/system/manuals/${manual.moduleSlug}/${manual.slug}?tab=${doc.key}`, rank, updated: "" }];
  })));
  const mfGroups = hasBud ? await context.db.from("bud_mf_group_viewers").select("kind,employee_ids") : { data: [], error: null };
  if (mfGroups.error) throw new Error("閲覧権限を確認できませんでした。");
  const dataGroups = await Promise.all(SEARCH_SOURCES.map(async source => {
    if (!await allowed(source.page, source.tab)) return null;
    if (source.client === "soil" && !resolveCanView(permissions, "soil-overview", "", context.viewer, isRoleAtLeast(context.viewer.role, "manager"))) return null;
    // Bud base access remains mandatory; per-row and per-status rules stay in the user's RLS.
    if (source.module === "Bud" && source.client !== "broadband" && !hasBud) return null;
    if (source.client === "broadband") { const access = await context.db.rpc("bud_bb_can_view"); if (access.error || access.data !== true) return null; }
    const admin = ["admin", "submitted", "own-user", "own-employee", "line", "soil"].includes(source.client);
    const db = admin ? getSupabaseAdmin() : context.db;
    const columns = [...new Set([source.pk, source.title, source.date, ...source.fields.map(field => field.select ?? field.column), ...(["root_employee_team_history", "root_employee_profile_history"].includes(source.table) ? ["employee_id"] : []), ...(source.table === "bud_mf_accounts" ? ["kind", "hidden", "visible_employee_ids", "sort_order"] : []), ...(source.table === "bud_mf_axis_order" ? ["axis"] : [])].filter(Boolean))].join(",");
    const hits: SearchHit[] = [];
    // Supabase defaults to 1000 rows. Page through all authorized rows, never truncate before matching.
    for (let offset = 0; ; offset += 1000) {
      let request = db.from(source.table).select(columns).order(source.pk).range(offset, offset + 999);
      if (source.table === "bud_mf_axis_order") request = request.order("axis");
      if (source.table === "system_line_tag_member") request = request.order("tag_id");
      if (source.client === "self") request = request.eq("employee_id", context.viewer.employeeId);
      if (source.client === "own-employee") request = request.eq("employee_id", context.viewer.employeeId);
      if (source.client === "own-user") request = request.eq("user_id", context.userId);
      if (source.client === "requested") request = request.eq("requested_by", context.userId);
      if (source.client === "submitted") request = request.eq("submitted_by", context.userId);
      if (source.table === "root_bank_accounts") request = request.is("deleted_at", null);
      if (source.table === "system_line_target") request = request.eq("active", true).in("account", ["dev", "official"]).in("target_type", ["group", "room"]);
      if (source.table === "system_hire_candidates") request = source.tab === "confirmations" ? request.eq("status", "hired") : request.in("status", ["planned", "hiring", "no_show"]);
      const { data, error } = await request;
      if (error) throw new Error(`検索対象を読み込めませんでした（${source.table}: ${error.message}）`);
      let rows = (data ?? []) as unknown as Record<string, unknown>[];
      if (source.table === "bud_mf_accounts") rows = visibleAccounts(rows as unknown as MfAccount[], context.viewer.employeeId, context.viewer.role === "super_admin", mfGroups.data as GroupViewers[]) as unknown as Record<string, unknown>[];
      for (const row of rows) { const hit = rowHit(source, row, query); if (hit) hits.push(hit); }
      if ((data ?? []).length < 1000) break;
    }
    return { source, hits };
  }));
  for (const group of dataGroups) if (group) add(group.source.key, group.source.label, group.hits, `${group.source.module}:${group.source.label}`);
  return [...pools.values()].map(pool => ({ key: pool.key, label: pool.label, ...limitHits([...new Map(pool.hits.map(hit => [hit.id, hit])).values()], expanded.has(pool.key) ? 20 : 5) }));
}
