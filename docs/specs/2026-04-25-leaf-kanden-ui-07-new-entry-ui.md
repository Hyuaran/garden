# Leaf 関電 UI #07: 新規送信 UI（奪還/囲込 2 カラム + 電気ガスセット拡張）

- 対象: 新規案件送信画面の配置変更 + 電気ガスセット対応
- 優先度: **🟡 中**（営業フロー整理、新規取得効率化）
- 見積: **1.0d 実装** / 0.2d spec
- 担当セッション: a-leaf
- 作成: 2026-04-25（a-auto 002 / Batch 13 Leaf 関電 UI #07）
- 前提:
  - Batch 8 関電 Phase C-03 input-ui-enhancement
  - `soil_kanden_cases.acquisition_type`（dakkan / kakoi）

---

## 1. 目的とスコープ

### 目的

新規送信画面を「**奪還（左カラム）**」と「**囲込（右カラム）**」に分け、営業形態が一目でわかるレイアウトに変更。同時に、関電業務委託で扱える「電気＋ガス セット契約」のフォーム要素を追加。

### 含める

- 2 カラムレイアウト（左=奪還 / 右=囲込）
- 電気ガスセット契約のデータモデル拡張
- 送付状況ステータス管理
- 過去履歴参照リンク
- 既存案件との重複検知
- カラム間の入力データ同期（誤クリック対策）

### 含めない

- 既存 Batch 8 C-03 の base UI（共通部分は維持）
- 編集モーダル（C-02 で対応済）

---

## 2. レイアウト変更

### 2.1 現状（Batch 8）

1 カラムで `acquisition_type` をラジオ選択:

```
○ 奪還  ○ 囲込
```

### 2.2 変更後（本 spec）

2 カラムレイアウト:

```
┌──────────────────────┬──────────────────────┐
│  🟢 奪還（左カラム）   │  🟡 囲込（右カラム）   │
├──────────────────────┼──────────────────────┤
│ お客様情報            │ お客様情報            │
│ 顧客名: [          ]  │ 顧客名: [          ]  │
│ 電話: [            ]  │ 電話: [            ]  │
│ 住所: [            ]  │ 住所: [            ]  │
│                      │                      │
│ 契約内容              │ 契約内容              │
│ 種別: 電気のみ ▼      │ 種別: 電気のみ ▼      │
│ 申込日: [____/__/__]  │ 申込日: [____/__/__]  │
│ 諸元: [           ]   │ 諸元: [           ]   │
│                      │                      │
│ 添付                  │ 添付                  │
│ [📎 ファイル選択]      │ [📎 ファイル選択]      │
│                      │                      │
│ [送信]                │ [送信]                │
└──────────────────────┴──────────────────────┘
```

### 2.3 カラム別の挙動

- 左カラム（奪還）入力 → `acquisition_type = 'dakkan'` で INSERT
- 右カラム（囲込）入力 → `acquisition_type = 'kakoi'` で INSERT
- どちらか一方のみ入力（同時入力時は警告）

### 2.4 モバイル時のレイアウト

```
< 768px:
[奪還] [囲込] ← タブで切替
（横スクロールで両方見えるオプションも）
```

---

## 3. 電気ガスセット拡張

### 3.1 既存データモデルへの列追加

```sql
-- supabase/migrations/20260601_02_kanden_gas_columns.sql
ALTER TABLE soil_kanden_cases
  ADD COLUMN IF NOT EXISTS contract_type text
    CHECK (contract_type IN ('electric_only', 'gas_only', 'electric_gas_set'))
    DEFAULT 'electric_only',

  -- 電気側
  ADD COLUMN IF NOT EXISTS electric_plan_code text,

  -- ガス側
  ADD COLUMN IF NOT EXISTS gas_plan_code text,
  ADD COLUMN IF NOT EXISTS gas_meter_number text,
  ADD COLUMN IF NOT EXISTS gas_supplier text,    -- ガス会社（既存）
  ADD COLUMN IF NOT EXISTS gas_contract_number text;
```

