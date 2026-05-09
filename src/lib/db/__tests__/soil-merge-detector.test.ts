/**
 * Garden-Soil Phase B-01 Phase 2: Merge Proposal Detector TDD
 *
 * 対応 spec:
 *   - docs/specs/2026-05-08-soil-phase-b-01-phase-2-filemaker-csv.md §5（Phase 1/2 跨り重複処理）
 *
 * テスト対象:
 *   - detectMatchRound: 2 行間の R1/R2/R3 判定
 *   - findBestMatch: Phase 2 行 1 件に対する Phase 1 候補群からの最良マッチ
 *   - buildMergeProposals: Phase 1/2 の集合から全提案リスト生成
 */

import { describe, it, expect } from "vitest";
import {
  detectMatchRound,
  findBestMatch,
  buildMergeProposals,
  type CandidateRow,
} from "../soil-merge-detector";

// ============================================================
// テストデータ helper
// ============================================================

const phase1Row = (overrides: Partial<CandidateRow> = {}): CandidateRow => ({
  id: "p1-uuid-001",
  source_system: "kintone-app-55",
  source_record_id: "K-100",
  phone_primary: "+81612345678",
  name_kanji: "山田 太郎",
  ...overrides,
});

const phase2Row = (overrides: Partial<CandidateRow> = {}): CandidateRow => ({
  id: "p2-uuid-001",
  source_system: "filemaker-list2024",
  source_record_id: "FM-200",
  phone_primary: "+81612345678",
  name_kanji: "山田 太郎",
  ...overrides,
});

// ============================================================
// detectMatchRound
// ============================================================

describe("detectMatchRound", () => {
  it("R1: phone_primary + name_kanji 完全一致 → confidence 0.95", () => {
    const result = detectMatchRound(phase1Row(), phase2Row());
    expect(result).toEqual({ round: "R1", confidence: 0.95 });
  });

  it("R2: source_record_id 完全一致（cross system）→ confidence 0.99", () => {
    // R2 は source_record_id 一致が最強の証拠（FileMaker → Kintone の手動紐付け列）
    const result = detectMatchRound(
      phase1Row({ source_record_id: "SHARED-ID-001" }),
      phase2Row({
        source_record_id: "SHARED-ID-001",
        phone_primary: "+81900000000",  // phone は違っても OK
        name_kanji: "別の名前",
      }),
    );
    expect(result).toEqual({ round: "R2", confidence: 0.99 });
  });

  it("R2 優先: source_record_id + phone + name 全一致でも R2 採用（信頼度最高）", () => {
    const result = detectMatchRound(
      phase1Row({ source_record_id: "SHARED" }),
      phase2Row({ source_record_id: "SHARED" }),
    );
    expect(result?.round).toBe("R2");
  });

  it("R3: phone_primary のみ完全一致 → confidence 0.80", () => {
    const result = detectMatchRound(
      phase1Row(),
      phase2Row({ name_kanji: "別の人" }),
    );
    expect(result).toEqual({ round: "R3", confidence: 0.80 });
  });

  it("マッチなし: phone も name も source_record_id も一致しない → null", () => {
    const result = detectMatchRound(
      phase1Row(),
      phase2Row({
        phone_primary: "+81900000000",
        name_kanji: "全然違う",
        source_record_id: "違う",
      }),
    );
    expect(result).toBeNull();
  });

  it("phone が両方 null → R1/R3 不成立、R2 のみで判定", () => {
    const result1 = detectMatchRound(
      phase1Row({ phone_primary: null }),
      phase2Row({ phone_primary: null }),
    );
    // name_kanji 一致だけでは不十分（phone 必須）
    expect(result1).toBeNull();

    const result2 = detectMatchRound(
      phase1Row({ phone_primary: null, source_record_id: "S" }),
      phase2Row({ phone_primary: null, source_record_id: "S" }),
    );
    expect(result2?.round).toBe("R2");
  });

  it("source_record_id が両方 null → R2 不成立", () => {
    const result = detectMatchRound(
      phase1Row({ source_record_id: null }),
      phase2Row({ source_record_id: null }),
    );
    // phone + name 一致 → R1
    expect(result?.round).toBe("R1");
  });

  it("source_system が同じ → 跨り重複ではないので null", () => {
    const result = detectMatchRound(
      phase1Row({ source_system: "kintone-app-55" }),
      phase2Row({ source_system: "kintone-app-55", id: "p1-uuid-002" }),
    );
    expect(result).toBeNull();
  });

  it("primary と duplicate が同じ id → 自分自身は対象外", () => {
    const sameId = phase1Row({ id: "same-uuid" });
    const result = detectMatchRound(sameId, { ...sameId, source_system: "filemaker-list2024" });
    expect(result).toBeNull();
  });
});

