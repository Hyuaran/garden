import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { rosterLookupKey } from "./roster-lookup-key.server";

const reply = (records: unknown[]) => vi.fn(async () => Response.json({ records })) as unknown as typeof fetch;
beforeEach(() => {
  vi.stubEnv("KINTONE_SUBDOMAIN", "example");
  vi.stubEnv("KINTONE_EMPLOYEE_ROSTER_TOKEN", "token");
});
afterEach(() => vi.unstubAllEnvs());

it("名簿の KOTID が r923 の形ならその値で送る", async () => {
  const f = reply([{ 打刻ID: { value: "1564" }, 文字列__1行__5: { value: "r9231564" } }]);
  expect(await rosterLookupKey("1564", f)).toBe("r9231564");
  expect(String((f as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0])).toContain("app=56");
});
it("打刻ID の前後の空白は無視し、ほかの人の番号は拾わない", async () => {
  const f = reply([{ 打刻ID: { value: "11522" }, 文字列__1行__5: { value: "x" } }, { 打刻ID: { value: " 1522" }, 文字列__1行__5: { value: "r9231522" } }]);
  expect(await rosterLookupKey("1522", f)).toBe("r9231522");
});
it("KOTID が空・名簿に無い・読めないときは打刻ID のまま", async () => {
  expect(await rosterLookupKey("1574", reply([{ 打刻ID: { value: "1574" }, 文字列__1行__5: { value: "" } }]))).toBe("1574");
  expect(await rosterLookupKey("1574", reply([]))).toBe("1574");
  expect(await rosterLookupKey("1574", vi.fn(async () => { throw new Error("down"); }) as unknown as typeof fetch)).toBe("1574");
});
