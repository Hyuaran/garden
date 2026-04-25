# Leaf 他商材 #01: 光回線商材 骨格 spec（skeleton）

- 対象: NURO 光 / au ひかり / SoftBank 光等の光回線商材
- 優先度: **🟡 中**（実装着手前のリサーチ用、詳細は東海林さん再ヒアリング後）
- 見積: **0.2d**（spec 起草、実装見積は別途）
- 担当セッション: a-leaf
- 作成: 2026-04-25（a-auto 002 / Batch 12 Leaf 他商材 #01）
- 前提:
  - `spec-leaf-others-00-template-pattern`（本 Batch のテンプレート）
  - Batch 8 関電 spec 6 件（パターン元）

---

## 1. 目的とスコープ

### 目的

光回線商材を Leaf に追加する**前段の方向性確認用**スケルトン。実装着手前に東海林さんと詳細ヒアリングし、商材固有部分を確定させる。

### 含める

- 光回線商材の **概要・関電との差異**
- 商材固有の必須項目
- ステータス遷移の暫定案
- 想定外部 API（光回線業者）
- 法令対応のチェックリスト
- 詳細仕様確定までの判断保留

### 含めない

- 完全な 6 spec（Step 2 spec 草稿で作成）
- 実装コード
- 既存データ移行詳細（#10）

---

## 2. 光回線商材の概要

### 2.1 業務フロー（一般）

```
1. 営業（架電 / 訪問）→ 顧客同意取得
   ↓
2. 申込書作成 → 顧客情報・希望プラン・工事日候補
   ↓
3. 業者へ申込送信（オンライン / FAX / 紙）
   ↓
4. 業者側で受付確認 → 工事日確定通知
   ↓
5. 工事実施（顧客立会い）
   ↓
6. 開通確認 → 業務委託料発生
   ↓
7. 月次集計 → 業者から手数料入金 → Bud 連携
```

### 2.2 関電との主な差異

| 観点 | 関電 | 光回線 |
|---|---|---|
| 業者 | 関西電力 1 社 | NURO / au / SoftBank 等 **複数業者** |
| 業者 API | PD（顧客管理システム）| 業者ごとの API or 紙 FAX |
| 工事日 | 不要（電気切替のみ）| **工事日管理必須**（顧客立会い）|
| キャンセル | 比較的少 | **工事前キャンセルあり**（顧客都合）|
| 手数料 | 月額制 | 開通時一括 + 残存月数連動 |
| 名称規則 | 22 桁供給地点番号 | 業者番号 / 申込番号（業者ごと異なる）|

### 2.3 主要 3 業者の特徴

| 業者 | 申込方法 | 工事日確定 | 手数料率 |
|---|---|---|---|
| NURO 光 | オンライン申込 + 専用ポータル | 業者からメール通知 | 約 25,000 円 / 件 |
| au ひかり | 紙申込書 FAX | 電話通知 | 約 30,000 円 / 件 |
| SoftBank 光 | オンライン申込 + 紙併用 | システム通知 | 約 28,000 円 / 件 |

業者ごとの差異が大きく、**Phase C 実装時は業者単位の subspec**を推奨。

---

## 3. テーブル設計の暫定案

### 3.1 メインテーブル `soil_hikari_cases`（共通部分）

