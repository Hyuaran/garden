import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("every attendance reader and CSV transition excludes voided raw punches", () => {
  for (const file of [
    "src/app/api/my/ap-daily-report/route.ts",
    "src/app/api/system/attendance/my/route.ts",
    "src/app/api/system/attendance/day/route.ts",
    "src/app/api/system/attendance/corrections/route.ts",
    "src/app/api/system/attendance/sync-status/route.ts",
    "src/app/api/system/attendance/kot-export/route.ts",
    "src/app/api/system/attendance/kot-export/confirm/route.ts",
    "src/app/api/system/attendance/kot-export/revert/route.ts",
    "src/lib/attendance/kot-punch-push.server.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    const queries = [
      ...source.matchAll(/\.from\(["']system_attendance_punches["']\)/g),
    ];
    expect(queries.length, file).toBeGreaterThan(0);
    for (const query of queries) {
      const tail = source.slice(query.index! + query[0].length);
      const next = tail.indexOf(".from(");
      const statement = next < 0 ? tail : tail.slice(0, next);
      expect(statement, file).toMatch(/\.is\(["']voided_at["'],\s*null\)/);
    }
  }
});
