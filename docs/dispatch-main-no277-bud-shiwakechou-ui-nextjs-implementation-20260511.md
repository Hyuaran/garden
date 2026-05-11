# dispatch main- No. 277 — a-bud-002 へ 07_Shiwakechou UI Next.js 化 + 弥生エクスポート連動（# 276 並行、案 A 採択）

> 起草: a-main-022
> 用途: 既存 Bud UI v2 07_Shiwakechou mock (3224 行) を Next.js 化 + Supabase 仕訳帳テーブル + CSV パーサー → 弥生 export パイプライン構築。決算作業急務、# 276 と並行進行。
> 番号: main- No. 277
> 起草時刻: 2026-05-11(月) 16:25

---

## 投下用短文（東海林さんがコピー → a-bud-002 にペースト）

~~~
🟡 main- No. 277
【a-main-022 から a-bud-002 への dispatch（07_Shiwakechou UI Next.js 化 + 弥生 export 連動、# 276 と並行、案 A 採択）】
発信日時: 2026-05-11(月) 16:25

# 件名
🟡 既存 Bud UI v2 07_Shiwakechou mock (3224 行) を Next.js 化 + Supabase 仕訳帳テーブル設計 + Forest 既存 CSV パーサー連動 + 弥生エクスポート出力。# 276 (Bank) と並行進行、決算作業急務 Garden 化、Forest 既実装の Bud 統合

# A. 背景（東海林さん発言、5/11 16:20）

東海林さん発言: 「仕訳帳は Garden Forest の機能だったけど Garden Bud だよね」「とりあえず今すぐ決算作業がいるからどこでもいい、使えるようにしたい」

→ 仕訳帳 = 本来 Bud（経理スコープ）配置が正、Forest 既存実装の Bud 移管 + UI Next.js 化 で完全 Garden 化。

# B. 既存 mock 確認

| ファイル | 行数 | 内容 |
|---|---|---|
| 015_Gardenシリーズ/000_GardenUI_bud/07_Shiwakechou/index.html | **3224 行** | 仕訳帳一覧 + 検索 + 弥生 export ボタン mock |
| _chat_workspace/garden-bud/ui_drafts/chat-ui-bud-shiwakechou-fullscreen-v2-20260507.html | 同等 | v2 ソース |

→ 既存 mock 中規模、Next.js 化のベースとして十分。

# C. 案 A 採択（# 276 と統一、東海林さん 5/11 16:20）

# 276 (Bank) と同じ案 A:
- a-bud-002 で Next.js 化（既存 mock 延長、Forest 既存 CSV パーサー import）
- 5/12 デモ前 alpha 版達成

# D. 実装スコープ（5 タスク）

## D-1. Next.js 化（src/app/bud/shiwakechou/）

| 項目 | 内容 |
|---|---|
| ファイル | src/app/bud/shiwakechou/page.tsx + _components/ + _lib/ |
| ベース | 015_Gardenシリーズ/000_GardenUI_bud/07_Shiwakechou/index.html (3224 行) を React component 分解 |
| Bloom precedent | 06_CEOStatus / 03_Workboard 踏襲 |
| 必須要素 | topbar / sidebar-dual / activity-panel / page-favorite-btn / gf-summary-card 共通 |

## D-2. Supabase 仕訳帳テーブル設計

| テーブル | 用途 |
|---|---|
| bud_journal_entries | 仕訳帳本体（取引履歴ベース） |
| bud_journal_accounts | 勘定科目マスタ（弥生体系準拠） |
| bud_journal_export_logs | 弥生 export 履歴（CSV 出力ファイル trace） |

