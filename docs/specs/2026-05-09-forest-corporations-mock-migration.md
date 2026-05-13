# Forest 6 法人 mock 統合 + GARDEN_CORPORATIONS 参照移行 spec

| 項目 | 値 |
|---|---|
| 起票 | 2026-05-09 a-bloom-005（main- No. 157 §D 採用）|
| 担当セッション（実装）| **a-forest** または **a-bloom-005**（要相談、Forest 側 fetcher 修正は a-forest 推奨）|
| 担当セッション（レビュー）| a-bloom-005 |
| 関連 spec | `docs/specs/2026-05-08-bloom-corporate-icons-chatgpt-prompt.md`（本 spec 親）|
| 関連 module | Forest（経営ダッシュボード）/ Bloom KPI（forest-fetcher 経由）|
| 関連 dispatch | main- No. 157 |
| 工数見積 | 0.3-0.5d |
| 推奨着手 | **5/13 統合テスト前**（5/12 まで）|
| 優先度 | 🟡 中（Phase A-2.1 整合性向上、ハードコード解消）|

---

## 1. 背景と目的

### 1-1. 経緯

- 2026-05-09 main- No. 157 で東海林さんが 6 法人カラーマッピング確定（ピンク/紫/青/橙/黄/赤）
- a-bloom-005 で `src/lib/garden-corporations.ts` に `GARDEN_CORPORATIONS` 配列確定（id / name / icon / color / role）
- 一方、Forest 連携の mock fetcher（`src/app/bloom/kpi/_lib/forest-fetcher.ts`）は **2 法人ハードコード**:

```typescript
const MOCK_CORPORATIONS = [
  { id: "mock-corp-1", name: "株式会社ヒュアラン" },
  { id: "mock-corp-2", name: "ヒュアラングループ HD" },
];
```

→ 6 法人マスタ確定後も mock のみ古い 2 法人定義を保持する状態は **整合性低下**。
→ 5/13 統合テスト前 に **GARDEN_CORPORATIONS 参照に統一** が必要。

### 1-2. 目的

1. Forest mock fetcher の 2 法人ハードコード を **GARDEN_CORPORATIONS 参照に置換**
2. 6 法人すべて mock データ生成（現状 2 法人のみ）
3. カラーテーマも `GARDEN_CORPORATIONS[].color` を流用（Bloom KPI dashboard 視覚一貫性確保）
4. Phase A-2.1 ダッシュボードで「全 6 法人」を表示できる状態にする

### 1-3. 含めないもの

- 本番 Supabase `forest_corporations` テーブルへの 6 法人実データ INSERT（Forest セッション本番作業、別 spec）
- Forest dashboard UI 改修（既存 dashboard が 6 法人対応か別検討、本 spec は mock 整合のみ）
- 法人マスタ Kintone App 28 同期（別 spec）

---

## 2. 影響ファイル

| # | ファイル | 変更内容 |
|---|---|---|
| 1 | `src/app/bloom/kpi/_lib/forest-fetcher.ts` | `MOCK_CORPORATIONS` を `GARDEN_CORPORATIONS` 参照に置換 + 6 法人 mock 生成 |
| 2 | `src/app/bloom/kpi/_lib/__tests__/forest-fetcher.test.ts` | 2 法人 → 6 法人前提のテスト更新 |
| 3 | `src/app/bloom/kpi/_lib/types.ts`（必要なら）| `corporation_color` field 追加検討 |
| 4 | （オプション）`src/app/bloom/kpi/page.tsx` 等 dashboard | カラー表示連動 |

---

## 3. 実装手順（推奨順）

### Step 1: forest-fetcher.ts 改修（0.1d）

```typescript
// Before
const MOCK_CORPORATIONS = [
  { id: "mock-corp-1", name: "株式会社ヒュアラン" },
  { id: "mock-corp-2", name: "ヒュアラングループ HD" },
];

// After
import { GARDEN_CORPORATIONS } from "@/lib/garden-corporations";

// MOCK_CORPORATIONS を残す場合（互換維持）:
// memory feedback_no_delete_keep_legacy.md 厳守 = 旧定義は legacy コメントで残す
/**
 * @deprecated 2026-05-09 GARDEN_CORPORATIONS 参照に移行。
 * 旧 mock-corp-1 / mock-corp-2 の参照が他にある場合は LEGACY_FOREST_MOCK_ID_MAP 経由で互換解決。
 */
const MOCK_CORPORATIONS_LEGACY = [
  { id: "mock-corp-1", name: "株式会社ヒュアラン" },
  { id: "mock-corp-2", name: "ヒュアラングループ HD" },
];

// 新 mock 生成は GARDEN_CORPORATIONS 直接参照
export function buildMockForestData(): ForestKpiData {
  // ... GARDEN_CORPORATIONS.map(corp => ...) で 6 法人 × 6 ヶ月生成
}
```

### Step 2: 6 法人 mock 値生成ロジック調整（0.05d）

現状: 8M-15M 円 × 2 法人 × 6 ヶ月 = 12 行
新規: 各法人の規模感を反映（例）

| 法人 | mock 規模（月次） | 理由 |
|---|---|---|
| ヒュアラン HD | 1,500-2,500 万 | グループ HD 役割 |
| センターライズ | 800-1,500 万 | コール運営収益 |
| リンクサポート | 500-1,000 万 | 業務支援フィー |
| ARATA | 200-600 万 | 新規事業立ち上げ期 |
| たいよう | 1,000-2,000 万 | 関電業務委託の主力 |
| 壱 | 800-1,500 万 | 基幹事業 |

