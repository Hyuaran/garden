# Tree Phase D-05: KPI ダッシュボード（コールセンター専用）

- 対象: Tree 管理者・後道さん（業績管理担当）が日次・週次・月次で見る KPI 画面
- 優先度: **🟡 中**（Phase D 仕上げ段階、現場投入後 1 ヶ月で本格運用）
- 見積: **0.7d**
- 担当セッション: a-tree
- 作成: 2026-04-25（a-auto / Batch 9 Tree Phase D #05）
- 改訂: **2026-04-26（a-main 006）— 判断保留 8 件すべて確定 + 既存 `/tree/dashboard` `/tree/ranking` `/tree/aporan` 統合**
- 前提:
  - D-01（tree_calling_sessions / tree_call_records）
  - D-03（マネージャー UI、リアルタイム当日分）
  - Bloom（全社 KPI）= 既存設計、Tree KPI は切り分け
  - spec-cross-storage（Batch 7）= CSV/Excel エクスポート
  - **既存実装**:
    - `/tree/dashboard`（既設、月間目標 60P 等のデモ値）— **本 spec で動的化**
    - `/tree/ranking`（既設、30 秒自動更新、有効率バー）— **本 spec で正式化**
    - `/tree/aporan`（既設、月次成績ランキング、MANAGER 限定機能）— **本 spec で KPI 集計と統合**

---

## 0. 2026-04-26 確定事項（a-main 006、東海林承認）

| # | 項目 | 確定内容 |
|---|---|---|
| 0-1 | KPI 目標設定機能 | **Phase D-2 で実装、まずは実績可視化に集中**。⚠️ **2026-04-26 a-main 確定 #20 拡張**: KPI 目標は **3 階層管理（個人 + チーム + 会社）** で実装。詳細スキーマは §0.x「KPI 目標 3 階層 DB 設計（#20 拡張）」参照 |
| 0-2 | アラート（閾値ベース） | **D-03 リアルタイムアラートで対応、KPI 画面は静的分析用** |
| 0-3 | グラフの期間比較 | **同時表示（折れ線 2 系統）** |
| 0-4 | PDF 出力 | **Phase D-1 は Excel のみ。PDF は東海林さん判断 → UI 完成後 後道さん FB 受領**（memory `feedback_ui_first_then_postcheck_with_godo.md` 準拠） |
| 0-5 | MV のサイズと REFRESH 負荷 | **日次 MV 約 100 万行、CONCURRENTLY OK、2 年後に partition 化検討** |
| 0-6 | KPI 画面のモバイル対応 | **タブレット対応（横 768px）まで、スマホは Phase D-2** |
| 0-7 | KPI 目標値のソース | **自社過去 3 ヶ月移動平均をベース、経営判断で補正** |
| 0-8 | 非稼働日の扱い | **既定は含める、「非稼働日除外」トグル提供** |

### 0.x KPI 目標 3 階層 DB 設計（2026-04-26 a-main 確定 #20 拡張）

KPI 目標管理は **個人 + チーム（任意）+ 会社** の 3 階層で実装する。Phase D-2 着手時に DB スキーマを以下のとおり追加。

#### 階層構造

| 階層 | 必須/任意 | テーブル | 用途 |
|---|---|---|---|
| **個人ノルマ** | 必須 | `tree_kpi_personal_targets` | オペレーター 1 人ごとの月次・週次目標（コール数・トス率・成約率） |
| **チームノルマ** | **任意**（チーム制ない時は省略可、NULL 許容） | `tree_kpi_team_targets` | チーム単位（部署 / 班 / プロジェクト）の合算目標。`team_id NULL` 許容 |
| **会社ノルマ** | 必須 | `tree_kpi_company_targets` | 全社合算の月次・四半期・年次目標 |

#### スキーマ案（Phase D-2 着手時 migration で追加）

