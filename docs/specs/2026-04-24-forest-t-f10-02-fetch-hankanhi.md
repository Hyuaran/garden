# T-F10-02: _lib/queries.ts に fetchHankanhi 追加 実装指示書

- 対象: Garden-Forest F10 DetailModal 用データ取得関数
- 見積: **0.25d**（約 2 時間、テスト含む）
- 担当セッション: a-forest
- 作成: 2026-04-24（a-auto / Phase A 先行 batch4 #T-F10-02）
- 元資料: T-F10-03（DetailModal HANKANHI 拡張、Batch 2）, P08 HANKANHI migration SQL

---

## 1. スコープ

### 作る
- `_lib/queries.ts` に `fetchHankanhi(companyId: string, ki: number): Promise<Hankanhi | null>` を追加
- `_lib/types.ts` に `Hankanhi` 型定義（T-F10-03 で言及済、正式実装）
- `_lib/__tests__/queries.hankanhi.test.ts` の雛形（a-forest が Supabase mock で埋める前提）

### 作らない
- DetailModal.tsx 側の組込（T-F10-03 の責務）
- HANKANHI の編集 mutation（Phase B 以降）
- `ForestStateContext` へのキャッシュ化（T-F10-03 判2 で「個別 fetch 方針」で合意済）

---

## 2. 前提

| 依存 | 内容 |
|---|---|
| **P08 migration 投入済** | `forest_hankanhi` テーブル + サンプルデータ（hyuaran ki7-9, centerrise ki5-6, linksupport ki4, arata ki4-5, taiyou ki3-4）|
| 既存 `supabase.ts` | Supabase クライアント singleton |
| T-F10-03（Batch 2）| 本 spec を前提とする DetailModal 拡張 |

---

## 3. ファイル構成

### 新規
- `src/app/forest/_lib/__tests__/queries.hankanhi.test.ts`

### 変更
- `src/app/forest/_lib/types.ts` — `Hankanhi` 型、`HANKANHI_LABELS` 定数
- `src/app/forest/_lib/queries.ts` — `fetchHankanhi` 関数
- `src/app/forest/_lib/queries.ts` — `fetchHankanhiBatch(companyId, kis[])` も任意で追加（将来拡張用）

---

## 4. 型定義

T-F10-03 §4 と完全一致させる（重複定義を避ける）：

```typescript
// src/app/forest/_lib/types.ts に追加
export type Hankanhi = {
  id: string;
  company_id: string;
  fiscal_period_id: string | null;
  ki: number;
  yakuin: number | null;      // 役員報酬
  kyuyo: number | null;       // 給与手当
  settai: number | null;      // 接待交際費
  kaigi: number | null;       // 会議費
  ryohi: number | null;       // 旅費交通費
  hanbai: number | null;      // 販売促進費
  chidai: number | null;      // 地代家賃
  shiharai: number | null;    // 支払報酬料
  source: 'manual' | 'pdf' | 'csv';
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// 販管費 key の型（DetailModal で map 用）
export type HankanhiKey = 'yakuin' | 'kyuyo' | 'settai' | 'kaigi' | 'ryohi' | 'hanbai' | 'chidai' | 'shiharai';

// 表示ラベル配列（DetailModal で利用）
export const HANKANHI_LABELS: { key: HankanhiKey; label: string }[] = [
  { key: 'yakuin',   label: '役員報酬' },
  { key: 'kyuyo',    label: '給与手当' },
  { key: 'settai',   label: '接待交際費' },
  { key: 'kaigi',    label: '会議費' },
  { key: 'ryohi',    label: '旅費交通費' },
  { key: 'hanbai',   label: '販売促進費' },
  { key: 'chidai',   label: '地代家賃' },
  { key: 'shiharai', label: '支払報酬料' },
];
```

---

## 5. 実装ステップ

