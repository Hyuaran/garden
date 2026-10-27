import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ManualDetailClient from "./ManualDetailClient";
import { MANUAL_MODULES, SYSTEM_MANUALS, getVisibleManualDocs } from "./_lib/manuals-registry";

describe("ManualDetailClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders only visible tabs and the selected iframe", () => {
    const manual = SYSTEM_MANUALS[3];
    render(<ManualDetailClient module={MANUAL_MODULES[0]} manual={manual} docs={[manual.docs[0]]} selectedDoc={manual.docs[0]} />);

    expect(screen.getByRole("heading", { name: "勤怠打刻と KOT 取込" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "操作マニュアル", current: "page" })).toHaveAttribute("href", "/system/manuals/system/kot-attendance?tab=operation");
    expect(screen.queryByRole("link", { name: "要点" })).not.toBeInTheDocument();
    expect(screen.getByTitle("勤怠打刻と KOT 取込 操作マニュアル")).toHaveAttribute("src", "/api/system/manuals/system/kot-attendance/1_operation.html?embed=1");
    expect(screen.queryByRole("button", { name: "この資料を差し替える" })).not.toBeInTheDocument();
  });

  it("renders the no permission message without tabs", () => {
    render(<ManualDetailClient module={MANUAL_MODULES[0]} manual={SYSTEM_MANUALS[3]} docs={[]} />);

    expect(screen.getByText("この資料を読む権限がありません。")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "資料タブ" })).not.toBeInTheDocument();
  });

  it("renders markdown text fetched from the API", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve("# Claude 用") }));
    const manual = SYSTEM_MANUALS[3];
    render(<ManualDetailClient module={MANUAL_MODULES[0]} manual={manual} docs={[manual.docs[4]]} selectedDoc={manual.docs[4]} />);

    expect(await screen.findByRole("heading", { name: "Claude 用" })).toBeInTheDocument();
  });

  it("resets iframe height to 600px when the selected tab changes", async () => {
    const manual = SYSTEM_MANUALS[6];
    const docs = manual.docs.slice(1, 4);
    const { rerender } = render(<ManualDetailClient module={MANUAL_MODULES[0]} manual={manual} docs={docs} selectedDoc={manual.docs[2]} />);
    const iframe = screen.getByTitle(`${manual.name} ${manual.docs[2].label}`);

    window.dispatchEvent(new MessageEvent("message", { data: { __docHeight: 1234 } }));
    await waitFor(() => expect(iframe).toHaveStyle({ height: "1234px" }));

    rerender(<ManualDetailClient module={MANUAL_MODULES[0]} manual={manual} docs={docs} selectedDoc={manual.docs[3]} />);

    await waitFor(() => expect(screen.getByTitle(`${manual.name} ${manual.docs[3].label}`)).toHaveStyle({ height: "600px" }));
  });

  it("applies numeric iframe height messages from embedded HTML", async () => {
    const manual = SYSTEM_MANUALS[6];
    render(<ManualDetailClient module={MANUAL_MODULES[0]} manual={manual} docs={[manual.docs[2]]} selectedDoc={manual.docs[2]} />);
    const iframe = screen.getByTitle(`${manual.name} ${manual.docs[2].label}`);

    window.dispatchEvent(new MessageEvent("message", { data: { __docHeight: 1234 } }));

    await waitFor(() => expect(iframe).toHaveStyle({ height: "1234px" }));
  });

  it("measures iframe content height on load when the document is readable", async () => {
    const manual = SYSTEM_MANUALS[6];
    render(<ManualDetailClient module={MANUAL_MODULES[0]} manual={manual} docs={[manual.docs[2]]} selectedDoc={manual.docs[2]} />);
    const iframe = screen.getByTitle(`${manual.name} ${manual.docs[2].label}`) as HTMLIFrameElement;
    const frameDocument = document.implementation.createHTMLDocument("");
    Object.defineProperty(frameDocument.documentElement, "scrollHeight", { configurable: true, value: 2000 });
    Object.defineProperty(frameDocument.body, "scrollHeight", { configurable: true, value: 1200 });
    mockVisibleIframe(iframe);
    Object.defineProperty(iframe, "contentDocument", { configurable: true, value: frameDocument });

    fireEvent.load(iframe);

    await waitFor(() => expect(iframe).toHaveStyle({ height: "2000px" }));
  });

  it("keeps the default iframe height when contentDocument is not readable", () => {
    const manual = SYSTEM_MANUALS[6];
    render(<ManualDetailClient module={MANUAL_MODULES[0]} manual={manual} docs={[manual.docs[2]]} selectedDoc={manual.docs[2]} />);
    const iframe = screen.getByTitle(`${manual.name} ${manual.docs[2].label}`) as HTMLIFrameElement;
    mockVisibleIframe(iframe);
    Object.defineProperty(iframe, "contentDocument", { configurable: true, value: null });

    fireEvent.load(iframe);

    expect(iframe).toHaveStyle({ height: "600px" });
  });

  it("shows replace controls and version history only for super admins", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        current: { id: "C1", uploaded_at: "2026-09-13T12:30:00.000Z", uploaded_by: "東海林", size: 62087, storage_path: "system/kot-attendance/1_operation.html" },
        versions: [{ id: "O1", uploaded_at: "2026-09-07T13:50:00.000Z", uploaded_by: "東海林", size: 22446, storage_path: "system/kot-attendance/_versions/1_operation.html.20260913-213000" }],
      }),
    }));
    const manual = SYSTEM_MANUALS[3];

    render(<ManualDetailClient module={MANUAL_MODULES[0]} manual={manual} docs={[manual.docs[0]]} selectedDoc={manual.docs[0]} canManageVersions />);

    expect(screen.getByRole("button", { name: "この資料を差し替える" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "版の履歴（この資料）" })).toBeInTheDocument();
    expect(await screen.findByText("いま表示中")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "この版に戻す" })).toBeInTheDocument();
  });
});

function mockVisibleIframe(iframe: HTMLIFrameElement) {
  Object.defineProperty(iframe, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      bottom: 100,
      height: 100,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
}

it("shows the onboarding flow immediately after operation for staff", () => {
  const manual = SYSTEM_MANUALS.find(manual => manual.slug === "onboarding")!;
  const docs = getVisibleManualDocs(manual, "staff");
  render(<ManualDetailClient module={MANUAL_MODULES[0]} manual={manual} docs={docs} selectedDoc={docs[1]} />);
  expect(screen.getAllByRole("link").filter(link => link.getAttribute("href")?.includes("?tab=")).map(link => link.textContent)).toEqual(["操作マニュアル", "応募から入社までの流れ"]);
  expect(screen.getByTitle("入社手続き 応募から入社までの流れ")).toHaveAttribute("src", "/api/system/manuals/system/onboarding/5_flow.html?embed=1");
});