```sql
-- 個人ノルマ（必須）
CREATE TABLE IF NOT EXISTS tree_kpi_personal_targets (
  target_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number  text NOT NULL REFERENCES root_employees(employee_number) ON UPDATE CASCADE,
  period_type      text NOT NULL CHECK (period_type IN ('weekly','monthly','quarterly','yearly')),
  period_start     date NOT NULL,
  period_end       date NOT NULL,
  metric           text NOT NULL CHECK (metric IN ('calls','toss','toss_rate','contract_rate','duration')),
  target_value     numeric NOT NULL,
  notes            text,
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  UNIQUE (employee_number, period_type, period_start, metric)
);

-- チームノルマ（任意、team_id NULL 許容）
CREATE TABLE IF NOT EXISTS tree_kpi_team_targets (
  target_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id          uuid,                                 -- NULL 許容: チーム制がない場合は本テーブル自体使わない or 全社統合チームとして NULL 行
  team_name        text,                                  -- 任意の表示名（"営業 1 課" 等）
  period_type      text NOT NULL CHECK (period_type IN ('weekly','monthly','quarterly','yearly')),
  period_start     date NOT NULL,
  period_end       date NOT NULL,
  metric           text NOT NULL CHECK (metric IN ('calls','toss','toss_rate','contract_rate','duration')),
  target_value     numeric NOT NULL,
  notes            text,
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
  -- team_id NULL 許容のため UNIQUE 制約は (COALESCE(team_id,'00000000-0000-0000-0000-000000000000'), period_type, period_start, metric) で表現
);

-- 会社ノルマ（必須、1 行 / 期間 / metric）
CREATE TABLE IF NOT EXISTS tree_kpi_company_targets (
  target_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type      text NOT NULL CHECK (period_type IN ('weekly','monthly','quarterly','yearly')),
  period_start     date NOT NULL,
  period_end       date NOT NULL,
  metric           text NOT NULL CHECK (metric IN ('calls','toss','toss_rate','contract_rate','duration')),
  target_value     numeric NOT NULL,
  notes            text,
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  UNIQUE (period_type, period_start, metric)
);
```

#### 表示時の優先順位（KPI 画面）

1. 個人画面では **個人 → チーム → 会社** の順に達成率を表示（個人比較で見やすく）
2. マネージャー画面では **チーム → 個人内訳 → 会社** の順
3. 後道さん（社長）画面では **会社 → チーム → 個人** の順

#### 設定権限

| 階層 | 設定者 |
|---|---|
| 個人ノルマ | manager+（自部署のみ）/ admin+（全社） |
| チームノルマ | admin+（チーム制設計時のみ。チーム制がなければ本テーブル不使用） |
| 会社ノルマ | super_admin（経営判断） |

#### チーム制ない時の運用

- **`tree_kpi_team_targets` テーブルは作成するが、行は空**で運用
- KPI 画面はチーム階層をスキップ（個人 → 会社の 2 階層表示）
- 将来チーム制が導入された場合は `team_id` を追加する形でスムーズに対応可能

---

### 既存実装との整合性（重要）

#### `/tree/dashboard`（既存、デモ値）
- **既存実装**: 月間目標 60P 等のデモ値で動作中、個人 KPI / マネージャービュー切替
- **本 spec で動的化**:
  - 過去 3 ヶ月移動平均をベース（判 0-7）→ `mv_tree_kpi_monthly` から SELECT
  - 経営判断補正は admin が `root_settings.tree_kpi_targets` で上書き可能
  - 個人 / マネージャービュー切替は既存 `useTreeState` 流用

#### `/tree/ranking`（既存、30 秒自動更新）
- **既存実装**: 当日ランキング、30 秒自動更新、有効率バー表示
- **本 spec で正式化**:
  - **30 秒自動更新は維持**（D-03 のマネージャー UI と同等 polling）
  - データソースを `tree_call_records` 当日分の SELECT（MV ではなくリアルタイム集計）
  - 有効率（eff）= 受注数 / 架電数（D-03 §0 アラート閾値と整合）
  - 表示権限: 全員（toss 含む、自分の順位はモチベーション維持に重要）

#### `/tree/aporan`（既存、月次成績ランキング、MANAGER 限定）
- **既存実装**: 月次成績ランキング、MANAGER 限定機能
- **本 spec で正式化**:
  - データソースを `mv_tree_kpi_monthly` に切替
  - 表示権限: **manager+ のみ**（toss / closer は閲覧不可、既存方針維持）
  - エクスポート: CSV / Excel（判 0-4、PDF は D-2 検討）

### Bloom（全社 KPI）との重複整理