### Step 1: fetchHankanhi 関数
```typescript
// src/app/forest/_lib/queries.ts に追加
import type { Hankanhi } from './types';

/**
 * 指定の法人 × 期の販管費内訳を取得する。
 * 該当行がない場合は null を返す（エラーではない）。
 *
 * @param companyId - 'hyuaran' 等、companies.id
 * @param ki - 期数（1 以上の整数）
 * @returns Hankanhi または null
 * @throws Supabase エラー発生時（RLS 拒否含む）
 */
export async function fetchHankanhi(
  companyId: string,
  ki: number,
): Promise<Hankanhi | null> {
  // 入力検証
  if (!companyId) {
    throw new Error('fetchHankanhi: companyId is required');
  }
  if (!Number.isInteger(ki) || ki < 1) {
    throw new Error(`fetchHankanhi: ki must be a positive integer, got ${ki}`);
  }

  const { data, error } = await supabase
    .from('forest_hankanhi')
    .select('*')
    .eq('company_id', companyId)
    .eq('ki', ki)
    .maybeSingle();

  if (error) {
    throw new Error(`fetchHankanhi(${companyId}, ki=${ki}) failed: ${error.message}`);
  }

  return data as Hankanhi | null;
}
```

### Step 2: fetchHankanhiBatch（任意、一覧画面等で利用）
```typescript
/**
 * 指定の法人 × 期の配列を一括取得。
 * 存在しない (company_id, ki) の組合せは結果に含まれない（エラーにはしない）。
 *
 * @returns 見つかった Hankanhi の配列
 */
export async function fetchHankanhiBatch(
  requests: Array<{ companyId: string; ki: number }>,
): Promise<Hankanhi[]> {
  if (requests.length === 0) return [];

  // Supabase の in 演算子で効率化（ただし (A, B) 複合キーは直接 in できない）
  // → company_id の unique を抽出 → 全件取得 → クライアント側でフィルタ
  const uniqueCompanies = Array.from(new Set(requests.map(r => r.companyId)));
  const minKi = Math.min(...requests.map(r => r.ki));
  const maxKi = Math.max(...requests.map(r => r.ki));

  const { data, error } = await supabase
    .from('forest_hankanhi')
    .select('*')
    .in('company_id', uniqueCompanies)
    .gte('ki', minKi)
    .lte('ki', maxKi);

  if (error) {
    throw new Error(`fetchHankanhiBatch failed: ${error.message}`);
  }

  // クライアント側で正確に一致するものだけ残す
  const key = (r: { company_id: string; ki: number }) => `${r.company_id}:${r.ki}`;
  const wantedSet = new Set(requests.map(r => `${r.companyId}:${r.ki}`));
  return (data as Hankanhi[]).filter(row => wantedSet.has(key(row)));
}
```

### Step 3: ユニットテスト雛形
```typescript
// src/app/forest/_lib/__tests__/queries.hankanhi.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchHankanhi } from '../queries';
import { supabase } from '../supabase';

vi.mock('../supabase', () => ({
  supabase: { from: vi.fn() },
}));

describe('fetchHankanhi', () => {
  const mockMaybeSingle = vi.fn();
  const mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
  const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });

  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.from as any).mockReturnValue({ select: mockSelect });
  });

  it('returns Hankanhi object when found', async () => {
    const mockData = {
      id: 'x', company_id: 'hyuaran', fiscal_period_id: null, ki: 7,
      yakuin: 6000000, kyuyo: 3335358, settai: 4042193, kaigi: 1128464,
      ryohi: 5170944, hanbai: 101738, chidai: 6714996, shiharai: 1318868,
      source: 'csv', notes: null,
      created_at: '2026-04-24T00:00:00Z', updated_at: '2026-04-24T00:00:00Z',
    };
    mockMaybeSingle.mockResolvedValue({ data: mockData, error: null });

    const result = await fetchHankanhi('hyuaran', 7);
    expect(result).toEqual(mockData);
    expect(supabase.from).toHaveBeenCalledWith('forest_hankanhi');
    expect(mockEq1).toHaveBeenCalledWith('company_id', 'hyuaran');
    expect(mockEq2).toHaveBeenCalledWith('ki', 7);
  });

  it('returns null when not found', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await fetchHankanhi('hyuaran', 999);
    expect(result).toBeNull();
  });

  it('throws when Supabase returns error', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'permission denied' },
    });
    await expect(fetchHankanhi('hyuaran', 7)).rejects.toThrow(/permission denied/);
  });

  it('throws on invalid companyId', async () => {
    await expect(fetchHankanhi('', 7)).rejects.toThrow(/companyId is required/);
  });

  it('throws on invalid ki (zero)', async () => {
    await expect(fetchHankanhi('hyuaran', 0)).rejects.toThrow(/positive integer/);
  });

  it('throws on invalid ki (negative)', async () => {
    await expect(fetchHankanhi('hyuaran', -1)).rejects.toThrow(/positive integer/);
  });

  it('throws on invalid ki (float)', async () => {
    await expect(fetchHankanhi('hyuaran', 7.5)).rejects.toThrow(/positive integer/);
  });
});
```

