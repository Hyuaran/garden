# main- No. 64 dispatch - a-forest 4/30 残高を 1 年分 CSV から自動計算へ変更 - 2026-05-05

> 起草: a-main-012
> 用途: main- No. 63 投下後の追加方針更新、4/30 残高取得方法を「東海林さん手動 30 分」→「1 年分 CSV から自動計算」へ変更
> 番号: main- No. 64
> 起草時刻: 2026-05-05(火) 21:12
> 緊急度: 🟡 main- No. 63 補足、即時反映

---

## 投下用短文（東海林さんが a-forest にコピペ）

~~~
🟡 main- No. 64
【a-main-012 から a-forest への dispatch（4/30 残高を 1 年分 CSV から自動計算へ変更）】
発信日時: 2026-05-05(火) 21:12

main- No. 63 で「4/30 残高は東海林さん 5/6 中に各銀行 Web で確認」と依頼しましたが、東海林さん提案で **1 年分 CSV から自動計算** に変更します。

【背景: 東海林さん提案】

「各法人 4/30 残高 → 各銀行から 1 年間分のデータ取ってきてそこから判断したら？」

【メリット（一石二鳥）】

| 観点 | 内容 |
|---|---|
| 4/30 残高取得 | 1 年分 CSV の末尾行 残高列から自動取得（多くの銀行 CSV に「残高」列あり）|
| 仕訳帳 B-min データ | 1 年分の入出金が本番データソースに、検証範囲拡大 |
| 東海林さん作業 | 各銀行 Web で「1 年分 CSV ダウンロード」1 回で完結（手動 4/30 残高入力 不要）|

【変更後の東海林さん作業（5/6 中）】

| Step | 内容 |
|---|---|
| 1 | 楽天銀行 Web で 2025-04-30 〜 2026-04-30 の 1 年分 CSV ダウンロード（全口座、全法人）|
| 2 | みずほ銀行 Web で同様に 1 年分（Excel 形式 or CSV）ダウンロード |
| 3 | ダウンロード ファイルを `_chat_workspace\garden-forest-shiwakechou\bank-1year-202604\` に配置 |
| 4 | a-forest にチャット 1 通で「配置完了 + ファイル名 list」連絡 |

→ 計 1 時間程度（各銀行 30 分）。手動残高入力 30 分 → 1 年分 CSV ダウンロード 1 時間 で +30 分だが、**仕訳帳 B-min の本番データも同時に揃う**。

【a-forest 側の変更点】

# 1: 4/30 残高入力 UI（initial balance UI）

main- No. 63 で「balance-overview + initial balance UI（admin 限定、簡易フォーム）」を 0.6d 工数で見積もっていたが、initial balance UI は **不要 or 簡略化**:

- 1 年分 CSV を取り込み → bud_transactions に全件 insert
- bud_bank_accounts.opening_balance は **1 年分の最古日（2025-04-30 想定）の残高 = CSV 1 行目の残高 - 1 行目入出金**で計算
- balance-overview 画面で表示する 4/30 残高は **CSV 末尾行の残高列**を参照

→ initial balance UI 工数 0.15d → 0.05d（admin 確認用の簡易表示のみ）に圧縮

# 2: 1 年分 CSV を取り込むフロー

bud_transactions にすべて insert（B-min スコープ内）。重複検出は transaction_date + amount + flow + bank_account_id で UNIQUE 制約。

# 3: 残高計算ロジック

```typescript
// 各口座の 4/30 残高 = 1 年分 CSV の末尾行（最新日）の残高列値
// または、bud_bank_accounts.opening_balance + 累計（period 内 deposit - withdrawal）
const balance_4_30 = await db.query(`
  SELECT a.id, a.account_number, a.opening_balance,
    SUM(CASE WHEN t.flow = 'deposit' THEN t.amount ELSE -t.amount END) as net
  FROM bud_bank_accounts a
  LEFT JOIN bud_transactions t ON t.bank_account_id = a.id AND t.transaction_date <= '2026-04-30'
  GROUP BY a.id
`);
const final_balance = opening_balance + net;
```

または、CSV パーサーで最新日の残高列を直接抽出してキャッシュ。

【スケジュール影響（軽微）】

| 元見積 | 変更後 |
|---|---|
| Q4 並行実装 0.6d | 0.5d（initial balance UI 圧縮）|
| 東海林さん作業 30 分（4/30 残高手入力）| 1 時間（1 年分 CSV ダウンロード）|

→ 実働 +0 〜 -0.1d、トータル工数は微減。

【完了報告フォーマット】

forest-NN（既存報告に統合 OK）で:
- 1 年分 CSV 受領確認 + 取込結果（件数）
- 4/30 残高 自動計算結果（口座別 表）
- balance-overview 画面 動作確認

【dispatch counter】

a-main-012: 次 main- No. 65
a-forest: 既存 forest-NN 流れに統合

ご対応お願いします。
~~~

---

## 改訂履歴

- 2026-05-05 21:12 初版（a-main-012、東海林さん提案「1 年分 CSV」採用後）
