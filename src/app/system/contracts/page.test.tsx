import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import styles from "./contracts.module.css";
const pdfMocks = vi.hoisted(() => ({ extract: vi.fn() }));
vi.mock("./_lib/contract-pdf.client", () => ({ extractContractPdfPages: pdfMocks.extract }));
import ContractsPage from "./page";
pdfMocks.extract.mockResolvedValue(["契約書テキスト"]);
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); pdfMocks.extract.mockResolvedValue(["契約書テキスト"]); });
beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/system/contracts");
});
describe("contracts drive browser", () => {
  it("opens a folder from the browse tab through the Drive API", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes("browse")) return new Response(JSON.stringify({ ok: true, companies: [], rows: [] }), { status: 200 });
      if (url.includes("folderId=folder-1")) return new Response(JSON.stringify({ ok: true, entries: [{ id: "pdf-1", name: "契約書.pdf", mimeType: "application/pdf", webViewLink: "https://drive.example/pdf", modifiedTime: null }] }), { status: 200 });
      return new Response(JSON.stringify({ ok: true, entries: [{ id: "folder-1", name: "01_契約書　上位店", mimeType: "application/vnd.google-apps.folder", webViewLink: null, modifiedTime: null }] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock); render(<ContractsPage />);
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByText("System ／ 契約書管理")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "契約書管理" })).toBeInTheDocument();
    const folder = await screen.findByRole("button", { name: /01_契約書/ });
    expect(folder).not.toHaveTextContent("📁");
    expect(folder.querySelector("svg")).toHaveClass(styles.driveIcon);
    fireEvent.click(folder);
    expect(window.location.pathname + window.location.search).toBe("/system/contracts?f=folder-1");
    const fileName = await screen.findByText("契約書.pdf");
    const file = screen.getByRole("link", { name: "開く" });
    expect(file).toHaveAttribute("href", "https://drive.example/pdf");
    expect(fileName.parentElement).not.toHaveTextContent("📄");
    expect(fileName.parentElement?.querySelector("svg")).toHaveClass(styles.driveIcon);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("folderId=folder-1")));
  });

  it("defaults to list view and switches to the existing grid view", async () => {
    const entries = [
      { id: "folder-1", name: "01_契約書　上位店", mimeType: "application/vnd.google-apps.folder", webViewLink: null, modifiedTime: null },
      { id: "pdf-1", name: "250715_金銭消費貸借契約書(ARATA⇔ASH).pdf", mimeType: "application/pdf", webViewLink: "https://drive.example/pdf", modifiedTime: null },
    ];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify(String(input).includes("browse") ? { ok: true, entries } : { ok: true, companies: [], rows: [] }), { status: 200 })));
    render(<ContractsPage />);
    expect(await screen.findByTestId("contract-list-view")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "リスト表示にする" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("250715_金銭消費貸借契約書(ARATA⇔ASH).pdf")).toHaveClass(styles.listName);
    expect(screen.getByRole("link", { name: "開く" })).toHaveAttribute("href", "https://drive.example/pdf");

    fireEvent.click(screen.getByRole("button", { name: "グリッド表示にする" }));
    expect(screen.getByTestId("contract-grid-view")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "グリッド表示にする" })).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("garden.contracts.viewMode")).toBe("grid");
  });

  it("shows registration actions only for PDFs in list and grid views", async () => {
    const entries = [
      { id: "folder-1", name: "上位店フォルダ", mimeType: "application/vnd.google-apps.folder", webViewLink: null, modifiedTime: null },
      { id: "pdf-new", name: "未登録.pdf", mimeType: "application/pdf", webViewLink: "https://drive.example/new", modifiedTime: null },
      { id: "pdf-done", name: "登録済み.pdf", mimeType: "application/pdf", webViewLink: "https://drive.example/done", modifiedTime: null },
      { id: "docx-1", name: "ひな形.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", webViewLink: "https://drive.example/docx", modifiedTime: null },
    ];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify(
      String(input).includes("browse")
        ? { ok: true, entries }
        : { ok: true, companies: [], rows: [{ id: "C1", drive_file_id: "pdf-done" }] },
    ), { status: 200 })));
    render(<ContractsPage />);

    const list = await screen.findByTestId("contract-list-view");
    await waitFor(() => expect(within(list).getByRole("button", { name: "登録する" })).toBeEnabled());
    expect(within(list).getByRole("button", { name: "登録済み" })).toBeDisabled();
    expect(screen.getByText("ひな形.docx").parentElement).not.toHaveTextContent("登録する");
    expect(screen.getByRole("button", { name: "上位店フォルダ" })).not.toHaveTextContent("登録する");

    fireEvent.click(screen.getByRole("button", { name: "グリッド表示にする" }));
    const grid = screen.getByTestId("contract-grid-view");
    expect(within(grid).getByRole("button", { name: "登録する" })).toBeEnabled();
    expect(within(grid).getByRole("button", { name: "登録済み" })).toBeDisabled();
    expect(screen.getByText("ひな形.docx").closest("div")).not.toHaveTextContent("登録する");
  });

  it("reads a Drive PDF and opens the existing editable confirmation form", async () => {
    const draft = { ...emptyDraft, counterparty: "セントリックス株式会社", companyId: "COMP-001", contractType: "獲得業務委託契約書", concludedOn: "2026-08-30" };
    const company = { company_id: "COMP-001", company_name: "株式会社ヒュアラン", representative: "代表者", address: "大阪府" };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        const action = String((init.body as FormData).get("action"));
        if (action === "read-drive-file") return new Response("%PDF", { status: 200, headers: { "Content-Type": "application/pdf" } });
        return new Response(JSON.stringify({ ok: true, draft }), { status: 200 });
      }
      if (String(input).includes("browse")) return new Response(JSON.stringify({ ok: true, entries: [
        { id: "centrix-pdf", name: "【セントリックス株式会社】獲得業務委託契約書.pdf", mimeType: "application/pdf", webViewLink: "https://drive.example/centrix", modifiedTime: null },
      ] }), { status: 200 });
      return new Response(JSON.stringify({ ok: true, companies: [company], rows: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ContractsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "登録する" }));
    expect(await screen.findByLabelText("相手先")).toHaveValue("セントリックス株式会社");
    expect(screen.getByLabelText("自社法人")).toHaveValue("COMP-001");
    expect(screen.getByLabelText("契約種別")).toHaveValue("獲得業務委託契約書");
    expect(screen.getByLabelText("締結日")).toHaveValue("2026-08-30");
    expect(pdfMocks.extract).toHaveBeenCalledWith(expect.objectContaining({ name: "【セントリックス株式会社】獲得業務委託契約書.pdf" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/system/contracts", expect.objectContaining({ method: "POST" }));
  });

  it("restores a saved grid view and persists a switch back to list", async () => {
    localStorage.setItem("garden.contracts.viewMode", "grid");
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify(String(input).includes("browse") ? { ok: true, entries: [] } : { ok: true, companies: [], rows: [] }), { status: 200 })));
    render(<ContractsPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "グリッド表示にする" })).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByTestId("contract-grid-view")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "リスト表示にする" }));
    expect(screen.getByTestId("contract-list-view")).toBeInTheDocument();
    expect(localStorage.getItem("garden.contracts.viewMode")).toBe("list");
  });

  it("restores a direct folder URL and its breadcrumbs", async () => {
    window.history.replaceState(null, "", "/system/contracts?f=ash");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (!String(input).includes("browse"))
        return new Response(JSON.stringify({ ok: true, companies: [], rows: [] }), { status: 200 });
      return new Response(JSON.stringify({
        ok: true,
        entries: [{ id: "pdf-1", name: "契約書.pdf", mimeType: "application/pdf", webViewLink: "https://drive.example/pdf", modifiedTime: null }],
        breadcrumbs: [
          { id: null, name: "契約書" },
          { id: "top", name: "01_契約書　上位店" },
          { id: "ash", name: "ASH株式会社_ART" },
        ],
      }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ContractsPage />);

    expect(await screen.findByText("契約書.pdf")).toBeInTheDocument();
    const breadcrumbs = screen.getByRole("navigation", { name: "現在のフォルダ" });
    expect(breadcrumbs).toContainElement(screen.getByRole("button", { name: /^契約書$/ }));
    expect(breadcrumbs).toContainElement(screen.getByRole("button", { name: /^01_契約書　上位店$/ }));
    expect(breadcrumbs).toContainElement(screen.getByRole("button", { name: /^ASH株式会社_ART$/ }));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("folderId=ash"));
  });

  it("restores the folder represented by browser history", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes("browse")) return new Response(JSON.stringify({ ok: true, companies: [], rows: [] }), { status: 200 });
      if (url.includes("folderId=top")) return new Response(JSON.stringify({
        ok: true,
        entries: [{ id: "ash", name: "ASH株式会社_ART", mimeType: "application/vnd.google-apps.folder", webViewLink: null, modifiedTime: null }],
        breadcrumbs: [{ id: null, name: "契約書" }, { id: "top", name: "01_契約書　上位店" }],
      }), { status: 200 });
      return new Response(JSON.stringify({ ok: true, entries: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ContractsPage />);
    await screen.findByTestId("contract-list-view");

    await act(async () => {
      window.history.replaceState(null, "", "/system/contracts?f=top");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(await screen.findByRole("button", { name: "ASH株式会社_ART" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^01_契約書　上位店$/ })).toBeInTheDocument();
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
