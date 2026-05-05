🟢 forest-7
【a-forest から a-main-012 への 受領確認(全 5 項目 GO + 弥生 CSV 取込 A 案採択 + 5/6 朝着手最終確認 / 回答 main- No. 68)】
発信日時: 2026-05-05(火) 22:35

a-main-012 様

main- No. 68 で頂いた **5 項目統合通知** をすべて受領しました。最後の判断保留事項（弥生 CSV 取込 A/B/C 案）を A 案で確定し、**5/6 朝着手の最終 GO** とします。

---

## 1. 受領内容（全 5 項目）

| # | 項目 | 状態 |
|---|---|---|
| 1 | Q4 振込手数料 独立取引格納（共通マスタで自動分類） | ✅ 採択受領 |
| 2 | 仕訳範囲 C 案（〜3/31 仕訳済 import / 4 月分のみ仕訳化）| ✅ 採択受領 |
| 3 | 仕訳済データ配置場所明示（各法人の 1_銀行/3_完成データを確認/）| ✅ 受領、Drive read 確認済 |
| 4 | センターライズ口座数 = 2 typo 訂正 | ✅ a-main-012 訂正受領 |
| 5 | counter 認識合わせ（forest-7 = 5/6 夜中間進捗 → ずれて 5/5 夜本 dispatch）| ✅ 共通理解 |

---

## 2. 🟢 弥生 CSV 取込：A 案 採択

a-main-012 推奨 + a-forest 検討の結果、**A 案を採択**：

### 2.1 採択理由

- 既存 Python（4_仕訳帳_弥生出力_v11.py / 5_仕訳帳_弥生変換_v7.py）の品質を引き継げる
- 過去 1 年の取引明細が `debit/credit/tax_class` 込みで bud_transactions に揃う
- 後道さん向け balance-overview の月次推移が豊富になる（B-min Phase 1 として "現状の Python 出力相当" を Web で再現）
- 5/12-16 税理士作業中の Python 並走で、Web 版の品質を「実出力一致」で検証可能

### 2.2 工数影響

| 項目 | 元（C 案）| A 案 |
|---|---|---|
| 弥生 CSV パーサー（src/lib/shiwakechou/parsers/yayoi-import.ts）| - | +0.3d |
| import script（〜3/31 仕訳済 を bud_transactions に status='ok' で投入）| - | +0.1d |
| **追加合計** | - | **+0.4d** |

a-forest トータル工数: 3.2d → **約 3.6d**

### 2.3 タイミング調整（5/6-5/9 で吸収）

- **5/6 朝-夕**: 楽天 5 法人パーサー + migration + 共通マスタ取込 + balance-overview MVP（楽天 5 口座、4 月分のみ）→ 1.5d
- **5/7 朝-夕**: みずほ + PayPay + 京都 パーサー + 4 月分 仕訳化（B-min 本来のスコープ）→ 1.0d
- **5/7 夜**: 弥生 CSV パーサー実装（A 案上乗せ） → 0.3d
- **5/8 朝-昼**: 弥生 CSV import 実行（過去 1 年、6 法人 × ~12 ファイル）+ balance-overview 12 口座完成 → 0.4d
- **5/8 夜**: 統合テスト + Python fixture 突合（弥生 出力同値検証）→ 0.4d
- **5/9 朝**: 東海林さん本番リハ + 完走報告 → -

→ 4 日完走射程内、A 案上乗せ吸収可能。

### 2.4 弥生 CSV パーサーの実装スケッチ

```typescript
// src/lib/shiwakechou/parsers/yayoi-import.ts
// 弥生インポート CSV → bud_transactions の (debit_account, credit_account, tax_class, ...) 復元

// 弥生 CSV の典型カラム（既存 Python 5_仕訳帳_弥生変換_v7.py から確認予定、5/7 夜時に詳細確定）
type YayoiImportRow = {
  伝票No: string;
  決算: string;            // 通常 ""
  取引日付: string;         // YYYY/M/D
  借方勘定科目: string;     // bud_transactions.debit_account
  借方補助科目: string;
  借方部門: string;
  借方税区分: string;
  借方金額: number;
  借方税金額: number;
  貸方勘定科目: string;     // bud_transactions.credit_account
  貸方補助科目: string;
  貸方部門: string;
  貸方税区分: string;
  貸方金額: number;
  貸方税金額: number;
  摘要: string;             // bud_transactions.description との突合に使用
  // ...（既存 Python 出力カラムから完全反映、5/7 夜に最終確定）
};

// 銀行 CSV と弥生 CSV の突合キー
// transaction_date + amount + flow + description（先頭 N 文字 or 正規化文字列）
```

実装方針：
- 5/7 夜に既存 Python 出力 CSV を実 read してカラム順を完全再現
- 銀行 CSV → bud_transactions 投入後、弥生 CSV パーサーで debit/credit/tax_class を **UPDATE**（INSERT ではなく）
- 突合キー: (corp_id, transaction_date, amount, description 先頭文字列ハッシュ等)
- 突合不一致は status='pending' に降格（手動確認対象）

---

## 3. 取込 status 設計（仕訳範囲 C 案 反映）

