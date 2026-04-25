# Leaf 他商材 #00: 汎用テンプレート（Phase C 展開パターン）

- 対象: Leaf モジュール内、関電業務委託（001）以外の全商材
- 優先度: **🔴 最高**（Batch 12 全体の基盤、新商材追加手順の標準化）
- 見積: **0.3d**
- 担当セッション: a-leaf
- 作成: 2026-04-25（a-auto 002 / Batch 12 Leaf 他商材 #00）
- 前提:
  - Batch 8 関電 Phase C spec 6 件（テンプレート元、PR #29 merge 済）
  - spec-cross-rls-audit / spec-cross-storage / spec-cross-chatwork / spec-cross-error / spec-cross-test（Batch 7）
  - spec-cross-ui-01〜06（Batch 10、UI 横断）

---

## 1. 目的とスコープ

### 目的

新規商材を Leaf に追加する際、**Batch 8 関電パターンを土台に、商材固有部分のみ差し替える**ことで、6 spec 構成を高速複製可能にする。

### 含める

- 6 spec 構成の汎用テンプレート（schema / backoffice UI / input UI / batch / chatwork / test）
- 新商材追加時の標準手順
- 商材 ID 命名規則（003_xxx / 004_xxx）
- 商材ごとに固有化が必要な箇所一覧
- 共通化できる横断仕様（RLS / 監査 / Storage / Chatwork / Error / Test）

### 含めない

- 個別商材の詳細仕様（01 光、02 クレカ、03 その他）
- 既存商材データ移行（10 で別途）
- Phase A/B（Bud 連携・基盤）の改造

---

## 2. 関電パターンの普遍化

### 2.1 Batch 8 6 spec を再分類

| spec | 関電固有 | 商材汎用 | 横断既設 |
|---|---|---|---|
| C-01 schema | 契約種別 / 検針日 / 22 桁供給地点 | 8 段階ステータス / 営業情報 / 添付 | RLS 4 階層 / Trigger / 論理削除 |
| C-02 backoffice UI | 関電固有列の表示 | 一覧 / 検索 / 詳細モーダル | UI-01/02 レイアウト |
| C-03 input UI | 関電固有 OCR / 22 桁検証 | 2 段階ウィザード / 添付 | UI-03 Canvas 圧縮 |
| C-04 batch | PD 同期 / 月次関電 CSV | 滞留リマインダー / 手数料計算 | spec-cross-storage |
| C-05 chatwork | 関電向け通知文言 | 4 段階リリース / 案 D 準拠 | spec-cross-chatwork |
| C-06 test | 関電固有エッジ | エッジ / RLS / E2E 5 本 | spec-cross-test |

商材依存は **2-3 割程度**、残り 7-8 割は汎用化可能。

### 2.2 商材固有差し替えポイント（テンプレート変数）

| 変数 | 値の例（関電） | 他商材での例 |
|---|---|---|
| `${MODULE_ID}` | `001_kanden` | `002_hikari`, `003_credit`, ... |
| `${MODULE_NAME_JA}` | 関電業務委託 | 光回線 / クレカ / 水サーバー |
| `${TABLE_PREFIX}` | `soil_kanden_` | `soil_hikari_`, `soil_credit_` |
| `${STATUS_FLOW}` | 8 段階 | 商材により 5-10 段階 |
| `${CASE_TYPES}` | latest / replaced / makinaoshi / outside | 商材により異なる |
| `${ACQUISITION_TYPES}` | dakkan / kakoi | 商材により異なる |
| `${UNIQUE_FIELDS}` | supply_point_22 / contract_kw | 商材固有 |
| `${TAX_CATEGORY}` | 業務委託（消費税課税）| 商材により異なる |

---

## 3. 新商材追加手順（標準）

### 3.1 7 ステップ

