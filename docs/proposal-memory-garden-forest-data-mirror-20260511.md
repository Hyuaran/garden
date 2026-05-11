# proposal v1: 新規 memory project_garden_forest_data_mirror_from_root

> 起草: a-analysis-001
> 起草日時: 2026-05-11 (月) 11:30
> 用途: 新規 memory ファイル `project_garden_forest_data_mirror_from_root.md` の起草ドラフト
> 起点: main- No. 232（東海林さん明示仕様情報、5/11 11:02 tab-3 cashflow 修正依頼時）
> 状態: ドラフト、main + a-audit-001 critique + 東海林さん最終決裁後に main が memory ファイル新規登録 + MEMORY.md 索引追記
> ファイル命名: 採用案 = `project_garden_forest_data_mirror_from_root.md`（main 提示通り）

---

## 命名適切性検討（a-analysis）

| 候補 | 評価 |
|---|---|
| A. project_garden_forest_root_mirror.md | 短いがミラーの方向が不明確 |
| B. project_garden_forest_data_mirror_from_root.md（main 提示）| **採用**: データの流れ（from Root）を明示、既存命名規則（project_garden_xxx）と整合、語順「データミラーが Root から」直感的 |
| C. project_garden_root_to_forest_mirror.md | 方向性明示だが、Forest が主役（モジュール名先頭）の規則と乖離 |

→ B 案採用。

---

## 改訂版 memory 全文（コピペ用、~~~ 外で提示）

以下が新規 memory `project_garden_forest_data_mirror_from_root.md` の v1 全文。承認後 main がそのまま memory ファイルとして新規登録。

---

### frontmatter

- name: Garden Forest UI = Garden Root ミラー仕様（数値ダミー / 本番 Root → Forest ミラー / 既存実データ Root 移行）
- description: Forest UI の数値は mock 段階ではダミー、本番実装時は Garden Root が保管する実データを Forest UI が取得・表示するミラー仕様。既存 garden-forest_v9.html 等の実データは Root へ移行保管必要。データソース一元化 + Forest「見せる」役割専任で複数モジュール二重管理を防ぐ。
- type: project
- originSessionId: a-analysis-001-2026-05-11 (起源: 東海林さん明示仕様情報、main- No. 232、tab-3 cashflow 修正依頼時 11:02)

---

### 本文

#### 仕様（3 点、東海林さん明示 2026-05-11 11:02）

##### 1. Forest UI 数値の現状（mock 段階）

Garden Forest の各 tab で表示される数値は、現時点（5/11）では **mock 段階のダミーデータ**。実データではない。

該当箇所（推定）:
- tab-2 KPI ダッシュボード（各 KPI 数値）
- tab-3 cashflow（銀行残高 / 売掛買掛 / 入出金予定）
- 他 tab の数値表示部分

##### 2. 本番実装時の方針: Garden Root → Forest ミラー仕様

本番実装フェーズで以下を確立:

| 構造 | 役割 |
|---|---|
| Garden Root（地下層、データ primary 保管）| 実データの保管担当、root_xxx テーブルで管理 |
| Garden Forest（樹冠層、表示専任）| 独自データを持たない、Root から取得した実データをミラー表示 |
| 他モジュール（Bloom / Bud 等）| 同じ Root データを参照可能 = データソース一元化 |

理由:
- Root は組織・従業員・パートナー・マスタの primary 場所、財務数値も Root に集約することで「複数モジュールで同じ数値を二重管理」を防ぐ
- Forest は経営ダッシュボードとして「見せる」役割専任、データを持たない
- 他モジュール（Bloom / Bud 等）からも Root の同じ数値を参照可能 = データソース一元化

##### 3. 既存 Garden Forest 内 実データの Root 移行

現状で **garden-forest_v9.html 等の既存ファイル内に実データが格納されている部分が存在** → Root への移行保管が必要。

確認 + 移行対象:
- garden-forest_v9.html 内 hardcoded 数値（決算 KPI / 月次推移 / 銀行残高履歴 等）
- 他 Forest tab HTML 内 hardcoded 数値
- Forest 専用 JSON / CSV / DB ファイルがあれば併せて

移行方針（方向性のみ明文化、具体スケジュールは別途検討）:

