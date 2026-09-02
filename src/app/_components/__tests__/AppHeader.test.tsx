import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppHeader } from "../AppHeader";

describe("AppHeader — rendering", () => {
  // ロゴと「Garden Series」はサイドバー側へ移ったため、ここでは確かめない。
  it("renders search, date, weather, status, bell and user info", () => {
    render(<AppHeader />);
    for (const id of ["app-header", "app-search-input", "app-date", "app-weather", "app-system-status", "app-notification-bell", "app-user-info"]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
  });
  it("renders default user info (東海林 美琴 / 株式会社ヒュアラン / 全権管理者)", () => {
    render(<AppHeader />);
    expect(screen.getByText("東海林 美琴")).toBeInTheDocument();
    expect(screen.getByText(/株式会社ヒュアラン\s*\/\s*全権管理者/)).toBeInTheDocument();
  });
  it("renders custom user info via props", () => {
    render(<AppHeader userName="山田 太郎" organization="株式会社たいよう" role="staff" />);
    expect(screen.getByText("山田 太郎")).toBeInTheDocument();
    expect(screen.getByText(/株式会社たいよう\s*\/\s*正社員/)).toBeInTheDocument();
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
    fireEvent.keyDown(document.body, { key: "f", ctrlKey: true });
    expect(document.activeElement).toBe(input);
  });
  it("Cmd+F (metaKey) also focuses search input", () => {
    render(<AppHeader />);
    const input = screen.getByTestId("app-search-input") as HTMLInputElement;
    fireEvent.keyDown(document.body, { key: "f", metaKey: true });
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