### 3.2 UI フォーム

```
契約種別:
○ 電気のみ
○ ガスのみ
● 電気＋ガス セット

（電気＋ガスセット選択時に展開）
電気プラン: [なっトクパック ▼]
電気契約番号: [          ]

ガス供給会社: [大阪ガス ▼]
ガスプラン: [なっトクプラン ▼]
ガスメーター番号: [          ]
ガス契約番号: [          ]
```

### 3.3 セット契約の特典管理

`bud_kanden_set_discounts` テーブルで割引情報管理（admin 編集可）:

```sql
CREATE TABLE bud_kanden_set_discounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_name        text NOT NULL,           -- 'なっトクパック' 等
  electric_plan   text NOT NULL,
  gas_plan        text NOT NULL,
  discount_amount int,                      -- 月額割引額
  effective_from  date,
  effective_to    date,
  description     text,
  active          boolean NOT NULL DEFAULT true
);
```

UI で電気プラン選択時に対応するガスプランをサジェスト。

---

## 4. 送付状況ステータス管理

### 4.1 既存ステータス（8 段階）

Batch 8 で確立した 8 段階フロー:

```
ordered → ack → submitted → awaiting_entry → entry_done →
awaiting_payment → completed → cancelled
```

### 4.2 送付状況の追加 column

```sql
ALTER TABLE soil_kanden_cases
  ADD COLUMN IF NOT EXISTS shipping_status text
    CHECK (shipping_status IN (
      'not_shipped',       -- 未送付
      'shipped',           -- 送付済
      'received_by_kanden', -- 関電到着確認
      'returned',          -- 返送（不備等）
      'lost'               -- 紛失
    )) DEFAULT 'not_shipped',
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipping_carrier text,    -- 'yu_pack' / 'sagawa' / 'kuroneko' 等
  ADD COLUMN IF NOT EXISTS tracking_number text;
```

### 4.3 UI

新規送信画面に「送付状況」セクション追加:

```
送付状況:
○ まだ送付していない（既定）
○ 送付済
  運送業者: [ゆうパック ▼]
  追跡番号: [          ]
```

送付済の場合、追跡番号で運送業者の追跡 URL に直接リンク。

---

## 5. 過去履歴参照

### 5.1 同顧客の過去案件表示

新規入力時に**顧客名 / 電話番号**で既存案件を検索、過去履歴があれば表示:

```
┌──────────────────────────────────────────────┐
│ 📋 過去の関連案件 (3 件見つかりました)         │
│                                              │
│ • #001 (2025-12-15 完了) 電気のみ             │
│   ステータス: 完了  奪還  山田太郎             │
│ • #042 (2026-02-10 進行中) 電気＋ガス        │
│   ステータス: 入金待ち  囲込  山田太郎         │
│ • #105 (2026-04-20 受付) 電気のみ            │
│   ステータス: ordered  奪還  山田太郎         │
│                                              │
│ ⚠️ 重複案件の可能性。再確認してください。       │
└──────────────────────────────────────────────┘
```

### 5.2 検出ロジック

```sql
-- 同電話番号の過去 1 年案件
SELECT case_id, case_number, status, contract_type, ordered_at
FROM soil_kanden_cases
WHERE customer_phone = :input_phone
  AND ordered_at >= now() - interval '1 year'
  AND deleted_at IS NULL
ORDER BY ordered_at DESC
LIMIT 5;
```

### 5.3 表示条件

- 入力中（debounce 500ms）
- 1 件以上ヒットした場合のみカード表示
- 重複案件は赤色強調

---

## 6. カラム間の入力同期と誤クリック対策

### 6.1 同時入力の検知

両カラムに入力がある状態で「送信」ボタン押下時:

```
モーダル表示:
"奪還カラムと囲込カラムの両方に入力されています。
どちらを送信しますか？"

[奪還を送信] [囲込を送信] [キャンセル]
```

### 6.2 入力データのコピー機能

