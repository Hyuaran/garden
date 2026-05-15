# Handoff - Forest (a-forest) - 2026-05-05 22:35（コンテキスト 81% 警戒ライン）

## 担当セッション
a-forest（GW 仕訳帳機能 B-min 着手準備セッション、5/6 朝着手予定）

## 引き継ぎ理由
コンテキスト使用率 81% 到達 → CLAUDE.md §使用率アラートルール 80% 警戒ライン → 5/6 朝の実装着手前に切替推奨

## 今やっていること
仕訳帳機能 B-min + Q4 後道さん向け balance-overview の **5/6 朝着手準備**。本セッションでは forest-1〜forest-7 dispatch を発信し、すべての判断保留事項を解消、明日朝の最初の 1 時間アクションプランまで確定済。**実装は完全未着手**（明日 5/6 朝開始予定）。

---

## 確定事項サマリ（5/6 朝の実装で必ず守ること）

### 1. スコープ：B-min + Q4
- **B-min（仕訳帳）**: 楽天先行 → みずほ + PayPay + 京都 後追い、共通マスタ参照のみ自動判定、確認画面 + 弥生エクスポート
- **Q4（balance-overview）**: 全法人 × 口座マトリクス、後道さん向け前日残高画面（'executive' ロール β 案）
- 工数: **約 3.6d**（B-min 2.6d + Q4 0.6d + 弥生 CSV 取込 +0.4d）

### 2. 銀行 × 法人 12 口座マッピング（3_口座設定.py BANK_ACCOUNTS と完全一致）

| 法人 | みずほ | PayPay | 楽天 | 京都 | 計 |
|---|---|---|---|---|---|
| ヒュアラン | 1252992 | 2397629 | 7853952 | 0029830 | 4 |
| センターライズ | 3024334 | 1266637 | — | — | **2**（main- No. 67 typo 訂正済） |
| リンクサポート | 3036669 | — | 7281769 | — | 2 |
| ARATA | 3026280 | — | 7289997 | — | 2 |
| たいよう | — | — | 7291657 | — | 1 |
| 壱 | — | — | 7659425 | — | 1 |
| **計** | 4 | 2 | 5 | 1 | **12** |

### 3. 4/30 残高戦略：ハイブリッド
- 自動取得（**8 口座** 楽天/PayPay/京都）: CSV 末尾行「残高(円)」/「残高」列から
- 手入力（**4 口座** みずほ）: 東海林さん Web で確認 → チャット 1 通（メンテ復旧後）

### 4. 期初残高 opening_balance
- 自動 8 口座: CSV 1 行目残高 - 1 行目入出金額 で逆算
- みずほ 4 口座: 4/30 手入力残高 - 1 年分入出金累計 で逆算

### 5. 仕訳範囲（C 案）
- 2024/6 〜 2025/3/31（古い 9 ヶ月）: B-min 対象外
- 2025/4/1 〜 2026/3/31: status='ok'（弥生 CSV import 後）
- 2026/4/1 〜 2026/4/30: status='pending'（B-min 仕訳化対象 ⭐）
- migration の bud_transactions.status デフォルト = 'pending'、import script で 〜3/31 行のみ 'ok' に変更

### 6. 弥生 CSV 取込（A 案）
- src/lib/shiwakechou/parsers/yayoi-import.ts に YayoiImportRow パーサー
- 銀行 CSV → bud_transactions 投入後、弥生 CSV パーサーで debit/credit/tax_class を **UPDATE**（INSERT ではなく）
- 突合キー: (corp_id, transaction_date, amount, description 先頭文字列ハッシュ等)
- 突合不一致は status='pending' に降格

### 7. 振込手数料
- 独立取引行として bud_transactions に格納（楽天は個別行で出力）
- 共通マスタ「振込手数料」パターンで自動分類: 借方=支払手数料 / 貸方=普通預金 / 税区分=対象外

### 8. 楽天 CSV フォーマット（実 CSV ヘッダー）
```
取引日,入出金(円),残高(円),入出金先内容
```
※ main- No. 66 提示の `入出金額(円)` / `取引内容` は誤り、実 CSV は上記。Shift-JIS / CRLF / ヘッダー 1 行 + データ。

### 9. Bud 移行方針
- 5/6-5/9: Forest 配下（src/app/forest/shiwakechou/）で実装
- 5/17 以降: Bud 配下にコピー、forest_users → bud_users 切替
- 引き継ぎ資料: 各 commit に Bud 移行手順記載 + 完走時に `docs/forest-shiwakechou-bud-migration-handoff.md` 起草

### 10. ブランチ計画
- spec ブランチ `spec/forest-shiwakechou-design`（cc35e14）を**先に develop merge**（5/6 朝 PR 起票、a-bloom レビュー）
- 実装ブランチ `feature/forest-shiwakechou-phase1-min-202605`（develop 派生）

---

## 5/6 朝の最初の 1 時間 アクションプラン