### Step 4: 動作確認（手動 or Supabase Studio）
```sql
-- Supabase Studio で実行して期待値を確認
SELECT * FROM forest_hankanhi WHERE company_id = 'hyuaran' AND ki = 7;
-- 期待: 1 行、yakuin=6000000 等
```

その後、Next.js 開発サーバで：
```tsx
// 一時的にどこかで呼出（ログ確認用、本番コードには残さない）
const h = await fetchHankanhi('hyuaran', 7);
console.log(h);
```

---

## 6. データソース

| 種類 | テーブル | 操作 |
|---|---|---|
| Supabase | `forest_hankanhi` | SELECT by (company_id, ki) |

---

## 7. UI 仕様

本 spec は queries 層のみで UI なし。T-F10-03 側で表示。

---

## 8. エラーハンドリング

| # | エラー | 対応 |
|---|---|---|
| E1 | companyId 空 | 入力検証で Error throw（呼出側で表示） |
| E2 | ki が非整数 / 0 以下 | 入力検証で Error throw |
| E3 | Supabase RLS 拒否（未登録ユーザー）| Error throw、メッセージに詳細 |
| E4 | 該当行なし | **null 返却**（Error ではない）|
| E5 | ネットワークエラー | Supabase SDK からの Error 伝播 |

**呼出側（T-F10-03 DetailModal）での期待**:
```typescript
try {
  const h = await fetchHankanhi(companyId, ki);
  if (h) setHankanhi(h);
  else setHankanhi(null);       // 該当なしは正常系
} catch (err) {
  console.error(err);
  setHankanhi(null);            // エラー時も UI 非表示にフォールバック
}
```

---

## 9. 権限・RLS

P08 migration で設定済：
- **SELECT**: `forest_is_user()` — forest_users 登録済ユーザー全員
- **INSERT/UPDATE/DELETE**: `forest_is_admin()` — 本 spec は read のみのため無関係

---

## 10. テスト観点（§16 7種テスト）

| # | テスト種別 | 観点 |
|---|---|---|
| 1 | 機能網羅 | Step 3 のテストケース 7 本 |
| 2 | エッジケース | ki が 999（存在しない）/ 巨大値 / 浮動小数 |
| 3 | 権限 | 非 forest_user で RLS 拒否 → Error |
| 4 | データ境界 | yakuin 等が全 null の行、超大額（10 兆）|
| 5 | パフォーマンス | `fetchHankanhi` 1 回 100ms 以内（インデックス効いていれば十分）|
| 6 | Console | 警告なし |

---

## 11. 関連参照

- **P08** [forest-hankanhi-migration.sql](2026-04-24-forest-hankanhi-migration.sql): テーブル定義
- **T-F10-03**（Batch 2）[forest-t-f10-03-hankanhi-detail-modal.md](2026-04-24-forest-t-f10-03-hankanhi-detail-modal.md): 本 spec を利用する側
- **既存 `queries.ts`**: `fetchCompanies / fetchFiscalPeriods / fetchShinkouki / fetchForestUser` のパターン参考

---

## 12. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | fetchHankanhiBatch を Phase A で実装するか | **任意**（本 spec では雛形提示、呼出箇所が明確になったら実装）|
| 判2 | `source` フィールドでの絞り込みメソッド（`fetchHankanhiBySource`）| **不要**（現状 UI で source フィルタ UI なし）|
| 判3 | キャッシュ戦略（SWR / React Query 導入）| **Phase A では素の useState で運用**、Phase B 以降で検討 |
| 判4 | ユニットテスト実行環境（Vitest / Jest） | **Vitest 推奨**（既に Bud モジュールで導入済なら流用、なければ別タスクで設定）|

— end of T-F10-02 spec —
