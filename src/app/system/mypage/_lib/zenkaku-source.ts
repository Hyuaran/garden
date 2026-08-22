import { createValidSalesMasterRecord } from "./zenkaku-check";
import type { DuplicateSalesCase, SalesMasterRecord } from "./zenkaku-check";

export type ZenkakuCheckSource = { record: SalesMasterRecord; duplicates: DuplicateSalesCase[] };

// 次段階でこの境界の実装だけをFileMaker連携へ差し替える。
export async function loadZenkakuCheckSource(salesId: string): Promise<ZenkakuCheckSource> {
  return { record: createValidSalesMasterRecord({ salesId }), duplicates: [] };
}