| 観点 | Tree KPI（本 spec） | Bloom（全社） |
|---|---|---|
| 対象 | コールセンター専用 | 全モジュール統合 |
| 粒度 | オペレーター別・日次 | 部門別・月次 |
| 主指標 | コール数・トス率・有効率（eff）・離脱率 | 売上・利益・案件数 |
| 売上金額 | 持ち込まない（Bloom 担当） | ○ |

### モバイル対応の方針（判 0-6）
- Phase D-1 はタブレット（横 768px）まで対応、スマホ（< 768px）は Phase D-2
- 後道さんは PC + タブレット併用想定、スマホは現場マネージャー用途で必要なら D-2 で追加

### PDF 出力の方針（判 0-4、UI 先行）
- Phase D-1 は **Excel のみ**で実装
- UI 完成後に後道さんに見せて、PDF が必要かフィードバック受領
- memory `feedback_ui_first_then_postcheck_with_godo.md` 準拠（先に動くものを見せる、後置きフィードバック）

---

## 1. 目的とスコープ

### 目的

コールセンターに特化した KPI を、**日次・週次・月次**で可視化し、Bloom（全社ダッシュボード）と役割分担しつつ、Tree 固有の深掘り指標を提供。

### 含める

- KPI 指標（コール数 / 成約率 / 稼働率 / 離脱率 等、標準 10 種）
- 粒度（日次 / 週次 / 月次）
- 集計対象（個人 / チーム / 部署 / 全社）
- ダッシュボード UI（後道さん閲覧想定、非技術者向け）
- CSV / Excel エクスポート
- ドリルダウン（個人 → コール一覧）
- KPI 計算の pre-aggregate VIEW

### 含めない

- リアルタイム稼働（D-03）
- 介入機能（D-03）
- KPI 目標設定 / アラート（§判断保留、Phase D-2 で検討）
- Bloom 側の全社ビュー

---

## 2. 既存実装との関係

### 2.1 Bloom との役割分担

| 観点 | Bloom（全社） | **Tree KPI（本 spec）** |
|---|---|---|
| 対象 | 全モジュール統合 | コールセンター専用 |
| 粒度 | 部門別・月次集計 | **オペレーター別・日次**|
| 指標 | 売上 / 利益 / 案件数 | **コール数 / 成約率 / 離脱率**|
| 対象者 | 経営層・全社 | 後道さん・マネージャー |
| 更新 | 日次バッチ | **日次バッチ + 当日リアルタイム**|

### 2.2 Tree KPI が重複しないよう

- 売上金額 / 利益率は Bloom 担当、Tree には持ち込まない
- 案件化数（トス数）は両方で見るが、Tree は**オペレーター視点**、Bloom は**全社視点**で集計キーが異なる

### 2.3 既存画面との接続

- `/tree/dashboard`（D-03）= リアルタイム当日分
- `/tree/kpi`（新設、本 spec）= 過去期間の分析用
- サイドバー経由で両画面を行き来

---

## 3. KPI 指標（標準 10 種）

### 3.1 営業活動指標

| 指標 | 定義 | 集計 SQL 概念 |
|---|---|---|
| コール数 | 期間内の `tree_call_records` 件数 | count(*) |
| 接続数 | `result_code <> 'unreach'` の件数 | count filter |
| 接続率 | 接続数 / コール数 | 比率 |
| トス数 | `result_code = 'toss'` の件数 | count filter |
| トス率 | トス数 / 接続数 | 比率（**最重要 KPI**）|

### 3.2 品質指標

| 指標 | 定義 | 集計 |
|---|---|---|
| NG 率 | `result_code LIKE 'ng_%'` 比率 | |
| クレーム率 | `result_code = 'ng_claim'` 比率 | **要監視**（高いと危険）|
| 平均通話時間 | `avg(duration_sec)` | 秒 |

### 3.3 稼働指標

| 指標 | 定義 | 集計 |
|---|---|---|
| 稼働率 | セッション稼働時間 / シフト時間 | マスタの `shift_hours` が必要 |
| 1 時間コール数 | コール数 / 稼働時間 | 効率指標 |

### 3.4 案件化後指標（Leaf 連携）

- 事前に `tree_call_records.tossed_leaf_case_id` から Leaf status を逆引き
- **受注率**（トス → accepted まで至った比率）
- **解約率**（accepted → cancelled 比率、Leaf C-01 `cancellation_flag`）

