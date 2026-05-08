# dispatch main- No. 144 — a-soil 引っ越し承認 (A 案 GO) + a-soil-002 起動手順

> 起草: a-main-015
> 用途: a-soil の handoff 整備 + 引っ越し承認 + a-soil-002 起動手順案内
> 番号: main- No. 144
> 起草時刻: 2026-05-08(金) 15:18

---

## 投下用短文（東海林さんが a-soil にコピペ）

~~~
🔴 main- No. 144
【a-main-015 から a-soil への dispatch（A 案 = handoff 整備 + 引っ越し承認）】
発信日時: 2026-05-08(金) 15:18

# 件名
soil-51 受領。A 案 GO（handoff 整備 + 引っ越し準備）。次セッション = a-soil-002

# soil-51 受領内容（要約）
- Batch 20 第 2 弾 = B-01 Phase 3 spec 完成（459 行、40 倍速）
- Phase 2 + Phase 3 合計 1,033 行 / 1.5d 工数 → 43 分実績（31x 倍速）
- Soil B-01 全 Phase spec 揃 🏆
- §22-8 自発 token check で 60-65% 帯推定 → 引っ越し準備推奨
- 4 択 A/B/C/D 提示

# 横断調整セッションの判断
**A 案 GO**（handoff 整備 + 引っ越し準備、CLAUDE.md §22-1 60-70% 帯対応）

理由:
- soil-51 で「次の dispatch 着手前に handoff 整備 → 引っ越し準備推奨」と自己判断あり
- bud-20 教訓（§22-8 反映済）= 60% 超過時引っ越し優先
- B-01 全 Phase spec 揃の絶妙な区切り、引っ越しタイミング最適

# あなた（a-soil）がやること（5 ステップ）

1. **handoff 整備**:
   - ファイル: docs/handoff-a-soil-to-soil-002-20260508.md
   - 内容: 今やっていること / 次にやるべきこと / 注意点 / 関連情報 / dispatch counter (次 soil-52)
   - テンプレ: CLAUDE.md「ハンドオフメモのテンプレート」参照

2. **commit + push**:
   - メッセージ例: docs(soil): handoff a-soil → a-soil-002（コンテキスト 60-65% 到達、§22-1 引っ越し実行）

3. **dispatch counter 引継ぎ**:
   - C:\garden\a-soil-002\docs\dispatch-counter.txt = 52（次番号）として記載予定

4. **完走報告 (soil-52)**:
   - a-main-015 宛に「handoff 整備完了、a-soil-002 起動準備 OK」と報告
   - 引継ぎファイル名 + 直近 commit hash を併記

5. **次セッション起動準備の通知**:
   - 「a-soil-002 起動を東海林さんに依頼」報告で締め

# a-soil-002 起動手順（東海林さん用、参考案内）

東海林さんが別 PowerShell で:
```
cd C:\garden\a-soil-002
git fetch --all
git checkout feature/soil-batch20-spec  # または該当ブランチ
git pull
claude
```
起動後の最初の依頼:
「docs/handoff-a-soil-to-soil-002-20260508.md を読んで続きを進めて」

※ a-soil-002 worktree がまだ無い場合は、東海林さんが C:\garden\a-soil-002 を新設（git worktree add）

# B 案/C 案/D 案について

- B 案（PR #127 + B-01 Phase 2/3 spec を統合 PR）: 引っ越し後の a-soil-002 が判断
- C 案（連続着手）: token 使用率超過リスクで却下
- D 案（締め）: A 案の延長 = 同義。A 採用

# 引っ越し後の優先タスク（a-soil-002 で再開時）

| 優先度 | タスク |
|---|---|
| 🔴 1 | Phase 2 / Phase 3 実装着手判断（東海林さん指示後）|
| 🟡 2 | PR #127 review 状況確認 + 必要なら統合 PR |
| 🟡 3 | B-01 全 Phase spec の cross-check（実装前最終確認）|
| 🟢 4 | Batch 20 完走報告の effort-tracking 反映 |

# 緊急度
🔴 即必要（60-65% 帯、引っ越しは早いほど安全）

# 完走報告フォーマット
🟢 soil-52
【a-soil から a-main-015 への handoff 整備完了報告】
発信日時: 2026-05-08(金) HH:MM
件名: handoff 整備完了、a-soil-002 起動準備 OK
ファイル: docs/handoff-a-soil-to-soil-002-20260508.md
次 counter: 52（a-soil-002 で継承）
~~~

---

## 詳細（参考）

発信日時: 2026-05-08(金) 15:18
発信元: a-main-015
宛先: a-soil
緊急度: 🔴 即必要（60-65% 帯、CLAUDE.md §22-1 引っ越し対応）
