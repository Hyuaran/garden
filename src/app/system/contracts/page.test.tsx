import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const pdfMocks = vi.hoisted(() => ({ extract: vi.fn() }));
vi.mock("./_lib/contract-pdf.client", () => ({ extractContractPdfPages: pdfMocks.extract }));
import ContractsPage from "./page";
pdfMocks.extract.mockResolvedValue(["契約書テキスト"]);
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); pdfMocks.extract.mockResolvedValue(["契約書テキスト"]); });
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

const emptyDraft = {
  counterparty: "", companyId: "", contractType: "", concludedOn: "", note: "",
  partyA: "", partyB: "", ownParty: null, ownPartyWarning: false, scanned: false,
};
function stubContractsApi(draft = { ...emptyDraft, counterparty: "A社", companyId: "COMP-001", contractType: "契約書", concludedOn: "2026-08-28" }) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "POST") return new Response(JSON.stringify({ ok: true, draft }), { status: 200 });
    if (String(input).includes("browse")) return new Response(JSON.stringify({ ok: true, entries: [] }), { status: 200 });
    return new Response(JSON.stringify({ ok: true, companies: [], rows: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
async function openRegisterTab() {
  fireEvent.click(await screen.findByRole("tab", { name: "契約書を登録する" }));
  return screen.getByRole("button", { name: "契約書PDFをアップロード" });
}

describe("contract PDF upload", () => {
  it("selects a dropped PDF and starts analysis", async () => {
    const fetchMock = stubContractsApi(); render(<ContractsPage />);
    const zone = await openRegisterTab(), pdf = new File(["%PDF"], "上位店契約.pdf", { type: "application/pdf" });
    fireEvent.drop(zone, { dataTransfer: { files: [pdf] } });
    expect(await screen.findByText("上位店契約.pdf")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/system/contracts", expect.objectContaining({ method: "POST" })));
  });

  it("rejects a non-PDF without selecting it", async () => {
    stubContractsApi(); render(<ContractsPage />); const zone = await openRegisterTab();
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["text"], "契約.txt", { type: "text/plain" })] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("PDFファイルを選んでください。");
    expect(screen.queryByText("契約.txt")).not.toBeInTheDocument();
  });

  it("rejects a PDF over 20MB", async () => {
    stubContractsApi(); render(<ContractsPage />); const zone = await openRegisterTab();
    const pdf = new File(["pdf"], "大容量.pdf", { type: "application/pdf" });
    Object.defineProperty(pdf, "size", { value: 20 * 1024 * 1024 + 1 });
    fireEvent.drop(zone, { dataTransfer: { files: [pdf] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("PDFは20MBまでです");
    expect(screen.queryByText("大容量.pdf")).not.toBeInTheDocument();
  });

  it("shows guidance beside every field that could not be read", async () => {
    stubContractsApi(emptyDraft); render(<ContractsPage />); const zone = await openRegisterTab();
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["pdf"], "scan.pdf", { type: "application/pdf" })] } });
    expect((await screen.findAllByText("読み取れませんでした。入力してください")).length).toBeGreaterThanOrEqual(4);
  });

  it("explains missing permission when the API returns 403", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 403 })));
    render(<ContractsPage />);
    expect((await screen.findAllByText("この画面を見る権限がありません。管理者へ連絡してください。")).length).toBeGreaterThan(0);
  });
  it("shows a useful error and clears Loading for a non-JSON analysis response", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return new Response("", { status: 500 });
      if (String(input).includes("browse")) return new Response(JSON.stringify({ ok: true, entries: [] }), { status: 200 });
      return new Response(JSON.stringify({ ok: true, companies: [], rows: [] }), { status: 200 });
    }));
    render(<ContractsPage />); const zone = await openRegisterTab();
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["broken"], "broken.pdf", { type: "application/pdf" })] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("この契約書を読み取れませんでした。ファイルが壊れていないか確認してください。");
    expect(screen.queryByText("契約書を読み取っています…")).not.toBeInTheDocument();
  });
});
