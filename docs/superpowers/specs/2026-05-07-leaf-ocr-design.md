# Garden-Leaf 関電業務委託: OCR 自動化 設計書

- 優先度: 🟡 中（Phase C、A-1c v3.2 + B-2 TimeTree 完成後）
- 見積: **3.5d**（D 共通基盤 0.5d + バックグラウンド処理 1.0d + UI 1.0d + 段階展開準備 0.5d + テスト 0.5d）
- 作成: 2026-05-07 起草（a-leaf-002、a-main-013 main- No. 86 全前倒し dispatch # 4）
- 関連 spec:
  - A-1c v3.2 添付ファイル機能（PR #130、`KandenAttachment.ocr_processed` 列予約済）
  - A-1c 将来拡張 設計指針（PR #131、事業スコープ設計）
  - TimeTree 移行 設計書（PR #133、Phase B-2、移行データを OCR 入力として活用）
- 前提:
  - A-1c v3.2 Phase A/B Backoffice / Input UI 完成（添付画像が DB + Storage に蓄積）
  - TimeTree 移行 Phase B-2 完成（過去 2 年分の画像が Garden に集約）
  - 親 CLAUDE.md §11〜§18

---

## 1. Executive Summary

### 1.1 目的

関電業務委託の添付画像（受領書 / メーター画像 / 諸元手書きメモ等）を **OCR で自動テキスト化** し、検索・自動入力・案件成立確認の業務効率化を実現する。

将来的には:
- 案件番号（K-YYYYMMDD-NNN）の自動抽出 → 添付の case_id 自動補完
- メーター数値の自動入力 → 諸元入力工数削減
- 受領書の顧客印・サインの認識 → 案件成立の自動マーキング

### 1.2 スコープ（main- No. 95 で 7 論点全 OK 採用）

| 項目 | 採用内容 |
|---|---|
| OCR エンジン | **Google Vision API**（日本語精度 + Garden Workspace 連携） |
| 課金影響 | **月 1,000 件 OCR で約 $1.5（≒200 円）**、月予算上限 **$10（≒1,500 円）** で alert |
| Phase 配置 | **Phase C（補完モジュール）** |
| 対象帳票 | **3 段階展開**: 受領書（第 1）→ メーター画像（第 2）→ 諸元手書き（第 3） |
| 結果保存先 | `leaf_kanden_attachments.ocr_text` 列（新規）+ `leaf_kanden_attachments_ocr_results` 履歴テーブル（新規） |
| 実行タイミング | **バックグラウンド処理（B 案）** — Supabase Edge Functions + Queue |
| 信頼度しきい値 | **80% 以上**で自動採用、80% 未満は「人手確認必要」フラグ + UI ハイライト |

### 1.3 スコープ外（次フェーズ以降）

- 第 3 段階「諸元手書き」の本格適用（誤認識リスク高、第 1-2 段階の運用後に再検討）
- 他商材（光回線・クレカ等）の OCR 横展開（事業ごとに帳票が異なるため、各商材で個別 spec）
- LLM 連携（GPT 等）による文脈補完（Phase D 以降）
- Webhook での外部連携（Phase D 以降）
- 多言語対応（現状日本語のみ）

### 1.4 主な設計判断（7 論点、a-main-013 main- No. 95 全 OK）

| # | 論点 | 採択 | 理由 |
|---|---|---|---|
| 1 | エンジン選定 | Google Vision API | 日本語精度 + Garden 既存 Google Workspace 連携、$1.5/1000 で他社並 |
| 2 | 課金影響 | 月予算 $10（≒1,500 円）上限 | 想定月 1,000 件 OCR で $1.5、業務効率化価値が圧倒的 |
| 3 | Phase 配置 | C（補完モジュール）| A-1c v3.2 + B-2 TimeTree 完成後の自然な次フェーズ |
| 4 | 対象帳票（段階展開）| 受領書 → メーター → 諸元 | 段階的に低リスクから着手、誤認識許容範囲を見極め |
| 5 | 結果保存先 | `ocr_text` 列 + 履歴テーブル | データ保全 + 監査可能性確保（誰がいつどのエンジンで OCR したか） |
| 6 | 実行タイミング | バックグラウンド B 案 | API 課金スパイク回避、優先度低画像は後回し可能、UI ブロックなし |
| 7 | 信頼度しきい値 | 80% | 80% 未満は人手確認 UI でハイライト、80% 以上は自動採用 |

---

## 2. アーキテクチャ

### 2.1 全体フロー

