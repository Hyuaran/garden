import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ loadCompanyMembers: vi.fn() }));
vi.mock("../_lib/company-doc.server", () => ({ loadCompanyMembers: mocks.loadCompanyMembers }));
import CompanyPage from "./page";
import OrientationPage from "@/app/(orientation)/system/docs/company/present/page";
import OrientationLayout from "@/app/(orientation)/system/docs/company/present/layout";
import { ThemeProvider } from "@/app/_lib/theme/ThemeProvider";
import CompanyDocument from "../_components/CompanyDocument";
import { members } from "../_data/members";

describe("オリエンテーション表示", () => {
  it("Shellのレール・サイドバー・上部バーを出さず戻るリンクを表示する", () => {
    render(<ThemeProvider><OrientationLayout><CompanyDocument members={members} presentation /></OrientationLayout></ThemeProvider>);
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Systemメニュー" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ログアウト" })).not.toBeInTheDocument();
    expect(screen.queryByText("System ／ 資料")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "資料に戻る" })).toHaveAttribute("href", "/system/docs/company");
    expect(screen.getByRole("button", { name: /ダークにする|ライトにする/ })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "会社説明の目次" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "オリエンテーション表示" })).not.toBeInTheDocument();
  });

  it("通常表示と全6章・表示メンバー・写真が同じ", async () => {
    const photos = Object.fromEntries(members.map(member => [member.id, `https://example.com/${member.id}.webp`]));
    mocks.loadCompanyMembers.mockResolvedValue({ members, photos });
    const capture = (container: HTMLElement) => ({
      chapters: [...container.querySelectorAll("section[id]")].map(section => section.textContent),
      members: [...container.querySelectorAll("[data-member-id]")].map(member => member.getAttribute("data-member-id")),
      photos: [...container.querySelectorAll("img")].map(img => img.getAttribute("src")),
    });
    const normal = render(await CompanyPage());
    const expected = capture(normal.container);
    expect(expected.chapters).toHaveLength(6); expect(expected.members).toHaveLength(12); expect(expected.photos).toHaveLength(12);
    normal.unmount();
    const presentation = render(<ThemeProvider><OrientationLayout>{await OrientationPage()}</OrientationLayout></ThemeProvider>);
    expect(capture(presentation.container)).toEqual(expected);
    expect(mocks.loadCompanyMembers).toHaveBeenLastCalledWith("/system/docs/company/present");
    for (const name of ["松本　美菜里", "辻　舞由子"]) expect(presentation.container.textContent).not.toContain(name);
  });

  it("通常表示の入口は説明文と線画SVGを持つ", () => {
    render(<CompanyDocument members={members} />);
    const link = screen.getByRole("link", { name: "オリエンテーション表示" });
    expect(link).toHaveAttribute("href", "/system/docs/company/present");
    expect(link.querySelector("svg path")).not.toBeNull();
    expect(link.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(screen.queryByText("メニューを隠して、資料だけを大きく映します。")).toBeNull();
    expect(within(screen.getByRole("navigation", { name: "会社説明の目次" })).getAllByRole("link")).toHaveLength(6);
  });
});
