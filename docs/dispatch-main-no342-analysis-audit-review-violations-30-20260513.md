# dispatch main- No. 342 — a-analysis-001 + a-audit-001 違反 30 件構造分析 + 5/12 朝 audit review 議題 1-15 即開催

> 起草: a-main-024
> 用途: 5/12 朝予定の audit review が 5/13 朝に滞留、5/11-5/13 期累計違反 30 件の構造分析 + 議題 1-15 確認 + memory 改訂提案 + incident-pattern-log 蓄積、デモ延期 = 全完走後モード
> 番号: main- No. 342（counter 342、v6 規格 +1 厳守）
> 起草時刻: 2026-05-13(水) 10:15（実時刻基準、powershell.exe Get-Date 取得）

---

## 投下用短文（東海林さんがコピー → a-analysis-001 + a-audit-001 にペースト、または順次投下）

~~~
🟡 main- No. 342
【a-main-024 から a-analysis-001 + a-audit-001 への dispatch（違反 30 件構造分析 + 議題 1-15 即開催 + 5/13 至急モード）】
発信日時: 2026-05-13(水) 10:15

# 件名
🟡 5/11-5/13 期累計違反 30 件の構造分析 + 5/12 朝 audit review 議題 1-15 即開催（5/12 朝予定 → 5/13 朝で 1 日滞留、デモ延期 = 全完走後モード）

# A. 至急モード通知
東海林さん 5/13 10:14 明示: 「デモ延期、全完走後デモ」「至急進めましょう」。5/12 朝予定の audit review が 5/13 朝に滞留、即開催。

# B. 違反 30 件サマリ（5/11-5/13 期、a-main-024 期）
| # | 違反 | 該当 memory | 検出経路 |
|---|---|---|---|
| 21 | handoff §11「5/12 朝着手」機械踏襲 | gangan_mode_default | 東海林さん「明日にしてる理由ある？」|
| 22 | dispatch # 331-333 v5 規格違反（ファイル名 + ~~~ + 構成すべて崩し）| dispatch_header_format v5 | 東海林さん「dispatch 書き方変わった？」|
| 23 | dispatch # 331-333 起草時刻自己推測 50 分先取り | verify_before_self_critique | 東海林さん「Garden Root の発信時間がおかしい」|
| 24 | dispatch # 333 §B 表 PR 番号 + Task 名 transcription error（5 行全件誤）| check_existing_impl / verify_before_self_critique | root-003 No. 63-ack §C |
| 25 | a-root-003 No. 63/64/65 連鎖時刻自己推測 3h ドリフト | verify_before_self_critique | main- No. 333-rep-2 §C |
| 26 | 判断仰ぎ説明スタイル違反（専門用語 + 全体像なし、2 回指摘）| explanation_style / pending_decisions_table_format | 東海林さん「わかるように説明しろよ」「もういいから次回忘れるな」|
| 27 | ガンガン本質「5/12 朝」機械踏襲再違反（# 21 同型）| gangan_mode_default v3 | 東海林さん「明日にしてる理由ある？今日できない？」|
| 28 | dispatch 命名規則違反（a-main 起源で -rep/-rep-2 独自創出、6 件）| dispatch_header_format v5 → v6 | 東海林さん「ack でさえも見たことない、ずっと +1」|
| 29 | 日付認知違反（5/11 → 5/12 朝想定、実は 5/13 朝、system reminder「Today's date is 2026-05-13」見落とし）| verify_before_self_critique | a-main-024 自発検出 5/13 10:14 |
| 30 | 「5/13 後道さんデモ前マイルストーン」記述（東海林さん延期通知見落とし、memory 起票 + dispatch 多用）| verify_before_self_critique | 東海林さん「デモ予定は延期したため、5/13 はあなたが勝手に設定してると思う」|

→ 5/11 期 # 21-28 + 5/13 朝 # 29-30 = **累計 30 件**

# C. a-analysis-001 への依頼（構造分析）
| 項目 | 内容 |
|---|---|
| 1 | 30 件の共通パターン抽出（時刻 / 機械踏襲 / 規格忘れ / 説明スタイル 等）|
| 2 | memory 強化提案（sentinel 5 → 6 項目 / §0 ロック 8 → 9 項目 / 新規 memory 候補）|
| 3 | a-main-022→023→024 期違反トレンド（22 期 ? 件 / 23 期 20 件 / 24 期 10 件、増減傾向）|
| 4 | 構造的真因の根本対処案（context 取込フレーム / handoff 機械踏襲 / dispatch bottleneck 等）|

# D. a-audit-001 への依頼（incident-pattern-log + 議題 1-15）
| 項目 | 内容 |
|---|---|
| 1 | 30 件を incident-pattern-log 蓄積（YYYYMMDD-NN 形式、頻度集計）|
| 2 | 議題 1-12（既存 handoff §5）+ 議題 13-15（5/11 期新規追加）の確認:
   - 議題 12: PR #90 真因確定（silent NO-OP 罠 #2、推測 3 候補）|
   - 議題 13: Vercel Free 100/日 vs handoff §5「Pro 既契約済」記述の矛盾調査 |
   - 議題 14: Supabase Studio 一括確認（#148/#154/#156/#157/#90 各テーブル/関数実存）|
   - 議題 15: visibility matrix (cs+) vs ModuleGate minRole (staff) 差異 Phase B-2 統一検討 |
| 3 | known-pitfalls.md 更新提案（v5 規格周知 / handoff 機械踏襲予防 / 時刻取得徹底 等）|

# E. 即開催プラン（5/13 朝、a-main-024 連携）
| 順 | アクション | 担当 | ETA |
|---|---|---|---|
| 1 | a-analysis 構造分析起草（subagent 並列推奨）| a-analysis-001 | 30 分-1h |
| 2 | a-audit incident-pattern-log + 議題 1-15 確認 | a-audit-001 | 30 分-1h |
| 3 | a-main-024 が両者報告統合 → 東海林さんに集約報告 | a-main-024 | 15 分 |
| 4 | memory 改訂 GO（東海林さん明示）→ 反映 | a-main-024 | 30 分 |

# F. ACK 形式（analysis-001 + audit-001）
| 項目 | 内容 |
|---|---|
| 1 | # 342 受領確認 |
| 2 | 構造分析 / incident-log 完走 ETA |
| 3 | 議題 12-15 個別所見（特に PR #90 真因 + Vercel limit 矛盾）|
| 4 | memory 改訂候補（具体案）|

# G. 緊急度
🟡 通常（5/12 朝予定の review が 1 日滞留、構造分析は本日中完走）

# H. self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 起草時刻 = 実時刻 10:15（powershell.exe Get-Date 取得済、2026-05-13 水曜）
- [x] 番号 = main- No. 342（v6 規格 +1 厳守）
- [x] A 至急 / B 違反 30 件 / C analysis / D audit / E プラン / F ACK / G 緊急度
~~~

---

## 詳細（参考、投下対象外）

### 連動
- handoff a-main-023→024 §5（違反 20 件、023 期）
- docs/violations-a-main-024-20260511.md（024 期 # 21-28 + 5/13 朝 # 29-30）
- bloom-006 No. 26（議題 12 PR #90 + 議題 14 Supabase Studio 一括確認、議題 15 visibility matrix）
- main- No. 334-rep（議題 14/15 追加）
- 東海林さん 5/13 10:14 「至急進めましょう」

### 投下案内
本 dispatch は a-analysis-001 + a-audit-001 の 2 セッション宛て。投下は 2 回（各セッションに 1 回ずつ）or 1 回（連動先明示で）でも OK、東海林さん判断。
