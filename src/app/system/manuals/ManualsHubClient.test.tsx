import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import ManualsHubClient from "./ManualsHubClient";
import { getManualModules } from "./_lib/manuals-registry";

describe("ManualsHubClient", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows modules in list view by default", () => {
    render(<ManualsHubClient modules={getManualModules("staff")} />);

    const breadcrumb = screen.getByRole("navigation", { name: "現在地" });
    expect(within(breadcrumb).getByRole("link", { name: "System" })).toHaveAttribute("href", "/system");
    expect(within(breadcrumb).getByText("マニュアル")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "マニュアル" })).toBeInTheDocument();
    expect(screen.getByTestId("manuals-list-view")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "System" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "開く" })[0]).toHaveAttribute("href", "/system/manuals/system");
  });

  it("switches to card view and saves the setting", () => {
    render(<ManualsHubClient modules={getManualModules("staff").slice(0, 1)} />);

    fireEvent.click(screen.getByRole("button", { name: "カード表示にする" }));

    expect(screen.getByTestId("manuals-grid-view")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "System" })).toBeInTheDocument();
    expect(screen.getByText("マニュアル 13 件")).toBeInTheDocument();
    expect(localStorage.getItem("garden.manuals.viewMode")).toBe("grid");
  });
});
