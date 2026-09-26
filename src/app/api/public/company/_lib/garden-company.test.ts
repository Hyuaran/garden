import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const code = readFileSync(resolve(process.cwd(), "public/garden-company.js"), "utf8");

declare global {
  interface Window {
    GardenCompany: { refresh: () => Promise<unknown> };
  }
}

function loadScript() {
  const script = document.createElement("script");
  script.setAttribute("data-company", "hyuaran");
  script.setAttribute("data-endpoint", "https://example.test/company/");
  document.head.appendChild(script);
  window.eval(code);
}

function okFetch(data: unknown) {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({
    ok: true,
    headers: { get: () => "application/json; charset=utf-8" },
    json: () => Promise.resolve(data),
  })));
}

describe("garden-company.js", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("replaces marked text and formats established_on", async () => {
    document.body.innerHTML = `
      <span data-garden="company_name">旧社名</span>
      <span data-garden="established_on" data-garden-format="ja">旧日付</span>
      <a data-garden="phone" href="tel:old">旧電話</a>
    `;
    okFetch({
      company_name: "株式会社ヒュアラン",
      established_on: "2016-04-08",
      phone: "06-4400-5414",
      news: [],
    });
    loadScript();
    await window.GardenCompany.refresh();

    expect(screenText("[data-garden='company_name']")).toBe("株式会社ヒュアラン");
    expect(screenText("[data-garden='established_on']")).toBe("2016年4月8日");
    expect(document.querySelector("a")?.getAttribute("href")).toBe("tel:0644005414");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("renders news from a template without treating body as HTML", async () => {
    document.body.innerHTML = `
      <div data-garden-news data-garden-news-limit="1">
        <template><article><time>{{published_on_ja}}</time><h3>{{title}}</h3><p>{{body}}</p></article></template>
        <p>古いお知らせ</p>
      </div>
    `;
    okFetch({
      news: [{ published_on: "2026-09-26", title: "お知らせ", body: "1行目\n<script>bad()</script>" }],
    });
    loadScript();
    await window.GardenCompany.refresh();

    expect(document.querySelector("[data-garden-news] time")?.textContent).toBe("2026年9月26日");
    expect(document.querySelector("[data-garden-news] h3")?.textContent).toBe("お知らせ");
    expect(document.querySelector("[data-garden-news] script")).toBeNull();
    expect(document.querySelector("[data-garden-news] p")?.textContent).toBe("1行目<script>bad()</script>");
  });


  it("prepends news before existing items in prepend mode, formats year-month and fires an event", async () => {
    document.body.innerHTML = `
      <div data-garden-news data-garden-news-limit="2" data-garden-news-mode="prepend">
        <template><div class="card"><span class="ym">{{published_on_ym}}</span><b>{{title}}</b></div></template>
        <div class="card old">既存 1</div>
        <div class="card old">既存 2</div>
      </div>
    `;
    okFetch({ news: [
      { published_on: "2026-09-26", title: "新 1", body: "" },
      { published_on: "2026-09-01", title: "新 2", body: "" },
      { published_on: "2026-08-01", title: "新 3", body: "" },
    ] });
    const handler = vi.fn();
    document.addEventListener("garden:news-updated", handler);
    loadScript();
    await window.GardenCompany.refresh();

    const cards = Array.from(document.querySelectorAll("[data-garden-news] .card")).map((el) => el.textContent);
    expect(cards).toEqual(["2026.09新 1", "2026.09新 2", "既存 1", "既存 2"]);
    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0][0] as CustomEvent).detail).toEqual({ count: 2 });

    // 2 回目の refresh では二重に足さない
    await window.GardenCompany.refresh();
    expect(document.querySelectorAll("[data-garden-news] .card")).toHaveLength(4);
  });

  it("keeps the existing DOM when fetch fails", async () => {
    document.body.innerHTML = `<span data-garden="company_name">旧社名</span>`;
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, headers: { get: () => "text/plain" } })));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    loadScript();
    await window.GardenCompany.refresh();

    expect(screenText("[data-garden='company_name']")).toBe("旧社名");
    expect(console.warn).toHaveBeenCalledTimes(1);
  });
});

function screenText(selector: string) {
  return document.querySelector(selector)?.textContent ?? "";
}
