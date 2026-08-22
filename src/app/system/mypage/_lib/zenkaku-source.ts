import type { GardenCheckResult } from "./zenkaku-check";

export class ZenkakuCheckError extends Error {
  constructor(public readonly code: "not_found" | "unavailable") { super(code); }
}

export async function runZenkakuCheck(salesId: string, options: {
  fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>; maxAttempts?: number;
} = {}): Promise<GardenCheckResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const created = await fetchImpl("/api/system/zenkaku-check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ salesId }) });
  if (!created.ok) throw new ZenkakuCheckError("unavailable");
  const creation = await created.json() as { id?: string };
  if (!creation.id) throw new ZenkakuCheckError("unavailable");
  for (let attempt = 0; attempt < (options.maxAttempts ?? 30); attempt++) {
    await sleep(1_000);
    const response = await fetchImpl(`/api/system/zenkaku-check/${creation.id}`, { cache: "no-store" });
    if (!response.ok) throw new ZenkakuCheckError("unavailable");
    const state = await response.json() as { status?: string; result?: GardenCheckResult; error_code?: string };
    if (state.status === "done" && state.result) return state.result;
    if (state.status === "failed") throw new ZenkakuCheckError(state.error_code === "not_found" ? "not_found" : "unavailable");
  }
  throw new ZenkakuCheckError("unavailable");
}