```sql
CREATE TABLE soil_hikari_cases (
  case_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number          text UNIQUE NOT NULL,

  -- 業者識別
  carrier_code         text NOT NULL CHECK (carrier_code IN ('nuro', 'au', 'softbank', 'docomo', 'other')),
  carrier_application_number text,    -- 業者側番号

  -- ステータス（暫定 7 段階）
  status               text NOT NULL CHECK (status IN (
    'ordered',           -- 申込受付
    'submitted',         -- 業者送信済
    'pending_schedule',  -- 工事日待ち
    'scheduled',         -- 工事日確定
    'construction_done', -- 工事完了
    'activated',         -- 開通
    'cancelled'          -- キャンセル
  )),

  -- 案件種別
  case_type            text NOT NULL CHECK (case_type IN ('new', 'transfer', 'replacement')),
                                  -- 新規 / 業者乗換 / 引越

  -- 営業情報（共通）
  employee_number      text NOT NULL REFERENCES root_employees(employee_number),
  -- ...（テンプレ準拠）

  -- 顧客情報（共通）
  customer_name        text NOT NULL,
  customer_phone       text NOT NULL,
  customer_address     text NOT NULL,

  -- 光固有情報
  plan_name            text,         -- 例: NURO 光 G2 V / au ひかりホーム 1 ギガ
  monthly_fee          int,          -- 月額料金（円）
  initial_fee          int,          -- 初期費用
  campaign_code        text,         -- 業者キャンペーンコード
  building_type        text CHECK (building_type IN ('detached', 'apartment', 'office')),
  installation_address text,         -- 設置住所（顧客住所と異なる場合）

  -- 工事日関連
  preferred_dates      text[],       -- 希望工事日（最大 3 件）
  scheduled_date       date,         -- 確定工事日
  scheduled_time_slot  text,         -- 'morning' / 'afternoon' / 'all_day'
  construction_done_at timestamptz,

  -- 開通・解約
  activated_at         timestamptz,
  cancelled_at         timestamptz,
  cancellation_reason  text,

  -- メタ
  -- ...（テンプレ準拠）
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz
);

CREATE INDEX idx_shc_carrier ON soil_hikari_cases (carrier_code);
CREATE INDEX idx_shc_status ON soil_hikari_cases (status, ordered_at DESC);
CREATE INDEX idx_shc_scheduled ON soil_hikari_cases (scheduled_date) WHERE status = 'scheduled';
```

### 3.2 業者別の subtable 検討

業者特有の管理項目が多い場合、**業者別 subtable 化**:

```
soil_hikari_cases       -- 共通
├── soil_hikari_nuro    -- NURO 固有列
├── soil_hikari_au      -- au 固有列
└── soil_hikari_softbank -- SoftBank 固有列
```

または `extra` jsonb 列で柔軟保持（業者多 / 列増減が頻繁な場合）。

### 3.3 ステータス遷移グラフ

```
[ordered] → [submitted] → [pending_schedule] → [scheduled]
                                                    ↓
                                           [construction_done]
                                                    ↓
                                              [activated]

途中キャンセル可能（[cancelled] へ）:
- ordered → cancelled（顧客都合即時）
- submitted → cancelled（業者処理前）
- pending_schedule → cancelled（業者調整中キャンセル）
- scheduled → cancelled（工事日前キャンセル）
- 工事日後は基本的にキャンセル不可（業者規約）
```

---

## 4. 商材固有 UI 要件

### 4.1 input UI 追加要素（C-03 拡張）

- **業者選択**: ラジオボタン（NURO / au / SoftBank / その他）
- 業者選択後に**業者固有フォーム**が動的表示
- **建物タイプ**: 戸建 / マンション / オフィス（プラン選択に影響）
- **希望工事日 3 件**: DatePicker × 3
- **時間帯希望**: 午前 / 午後 / 終日
- **インターネット利用状況**: 現在の業者 / 解約予定日（乗換の場合）

### 4.2 backoffice UI 追加要素（C-02 拡張）

- **工事日カレンダービュー**: 月間カレンダー、確定工事日を表示
- **業者別フィルタ**: NURO のみ / au のみ表示
- **工事日通知**: 工事 3 日前にリマインダー（電話確認推奨）

### 4.3 顧客立会いの注意

- 工事日に顧客が在宅必須
- 工事キャンセル時の連絡フロー（業者・顧客両方）
- 雨天・台風時の延期対応

---

## 5. 想定外部 API

### 5.1 NURO 光（So-net）

- 法人向け申込ポータル: あり（要法人契約）
- 個別 API: あり（オンライン申込）
- 制限: rate limit、申込時刻制約

### 5.2 au ひかり（KDDI）

- 法人向けポータル: 紙 FAX 中心
- API 連携: 限定的、業者と相談
- 制限: 紙ベース運用が主

### 5.3 SoftBank 光

- 法人向けポータル: あり
- API 連携: あり
- 制限: 業者により対応差

### 5.4 統合方針

- Phase 1: **手動入力中心**（業者ポータル → Garden 手動コピー）
- Phase 2: API 連携（業者 1 社ずつ実装）
- Phase 3: 全業者 API 統合（Phase D 以降）

---

## 6. 法令対応

### 6.1 特定商取引法

- **8 日間クーリングオフ期間**管理必須
- 申込日・契約日の正確な記録
- クーリングオフ通知の受領記録

