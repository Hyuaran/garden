import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { colors } from "../_constants/colors";
import { Button } from "./Button";
import { DataTable, type Column } from "./DataTable";
import { Modal } from "./Modal";

type Row = { id: string; note: string };

HTMLElement.prototype.scrollIntoView = vi.fn();

function collectFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    if (file.includes(".legacy-") || file.includes(`${path.sep}contracts${path.sep}_lib${path.sep}employment-contract-pdf.server`)) return [];
    if (file.includes(`${path.sep}_lib${path.sep}`) || file.includes(`${path.sep}_types${path.sep}`)) return [];
    const stats = statSync(file);
    if (stats.isDirectory()) return collectFiles(file);
    return /\.(tsx|ts)$/.test(name) ? [file] : [];
  });
}

describe("Root 社長スタイル共通部品", () => {
  it("DataTable の見出し・選択行・折り返し設定をRoot変数で描画する", () => {
    const columns: Column<Row>[] = [
      { key: "id", header: "ID", render: (row) => row.id, width: 80 },
      { key: "note", header: "説明", render: (row) => row.note, width: 180, wrap: true },
    ];
    render(<DataTable columns={columns} rows={[{ id: "ROW-1", note: "長い説明" }]} activeIndex={0} />);

    const table = screen.getByRole("table");
    expect(table).toHaveStyle("min-width: max-content");
    const idHeader = screen.getByRole("columnheader", { name: "ID" });
    expect(idHeader.style.color).toBe(colors.heading);
    expect(idHeader.style.whiteSpace).toBe("nowrap");
    const row = screen.getByRole("row", { name: /ROW-1/ });
    expect(row.style.background).toBe(colors.infoBg);
    expect(within(row).getByText("ROW-1").style.whiteSpace).toBe("nowrap");
    const wrapCell = within(row).getByText("長い説明");
    expect(wrapCell.style.whiteSpace).toBe("normal");
    expect(wrapCell.style.minWidth).toBe("180px");
  });

  it("Button の4種類が指定の形と色で描画される", () => {
    render(
      <>
        <Button>primary</Button>
        <Button variant="secondary">secondary</Button>
        <Button variant="danger">danger</Button>
        <Button variant="ghost">ghost</Button>
      </>,
    );

    const primary = screen.getByRole("button", { name: "primary" });
    expect(primary.style.background).toBe(colors.primary);
    expect(primary.style.color).toBe(colors.textOnDark);
    expect(primary.style.borderRadius).toBe("10px");
    expect(primary.style.whiteSpace).toBe("nowrap");
    expect(screen.getByRole("button", { name: "secondary" }).style.background).toBe(colors.bgPanel);
    expect(screen.getByRole("button", { name: "danger" }).style.background).toBe(colors.dangerSolid);
    expect(screen.getByRole("button", { name: "ghost" }).style.background).toBe("transparent");
  });

  it("Modal の閉じるボタンに aria-label が残っている", () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="確認">本文</Modal>);
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("Root 画面表示文字列", () => {
  it("表示 TSX に絵文字の範囲の文字が残っていない", () => {
    const rootDir = path.join(process.cwd(), "src", "app", "root");
    const emojiPattern = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    const offenders = collectFiles(rootDir).filter((file) => emojiPattern.test(readFileSync(file, "utf8")));
    expect(offenders.map((file) => path.relative(process.cwd(), file))).toEqual([]);
  });

  it("KoT 同期履歴の警告文が利用者向け文言になっている", () => {
    const source = readFileSync(path.join(process.cwd(), "src", "app", "root", "kot-sync-history", "page.tsx"), "utf8");
    expect(source).toContain("5 分以上「実行中」のまま止まっている記録が");
    expect(source).toContain("もう一度同期を実行しても変わらないときは、管理者へお問い合わせください。");
    expect(source).not.toContain("Server Action");
    expect(source).not.toContain("upsert 未完了");
  });
});