```
[アップロード時]
  画像 PUT → leaf_kanden_attachments INSERT
       ↓
  OCR キュー INSERT（leaf_kanden_attachments_ocr_queue）
  status = 'pending', priority = カテゴリ別

[バックグラウンド処理（Supabase Edge Functions、5 分間隔 cron）]
  1. キューから pending 行を 10 件 SELECT（priority + created_at 順）
  2. 各画像で signedURL 発行 → Google Vision API 呼出
  3. OCR 結果を ocr_text 列 + ocr_results 履歴 に保存
  4. 信頼度判定（80% しきい値）→ ocr_processed = TRUE / ocr_needs_review = TRUE
  5. キュー status を 'completed' or 'failed' に更新
  6. 月予算 $10 到達時は処理停止 + 管理者通知

[UI 表示時]
  添付詳細画面で OCR 結果セクション表示
  - 信頼度 80% 以上 → 通常表示
  - 信頼度 80% 未満 → 黄色ハイライト + 「人手確認必要」バッジ
  - admin+ は手動 OCR 再実行ボタン
```

### 2.2 コンポーネント構成

```
src/app/leaf/_lib/ocr/
├─ google-vision-client.ts            # Google Vision API client wrapper
├─ ocr-queue.ts                       # OCR キュー操作（INSERT / pending 取得 / 更新）
├─ ocr-processor.ts                   # 1 画像の OCR 実行 + 結果保存（pure function）
├─ ocr-confidence.ts                  # 信頼度判定 + しきい値判定
├─ ocr-budget-monitor.ts              # 月予算監視 + alert 発火
└─ __tests__/

supabase/functions/leaf-ocr-worker/
├─ index.ts                           # Supabase Edge Function 本体（5 分間隔 cron）
└─ deno.json                          # Deno 設定

src/app/leaf/backoffice/_components/ocr/
├─ OcrResultPanel.tsx                 # 添付詳細の OCR 結果セクション
├─ OcrManualRetrigger.tsx             # admin+ 限定の手動 OCR 再実行ボタン
├─ OcrConfidenceBadge.tsx             # 信頼度バッジ（80% 以上 / 未満）
└─ __tests__/

src/app/leaf/admin/ocr-monitor/
├─ page.tsx                           # admin+ 限定の OCR 状況ダッシュボード
└─ _components/
   ├─ QueueStatusPanel.tsx            # キュー状況（pending / completed / failed 件数）
   ├─ BudgetUsagePanel.tsx            # 月予算使用率
   ├─ FailedItemsTable.tsx            # 失敗一覧 + 再実行
   └─ __tests__/
```

### 2.3 権限設計

| 操作 | 権限 |
|---|---|
| OCR 結果閲覧（80% 以上）| **添付閲覧権限保持者全員**（事業所属者）|
| OCR 結果閲覧（80% 未満、人手確認必要）| **添付閲覧権限保持者全員**、ハイライト表示 |
| OCR 結果の修正 | **manager 以上**（修正履歴は ocr_results 履歴テーブルに記録） |
| 手動 OCR 再実行 | **admin / super_admin** |
| OCR 予算 alert 設定 | **super_admin** |
| OCR 状況ダッシュボード閲覧 | **admin / super_admin** |

---

## 3. データ設計

### 3.1 既存テーブル拡張（ALTER）

```sql
-- File: scripts/leaf-schema-patch-c-ocr.sql
-- A-1c v3.2 既存テーブルに OCR 列追加

ALTER TABLE leaf_kanden_attachments
  ADD COLUMN IF NOT EXISTS ocr_text text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ocr_confidence numeric(5,4) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ocr_engine text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ocr_processed_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ocr_needs_review boolean DEFAULT FALSE;

-- ocr_processed (v3 で予約済) を bool として明確化
COMMENT ON COLUMN leaf_kanden_attachments.ocr_processed IS
  'OCR 処理完了フラグ。TRUE = ocr_text に結果あり、FALSE = 未処理';
COMMENT ON COLUMN leaf_kanden_attachments.ocr_text IS
  'OCR 認識テキスト（信頼度しきい値以上なら自動採用、未満は ocr_needs_review = TRUE）';
COMMENT ON COLUMN leaf_kanden_attachments.ocr_confidence IS
  '0.0-1.0 の信頼度スコア。0.8 以上で自動採用';
COMMENT ON COLUMN leaf_kanden_attachments.ocr_engine IS
  '使用した OCR エンジン名（''google-vision-v1'' 等）';
COMMENT ON COLUMN leaf_kanden_attachments.ocr_needs_review IS
  '人手確認必要フラグ。信頼度 80% 未満 or 手動マーク時に TRUE';

CREATE INDEX IF NOT EXISTS idx_leaf_attachments_ocr_processed
  ON leaf_kanden_attachments (ocr_processed) WHERE ocr_processed = FALSE;

CREATE INDEX IF NOT EXISTS idx_leaf_attachments_ocr_needs_review
  ON leaf_kanden_attachments (ocr_needs_review) WHERE ocr_needs_review = TRUE;
```

