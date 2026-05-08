/**
 * a-review #55 PR #85 経理事故レベル指摘 4 件のリグレッションテスト。
 *
 * R1: bud_transfers RLS の bt.id → bt.transfer_id 修正
 * R2: bud_statements 重複 schema 整理（bud-schema.sql から削除、a06 を正本化）
 * R3: selfApproveAsSuperAdmin が直接 UPDATE せず RPC `bud_transition_transfer_status` を呼ぶ
 * R5: matcher 完了マークが 2 段階遷移（承認済み → CSV出力済み → 振込完了）
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// __dirname = C:/garden/a-bud/src/app/bud/_lib/__tests__
// 5 levels up to reach C:/garden/a-bud (project root)
const REPO_ROOT = resolve(__dirname, "../../../../..");
const RPO = (relpath: string) => readFileSync(resolve(REPO_ROOT, relpath), "utf8");

describe("a-review #55 R1: bud_transfers RLS bt.id 参照誤り", () => {
  const a03Sql = RPO("scripts/bud-a03-status-history-migration.sql");

  it("bud_tsh_select_staff_own policy が bt.transfer_id を参照する（bt.id は使わない）", () => {
    // CREATE POLICY bud_tsh_select_staff_own ... bt.transfer_id = ...
    expect(a03Sql).toMatch(/CREATE POLICY bud_tsh_select_staff_own/);
    expect(a03Sql).toMatch(
      /bt\.transfer_id\s*=\s*bud_transfer_status_history\.transfer_id/,
    );
  });

  it("policy 本体に SQL コードとしての bt.id 参照が残っていない（コメント説明文除く）", () => {
    // 1 行ずつ走査して、コメント行（-- で始まる）以外で bt.id を含む行を検出
    const codeLines = a03Sql
      .split(/\r?\n/)
      .filter((line) => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith("--");
      });
    const offendingLines = codeLines.filter((line) => /\bbt\.id\b/.test(line));
    expect(offendingLines).toEqual([]);
  });
});

describe("a-review #55 R2: bud_statements 重複 schema 整理", () => {
  const schemaSql = RPO("scripts/bud-schema.sql");
  const a06Sql = RPO("scripts/bud-a06-statements-migration.sql");

  it("bud-schema.sql から bud_statements の CREATE TABLE 定義が削除されている", () => {
    expect(schemaSql).not.toMatch(
      /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+bud_statements\b/,
    );
  });

  it("bud-a06-statements-migration.sql に bud_statements の CREATE TABLE 定義が残っている（正本化）", () => {
    expect(a06Sql).toMatch(
      /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+bud_statements\s*\(/,
    );
  });

  it("a06 の bud_statements が新スキーマ（id uuid PK / matched_transfer_id 列）であることを担保", () => {
    expect(a06Sql).toMatch(/id\s+uuid\s+PRIMARY\s+KEY/);
    expect(a06Sql).toMatch(/matched_transfer_id\s+text/);
    // 旧スキーマの痕跡（statement_id PK / deposit_amount / withdrawal_amount）が無いこと
    expect(a06Sql).not.toMatch(/statement_id\s+text\s+PRIMARY\s+KEY/);
    expect(a06Sql).not.toMatch(/deposit_amount\b/);
    expect(a06Sql).not.toMatch(/withdrawal_amount\b/);
  });

  it("bud-schema.sql に R2 修正の経緯コメントが残っている（後続作業で把握できる）", () => {
    expect(schemaSql).toMatch(/a-review\s+#55\s+R2/);
  });
});

describe("a-review #55 R3: selfApproveAsSuperAdmin の RPC 化", () => {
  const mutationsTs = RPO("src/app/bud/_lib/transfer-mutations.ts");

  it("selfApproveAsSuperAdmin 関数定義が存在する（API 互換）", () => {
    expect(mutationsTs).toMatch(/export\s+async\s+function\s+selfApproveAsSuperAdmin\s*\(/);
  });

  /**
   * 関数本体を抽出: 「export async function selfApproveAsSuperAdmin」から
   * 次の「export async function」または `\nexport ` までを切り出す簡易抽出。
   */
  function extractSelfApproveBody(src: string): string {
    const startIdx = src.indexOf("export async function selfApproveAsSuperAdmin");
    if (startIdx === -1) return "";
    // 次の export 宣言（関数 / const）まで
    const nextExportIdx = src.indexOf("\nexport ", startIdx + 1);
    return nextExportIdx === -1 ? src.slice(startIdx) : src.slice(startIdx, nextExportIdx);
  }

  it("関数本体が transitionTransferStatus 経由で遷移する（RPC 化）", () => {
    const body = extractSelfApproveBody(mutationsTs);
    expect(body.length).toBeGreaterThan(0);
    expect(body).toMatch(/transitionTransferStatus\s*\(/);
  });

  it("関数本体に直接 UPDATE（status: 承認済み のオブジェクトリテラル）が残っていない", () => {
    const body = extractSelfApproveBody(mutationsTs);
    // 旧実装の特徴: .update({ status: "承認済み", approved_by, approved_at })
    // 新実装は select() のみで final fetch するので update() 呼出は無い
    expect(body).not.toMatch(/\.update\(\s*\{[\s\S]*?status:\s*"承認済み"/);
    expect(body).not.toMatch(/approved_by:\s*actorUserId/);
  });

  it("修正の経緯コメントが残っている（#55 R3 reference）", () => {
    expect(mutationsTs).toMatch(/#55\s+R3/);
  });
});

describe("a-review #55 R5: matcher 2 段階遷移", () => {
  const importTs = RPO("src/app/bud/_lib/statement-import.ts");

  it("matcher 内で transitionTransferStatus が 2 回呼ばれている（CSV出力済み + 振込完了）", () => {
    // runAutoMatching 内の遷移呼出 2 つを確認
    const csvCallMatches = importTs.match(/toStatus:\s*"CSV出力済み"/g) ?? [];
    const finalCallMatches = importTs.match(/toStatus:\s*"振込完了"/g) ?? [];
    expect(csvCallMatches.length).toBeGreaterThanOrEqual(1);
    expect(finalCallMatches.length).toBeGreaterThanOrEqual(1);
  });

  it("旧実装の単発 振込完了 直接遷移が残っていない（comments で言及はあり得る）", () => {
    // toStatus: "振込完了" を含む遷移呼出は 1 回のみ（2 段目のみ）
    const allFinalToStatus = importTs.match(/toStatus:\s*"振込完了"/g) ?? [];
    expect(allFinalToStatus.length).toBe(1);
    // CSV出力済み 遷移も 1 回のみ
    const allCsvToStatus = importTs.match(/toStatus:\s*"CSV出力済み"/g) ?? [];
    expect(allCsvToStatus.length).toBe(1);
  });

  it("修正の経緯コメントが残っている（#55 R5 reference + Plan B）", () => {
    expect(importTs).toMatch(/#55\s+R5/);
    // Plan A 採用していない経緯（業務フロー的に NG）が説明されている
    expect(importTs).toMatch(/Plan\s*A/);
    expect(importTs).toMatch(/Plan\s*B/);
  });

  it("両段階の reason に matcher 由来であることが書かれている（status_history 監査用）", () => {
    expect(importTs).toMatch(/reason:\s*"matcher:[^"]*CSV/);
    expect(importTs).toMatch(/reason:\s*"matcher:[^"]*振込完了/);
  });

  it("INVALID_TRANSITION 以外のエラーは continue でスキップ（best-effort 維持）", () => {
    expect(importTs).toMatch(/INVALID_TRANSITION/);
    expect(importTs).toMatch(/continue;?/);
  });
});
