import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SitesHubClient from "./SitesHubClient";
import { CORPORATE_SITES_DATA, type CorporateSitesData } from "./_lib/sites-registry";

const data: CorporateSitesData = {
  as_of: "2026-09-26",
  common: { hosting: "Vercel", dns_policy: "DNS", form: "Form" },
  sites: [
    {
      company_id: "COMP-001",
      public_slug: "hyuaran",
      company: "株式会社ヒュアラン",
      kind: "会社HP",
      domain: "hyuaran.com",
      status: "live",
      url: "https://hyuaran.com/",
    },
    {
      company_id: "COMP-002",
      public_slug: "centerrise",
      company: "株式会社センターライズ",
      kind: "会社HP",
      domain: "centerrise.co.jp",
      status: "live",
      url: "https://centerrise.co.jp/",
    },
  ],
  excluded: [],
  google_maps: [
    {
      company: "株式会社ヒュアラン",
      status: "registered",
      url: "https://www.google.com/maps?cid=12172809656869944469",
      map_name: "株式会社ヒュアラン",
      map_address: "〒541-0054 大阪府大阪市中央区南本町２丁目６−１２ サンマリオンタワー 2階",
      map_phone: "06-4400-5414",
      map_website: "hyuaran.com",
      map_category: "企業のオフィス",
      owner_claimed: true,
      checked_on: "2026-09-30",
      notes: ["クチコミ 3 件"],
    },
    {
      company: "株式会社センターライズ",
      status: "unregistered",
      checked_on: "2026-09-30",
      notes: ["社名＋住所・代表電話のどちらで探しても見つからない"],
    },
  ],
};

function mockFetch(overrides: Record<string, unknown> = {}) {
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/public/company/")) {
      const slug = url.split("/").pop() ?? "";
      const body = overrides[slug] ?? (
        slug === "hyuaran"
          ? { company_name: "株式会社ヒュアラン", address: "〒541-0054 大阪府大阪市中央区南本町2-6-12　サンマリオンタワー地上2階西号室" }
          : { company_name: "株式会社センターライズ", address: "大阪府大阪市中央区" }
      );
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    }
    const news = url.includes("COMP-001")
      ? [{ id: "n1", company_id: "COMP-001", published_on: "2026-09-26", title: "本店移転のお知らせ", body: "", kind: "auto", source_field: "address", is_published: true, created_at: "1", updated_at: "1" }]
      : [];
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, news }) });
  }));
}

