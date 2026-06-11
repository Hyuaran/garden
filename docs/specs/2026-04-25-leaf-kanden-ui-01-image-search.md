# Leaf 関電 UI #01: 画像検索機能（8 条件複合検索 + サムネグリッド）

- 対象: Garden-Leaf 関電業務委託の画像検索画面（新規追加）
- 優先度: **🔴 最高**（Batch 13 中最重要、現場責任者要望）
- 見積: **1.5d 実装** / 0.3d spec
- 担当セッション: a-leaf
- 作成: 2026-04-25（a-auto 002 / Batch 13 Leaf 関電 UI #01）
- 前提:
  - Batch 8 Leaf 関電 Phase C（PR #29）の `soil_kanden_cases` テーブル
  - `soil_kanden_cases_files` 添付ファイル（Storage `leaf-kanden-attachments`）
  - 事業スコープ運用（`leaf_user_in_business('kanden')` 全員全件アクセス）
  - spec-cross-storage（Batch 7、署名 URL 短期発行）
  - spec-cross-ui-03（Canvas 圧縮パターン）

---

## 1. 目的とスコープ

### 目的

現場責任者の要望「**お客様番号や住所等から該当案件を画像付きで素早く絞り込みたい**」を実現するため、8 条件複合検索 + サムネグリッド表示の画像検索画面を新設する。

### 含める

- 検索 UI（フィルターバー + 結果サムネグリッド）
- 8 条件の検索仕様
- 全文検索 vs 条件別インデックスの設計
- 検索結果のページング・ソート
- サムネ生成と署名 URL 発行
- 検索ヒストリー（直近 10 件）
- パフォーマンス最適化（253 万件 / 添付 100 万件想定）

### 含めない

- 画像本体表示の詳細（C-02 backoffice-ui で対応済）
- 画像アップロード UI（既存 input-ui）
- スマホ専用 UI（#02 で別途、本 spec はレスポンシブ対応のみ）

---

## 2. 8 検索条件の仕様

### 2.1 検索条件一覧

| # | 条件 | 検索対象列 | 一致方式 |
|---|---|---|---|
| 1 | PD 番号 | `soil_kanden_cases.pd_number` | 完全一致 + 前方一致 |
| 2 | お客様番号 | `customer_number` | 完全一致 + 前方一致 |
| 3 | 供給地点番号 | `supply_point_22` | 完全一致 + 前方一致 |
| 4 | 電話番号・携帯番号 | `customer_phone` / `customer_phone_mobile` | 部分一致（ハイフン除去）|
| 5 | 住所 | `customer_address` | **部分一致**（●●市等）|
| 6 | リスト名前（漢字・カナ）| `list_name` / `list_name_kana` | 部分一致 |
| 7 | 申込者名前（漢字・カナ）| `applicant_name` / `applicant_name_kana` | 部分一致 |
| 8 | 代表者名前（漢字・カナ）| `representative_name` / `representative_name_kana` | 部分一致 |

### 2.2 列追加（既存テーブル拡張）

```sql
-- supabase/migrations/20260601_01_kanden_search_columns.sql
ALTER TABLE soil_kanden_cases
  ADD COLUMN IF NOT EXISTS customer_phone_mobile text,
  ADD COLUMN IF NOT EXISTS list_name text,
  ADD COLUMN IF NOT EXISTS list_name_kana text,
  ADD COLUMN IF NOT EXISTS applicant_name text,
  ADD COLUMN IF NOT EXISTS applicant_name_kana text,
  ADD COLUMN IF NOT EXISTS representative_name text,
  ADD COLUMN IF NOT EXISTS representative_name_kana text;
```

### 2.3 複合 AND 検索

- 8 条件すべて AND 結合
- 入力なしの条件は無視
- 全条件未入力時は「最近 30 日の案件」をデフォルト表示

---

## 3. 検索 UI 設計

### 3.1 画面構成（`/leaf/kanden/search`）