### 3.2 新規テーブル: OCR 結果履歴

```sql
CREATE TABLE IF NOT EXISTS leaf_kanden_attachments_ocr_results (
  id               bigserial PRIMARY KEY,
  attachment_id    uuid NOT NULL REFERENCES leaf_kanden_attachments(attachment_id) ON DELETE CASCADE,
  ocr_engine       text NOT NULL,
  ocr_engine_ver   text DEFAULT NULL,
  ocr_text         text NOT NULL,
  ocr_confidence   numeric(5,4) NOT NULL,
  raw_response     jsonb DEFAULT NULL,
  executed_at      timestamptz NOT NULL DEFAULT now(),
  executed_by      uuid DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  trigger_type     text NOT NULL CHECK (trigger_type IN ('auto', 'manual', 'retry')),
  cost_usd         numeric(10,6) DEFAULT NULL
);

COMMENT ON TABLE leaf_kanden_attachments_ocr_results IS
  'OCR 実行履歴。1 画像で複数回 OCR 実行可（再実行 / エンジン変更）。'
  'executed_by NULL は auto trigger（バックグラウンド実行）';

CREATE INDEX idx_leaf_ocr_results_attachment ON leaf_kanden_attachments_ocr_results (attachment_id, executed_at DESC);
CREATE INDEX idx_leaf_ocr_results_executed_at ON leaf_kanden_attachments_ocr_results (executed_at DESC);
CREATE INDEX idx_leaf_ocr_results_cost ON leaf_kanden_attachments_ocr_results (executed_at) WHERE cost_usd IS NOT NULL;
```

### 3.3 新規テーブル: OCR キュー

```sql
CREATE TABLE IF NOT EXISTS leaf_kanden_attachments_ocr_queue (
  id               bigserial PRIMARY KEY,
  attachment_id    uuid NOT NULL UNIQUE REFERENCES leaf_kanden_attachments(attachment_id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority         smallint NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  enqueued_at      timestamptz NOT NULL DEFAULT now(),
  started_at       timestamptz DEFAULT NULL,
  completed_at     timestamptz DEFAULT NULL,
  error_message    text DEFAULT NULL,
  retry_count      smallint NOT NULL DEFAULT 0
);

COMMENT ON TABLE leaf_kanden_attachments_ocr_queue IS
  'OCR 処理キュー。priority 1-10（1 が高優先）、status pending → processing → completed/failed';

CREATE INDEX idx_leaf_ocr_queue_pending ON leaf_kanden_attachments_ocr_queue
  (priority, enqueued_at) WHERE status = 'pending';

CREATE INDEX idx_leaf_ocr_queue_processing ON leaf_kanden_attachments_ocr_queue
  (started_at) WHERE status = 'processing';

CREATE INDEX idx_leaf_ocr_queue_failed ON leaf_kanden_attachments_ocr_queue
  (completed_at DESC) WHERE status = 'failed';
```

### 3.4 RLS

```sql
ALTER TABLE leaf_kanden_attachments_ocr_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaf_kanden_attachments_ocr_queue ENABLE ROW LEVEL SECURITY;

-- ocr_results: 添付閲覧権限と同じ（事業所属者全員 + admin+）
CREATE POLICY leaf_ocr_results_select ON leaf_kanden_attachments_ocr_results
  FOR SELECT USING (
    public.garden_role_of((SELECT auth.uid())) IN ('admin', 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.leaf_kanden_attachments a
      WHERE a.attachment_id = leaf_kanden_attachments_ocr_results.attachment_id
        AND public.leaf_user_in_business('kanden')
    )
  );

-- ocr_results 書込はバックグラウンド処理 + 手動再実行のみ
-- バックグラウンドは Service Role Key で書込（RLS bypass）、UI は admin+ のみ
CREATE POLICY leaf_ocr_results_admin_write ON leaf_kanden_attachments_ocr_results
  FOR INSERT WITH CHECK (
    public.garden_role_of((SELECT auth.uid())) IN ('admin', 'super_admin')
  );

-- ocr_queue: admin+ のみ閲覧可（業務UI には出さない、ダッシュボード専用）
CREATE POLICY leaf_ocr_queue_admin_select ON leaf_kanden_attachments_ocr_queue
  FOR SELECT USING (
    public.garden_role_of((SELECT auth.uid())) IN ('admin', 'super_admin')
  );

CREATE POLICY leaf_ocr_queue_admin_write ON leaf_kanden_attachments_ocr_queue
  FOR ALL USING (
    public.garden_role_of((SELECT auth.uid())) IN ('admin', 'super_admin')
  );
```

