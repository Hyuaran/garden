/**
 * Garden-Leaf 関電業務委託 — Storage bucket / path 命名の集中管理
 *
 * 3 bucket 構成 (spec §2.2):
 * - leaf-kanden-photos-recent  (write 可、recent tier)
 * - leaf-kanden-photos-monthly (A-1c では read-only、Phase B 移行バッチで書込)
 * - leaf-kanden-photos-yearly  (A-1c では read-only、Phase B 移行バッチで書込)
 *
 * 設計方針:
 * - すべて pure function、外部依存なし、テスト容易
 * - bucket id / path 規約をここに集約し、attachments.ts や Worker 等から
 *   ハードコードを撲滅する（typo 防止 + 規約変更時の影響範囲集約）
 *
 * see: docs/superpowers/specs/2026-04-23-leaf-a1c-attachment-design.md §2.2
 */

/** recent bucket（直近の本体画像 + サムネ）*/
export const RECENT_BUCKET = "leaf-kanden-photos-recent" as const;

/** monthly bucket（3ヶ月超の集約 PDF、A-1c では read のみ）*/
export const MONTHLY_BUCKET = "leaf-kanden-photos-monthly" as const;

/** yearly bucket（12ヶ月超の集約 PDF、A-1c では read のみ）*/
export const YEARLY_BUCKET = "leaf-kanden-photos-yearly" as const;

/**
 * recent bucket 本体画像パス
 * @example recentPath("CASE-0001", "aaa-bbb") → "CASE-0001/aaa-bbb.jpg"
 */
export function recentPath(caseId: string, attachmentId: string): string {
  return `${caseId}/${attachmentId}.jpg`;
}

/**
 * recent bucket サムネパス
 * @example recentThumbPath("CASE-0001", "aaa-bbb") → "CASE-0001/thumb/aaa-bbb.jpg"
 */
export function recentThumbPath(caseId: string, attachmentId: string): string {
  return `${caseId}/thumb/${attachmentId}.jpg`;
}

/**
 * monthly bucket パス（Phase B で利用）
 * @example monthlyPath("2026-04", "CASE-0001", "aaa-bbb") → "2026-04/CASE-0001_aaa-bbb.pdf"
 */
export function monthlyPath(
  yyyymm: string,
  caseId: string,
  attachmentId: string,
): string {
  return `${yyyymm}/${caseId}_${attachmentId}.pdf`;
}

/**
 * yearly bucket パス（Phase B で利用）
 * @example yearlyPath("2026", "CASE-0001", "aaa-bbb") → "2026/CASE-0001_aaa-bbb.pdf"
 */
export function yearlyPath(
  yyyy: string,
  caseId: string,
  attachmentId: string,
): string {
  return `${yyyy}/${caseId}_${attachmentId}.pdf`;
}
