import { afterEach, describe, expect, it } from "vitest";

import { verifyBearerRequest, verifyCronRequest } from "./cron-auth";

const request = (token?: string) => new Request("http://localhost/test", {
  headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
});

describe("Bearer request authentication", () => {
  afterEach(() => {
    delete process.env.CALL_INGEST_SECRET;
    delete process.env.CRON_SECRET;
  });

  it("fails closed when the selected secret is not configured", () => {
    expect(verifyBearerRequest(request("secret"), "CALL_INGEST_SECRET")).toEqual({
      ok: false, status: 500, reason: "CALL_INGEST_SECRET is not configured",
    });
  });

  it("rejects missing and mismatched tokens", () => {
    process.env.CALL_INGEST_SECRET = "expected-secret";
    expect(verifyBearerRequest(request(), "CALL_INGEST_SECRET")).toMatchObject({ ok: false, status: 401 });
    expect(verifyBearerRequest(request("wrong"), "CALL_INGEST_SECRET")).toMatchObject({ ok: false, status: 401 });
  });

  it("accepts the dedicated ingest secret", () => {
    process.env.CALL_INGEST_SECRET = "expected-secret";
    expect(verifyBearerRequest(request("expected-secret"), "CALL_INGEST_SECRET")).toEqual({ ok: true });
  });

  it("keeps verifyCronRequest compatible with CRON_SECRET", () => {
    process.env.CRON_SECRET = "cron-secret";
    expect(verifyCronRequest(request("cron-secret"))).toEqual({ ok: true });
  });
});