// ============================================================
// findBestMatch
// ============================================================

describe("findBestMatch", () => {
  it("Phase 2 行 1 件に対し、Phase 1 候補群から最高 confidence のマッチを選ぶ", () => {
    const p2 = phase2Row({ source_record_id: "SHARED" });
    const p1Candidates = [
      phase1Row({ id: "p1-A", source_record_id: "DIFF", phone_primary: "+81600000000", name_kanji: "違う" }), // no match
      phase1Row({ id: "p1-B", source_record_id: "DIFF" }),                                    // R1 (phone+name)
      phase1Row({ id: "p1-C", source_record_id: "SHARED", phone_primary: "+81700000000" }),  // R2 (best)
    ];
    const result = findBestMatch(p2, p1Candidates);
    expect(result).toEqual({
      primary_list_id: "p1-C",
      duplicate_list_id: "p2-uuid-001",
      match_round: "R2",
      confidence: 0.99,
    });
  });

  it("マッチがない → null", () => {
    const p2 = phase2Row({
      phone_primary: "+81900000000",
      name_kanji: "孤立",
      source_record_id: "ALONE",
    });
    const p1Candidates = [phase1Row()];
    expect(findBestMatch(p2, p1Candidates)).toBeNull();
  });

  it("複数の R1 マッチがある場合、最初のものを採用（決定性のため id 昇順）", () => {
    const p2 = phase2Row();
    const p1Candidates = [
      phase1Row({ id: "p1-Z" }),  // R1
      phase1Row({ id: "p1-A" }),  // R1
    ];
    const result = findBestMatch(p2, p1Candidates);
    expect(result?.primary_list_id).toBe("p1-A");  // id 昇順で最初
  });

  it("R2 vs R1 の混在 → R2 を優先", () => {
    const p2 = phase2Row({ source_record_id: "SHARED" });
    const p1Candidates = [
      phase1Row({ id: "p1-A" }),                         // R1
      phase1Row({ id: "p1-B", source_record_id: "SHARED", phone_primary: "+81900000000", name_kanji: "違う" }),  // R2
    ];
    const result = findBestMatch(p2, p1Candidates);
    expect(result?.match_round).toBe("R2");
    expect(result?.primary_list_id).toBe("p1-B");
  });
});

// ============================================================
// buildMergeProposals
// ============================================================

describe("buildMergeProposals", () => {
  it("Phase 1 / Phase 2 集合から全マッチ提案を生成", () => {
    const p1Rows = [
      phase1Row({ id: "p1-A", phone_primary: "+81611111111", name_kanji: "佐藤" }),
      phase1Row({ id: "p1-B", phone_primary: "+81622222222", name_kanji: "鈴木" }),
    ];
    const p2Rows = [
      phase2Row({ id: "p2-A", phone_primary: "+81611111111", name_kanji: "佐藤" }), // → p1-A (R1)
      phase2Row({ id: "p2-B", phone_primary: "+81633333333", name_kanji: "孤立", source_record_id: "ALONE" }), // no match
    ];
    const result = buildMergeProposals(p1Rows, p2Rows);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      primary_list_id: "p1-A",
      duplicate_list_id: "p2-A",
      match_round: "R1",
      confidence: 0.95,
    });
  });

  it("Phase 2 が空 → 空配列", () => {
    expect(buildMergeProposals([phase1Row()], [])).toEqual([]);
  });

  it("Phase 1 が空 → 空配列", () => {
    expect(buildMergeProposals([], [phase2Row()])).toEqual([]);
  });

  it("両方空 → 空配列", () => {
    expect(buildMergeProposals([], [])).toEqual([]);
  });

  it("同一 Phase 2 行が複数の Phase 1 候補にマッチした場合、1 提案のみ生成（最高 confidence）", () => {
    const p1Rows = [
      phase1Row({ id: "p1-X" }),                                              // R1
      phase1Row({ id: "p1-Y", source_record_id: phase2Row().source_record_id }), // R2 (best)
    ];
    const p2Rows = [phase2Row()];
    const result = buildMergeProposals(p1Rows, p2Rows);
    expect(result).toHaveLength(1);
    expect(result[0].match_round).toBe("R2");
    expect(result[0].primary_list_id).toBe("p1-Y");
  });

  it("source_system が同じ Phase 1 同士は対象外（跨り重複のみ検出）", () => {
    const p1Rows = [
      phase1Row({ id: "p1-A" }),
      phase1Row({ id: "p1-B" }),
    ];
    const p2Rows: CandidateRow[] = [];
    const result = buildMergeProposals(p1Rows, p2Rows);
    expect(result).toHaveLength(0);
  });
});