東海林さん受領待ち項目（並行）:
- ハイブリッド戦略採択回答（forest-4 §7.1 で問い合わせ済）
- 楽天 4/30 残高 5 法人分 突合（既配置済 5 CSV 末尾行で確認）
- みずほ 4/30 残高 4 値（メンテ復旧後）

先行可能タスク（**5/6 朝の最初の 1 時間**）:

| 時間 | タスク |
|---|---|
| 9:00-9:30 | spec/forest-shiwakechou-design ブランチを develop に PR 起票 → a-bloom レビュー |
| 9:00-9:30 | 並行: feature/forest-shiwakechou-phase1-min-202605 ブランチ作成（develop 派生） |
| 9:30-10:30 | bud_* 6 テーブル + UNIQUE 制約 migration 起草（TDD） |
| 10:30-11:30 | 共通マスタ Excel 取込 script（1_共通マスタ_v12.xlsx → bud_master_rules INSERT） |
| 11:30-12:30 | 楽天 CSV パーサー（rakuten.ts）実装 + ヒュアラン CSV で動作テスト |

→ 12:30 までで楽天パーサー + migration + 共通マスタ取込 完成想定。

---

## 重要な参照リソース

### Drive 上の既存ファイル
- spec: `docs/superpowers/specs/2026-04-26-shiwakechou-bud-migration-design.md`（449 行、必読）
- Python 全コード: `G:\...\001_仕訳帳\*.py`
  - 4_仕訳帳_弥生出力_v11.py（楽天/みずほ/PayPay/京都 パーサー）
  - 5_仕訳帳_弥生変換_v7.py（弥生 CSV 変換）
- マスタ Excel:
  - `1_共通マスタ_v12.xlsx`（bud_master_rules 投入元）
  - `2_法人間取引マスタ_v5.xlsx`（Phase 2 用、B-min では使わない）