---

## 4. 粒度と集計対象

### 4.1 時間粒度

| 粒度 | 更新タイミング | 保存期間 |
|---|---|---|
| 当日 | リアルタイム（D-03）| — |
| 日次 | 日次 23:30 バッチ | 3 年 |
| 週次 | 月曜朝 05:00 | 3 年 |
| 月次 | 月初 05:00 | 無制限（7 年以上）|
| 年次 | 年初 05:00 | 無制限 |

### 4.2 集計対象

| 対象 | 説明 | 閲覧最低権限 |
|---|---|---|
| 個人 | 社員 1 名 | 本人 / manager+ |
| チーム | リーダー単位 | リーダー / manager+ |
| 部署 | 事業部単位 | manager+（自部署のみ）|
| 全社 | 全コールセンター | admin+ |

---

## 5. データモデル: 集計 VIEW

### 5.1 日次集計

```sql
CREATE MATERIALIZED VIEW mv_tree_kpi_daily AS
SELECT
  (called_at AT TIME ZONE 'Asia/Tokyo')::date AS report_date,
  employee_id,
  campaign_code,
  count(*) AS total_calls,
  count(*) FILTER (WHERE result_code <> 'unreach') AS total_connected,
  count(*) FILTER (WHERE result_code = 'toss') AS total_toss,
  count(*) FILTER (WHERE result_code = 'order') AS total_orders,
  count(*) FILTER (WHERE result_code LIKE 'ng_%') AS total_ng,
  count(*) FILTER (WHERE result_code = 'ng_claim') AS total_claim,
  count(*) FILTER (WHERE result_code LIKE 'sight_%') AS total_sight,
  sum(duration_sec) AS total_duration_sec,
  count(DISTINCT session_id) AS session_count,
  count(DISTINCT list_id) FILTER (WHERE list_id IS NOT NULL) AS unique_list_count
FROM tree_call_records
WHERE deleted_at IS NULL
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX idx_mv_tkd_pk ON mv_tree_kpi_daily (report_date, employee_id, campaign_code);
CREATE INDEX idx_mv_tkd_date ON mv_tree_kpi_daily (report_date DESC);
```

### 5.2 週次集計

```sql
CREATE MATERIALIZED VIEW mv_tree_kpi_weekly AS
SELECT
  date_trunc('week', report_date)::date AS week_start,
  employee_id,
  campaign_code,
  sum(total_calls) AS total_calls,
  sum(total_connected) AS total_connected,
  sum(total_toss) AS total_toss,
  sum(total_ng) AS total_ng,
  sum(total_claim) AS total_claim,
  sum(total_duration_sec) AS total_duration_sec,
  sum(session_count) AS session_count,
  -- 週次独自: 日次の平均も保持
  avg(total_calls)::numeric(10,2) AS avg_daily_calls
FROM mv_tree_kpi_daily
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX idx_mv_tkw_pk ON mv_tree_kpi_weekly (week_start, employee_id, campaign_code);
```

### 5.3 月次集計

```sql
CREATE MATERIALIZED VIEW mv_tree_kpi_monthly AS
SELECT
  date_trunc('month', report_date)::date AS month_start,
  employee_id,
  campaign_code,
  sum(total_calls) AS total_calls,
  sum(total_connected) AS total_connected,
  sum(total_toss) AS total_toss,
  sum(total_orders) AS total_orders,
  sum(total_ng) AS total_ng,
  sum(total_claim) AS total_claim,
  sum(total_duration_sec) AS total_duration_sec,
  count(DISTINCT report_date) AS work_days
FROM mv_tree_kpi_daily
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX idx_mv_tkm_pk ON mv_tree_kpi_monthly (month_start, employee_id, campaign_code);
```

### 5.4 REFRESH スケジュール

