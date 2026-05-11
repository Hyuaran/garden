# dispatch main- No. 283 — a-forest-002 へ D-3 CSV パーサー shared lib 化（Forest → Bud 連携、PR #159/#160 後続）

> 起草: a-main-022
> 用途: a-bud-002 PR #159 (Bank) + PR #160 (Shiwakechou) alpha 完走、D-3 段階（CSV パーサー連動）で Forest 既実装（commit 105e322 / e73329e、TDD 21 件 / 1,026 tests pass）を Bud に import + shared lib 化指示
> 番号: main- No. 283
> 起草時刻: 2026-05-11(月) 17:40

---

## 投下用短文（東海林さんがコピー → a-forest-002 にペースト）

~~~
🟡 main- No. 283
【a-main-022 から a-forest-002 への dispatch（D-3 CSV パーサー shared lib 化、Forest 既実装 → Bud 連携）】
発信日時: 2026-05-11(月) 17:40

# 件名
a-bud-002 PR #159 (Bank) + PR #160 (Shiwakechou) alpha 完走、D-3 段階で **Forest 既実装 CSV パーサー（弥生 + 楽天 / みずほ / PayPay / 京都 4 系統、commit 105e322 / e73329e、TDD 21 件 / 1,026 tests pass）を shared lib 化 + Bud から import** 指示

# A. 背景

| 項目 | 内容 |
|---|---|
| a-bud-002 PR #159 (Bank) | alpha 完走（6 法人 × 4 銀行残高 ¥103,703,627、Vitest 18）|
| a-bud-002 PR #160 (Shiwakechou) | alpha 完走（10 仕訳 + 弥生 export skeleton、Vitest 10）|
| D-3 段階 | Bud で CSV 取込 → 残高 / 取引 / 仕訳 自動生成 + 弥生 export 必要 |
| Forest 既実装 | 弥生 CSV パーサー TDD 21 件 + 11 ファイル integration test 1,026 pass、commit 105e322 / e73329e |

→ Forest 既実装の Bud 移植が D-3 の中核、重複実装回避 + 既存 TDD 継続のため **shared lib 化**が最効率。

# B. 実装スコープ

## B-1. shared lib 化（src/shared/_lib/bank-csv-parsers/）

| ファイル | 内容 |
|---|---|
| `src/shared/_lib/bank-csv-parsers/rakuten-parser.ts` | 楽天 4 列 Shift-JIS CSV |
| `src/shared/_lib/bank-csv-parsers/mizuho-parser.ts` | みずほ .api（残高列なし、手入力残高連動）|
| `src/shared/_lib/bank-csv-parsers/paypay-parser.ts` | PayPay 12 列 |
| `src/shared/_lib/bank-csv-parsers/kyoto-parser.ts` | 京都銀行 13 列 |
| `src/shared/_lib/bank-csv-parsers/yayoi-csv-exporter.ts` | 弥生形式 export（Shift-JIS + CRLF + UTF-8 BOM）|
| `src/shared/_lib/bank-csv-parsers/__tests__/` | TDD 21 件継続 |

## B-2. Forest 側 → shared への移動

Forest 既存パス（推定）:
- `src/app/forest/_lib/yayoi-csv-parser.ts` 等

shared 移動方針:
- Forest コードを `src/shared/_lib/bank-csv-parsers/` に **move**
- Forest 側は `src/app/forest/_lib/` から shared を import で参照
- 既存 1,026 tests pass 維持

## B-3. Bud import 連動

a-bud-002 が PR #159/#160 後続で `src/shared/_lib/bank-csv-parsers/` から import:
- Bank: 取引履歴自動取込（CSV → bud_bank_transactions）
- Shiwakechou: 取引履歴 → 仕訳自動生成（bud_bank_transactions → bud_journal_entries）+ 弥生 export

# C. 着手判断

a-forest-002 自走可能か判断:

| 項目 | 状態 |
|---|---|
| Forest 既実装の所在把握 | a-forest-002 内 |
| TDD 21 件 + 1,026 tests pass | 維持必要 |
| shared library 化の工数 | 0.5-1d 想定（move + import path 更新 + tests 再実行）|
| a-bud-002 連動 | shared 完成後、a-bud-002 が import 利用 |

→ a-forest-002 自走可能、本 dispatch GO で着手。

# D. 1 週間 critical path 関連

| 目標 | 関連 |
|---|---|
| ① 仕訳帳（5/13 本番運用想定） | D-3 shared lib 完成必須 |
| ② 口座残高 UI（5/12 本番運用） | D-3 shared lib 完成必須 |

→ a-forest-002 が 5/12 朝までに shared lib 完成 → a-bud-002 が午後 D-3 import + 本番運用着手 = 5/13 ① 達成。

# E. 報告フォーマット（forest-002- No. 25 以降）

冒頭 3 行（🟡 forest-002- No. 25 / 元→宛先 / 発信日時）+ ~~~ ラップ + ネスト不使用 + コードブロック不使用 + PR URL + commit hash + tests pass 状況。

軽量 ACK で済む場合（受領 + 着手宣言）は `forest-002- No. 25-ack` 表記。

# F. 緊急度

🟡 中（D-3 shared lib 化、1 週間 critical path ①/② 共通基盤、5/12 朝完成目標）

# G. self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A: 背景（既実装 + D-3 段階）
- [x] B: shared lib 化 + Forest move + Bud import 連動
- [x] C: 着手判断（a-forest-002 自走可）
- [x] D: 1 週間 critical path 関連
- [x] E: 報告フォーマット
- [x] 緊急度 🟡 明示
- [x] 番号 = main- No. 283（counter 継続）
~~~

---

## 詳細（参考、投下対象外）

### 1. shared lib 化の意義

- Forest / Bud 両方から import 利用 = 重複実装 0
- TDD 21 件継続 = 品質保証
- 将来 Soil / Bloom 等で同様 CSV 処理が必要なら shared 利用可能

### 2. 投下後の流れ

1. a-forest-002 受領 → shared lib 化着手
2. 5/12 朝完成 → main 経由 a-bud-002 通知
3. a-bud-002 D-3 (Bank/Shiwakechou 共通基盤) 着手 → 本番運用 alpha → 5/13 ① 達成
