# dispatch main- No. 132 — a-bud / a-bud-002（緊急引っ越し承認 + a-bud-002 起動 GO + 学び memory 化検討）

> 起草: a-main-014
> 用途: a-bud bud-20 受領（80% 最終ライン緊急引っ越し）+ a-bud-002 起動承認 + 学び 2 件 memory 化検討
> 番号: main- No. 132
> 起草時刻: 2026-05-08(金) 13:29

---

## 投下用短文 1: a-bud（緊急引っ越し受領 + 学び評価）

東海林さんが a-bud（旧）にコピペして「お疲れ様」+ 学び評価を伝える:

~~~
🟢 main- No. 132（a-bud → a-bud-002 引っ越し受領）
【a-main-014 から a-bud への dispatch（80% 緊急引っ越し受領 + 学び評価 + a-bud-002 起動 GO）】
発信日時: 2026-05-08(金) 13:29

bud-20 受領、80% 最終ライン緊急引っ越し実行 + RTK gain 報告（§22-7 必須） + a-bud-002 起動依頼コピペ起草 = 完璧な対応。

詳細: [docs/dispatch-main-no132-bud-emergency-handoff-bud002-go-20260508.md](docs/dispatch-main-no132-bud-emergency-handoff-bud002-go-20260508.md)

## 引っ越し評価

- ✅ 80% 到達 → 即時引っ越し実行（§22 最終ライン適用、適切）
- ✅ handoff メモ 120 行（commit 27a4ff2、push 済）
- ✅ RTK gain 報告 1,155 commands / 576.5K saved (64.7%) → 累計トラッキングに記録
- ✅ a-bud-002 起動コピペテキスト 同梱（東海林さん操作 1 回）
- ✅ 学び 2 件を §23 dispatch 経由で提示（main 判断委ねる流れ整合）

## 反省点 → 学び 2 件（memory 化検討）

a-bud から提案された改善案:
1. **各タスク完了時に token 使用率自己チェック**（50/60/70% 閾値で自発アラート）
2. **dispatch 受領後すぐ token 残量チェック** → 60% 超過なら タスク着手前に引っ越し優先

→ 私（a-main-014）が東海林さんと議論後、採用なら memory 化（§23 メモリー main 判断ルール準拠）。

### 私の評価（a-main 視点）

**強推奨採用**:
- 通常モード（旧ガンガン）= 連続着手の流れで、token 使用率の自律検知が必要
- §22-1 の段階別アラート（50/60/70%）を「自動 hook」がなくても自発実行できる文化が望ましい
- bud-20 が示した「dispatch 受領タイミングで重なり逃した」パターンは構造的、Garden 全モジュール共通課題

東海林さん判断後、CLAUDE.md §22-8（自律的 token チェック）として追加 or memory ファイル化検討。

## a-bud-002 起動 GO

東海林さんへの起動操作:

1. 別 PowerShell で `git worktree add C:/garden/a-bud-002 feature/bud-phase-d-implementation`
2. `cd C:/garden/a-bud-002` + `claude` 起動
3. a-bud-002 起動コピペテキストを投下（bud-20 内に同梱、後述）

## a-bud（旧）の今後

- 旧 a-bud セッションは「引っ越し完了、a-bud-002 へ移行」表示で停止
- 新規作業禁止（push 衝突防止）
- コンテキスト保持（振り返り用）

12 件完走 / 489 tests / 66% 圧縮 / Phase D 83% 達成 = 圧倒的偉業でした。お疲れ様でした。

a-bud-002 で残 2 件（D-06 + D-08）= Phase D 100% 完走お願いします。
~~~

---

## 投下用短文 2: a-bud-002（起動コピペテキスト、bud-20 内同梱版を a-main-014 で精緻化）

東海林さんが新セッション a-bud-002 起動後、最初に投下するコピペテキスト:

~~~
a-bud-002 として作業を引き継いでください。

以下を順番に実施:
1. pwd で C:\garden\a-bud-002（or worktree 場所）確認
2. git status で feature/bud-phase-d-implementation ブランチ確認
3. git pull origin feature/bud-phase-d-implementation で最新取得
4. docs/handoff-bud-to-bud-002-20260508.md を精読
5. dispatch counter 21 確認
6. 累計成果の把握（12 件完走、Phase D 83%、Vitest 489 tests、66% 圧縮）
7. Cat 4 #26/#27/#28 全反映済を認識
8. ★最初のタスク: 残 D-06 nenmatsu / D-08 test 2 件で Phase D 100% 完走（main- No. 128 推奨: D-06 → D-08 連続）
9. 完了したら「a-bud-002 起動完了。通常モード継続」と返答