```
Step 1: 商材リサーチ（1-2 日、東海林さん + 担当者）
  - 既存業務フロー把握（FileMaker / Excel / 紙）
  - ステータス遷移定義（8 段階の関電準拠 or 商材独自）
  - 商材固有列の洗い出し
  - 法令対応（特商法 / 個情法 / 業界特有）

Step 2: spec 草稿（a-auto 半日）
  - 本テンプレを 6 ファイル分コピー
  - `${VARIABLE}` を商材値に置換
  - 商材固有部分（OCR / API 連携等）を追記
  - 関電パターンと差異が大きい場合は「**判断保留**」マーク

Step 3: 東海林さん + 担当者レビュー（半日 - 1 日）
  - 業務フロー妥当性
  - 法令対応漏れ
  - 既存システムからの移行戦略
  - judgment hold の合意

Step 4: 仕様確定後の修正（a-auto 1-2h）
  - 判断保留を反映、確定版 spec
  - PR 化

Step 5: 実装（a-leaf、商材により 2-5d）
  - schema migration 実行
  - backoffice UI 構築
  - input UI 構築
  - batch / chatwork / test の順で完成

Step 6: α / β / 本番展開
  - α: 担当者 1 人テスト（1 週間）
  - β: 関係者 3-5 人（2 週間）
  - 本番: 全社展開、既存システム並行運用 1 ヶ月

Step 7: 既存データ移行（spec #10 参照）
  - 移行戦略選定
  - 段階的データ投入
```

### 3.2 各 Step の所要

| Step | 所要 | 担当 |
|---|---|---|
| 1 リサーチ | 1-2 日 | 東海林さん + 担当者 |
| 2 spec 草稿 | 0.5 日 | a-auto |
| 3 レビュー | 0.5-1 日 | 東海林さん + 担当者 |
| 4 確定修正 | 0.1-0.2 日 | a-auto |
| 5 実装 | 2-5 日 | a-leaf |
| 6 展開 | 1 ヶ月 | a-leaf + 担当者 |
| 7 移行 | 商材依存 | a-leaf + 担当者 |

**新商材 1 件あたり実装コスト: 約 5-10 日（リサーチ含む）**

---

## 4. 商材 ID 命名規則

### 4.1 命名構造

```
{連番3桁}_{商材コード}
```

例:

| ID | 商材 |
|---|---|
| 001 | kanden（関西電力業務委託、Batch 8 完成）|
| 002 | hikari_nuro（NURO 光、本 Batch 計画）|
| 003 | hikari_kddi（au ひかり）|
| 004 | hikari_softbank（SoftBank 光）|
| 010 | credit_aeon（イオンカード等）|
| 011 | credit_emerald（エメラルド等）|
| 020 | water_server |
| 030 | solar_panel |
| 040 | mobile_carrier |
| 050 | insurance_xxxxxxxxx |

### 4.2 連番ルール

- 商材ジャンルでブロック割り当て
  - 001-009: 電力・ガス
  - 010-019: クレカ
  - 020-029: 水サーバー・宅配水
  - 030-039: 太陽光・蓄電池
  - 040-049: 通信（光以外、モバイル）
  - 050-059: 保険
  - 060-069: その他
- 同ジャンル内は契約順

### 4.3 テーブル prefix

```
soil_{商材コード}_cases    -- メインテーブル
soil_{商材コード}_plans    -- 辞書（プラン名）
soil_{商材コード}_xxxxx    -- 商材固有テーブル
```

---

## 5. 6 spec テンプレート（要点）

### 5.1 Spec C-01: schema-migration

#### 必須カラム（関電踏襲）

