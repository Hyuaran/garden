# Leaf 関電 UI #04: 案件質問機能 + 関電 Excel 取込・出力

- 対象: 案件詳細画面の質問機能 + 関電キャリアからの対応依頼 Excel 取込/回答出力
- 優先度: **🔴 最高**（関電キャリアとの双方向業務連携）
- 見積: **2.0d 実装** / 0.4d spec
- 担当セッション: a-leaf
- 作成: 2026-04-25（a-auto 002 / Batch 13 Leaf 関電 UI #04）
- 前提:
  - Batch 8 関電 Phase C（PR #29）の `soil_kanden_cases` テーブル
  - spec-cross-storage（Batch 7、Excel ファイル管理）
  - anthropic-skills:xlsx スキル活用

---

## 1. 目的とスコープ

### 目的

1. **案件ごとの質問・回答履歴**を Garden 内で蓄積可能にする
2. 関電キャリアから受領する**対応依頼 Excel** を取込、Garden 案件と紐付け
3. 回答内容を**関電指定 Excel フォーマット**で出力、関電に返送

### 含める

- 案件質問テーブル（`soil_kanden_questions` / `_answers`）
- 質問・回答 UI（案件詳細モーダル内タブ）
- 関電 Excel 取込（パーサー、Garden 案件マッチング）
- 関電指定フォーマットでの Excel 出力
- 取込履歴管理
- 出力履歴管理（送信ログ）

### 含めない

- 関電 API 直接連携（Phase D 以降）
- 一般 Chatwork 通知（既存 spec-cross-chatwork で対応）

---

## 2. 案件質問機能

### 2.1 ユースケース

- 営業担当者が案件詳細画面で「この顧客の請求書送付先が変わったので関電に確認したい」等の質問を起票
- 事務担当者が回答を入力（関電キャリアに電話確認後等）
- 履歴として案件と紐付けて保管

### 2.2 データモデル

#### `soil_kanden_questions`

```sql
CREATE TABLE soil_kanden_questions (
  question_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id          uuid NOT NULL REFERENCES soil_kanden_cases(case_id) ON DELETE CASCADE,

  -- 質問内容
  category         text NOT NULL CHECK (category IN (
    'address_change',     -- 住所変更
    'name_change',        -- 名義変更
    'plan_inquiry',       -- プラン確認
    'billing_inquiry',    -- 請求関連
    'cancellation',       -- 解約関連
    'other'
  )),
  title            text NOT NULL,
  body             text NOT NULL,
  urgency          text NOT NULL CHECK (urgency IN ('low', 'normal', 'high', 'urgent')) DEFAULT 'normal',

  -- ステータス
  status           text NOT NULL CHECK (status IN ('open', 'answered', 'resolved', 'cancelled')) DEFAULT 'open',
  resolved_at      timestamptz,

  -- 起票者
  asked_by         text NOT NULL REFERENCES root_employees(employee_number),
  asked_at         timestamptz NOT NULL DEFAULT now(),

  -- メタ
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

CREATE INDEX idx_skq_case ON soil_kanden_questions (case_id, asked_at DESC);
CREATE INDEX idx_skq_open ON soil_kanden_questions (status) WHERE status = 'open' AND deleted_at IS NULL;
```

#### `soil_kanden_answers`

```sql
CREATE TABLE soil_kanden_answers (
  answer_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id      uuid NOT NULL REFERENCES soil_kanden_questions(question_id) ON DELETE CASCADE,

  body             text NOT NULL,
  source           text NOT NULL CHECK (source IN (
    'phone_kanden',       -- 関電に電話確認
    'email_kanden',       -- 関電にメール
    'documents',          -- 文書照会
    'internal',           -- 社内判断
    'other'
  )),

  -- 回答者
  answered_by      text NOT NULL REFERENCES root_employees(employee_number),
  answered_at      timestamptz NOT NULL DEFAULT now(),

  -- メタ
  attached_files   jsonb,    -- 添付ファイル参照（Storage キー配列）
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

CREATE INDEX idx_ska_question ON soil_kanden_answers (question_id, answered_at DESC);
```

