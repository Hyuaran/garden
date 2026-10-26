import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { GARDEN_ROLE_ORDER, isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";
import { SPROUT_RILL_VIEW_SCOPES } from "./sprout-rill-view-scopes";
import { type ViewPermission, permissionEntry } from "./view-permission";
import { filterMailReadBoxes, isMailPageForBox } from "@/app/rill/mail/_lib/view-access";
import { boxesForRequest } from "@/app/rill/mail/_lib/mail-boxes";

const state = vi.hoisted(() => ({ role: "staff" as GardenRole, rows: [] as ViewPermission[], active: true, loggedIn: true, query: vi.fn(), list: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), cache: (fn: unknown) => fn }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: async () => ({
  auth: { getUser: async () => ({ data: { user: state.loggedIn ? { id: "USER" } : null } }) },
  from: (table: string) => {
    const result = () => ({ data: table === "system_view_permissions" ? state.rows : { employee_id: "EMP-1", name: "本人", garden_role: state.role, is_active: state.active, deleted_at: null, termination_date: null }, error: null });
    const query = { select: () => query, eq: () => query, is: () => query, maybeSingle: async () => result(), then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve) };
    return query;
  },
}) }));
vi.mock("@/lib/db/pg", () => ({ withPgClient: (fn: (client: unknown) => unknown) => fn({ query: state.query }), queryPg: (...args: unknown[]) => state.query(...args) }));
vi.mock("@/lib/sprout/import.server", () => ({ importRecruit: vi.fn() }));
vi.mock("@/lib/sprout/baitoru.server", () => ({ resendBaitoru: vi.fn() }));
vi.mock("@/app/rill/mail/_lib/graph", () => ({ listMessages: (...args: unknown[]) => state.list(...args) }));
import { canViewRecruitMail, requireRecruitMailRead, RecruitMailView } from "./sprout-rill-view.server";
import { requireRillRead, requireRillWrite } from "@/app/rill/mail/_lib/view-access.server";
import { loadSprout, loadApplicantDetail, sendToHire } from "@/app/sprout/actions";
import { loadBaitoru, createPosting } from "@/app/sprout/postings/baitoru-actions";
import { GET } from "@/app/api/rill/mail/messages/route";
import { NextRequest } from "next/server";
import { POST as sendMail } from "@/app/api/rill/mail/compose/send/route";

function setting(page: string, tab = "", roles: GardenRole[] = [], ids: string[] = []): ViewPermission {
  return { page_key: page, tab_key: tab, roles, employee_ids: ids, viewers_can_add: false, updated_by: "ADMIN", updated_at: "2026-10-27" };
}
beforeEach(() => {
  state.role = "staff"; state.rows = []; state.active = true; state.loggedIn = true;
  state.query.mockReset().mockResolvedValue({ rows: [] }); state.list.mockReset().mockResolvedValue({ messages: [], cursor: null });
});

