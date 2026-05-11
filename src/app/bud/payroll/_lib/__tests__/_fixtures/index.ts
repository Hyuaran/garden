/**
 * D-08 テスト戦略 / fixture index
 *
 * 対応 spec: docs/specs/2026-04-25-bud-phase-d-08-test-strategy.md §2.2 / §10
 *
 * 横断的に再利用される fixture を一括 export。
 * 各 D-* 単体テストでは必要な fixture を import して使う。
 */

export * from "./employees";
export * from "./salary-systems";
export * from "./attendance";
export * from "./withholding-tables";
