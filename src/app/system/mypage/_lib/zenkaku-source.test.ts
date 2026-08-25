import { describe, expect, it, vi } from "vitest";
import { runZenkakuCheck, ZenkakuCheckError } from "./zenkaku-source";
import type { GardenCheckResult } from "./zenkaku-check";

const result: GardenCheckResult = { blocking: [], notices: [], warnings: [], deferredRuleIds: ["R2-1","R2-2","R2-3","R2-4","R2-5"] };
const response = (body: unknown, status=200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("runZenkakuCheck", () => {
  it("creates a request and polls until done", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(response({ id:"00000000-0000-0000-0000-000000000001" },201)).mockResolvedValueOnce(response({status:"pending"})).mockResolvedValueOnce(response({status:"done",result}));
    await expect(runZenkakuCheck("L1", { fetchImpl, sleep:async()=>{}, maxAttempts:3 })).resolves.toEqual({...result,requestId:"00000000-0000-0000-0000-000000000001",duplicateCount:0});
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
  it("maps not-found and the 30-attempt timeout to safe errors", async () => {
    const notFound = vi.fn().mockResolvedValueOnce(response({id:"x"},201)).mockResolvedValueOnce(response({status:"failed",error_code:"not_found"}));
    await expect(runZenkakuCheck("L1", {fetchImpl:notFound,sleep:async()=>{}})).rejects.toMatchObject({code:"not_found"});
    const timeout = vi.fn().mockResolvedValueOnce(response({id:"x"},201)); for(let i=0;i<30;i++) timeout.mockResolvedValueOnce(response({status:"reading"}));
    await expect(runZenkakuCheck("L1", {fetchImpl:timeout,sleep:async()=>{}})).rejects.toEqual(new ZenkakuCheckError("unavailable"));
    expect(timeout).toHaveBeenCalledTimes(31);
  });
});
