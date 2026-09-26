import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));

function query(result: unknown) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    returns: vi.fn(() => Promise.resolve(result)),
  };
  return chain;
}

function adminMock(options?: { active?: boolean; news?: unknown[] }) {
  const company = query({
    data: {
      company_name: "株式会社ヒュアラン",
      representative: "後道 翔太",
      address: "大阪市",
      phone: "06-4400-5414",
      established_on: "2016-04-08",
      updated_at: "2026-09-26T01:00:00+09:00",
      is_active: options?.active ?? true,
    },
    error: null,
  });
  const news = query({
    data: options?.news ?? [
      { id: "n1", published_on: "2026-09-26", title: "本店移転のお知らせ", body: "本文" },
    ],
    error: null,
  });
  const from = vi.fn((table: string) => table === "root_companies" ? company : news);
  return { from, company, news };
}

describe("public company API", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.getSupabaseAdmin.mockReset();
  });

  it("returns only the public 8 keys for a known slug", async () => {
    const admin = adminMock();
    mocks.getSupabaseAdmin.mockReturnValue(admin);
    const { GET } = await import("../[slug]/route");

    const response = await GET(new Request("http://localhost/api/public/company/hyuaran"), {
      params: Promise.resolve({ slug: "hyuaran" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(body)).toEqual([
      "slug",
      "company_name",
      "representative",
      "address",
      "phone",
      "established_on",
      "updated_at",
      "news",
    ]);
    expect(body.news[0]).toEqual({ id: "n1", published_on: "2026-09-26", title: "本店移転のお知らせ", body: "本文" });
  });

  it("returns not_found for an unknown slug", async () => {
    const { GET } = await import("../[slug]/route");
    const response = await GET(new Request("http://localhost/api/public/company/missing"), {
      params: Promise.resolve({ slug: "missing" }),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false, error: "not_found" });
  });

  it("returns not_found for inactive companies", async () => {
    const admin = adminMock({ active: false });
    mocks.getSupabaseAdmin.mockReturnValue(admin);
    const { GET } = await import("../[slug]/route");
    const response = await GET(new Request("http://localhost/api/public/company/hyuaran"), {
      params: Promise.resolve({ slug: "hyuaran" }),
    });
    expect(response.status).toBe(404);
  });

  it("sets CORS, cache headers, OPTIONS, and news query limits", async () => {
    const admin = adminMock();
    mocks.getSupabaseAdmin.mockReturnValue(admin);
    const { GET, OPTIONS } = await import("../[slug]/route");

    const options = await OPTIONS();
    expect(options.status).toBe(204);
    expect(options.headers.get("Access-Control-Allow-Origin")).toBe("*");

    const response = await GET(new Request("http://localhost/api/public/company/hyuaran?nocache=1"), {
      params: Promise.resolve({ slug: "hyuaran" }),
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS");
    expect(admin.news.eq).toHaveBeenCalledWith("is_published", true);
    expect(admin.news.order).toHaveBeenNthCalledWith(1, "published_on", { ascending: false });
    expect(admin.news.order).toHaveBeenNthCalledWith(2, "created_at", { ascending: false });
    expect(admin.news.limit).toHaveBeenCalledWith(10);
  });
});
