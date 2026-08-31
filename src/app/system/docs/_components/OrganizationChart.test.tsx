import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import OrganizationChart from "./OrganizationChart";
import { organization } from "../_data/company-doc";

describe("データから組み立てる組織図", () => {
  it("代表の直下に3部、各部の直下に所属する課を持つ", () => {
    render(<OrganizationChart root={organization} />);
    const tree = screen.getByRole("list", { name: "組織図" });
    expect(tree.querySelector(":scope > li > div > strong")).toHaveTextContent("代表取締役");
    const departments = [...tree.querySelectorAll(":scope > li > ul > li")];
    expect(departments).toHaveLength(3);
    expect(departments.map(node => node.querySelector(":scope > div > strong")?.textContent)).toEqual(["SES事業部", "営業部", "総務部"]);
    expect(departments.map(node => [...node.querySelectorAll(":scope > ul > li > div > strong")].map(label => label.textContent))).toEqual([
      ["インフラ課", "開発課"], ["テレマ課", "訪問販売課"], ["総務課（バックヤード）"],
    ]);
  });
  it("表示用に部名や人名を固定せずデータ追加に追従する", () => {
    render(<OrganizationChart root={{ label: "代表", children: [{ label: "新しい部", people: ["担当者A"], children: [{ label: "新しい課", people: ["担当者B"] }] }] }} />);
    expect(screen.getByText("新しい部")).toBeInTheDocument();
    expect(screen.getByText("新しい課")).toBeInTheDocument();
    expect(screen.getByText("担当者A")).toBeInTheDocument();
    expect(screen.getByText("担当者B")).toBeInTheDocument();
    expect(screen.queryByText("SES事業部")).not.toBeInTheDocument();
  });
});