```
┌─────────────────────────────────────────────────┐
│ 関電 案件 画像検索                                │
├─────────────────────────────────────────────────┤
│ フィルターバー（折りたたみ可、デフォルト展開）    │
│ ┌─────────────────────────────────────────────┐ │
│ │ PD番号:    [          ]                     │ │
│ │ お客様番号: [          ]                     │ │
│ │ 供給地点番号:[                          ]    │ │
│ │ 電話番号:  [          ]                     │ │
│ │ 住所:      [          ] (部分一致)           │ │
│ │ リスト名:  [          ] [カナ:        ]      │ │
│ │ 申込者名:  [          ] [カナ:        ]      │ │
│ │ 代表者名:  [          ] [カナ:        ]      │ │
│ │                                             │ │
│ │ [クリア]  [履歴]  [検索 →]                  │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ 結果: 全 128 件（0.6 秒）  ソート: [新しい順 ▼] │
│                                                 │
│ ┌──────┬──────┬──────┬──────┐                   │
│ │ 案件 │ 案件 │ 案件 │ 案件 │                   │
│ │ 001  │ 002  │ 003  │ 004  │                   │
│ │ サムネ│ サムネ│ サムネ│ サムネ│                   │
│ │ 顧客 │ 顧客 │ 顧客 │ 顧客 │                   │
│ │ 名前 │ 名前 │ 名前 │ 名前 │                   │
│ └──────┴──────┴──────┴──────┘                   │
│ ...                                             │
│ [前へ]  1 / 8  [次へ]                           │
└─────────────────────────────────────────────────┘
```

### 3.2 フィルターバー UX

- **遅延検索**（debounce 500ms）: 入力中に毎回 API 投げない
- 全角 → 半角自動変換（電話番号・PD 番号・お客様番号）
- カナ列は半角カナ自動全角化、UI 表示は全角統一
- 未入力フィールドは検索条件から除外

### 3.3 結果グリッド

| breakpoint | 列数 |
|---|---|
| < 768px（mobile） | 2 列 |
| 768-1024px（tablet）| 3 列 |
| 1024-1440px（desktop）| 4 列 |
| > 1440px（wide）| 6 列 |

各サムネカードに表示:

- 添付の代表サムネ（最初の画像 or PDF 1 ページ目）
- 顧客名（漢字 + カナ）
- ステータスバッジ（8 段階）
- お客様番号 / 供給地点番号
- 削除済バッジ（`deleted_at IS NOT NULL` の場合、誤削除認識用）
- クリックで案件詳細モーダル（既存 C-02 流用）

### 3.4 検索ヒストリー

- 直近 10 件の検索条件を `localStorage` に保存
- 「履歴」ボタンで一覧表示、クリックで条件再入力
- ユーザーごと（`employee_id` キー込み）

---

## 4. インデックス設計

### 4.1 単純インデックス（前方一致・完全一致）

```sql
-- 番号系（完全一致 + 前方一致）
CREATE INDEX IF NOT EXISTS idx_skc_pd_number ON soil_kanden_cases (pd_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_skc_customer_number ON soil_kanden_cases (customer_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_skc_supply_point ON soil_kanden_cases (supply_point_22) WHERE deleted_at IS NULL;
```