列例（bud_journal_entries）:
- entry_id (PK), entry_date, debit_account_code, credit_account_code, amount, description, source ('csv_auto' / 'manual_input'), source_bank_transaction_id (FK bud_bank_transactions、# 276 連動), status ('pending' / 'confirmed' / 'exported'), exported_at, created_at, updated_at

RLS: 全員 SELECT、書込は payroll_auditor 以上、論理削除のみ。

## D-3. CSV → 仕訳変換ロジック（Forest 既存実装連動）

| 機能 | 説明 |
|---|---|
| 銀行取引履歴 → 仕訳自動生成 | bud_bank_transactions（# 276 連動）→ bud_journal_entries（pending） |
| 勘定科目自動判定 | 取引摘要から科目推定（ルールエンジン、Forest 既存ロジック踏襲）|
| 手動修正 UI | pending → confirmed への昇格、東海林さん確認フロー |
| TDD 21 件継続 | Forest 側既実装、Bud で再利用 |

## D-4. 弥生エクスポート（弥生会計形式 CSV 出力）

| 項目 | 内容 |
|---|---|
| 形式 | 弥生会計 標準 CSV インポート形式（Shift-JIS、CRLF） |
| 対象 | status='confirmed' の仕訳 |
| 出力先 | ダウンロードボタン + bud_journal_export_logs に履歴 |
| 既存実装 | Forest 側既完成（commit `105e322` / `e73329e`）、Bud に import |

## D-5. 検索 + フィルター UI

- 期間（年月）/ 法人 / 勘定科目 / status / 金額範囲
- ページネーション（仕訳件数多）
- 集計（debit / credit 合計）

# E. # 276 (Bank) との関係

| 機能 | # 276 (Bank) | # 277 (Shiwakechou) |
|---|---|---|
| CSV パーサー | shared library 化（共通基盤） | 同一 shared library 利用 |
| 取引履歴 | bud_bank_transactions（生データ）| bud_journal_entries（仕訳化済）|
| 関係 | Bank ← FK ← Shiwakechou | bud_journal_entries.source_bank_transaction_id |

→ # 276 が先行（Bank UI + CSV 取込基盤）、# 277 はその上の仕訳化レイヤー。

# F. 緊急度 / スコープ判断

| 観点 | 内容 |
|---|---|
| 緊急度 | 🟡 中（決算急務だが alpha は # 276 後）|
| 想定工数 | 07_Shiwakechou Next.js 化 + 仕訳テーブル + CSV → 仕訳変換 + 弥生 export + 検索 UI = **2-3d** 推定（# 276 完了後 + subagent-driven 並列で 1-1.5d）|
| 着手判断 | # 276 と並列着手可、ただし Bank 基盤完成後の方が効率良し |
| 後道さんデモ前完了目標 | 🟡 alpha 版（仕訳閲覧 + 弥生 export ボタン）は 5/12 後の段階で OK、決算実利用は早期目標 |

# G. 報告フォーマット（bud-002- No. 41/42 以降）

# 276 と並列で進めるため、報告は両機能を統合 or 個別:
- 統合: bud-002- No. 41 で「Bank + Shiwakechou」両方の進捗
- 個別: bud-002- No. 41 (Bank) / bud-002- No. 42 (Shiwakechou)

a-bud-002 判断 OK、軽量 ACK 採用範囲。

# H. 緊急度

🟡 中（決算急務だが alpha は # 276 後、5/12 デモ前は # 276 集中で OK）

# I. self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A: 背景（東海林さん発言 + スコープ整理）
- [x] B: 既存 mock 確認（3224 行）
- [x] C: 案 A 採択明示（# 276 と統一）
- [x] D: 実装スコープ 5 タスク詳細
- [x] E: # 276 との関係（依存関係 + 共通基盤）
- [x] F: 緊急度 + 工数 + デモ目標
- [x] G: 完了報告フォーマット
- [x] 緊急度 🟡 明示
- [x] 番号 = main- No. 277（counter 継続）
~~~

---

## 詳細（参考、投下対象外）

### 1. 投下後の流れ

1. a-bud-002 受領 → # 276 完了確認後、# 277 着手判断
2. # 276 + # 277 並列着手も可（subagent-driven）
3. alpha 版（仕訳閲覧 + 弥生 export ボタン）→ 東海林さん検証 → 本番運用

### 2. Forest → Bud 移管の方針

- 既存 Forest 側 CSV パーサー / 弥生 export ロジック = shared/_lib/ に移動
- Forest 側は import のみ（コード重複回避）
- 将来 Forest UI 廃止 / Bud 主軸化（東海林さん意図準拠）

### 3. 仕訳帳の業務的役割

- 決算作業の中核機能（月次 / 年次）
- 弥生会計連携で税理士連動
- 東海林さん業務軽減（手作業集計 → Garden 自動化）

### 4. # 276 完了との関係

- # 276 alpha = 5/12 デモ前必達
- # 277 alpha = 5/12 後でも OK（決算実利用は早期）
- 並列 or 順次 = a-bud-002 判断
