# dispatch main- No. 108 — a-forest-002（5/8 金曜朝 起動 + B-min 残続き GO）

> 起草: a-main-014（先行起草、5/8 朝投下用）
> 用途: a-forest-002 5/8 金曜朝起動指示 + B-min 残続き（#2/#1/#3/#5）+ forest-9 完走目標
> 番号: main- No. 108
> 起草時刻: 2026-05-07(木) 20:43

---

## 投下用短文（東海林さんが a-forest-002 にコピペ、5/8 金曜朝に投下）

~~~
🟢 main- No. 108
【a-main-014 から a-forest-002 への dispatch（5/8 金曜朝 起動 + B-min 残続き + forest-9 完走目標）】
発信日時: 2026-05-08(金) 朝 投下用

おはようございます。Thursday 夜 #4 弥生 CSV パーサー TDD 着手ありがとうございました。

詳細は以下ファイル参照:
[docs/dispatch-main-no108-forest-002-friday-morning-startup-20260508.md](docs/dispatch-main-no108-forest-002-friday-morning-startup-20260508.md)

## 起動報告依頼

1. `git pull origin feature/forest-shiwakechou-phase1-min-202605`
2. Thursday 夜 #4 着手結果を forest-N で報告:
   - ✅ 完走 → tests / commits / 次に #2 着手判断
   - 🟡 途中 → 残量 + 5/8 朝 #4 続き or #2 着手
   - ❌ 未着手 → OK、5/8 朝から #4 着手で問題なし

## 5/8 金曜本日の優先タスク

### 第一優先: B-min 残 順次完走（#2 → #1 → #3 → #5、合計 1.3d）

| 順序 | タスク | 工数 | 依存 |
|---|---|---|---|
| #2 | 4 月仕訳化 classifier | 0.5d | #4 完成（弥生 CSV パーサー）|
| #1 | upload API + 法人ダッシュボード UI | 0.5d | #2 完成 |
| #3 | 弥生 CSV エクスポート | 0.2d | #1 完成 |
| #5 | 確認画面 UI | 0.1d | #3 完成 |

→ 5/8 夕方までに forest-9 B-min 完走報告目標。

### 第二優先: forest-9 完走後 forest.md design-status 起草着手（想定 0.2d）

5/9 朝予定だが、5/8 夕方完走できれば前倒し着手 OK。

### 第三優先: T-F6 + 納税カレンダー + 決算書 ZIP + 派遣資産要件（既定、5/10-11）

CLAUDE.md §18 Phase A の Forest v9 機能移植。

## 自走判断 GO 範囲

- #2/#1/#3/#5 連続着手 OK
- 既存 4 銀行パーサー（rakuten/mizuho/paypay/kyoto）TDD パターン踏襲 OK
- 既存 master_rules / classifier 拡張 OK
- 法人ダッシュボード UI は既存 Forest UI パターン踏襲
- 苦戦 / 設計判断必要 → 即 forest-N で a-main-014 経由
- 12 口座 CSV/.api 配置 + manual-balance 5 値（_chat_workspace/garden-forest-shiwakechou/）参照

## 制約遵守

- 動作変更なし（既存 Forest 本番影響なし）
- 新規 npm install 禁止
- Supabase 本番（garden-prod）データ操作禁止
- 設計判断・仕様変更なし
- main / develop 直 push なし
- 弥生 CSV フォーマットは Python 5_仕訳帳_弥生変換_v7.py を read で正確に把握

完走 / 区切り報告は forest-N（次番号 9）で。
~~~

---

## 1. 背景

5/8 金曜朝の a-forest-002 起動指示。Thursday 夜 #4 着手の結果を踏まえて、B-min 残連続着手 + forest-9 完走目標。

### 1-1. Thursday 夜の状態

#4 弥生 CSV パーサー TDD 着手中（20:12-22:00 想定、≈ 0.25d）。
- ✅ #4 完走 → 5/8 朝から #2 連続着手
- 🟡 途中 → 残量を forest-N で報告 + 5/8 朝続き
- ❌ 未着手（疲労停止）→ OK、5/8 朝から #4 着手

### 1-2. 5/8 金曜の本命

B-min 残 #2/#1/#3/#5 連続完走、5/8 夕方までに forest-9 B-min 完走報告。

---

## 2. dispatch counter

- a-main-014: main- No. 108 → 次は **109**

---

## 3. 関連 dispatch

| dispatch | 状態 |
|---|---|
| main- No. 100（B-min 残 Thursday 夜前倒し GO）| ✅ → #4 着手中 |
| 直近: forest-002 受領確認（#4 着手宣言）| ✅ 受領済 |
| **main- No. 108（本書、5/8 金曜朝 起動 + B-min 残続き）** | 🔵 5/8 金曜朝 投下予定 |