---

## 4. 段階別 OCR スコープ詳細

### 4.1 第 1 段階: 受領書（最初に着手）

- **目的**: 案件成立確認の自動化、顧客印・サインの認識
- **対象 category**: `juryo`
- **OCR タスク**: 全文認識（顧客名 + 日付 + 印影 + サイン）
- **業務利用**:
  - 受領日付の自動抽出 → 案件成立日の自動入力
  - 顧客名と DB 上の顧客名の一致確認 → 案件紐付け検証
  - 印影 / サイン有無の検出 → 「成立条件 OK」バッジ表示
- **信頼度想定**: 80%+ 達成見込み（定型フォーマット、印刷文字中心）
- **着手時期**: Phase C 着手即時

### 4.2 第 2 段階: メーター画像（第 1 段階運用後）

- **目的**: 諸元入力工数削減、メーター数値の自動入力
- **対象 category**: `denki` / `douryoku` / `gas`
- **OCR タスク**: 数字認識（メーター読取値、固定フォーマット）
- **業務利用**:
  - メーター値の自動抽出 → 諸元入力フォームに pre-fill
  - 撮影日付の検出（メーター撮影日 = 計測日として記録）
- **信頼度想定**: 70-85%（数字認識は概して高精度、撮影角度で揺れる）
- **着手時期**: 第 1 段階の運用 1 ヶ月後（受領書 OCR の精度・運用課題を解消後）

### 4.3 第 3 段階: 諸元手書きメモ（最後に検討）

- **目的**: 手書き諸元の自動入力（実現可否は精度次第）
- **対象 category**: `shogen`（手書きメモ部分）
- **OCR タスク**: 手書き文字認識
- **業務利用**:
  - 手書き諸元の自動テキスト化 → 諸元フォームの参考表示
  - 自動採用は推奨せず、必ず人手確認 UI を経由
- **信頼度想定**: 50-70%（手書きは精度低い、誤認識リスク高）
- **着手時期**: 第 2 段階運用 1 ヶ月後 + 信頼度しきい値見直し検討
- **代替案**: 手書き諸元は OCR 対象外とし、撮影 → 手入力 のフローを維持

---

## 5. UI 設計

### 5.1 OCR 結果表示（添付詳細画面、`OcrResultPanel.tsx`）

```
┌─ 添付詳細（AttachmentLightbox 内） ───────────────────┐
│ [画像表示エリア]                                         │
│                                                          │
│ ─── OCR 結果 ───                                         │
│                                                          │
│ 信頼度: 92% [自動採用]                                   │
│ エンジン: Google Vision API                              │
│ 実行日時: 2026-05-15 10:23                               │
│                                                          │
│ ┌────────────────────────────────────┐                 │
│ │ 認識テキスト:                          │                 │
│ │ ─────────────────────────────────── │                 │
│ │ 関電業務委託 受領書                     │                 │
│ │ 顧客: 株式会社○○                      │                 │
│ │ 日付: 2026 年 5 月 10 日                │                 │
│ │ 案件番号: K-20260510-042              │                 │
│ │ ...                                    │                 │
│ └────────────────────────────────────┘                 │
│                                                          │
│ [ 手動 OCR 再実行 (admin+) ]  [ コピー ]                 │
└──────────────────────────────────────────────────────┘
```

信頼度 80% 未満時:
```
┌─ 信頼度: 67% ⚠️ 人手確認必要 ──────────────────────────┐
│ ⚠️ 自動採用しません。表示内容は参考値です。              │
│ ┌────────────────────────────────────┐                 │
│ │ 認識テキスト:（精度低い可能性あり）      │                 │
│ │ 関電業務委託 受領書                     │                 │
│ │ 顧客: ｋ株式会社○○ （← 認識揺れ）       │                 │
│ │ 日付: 2026 年 5 月 10 曰 （← 認識誤り）  │                 │
│ │ ...                                    │                 │
│ └────────────────────────────────────┘                 │
│                                                          │
│ [ 確認済にする ] [ 手動 OCR 再実行 ] [ 修正する (manager+) ]│
└──────────────────────────────────────────────────────┘
```

