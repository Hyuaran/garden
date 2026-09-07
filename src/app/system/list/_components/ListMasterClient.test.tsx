import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ListMasterClient } from "./ListMasterClient";

function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), { status }));
}

function installFetch() {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/soil/list/conditions") return json({ ok: true, conditions: [] });
    if (url === "/api/soil/list/exports") return json({ ok: true, exports: [] });
    if (url === "/api/soil/list/options") return json({ ok: true, options: {} });
    if (url === "/api/soil/list/call-sync" && init?.method === "POST") {
      return json({
        ok: true,
        result: { phones: 38335, callRows: 41200, syncedThrough: "2026-09-07" },
        state: { syncedThrough: "2026-09-07", lastRunAt: "2026-09-07T10:35:00Z", phones: 38335, callRows: 41200 },
      });
    }
    if (url === "/api/soil/list/call-sync") {
      return json({
        ok: true,
        canSync: true,
        state: { syncedThrough: "2026-09-07", lastRunAt: "2026-09-07T10:35:00Z", phones: 38335, callRows: 41200 },
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("ListMasterClient call sync status", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the sync state in the header", async () => {
    installFetch();
    render(<ListMasterClient />);
    expect(await screen.findByText(/コール履歴の反映：9\/7 まで/)).toBeInTheDocument();
    expect(screen.getByText(/最終反映 9\/7 19:35/)).toBeInTheDocument();
  });

  it("hides the sync button below manager", () => {
    installFetch();
    render(<ListMasterClient canSyncCalls={false} />);
    expect(screen.queryByRole("button", { name: "コール履歴を反映する" })).not.toBeInTheDocument();
  });

  it("updates the message after syncing calls", async () => {
    const fetchMock = installFetch();
    render(<ListMasterClient />);
    const button = await screen.findByRole("button", { name: "コール履歴を反映する" });
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByText("反映しました（対象 38,335 番号・9/7 まで）")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/soil/list/call-sync", { method: "POST" });
  });
});
