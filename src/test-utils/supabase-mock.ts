/**
 * Supabase クエリビルダーを模す連鎖可能なモック。
 *
 * `supabase.from(...).select(...).eq(...).maybeSingle()` のような流暢な呼び出しを
 * 再現するため、各メソッドは既定でチェーン自身を返す。テスト側では終端メソッド
 * (maybeSingle / single / 終端で await する order 等) に `.mockResolvedValue(...)`
 * を設定して `{ data, error }` を返すよう仕込む。
 */

import { vi, type Mock } from "vitest";

export type SupabaseChainMock = {
  select: Mock;
  eq: Mock;
  in: Mock;
  gte: Mock;
  lte: Mock;
  order: Mock;
  limit: Mock;
  maybeSingle: Mock;
  single: Mock;
};

/**
 * 連鎖可能な Supabase クエリビルダーのモックを作る。
 * 既定では全メソッドがチェーン自身を返すので、
 * 好きな深さまで `.select().eq().eq()...` と繋げられる。
 */
export function createSupabaseChain(): SupabaseChainMock {
  const chain = {} as SupabaseChainMock;
  const methods: (keyof SupabaseChainMock)[] = [
    "select",
    "eq",
    "in",
    "gte",
    "lte",
    "order",
    "limit",
    "maybeSingle",
    "single",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  return chain;
}

/**
 * `supabase.from(...)` の代替を作る。テストでは
 * `(supabase.from as Mock).mockImplementation(from)` のように流し込んで使う。
 *
 * @example
 * ```ts
 * const { from, chain } = createSupabaseFromMock();
 * (supabase.from as unknown as Mock).mockImplementation(from);
 * chain.maybeSingle.mockResolvedValue({ data: { id: "x" }, error: null });
 * ```
 */
export function createSupabaseFromMock(): {
  from: Mock;
  chain: SupabaseChainMock;
} {
  const chain = createSupabaseChain();
  const from = vi.fn().mockReturnValue(chain);
  return { from, chain };
}