```sql
CREATE TABLE soil_${MODULE_ID}_cases (
  case_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number          text UNIQUE NOT NULL,    -- 案件番号

  -- ステータス（商材により段階変更）
  status               text NOT NULL CHECK (status IN (...商材固有...)),
  case_type            text NOT NULL,
  acquisition_type     text NOT NULL,

  -- 営業情報（共通）
  employee_number      text NOT NULL REFERENCES root_employees(employee_number),
  name                 text NOT NULL,
  department           text,
  app_code             text,

  -- 顧客情報（共通）
  customer_number      text,
  customer_name        text NOT NULL,
  customer_phone       text,

  -- 日付（商材により段階変更）
  ordered_at           timestamptz NOT NULL DEFAULT now(),
  completed_at         timestamptz,

  -- 商材固有（${UNIQUE_FIELDS}）
  -- ここに商材ごとの列追加

  -- メタ
  review_note          text,
  submitted_by         text,
  submitted_at         timestamptz,
  note                 text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz
);
```

#### 必須セクション

- 列追加 SQL
- RLS 4 階層（spec-cross-rls-audit 踏襲）
- 列制限 Trigger（書込時の immutable 列）
- 論理削除（deleted_at）
- 監査連携（audit_logs INSERT）

### 5.2 Spec C-02: backoffice-ui

#### 必須セクション

- 一覧画面（フィルタ・検索・ソート）
- 詳細モーダル（ステータス進行ボタン）
- 一括操作（最大 100 件）
- CSV エクスポート（UTF-8 + BOM）
- 非技術者向け文言の対照表（最低 5 件）

### 5.3 Spec C-03: input-ui

#### 必須セクション

- 2 段階ウィザード（Step 1 基本 + 添付 / Step 2 商材固有）
- 添付（Canvas 圧縮、UI-03 踏襲）
- OCR（商材により有無）
- FileMaker ショートカット（Phase A-FMK1 踏襲）
- 1 click ステータス進行

### 5.4 Spec C-04: batch-processing

#### 必須セクション

- Cron 一覧（月次 / 週次 / 日次）
- sync_log テーブル（Root KoT パターン）
- 外部 API 連携（商材により）
- 滞留リマインダー
- 手数料計算（商材により）

### 5.5 Spec C-05: chatwork-notification

#### 必須セクション

- **案 D 準拠**: 署名 URL 不流通、Garden ログイン誘導
- 通知パターン 5-7 種
- Bot アカウント設定
- 4 段階リリース（dry-run → staging → 本番 1 ルーム → 全ルーム）
- レート制限対応

### 5.6 Spec C-06: test-strategy

#### 必須セクション

- Leaf 🟡 通常厳格度（Tree 🔴 / Bud 🔴 より緩い）
- Unit 70% / Integration 50% / E2E 5 本
- §16 7 種テスト + §17 3 段階展開
- 商材固有エッジ（OCR / 22 桁検証等）
- MF11/旧システム並行運用期間 2 週間

---

## 6. 共通化できる横断仕様

### 6.1 既設 Batch 7 spec 参照（変更不要）

- `spec-cross-rls-audit`: RLS の 4 階層パターン
- `spec-cross-audit-log`: 監査ログ設計
- `spec-cross-storage`: Storage bucket 命名・RLS
- `spec-cross-chatwork`: Bot / レート制限 / 案 D
- `spec-cross-error-handling`: Toast / role="alert"
- `spec-cross-test-strategy`: 厳格度マトリクス

### 6.2 既設 Batch 10 UI spec 参照

- `spec-cross-ui-01`: レイアウト / テーマ / shadcn
- `spec-cross-ui-02`: メニューバー
- `spec-cross-ui-03`: 個人カスタマイズ（Canvas 圧縮）

### 6.3 既設 Bud Phase C spec 参照（金銭関連の場合）

- `bud-phase-c-02 gensen-choshu`: マイナンバー暗号化
- `bud-phase-c-04 hotei-chosho`: 法定調書合計表（クレカ / 保険等で活用）

---

## 7. 商材ごとに固有化が必要な箇所

### 7.1 ビジネスロジック

- ステータス遷移グラフ（5-10 段階）
- 案件種別（latest / replaced 等）の意味
- 顧客情報の必須項目
- 業界特有 ID（電力 22 桁 / 携帯 IMEI 15 桁 等）

### 7.2 法令対応

