# dispatch main- No. 276 — a-bud-002 へ 03_Bank UI Next.js 化急務 + 口座残高表示 + 後道さん通知（東海林さん手作業削減、案 A 採択）

> 起草: a-main-022
> 用途: 既存 Bud UI v2 03_Bank mock (6064 行) を Next.js 化 + Supabase テーブル設計 + CSV パーサー連動 + 手入力残高 UI + 後道さん通知。MF API エラー対応のための急務 Garden 化、東海林さん手作業（5/11 11:48 ¥103,703,627 集計）の削減。
> 番号: main- No. 276
> 起草時刻: 2026-05-11(月) 16:25

---

## 投下用短文（東海林さんがコピー → a-bud-002 にペースト）

~~~
🔴 main- No. 276
【a-main-022 から a-bud-002 への dispatch（03_Bank UI Next.js 化急務 + MF API エラー対応 + 後道さん通知、案 A 採択）】
発信日時: 2026-05-11(月) 16:25

# 件名
🔴 急務 Garden 化: 既存 Bud UI v2 03_Bank mock (6064 行) を Next.js 化 + Supabase テーブル設計 + CSV パーサー連動 (Forest 既実装 import) + 手入力残高 UI + 後道さん Chatwork 通知。東海林さん手作業（5/11 11:48 例: 6 法人 ¥103,703,627）の削減、5/12 後道さんデモ前 critical path

# A. 背景（東海林さん発言、5/11 16:20）

| 状況 | 内容 |
|---|---|
| MF API エラー | https://biz.moneyforward.com/support/news/20260501-2.html 発生 |
| 東海林さん手作業 | 各銀行サイト目視 → Excel 集計 → 後道さん報告（業務追加）|
| 5/11 11:48 例 | 6 法人 × 4 銀行（みずほ / 楽天 / PayPay / 京都）= ¥103,703,627 |
| 仕訳帳所属 | 元 Forest 配置 → 本来 Bud（経理スコープ）|
| 既存進捗 | Bud UI v2 mock 10 画面（5/7 整理移送）+ Forest 側 CSV パーサー TDD 21 件完成（5/8 commit `105e322` / `e73329e`、1,026 tests pass）|

→ Bud で UI 既に進行中、最速 Garden 化が東海林さん意図。

# B. 既存 mock 確認

| ファイル | 行数 | 内容 |
|---|---|---|
| 015_Gardenシリーズ/000_GardenUI_bud/03_Bank/index.html | **6064 行** | 6 法人切替 + 4 サマリカード + 銀行口座一覧 + 残高表示 mock |
| _chat_workspace/garden-bud/ui_drafts/chat-ui-bud-bank-fullscreen-v2-20260507.html | 同等 | v2 ソース |

→ 既存 mock 大規模、Next.js 化のベースとして十分。

# C. 案 A 採択（東海林さん、5/11 16:20）

| 案 | 内容 | 採択 |
|---|---|---|
| 🟢 A | a-bud-002 で 03_Bank Next.js 化（既存 mock 延長、最速、Forest CSV パーサー import） | ✅ 採択 |
| 🟡 B | 新規実装（時間かかる） | 不採択 |

→ a-bud-002 既存実装基盤での Next.js 化に集中。

# D. 実装スコープ（5 タスク）

## D-1. Next.js 化（src/app/bud/bank/）

| 項目 | 内容 |
|---|---|
| ファイル | src/app/bud/bank/page.tsx + _components/ + _lib/ |
| ベース | 015_Gardenシリーズ/000_GardenUI_bud/03_Bank/index.html (6064 行) を React component 分解 |
| Bloom precedent | 06_CEOStatus / 03_Workboard の page.tsx パターン踏襲 |
| 必須要素 | topbar / sidebar-dual / activity-panel / activity-toggle / page-favorite-btn / gf-summary-card 共通踏襲（Bloom 真祖先準拠）|

## D-2. Supabase テーブル設計

| テーブル | 用途 | 列 |
|---|---|---|
| bud_bank_accounts | 法人 × 銀行 × 口座 マスタ | bank_id (PK), corp_id (FK fruit_companies?), bank_name, account_type, account_number, branch_name, is_active, deleted_at, created_at, updated_at |
| bud_bank_balances | 残高履歴（時系列） | balance_id (PK), bank_id (FK), balance_date, balance_amount, source ('csv_auto' / 'manual_input'), input_user_id, created_at |
| bud_bank_transactions | 取引履歴（CSV 取込分） | transaction_id (PK), bank_id (FK), transaction_date, amount, description, balance_after, source_csv_path, raw_row jsonb, created_at |

RLS: 全員 SELECT、書込は payroll_auditor 以上、論理削除のみ（DELETE 完全禁止）。

## D-3. CSV パーサー連動（Forest 既実装 import）

| 既存実装 | 移管方針 |
|---|---|
| Forest 側 `forest/_lib/yayoi-csv-parser.ts`（推定パス、commit `105e322`）| Bud に import or shared library 化（`shared/_lib/bank-csv-parsers/`）|
| 楽天 / みずほ / PayPay / 京都 4 系統パーサー | 同上 |
| 弥生インポート CSV パーサー TDD 21 件 | 維持、Bud で再利用 |

実装方針: 既存 Forest コードを **Bud に import** = 重複実装回避、TDD 21 件継続利用。Forest 側コードは「将来 Bud 移管」コメント追記。

## D-4. 手入力残高 UI（みずほ + PayPay ヒュアラン）

