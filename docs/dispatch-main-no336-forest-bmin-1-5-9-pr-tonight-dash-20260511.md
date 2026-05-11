# dispatch main- No. 336 — a-forest-002 B-min #1 + #5 + forest-9 + B-min PR 起票 (ガンガン本質 5/11 中夜間着手歓迎)

> 起草: a-main-024
> 用途: handoff §3 で「B-min #1 + #5 + forest-9 + B-min PR 起票 5/12 朝-午後」と書かれていたが、ガンガン本質「5h フル + 東海林作業時間無視」適用で 5/11 中夜間着手歓迎。Forest 側 context 余力次第で α/β 判断。
> 番号: main- No. 336
> 起草時刻: 2026-05-11(月) 21:22（実時刻基準、powershell.exe Get-Date 取得）

---

## 投下用短文（東海林さんがコピー → a-forest-002 にペースト）

~~~
🟡 main- No. 336
【a-main-024 から a-forest-002 への dispatch（B-min #1 + #5 + forest-9 + B-min PR 起票、ガンガン本質 5/11 中夜間着手歓迎）】
発信日時: 2026-05-11(月) 21:22

# 件名
🟡 a-forest-002 B-min #1 + #5 + forest-9 + B-min PR 起票（handoff §3「5/12 朝-午後」予定 → ガンガン本質適用で 5/11 中夜間着手歓迎、Forest 側 context 余力次第で判断）

# A. ガンガン本質適用通知（# 332 / # 333 と同パターン）
handoff §3 で「B-min #1 + #5 + forest-9 + B-min PR 起票 5/12 朝-午後」と書かれていたが、ガンガン本質「5h フル + 東海林作業時間無視」で **5/11 中夜間着手歓迎**。

| 案 | 内容 |
|---|---|
| α | 5/11 中夜間着手（B-min 残 + forest-9 + PR 起票、5/12 朝までに push 完了想定）|
| β | 5/12 朝-午後着手（plan 通り、Forest context 不足の場合）|

即着手可なら GO、不可なら 5/12 朝 OK。

# B. 直近状態
| 項目 | 値 |
|---|---|
| 直近 commit | B-min #2 4 月仕訳化 classifier 実装 (TDD 27 ケース、83 min 前)|
| 残対象 | B-min #1 + #5 + forest-9 + B-min PR 起票 |
| Phase A 仕上げ | 7 タスク中 6 完走、T-F6 (Download + ZIP) 残 |

# C. タスク内訳（plan §B-min 参照、α 採用時の夜間想定）
| 件 | 内容 | 想定 |
|---|---|---|
| B-min #1 | (handoff 詳細不在、Forest 側 plan 参照) | 1-2h |
| B-min #5 | (handoff 詳細不在、Forest 側 plan 参照) | 1-2h |
| forest-9 | (handoff 詳細不在、Forest 側 plan 参照) | 1-2h |
| B-min PR 起票 | base: develop、4 commit 統合 | 30 分 |

→ α 採用時の合計: 約 3.5-6.5h（5/11 中夜間 + 5/12 早朝の組合せ可）。

# D. ACK 形式（forest-002- No. 33）
| 項目 | 内容 |
|---|---|
| 1 | # 336 受領確認 |
| 2 | α / β 判断 + 残 3 件の着手順 |
| 3 | 各完了 ETA |

# E. T-F6 (Download + ZIP) の扱い
handoff §3 で T-F6 残記述あるが、Phase A 仕上げの最終 1 件 = α 採用時に B-min と並行 or 5/12 朝着手 = Forest 側判断。

# F. 緊急度
🟡 通常（Phase A 仕上げ + B-min 完走で 5/13 後道さんデモ前準備）

# G. self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 起草時刻 = 実時刻 21:22（powershell.exe Get-Date 取得済）
- [x] 番号 = main- No. 336（counter 336 → 337）
- [x] A ガンガン本質適用 / B 直近状態 / C タスク内訳 / D ACK / E T-F6 / F 緊急度
~~~

---

## 詳細（参考、投下対象外）

### 連動
- handoff a-main-023→024 §3 / §4 (⑤ Forest UI)
- a-forest-002 最新 commit (B-min #2 完走、83 min 前)
- main- No. 320 (B-min 集中採択、T-F6 後回し)