describe("Sprout / Rill の画面・全タブ", () => {
  for (const scope of SPROUT_RILL_VIEW_SCOPES) it(`${scope.pageKey}/${scope.tabKey}: 8役職の既定・拡張・制限`, async () => {
    for (const role of GARDEN_ROLE_ORDER) {
      state.role = role; state.rows = [];
      const original = scope.pageKey.startsWith("sprout-") ? (scope.tabKey ? role === "super_admin" : isRoleAtLeast(role, "staff")) : isRoleAtLeast(role, "admin");
      expect(await canViewRecruitMail(scope.pageKey, scope.tabKey, !scope.tabKey)).toBe(original);
      expect(permissionEntry(scope.pageKey, scope.tabKey)?.allows(role)).toBe(original);
      state.rows = [setting(scope.pageKey, scope.tabKey, [role])];
      expect(await canViewRecruitMail(scope.pageKey, scope.tabKey)).toBe(true);
      state.rows = [setting(scope.pageKey, scope.tabKey, [], ["EMP-1"])];
      expect(await canViewRecruitMail(scope.pageKey, scope.tabKey)).toBe(true);
      state.rows = [setting(scope.pageKey, scope.tabKey)];
      expect(await canViewRecruitMail(scope.pageKey, scope.tabKey)).toBe(role === "super_admin");
    }
  });
  it("タブ→画面→既定と画面・サイドバーの拒否", async () => {
    state.rows = [setting("sprout-applicants"), setting("sprout-applicants", "training", [], ["EMP-1"])];
    expect(await canViewRecruitMail("sprout-applicants")).toBe(true);
    expect(await canViewRecruitMail("sprout-applicants", "applicants")).toBe(false);
    await expect(requireRecruitMailRead("sprout-applicants", "applicants")).rejects.toMatchObject({ status: 403 });
    state.rows = [setting("sprout-applicants")];
    expect(await canViewRecruitMail("sprout-applicants", undefined, true)).toBe(false);
    expect(await RecruitMailView({ page: "sprout-applicants", children: "データ", fallback: "準備中" })).toBe("準備中");
  });
  it("Sprout の従来の準備中画面・実データの違いを8役職で維持", async () => {
    for (const role of GARDEN_ROLE_ORDER) {
      state.role = role;
      expect(await canViewRecruitMail("sprout-applicants", undefined, true)).toBe(isRoleAtLeast(role, "staff"));
      expect(await canViewRecruitMail("sprout-applicants")).toBe(role === "super_admin");
      expect(await canViewRecruitMail("sprout-postings")).toBe(role === "super_admin");
    }
  });
  it("読み取りの拡張後も応募者送付・掲載の登録は広がらない", async () => {
    state.rows = [setting("sprout-applicants", "training", [], ["EMP-1"]), setting("sprout-postings", "baitoru", [], ["EMP-1"])];
    await loadSprout("training"); await loadBaitoru();
    expect(state.query).toHaveBeenCalled(); state.query.mockClear();
    expect((await sendToHire("42")).ok).toBe(false);
    await expect(createPosting("2026-11-01", "2026-11-02", "内容")).rejects.toThrow("閲覧権限");
    expect(state.query).not.toHaveBeenCalled();
  });
  it("拒否された読み取りは管理者接続を使う前に止める", async () => {
    await expect(loadSprout()).rejects.toMatchObject({ status: 403 });
    await expect(loadApplicantDetail("42")).rejects.toMatchObject({ status: 403 });
    await expect(loadBaitoru()).rejects.toMatchObject({ status: 403 });
    await expect(loadSprout("unknown")).rejects.toMatchObject({ status: 403 });
    state.rows = [setting("sprout-applicants", "", ["staff"]), ...["applicants", "interviews", "training"].map(tab => setting("sprout-applicants", tab))];
    await expect(loadSprout("")).rejects.toMatchObject({ status: 403 });
    expect(state.query).not.toHaveBeenCalled();
  });
  it("Rill API は403、拡張後も本人のクライアントで読む", async () => {
    expect((await GET(new NextRequest("https://test/api/rill/mail/messages?box=me"))).status).toBe(403);
    expect(state.list).not.toHaveBeenCalled();
    state.rows = [setting("rill-mail", "me", [], ["EMP-1"])];
    expect((await GET(new NextRequest("https://test/api/rill/mail/messages?box=me"))).status).toBe(200);
    expect(state.list).toHaveBeenCalledWith(expect.anything(), { id: "USER" }, "me", null, ["me"]);
    expect((await GET(new NextRequest("https://test/api/rill/mail/messages?box=all"))).status).toBe(403);
  });
  it("Rill は閲覧を広げても8役職の操作権限を広げない", async () => {
    state.rows = [setting("rill-mail", "", [], ["EMP-1"])];
    for (const role of GARDEN_ROLE_ORDER) {
      state.role = role;
      await expect(requireRillRead("me")).resolves.toMatchObject({user:{id:"USER"}});
      if (isRoleAtLeast(role, "admin")) await expect(requireRillWrite()).resolves.toMatchObject({user:{id:"USER"}});
      else await expect(requireRillWrite()).rejects.toMatchObject({status:403});
    }
  });
  it("閲覧で追加されても送信APIは内容を読む前に403", async () => {
    state.rows = [setting("rill-mail", "", [], ["EMP-1"])];
    const response = await sendMail(new Request("https://test/api/rill/mail/compose/send", {method:"POST",body:"invalid json"}));
    expect(response.status).toBe(403);
  });
  it("本人・共有・送信済みの権限は既存の箱の集合を絞るだけ", () => {
    const boxes = [{ id: "me", address: "own@test", kind: "personal" as const, label: "自分" }, { id: "shared@test", address: "shared@test", kind: "shared" as const, label: "共有" }];
    expect(filterMailReadBoxes(boxes, ["me"])).toEqual([boxes[0]]);
    expect(filterMailReadBoxes(boxesForRequest(boxes, "other@test"), ["me", "shared", "sent"])).toEqual([]);
    expect(filterMailReadBoxes(boxesForRequest(boxes, "sent"), ["shared"])).toEqual([]);
    expect(filterMailReadBoxes(boxesForRequest(boxes, "sent"), ["sent"])[0].address).toBe("own@test");
  });
  it("未ログイン・無効な従業員は拡張されない", async () => {
    state.rows = [setting("rill-mail", "me", [], ["EMP-1"])];
    state.active = false; await expect(requireRillRead("me")).rejects.toMatchObject({ status: 403 });
    state.active = true; state.loggedIn = false; await expect(requireRillRead("me")).rejects.toMatchObject({ status: 401 });
  });
  it("ページ送りに別の受信箱のURLを指定しても読めない", () => {
    const path = "/me/mailFolders/inbox/messages";
    expect(isMailPageForBox("https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$skiptoken=next", path)).toBe(true);
    expect(isMailPageForBox("https://graph.microsoft.com/v1.0/users/other@test/messages", path)).toBe(false);
    expect(isMailPageForBox("https://other.test/v1.0/me/mailFolders/inbox/messages", path)).toBe(false);
  });
  it("DB は閲覧者による追加を禁止し、書き込みやMicrosoftの権限を変更しない", () => {
    const sql = readFileSync("supabase/migrations/20261027000001_sprout_rill_view_scopes.sql", "utf8");
    expect(sql).toContain("sprout_rill_viewers_cannot_add"); expect(sql).toContain("viewers_can_add=false");
    expect(sql).not.toMatch(/grant |create policy|update public\.rill_mail_tokens/i);
    for (const scope of SPROUT_RILL_VIEW_SCOPES) expect(sql).toContain(`('${scope.pageKey}','${scope.tabKey}'`);
  });
});