### 6.2 電気通信事業法

- 重要事項説明書の交付（紙 or 電子）
- 説明実施日の記録

### 6.3 個情法

- 顧客情報（氏名・電話・住所）の管理
- マイナンバーは扱わない（光回線では不要）

---

## 7. 詳細仕様確定までの判断保留

### 7.1 ⭐ 東海林さん再ヒアリング必須

| # | 論点 | 確認事項 |
|---|---|---|
| 1 | 取り扱い業者数 | NURO / au / SoftBank / docomo / 他、計画中の業者は？ |
| 2 | 業者ごとの実績規模 | 月間契約数（業者別） |
| 3 | 既存システム | 現在の管理方法（FileMaker / Excel / 紙） |
| 4 | 業者特有のルール | 例: au は紙 FAX 中心、NURO はオンライン |
| 5 | 手数料体系 | 開通時一括 / 残存月数連動 / その他 |
| 6 | キャンセル対応 | キャンセル率、対応フロー |
| 7 | 工事日管理 | 工事日の予測精度、調整頻度 |
| 8 | 顧客との連絡 | 電話 / メール / Chatwork / SMS |

### 7.2 業者別の優先順位

実績規模・実装難度を考慮した展開順を決定する必要あり：

```
推奨展開順（仮）:
1. NURO 光（オンライン申込容易、API 比較的整備）
2. SoftBank 光（API あり）
3. au ひかり（紙ベース、最も慎重に）
```

ヒアリング結果で確定。

---

## 8. テスト戦略の要点

### 8.1 Leaf 🟡 通常厳格度（テンプレ #00 §2 §6 準拠）

- Unit 70% / Integration 50% / E2E 5 本
- 商材固有 E2E:
  - 業者選択 → 動的フォーム切替
  - 工事日 3 件選択 + 時間帯
  - クーリングオフ期間管理
  - 工事キャンセル → ステータス変更

### 8.2 業者別の追加テスト

- NURO: API 連携テスト（mock）
- au: 紙 FAX 出力 PDF の正確性
- SoftBank: API + 紙併用フロー

---

## 9. 実装見込み時間（参考）

本 spec は skeleton のみ。実際の Phase C 実装:

| Step | 所要 | 備考 |
|---|---|---|
| Step 1 リサーチ + ヒアリング | 2 日 | 業者調査 + 東海林さん面談 |
| Step 2 spec 6 件 草稿（auto）| 0.5 日 | テンプレ #00 ベース |
| Step 3 レビュー | 1 日 | 業者ごとの要件確認 |
| Step 4 確定修正（auto）| 0.2 日 | |
| Step 5 実装（共通部分）| 3 日 | テーブル + UI 共通骨格 |
| Step 5 実装（業者別）| 業者あたり 1-2 日 | NURO / au / SoftBank |
| **合計** | **約 8-10 日** | 業者 3 社対応 |

---

## 10. 判断保留事項

- **判1: 業者別 subtable vs jsonb 拡張**
  - 業者ごとに subtable 作成 / `extra` jsonb で柔軟保持
  - **推定スタンス**: jsonb（業者数増減容易、ただし型安全性は犠牲）
- **判2: 業者 API の Phase 1 統合範囲**
  - 全業者 API / NURO のみ API
  - **推定スタンス**: NURO のみ Phase 1、au / SoftBank は手入力
- **判3: 工事日カレンダービューの実装時期**
  - Phase 1 / Phase 2
  - **推定スタンス**: Phase 1 は一覧テーブル、Phase 2 でカレンダー
- **判4: クーリングオフ期間の自動判定**
  - 8 日経過後自動でフラグ切替 / 手動チェック
  - **推定スタンス**: 自動（Cron + Trigger）+ Chatwork 通知
- **判5: 業者からの月次明細の取込**
  - PDF OCR / CSV 取込 / 手入力
  - **推定スタンス**: 業者提供 CSV があれば取込、なければ手入力
- **判6: 顧客への工事日通知方法**
  - 営業から電話 / Chatwork 自動 / SMS
  - **推定スタンス**: 営業から電話確認（顧客接点維持）
- **判7: Bud 連携時の手数料区分**
  - 業務委託料区分（C-04 法定調書合計表対象）
  - **推定スタンス**: 業務委託（雑所得）扱い、税率は商材ごと

---

— spec-leaf-others-01 end —
