import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import FormsHubClient from "./FormsHubClient";
import { SYSTEM_FORMS } from "./_lib/forms-registry";

describe("FormsHubClient", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows payroll notice in list view by default", () => {
    render(<FormsHubClient forms={SYSTEM_FORMS} />);

    expect(screen.getByText("System / フォーム")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "フォーム" })).toBeInTheDocument();
    expect(screen.getByTestId("forms-list-view")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "給与計算連絡" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "開く" })).toHaveAttribute("href", "/system/forms/payroll-notice");
    expect(screen.getByRole("button", { name: "リスト表示にする" })).toHaveAttribute("aria-pressed", "true");
  });

  it("switches to card view and saves the setting", () => {
    render(<FormsHubClient forms={SYSTEM_FORMS} />);

    fireEvent.click(screen.getByRole("button", { name: "グリッド表示にする" }));

    expect(screen.getByTestId("forms-grid-view")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "給与計算連絡" })).toBeInTheDocument();
    expect(screen.getByText("使える人：社員以上")).toBeInTheDocument();
    expect(localStorage.getItem("garden.forms.viewMode")).toBe("grid");
  });

  it("restores the saved card view and can switch back to list", () => {
    localStorage.setItem("garden.forms.viewMode", "grid");
    render(<FormsHubClient forms={SYSTEM_FORMS} />);

    expect(screen.getByTestId("forms-grid-view")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "リスト表示にする" }));
    expect(screen.getByTestId("forms-list-view")).toBeInTheDocument();
    expect(localStorage.getItem("garden.forms.viewMode")).toBe("list");
  });
});
