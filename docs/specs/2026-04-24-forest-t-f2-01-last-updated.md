# T-F2-01: ForestShell 最終更新日時表示 実装指示書

- 対象: Garden-Forest F2 Header の補完
- 見積: **0.25d**（約 2 時間）
- 担当セッション: a-forest
- 作成: 2026-04-24（a-auto / Phase A 先行 batch2 #T-F2-01）
- 元資料: `docs/specs/2026-04-24-forest-v9-vs-tsx-comparison.md` §4.2

---

## 1. スコープ

### 作る
- `ForestShell.tsx` のヘッダーに **v9 相当の `update-info` 最終更新日表示**を追加
- 表示内容：`最終更新: YYYY年M月D日`（v9 と同一のフォーマット）
- ソース：`MAX(fiscal_periods.updated_at, shinkouki.updated_at)` の Supabase 側取得値

### 作らない
- 更新履歴の一覧表示
- リアルタイム更新（ページリロード時のみ反映で可）
- 法人別の個別更新日

---

## 2. 前提

| 依存 | 内容 |
|---|---|
| 既存テーブル | `fiscal_periods.updated_at`, `shinkouki.updated_at`（両方とも `timestamptz` カラムが存在する前提） |
| 既存 State | `ForestStateContext` の `companies / periods / shinkouki` が取得済みの状態 |
| 既存コンポーネント | `ForestShell.tsx`（v9 では `gf-header`）|
| 既存ライブラリ | `_lib/queries.ts` の `fetchFiscalPeriods`, `fetchShinkouki` |

**想定**: `updated_at` カラムが未整備なら、本タスク前に ALTER TABLE で追加してください（別タスク扱い）。

---

## 3. ファイル構成

### 新規
- `src/app/forest/_lib/queries.ts` に関数追加（既存ファイル）
  - `fetchLastUpdated(): Promise<Date>` を追加

### 変更
- `src/app/forest/_components/ForestShell.tsx`
- `src/app/forest/_state/ForestStateContext.tsx`（lastUpdated フィールド追加）
- `src/app/forest/_lib/format.ts`（`fmtDateJP(date)` 関数追加、無ければ）

---

## 4. 型定義

```typescript
// src/app/forest/_lib/types.ts（追加）
export type LastUpdatedAt = {
  source: 'fiscal_periods' | 'shinkouki' | 'both';
  at: Date;   // MAX 値
};
```

`ForestStateContext` の state 型:
```typescript
type ForestState = {
  // ...既存...
  lastUpdated: LastUpdatedAt | null;   // 追加
};
```

---

## 5. 実装ステップ

### Step 1: クエリ関数追加
```typescript
// src/app/forest/_lib/queries.ts に追加
export async function fetchLastUpdated(): Promise<LastUpdatedAt> {
  const [fp, sk] = await Promise.all([
    supabase.from('fiscal_periods').select('updated_at').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('shinkouki').select('updated_at').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (fp.error) throw new Error(`fetchLastUpdated fiscal_periods: ${fp.error.message}`);
  if (sk.error) throw new Error(`fetchLastUpdated shinkouki: ${sk.error.message}`);

  const fpAt = fp.data?.updated_at ? new Date(fp.data.updated_at) : null;
  const skAt = sk.data?.updated_at ? new Date(sk.data.updated_at) : null;

  if (!fpAt && !skAt) {
    return { source: 'fiscal_periods', at: new Date(0) };  // フォールバック
  }
  if (fpAt && (!skAt || fpAt >= skAt)) return { source: 'fiscal_periods', at: fpAt };
  if (skAt && (!fpAt || skAt > fpAt)) return { source: 'shinkouki',      at: skAt };

  return { source: 'both', at: fpAt! };  // 同時刻ケース
}
```

### Step 2: ForestStateContext に組込
```typescript
// src/app/forest/_state/ForestStateContext.tsx（refreshData 内）
const refreshData = useCallback(async () => {
  try {
    const [c, p, s, lu] = await Promise.all([
      fetchCompanies(),
      fetchFiscalPeriods(),
      fetchShinkouki(),
      fetchLastUpdated(),   // 追加
    ]);
    setCompanies(c);
    setPeriods(p);
    setShinkoukiData(s);
    setLastUpdated(lu);     // 追加
  } catch (err) {
    console.error('Forest data fetch error:', err);
  }
}, []);
```