### 5.2 OCR 状況ダッシュボード（admin+、`/leaf/admin/ocr-monitor`）

```
┌─ OCR 状況ダッシュボード ─────────────────────────────┐
│                                                          │
│ ┌─ 月予算使用率 ──────────────────────────┐           │
│ │ 今月の OCR 実行: 1,234 件                  │           │
│ │ 概算コスト: $1.85 / $10.00（予算 18.5%）   │           │
│ │ ████████░░░░░░░░░░░░░░░░░░░░  18.5%       │           │
│ └────────────────────────────────────────┘           │
│                                                          │
│ ┌─ キュー状況 ───────────────────────────┐           │
│ │ pending:    23 件                          │           │
│ │ processing:  2 件                          │           │
│ │ completed: 1,200 件                        │           │
│ │ failed:      9 件                          │           │
│ └────────────────────────────────────────┘           │
│                                                          │
│ ┌─ 失敗一覧 ─────────────────────────────┐           │
│ │ # | attachment_id | エラー | 再実行 │           │
│ │ 1 | a1...         | timeout | [再] │           │
│ │ 2 | a2...         | API 4xx | [再] │           │
│ │ ...                                        │           │
│ └────────────────────────────────────────┘           │
└──────────────────────────────────────────────────────┘
```

---

## 6. 実装ステップ

### Phase C-OCR-1: D 共通基盤拡張（0.5d）

1. ALTER TABLE migration（§3.1〜§3.3）→ `scripts/leaf-schema-patch-c-ocr.sql`
2. `src/app/leaf/_lib/ocr/google-vision-client.ts`（API wrapper）+ Vitest
3. `src/app/leaf/_lib/ocr/ocr-confidence.ts`（しきい値判定）+ Vitest
4. `src/app/leaf/_lib/ocr/ocr-queue.ts`（キュー操作）+ Vitest

### Phase C-OCR-2: バックグラウンド処理（1.0d）

5. `supabase/functions/leaf-ocr-worker/index.ts`（Edge Function、5 分間隔 cron）
6. `ocr-processor.ts`（1 画像の OCR 実行 + 結果保存）+ Vitest
7. `ocr-budget-monitor.ts`（月予算監視 + alert 発火）+ Vitest
8. アップロード時のキュー INSERT 仕掛（`attachments.ts.uploadAttachment` に追加）+ test 更新
9. Supabase pg_cron で 5 分間隔 schedule 設定

### Phase C-OCR-3: UI 層（1.0d）

10. `OcrResultPanel.tsx`（添付詳細セクション）+ RTL test
11. `OcrConfidenceBadge.tsx`（バッジ）+ RTL test
12. `OcrManualRetrigger.tsx`（admin+ 手動再実行ボタン）+ RTL test
13. `AttachmentLightbox.tsx` に OcrResultPanel 組込 + RTL test 更新
14. `/leaf/admin/ocr-monitor/page.tsx`（ダッシュボード）+ サブコンポ + RTL test

### Phase C-OCR-4: 段階展開準備（0.5d）

15. category 別 OCR 設定テーブル `leaf_kanden_ocr_categories`（第 1-3 段階の有効化フラグ）
16. 第 1 段階（受領書）のみ ocr_enabled = TRUE で運用開始
17. 運用ガイド `docs/runbooks/leaf-ocr-runbook.md` 起票
18. β版運用での精度検証（東海林さん 50 件確認 → 信頼度しきい値の妥当性検証）

### Phase C-OCR-5: テスト + 統合（0.5d）

19. 50 件の test 画像で end-to-end 試行
20. 月予算超過 alert の動作確認
21. 信頼度 80% しきい値の検証（4.1 受領書で 80% 達成見込み）
22. 失敗時の retry ロジック検証

合計: **3.5d**

---

## 7. テスト戦略

### 7.1 ユニットテスト（Vitest）

| ファイル | カバレッジ目標 |
|---|---|
| `google-vision-client.ts` | 70%+（API mock 中心） |
| `ocr-queue.ts` | 90%+ |
| `ocr-processor.ts` | 80%+ |
| `ocr-confidence.ts` | 95%+（pure function） |
| `ocr-budget-monitor.ts` | 85%+ |