### 2.3 UI（案件詳細モーダル内タブ）

```
┌─────────────────────────────────────┐
│ 案件詳細 #001                        │
│ [基本情報][質問・回答][添付][履歴]   │ ← タブ
├─────────────────────────────────────┤
│ 質問・回答（3 件）                    │
│                                     │
│ ┌─────────────────────────────┐ │
│ │ 🔴 緊急 [住所変更]             │ │
│ │ 顧客の住所変更があり、請求書送  │ │
│ │ 付先が分からない                │ │
│ │ ⏰ 2026-04-25 10:30 山田太郎    │ │
│ │ 状態: 🟡 回答待ち              │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 回答（1 件）                    │ │
│ │ 関電に電話確認済み、新住所は    │ │
│ │ 大阪府茨木市...                 │ │
│ │ ⏰ 2026-04-25 14:20 鈴木一郎    │ │
│ │ ソース: 電話（関電）             │ │
│ └─────────────────────────────┘ │
│                                     │
│ [新規質問を起票]                     │
└─────────────────────────────────────┘
```

### 2.4 起票・回答フロー

```
1. 起票
   - 案件詳細 → 質問タブ → 「新規質問を起票」
   - カテゴリ・タイトル・本文・緊急度を入力
   - 起票後、Chatwork で関連メンバーに通知（オプション）

2. 回答
   - 質問一覧で「open」状態を確認
   - 回答ボタン → 本文・ソース・添付（オプション）
   - 起票者にChatwork 通知

3. 解決
   - 「解決」ボタンで `resolved` 状態
   - 履歴は永続保存
```

---

## 3. 関電 Excel 取込

### 3.1 ユースケース

- 関電キャリア（関西電力業務管理部）から月次・週次で **対応依頼 Excel** が送られてくる
- 例: 「以下 50 件の案件について、現在の状況と回答を返送してください」
- 取込で Garden 案件と自動マッチング、未マッチは手動紐付け

### 3.2 Excel フォーマット（推定）

関電指定フォーマット（実際は関電キャリアと協議）:

| 列名 | データ |
|---|---|
| 連番 | 1, 2, 3, ... |
| 対応依頼番号 | KAN-2026-0425-001 |
| 顧客番号 | 123456-0 |
| 供給地点番号 | 0123456789012345678901 |
| 顧客名 | 山田太郎 |
| 住所 | 大阪府... |
| 質問内容 | 引越に伴う名義変更 |
| 期限 | 2026-05-10 |

### 3.3 取込テーブル

```sql
CREATE TABLE soil_kanden_external_requests (
  request_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- バッチ情報
  batch_id                uuid NOT NULL,             -- 同一 Excel ファイル内のグループ
  batch_filename          text NOT NULL,             -- 関電 Excel のファイル名
  batch_uploaded_at       timestamptz NOT NULL DEFAULT now(),
  batch_uploaded_by       text NOT NULL REFERENCES root_employees(employee_number),

  -- 関電側情報
  kanden_request_number   text NOT NULL,
  kanden_customer_number  text,
  kanden_supply_point     text,
  kanden_customer_name    text,
  kanden_address          text,

  -- 内容
  question_text           text NOT NULL,
  deadline                date,

  -- マッチング
  matched_case_id         uuid REFERENCES soil_kanden_cases(case_id),
  matched_at              timestamptz,
  matched_by              text REFERENCES root_employees(employee_number),
  match_method            text CHECK (match_method IN ('auto', 'manual', 'unmatched')),

  -- 回答状態
  status                  text NOT NULL CHECK (status IN (
    'pending_match',        -- マッチング待ち
    'matched',              -- マッチ済（回答準備）
    'answered',             -- 回答済
    'sent_to_kanden',       -- 関電に送信済
    'cancelled'
  )),
  answer_text             text,
  answer_at               timestamptz,
  answer_by               text REFERENCES root_employees(employee_number),

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  deleted_at              timestamptz
);

CREATE INDEX idx_sker_batch ON soil_kanden_external_requests (batch_id);
CREATE INDEX idx_sker_status ON soil_kanden_external_requests (status);
CREATE INDEX idx_sker_pending ON soil_kanden_external_requests (status) WHERE status = 'pending_match' AND deleted_at IS NULL;
```

