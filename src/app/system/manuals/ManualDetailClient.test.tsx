import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ManualDetailClient from "./ManualDetailClient";
import { MANUAL_MODULES, SYSTEM_MANUALS } from "./_lib/manuals-registry";

describe("ManualDetailClient", () => {
  it("renders only visible tabs and the selected iframe", () => {
    const manual = SYSTEM_MANUALS[3];
    render(<ManualDetailClient module={MANUAL_MODULES[0]} manual={manual} docs={[manual.docs[0]]} selectedDoc={manual.docs[0]} />);

    expect(screen.getByRole("heading", { name: "勤怠打刻と KOT 取込" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "操作マニュアル", current: "page" })).toHaveAttribute("href", "/system/manuals/system/kot-attendance?tab=operation");
    expect(screen.queryByRole("link", { name: "要点" })).not.toBeInTheDocument();
    expect(screen.getByTitle("勤怠打刻と KOT 取込 操作マニュアル")).toHaveAttribute("src", "/api/system/manuals/system/kot-attendance/1_operation.html?embed=1");
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
    vi.unstubAllGlobals();
  });
});