| MV | REFRESH 頻度 | Cron |
|---|---|---|
| mv_tree_kpi_daily | 日次 23:30 | `30 14 * * *` UTC |
| mv_tree_kpi_weekly | 月曜 05:00 | `0 20 * * 0` UTC |
| mv_tree_kpi_monthly | 月初 05:00 | `0 20 1 * *` UTC |

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tree_kpi_daily;
```

- `CONCURRENTLY` 併用で業務中断なし
- REFRESH 失敗時は Chatwork admin アラート

---

## 6. ダッシュボード UI

### 6.1 画面構成（`/tree/kpi`）

```
┌──────────────────────────────────────────────────────────────┐
│ 【Tree KPI ダッシュボード】                                    │
│                                                              │
│ 期間: [日次 ▼] 2026-04-01 〜 2026-04-25                      │
│ 対象: [個人 ▼] 山田太郎      キャンペーン: [関電 ▼]           │
│                                                              │
│ ┌──────────────┬──────────────┬──────────────┐                │
│ │ 📞 コール数   │ 🔗 接続率     │ ✅ トス率      │                │
│ │  1,250 件    │  68.5%       │  16.2%       │                │
│ │ (前月比 +12%) │ (前月比 -1.2%)│ (前月比 +0.8%)│                │
│ └──────────────┴──────────────┴──────────────┘                │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐      │
│ │ 📈 日別トレンド（直近 30 日）                          │      │
│ │ [線グラフ: コール数 / トス数 / NG 率 を 3 系統]        │      │
│ └──────────────────────────────────────────────────────┘      │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐      │
│ │ 🏆 ランキング（対象期間内、トス率降順）                 │      │
│ │ 1. 山田太郎  トス率 20.1%  (コール 210)                │      │
│ │ 2. 佐藤花子  トス率 18.5%  (コール 195)                │      │
│ │ 3. 鈴木次郎  トス率 16.0%  (コール 180)                │      │
│ └──────────────────────────────────────────────────────┘      │
│                                                              │
│ [CSV エクスポート]  [Excel エクスポート]  [月次レポート生成]    │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 UI 設計原則（非技術者向け）

- 用語は業務そのまま（「MRR」「ARPU」等の IT 系略語は避ける）
- 「コール数」「トス率」は現場用語、SQL 名称は裏に隠す
- 色はシンプル（緑 🟢 / 黄 🟡 / 赤 🔴 の 3 色のみ）
- 前月比・前週比は矢印（↑↓→）で直感表示

### 6.3 ドリルダウン

- 棒グラフ・リストをクリック → 個人ドリル画面
- 個人ドリル画面から → コール一覧（日別、直近 100 件まで）
- コール一覧から → 個別コール詳細（memo / result_code / tossed_leaf_case_id リンク）

### 6.4 ライブラリ選定

- グラフ: Recharts（既存 Forest 採用、Bundle 軽量）
- テーブル: TanStack Table（Bud で採用済）
- DatePicker: react-day-picker（軽量）

---

## 7. CSV / Excel エクスポート

### 7.1 ファイル形式

| 形式 | 用途 |
|---|---|
| CSV | シンプル、Excel で開ける、他システム取込 |
| Excel（.xlsx）| 書式付き、複数シート（サマリ + 詳細）|
| PDF | 月次レポート印刷用（§7.4 §判断保留）|

### 7.2 CSV 仕様

```
report_date,employee_id,employee_name,campaign,calls,connected,toss,ng,toss_rate
2026-04-01,0123,山田太郎,kanden,45,30,8,5,26.7%
2026-04-02,0123,山田太郎,kanden,50,35,9,4,25.7%
...
```

- エンコーディング: UTF-8 BOM（Excel 日本語環境対応）
- 区切り: `,`、文字列は `"` 囲み
- ファイル名: `tree-kpi-{period}-{target}-{yyyymmdd}.csv`

### 7.3 Excel 仕様（2 シート構成）

- Sheet 1 「サマリ」: 期間全体の KPI テーブル
- Sheet 2 「日別詳細」: 日次 × 個人 の全行
- ヘッダ色: 淡緑、合計行: 太字 + 背景灰
- Anthropic skill `anthropic-skills:xlsx` 活用

### 7.4 月次レポート（Chatwork 投稿想定）

- CSV/Excel を Storage `reports/tree-kpi/YYYY-MM/` に保存
- 投稿本文: 「2026-04 月次 KPI レポートが Garden で公開されました。ログインしてご確認ください。」
- **案 D 準拠**: 署名 URL 流通しない、Garden ログイン誘導のみ

---

## 8. 性能要件

