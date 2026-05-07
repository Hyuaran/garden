# dispatch main- No. 100 — a-forest-002（B-min 残タスク Thursday 夜から前倒し GO）

> 起草: a-main-013
> 用途: a-forest-002 5/8 朝着手予定の B-min 残タスクを Thursday 夜から前倒し着手
> 番号: main- No. 100
> 起草時刻: 2026-05-07(木) 20:08

---

## 投下用短文（東海林さんが a-forest-002 にコピペ）

~~~
🟢 main- No. 100
【a-main-013 から a-forest-002 への dispatch（B-min 残タスク Thursday 夜前倒し GO）】
発信日時: 2026-05-07(木) 20:08

東海林さん「いま進められる？」確認 + ガンガン常態モード適用で、5/8 朝着手予定の B-min 残タスクを **Thursday 夜から前倒し着手 OK** です。

詳細は以下ファイル参照:
[docs/dispatch-main-no100-forest-bmin-thursday-night-frontload-20260507.md](docs/dispatch-main-no100-forest-bmin-thursday-night-frontload-20260507.md)

## 前倒し対象 B-min 残タスク

| # | タスク | 工数 |
|---|---|---|
| 1 | upload API + 法人ダッシュボード簡易 UI（前倒し済の場合継続）| 0.5d |
| 2 | 4 月仕訳化 classifier（master_rules 適用 + 自社内移し替え検出）| 0.5d |
| 3 | 弥生 CSV エクスポート | 0.3d |
| 4 | 弥生 CSV パーサー（A 案 過去 1 年 import）| 0.3d |
| 5 | 確認画面 + 整合性検証 | — |
| 計 | | 約 1.5d |

## 環境状態（記録）

- npm install 完了済（5/7 17:38、東海林さん別 PS で 524 packages）
- .env.local 配置済（5/7 17:48、a-main-013 が a-forest から copy）
- TypeScript / ESLint / Build エラー 0（5/7 17:42 確認）
- balance-overview MVP 完成済（commit `0677d88`）

## 自走判断 OK の範囲

- Thursday 夜から #1-#5 順次着手
- TDD 厳守（既存 81 test cases パターン踏襲）
- 苦戦 / 設計判断 / バグリスク高 → 即 forest-N で a-main-013 経由
- 疲労 / 集中切れ → 自走判断で停止 OK（無理しない、5/8 朝再開）
- forest-9 完走報告は B-min 全完走時（5/8 朝想定 → 今夜中の前倒し可能）

## 5/9 朝 forest-9 → forest-10（forest.md）の流れ

- 旧計画: 5/8-9 で B-min 完走 → 5/9 朝 forest-9 + forest.md → 5/10 a-root-002 集約役
- 新計画（ガンガン）: **Thursday 夜で B-min 一部前倒し** → 5/8 中で B-min 完走 → 5/9 朝 forest.md 起草 + 5/10-11 v9 残機能前倒し

## 推奨ペース

- Thursday 夜（20:08-22:00）: #1 upload API or #2 4 月仕訳化 着手（0.5d 想定）
- 5/8 朝: 残り #3-#5 + forest-9 完走 + forest.md 起草
- 5/10-11: T-F6 + 納税カレンダー + 決算書 ZIP + 派遣資産要件
- 5/12: 認証統一作業

苦戦時自走判断停止 OK、明朝再開でも問題なし。

完走 / 区切り報告は forest-N（次番号）で。
~~~

---

## 1. 背景

### 1-1. 東海林さん指摘（20:05）

> a-bud D-04 / D-07 自走判断後の報告
> a-forest-002 forest-9 完走
> これはいまできる？

→ ガンガン常態モード適用、今夜から前倒し意図。

### 1-2. a-forest-002 状態確認

| 項目 | 状態 |
|---|---|
| 計画 | 5/8 朝 B-min 残着手予定 |
| 環境 | npm install / .env.local / TypeScript / Build すべて OK |
| 余力 | 今夜まだ作業可能（待機中、20:08 時点で 2-3 時間余裕）|
| spec | B-min 残 5 タスクすべて整理済 |

→ **Thursday 夜から前倒し着手 OK**（ガンガン常態モード整合）。

### 1-3. a-bud の状況（参考）

main- No. 99 投下済（D-03 完走評価 + D-04 / D-07 自走判断 GO）→ 東海林さんが a-bud に投下すれば即着手可能。

---

## 2. B-min 残タスク 詳細

### 2-1. #1 upload API + 法人ダッシュボード簡易 UI

| 項目 | 内容 |
|---|---|
| 工数 | 0.5d |
| 内容 | CSV ファイル受領 + parse + DB 投入の API（既存 4 銀行パーサー活用）|
| UI | 簡易 dashboard（balance-overview の延長）|
| 推奨 | Thursday 夜着手 OK（既存パーサー活用）|

### 2-2. #2 4 月仕訳化 classifier

| 項目 | 内容 |
|---|---|
| 工数 | 0.5d |
| 内容 | master_rules 適用（714 ルール seed 済）+ 自社内移し替え検出 |
| 推奨 | 5/8 朝（複雑、集中力フル）|

### 2-3. #3 弥生 CSV エクスポート

| 項目 | 内容 |
|---|---|
| 工数 | 0.3d |
| 内容 | classifier 結果 → 弥生形式 CSV 生成 |
| 推奨 | 5/8 朝（#2 完走後）|

### 2-4. #4 弥生 CSV パーサー（A 案）

| 項目 | 内容 |
|---|---|
| 工数 | 0.3d |
| 内容 | 過去 1 年分 import |
| 推奨 | 5/8 朝-夕方 |

### 2-5. #5 確認画面 + 整合性検証

| 項目 | 内容 |
|---|---|
| 内容 | 4/30 残高検算 + 5 値手入力との照合 |
| 推奨 | B-min 完走時 |

---

## 3. 5/8 朝以降の更新計画

| 期間 | タスク |
|---|---|
| Thursday 夜（20:08-22:00 想定）| B-min #1 or #2 着手（0.5d 程度）|
| 5/8 朝 | 残り B-min #3-#5 + forest-9 完走報告 + forest.md 起草 |
| 5/9 朝 | forest-10（forest.md 完成報告 → a-root-002 集約役 5/10 で取込）|
| 5/10-11 | T-F6 + 納税カレンダー + 決算書 ZIP + 派遣資産要件 前倒し |
| 5/12 | 認証統一作業 |

---

## 4. dispatch counter / 後続予定

- a-main-013: main- No. 100 → 次は **101**（counter 更新済）

## 5. 関連 dispatch

| dispatch | 状態 |
|---|---|
| main- No. 76（B-min 着手 GO）| ✅ 完了 |
| main- No. 80（判断保留 2 件 回答）| ✅ 受領 |
| main- No. 82（5/7 中 0.6d 前倒し）| ✅ 完走 |
| main- No. 86（横断 全前倒し）| ✅ 受領 |
| main- No. 88（5/10-11 待機解除）| ✅ 受領 |
| main- No. 96（forest.md 取りまとめ前倒し）| ✅ 受領 |
| **main- No. 100（本書、Thursday 夜前倒し）**| 🟢 投下中 |

---

ご確認・着手お願いします。判断保留事項あれば即停止 → a-main-013 経由で東海林さんに確認依頼。