| 期間 | bud_transactions 格納 | status | 仕訳化 |
|---|---|---|---|
| 2024/6 〜 2025/3/31（古い 9 ヶ月）| ⏸ B-min 対象外（post-デモ判断） | - | - |
| **2025/4/1 〜 2026/3/31**（〜過去 1 年）| ✅ insert | **'ok'**（弥生 import 後）| 弥生 CSV 由来 |
| **2026/4/1 〜 2026/4/30**（4 月分）| ✅ insert | **'pending'** | B-min 仕訳化対象 ⭐ |

### 補足: 4 月分の境界
- 楽天/みずほ/PayPay/京都 CSV の `transaction_date >= '2026-04-01'` の行は status='pending'
- 同 `transaction_date < '2026-04-01' AND >= '2025-04-01'` は status='ok'（弥生 CSV import 後の上書き）
- migration の bud_transactions に `status` 列のデフォルト = 'pending'、import script で 〜3/31 行のみ 'ok' に変更

### 振込手数料の例外
振込手数料行（楽天個別行 例: `振込手数料（内消費税 ￥20）`）は：
- 〜3/31: 弥生 CSV にも個別行あり（既存 Python が分離出力）→ 'ok' で取込
- 4/1〜: 共通マスタ「振込手数料」パターンで自動分類 → 借方=支払手数料 / 貸方=普通預金 / 税区分=対象外、status='ok'（自動判定成功時）or 'pending'（不一致時）

---

## 4. 5/6 朝の最初の 1 時間 アクションプラン

東海林さんから受領待ち：
- ハイブリッド戦略採択回答（forest-4 §7.1）
- 楽天 4/30 残高 5 法人分 突合（既配置済 5 CSV 末尾行で確認）
- みずほ 4/30 残高 4 値（メンテ復旧後）

これら受領前でも実行可能なタスク（**5/6 朝の先行着手分**）：

| 時間 | タスク |
|---|---|
| 9:00-9:30 | spec/forest-shiwakechou-design ブランチを develop に PR 起票 → a-bloom レビュー（軽微 docs PR） |
| 9:00-9:30 | 並行: feature/forest-shiwakechou-phase1-min-202605 ブランチ作成（develop 派生） |
| 9:30-10:30 | bud_* 6 テーブル + UNIQUE 制約 migration 起草（TDD でテーブル作成テスト） |
| 10:30-11:30 | 共通マスタ Excel 取込 script（Python の 1_共通マスタ_v12.xlsx を Read → bud_master_rules INSERT） |
| 11:30-12:30 | 楽天 CSV パーサー（rakuten.ts）実装 + ヒュアラン CSV で動作テスト |

→ 12:30 までで楽天パーサー + migration + 共通マスタ取込 完成想定。
午後は 5 法人 import + balance-overview MVP に着手。

---

## 5. 仕訳済データ配置 confirmation

main- No. 68 §3 で示された Drive 配置を pre-check：

```
G:\...\001_仕訳帳\01_株式会社ヒュアラン\1_銀行\3_完成データを確認\
  ├── 20260408_処理済み/
  │   └── 弥生インポート_BK_01_株式会社ヒュアラン_20260408.csv
  └── 20260409_処理済み/
      ├── 弥生インポート_BK_01_株式会社ヒュアラン_20260409.csv
      └── 弥生インポート_MF_01_株式会社ヒュアラン_20260409.csv
（同様に 02_〜06_ 法人配下も）
```

→ **5/7 夜の弥生 CSV パーサー実装時に詳細確認**、現時点では存在のみ確認で着手判断には十分。

---

## 6. 関連 dispatch / docs

- main- No. 68: Q4 採択 + 仕訳範囲 C 案 + 仕訳済データ配置 + typo 訂正受領（本回答対象）
- main- No. 67: ハイブリッド戦略採択 + 12 口座マッピング
- main- No. 66: 楽天 5 法人 CSV 配置完了 + フォーマット訂正
- main- No. 64: 4/30 残高 1 年分 CSV 戦略
- main- No. 63: B-min + Q4 着手 GO + Bud 移行方針
- forest-2 〜 forest-6: 過去 dispatch 履歴（forest-6 §3 で表化）
- 本 forest-7: 全 5 項目 GO 受領 + 弥生 A 案採択 + 5/6 朝最終 GO

---

## 7. dispatch counter

a-main-012: 次 main- No. 69（みずほ + PayPay + 京都 配置完了通知）
a-forest: forest-7 を本 dispatch で使用、次 forest-8（5/6 夜中間進捗報告）

`docs/dispatch-counter.txt` 現在値 = **8**

### 後続 forest-NN 計画（更新版）

| dispatch | 想定タイミング | 内容 |
|---|---|---|
| forest-8 | 5/6 夜 | 楽天 5 法人パーサー + migration + 共通マスタ取込 + balance-overview MVP 中間進捗 |
| forest-9 | 5/7 夜 | みずほ + PayPay + 京都 パーサー + 4 月分仕訳化 + 弥生 CSV パーサー実装 |
| forest-10 | 5/8 夜 | 弥生 CSV import（過去 1 年）+ 統合テスト + Python fixture 突合 |
| forest-11 | 5/9 朝 | B-min + Q4 完走報告（東海林さん本番リハ後） |

---

## 8. 質問・確認事項

なし。**5/6 朝の楽天分先行着手準備完了**、確認事項なしで実装開始します。

工数（本 dispatch 作成）: 約 0.02d（5 項目受領確認 + 弥生 A 案採択 + 朝の最初 1 時間アクションプラン）

a-forest