### 3.4 取込処理（Excel パーサー）

```ts
// src/app/leaf/kanden/_actions/importKandenExcel.ts
'use server';

import { read, utils } from 'xlsx';

export async function importKandenExcel(file: File): Promise<ImportResult> {
  // 1. Excel パース
  const buffer = await file.arrayBuffer();
  const workbook = read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = utils.sheet_to_json(sheet, { header: 1 });

  // 2. ヘッダ行検証（既知フォーマットか）
  const headerRow = rows[0] as string[];
  validateKandenHeader(headerRow);

  // 3. データ行を変換
  const requests = rows.slice(1).map(row => parseKandenRow(row));

  // 4. バッチ ID 発行
  const batchId = randomUUID();

  // 5. 自動マッチング
  for (const req of requests) {
    const match = await tryAutoMatch(req);
    if (match) {
      req.matched_case_id = match.case_id;
      req.match_method = 'auto';
      req.status = 'matched';
    } else {
      req.match_method = 'unmatched';
      req.status = 'pending_match';
    }
  }

  // 6. 一括 INSERT
  await supabase.from('soil_kanden_external_requests')
    .insert(requests.map(r => ({ ...r, batch_id: batchId, batch_filename: file.name })));

  return {
    batch_id: batchId,
    total: requests.length,
    matched: requests.filter(r => r.matched_case_id).length,
    unmatched: requests.filter(r => !r.matched_case_id).length,
  };
}

async function tryAutoMatch(req: ExternalRequest): Promise<{ case_id: string } | null> {
  // 優先度: 顧客番号 > 供給地点 > 顧客名 + 住所
  if (req.kanden_customer_number) {
    const { data } = await supabase.from('soil_kanden_cases')
      .select('case_id')
      .eq('customer_number', req.kanden_customer_number)
      .is('deleted_at', null)
      .maybeSingle();
    if (data) return data;
  }
  if (req.kanden_supply_point) {
    const { data } = await supabase.from('soil_kanden_cases')
      .select('case_id')
      .eq('supply_point_22', req.kanden_supply_point)
      .is('deleted_at', null)
      .maybeSingle();
    if (data) return data;
  }
  // マッチなし
  return null;
}
```

### 3.5 マッチング UI

```
┌──────────────────────────────────────────────────┐
│ 関電 Excel 取込結果                                │
│ ファイル: 対応依頼_2026-04-25.xlsx                  │
│ 全 50 件: 🟢 マッチ 38 件 / 🟡 未マッチ 12 件       │
│                                                  │
│ 未マッチ案件（手動マッチング）                      │
│ ┌──────────────────────────────────────────┐  │
│ │ #001 [顧客: 山田太郎]                       │  │
│ │ 供給地点: 0123-4567-8901-2345              │  │
│ │ 質問: 引越に伴う名義変更                     │  │
│ │ [自動マッチ候補なし]                          │  │
│ │ → Garden 案件を検索: [          ] 🔍         │  │
│ │   ┌─────────────────────────────────┐ │  │
│ │   │ ○ 案件 #042 山田太郎（部分一致）  │ │  │
│ │   │ ○ 案件 #105 山田次郎              │ │  │
│ │   └─────────────────────────────────┘ │  │
│ │ [この案件にマッチ] [新規案件として作成]      │  │
│ └──────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

---

## 4. 関電指定 Excel 出力

### 4.1 出力フォーマット

関電キャリアが要求する Excel 出力（実際は協議で確定）:

| 列 | 内容 |
|---|---|
| 対応依頼番号 | 取込時の `kanden_request_number` |
| Garden 案件番号 | `soil_kanden_cases.case_number` |
| 回答内容 | `answer_text` |
| 回答日時 | `answer_at` |
| 担当者 | `answer_by` の氏名 |
| 備考 | `note` |

### 4.2 出力 Server Action

```ts
// src/app/leaf/kanden/_actions/exportKandenAnswers.ts
'use server';

