import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ContractsPage from "./page";
afterEach(() => vi.unstubAllGlobals());
describe("contracts drive browser", () => {
  it("opens a folder from the browse tab through the Drive API", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes("browse")) return new Response(JSON.stringify({ ok: true, companies: [], rows: [] }), { status: 200 });
      if (url.includes("folderId=folder-1")) return new Response(JSON.stringify({ ok: true, entries: [{ id: "pdf-1", name: "契約書.pdf", mimeType: "application/pdf", webViewLink: "https://drive.example/pdf", modifiedTime: null }] }), { status: 200 });
      return new Response(JSON.stringify({ ok: true, entries: [{ id: "folder-1", name: "01_契約書　上位店", mimeType: "application/vnd.google-apps.folder", webViewLink: null, modifiedTime: null }] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock); render(<ContractsPage />);
    fireEvent.click(await screen.findByRole("button", { name: /01_契約書/ }));
    expect(await screen.findByRole("link", { name: /契約書.pdf/ })).toHaveAttribute("href", "https://drive.example/pdf");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("folderId=folder-1")));
  });
});
