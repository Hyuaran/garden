# T-F10-03: DetailModal 販管費 8 項目セクション実装指示書

- 対象: Garden-Forest F10 Detail Modal の HANKANHI 拡張
- 見積: **0.5d**（約 4 時間）
- 担当セッション: a-forest
- 作成: 2026-04-24（a-auto / Phase A 先行 batch2 #T-F10-03）
- 元資料: `docs/specs/2026-04-24-forest-hankanhi-migration.sql`（P08）, `docs/specs/2026-04-24-forest-v9-vs-tsx-comparison.md` §4.10

---

## 1. スコープ

### 作る
- 既存 `DetailModal.tsx` に **販管費内訳 8 項目セクション**を追加
- 8 項目: 役員報酬 / 給与手当 / 接待交際費 / 会議費 / 旅費交通費 / 販売促進費 / 地代家賃 / 支払報酬料
- v9 L1996-2012 と同等の見た目（既存 mg-grid 2 列 + mg-divider + mg-section-label）
- `forest_hankanhi` テーブルからのデータ取得（`fetchHankanhi` 関数）
- **いずれかが non-null の場合のみセクション表示**

### 作らない
- 販管費の編集 UI（表示のみ、Phase B 以降で検討）
- 販管費の追加科目（8 固定、9 番目以降は Phase 後期）
- PDF からの HANKANHI 自動抽出（本 spec 範囲外、a-forest 別タスク）

---

## 2. 前提

| 依存 | 内容 |
|---|---|
| **P08 migration 投入済** | `forest_hankanhi` テーブル + サンプルデータ（hyuaran ki7-9, centerrise ki5-6, linksupport ki4, arata ki4-5, taiyou ki3-4）|
| 既存コンポーネント | `DetailModal.tsx`（主要 6 項目 + Drive リンクは実装済）|
| 既存型 | `CellData`（`_constants/companies.ts`）|
| 既存関数 | `fmtYen`（`_lib/format.ts`）|

---

## 3. ファイル構成

### 新規
なし（既存拡張のみ）

### 変更
- `src/app/forest/_lib/types.ts` — `Hankanhi` 型追加
- `src/app/forest/_lib/queries.ts` — `fetchHankanhi` 追加
- `src/app/forest/_state/ForestStateContext.tsx` — `hankanhiCache` 追加、`fetchHankanhiFor(companyId, ki)` wrapper
- `src/app/forest/_components/DetailModal.tsx` — 販管費セクション追加

---

## 4. 型定義

```typescript
// src/app/forest/_lib/types.ts 追加
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

// 販管費表示用のラベル定義
export const HANKANHI_LABELS: { key: keyof Pick<Hankanhi,'yakuin'|'kyuyo'|'settai'|'kaigi'|'ryohi'|'hanbai'|'chidai'|'shiharai'>; label: string }[] = [
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

### Step 1: queries.ts に fetchHankanhi を追加
```typescript
// src/app/forest/_lib/queries.ts 追加
import type { Hankanhi } from './types';

export async function fetchHankanhi(companyId: string, ki: number): Promise<Hankanhi | null> {
  const { data, error } = await supabase
    .from('forest_hankanhi')
    .select('*')
    .eq('company_id', companyId)
    .eq('ki', ki)
    .maybeSingle();

  if (error) throw new Error(`fetchHankanhi(${companyId}, ki=${ki}) failed: ${error.message}`);
  return data as Hankanhi | null;
}
```

### Step 2: DetailModal 内で取得（useEffect）
```typescript
// DetailModal.tsx の冒頭に追加
const [hankanhi, setHankanhi] = useState<Hankanhi | null>(null);
const [hankanhiLoading, setHankanhiLoading] = useState(false);

useEffect(() => {
  let cancelled = false;
  setHankanhiLoading(true);
  fetchHankanhi(data.company.id, data.ki)
    .then(result => { if (!cancelled) setHankanhi(result); })
    .catch(err => {
      console.error('[DetailModal] fetchHankanhi error:', err);
      if (!cancelled) setHankanhi(null);
    })
    .finally(() => { if (!cancelled) setHankanhiLoading(false); });
  return () => { cancelled = true; };
}, [data.company.id, data.ki]);

// データ有無判定
const hasAnyHankanhi = hankanhi != null &&
  HANKANHI_LABELS.some(({ key }) => hankanhi[key] != null);