- 特商法（クーリングオフ期間管理）
- 個情法（マイナンバー扱う商材）
- 業界特有規制（電気事業法 / 銀行法 / 保険業法）

### 7.3 外部 API

- 電力会社（PD = 顧客管理システム）
- カード会社（与信 API）
- キャリア（番号ポータビリティ API）

### 7.4 帳票

- 申込書（紙 PDF）
- 提出書類（業界別フォーマット）
- 報告書（月次・年次）

---

## 8. 命名・ファイル配置

### 8.1 spec ファイル配置

```
docs/specs/leaf/
├── 001-kanden/                    ← Batch 8（既存）
│   ├── spec-leaf-kanden-phase-c-01-schema-migration.md
│   ├── spec-leaf-kanden-phase-c-02-backoffice-ui.md
│   └── ...
├── 002-hikari-nuro/               ← Batch 12 で skeleton 作成
│   ├── spec-leaf-hikari-phase-c-01-schema-migration.md（skeleton、判断保留多）
│   └── ...
├── 010-credit/                    ← 同上
└── 020-water/                     ← 未来商材
```

### 8.2 実装コードの配置

```
src/app/leaf/
├── 001-kanden/                    ← 関電実装
├── 002-hikari/                    ← 光回線実装
├── 010-credit/                    ← クレカ実装
├── _shared/                       ← 商材横断の共通コンポーネント
│   ├── BackofficeListShell.tsx
│   ├── InputWizardShell.tsx
│   └── ...
└── _lib/
    ├── shared-status.ts            ← 共通ステータスヘルパ
    └── ...
```

商材横断で再利用するコンポーネントを `_shared/` に集約、商材固有実装は数 10 行に圧縮。

---

## 9. 移行戦略の概要（詳細は #10）

各商材で既存データ移行は重い作業。本テンプレートでは「**事前調査必須**」としてスケジュールに含める：

| 移行ソース | 難度 | 推奨方法 |
|---|---|---|
| FileMaker | 🟡 中 | ODBC 経由、Python スクリプト |
| Excel | 🟢 低 | 手動 import、CSV 経由 |
| TimeTree / 紙 | 🔴 高 | 手入力（自動化不可）|
| 他社 SaaS | 🟡 中 | API 連携 or CSV エクスポート |

詳細は `spec-leaf-others-10-migration-strategy.md` 参照。

---

## 10. 判断保留事項

- **判1: 商材横断の共通コンポーネント抽出時期**
  - 関電実装後すぐ / 2 商材実装後 / 3 商材実装後
  - **推定スタンス**: 2 商材実装後（重複パターンが見えてから）
- **判2: ステータス遷移の DSL 化**
  - SQL CHECK 制約 hard-code / マスタテーブル駆動 / DSL（YAML）
  - **推定スタンス**: Phase 1 は CHECK 制約（hard-code）、Phase 2 で DSL 検討
- **判3: 商材横断の検索画面（全商材一覧）**
  - 各商材独立 / 横断検索画面新設
  - **推定スタンス**: Phase 1 は各商材独立、3 商材以上で横断検索検討
- **判4: 商材ごとのデプロイサイクル**
  - 全商材一括 / 商材独立
  - **推定スタンス**: 商材独立（Vercel preview / featureflag で個別投入可能）

---

## 11. 実装見込み時間

本テンプレ自体の実装はなし（spec のみ）。新商材 1 件あたり:

| 段階 | 所要 |
|---|---|
| Step 1 リサーチ（外部）| 1-2 日 |
| Step 2 spec 草稿（auto）| 0.5 日 |
| Step 3 レビュー | 0.5-1 日 |
| Step 4 確定修正（auto）| 0.1 日 |
| Step 5 実装 | 2-5 日 |
| Step 6 展開 | 1 ヶ月 |
| Step 7 移行 | 商材依存 |
| **合計（実装まで）** | **約 5-10 日** |

3 ヶ月で 5-10 商材展開可能（並列実装の場合）。

---

— spec-leaf-others-00 end —
