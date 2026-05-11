# dispatch main- No. 114 — a-tree（5/8 朝起動報告受領 + カウンタずれ訂正 + 下準備 4 件 GO）

> 起草: a-main-014
> 用途: a-tree 5/8 起動報告受領 + main- No. 107 の認識訂正 + 下準備作業承認
> 番号: main- No. 114
> 起草時刻: 2026-05-08(金) 12:33

---

## 投下用短文（東海林さんが a-tree にコピペ）

~~~
🟢 main- No. 114
【a-main-014 から a-tree への dispatch（5/8 朝起動報告受領 + カウンタずれ訂正 + 下準備 4 件 GO）】
発信日時: 2026-05-08(金) 12:33

tree-14 受領、5/7 夜の進捗（tree-10〜13）+ 第一/第三優先既完了の状況把握しました。
私（a-main-014）の handoff 反映漏れでした、申し訳ありません。

詳細は以下ファイル参照:
[docs/dispatch-main-no114-tree-friday-startup-confirmed-prepwork-go-20260508.md](docs/dispatch-main-no114-tree-friday-startup-confirmed-prepwork-go-20260508.md)

## カウンタずれ訂正

- main- No. 107 記載「次番号 10」→ 正しくは **tree-15**（5/7 夜 tree-10〜14 進行済）
- handoff（a-main-013 → 014）の記載が古かった、私の確認漏れです
- 5/7 夜の tree-10〜13 進捗（PR #128 / #129 reissue + ESLint 調査 + 前夜整理）感謝です

## 第一・第三優先 既完了の確認

| main- No. 107 優先 | 現状 |
|---|---|
| **第一優先 代替 PR 発行** | ✅ **5/7 18:55 完了**（PR #128 + #129 reissue 発行、CLEAN/MERGEABLE）|
| **第三優先 tree.md 起草** | ✅ **5/5 22:43 完了**（57 行 / 4,711 bytes、月次更新ルール）|
| 第二優先 D-02 implementation 続き | ✅ **D-02 自体 5/5 完走**（10 Step / Vitest 727 PASS）、PR #129 review 待ち |

→ main- No. 107 の「Phase D-02 続き」は誤認、実際は D-02 完成済 + 後続 D-03/D-04/D-05/D-06 が α 版完走後着手の原則。

## 5/8 下準備作業 4 件 GO（承認）

| # | タスク | 工数 | 自走判断 |
|---|---|---|---|
| 1 | PR #128 / #129 review 状態 トラッキング | 0.05d | 🟢 即実施 |
| 2 | D-03 manager UI spec 精読 + α 版完走後即着手化のための task 分解 | 0.3d | 🟢 即実施 |
| 3 | ESLint 11 errors 詳細リスト化 | 0.1d | 🟢 即実施 |
| 4 | Breeze 役割齟齬 説明資料化（既存 page.tsx vs spec §3.4 比較）| 0.2d | 🟢 即実施 |
| 合計 | | 0.65d | |

→ 動作変更なし、既存コード非干渉、α 版完走後の即着手準備として完璧。

## 既知の課題リスト 進捗確認

| # | 課題 | 状態 |
|---|---|---|
| 1 | Breeze 役割齟齬（既存=チャット vs spec §3.4=呼吸連続架電）| spec-tree-rill-rename.md develop 未取込、本日 #4 で資料化予定 |
| 2 | `ng_timeout` CHECK 制約 | ✅ 解消済（D-01 で `'ng_other'` 集約、12 種、tree-8 確認）|
| 3 | D-01 migration 投入確認（garden-dev）| 東海林さん作業範囲、PR #128 merge 後 |
| 4 | 既存 ESLint 11 errors（タイマー系）| 本日 #3 で詳細リスト化予定 |

## Tree 特例 + 5/14-16 デモ

了解、Tree は 5/14-16 デモには出さない（Bloom + 全体ダッシュボード中心）。
α 版判断は別軸で、認証統一実装後の 5/14-16 デモ後に α 版開始判断 → 1 人現場テスト → 2-3 人 → 半数 → 全員（FileMaker 切替、§17）。

## 自走判断 GO 範囲

- 下準備 4 件 連続着手 OK
- 動作変更なし、既存コード非干渉
- spec 精読 / リスト化 / 資料化 系で a-tree 単独完結
- 苦戦 / 設計判断必要 → 即 tree-N で a-main-014 経由
- D-03〜D-06 本格着手は α 版完走後（PR #128/#129 merge → α 版開始判断後）

## 制約遵守（再掲、整合 OK）

- 動作変更なし
- 新規 npm install 禁止
- Supabase / FileMaker 操作禁止
- 設計判断・仕様変更なし
- main / develop 直 push なし

完走 / 区切り報告は tree-N（次番号 15）で。判断保留即上げ歓迎です。
~~~

---

## 1. 背景

### 1-1. tree-14 受領（12:25）

a-tree 起動報告:
- ⚠️ a-main-014 カウンタずれ指摘（「次番号 10」→ 実際 tree-14）
- ✅ 第一優先 代替 PR 発行 5/7 18:55 完了済
- ✅ 第三優先 tree.md 起草 5/5 22:43 完了済
- ⚠️ 第二優先 D-02 自体は 5/5 完走済（10 Step / Vitest 727 PASS）
- 5/8 下準備 4 件アクションプラン明示

### 1-2. 私の判断（訂正 + 下準備承認）

- handoff（a-main-013 → 014）の tree カウンタ「次 10」記載が古かった、訂正
- 第一/第三優先既完了の認識共有
- 5/8 下準備 4 件は完璧な選択（α 版完走後の即着手準備）
- 承認・自走 GO

---

## 2. dispatch counter

- a-main-014: main- No. 114 → 次は **115**
- a-tree: tree-14 受領 → 次 tree-15

---

## 3. 関連 dispatch

| dispatch | 状態 |
|---|---|
| main- No. 90（PR 代替 A 案承認）| ✅ → 5/7 PR #128/#129 reissue |
| main- No. 107（5/8 朝 起動 + Phase D-02 続き、誤認あり）| ✅ 認識訂正済 |
| **main- No. 114（本書、起動報告受領 + 訂正 + 下準備 GO）** | 🟢 投下中 |