| 対象口座 | 理由 |
|---|---|
| みずほ 4 法人（ARATA / センターライズ / ヒュアラン / リンクサポート）| みずほ .api には残高列なし、通帳ベース手入力 |
| PayPay ヒュアラン | システム障害で CSV 出力不可、残高のみ手入力 |

UI:
- 入力フォーム（東海林さん入力、admin 以上のみ）
- 通帳記帳ベース明示
- 入力履歴（input_user_id + timestamp）
- 「最終更新 N 日前」表示

## D-5. 後道さん通知（Chatwork）

| 項目 | 内容 |
|---|---|
| 経路 | Chatwork Bot（「【事務局】システム自動通知」）API |
| トリガー | 残高更新ボタン押下 or 日次 cron（朝 9 時） |
| 通知内容 | 「[Garden Forest] 5/11 11:48 時点 6 法人合計残高: ¥103,703,627」+ 法人別内訳テーブル |
| 受信者 | 後道さん（既存 Chatwork アカウント連携） |

# E. 参考リンク / 関連 dispatch

- MF API エラー: https://biz.moneyforward.com/support/news/20260501-2.html （東海林さん共有、私は WebFetch せず）
- 過去 dispatch # 76 (5/7): Forest 側 12 口座 CSV 配置完了 + ハイブリッド戦略確定
- 5/11 11:48 残高例（東海林さん手作業集計、画像共有）:

| 法人 | 合計 | みずほ | 楽天 | PayPay | 京都 |
|---|---|---|---|---|---|
| ヒュアラン | 45,604,598 | 17,628,380 | 21,705,543 | 158,063 | 6,112,612 |
| センターライズ | 9,474,260 | 9,037,780 | - | 436,480 | - |
| リンクサポート | 13,544,954 | 1,226,652 | 12,318,302 | - | - |
| ARATA | 20,129,784 | 18,334,348 | 1,795,436 | - | - |
| たいよう | 14,116,044 | - | 14,116,044 | - | - |
| 壱 | 833,987 | - | 833,987 | - | - |
| **総合計** | **103,703,627** | | | | |

# F. 並行依頼（# 277 = 07_Shiwakechou Next.js 化）

仕訳帳（07_Shiwakechou、3224 行）も並行起票（main- No. 277）、Forest 既存 CSV パーサー共通基盤上で両機能を a-bud-002 一元実装。

# G. 緊急度 / スコープ判断

| 観点 | 内容 |
|---|---|
| 緊急度 | 🔴 高（東海林さん手作業削減、5/12 デモ前 critical path）|
| 想定工数 | 03_Bank Next.js 化 + Supabase 設計 + CSV 連動 + 手入力 UI + Chatwork 通知 = **3-4d** 推定（subagent-driven 並列で 1.5-2d 圧縮可）|
| 着手判断 | a-bud-002 余力大（Phase D 100% 完走、Phase E spec 起草済 PR #149 merge 待ち）= 即着手可 |
| 後道さんデモ前完了目標 | 🔴 5/12 までに alpha 版（残高表示のみ動作）達成 = 仕訳帳は alpha 後 |

# H. 報告フォーマット（bud-002- No. 41 以降）

冒頭 3 行（🔴 bud-002- No. 41 / 元→宛先 / 発信日時）+ ~~~ ラップ + ネスト不使用 + コードブロック不使用 + 段階完走報告（D-1 Next.js 化完了 / D-2 migration 起票 / D-3 CSV パーサー import / D-4 手入力 UI / D-5 Chatwork 通知）。

軽量 ACK で済む場合（受領 + 着手宣言）は bud-002- No. 41-ack 表記。

# 緊急度

🔴 高（東海林さん業務追加発生中、後道さんデモ前 critical path、Garden 化最優先）

# I. self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A: 背景（MF API + 手作業 + 5/11 11:48 例）
- [x] B: 既存 mock 確認（6064 行）
- [x] C: 案 A 採択明示
- [x] D: 実装スコープ 5 タスク詳細
- [x] E: 参考リンク + 残高表
- [x] F: 並行 # 277 通知
- [x] G: 緊急度 + 工数 + デモ目標
- [x] H: 完了報告フォーマット
- [x] 緊急度 🔴 明示
- [x] 番号 = main- No. 276（counter 継続）
~~~

---

## 詳細（参考、投下対象外）

### 1. 投下後の流れ

1. a-bud-002 受領 → 5 タスク並列着手判断（subagent-driven 推奨）
2. D-1 Next.js 化 → D-3 CSV パーサー import → D-2 Supabase 設計 → D-4 手入力 UI → D-5 Chatwork 通知
3. alpha 版（残高表示のみ）→ 東海林さんレビュー → 後道さんデモ
4. 仕訳帳（# 277）は alpha 後に並行進行

### 2. 既存 mock の活用方針

- HTML/CSS は React component に分解
- Chart.js / sparkline は recharts or chart.js (React wrapper) で再実装
- 6 法人切替 + 4 サマリカード + 銀行一覧の構造維持

### 3. CSV パーサー shared 化（Forest → Bud）

```
src/shared/_lib/bank-csv-parsers/
  rakuten-parser.ts        ← 楽天 4 列 Shift-JIS
  mizuho-parser.ts         ← みずほ .api（残高列なし）
  paypay-parser.ts         ← PayPay 12 列
  kyoto-parser.ts          ← 京都銀行 13 列
  yayoi-csv-exporter.ts    ← 弥生形式 export
  __tests__/               ← TDD 21 件継続
```

Forest 既存コード（`forest/_lib/yayoi-csv-parser.ts` 等）を `shared/_lib/` に移動 + Forest / Bud 両方から import。
