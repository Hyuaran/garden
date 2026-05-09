/**
 * Garden-Soil Phase B-01 Phase 2: Phase 1/2 跨り重複検出 + Merge Proposal Builder
 *
 * 対応 spec:
 *   - docs/specs/2026-05-08-soil-phase-b-01-phase-2-filemaker-csv.md §5
 *
 * 作成: 2026-05-09（Phase B-01 Phase 2 実装、a-soil-002）
 *
 * 役割:
 *   FileMaker CSV（Phase 2）で取込済の soil_lists 行と、
 *   Kintone App 55（Phase 1）由来の soil_lists 行から、
 *   同一顧客の重複を検出して soil_lists_merge_proposals に登録する提案を生成する。
 *
 *   本ファイルは pure functions のみ。実 DB INSERT は呼出側（importer or admin script）で実施。
 *
 * マッチング戦略（spec §5.2）:
 *   - R1: phone_primary + name_kanji 完全一致 → confidence 0.95（自動登録）
 *   - R2: source_record_id 完全一致（cross system）→ confidence 0.99（自動登録）
 *   - R3: phone_primary のみ完全一致 → confidence 0.80（manual review、本実装では検出のみ）
 *
 * 設計方針:
 *   - 純粋関数（DB アクセスなし）
 *   - TDD で開発（src/lib/db/__tests__/soil-merge-detector.test.ts）
 *   - source_system が異なる行同士のみ対象（同一 system 内の重複は別レイヤで処理）
 *   - confidence 高い順に R2 → R1 → R3 を採用
 *   - 1 つの duplicate に対し最高 confidence の primary を 1 つだけ提案
 */

// ============================================================
// 型定義
// ============================================================

/** マッチ判定の対象行（最低限必要な列のみ） */
export type CandidateRow = {
  id: string;
  source_system: string;
  source_record_id: string | null;
  phone_primary: string | null;
  name_kanji: string | null;
};

/** マッチラウンド（spec §5.2）*/
export type MatchRound = "R1" | "R2" | "R3";

/** 検出結果（confidence 付き）*/
export type MatchResult = {
  round: MatchRound;
  confidence: number;
};

/** Merge proposal の最終形（INSERT 入力ペイロード相当）*/
export type MergeCandidate = {
  primary_list_id: string;     // 残す側（既存 Phase 1）
  duplicate_list_id: string;   // 統合される側（新規 Phase 2）
  match_round: MatchRound;
  confidence: number;
};

// ============================================================
// detectMatchRound: 2 行間のマッチ判定
// ============================================================

/**
 * 2 行を比較してマッチラウンドを判定する。
 *
 * 判定優先順:
 *   1. R2: source_record_id 完全一致（最高信頼度 0.99）
 *   2. R1: phone_primary + name_kanji 完全一致（0.95）
 *   3. R3: phone_primary のみ完全一致（0.80）
 *   4. マッチなし → null
 *
 * 必須前提:
 *   - primary.source_system !== duplicate.source_system（跨り重複のみ）
 *   - primary.id !== duplicate.id（自己マッチ除外）
 *
 * @returns マッチ結果 / 不一致なら null
 */
export function detectMatchRound(
  primary: CandidateRow,
  duplicate: CandidateRow,
): MatchResult | null {
  // 同一行 / 同一 system は対象外
  if (primary.id === duplicate.id) return null;
  if (primary.source_system === duplicate.source_system) return null;

  // R2: source_record_id 完全一致（両方 non-null）
  if (
    primary.source_record_id != null &&
    primary.source_record_id !== "" &&
    primary.source_record_id === duplicate.source_record_id
  ) {
    return { round: "R2", confidence: 0.99 };
  }

  // R1: phone_primary + name_kanji 完全一致（両方 non-null）
  if (
    primary.phone_primary != null &&
    primary.phone_primary !== "" &&
    primary.phone_primary === duplicate.phone_primary &&
    primary.name_kanji != null &&
    primary.name_kanji !== "" &&
    primary.name_kanji === duplicate.name_kanji
  ) {
    return { round: "R1", confidence: 0.95 };
  }

  // R3: phone_primary のみ完全一致
  if (
    primary.phone_primary != null &&
    primary.phone_primary !== "" &&
    primary.phone_primary === duplicate.phone_primary
  ) {
    return { round: "R3", confidence: 0.80 };
  }

  return null;
}

// ============================================================
// findBestMatch: 1 件 vs 候補群
// ============================================================

/**
 * 単一の duplicate 候補（Phase 2 行）に対して、Phase 1 候補群から最高 confidence のマッチを選ぶ。
 *
 * 同 confidence の場合は primary.id の昇順で決定的に選ぶ（再現性確保）。
 *
 * @returns MergeCandidate / マッチなしなら null
 */
export function findBestMatch(
  duplicate: CandidateRow,
  primaryCandidates: CandidateRow[],
): MergeCandidate | null {
  let best: MergeCandidate | null = null;

  // primary 候補を id 昇順でループ → 同 confidence なら先頭採用
  const sorted = [...primaryCandidates].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );

  for (const primary of sorted) {
    const match = detectMatchRound(primary, duplicate);
    if (match == null) continue;

    if (best == null || match.confidence > best.confidence) {
      best = {
        primary_list_id: primary.id,
        duplicate_list_id: duplicate.id,
        match_round: match.round,
        confidence: match.confidence,
      };
    }
  }

  return best;
}

// ============================================================
// buildMergeProposals: 集合 vs 集合
// ============================================================

/**
 * Phase 1 行群と Phase 2 行群から、跨り重複の merge proposal を全件生成する。
 *
 * 各 Phase 2 行に対し最高 confidence の Phase 1 マッチを 1 つ採用（findBestMatch 経由）。
 * マッチがない Phase 2 行は提案を生成しない。
 *
 * @returns MergeCandidate[]（DB INSERT 用ペイロード相当）
 */
export function buildMergeProposals(
  phase1Rows: CandidateRow[],
  phase2Rows: CandidateRow[],
): MergeCandidate[] {
  if (phase1Rows.length === 0 || phase2Rows.length === 0) return [];

  const proposals: MergeCandidate[] = [];
  for (const p2 of phase2Rows) {
    const match = findBestMatch(p2, phase1Rows);
    if (match != null) proposals.push(match);
  }
  return proposals;
}