- 口座マスタ: `3_口座設定.py` BANK_ACCOUNTS 定数
- 仕訳済 CSV: 各法人の `1_銀行/3_完成データを確認/YYYYMMDD_処理済み/弥生インポート_BK_*.csv`
- 楽天 5 法人 CSV: `G:\...\_chat_workspace\garden-forest-shiwakechou\bank-2year-202406-202604\`

### Drive アクセス検証済（forest-3 / forest-5）
- ✅ Read tool でアクセス可（PowerShell 経由で SJIS デコードも可）
- ✅ 楽天 5 法人 CSV 配置確認（ヒュアラン 1,667 取引、末尾残高 22,079,884 円）

---

## dispatch 履歴と counter

### 既発信 dispatch（forest-1〜7）

| dispatch | 内容 | timestamp | branch | commit |
|---|---|---|---|---|
| forest-1 | dispatch ヘッダー形式 v3 採択 受領確認 | 5/1 23:55 | chore/forest-dispatch-header-v3-202605 | 5995235 |
| forest-2 | 仕訳帳 現状確認 + B-min 提案 | 5/5 21:30 | chore/forest-dispatch-2-shiwakechou-status-202605 | 5d7462b |
| forest-3 | B-min + Q4 GO 受領 + Drive pre-check | 5/5 21:45 | chore/forest-dispatch-3-receive-go-202605 | 16a25f9 |
| forest-4 | 1 年分 CSV 戦略 + みずほ残高欠落発見 | 5/5 21:55 | chore/forest-dispatch-4-1year-csv-receive-202605 | 52fa7d6 |
| forest-5 | 楽天 CSV 配置確認 + ヘッダー微訂正 | 5/5 22:10 | chore/forest-dispatch-5-rakuten-csv-format-receive-202605 | 56f3bf6 |
| forest-6 | ハイブリッド GO 受領 + typo 指摘 + counter 訂正 | 5/5 22:25 | chore/forest-dispatch-6-hybrid-go-receive-202605 | 85e614c |
| forest-7 | 全 5 項目 GO 受領 + 弥生 A 案採択 + 5/6 朝最終 GO | 5/5 22:35 | chore/forest-dispatch-7-final-go-and-yayoi-a-receive-202605 | 685bbfd |

### dispatch counter
- `docs/dispatch-counter.txt` = **8**
- 次は **forest-8**（5/6 夜中間進捗）想定

### 後続 forest-NN 計画

| dispatch | 想定タイミング | 内容 |
|---|---|---|
| forest-8 | 5/6 夜 | 楽天 5 法人パーサー + migration + 共通マスタ取込 + balance-overview MVP |
| forest-9 | 5/7 夜 | みずほ + PayPay + 京都 + 4 月仕訳化 + 弥生 CSV パーサー |
| forest-10 | 5/8 夜 | 弥生 import + 統合テスト + Python 突合 |
| forest-11 | 5/9 朝 | B-min + Q4 完走報告 |

---

## ローカル先行 commit 状況（push 未実施）

| ブランチ | 内容 | push 状態 |
|---|---|---|
| chore/forest-dispatch-header-v3-202605 | forest-1 | 🟡 未 push（旧 GitHub suspended の名残） |
| chore/forest-dispatch-2-shiwakechou-status-202605 | forest-2 | 🟡 未 push |
| chore/forest-dispatch-3-receive-go-202605 | forest-3 | 🟡 未 push |
| chore/forest-dispatch-4-1year-csv-receive-202605 | forest-4 | 🟡 未 push |
| chore/forest-dispatch-5-rakuten-csv-format-receive-202605 | forest-5 | 🟡 未 push |
| chore/forest-dispatch-6-hybrid-go-receive-202605 | forest-6 | 🟡 未 push |
| chore/forest-dispatch-7-final-go-and-yayoi-a-receive-202605 | forest-7 | 🟡 未 push |

→ 次セッション起動時、必要に応じて a-main-012 と相談して push 判断（dispatch ブランチは a-forest 内部参照のため push 不要との判断もあり）。

### 過去の未 push branch（GitHub suspended 期間中）
- feature/forest-t-f5-tax-files-viewer（typo 修正含む 4 commits）
- docs/forest-phase-b-app85-archive-note（2 commits）
- 詳細は過去 handoff (handoff-forest-202604261030.md, handoff-forest-202604261100.md) 参照

---

## 待機事項（5/6 朝までに東海林さんから受領必要）

| # | 項目 | 状態 |
|---|---|---|
| 1 | ハイブリッド戦略採択（forest-4 §7.1 問い合わせ）| 🟡 回答待ち |
| 2 | 楽天 4/30 残高 5 法人分 突合確認（CSV 末尾行と一致しているか）| 🟡 確認待ち |
| 3 | みずほ 4/30 残高 4 値（メンテ復旧後）| 🟡 復旧待ち、明日 or 夜間明け想定 |
| 4 | センターライズ B-min 対応（みずほ復旧後カバー で OK か）| 🟡 forest-5 で問い合わせ済 |
| 5 | 振込手数料 独立取引化（採択済、確認のみ）| ✅ main- No. 68 で採択済 |

---

## 次セッション（a-forest-002 想定）の最初のアクション

1. `git fetch --all` でリモート最新化
2. `git checkout chore/forest-dispatch-7-final-go-and-yayoi-a-receive-202605` または最新 dispatch ブランチ
3. `cat docs/dispatch-counter.txt` で次 forest 番号確認（**8**）
4. 本ハンドオフを read（5/6 朝の最初の 1 時間アクションプラン §「5/6 朝の最初の 1 時間 アクションプラン」参照）
5. 東海林さんからの待機事項受領確認:
   - チャット履歴で a-main-012 経由の最新通知を確認
   - 楽天/PayPay/京都 4/30 残高 + みずほ 4/30 残高 4 値 の受領状況
6. 受領済なら `feature/forest-shiwakechou-phase1-min-202605` 新規作成 → 着手
7. 受領未済の項目があれば forest-8 dispatch で進捗報告（着手分のみで進める）

---

## 切替シナリオ（85% 到達前）

### 推奨：本セッション終了 + 次セッション切替

```powershell
# 別の PowerShell で
cd C:\garden\a-forest
git fetch --all
# 続きの作業を行う場合
git checkout chore/forest-dispatch-7-final-go-and-yayoi-a-receive-202605
# Claude Code 起動後
# 「docs/handoff-forest-202605052235.md を読んで続きを進めて」と依頼
```

### dispatch counter 引き継ぎ

新セッション起動時、`docs/dispatch-counter.txt` は既に **8** が書き込み済（本セッション最終状態）。次 dispatch は forest-8。

---

## 実績工数（本セッション）

| dispatch / 作業 | 工数 |
|---|---|
| forest-1 ヘッダー形式 v3 採択 | 0.02d |
| forest-2 仕訳帳 spec 全文 read + B-min 提案 | 0.08d |
| forest-3 GO 受領 + Drive pre-check | 0.03d |
| forest-4 1 年分 CSV 戦略 + みずほ残高列欠落発見 | 0.03d |
| forest-5 楽天 CSV 配置確認 + フォーマット pre-check | 0.04d |
| forest-6 ハイブリッド GO 受領 + typo 指摘 | 0.02d |
| forest-7 全 5 項目 GO 受領 + 弥生 A 案採択 | 0.02d |
| handoff 書出（本ファイル） | 0.03d |
| **計** | **約 0.27d**（約 2 時間） |

---

## 関連ドキュメント

- forest-2 〜 forest-7 dispatch ファイル（docs/dispatch-forest-N-*.md）
- spec: docs/superpowers/specs/2026-04-26-shiwakechou-bud-migration-design.md
- 過去 handoff: handoff-forest-202604261030.md, handoff-forest-202604261100.md
- 親 CLAUDE.md §使用率アラートルール（80% 警戒ライン対応の指針）

---

**a-forest セッション、待機状態に入ります。次セッション（明日朝 or 切替後）でB-min 実装着手します。**
