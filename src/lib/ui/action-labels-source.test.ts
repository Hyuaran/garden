import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : entry.name.endsWith(".tsx") && !entry.name.includes(".test.") ? [path.join(dir, entry.name)] : []);
}
it("ボタンの保存ラベルと非表示チェックの言葉をそろえる", () => {
  const failures: string[] = [];
  for (const file of walk("src/app")) {
    const text = readFileSync(file, "utf8");
    const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if (ts.isStringLiteral(node) && node.text === "保存する" || ts.isJsxText(node) && node.text.trim() === "保存する") failures.push(file + ": 保存ラベル");
      if ((ts.isJsxText(node) || ts.isStringLiteral(node)) && node.text.includes("を表示しない")) failures.push(file + ": 非表示ラベル");
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  expect(failures).toEqual([]);
});