| 指標 | 目標 | 計測 |
|---|---|---|
| ダッシュボード初回表示 | < 2s | Lighthouse |
| 期間切替（日 → 月）| < 1s | Playwright |
| CSV エクスポート（1 万行）| < 3s | Playwright |
| Excel エクスポート（1 万行 × 2 シート）| < 10s | Playwright |
| 月次 MV REFRESH | < 5min | cron ログ |

---

## 9. 権限制御

spec-cross-rls-audit / D-03 §7 準拠：

| 画面操作 | garden_role 最低 |
|---|---|
| 個人 KPI 閲覧（自分）| toss |
| 個人 KPI 閲覧（他者）| manager（自部署）/ admin（全社）|
| 部署サマリ | manager |
| 全社サマリ | admin |
| CSV/Excel エクスポート | manager（自部署分）/ admin（全社）|
| 月次レポート生成 | admin |

### Materialized View の RLS

- MV は通常 RLS 効かない → Tree KPI 画面は **Server Component / Server Action で SELECT**、権限チェックを関数側で実施
- クライアント直接 SELECT は禁止（`src/app/tree/kpi/_lib/guard.ts` で集中管理）

---

## 10. 実装ステップ

1. **Step 1**: MV 3 本（daily / weekly / monthly）作成 + REFRESH スケジューリング（1.5h）
2. **Step 2**: `/tree/kpi` 画面骨格 + 期間・対象セレクタ（1.0h）
3. **Step 3**: KPI カード 10 種レンダー（1.0h）
4. **Step 4**: Recharts トレンドグラフ（1.0h）
5. **Step 5**: ランキングテーブル（0.5h）
6. **Step 6**: CSV/Excel エクスポート（1.0h）
7. **Step 7**: 権限ガード・RLS 検証（0.5h）
8. **Step 8**: ドリルダウン（個人 → コール一覧）（0.5h）
9. **Step 9**: 結合テスト・バグ修正（0.5h）

**合計**: 約 **0.7d**（約 8h）

---

## 11. テスト観点

詳細は D-06 §3。本 spec 固有観点：

- 期間切替（日 → 週 → 月）の数値整合性（合計値の一致検証）
- 前月比計算（前月データ 0 件時の除算エラー回避）
- エクスポート CSV の文字化け（BOM 有無、特殊文字含む顧客名）
- Materialized View REFRESH 失敗時のダッシュボード表示
- 個人 KPI で他人データが見えないこと（RLS + Server Action 二重チェック）

---

## 12. 判断保留事項（2026-04-26 全件確定済 — 履歴保持）

> 全 8 件の確定内容は §0 を正典とする。

- **判1（確定）: KPI 目標設定機能** — 確定: D-2 で実装、D-1 は実績可視化に集中（推定通り）
- **判2（確定）: 閾値ベースアラート** — 確定: D-03 リアルタイム側で対応、KPI 画面は静的分析用（推定通り）
- **判3（確定）: グラフ期間比較** — 確定: 同時表示（折れ線 2 系統）（推定通り）
- **判4（確定）: PDF 出力** — 確定: D-1 Excel のみ、PDF は **UI 完成後 後道さん FB 受領**（memory `feedback_ui_first_then_postcheck_with_godo.md` 準拠）
- **判5（確定）: MV サイズ** — 確定: 日次 MV 約 100 万行、CONCURRENTLY OK、2 年後 partition 検討（推定通り）
- **判6（確定）: モバイル対応** — 確定: タブレット（横 768px）まで、スマホは D-2（推定通り）
- **判7（確定）: KPI 目標値ソース** — 確定: 自社過去 3 ヶ月移動平均ベース + 経営判断補正（推定通り）
- **判8（確定）: 非稼働日扱い** — 確定: 既定含める、「非稼働日除外」トグル提供（推定通り）

---

## 13. 実装見込み時間の内訳

| 作業 | 見込 |
|---|---|
| Materialized View 3 本構築 | 1.5h |
| ダッシュボード UI（カード / グラフ / テーブル）| 3.5h |
| エクスポート機能（CSV/Excel）| 1.0h |
| 権限ガード・RLS 検証 | 0.5h |
| ドリルダウン + 結合テスト | 1.0h |
| **合計** | **0.7d**（約 7.5h）|

---

— spec-tree-phase-d-05 end —
