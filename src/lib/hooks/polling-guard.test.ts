import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, it } from "vitest";
import ts from "typescript";

// These files contain only local display intervals; their server reads are event driven.
const allowed: Record<string, string> = {
  "app/rill/mail/_components/RillMailScreen.tsx": "送信・移動の取り消し秒数の表示だけ。定期取得2箇所は usePolling。",
  "app/rill/_components/RillShachoShell.tsx": "日付の表示だけ。",
  "app/_components/layout/GardenShell/GardenShell.tsx": "日付の表示だけ。",
};
// Match only the existing display expressions, so the exception cannot hide a new server timer.
const displayCallbacks: Record<string, string[]> = {
  "app/rill/mail/_components/RillMailScreen.tsx": [
    '() => setMoveToast((current) => current ? { ...current, seconds: Math.max(0, current.seconds - 1) } : null)',
    '() => setSendToast((current) => current?.tone === "pending" ? { ...current, seconds: Math.max(0, (current.seconds ?? 1) - 1) } : current)',
  ],
  "app/rill/_components/RillShachoShell.tsx": ['() => setDateText(formatDateJP(new Date()))'],
  "app/_components/layout/GardenShell/GardenShell.tsx": ['() => setDateText(formatDateJP(new Date()))'],
};
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(join(dir,e.name)) : [join(dir,e.name)]);
}
it("一定間隔のサーバー取得を共通フックに限定する", () => {
  const offenders = files("src").filter(p=>/\.tsx?$/.test(p) && !/\.(test|spec)\.[^.]+$/.test(p)).filter(p=> {
    const name = relative("src",p).replaceAll("\\","/");
    if (name === "lib/hooks/usePolling.ts") return false;
    const source = readFileSync(p,"utf8");
    if (allowed[name]) {
      const parsed = ts.createSourceFile(p, source, ts.ScriptTarget.Latest, true, p.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      let unexpected = false;
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && /(?:^|\.)setInterval$/.test(node.expression.getText(parsed))) {
          if (!displayCallbacks[name].includes(node.arguments[0]?.getText(parsed))) unexpected = true;
        }
        ts.forEachChild(node, visit);
      };
      visit(parsed);
      return unexpected;
    }
    return /setInterval\s*\(/.test(source) && /fetch\s*\(|\.from\s*\(|\.rpc\s*\(/.test(source);
  });
  expect(offenders, "一定間隔でサーバーへ取りに行くときは usePolling を使ってください（2026-10-27 の Vercel 料金の件）").toEqual([]);
});