### 7.2 RTL + MSW（UI 検証）

- `OcrResultPanel.tsx`: 信頼度 80% 以上 / 未満の表示分岐 / コピー機能 / 再実行ボタン admin+ ガード
- `OcrConfidenceBadge.tsx`: 80% 以上で「自動採用」/ 未満で「人手確認必要」
- `OcrManualRetrigger.tsx`: admin+ のみ表示 / クリックでキュー INSERT / 進行中バッジ
- `QueueStatusPanel.tsx`: 件数表示 / カラー分岐
- `BudgetUsagePanel.tsx`: 使用率バー / 80% 超で警告色

### 7.3 統合テスト

- 50 件の test 画像をキュー INSERT → Edge Function 実行 → ocr_text 保存
- 信頼度 80% 以上 / 未満の振分が正しい
- 月予算 $10 到達時に処理停止する

### 7.4 手動 RLS 検証

- 添付閲覧権限保持者が OCR 結果を閲覧可能
- 非権限者は OCR 結果も閲覧不可
- admin+ のみ手動再実行ボタンが表示される
- ocr-monitor ページは admin+ のみアクセス可能

---

## 8. 課金管理 / 監視

### 8.1 月予算上限

- **デフォルト $10/月**（≒1,500 円）、`root_settings.leaf.ocr_monthly_budget_usd` で super_admin が変更可能
- 80% 到達（$8）→ admin に Chatwork 通知（Garden-Rill 完成後）
- 100% 到達（$10）→ バックグラウンド処理停止 + 手動再実行も拒否（super_admin のみ予算延伸可能）

### 8.2 監視メトリクス

`ocr-monitor` ダッシュボードで表示:
- 月別 OCR 実行件数（グラフ）
- カテゴリ別 OCR 件数（受領書 / メーター / 諸元）
- 平均信頼度（カテゴリ別）
- 失敗率（直近 7 日）
- 処理時間（中央値・95 パーセンタイル）

### 8.3 Google Vision API キー管理

- `GOOGLE_VISION_API_KEY` を Supabase Edge Function の secrets に配置
- 東海林さんが Google Cloud Console で API key を発行
- Garden 全体で 1 key 共有（コスト集約）
- ローテーション: 6 ヶ月毎（要 super_admin 作業）

---

## 9. 関連 spec との整合

| spec | 関係 |
|---|---|
| A-1c v3.2（添付ファイル機能、PR #130）| `KandenAttachment.ocr_processed` 列を本 spec で本格活用、3 列追加 ALTER |
| A-1c 将来拡張 設計指針（PR #131）| 事業スコープ設計（business_id = 'kanden'）を OCR 対象でも維持、他商材展開時に business_id 別の OCR 設定可能化 |
| TimeTree 移行 設計書（PR #133、Phase B-2）| 移行された画像も自動的に OCR キューに投入される（ALTER TABLE で `ocr_processed = FALSE` がデフォルト）|
| Phase A 着手前 準備ガイド（PR #132）| Phase A 完了 → Phase B-2（TimeTree）→ Phase C-OCR の順で着手 |
| 横断 履歴 UI（Batch 14）| OCR 結果の修正は ocr_results 履歴テーブルに記録、Batch 14 UI で参照可能 |

---

## 10. 残課題 / 次フェーズ検討事項

- Google Cloud アカウント / 課金設定の **東海林さん作業項目化**（API key 発行 + Billing 有効化）
- 月予算上限 $10 の妥当性検証（運用 1 ヶ月後に再評価、必要なら $20 / $50 に増額）
- 第 1 段階受領書 OCR の **精度検証**（50 件試行で信頼度 80% 達成可否）
- 第 3 段階手書きの **採用可否最終判断**（精度 70% 未満なら不採用）
- 他商材（光回線・クレカ等）への **OCR 横展開**（事業ごとに帳票が異なる、business_id 別設定 + 個別 spec）
- **LLM 連携**（GPT 等）による OCR 結果の文脈補完（Phase D 以降の拡張）
- **Webhook 連携**（OCR 完了時に外部システム通知、Phase D 以降）

---

## 11. 改訂履歴

| 日付 | 版 | 内容 | 担当 |
|---|---|---|---|
| 2026-05-07 | v1.0 | 初版起草、a-main-013 main- No. 86 全前倒し dispatch # 4 対応、main- No. 95 で 7 論点全 OK 採用版 | a-leaf-002 |

---

— end of spec —