| ステップ | 内容 |
|---|---|
| 1. 実データ抽出 | garden-forest_v9.html 等から数値部分を抜き出し |
| 2. Root テーブル設計 | root_financial_kpi / root_bank_balance / root_payable_receivable 等の新規テーブル設計 |
| 3. Root への投入 | 抽出データを新規テーブルに投入 |
| 4. Forest UI 改修 | hardcoded → Root API 経由取得 + ミラー表示 |

##### Root primary 保管対象テーブル例 + 取引先 / 外注先連携例（v1.1 追加、audit-001- No. 12 観点 5 起源）

Root primary 保管対象テーブルと Forest 表示先 + 取引先（root_partners）/ 外注先（root_vendors）連携の具体例:

| Root テーブル | Forest 表示先 | 連携例 |
|---|---|---|
| root_financial_kpi | tab-2 KPI ダッシュボード | 全社 KPI（売上 / 利益 / コスト等）|
| root_bank_balance | tab-3 cashflow | 銀行残高履歴 |
| root_payable_receivable | tab-3 cashflow | 売掛・買掛残高 |
| **root_partners 連携**（project_partners_vs_vendors_distinction 参照）| tab-2 / tab-4 | **取引先別 KPI**（取引先別売上 / 損益 / 商流別 ROI / 上位店ランキング）|
| **root_vendors 連携**（同上）| tab-4 損益管理 | **外注先別損益管理**（外注先別売上原価 / 利益率 / 傘下店ランキング）|

→ Root が取引先 / 外注先マスタを primary 保管している前提で、Forest は集約 KPI 表示 + 取引先 / 外注先別の細分化集計を担当。

#### tab 別状態（5/11 時点、推定込で東海林さん最終確認推奨）

| tab | 内容 | 現状 | 本番方針 |
|---|---|---|---|
| tab-1 | 概要 | mock | Root ミラー |
| tab-2 | KPI ダッシュボード | mock | Root ミラー |
| tab-3 | cashflow（銀行残高 / 売掛買掛 / 入出金予定）| mock + 一部 garden-forest_v9.html の実データあり | 実データ Root 移行 → ミラー |
| tab-4 | 損益管理 | mock | Root ミラー |
| tab-5 | 税務カレンダー | 一部実データ | 実データ Root 移行 → ミラー |
| tab-6 | 派遣資産要件 | mock | Root ミラー |
| tab-7-a | 決算資料 PDF / ZIP（ファイル系）| 一部実データ（Google Drive 保管中）| **Storage 移行**（Google Drive → Supabase Storage、project_forest_files_in_google_drive 参照、ファイル系統合検討）|
| tab-7-b | 決算 KPI / 月次推移（数値系）| 一部実データ（garden-forest_v9.html 内 hardcoded）| **Root 移行 → ミラー**（root_financial_kpi 経由、数値系統合）|
| tab-8 | 経営ダッシュボード | mock | Root ミラー |

注: tab 一覧 / 状態 / **実 tab 数（garden-forest_v9.html との整合）** は a-analysis 推定込、東海林さん最終確認 + a-forest-002 / a-root-002 セッションでの実態確認推奨。実 tab 数が garden-forest_v9.html と異なる場合（tab 追加 / 削除 / 名称変更等）、当該行を v1.2 以降で更新（audit-001- No. 12 観点 2 起源）。

#### 本番実装フェーズ

| Phase | 想定時期 | 実装内容 |
|---|---|---|
| Phase A 完走後（5 月末〜6 月想定）| Forest 本番統合 前段 | Root 新規テーブル設計 + 実データ Root 投入 |
| Phase A 完走後（後段）| Forest UI 改修 | hardcoded → Root API ミラー化 |
| Phase B 以降 | 全 tab Root 連携完了 | 実データ運用開始、Forest = 「見せる」役割専任確立 |

具体スケジュールは別途検討、本 memory は方向性のみ明文化。

#### 当事者セッション間連携

| セッション | 役割 |
|---|---|
| a-root-002 | Root 新規テーブル設計 + 実データ投入 |
| a-forest-002 | Forest UI 改修（hardcoded → Root API ミラー化）|
| a-bloom-006 / a-bud-002 等 | 同じ Root データの並列参照実装（Forest と独立だが同一ソース）。**時系列**: Root 新規テーブル投入完了後、Forest UI 改修と並行して並列参照実装着手可（Forest 完了待ちではなく、Root 投入完了で並列開始可能、audit-001- No. 12 観点 4 起源）|
| a-main-NNN | 横断調整、進捗巡回 |
| a-analysis-001 / a-audit-001 | 設計妥当性 critique（必要時）|

