# dispatch main- No. 113 — a-forest-002（5/8 朝起動報告 受領 + #4 即着手 承認 + B-min 残 1.6d 連続 GO）

> 起草: a-main-014
> 用途: a-forest-002 forest-002 起動報告受領 + Thursday 夜未着手の正直申告承認 + 5/8 着手プラン GO
> 番号: main- No. 113
> 起草時刻: 2026-05-08(金) 12:31

---

## 投下用短文（東海林さんが a-forest-002 にコピペ）

~~~
🟢 main- No. 113
【a-main-014 から a-forest-002 への dispatch（5/8 朝起動報告 受領 + #4 即着手 承認 + B-min 残 1.6d 連続 GO）】
発信日時: 2026-05-08(金) 12:31

forest-002 起動報告受領、Thursday 夜 #4 未着手の正直申告 OK です。
dispatch 処理 + Python 5_仕訳帳_弥生変換_v7.py read 準備中にセッション中断 = 進めれない事情、ガンガン継続中で問題なし。
5/8 朝の前倒し着手で目標カバー、承認です。

詳細は以下ファイル参照:
[docs/dispatch-main-no113-forest-002-friday-startup-confirmed-go-20260508.md](docs/dispatch-main-no113-forest-002-friday-startup-confirmed-go-20260508.md)

## 起動報告 評価

- ✅ git pull up-to-date、working tree clean、HEAD e73329e（1,026 tests 全 pass）
- ✅ 「未着手」正直申告（無理せず、進めれない事情明示で OK）
- ✅ 5/8 アクションプラン妥当（#4 → #2 → #1 → #3 → #5、合計 1.6d）
- ✅ #4 着手手順 5 ステップ明示（Python read → 型定義 → parser → TDD → 実 fixture 検証）

## 5/8 着手 GO（即実行）

| 順序 | タスク | 工数 | 依存 | 自走判断 |
|---|---|---|---|---|
| #4 | 弥生 CSV パーサー TDD | 0.3d | なし | 🟢 即着手 GO |
| #2 | 4 月仕訳化 classifier | 0.5d | #4 完成 | 🟢 連続着手 OK |
| #1 | upload API + 法人ダッシュボード UI | 0.5d | #2 完成 | 🟢 連続着手 OK |
| #3 | 弥生 CSV エクスポート | 0.2d | #1 完成 | 🟢 連続着手 OK |
| #5 | 確認画面 UI | 0.1d | #3 完成 | 🟢 連続着手 OK |

→ 5/8 夕方までに forest-9 B-min 完走報告目標。

## forest.md design-status 起草

forest-9 完走後 即起草着手 OK（5/9 朝予定の前倒し）。
- bud.md / bloom.md / tree.md / leaf.md / root.md / soil.md と同形式
- 5/10 a-root-002 集約役の前提（5/9 朝までに完成必須 → 5/8 夕方完成で十分余裕）

## 自走判断 GO 範囲

- #4 → #2 → #1 → #3 → #5 連続着手 OK
- 既存 4 銀行パーサー（rakuten/mizuho/paypay/kyoto）TDD パターン踏襲 OK
- 既存 master_rules / classifier 拡張 OK
- 法人ダッシュボード UI は既存 Forest UI パターン踏襲
- 苦戦 / 設計判断必要 → 即 forest-N で a-main-014 経由
- 12 口座 CSV/.api 配置 + manual-balance 5 値（_chat_workspace/garden-forest-shiwakechou/）参照
- ⚠️ 集中切れ / 疲労時は自走判断で停止 OK（無理しない）

## 制約遵守（再掲、整合 OK）

- 動作変更なし（既存 Forest 本番影響なし）
- 新規 npm install 禁止
- Supabase 本番（garden-prod）データ操作禁止
- 設計判断・仕様変更なし
- main / develop 直 push なし
- 弥生 CSV フォーマットは Python 5_仕訳帳_弥生変換_v7.py を read で正確把握（spec §10 受入基準）

## 5/9-13 のタイムライン（リマインド）

| 日 | タスク |
|---|---|
| **5/8（金）** | **B-min 残 #4 → #2 → #1 → #3 → #5 連続完走 + forest.md 起草前倒し** |
| 5/9（土）| forest.md 起草完成 + 余裕あれば T-F6 / 納税カレンダー着手 |
| 5/10（日）| a-root-002 集約役（forest.md 集約）|
| 5/11-12 | T-F6 + 納税カレンダー + 決算書 ZIP + 派遣資産要件 |
| 5/13 | 認証統一 redirect + 統合テスト準備 |
| 5/14-16 | 後道さんデモ |

完走 / 区切り報告は forest-N（次番号 9）で。判断保留即上げ歓迎です。
~~~

---

## 1. 背景

### 1-1. forest-002 受領（12:30 頃）

a-forest-002 起動報告:
- ✅ git pull up-to-date、working tree clean
- ❌ Thursday 夜 #4 未着手（正直申告）
- ✅ 5/8 アクションプラン明示（#4 → #2 → #1 → #3 → #5、合計 1.6d）
- ✅ #4 着手手順 5 ステップ明示

### 1-2. 私の判断（即着手 GO + 連続 OK）

- 「未着手」正直申告は OK（責めない）
- ガンガン常態モード = 「真に進めれない事情なら停止 OK」原則と整合
- 5/8 朝の前倒し着手で目標カバー、5/8 夕方まで連続着手 OK
- forest.md 起草も前倒し可（5/9 朝予定 → 5/8 夕方完成で十分余裕）

---

## 2. dispatch counter

- a-main-014: main- No. 113 → 次は **114**

---

## 3. 関連 dispatch

| dispatch | 状態 |
|---|---|
| main- No. 100（B-min 残 Thursday 夜前倒し GO）| ✅ → Thursday 夜 計画段階で中断 |
| main- No. 108（5/8 朝 起動 + B-min 残続き）| ✅ 投下済 |
| main- No. 109（forest-9 完走後 次タスク GO 事前テンプレ）| 🔵 forest-9 受領後 投下予定 |
| **main- No. 113（本書、5/8 朝起動報告受領 + 即着手 GO）** | 🟢 投下中 |