describe("SitesHubClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/system/sites");
    window.localStorage.clear();
    mockFetch();
  });

  it("shows 申込→ and the separate inquiry app for a product LP whose main app receives applications", () => {
    const ichiData: CorporateSitesData = {
      ...data,
      sites: [
        {
          company: "株式会社壱",
          kind: "会社HP",
          domain: "ichi-one.com",
          url: "https://ichi-one.com/company",
          status: "live",
          kintone_app: 246,
          kintone_app_name: "壱問い合わせ受付",
        },
        {
          company: "株式会社壱",
          kind: "商品LP",
          product: "Ichi光",
          domain: "ichi-one.com",
          url: "https://ichi-one.com/",
          status: "live",
          kintone_app: 247,
          kintone_app_name: "Ichi光申込受付（問い合わせは app248 Ichi光問い合わせ受付）",
        },
      ],
    };
    render(<SitesHubClient data={ichiData} role="manager" />);
    const cards = screen.getAllByTestId("site-card");
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText("問い合わせ→Kintone app246")).toBeInTheDocument();
    expect(within(cards[0]).getByRole("link", { name: "開く" })).toHaveAttribute("href", "https://ichi-one.com/company");
    expect(within(cards[1]).getByText("申込→Kintone app247／問い合わせ→app248")).toBeInTheDocument();
    expect(within(cards[1]).getByText("Ichi光申込受付（問い合わせは app248 Ichi光問い合わせ受付）")).toBeInTheDocument();
    expect(within(cards[1]).getByRole("link", { name: "開く" })).toHaveAttribute("href", "https://ichi-one.com/");
  });

  it("shows the recruit page with its own badge, 応募→Kintone and the separate notice room", () => {
    const recruitData: CorporateSitesData = {
      ...data,
      sites: [
        data.sites[0],
        {
          company: "株式会社ヒュアラン",
          kind: "採用ページ",
          domain: "hyuaran.com",
          url: "https://hyuaran.com/saiyou",
          status: "live",
          live_since: "2026-09-30",
          kintone_app: 250,
          chatwork_room: "448119702（【採用】NHK業務_インオーダー様）",
          chatwork_sender: "東海林美琴（本人トークン）",
          chatwork_to: ["金亜奈"],
          notes: ["応募通知はコーポレートサイト問合せルームとは別"],
        },
      ],
    };
    render(<SitesHubClient data={recruitData} role="manager" />);
    const card = screen.getAllByTestId("site-card").find((element) => element.textContent?.includes("採用ページ"));
    expect(card).toBeDefined();
    const scope = within(card as HTMLElement);
    expect(scope.getAllByText("採用ページ").length).toBeGreaterThan(0);
    expect(scope.getByText("応募→Kintone app250")).toBeInTheDocument();
    expect(scope.getByText("448119702（【採用】NHK業務_インオーダー様）")).toBeInTheDocument();
    expect(scope.getByText("東海林美琴（本人トークン）")).toBeInTheDocument();
    expect(scope.getByRole("link", { name: "開く" })).toHaveAttribute("href", "https://hyuaran.com/saiyou");
  });

  it("switches to the news tab and lists selected company news", async () => {
    render(<SitesHubClient data={data} role="manager" />);
    fireEvent.click(screen.getByRole("tab", { name: "お知らせ" }));

    expect(screen.getByTestId("site-news-panel")).toBeInTheDocument();
    expect(await screen.findByText("本店移転のお知らせ")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("会社"), { target: { value: "COMP-002" } });
    await waitFor(() => expect(screen.getByText("お知らせはありません")).toBeInTheDocument());
  });

  it("hides edit buttons for non-managers", async () => {
    render(<SitesHubClient data={data} role="staff" />);
    fireEvent.click(screen.getByRole("tab", { name: "お知らせ" }));
    await screen.findByText("本店移転のお知らせ");

    expect(screen.queryByRole("button", { name: "+ 追加" })).toBeNull();
    expect(screen.queryByRole("button", { name: "編集" })).toBeNull();
  });

  it("shows news summary beside company headings on the sites tab", async () => {
    render(<SitesHubClient data={data} role="manager" />);
    const heading = await screen.findByRole("heading", { name: /株式会社ヒュアラン/ });
    expect(within(heading).getByText("お知らせ 1 件（最新：本店移転のお知らせ 2026-09-26）")).toBeInTheDocument();
  });

  it("shows a registered Google Maps card with map details, checked date and open link", async () => {
    render(<SitesHubClient data={data} role="manager" />);
    const card = screen.getAllByTestId("google-map-card").find((element) => element.textContent?.includes("株式会社ヒュアラン"));
    expect(card).toBeDefined();

    const scope = within(card as HTMLElement);
    expect(scope.getByRole("heading", { name: "Googleマップ" })).toBeInTheDocument();
    expect(scope.getAllByText("Googleマップ").length).toBeGreaterThan(0);
    expect(scope.getByText("株式会社ヒュアラン")).toBeInTheDocument();
    expect(scope.getByText("〒541-0054 大阪府大阪市中央区南本町２丁目６−１２ サンマリオンタワー 2階")).toBeInTheDocument();
    expect(scope.getByText("06-4400-5414")).toBeInTheDocument();
    expect(scope.getByText("登録済み")).toBeInTheDocument();
    expect(scope.getByText("確認 2026-09-30")).toBeInTheDocument();
    expect(scope.getByRole("link", { name: "開く" })).toHaveAttribute("href", "https://www.google.com/maps?cid=12172809656869944469");
    await waitFor(() => expect(scope.getByText(/Garden の登録：株式会社ヒュアラン/)).toBeInTheDocument());
    expect(screen.queryByText("住所（番地まで）が Garden の組織台帳と違います")).toBeNull();
  });

  it("shows an unregistered Google Maps card without an open link", () => {
    render(<SitesHubClient data={data} role="manager" />);
    const card = screen.getAllByTestId("google-map-card").find((element) => element.textContent?.includes("Google マップに登録がありません"));
    expect(card).toBeDefined();

    const scope = within(card as HTMLElement);
    expect(scope.getByText("Google マップに登録がありません")).toBeInTheDocument();
    expect(scope.getByText("未登録")).toBeInTheDocument();
    expect(scope.queryByRole("link", { name: "開く" })).toBeNull();
  });

  it("shows the unclaimed Google Maps status", () => {
    const unclaimedData: CorporateSitesData = {
      ...data,
      google_maps: [{
        company: "株式会社ヒュアラン",
        status: "unclaimed",
        url: "https://www.google.com/maps?cid=1",
        map_name: "株式会社ヒュアラン",
        map_address: "〒541-0054 大阪府大阪市中央区南本町２丁目６−１２",
        checked_on: "2026-09-30",
        owner_claimed: false,
      }],
    };
    render(<SitesHubClient data={unclaimedData} role="manager" />);
    expect(screen.getByText("オーナー未確認")).toBeInTheDocument();
  });

  it("highlights a Google Maps address mismatch against the Garden registry", async () => {
    mockFetch({ hyuaran: { company_name: "株式会社ヒュアラン", address: "〒541-0054 大阪府大阪市浪速区湊町1-4-38" } });
    render(<SitesHubClient data={data} role="manager" />);

    expect(await screen.findByText("住所（番地まで）が Garden の組織台帳と違います")).toBeInTheDocument();
  });

  it("renders when google_maps is missing and keeps the site status counts unchanged", () => {
    const noMapData = { ...data, google_maps: undefined };
    render(<SitesHubClient data={noMapData} role="manager" />);

    expect(screen.queryByTestId("google-map-card")).toBeNull();
    expect(screen.getByRole("heading", { name: "サイトの一覧（稼働 2／移管待ち 0／新規作成待ち 0）" })).toBeInTheDocument();
  });

  it("does not count Google Maps entries in the real data status heading", () => {
    render(<SitesHubClient data={CORPORATE_SITES_DATA} role="manager" />);

    expect(screen.getByRole("heading", { name: "サイトの一覧（稼働 12／移管待ち 3／新規作成待ち 0）" })).toBeInTheDocument();
  });
});