#### 関連

- project_garden_3layer_visual_model（Garden 3 レイヤー視覚モデル、Forest = 樹冠層 / Root = 地下層）
- project_forest_files_in_google_drive（Forest 関連ファイル現状、Google ドライブ保管中、tab-7 関連）
- project_partners_vs_vendors_distinction（Root 取引先 / 外注先区分、関連マスタ設計）
- project_garden_dual_axis_navigation（Garden 二重軸ナビゲーション、Forest と Root の役割分離）
- 5/11 11:02 東海林さん明示仕様情報（tab-3 cashflow 修正依頼時）

#### 改訂履歴

- 2026-05-11 11:30 v1 ドラフト初版（a-analysis-001、main- No. 232 起源、東海林さん明示仕様情報）
- 2026-05-11 12:00 v1.1 軽微改善反映（a-analysis-001、audit-001- No. 12 改善 4 件起源、main- No. 239 GO）: 観点 2 実 tab 数整合確認注記強化 / 観点 4 並列参照実装の時系列明示 / 観点 5 Root primary 保管対象テーブル + 取引先・外注先連携例追加 / audit 独立 tab-7 ファイル系 vs 数値系分離（tab-7-a / tab-7-b）

---

## 起草内容概要（main / a-audit 採否検討用）

| 項目 | 内容 |
|---|---|
| name | Garden Forest UI = Garden Root ミラー仕様（数値ダミー / 本番 Root → Forest ミラー / 既存実データ Root 移行）|
| description | 仕様 3 点 + データソース一元化 + Forest 役割専任の効果を 1 文に集約 |
| type | project |
| 本文セクション 6 件 | 仕様（3 点）/ tab 別状態 / 本番実装フェーズ / 当事者セッション間連携 / 関連 / 改訂履歴 |
| 関連 memory | 4 件（3layer / forest_files / partners_vs_vendors / dual_axis）+ 起源情報 |
| 命名 | project_garden_forest_data_mirror_from_root.md（main 提示 B 案採用）|
| MEMORY.md 索引追加先（推奨）| 🟢 Garden モジュール固有（既存 7 entry + 本件 = 8 entry へ）|

---

## 自己参照禁止 抵触検証

- 全 Garden 共通仕様 memory = a-analysis 自身の運用変更ではない（抵触なし）
- 当事者性: Forest UI 起草は a-forest-002 / claude.ai が担当、a-analysis は memory 起草担当 = 機能本旨内（§2-1 a-analysis 担当業務「memory 新設提案 / 改訂内容起草」）

---

## main / a-audit / 東海林さん 採否仰ぎ事項

| # | 判断事項 | 推奨 |
|---|---|---|
| 1 | 命名 B 案（project_garden_forest_data_mirror_from_root.md）採用 | ✅ 採用推奨 |
| 2 | tab 別状態表（a-analysis 推定込）の精度 | 東海林さん最終確認 + 必要なら a-forest-002 / a-root-002 への実態確認 dispatch |
| 3 | 本番実装フェーズの想定時期（Phase A 完走後 5 月末〜6 月）| 大方針として OK 推奨、具体スケジュールは別途 |
| 4 | MEMORY.md 索引追加先（🟢 Garden モジュール固有）| OK 推奨 |
| 5 | a-audit critique 依頼可否 | 標準フロー §4-1 通り、main- No. 後続候補で依頼推奨 |

---

## a-analysis 補足（任意、東海林さん向け）

- 「Forest = 樹冠層（見せる）」「Root = 地下層（保管）」の Garden 3 レイヤー視覚モデル（project_garden_3layer_visual_model）と本仕様は **完全整合**。memory 同士の構造的一貫性確保済。
- tab-7 決算資料 ZIP は既存 memory project_forest_files_in_google_drive（Google ドライブ保管中）と関連、Storage 移行戦略と Root 移行の優先順位は別途検討推奨。
- 命名 B 案は冗長（44 文字）だが、A 案（project_garden_forest_root_mirror）だと「ミラー」だけで方向が不明確 = データの流れを明示する B 案が東海林さん（非エンジニア）にとっても理解しやすい。
