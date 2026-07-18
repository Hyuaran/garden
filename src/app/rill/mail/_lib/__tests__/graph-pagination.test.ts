import { describe, expect, it } from "vitest";
import { resolveBoxPageUrl } from "../graph";

describe("Rill Mail Graph cursor resolution", () => {
  it("treats null as exhausted", () => {
    expect(resolveBoxPageUrl({ me: null }, "me", "/me/initial")).toEqual({ exhausted: true, url: null });
  });

  it("restarts from page one when a mailbox key is absent", () => {
    expect(resolveBoxPageUrl({ me: "next-me" }, "shared", "/shared/initial")).toEqual({ exhausted: false, url: "/shared/initial" });
  });

  it("uses a stored nextLink when present", () => {
    expect(resolveBoxPageUrl({ me: "https://graph.microsoft.com/v1.0/next" }, "me", "/me/initial")).toEqual({ exhausted: false, url: "https://graph.microsoft.com/v1.0/next" });
  });
});