### Step 3: フォーマッタ追加
```typescript
// src/app/forest/_lib/format.ts に追加
export function fmtDateJP(d: Date | null): string {
  if (!d || d.getTime() === 0) return '―';
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}年${m}月${day}日`;
}
```

### Step 4: ForestShell.tsx でレンダリング
```typescript
// src/app/forest/_components/ForestShell.tsx（ヘッダー部分）
const { lastUpdated } = useForestState();

// update-info 相当の箇所に
<p className="text-xs opacity-60 mt-1">
  最終更新: {fmtDateJP(lastUpdated?.at ?? null)}
</p>
```

### Step 5: ユニットテスト（任意だが推奨）
`_lib/__tests__/format.test.ts` に `fmtDateJP` のテストを 3 件追加（正常値・null・epoch 0）

---

## 6. データソース

| 種類 | テーブル | カラム |
|---|---|---|
| Supabase | `fiscal_periods` | `updated_at` |
| Supabase | `shinkouki` | `updated_at` |

**RLS**: 既存の `forest_is_user()` ポリシーで SELECT 可能なら追加設定不要。

---

## 7. UI 仕様

### ForestShell ヘッダー内の配置
v9 L975 の `update-info` と同じ位置（subtitle の下）：

```tsx
<header className="gf-header ...">
  <div className="header-inner">
    <div className="brand">...</div>
    <p className="subtitle">個別の「木」の躍動と、...</p>
    <p className="update-info text-xs opacity-60">
      最終更新: {fmtDateJP(lastUpdated?.at ?? null)}
    </p>
    <div className="user-bar">...</div>
  </div>
</header>
```

### Tailwind 方針
- `text-xs opacity-60`（v9 の `font-size: 0.78rem; opacity: 0.6;` 相当）
- 色は既存ヘッダーの白色を継承（明示指定不要）

### レスポンシブ
- 768px 以下でも表示継続（非表示化しない）。狭幅時は改行で対応

---

## 8. エラーハンドリング

| # | エラー | 対応 |
|---|---|---|
| E1 | `fetchLastUpdated` が Supabase エラー | console.error で記録、表示は `―` に fallback |
| E2 | 両テーブルが空 | epoch 0 を返し、UI は `―` 表示 |
| E3 | `updated_at` カラムが存在しない（schema 不整合）| Supabase エラーとして E1 と同扱い、schema 整備を促すログ |

**実装方針**: `ForestStateContext.refreshData` で例外が上がっても**他のデータ取得は継続**（Promise.all ではなく Promise.allSettled 推奨だが、既存実装が Promise.all なので互換のため throw は維持、catch でログのみ）。

---

## 9. 権限・RLS

- 全 `forest_users` 登録済ユーザーが閲覧可
- 編集機能なし（updated_at は INSERT/UPDATE トリガで自動）

---

## 10. テスト観点（§16 7種テスト）

| # | テスト種別 | 観点 |
|---|---|---|
| 1 | 機能網羅 | ページロード時に日付が表示される |
| 2 | エッジケース | 両テーブルが空のとき `―` 表示 |
| 4 | データ境界 | 日付境界（月末、年末）でフォーマットが崩れない |
| 6 | Console エラー | 無し |
| 7 | a11y | `<p>` 要素のため SR は読み上げる（追加対応不要） |

---

## 11. 関連参照

- [v9 HTML L975](https://github.com/Hyuaran/garden/blob/main/…) — `<p class="update-info">最終更新: 2026年4月9日</p>`
- [P07 v9 vs TSX §4.2](2026-04-24-forest-v9-vs-tsx-comparison.md)
- [ForestStateContext.tsx](../../../src/app/forest/_state/ForestStateContext.tsx)
- [ForestShell.tsx](../../../src/app/forest/_components/ForestShell.tsx)（未読、要実装時に確認）

---

## 12. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | 日付フォーマットを JP 形式固定 or i18n 対応 | **JP 固定**（Garden は日本語専用） |
| 判2 | `fetchLastUpdated` の戻り値に `source` を含めるか | **含める**（将来デバッグで有用、UI では未使用） |
| 判3 | 他テーブル（`forest_hankanhi`, `forest_nouzei_schedules` 等）も合算対象に含めるか | **将来対応**（Phase A 内では fiscal_periods + shinkouki のみ） |
| 判4 | `updated_at` トリガが既存テーブルに付いているか | **要確認**（なければ本タスク前に ALTER） |

— end of T-F2-01 spec —