「囲込」入力中に「奪還」フォームへコピー機能:

```
[← このデータを奪還カラムにコピー]
```

誤って囲込に入れた情報を奪還に簡単に移せる。

### 6.3 確認ダイアログ

送信前の最終確認:

```
"奪還案件として送信します:
- 顧客: 山田太郎
- 契約: 電気＋ガス セット
- 諸元: ...

[キャンセル] [送信]"
```

---

## 7. レスポンシブ対応

### 7.1 ブレークポイント

| 幅 | レイアウト |
|---|---|
| < 768 | タブ切替（奪還 / 囲込） |
| 768-1024 | 2 カラム（縮小） |
| > 1024 | 2 カラム（標準） |

### 7.2 モバイル UX

- タブ間は **スワイプ切替**
- フォーム送信時にバリデーション、エラーは現タブで表示
- 過去履歴カードはタブ下の単一エリアに表示（左右共通）

---

## 8. 実装ステップ

1. **Step 1**: 列追加 migration（contract_type / gas 系 / shipping）（0.5h）
2. **Step 2**: 2 カラムレイアウト（奪還 / 囲込）（2h）
3. **Step 3**: 電気ガスセットフォーム（条件展開）（1.5h）
4. **Step 4**: 送付状況セクション（0.5h）
5. **Step 5**: 過去履歴参照（debounce 検索 + カード表示）（1.5h）
6. **Step 6**: 同時入力検知 + コピー機能（1h）
7. **Step 7**: モバイル対応（タブ切替 + スワイプ）（1h）
8. **Step 8**: 結合テスト（0.5h）

**合計**: 約 **1.0d**（約 8.5h）

---

## 9. テスト観点

- 奪還のみ / 囲込のみ / 両方入力時の挙動
- 電気のみ / ガスのみ / セット契約のフォーム切替
- 過去履歴の検出（電話番号重複）
- 送付状況の選択・追跡番号
- モバイル時のタブ切替・スワイプ
- カラム間コピー機能
- バリデーション境界（電話番号形式・必須欄）
- 既存案件と重複時の警告表示
- 関電セット割引情報の表示

---

## 10. 判断保留事項

- **判1: 奪還 / 囲込の権限制御**
  - 全員両方可 / 営業形態別制限
  - **推定スタンス**: 全員両方可（事業スコープ運用準拠）
- **判2: 過去履歴の検出範囲**
  - 1 年 / 全期間
  - **推定スタンス**: 1 年（誤検出減、必要時 UI で全期間切替）
- **判3: ガスメーター番号の形式バリデーション**
  - 厳格 / 緩い
  - **推定スタンス**: 緩い（ガス会社により形式異なる）
- **判4: セット割引のリアルタイム計算**
  - 表示のみ / 自動計算
  - **推定スタンス**: 表示のみ（料金計算は関電 API、Garden では参考表示）
- **判5: 送付状況の自動更新**
  - 運送業者 API 連携 / 手動更新
  - **推定スタンス**: Phase 1 手動、Phase 2 で API 連携検討
- **判6: タブモバイルとデスクトップ 2 カラムの境界**
  - 768 / 900 / 1024
  - **推定スタンス**: 1024（2 カラム表示は十分な幅必要）
- **判7: 過去履歴クリック時の動作**
  - 詳細モーダル / 該当案件画面遷移
  - **推定スタンス**: 詳細モーダル（現入力フォームを保持）

---

## 11. 実装見込み時間の内訳

| 作業 | 見込 |
|---|---|
| migration | 0.5h |
| 2 カラムレイアウト | 2.0h |
| 電気ガスセットフォーム | 1.5h |
| 送付状況 + 追跡番号 | 0.5h |
| 過去履歴検索 | 1.5h |
| 同時入力検知 + コピー | 1.0h |
| モバイル対応 | 1.0h |
| 結合テスト | 0.5h |
| **合計** | **1.0d**（約 8.5h）|

---

— spec-leaf-kanden-ui-07 end —
