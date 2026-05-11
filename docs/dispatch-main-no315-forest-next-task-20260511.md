# dispatch main- No. 315 — a-forest-002 へ PR #161 merge 後の次タスク投下（T-F6 Download + ZIP or Forest UI Next.js 化）

> 起草: a-main-023
> 用途: PR #161 (Forest D-3 shared lib) merge 後、a-forest-002 が 3h 停滞、次タスク投下で並列稼働維持
> 番号: main- No. 315
> 起草時刻: 2026-05-11(月) 18:50

---

## 投下用短文（東海林さんがコピー → a-forest-002 にペースト）

~~~
🟡 main- No. 315
【a-main-023 から a-forest-002 への dispatch（PR #161 merge 後の次タスク投下、Phase A T-F6 残 or Forest UI Next.js 化）】
発信日時: 2026-05-11(月) 18:50

# 件名
🟡 PR #161 (Forest D-3 shared lib) merge 後、a-forest-002 が 3h 停滞検出（30 分巡回 v2 改訂後初回）= 次タスク投下、Phase A T-F6（Download + ZIP）残 or Forest UI Next.js 化（forest-html-21 配置後）どちらか着手 GO

# A. 30 分巡回検出

| 観点 | 値 |
|---|---|
| 30 分巡回時刻 | 5/11 18:48 |
| a-forest-002 最終 commit | 3 時間前（feat(shared): bank-csv-parsers shared lib）= PR #161 commit |
| current branch | feature/shared-bank-csv-parsers-20260511 |
| 検出判定 | 🔴 実装系停滞 |

# B. 次タスク候補 2 件

| 候補 | 内容 | 想定工数 | 推奨 |
|---|---|---|---|
| **A**（推奨）| Phase A 仕上げ T-F6 = Download + ZIP（Garden Forest 決算資料の ZIP 一括 DL 機能、handoff §3 残 1 件）| 0.5d-1d | 🟢 1 週間 critical path ⑤ Forest UI 完成見込みへの直接寄与 |
| B | Forest UI Next.js 化 = forest-html-21 配置完了後の本実装（claude.ai 起草 HTML → Next.js コンポーネント変換）| 1-2d | 🟡 claude.ai 起草進捗待ち |

# C. 着手 GO 推奨

**A 案推奨**（T-F6 Download + ZIP）:
- handoff §3 で Phase A 7 task 中 6 完走、残 T-F6 のみ
- 後道さんへの可視化主軸（決算資料 DL）
- 5/11 中の主要 PR 起票で 1 週間 critical path ⑤ 寄与

ただし、a-forest-002 が現在進行中の別 work があれば、その状況優先。

# D. 期待する応答（forest-002- No. NN）

選択肢:
- A. T-F6 即着手 → 着手宣言 + ETA
- B. T-F6 ではなく別タスク優先 → 内容 + 理由明示
- C. 待機中（他依存）→ 何待ちかを明示

# E. 連動情報

| 項目 | 値 |
|---|---|
| PR #161 merge | 5/11 09:00 頃（a-main-023 実施）|
| 1 週間 critical path ⑤ | Forest UI（alpha 5/15-16、Next.js 化 5/18）|
| forest-html-21 配置 | 別途 claude.ai 経由（main 配置代行）|

# F. ACK 形式（軽量）

10 分以内の応答で OK。

# G. self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A 検出 / B 候補 2 件 / C 推奨 / D 期待応答 / E 連動 / F ACK
- [x] 起草時刻 = 実時刻（18:50、Bash date 取得）
- [x] 番号 = main- No. 315
~~~

---

## 詳細（参考、投下対象外）

### 1. T-F6 詳細（handoff 引継ぎから）

- 内容: Garden Forest 決算資料の ZIP 一括 Download 機能
- spec: docs/specs/2026-04-25-forest-phase-a-t-f6-download-zip.md（推定、要確認）
- UI: Forest ダッシュボード or 決算カードからの DL ボタン
- 後道さんへの可視化主軸 = 1 週間 critical path ⑤ 寄与

### 2. 関連 dispatch

- # 283（PR #161 起票時、5/11 16:00 頃）
- # 312 broadcast（新 memory 周知、5/11 18:42）
