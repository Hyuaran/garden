import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SystemBreadcrumb from "./SystemBreadcrumb";
import styles from "./system-breadcrumb.module.css";

describe("SystemBreadcrumb", () => {
  it("renders System as the current location on the System home", () => {
    render(<SystemBreadcrumb />);

    const nav = screen.getByRole("navigation", { name: "現在地" });
    expect(nav).toHaveClass(styles.breadcrumb);
    expect(within(nav).getByText("System")).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "System" })).not.toBeInTheDocument();
  });

  it("links ancestors and leaves the last crumb as plain text", () => {
    render(<SystemBreadcrumb items={[{ label: "フォーム", href: "/system/forms" }, { label: "給与計算連絡" }]} />);

    const nav = screen.getByRole("navigation", { name: "現在地" });
    expect(within(nav).getByRole("link", { name: "System" })).toHaveAttribute("href", "/system");
    expect(within(nav).getByRole("link", { name: "フォーム" })).toHaveAttribute("href", "/system/forms");
    expect(within(nav).getByText("給与計算連絡")).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "給与計算連絡" })).not.toBeInTheDocument();
  });
});
