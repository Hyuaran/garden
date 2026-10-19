import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import FormsHubClient from "./FormsHubClient";
import { SYSTEM_FORMS } from "./_lib/forms-registry";
import { getVisibleGyomuTools } from "./_lib/gyomu-tools-registry";

describe("FormsHubClient", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the input tab in list view by default, and other kinds as tabs", () => {
    render(<FormsHubClient forms={SYSTEM_FORMS} tools={getVisibleGyomuTools("manager")} />);

    const breadcrumb = screen.getByRole("navigation", { name: "現在地" });
    expect(within(breadcrumb).getByRole("link", { name: "System" })).toHaveAttribute("href", "/system");
    expect(within(breadcrumb).getByText("業務管理ツール")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "業務管理ツール" })).toBeInTheDocument();
    // 区分はタブ（件数つき）。ホスト PC は独立したタブ
    expect(screen.getByRole("tab", { name: /^入力する/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /^自動で動いている/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^ホスト PC で動いている/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^Kintone に入れたしかけ/ })).toBeInTheDocument();
    expect(screen.getByTestId("input-list-view")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "給与計算連絡" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "出勤表・シフトLINE連絡テキスト生成" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "NHK訪問業務 報告" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "開く →" })[0]).toHaveAttribute("href", "/system/forms/payroll-notice");
    expect(screen.getAllByRole("link", { name: "開く →" })[1]).toHaveAttribute("href", "/system/forms/shukkin");
    expect(screen.getAllByRole("link", { name: "開く →" })[2]).toHaveAttribute("href", "/system/forms/nhk-visit");
    expect(screen.getByRole("button", { name: "リスト表示にする" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("tab", { name: /^自動で動いている/ }));
    expect(screen.getByRole("cell", { name: "INNOVERA番号の同期" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "開く →" }).some((link) => link.getAttribute("href") === "/system/innovera")).toBe(true);
    expect(screen.queryByRole("cell", { name: "INNOVERA の中継" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /^ホスト PC で動いている/ }));
    expect(screen.getByRole("cell", { name: "INNOVERA の中継" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "コール履歴の取込" })).toBeInTheDocument();
    expect(localStorage.getItem("garden.forms.tab")).toBe("host");
  });

  it("switches to card view and saves the setting (the view toggle works with tabs)", () => {
    render(<FormsHubClient forms={SYSTEM_FORMS} tools={getVisibleGyomuTools("staff")} />);

    fireEvent.click(screen.getByRole("button", { name: "グリッド表示にする" }));

    expect(screen.getByTestId("input-grid-view")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "給与計算連絡" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "出勤表・シフトLINE連絡テキスト生成" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "NHK訪問業務 報告" })).toBeInTheDocument();
    expect(screen.getAllByText("社員以上")).toHaveLength(3);
    expect(localStorage.getItem("garden.forms.viewMode")).toBe("grid");

    fireEvent.click(screen.getByRole("tab", { name: /^自動で動いている/ }));
    expect(screen.getByTestId("auto-grid-view")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "INNOVERA番号の同期" })).toBeInTheDocument();
  });

  it("restores the saved card view and tab, and can switch back to list", () => {
    localStorage.setItem("garden.forms.viewMode", "grid");
    localStorage.setItem("garden.forms.tab", "kintone");
    render(<FormsHubClient forms={SYSTEM_FORMS} tools={getVisibleGyomuTools("staff")} />);

    expect(screen.getByRole("tab", { name: /^Kintone に入れたしかけ/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("kintone-grid-view")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "リスト表示にする" }));
    expect(screen.getByTestId("kintone-list-view")).toBeInTheDocument();
    expect(localStorage.getItem("garden.forms.viewMode")).toBe("list");
  });
});