合計 月次: **約 5,000-9,000 万円**（現実感のある社内 KPI demo 値）

### Step 3: types.ts 拡張（必要なら、0.05d）

```typescript
export interface ForestMonthlyRevenue {
  corporation_id: string;
  corporation_name: string;
  /** 2026-05-09 追加: GARDEN_CORPORATIONS[].color と一致 */
  corporation_color?: string;
  year_month: string;
  revenue: number;
}
```

### Step 4: テスト更新（0.1d）

```typescript
// __tests__/forest-fetcher.test.ts
describe("buildMockForestData", () => {
  it("returns 6 corporations × 6 months = 36 rows", () => {
    const data = buildMockForestData();
    expect(data.monthly_revenues).toHaveLength(36);
  });

  it("includes all 6 GARDEN_CORPORATIONS", () => {
    const data = buildMockForestData();
    const ids = new Set(data.monthly_revenues.map(r => r.corporation_id));
    expect(ids.size).toBe(6);
    expect(ids.has("hyuaran")).toBe(true);
    expect(ids.has("centerrise")).toBe(true);
    // ... 全 6 法人
  });

  it("includes corporation_color from GARDEN_CORPORATIONS", () => {
    const data = buildMockForestData();
    const hyuaranRow = data.monthly_revenues.find(r => r.corporation_id === "hyuaran");
    expect(hyuaranRow?.corporation_color).toBe("#F4A6BD");
  });
});
```

### Step 5: Bloom KPI dashboard カラー連動（オプション、0.1d）

`src/app/bloom/kpi/_components/ForestKpiCard.tsx` 等で `corporation_color` を使った視覚装飾（border-color / accent）追加検討。Phase A-2.2 と整合する場合のみ実施。

---

## 4. 互換性

### 4-1. 既存 ID（mock-corp-1 / mock-corp-2）の取扱

- `garden-corporations.ts` の `LEGACY_FOREST_MOCK_ID_MAP` で `mock-corp-1 → hyuaran` / `mock-corp-2 → hyuaran` mapping 済（HD は本体に統合）
- 既存テスト / コンポーネントで `mock-corp-1` / `mock-corp-2` を直接参照している箇所があれば grep で検出 → mapping 経由解決

### 4-2. 本番データ

- 本 spec は **mock のみ対象**
- 本番 `forest_corporations` テーブルの 6 法人 INSERT は別 spec（a-forest セッション、Kintone App 28 連携）
- production fetcher 側（mock 以外の分岐）は本番テーブル参照なので、本 spec の影響範囲外

---

## 5. DoD（Definition of Done）

- [ ] `forest-fetcher.ts` 改修済（`GARDEN_CORPORATIONS` 参照、6 法人 mock 生成）
- [ ] `MOCK_CORPORATIONS_LEGACY` 残置（削除禁止）
- [ ] 6 法人 mock 規模 = 月次合計 5,000-9,000 万円範囲
- [ ] 既存テスト全 PASS（`bloom/kpi/_lib/__tests__/forest-fetcher.test.ts`）
- [ ] 新規 6 法人 アサーション PASS
- [ ] Bloom KPI dashboard で 6 法人棒グラフ表示確認（Chrome MCP）
- [ ] commit + push（5/13 までに）

---

## 6. リスク・注意点

| リスク | 対策 |
|---|---|
| forest-fetcher.ts 動作変更で Phase A-2.1 KPI dashboard が壊れる | テスト全 PASS 前提 + dev で目視確認、不具合あれば即 revert |
| LEGACY_FOREST_MOCK_ID_MAP 不在の参照箇所 | grep "mock-corp-" 全件確認、必要なら mapping 拡張 |
| 本番 forest_corporations テーブル不在で本番モード崩壊 | 本 spec は mock のみ対象、production はフォールバック維持 |
| 6 法人カラーが既存 dashboard の色設計と衝突 | Phase A-2.2 で別途検討、本 spec は color field 追加のみ |

---

## 7. 関連 dispatch / spec / memory

### dispatch
- main- No. 157（5/9 01:17）= 東海林さん新マッピング採用 + 組込指示
- bloom-005- No. 1（5/8 18:21）= KK 案 spec 完成
- bloom-005- No. 4（本 spec 完成報告）

### spec
- 親: `docs/specs/2026-05-08-bloom-corporate-icons-chatgpt-prompt.md`
- TypeScript 定義: `src/lib/garden-corporations.ts`
- Phase A-2.1 plan: `docs/superpowers/plans/2026-05-07-bloom-phase-a2-unified-kpi-dashboard.md`

### memory
- `feedback_no_delete_keep_legacy.md`（旧 MOCK_CORPORATIONS は legacy として残置）
- `project_garden_3layer_visual_model.md`（Forest = 樹冠層、6 法人 = 花の構造）
- `project_garden_dual_axis_navigation.md`（12 モジュール grid + 6 法人軸）

---

## 8. 5/13 統合テスト連動

統合テスト Bloom plan（[plan-bloom-5-13-integration-test-bloom-side-20260508.md](../plan-bloom-5-13-integration-test-bloom-side-20260508.md)）の以下チェック項目に追加:

- [ ] `/bloom/kpi` で 6 法人棒グラフ表示
- [ ] 各法人の corporation_color が GARDEN_CORPORATIONS と一致
- [ ] LEGACY_FOREST_MOCK_ID_MAP 経由の旧 ID 互換動作

5/13 当日の検証で **6 法人マスタ × Bloom KPI dashboard** の通しを確認。