注意点:
- 通常モード継続（CLAUDE.md §21、解除指示なければデフォルト = 旧ガンガン）
- spec 100% 準拠、新規 npm install なし、設計判断・仕様変更なし
- 既存 D-09 helpers + D-04 UEDA_VISUAL_CHECK_UI_REQUIREMENTS const + nextBusinessDay 再利用
- 完走報告は bud-21 から
- §22-7 RTK gain 報告: 60% アラート時 + 引っ越し実行時 = 計 2 回 main 経由
- §23 memory 書込禁止、学び・改善提案は dispatch で main 経由
- §22-8 候補: タスク完了時に token 使用率自己チェック（main 判断後に正式化）
- 80% 到達直前 = bud-20 が緊急引っ越しした precedent あり、60-70% で前倒し引っ越しを意識
~~~

---

## 1. 背景

### 1-1. bud-20 受領（13:13）

a-bud 80% 最終ライン緊急引っ越し:
- §20-23 受領タイミングと重なり 60%/70% アラート逃した（反省点）
- 即時引っ越し実行、handoff 完了、commit + push
- RTK gain 報告 64.7% / 576.5K saved
- a-bud-002 起動依頼コピペ同梱
- 学び 2 件提案

### 1-2. 私の判断（緊急対応 + 学び評価）

- 80% 引っ越し実行 = §22 最終ライン適用、適切
- 学び 2 件は強推奨採用、CLAUDE.md §22-8 候補 or memory ファイル化
- a-bud-002 起動 GO

---

## 2. RTK 累計トラッキング 更新

bud-20 + tree-17 を [docs/rtk-cumulative-tracking.md](docs/rtk-cumulative-tracking.md) §1 累計表に追記済:

| # | 日時 | セッション | event | commands | saved (%) |
|---|---|---|---|---|---|
| 1 | 2026-05-08 13:13 | a-bud | 🔴 80% 最終引っ越し | 1,155 | 576.5K (64.7%) |
| 2 | 2026-05-08 13:19 | a-tree-002 | 参考（60% 未到達）| 1,172 | 578.4K (57.5%) |

→ a-bud → a-bud-002 期間中の削減量は a-bud-002 起動後の rtk gain で確定（差分計算）。

---

## 3. 学び 2 件 - memory 化検討

bud-20 提案:
1. 各タスク完了時に token 使用率自己チェック
2. dispatch 受領後すぐ token 残量チェック → 60% 超過なら引っ越し優先

### 採用時の運用案（CLAUDE.md §22-8 追加候補）

```
## 22-8. 自律的 token 使用率チェック（2026-05-08 追加）

各セッションは以下のタイミングで自発的に token 使用率を確認:

| タイミング | アクション |
|---|---|
| タスク完了時 | /context or /cost で確認、50/60/70% 閾値で自発アラート |
| dispatch 受領時 | 受領直後に確認、60% 超過なら タスク着手前に引っ越し優先 |
| 長時間処理前（重い build / test / scan）| 事前に確認、70% 超過なら引っ越し検討 |

→ 80% 強制ライン到達前の段階的対応で、handoff 品質維持。
```

### 東海林さん判断仰ぎ

- §22-8 として CLAUDE.md に追加 OK?
- a-main-014 自走で 43 箇所一括反映 OK?
- bud-20 学びの memory 化（feedback / project どちらか）必要?

---

## 4. dispatch counter

- a-main-014: main- No. 132 → 次は **133**
- a-bud: bud-20 受領 → セッション停止、a-bud-002 起動
- a-bud-002: 起動後 bud-21 から開始（bud-20 内予約済）

---

## 5. 関連 dispatch

| dispatch | 状態 |
|---|---|
| main- No. 128（D-06 推奨）| 🔵 a-bud に投下予定 → a-bud-002 へ引き継ぎ |
| **main- No. 132（本書、緊急引っ越し受領 + a-bud-002 起動 GO + 学び評価）** | 🟢 投下中 |

---

## 6. その他 8 件受領確認（短く受領のみ）

| セッション | 番号 | 状態 |
|---|---|---|
| a-review | review-4 | ✅ §20-23 適用済、整合確認 |
| a-auto-004 | auto-004-3 | ✅ §20-23 適用済 |
| a-forest-002 | forest-002-CLAUDE_MD_RECEIVED | ✅ §20-23 適用済、#2 着手予定 |
| a-bloom-004 | bloom-004- No. 55 | ✅ §20-23 適用済、main- No. 118 PowerShell 代行待機中 |
| a-root-002 | root-002-13 | ✅ §20-23 適用済、root-002-14 完走報告予約 |
| a-tree-002 | tree-17 | ✅ §20-23 適用済、参考 RTK 値提示 |
| a-leaf-002 | leaf-002-15 | ✅ §20-23 適用済、待機モード継続 |
| a-soil | soil-47 | ✅ §20-23 適用済、main- No. 125 指示待ち |

→ 8 件全 dispatch 不要（📋 確認のみ）、内部把握のみ。

横断 broadcast main- No. 127 応答状況: **9/12 受領済**（残 a-rill / a-seed / b-main / 作業日報セッション）。
