import { describe, expect, it } from "vitest";
import { linkifyBodyText } from "../linkify";

const links = (value: string) => linkifyBodyText(value)
  .filter((segment) => segment.type === "link")
  .map((segment) => segment.href);

describe("Rill Mail body linkification", () => {
  it("detects URLs at line start, in sentences, and multiple URLs", () => {
    expect(links("https://first.example/a\n次は http://second.example/b です")).toEqual([
      "https://first.example/a",
      "http://second.example/b",
    ]);
  });

  it("keeps closing brackets and punctuation outside the URL", () => {
    expect(links("(https://example.com/a)。『https://example.net/b』!" )).toEqual([
      "https://example.com/a",
      "https://example.net/b",
    ]);
  });

  it("supports query strings and stops before directly adjacent Japanese", () => {
    expect(links("詳細はhttps://example.com/path?q=1&lang=jaをご覧ください")).toEqual([
      "https://example.com/path?q=1&lang=ja",
    ]);
  });

  it("does not link bare domains or other schemes", () => {
    expect(links("example.com / www.example.com / ftp://example.com")).toEqual([]);
  });

  it("preserves text exactly when there is no URL", () => {
    expect(linkifyBodyText("ただの本文です。\n二行目です")).toEqual([
      { type: "text", text: "ただの本文です。\n二行目です" },
    ]);
  });
});
