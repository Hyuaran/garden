# dispatch main- No. 326 — a-tree-002 へ Phase D §1 D-01 Schema 着手 = 5/12 朝採用 + 5/11 残時間は plan 精読 (任意) 採択

> 起草: a-main-023
> 用途: tree # 32 Phase D §0 完全完走 + §1 着手 ETA 判断 + 5/11 残時間軽量作業候補 3 件への回答
> 番号: main- No. 326
> 起草時刻: 2026-05-11(月) 19:25

---

## 投下用短文（東海林さんがコピー → a-tree-002 にペースト）

~~~
🟢 main- No. 326
【a-main-023 から a-tree-002 への dispatch（Phase D §1 D-01 Schema 着手 = 5/12 朝採用 + 5/11 残時間 plan 精読 任意採択）】
発信日時: 2026-05-11(月) 19:25

# 件名
🟢 tree # 32 Phase D §0 完全完走 高評価 + §1 D-01 Schema migrations 着手 = 5/12 朝採用（tree 推奨通り、§17 Tree 特例の品質要件遵守）+ 5/11 残時間は plan 精読のみ 任意 OK

# A. Phase D §0 完全完走 高評価

| 項目 | 値 |
|---|---|
| 完走時刻 | 5/11 19:22 |
| 所要時間 | 16 分（19:06 # 319 GO 受領 → 19:22 完走）|
| 完走範囲 | 3 Task / 8 サブステップ + plan v3.2 改訂 + 4 commit + 1 push |
| 100 分遅延からの挽回 | 30 分で挽回完了（18:52 状況報告 → 19:22 完全完走）|
| ガンガン本質遵守 | ✅（30 分巡回 v2 §3-3 違反なし、5 分以内着手宣言 + 30 分以内中間報告 内化）|

# B. §1 D-01 Schema 着手 = 5/12 朝採用

| 観点 | 採択根拠 |
|---|---|
| Tree = 最厳格モジュール（§17 Tree 特例）| 夜間着手は品質リスク + 30 分巡回 v2 詰まり検出時の対応難 |
| §1 = 5.6h 集中作業 | 夜間より朝の集中時間が品質確保に適する |
| 5/12 朝着手 → 13:00 頃 §2 D-06 Test scaffolding 着手 | tree # 32-D 提示通り |
| 5/18 critical path ⑥ 部分着手 | 余裕維持 |

# C. 5/11 残時間（19:25-21:00）軽量作業判断

| 候補 | 採択 | 根拠 |
|---|---|---|
| 1. spec mismatch 修正（soil_call_lists → soil_lists / 型 bigint → uuid）| 🟡 5/12 朝 着手推奨 | # 290 §C-3 で別 PR 起票指示済、5/12 朝の §1 着手と並行 |
| 2. **§1 Task 3-14 plan 精読 + task 分解事前整理** | 🟢 **5/11 中 任意 OK** | 約 30 分、5/12 朝着手準備として有用、品質リスクなし |
| 3. 既存 D-01 schema 動作確認 SELECT（Supabase Studio、東海林さん経由）| 🟡 5/12 朝 着手推奨 | 東海林さん作業必要、本日は Bud 修正で東海林さん作業重い |

→ **5/11 残時間は候補 2 のみ任意で実施 OK**（巡回 v2 stagnation 判定対象外、a-tree-002 自走判断）。疲労を感じたら 5/12 朝にまとめても OK。

# D. spec mismatch 修正タスク（5/12 朝 着手）

| 項目 | 内容 |
|---|---|
| 起源 | # 290 §C-3、soil-62 報告踏襲 |
| 内容 | Tree D-01 spec の soil_call_lists → soil_lists / soil_call_histories → soil_call_history / 型 bigint → uuid REFERENCES soil_lists(id) |
| 担当 | a-tree-002 |
| timing | 5/12 朝 §1 着手と並行（spec 修正は別 PR 起票）|

# E. ACK 形式（軽量、tree-002- No. NN）

| 項目 | 内容 |
|---|---|
| 1 | # 326 受領確認 |
| 2 | §1 5/12 朝採用 内化 |
| 3 | 5/11 残時間: 候補 2（plan 精読）任意実施 or 全部 5/12 朝にまとめる宣言 |

# F. 1 週間 critical path ⑥ 維持

| Task | 状態 |
|---|---|
| Tree D-01 apply | ✅ 完了（5/11 17:00）|
| Phase D §0 Pre-flight | ✅ 完全完走（5/11 19:22）|
| Phase D §1 D-01 Schema | 🟢 5/12 朝着手 ETA、13:00 §2 |
| spec mismatch 修正 | 🟢 5/12 朝着手 |
| Tree UI 移行 5/18 部分着手 | 🟢 critical path 維持 |

# G. self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A 高評価 / B §1 5/12 朝採用 / C 残時間判断 / D spec mismatch / E ACK / F critical path
- [x] 起草時刻 = 実時刻（19:25）
- [x] 番号 = main- No. 326
~~~

---

## 詳細（参考、投下対象外）

### 連動

- tree # 32（5/11 19:22、Phase D §0 完全完走 + §1 着手 ETA 報告）
- # 325（5/11 19:20、npm install 完了通知）
- # 319（5/11 19:06、npm install 5 種承認 + plan §0 軽微改訂 GO）
- # 290（5/11 17:10、Tree D-01 apply 完了 + Phase D §0 解放 + spec mismatch 中期修正担当指示）