import { utils, writeFile } from 'xlsx';

export async function exportKandenAnswersForBatch(batchId: string): Promise<{ key: string; filename: string }> {
  // 1. 回答済データ取得
  const { data } = await supabase.from('soil_kanden_external_requests')
    .select('*, root_employees!answer_by(name), soil_kanden_cases!matched_case_id(case_number)')
    .eq('batch_id', batchId)
    .eq('status', 'answered')
    .is('deleted_at', null)
    .order('kanden_request_number');

  // 2. Excel ワークブック生成
  const workbook = utils.book_new();
  const sheetData = data.map(r => ({
    '対応依頼番号': r.kanden_request_number,
    'Garden案件番号': r.soil_kanden_cases?.case_number ?? '',
    '回答内容': r.answer_text,
    '回答日時': r.answer_at,
    '担当者': r.root_employees?.name ?? '',
    '備考': r.note ?? '',
  }));
  const sheet = utils.json_to_sheet(sheetData);
  utils.book_append_sheet(workbook, sheet, '回答');

  // 3. ファイル化 + Storage 保存
  const buffer = writeFile(workbook, '/tmp/answers.xlsx', { bookType: 'xlsx', type: 'buffer' });
  const filename = `kanden_answers_${batchId.slice(0, 8)}_${formatDate()}.xlsx`;
  const storageKey = `kanden-export/${filename}`;
  await supabase.storage.from('leaf-kanden-exports').upload(storageKey, buffer);

  // 4. 送信ログ更新
  await supabase.from('soil_kanden_external_requests')
    .update({ status: 'sent_to_kanden' })
    .eq('batch_id', batchId)
    .eq('status', 'answered');

  return { key: storageKey, filename };
}
```

### 4.3 出力 UI

```
┌──────────────────────────────────────────────────┐
│ 関電 Excel 出力                                    │
│                                                  │
│ バッチ: 対応依頼_2026-04-25.xlsx                   │
│ 状態: 回答済 35 件 / 未回答 3 件                    │
│                                                  │
│ ⚠️ 未回答 3 件があります。すべて回答してから出力推奨 │
│                                                  │
│ [✏️ 未回答を確認]                                 │
│ [📤 回答済 35 件のみ Excel 出力]                  │
│ [📤 全 38 件出力（未回答は空欄）]                  │
└──────────────────────────────────────────────────┘
```

### 4.4 ダウンロード方式

- 署名 URL 60 秒（C-02 案 D 準拠）
- 1 度 DL したら新規発行必要
- 監査ログ記録

---

## 5. ダッシュボード（admin 向け）

### 5.1 全バッチ一覧

```
┌──────────────────────────────────────────────────┐
│ 関電 対応依頼 ダッシュボード                       │
│                                                  │
│ ┌──────────────────────────────────────────┐  │
│ │ 期限間近（3 日以内）                         │  │
│ │ ⚠️ 6 件                                    │  │
│ └──────────────────────────────────────────┘  │
│                                                  │
│ ┌──────────────────────────────────────────┐  │
│ │ バッチ      期限        進捗   状態         │  │
│ │ B-2026-04-25 5/10  ████████░ 80% 進行中    │  │
│ │ B-2026-04-18 5/02  █████████ 100% 送信済   │  │
│ └──────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### 5.2 期限管理

