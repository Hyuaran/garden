import { describe, it, expect } from "vitest";
import { buildEndRecord } from "../../records/end";

describe("buildEndRecord", () => {
  it("エンドレコードが 120 byte 固定長", () => {
    expect(buildEndRecord().length).toBe(120);
  });

  it("レコード種別が '9'（エンド）で始まる", () => {
    expect(buildEndRecord()[0]).toBe("9");
  });

  it("残りは空白埋め（119桁）", () => {
    expect(buildEndRecord().substring(1, 120)).toBe(" ".repeat(119));
  });
});
