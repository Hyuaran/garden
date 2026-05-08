import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppHeader } from "../AppHeader";

describe("AppHeader — rendering", () => {
  it("renders Garden Series title + subtitle + logo", () => {
    render(<AppHeader />);
    expect(screen.getByText("Garden Series")).toBeInTheDocument();
    expect(screen.getByText("Grow Your Business")).toBeInTheDocument();
    const logo = screen.getByAltText("Garden Series");
    expect(logo.getAttribute("src")).toBe("/themes/garden-logo.webp");
  });
  it("renders default user info (東海林 美琴 / 正社員 / 全権管理者)", () => {
    render(<AppHeader />);
    expect(screen.getByText("東海林 美琴")).toBeInTheDocument();
    expect(screen.getByText(/正社員\s*\/\s*全権管理者/)).toBeInTheDocument();
  });
  it("renders custom user info via props", () => {
    render(<AppHeader userName="山田 太郎" employmentType="派遣社員" roleLabel="一般" />);
    expect(screen.getByText("山田 太郎")).toBeInTheDocument();
    expect(screen.getByText(/派遣社員\s*\/\s*一般/)).toBeInTheDocument();
  });
  it("renders search input + Ctrl+F shortcut hint", () => {
    render(<AppHeader />);
    expect(screen.getByTestId("app-search-input")).toBeInTheDocument();
    expect(screen.getByText("Ctrl+F")).toBeInTheDocument();
  });
});

describe("AppHeader — Ctrl+F keyboard handler", () => {
  beforeEach(() => {});

  it("Ctrl+F focuses search input from outside", () => {
    render(<AppHeader />);
    const input = screen.getByTestId("app-search-input") as HTMLInputElement;
    expect(document.activeElement).not.toBe(input);
    fireEvent.keyDown(window, { key: "f", ctrlKey: true });
    expect(document.activeElement).toBe(input);
  });
  it("Cmd+F (metaKey) also focuses search input", () => {
    render(<AppHeader />);
    const input = screen.getByTestId("app-search-input") as HTMLInputElement;
    fireEvent.keyDown(window, { key: "f", metaKey: true });
    expect(document.activeElement).toBe(input);
  });
  it("does NOT fire when target is INPUT", () => {
    render(
      <>
        <input data-testid="other-input" />
        <AppHeader />
      </>,
    );
    const other = screen.getByTestId("other-input") as HTMLInputElement;
    other.focus();
    fireEvent.keyDown(other, { key: "f", ctrlKey: true });
    // other-input should still be focused; AppHeader's input should not steal focus
    expect(document.activeElement).toBe(other);
  });
});