```

### Step 3: セクション描画
既存の主要 6 項目テーブル直後に以下を追加：
```tsx
{hasAnyHankanhi && hankanhi && (
  <>
    <div style={{ borderTop: '1px solid #e0e0e0', margin: '12px 0' }} />
    <div style={{ fontSize: 12, color: FOREST_THEME.textMuted, fontWeight: 600, marginBottom: 6 }}>
      販管費内訳
    </div>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        {HANKANHI_LABELS.map(({ key, label }) => (
          <tr key={key}>
            <td style={{
              padding: '6px 0',
              fontSize: 13,
              color: FOREST_THEME.textSecondary,
              borderBottom: '1px solid #f5f5f5',
            }}>
              {label}
            </td>
            <td style={{
              padding: '6px 0',
              fontSize: 13,
              textAlign: 'right',
              fontWeight: 500,
              color: FOREST_THEME.textPrimary,
              borderBottom: '1px solid #f5f5f5',
            }}>
              {fmtYen(hankanhi[key])}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </>
)}
```

### Step 4: reflected note（進行期 `※2026/3まで反映中`）
[P07 §4.10] 別項目として、進行期の reflected テキストを既存のヘッダー近くに追加：
```tsx
{data.isShinkouki && data.reflected && (
  <span style={{ fontSize: 11, color: FOREST_THEME.negative, marginLeft: 8 }}>
    ※{data.reflected}
  </span>
)}
```
（本 spec の範囲。ただし `CellData` に `reflected` フィールドが無ければ先に追加が必要。MicroGrid から渡す値を確認）

### Step 5: 手動テスト
1. ヒュアラン ki7（販管費全 8 項目あり）→ セクション表示、全値表示
2. センターライズ ki5（役員/会議/地代 が null）→ 「―」表示されるが、他が non-null なのでセクション表示
3. たいよう ki3（全 null）→ **セクション非表示**
4. 進行期（HANKANHI データ無し）→ セクション非表示

---

## 6. データソース

| 種類 | 情報源 | 操作 |
|---|---|---|
| Supabase | `forest_hankanhi` | SELECT where company_id AND ki |
| Props | `DetailModal` の `data: CellData` | `data.company.id`, `data.ki`, `data.isShinkouki`, `data.reflected` |

---

## 7. UI 仕様

### 配置
```
┌─ DetailModal ────────────────┐
│ [法人ドット] 法人名 第N期   │
│ YYYY/M~YYYY/M [進行期タグ ※reflected]
│                              │
│ 売上高       ¥X億              │
│ 外注費       ¥X億              │
│ 経常利益     ¥X億              │
│ 純資産       ¥X億              │
│ 現金         ¥X万              │
│ 預金         ¥X億              │
│ ────── (divider) ──────        │
│ 販管費内訳                     │  ← 新規追加
│ 役員報酬     ¥X万              │
│ 給与手当     ¥X万              │
│   ...（全 8 項目）             │
│ 支払報酬料   ¥X万              │
│                              │
│ [決算書を開く]  [閉じる]     │
└──────────────────────────────┘
```

### スタイル方針
- **既存 DetailModal のインラインスタイルに合わせる**（Tailwind 混在を避け、既存との一貫性優先）
- 色・フォントサイズは既存 6 項目のテーブルと同等
- divider は `#e0e0e0`（v9 準拠）

### ローディング状態
`hankanhiLoading=true` のとき:
- セクション自体を描画しない（空き時間でフェードインするより、突然現れる方が負担少ない）
- モーダル全体のスピナーは不要

---

## 8. エラーハンドリング

| # | 想定 | 対応 |
|---|---|---|
| E1 | `fetchHankanhi` が RLS で 403 | console.error + セクション非表示（ユーザー体験への影響小）|
| E2 | 該当行なし（data null）| `hasAnyHankanhi=false` でセクション非表示 |
| E3 | 部分的に null | 各行に `―` で fallback、セクションは維持 |
| E4 | `updated_at` が古い | 警告等は出さない（HANKANHI は手動入力が正）|

---

## 9. 権限・RLS

P08 migration SQL の RLS 準拠:
- **SELECT**: `forest_is_user()` （forest_users 登録済 = 全ユーザー閲覧可）
- **INSERT/UPDATE/DELETE**: `forest_is_admin()` （本 spec では読取のみのため UI 非提供）

---

## 10. テスト観点（§16 7種テスト）

| # | テスト種別 | 観点 |
|---|---|---|
| 1 | 機能網羅 | 全 4 シナリオ（全値あり / 部分あり / 全 null / データ無し）|
| 2 | エッジケース | ki 0・負数、存在しない company_id（RLS 対応）|
| 3 | 権限 | toss 以上（= `forest_is_user`）で閲覧可、非 forest_user は 403 |
| 4 | データ境界 | 巨大額（兆円単位）、0 円、負数 |
| 5 | パフォーマンス | モーダル開いてから HANKANHI 表示まで 500ms 以内 |
| 6 | Console | エラー無し |
| 7 | a11y | table に caption / scope 追加（既存の主要6項目テーブルにも同時適用推奨）|

---

## 11. 関連参照

- **P08 migration SQL**: [docs/specs/2026-04-24-forest-hankanhi-migration.sql](2026-04-24-forest-hankanhi-migration.sql)
- **P07 v9 vs TSX §4.10**: DetailModal 差分（既存主要6項目は実装済、HANKANHI 未実装）
- **v9 HTML L1996-2012**: HANKANHI 描画ロジック
- **既存 DetailModal.tsx**: [src/app/forest/_components/DetailModal.tsx](../../../src/app/forest/_components/DetailModal.tsx)
- **format.ts `fmtYen`**: 既存流用

---

## 12. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | ローディング中のスケルトン表示 | **不要**（HANKANHI はオプション情報、表示されてから見るで OK）|
| 判2 | `hankanhi` を `ForestStateContext` にキャッシュするか | **個別 fetch で可**（モーダル開閉時のみ、キャッシュのメリット小）|
| 判3 | 将来の科目追加への拡張性 | 現状 8 カラム固定、9 番目以降は別 spec（判1 の「科目マスタ化」検討） |
| 判4 | reflected note の色と位置 | v9 の赤字 ※ 準拠（`FOREST_THEME.negative`）|
| 判5 | `CellData.reflected` フィールドの所在 | `MicroGrid.tsx` で shinkouki.reflected を渡す実装の有無を要確認（なければ本タスク内で修正）|

— end of T-F10-03 spec —
