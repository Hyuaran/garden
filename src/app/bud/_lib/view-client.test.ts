import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
const state = vi.hoisted(() => ({ user: null as unknown as SupabaseClient, allowWrite: false }));
vi.mock("@/app/_lib/supabase/browser", () => ({ createBrowserClient: () => state.user }));
import { createBudViewClient } from "./view-client";

beforeEach(() => {
  state.allowWrite = false;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.test"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon");
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/bud/view-write-access") return state.allowWrite ? new Response(null, { status: 204 }) : Response.json({ error: "操作する権限がありません" }, { status: 403 });
    if (url.startsWith("/api/bud/view-data")) return Response.json([{ transfer_id: "READ" }]);
    if (url.startsWith("/api/bud/view-receipt")) return Response.json({ data: { signedUrl: "signed-receipt" } });
    if (url === "/api/bud/expense-summary") return Response.json({ data: [{ total_count: 1 }] });
    return Response.json({ transfer_id: "WRITE" });
  }));
  const original = createClient("https://db.test", "test-anon", { accessToken: async () => "USER-TOKEN" });
  state.user = new Proxy(original, { get(target, property) {
    if (property === "auth") return { getSession: async () => ({ data: { session: { access_token: "USER-TOKEN" } } }) };
    const value = Reflect.get(target, property); return typeof value === "function" ? value.bind(target) : value;
  } });
});

describe("Bud のブラウザー接続", () => {
  it("select はスコープ付きAPIへ送り、ユーザートークンを転送しない", async () => {
    const client = createBudViewClient("bud-transfers", "approval");
    const result = await client.from("bud_transfers").select("transfer_id").eq("status", "承認待ち");
    expect(result.data).toEqual([{ transfer_id: "READ" }]);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    const target = new URL(String(url), "https://garden.test");
    expect(target.pathname).toBe("/api/bud/view-data"); expect(target.searchParams.get("tab")).toBe("approval");
    expect(new Headers(init?.headers).has("authorization")).toBe(false);
  });
  it.each(["insert", "update", "upsert", "delete"] as const)("閲覧拡張だけでは %s を実行しない", async operation => {
    const client = createBudViewClient("bud-transfers");
    const table = client.from("bud_transfers");
    const query = operation === "delete" ? table.delete() : operation === "insert" ? table.insert({ amount: 1 }) : operation === "upsert" ? table.upsert({ amount: 1 }) : table.update({ amount: 1 });
    const result = await query.select("transfer_id");
    expect(result.error?.code).toBe("42501");
    expect(vi.mocked(fetch).mock.calls.map(([input]) => String(input))).toEqual(["/api/bud/view-write-access"]);
  });
  it("従来の操作権限がある人の更新はユーザー接続のまま", async () => {
    state.allowWrite = true;
    const result = await createBudViewClient("bud-transfers").from("bud_transfers").update({ amount: 1 }).eq("transfer_id", "1").select().single();
    expect(result.error).toBeNull();
    const [, init] = vi.mocked(fetch).mock.calls[1];
    expect(init?.method).toBe("PATCH");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer USER-TOKEN");
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toContain("https://db.test/rest/v1/bud_transfers");
  });
  it("操作RPC・Storage更新も閲覧拡張では実行しない", async () => {
    const client = createBudViewClient("bud-expenses");
    expect((await client.rpc("bud_expense_restore", { p_ids: ["1"] })).error).toMatchObject({ code: "42501" });
    expect((await client.storage.from("bud-receipts").upload("path", "image")).error).toMatchObject({ code: "42501" });
    expect(vi.mocked(fetch).mock.calls).toHaveLength(2);
  });
  it("領収書と完了集計はそれぞれの閲覧APIで読む", async () => {
    const client = createBudViewClient("bud-expenses", "done");
    expect((await client.storage.from("bud-receipts").createSignedUrl("EMP-1/receipt.jpg", 600)).data?.signedUrl).toBe("signed-receipt");
    expect((await client.rpc("bud_expense_done_summary", {})).data).toEqual([{ total_count: 1 }]);
    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url))).toEqual(["/api/bud/view-receipt?path=EMP-1%2Freceipt.jpg", "/api/bud/expense-summary"]);
  });
});