### 4.2 部分一致用 trigram インデックス（pg_trgm 拡張）

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_skc_address_trgm ON soil_kanden_cases USING gin (customer_address gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_skc_list_name_trgm ON soil_kanden_cases USING gin (list_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_skc_applicant_trgm ON soil_kanden_cases USING gin (applicant_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_skc_representative_trgm ON soil_kanden_cases USING gin (representative_name gin_trgm_ops);
```

### 4.3 電話番号の正規化

- ハイフン除去した値を別列 `customer_phone_normalized` に保存（Trigger で自動更新）
- 検索時もハイフン除去後で比較

```sql
ALTER TABLE soil_kanden_cases
  ADD COLUMN IF NOT EXISTS customer_phone_normalized text
    GENERATED ALWAYS AS (regexp_replace(coalesce(customer_phone, ''), '[-\s]', '', 'g')) STORED;

CREATE INDEX IF NOT EXISTS idx_skc_phone_norm ON soil_kanden_cases (customer_phone_normalized);
```

### 4.4 性能見積

| 件数 | インデックス | 目標応答 |
|---|---|---|
| 全 253 万件中 1 条件絞込 | 単純 index | < 50ms |
| 部分一致（trigram）| gin index | < 200ms |
| 8 条件 AND | 複合 | < 300ms |
| サムネ取得（10 件分の署名 URL）| 並列 | < 500ms |

---

## 5. サムネ生成と表示

### 5.1 サムネ事前生成

Storage アップロード時に **2 サイズ**のサムネを自動生成：

| サイズ | 用途 | 寸法 |
|---|---|---|
| `_thumb_sm` | グリッド表示 | 200×200 |
| `_thumb_md` | プレビューモーダル | 800×800 |

```ts
// 既存 Storage upload Server Action 拡張
export async function uploadKandenAttachment(file: File, caseId: string) {
  // 1. 元画像保存
  const original = await supabase.storage
    .from('leaf-kanden-attachments')
    .upload(`${caseId}/orig/${filename}`, file);

  // 2. Canvas でリサイズ（200x200）
  const thumbSm = await resizeImage(file, 200, 200);
  await supabase.storage
    .from('leaf-kanden-attachments')
    .upload(`${caseId}/thumbs/${filename}_sm.jpg`, thumbSm);

  // 3. プレビュー用（800x800）
  const thumbMd = await resizeImage(file, 800, 800);
  await supabase.storage
    .from('leaf-kanden-attachments')
    .upload(`${caseId}/thumbs/${filename}_md.jpg`, thumbMd);
}
```

### 5.2 PDF 1 ページ目のサムネ化

- `pdf-lib` で 1 ページ目を canvas に描画 → JPEG 化
- 既存添付画像と同列に表示

### 5.3 署名 URL の一括発行

```ts
async function getThumbnailUrls(caseIds: string[]): Promise<Map<string, string>> {
  const files = await supabase.from('soil_kanden_cases_files')
    .select('case_id, storage_key')
    .in('case_id', caseIds)
    .order('uploaded_at', { ascending: true })
    .limit(1, { foreignTable: 'case_id' });  // 案件ごと 1 件のみ

  const promises = files.map(async f => {
    const thumbKey = f.storage_key.replace('/orig/', '/thumbs/').replace(/(\.\w+)$/, '_sm.jpg');
    const { data } = await supabase.storage
      .from('leaf-kanden-attachments')
      .createSignedUrl(thumbKey, 600);  // 10 分
    return [f.case_id, data?.signedUrl];
  });

  const results = await Promise.all(promises);
  return new Map(results.filter(([_, url]) => url) as [string, string][]);
}
```

### 5.4 添付がない案件のフォールバック

- ステータス別のデフォルトアイコン表示
- 「画像なし」と明示

---

## 6. ページング・ソート

### 6.1 ページング

- 1 ページ 24 件（4 列 × 6 行）
- offset ベース（`limit 24 offset N`）
- 大量結果時は無限スクロール非採用（cursor が必要なため Phase 2）

### 6.2 ソート

| ソート | カラム | 既定 |
|---|---|---|
| 新しい順 | `ordered_at DESC` | ✅ |
| 古い順 | `ordered_at ASC` | |
| ステータス順 | `status, ordered_at DESC` | |
| 顧客名順 | `customer_name` | |

---

## 7. 検索ヒストリー

### 7.1 localStorage キー

```
leaf-kanden-search-history-v1
[
  {
    timestamp: "2026-04-25T10:30:00Z",
    conditions: { customer_address: "大阪市", representative_name: "山田" },
    result_count: 12
  },
  ...
]
```

### 7.2 制限

- 最大 10 件保持（FIFO）
- ユーザー側でクリア可能
- ブラウザ間で同期しない（Phase 2 で DB 保存検討）

---

## 8. 削除済表示

### 8.1 デフォルトの可視化

- 削除済（`deleted_at IS NOT NULL`）も結果に含める
- カードに **🗑️ 削除済** バッジ表示
- グレースケールで明度低下
- クリック時は `confirm("削除済の案件です。閲覧しますか？")` で確認

### 8.2 フィルター切替

```
○ 削除済を含めて表示（既定）
○ 削除済のみ表示
○ 削除済を除外
```

manager+ のみ「削除済を除外」可（誤削除認識防止のため）

### 8.3 物理削除済（admin のみ）

- 物理削除（`DELETE FROM`）した案件は検索結果に出ない
- admin 専用画面で過去のレコードログのみ参照

---

## 9. RLS と権限

### 9.1 事業スコープ運用準拠

- `leaf_user_in_business('kanden')` が true の従業員 → **全件閲覧**
- 階層ロール無視、kanden 業務に従事するすべての staff/toss/closer/cs/outsource

### 9.2 検索画面アクセス権限

```sql
-- /leaf/kanden/search への直接 SELECT 許可
CREATE POLICY skc_search_kanden_users ON soil_kanden_cases FOR SELECT
  USING (leaf_user_in_business('kanden') AND is_user_active());
```

### 9.3 外注（contract_end_on）の自動遮断

- `is_user_active()` 関数（Root A-3-g 予定）で **契約終了日以降の outsource はアクセス拒否**
- 外注が誤って退社後にログインしても、検索結果が空になる

---

## 10. 実装ステップ

1. **Step 1**: 列追加 migration（list_name / applicant_name / representative_name 等）（0.5h）
2. **Step 2**: pg_trgm 拡張 + GIN インデックス（0.5h）
3. **Step 3**: サムネ事前生成（Storage アップロード時 hook、2 サイズ）（2h）
4. **Step 4**: 検索 Server Action（条件組立 + クエリ実行）（2h）
5. **Step 5**: 検索 UI（フィルターバー + サムネグリッド）（3h）
6. **Step 6**: 検索ヒストリー（localStorage）（0.5h）
7. **Step 7**: 削除済可視化 + フィルター切替（0.5h）
8. **Step 8**: パフォーマンス検証（253 万件 dev）+ 結合テスト（2h）
9. **Step 9**: モバイル対応（#03 連携）（0.5h）

**合計**: 約 **1.5d**（約 12h）

---

## 11. パフォーマンス要件

| シナリオ | 目標 | 計測 |
|---|---|---|
| 1 条件検索（PD 番号）| < 50ms | k6 |
| 8 条件 AND（trigram）| < 500ms | k6 |
| サムネ 24 件並列取得 | < 1s | Network tab |
| 全体検索 → 結果表示 | < 2s | Lighthouse |
| ファイル 100 万件規模で部分一致 | < 1s | EXPLAIN ANALYZE |

---

## 12. テスト観点

- 8 条件全パターン（単条件 / 2-3 条件組合 / 全条件）
- 部分一致の全角・半角・カナ変換
- ハイフン入り電話番号
- 削除済の表示・非表示切替
- サムネが添付ない案件のフォールバック
- ページング（最後ページ + 1 件）
- ソート切替
- 履歴の 10 件上限と FIFO
- RLS: kanden 業務外のユーザーが直接 URL 入力 → 拒否
- 外注 contract_end_on 後のアクセス拒否

---

## 13. 判断保留事項（東海林さん確認）

- **判1: 部分一致 vs 全文検索**
  - pg_trgm（部分一致）/ tsvector（全文検索エンジン）
  - **推定スタンス**: pg_trgm（実装容易、日本語対応も部分的にあり）。Phase 2 で全文検索検討
- **判2: 検索ヒストリーの DB 保存**
  - localStorage / DB
  - **推定スタンス**: Phase 1 は localStorage、Phase 2 で DB（`bud_search_history` テーブル新設）
- **判3: サムネ生成の同期 / 非同期**
  - アップロード時に同期生成 / Cron バッチで非同期
  - **推定スタンス**: 同期（即座に検索可能、UX 優先）、ただし大量バックフィル時は Cron 併用
- **判4: PDF サムネのページ選択**
  - 1 ページ目固定 / 複数ページサムネ
  - **推定スタンス**: 1 ページ目固定（実装容易、99% カバー）
- **判5: 削除済の物理削除タイミング**
  - 30 日 / 90 日 / 永続論理削除
  - **推定スタンス**: 永続論理削除（誤削除認識ルール、メモリ準拠）
- **判6: ソート方法の選択**
  - 既定: 新しい順 / 関連度順
  - **推定スタンス**: 新しい順（業務上、最近案件参照頻度高）
- **判7: 1 ページ件数**
  - 24 / 48 / ユーザー設定可
  - **推定スタンス**: 24 既定、ユーザー設定で 12/24/48 切替可
- **判8: 8 条件以外の追加要望**
  - 営業担当 / 期間絞込 / ステータス絞込
  - **推定スタンス**: Phase 1 は 8 条件のみ、現場運用で追加要望出たら拡張
- **判9: 全角・半角統一の責任範囲**
  - クライアント側変換 / DB 側 GENERATED 列
  - **推定スタンス**: クライアント側で全角→半角（電話・番号系）、DB は素直に保存

---

## 14. 実装見込み時間の内訳

| 作業 | 見込 |
|---|---|
| 列追加 + 既存データ移行（バックフィル）| 1.0h |
| pg_trgm + GIN インデックス | 0.5h |
| サムネ生成（Canvas + PDF）| 2.5h |
| 検索 Server Action | 2.0h |
| 検索 UI（フィルター + グリッド）| 3.0h |
| 検索ヒストリー + 削除済切替 | 1.0h |
| パフォーマンス検証 | 1.0h |
| モバイル対応（#03 連携）| 0.5h |
| 結合テスト | 0.5h |
| **合計** | **1.5d**（約 12h）|

---

— spec-leaf-kanden-ui-01 end —