- `deadline` 3 日前にマネージャー Chatwork DM 通知
- 期限当日に admin 通知
- 期限超過は赤色強調

---

## 6. 実装ステップ

1. **Step 1**: テーブル migration 3 本（`questions` / `answers` / `external_requests`）+ RLS（1.5h）
2. **Step 2**: 質問・回答 UI（タブ + 起票モーダル + 回答モーダル）（2.5h）
3. **Step 3**: Excel パーサー + 自動マッチングロジック（2.5h）
4. **Step 4**: マッチング UI（未マッチ手動紐付け）（2h）
5. **Step 5**: Excel 出力（指定フォーマット）+ Server Action（2h）
6. **Step 6**: ダッシュボード + 期限管理 Cron（1.5h）
7. **Step 7**: Chatwork 通知連携（起票・回答・期限）（1h）
8. **Step 8**: 結合テスト + 関電サンプル Excel での実証（2h）

**合計**: 約 **2.0d**（約 15h）

---

## 7. パフォーマンス

| 指標 | 目標 |
|---|---|
| Excel 取込（50 件）| < 5s |
| 自動マッチング（50 件並列）| < 3s |
| Excel 出力 | < 5s |
| マッチング UI 表示 | < 1s |

---

## 8. テスト観点

- 質問起票・回答・解決の状態遷移
- カテゴリ全種（6 種）
- 緊急度（4 段階）の表示
- Excel 取込（正常・列ズレ・空行・重複）
- 自動マッチング（顧客番号 / 供給地点 / 名前+住所）
- 未マッチの手動紐付け（複数候補・新規作成）
- Excel 出力（回答済のみ / 全件）
- Chatwork 通知（起票・回答・期限）
- RLS: kanden 業務外ユーザーのアクセス拒否
- 添付ファイルあり時のサイズ・取扱

---

## 9. 判断保留事項

- **判1: 関電 Excel フォーマット** ⭐
  - 公式仕様書なし、関電キャリアと協議
  - **推定スタンス**: サンプル Excel を東海林さんから入手後確定
- **判2: 出力フォーマット** ⭐
  - 関電キャリアが指定 / Garden 側で固定
  - **推定スタンス**: 関電指定（協議事項）
- **判3: 自動マッチングの優先順**
  - 顧客番号 > 供給地点 > 名前+住所 / 他順
  - **推定スタンス**: 顧客番号最優先（一意性高）、名前+住所は曖昧マッチ
- **判4: 未マッチ時の自動「新規案件作成」**
  - 自動 / 手動のみ
  - **推定スタンス**: 手動のみ（誤作成リスク）
- **判5: 質問の Chatwork 通知範囲**
  - 起票者 + admin / 案件担当者全員 / 部署全員
  - **推定スタンス**: 起票者 + 案件担当者
- **判6: 出力済バッチの再出力可否**
  - 不可 / admin 承認で可
  - **推定スタンス**: admin 承認で可（再送要請対応）
- **判7: 質問の保存期間**
  - 永続 / 案件削除と連動
  - **推定スタンス**: 永続（業務履歴として保持、論理削除のみ）
- **判8: Excel パーサーライブラリ**
  - xlsx（SheetJS）/ exceljs / 他
  - **推定スタンス**: xlsx（標準的、対応広い）

---

## 10. 実装見込み時間の内訳

| 作業 | 見込 |
|---|---|
| テーブル migration + RLS | 1.5h |
| 質問・回答 UI | 2.5h |
| Excel パーサー + マッチング | 2.5h |
| マッチング UI | 2.0h |
| Excel 出力 | 2.0h |
| ダッシュボード + Cron | 1.5h |
| Chatwork 連携 | 1.0h |
| 結合テスト | 2.0h |
| **合計** | **2.0d**（約 15h）|

---

— spec-leaf-kanden-ui-04 end —
