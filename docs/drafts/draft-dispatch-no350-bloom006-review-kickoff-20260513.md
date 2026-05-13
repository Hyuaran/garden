# [起草案 ★main review 必要、未確定多数] dispatch # 350 — a-bloom-006 PR review 起票

> 起草: a-writer-001（**通常 scope 外、東海林さん明示指示によるドラフト起草**）
> 起草時刻: 2026-05-13(水) 15:18 JST（powershell.exe Get-Date 取得済、UTF-8 明示）
> 清書担当: a-writer-001（main 補正 + 内容確定後、自分で清書）
> 用途: handoff-026.md §2 Next Action 5「a-bloom-006 PR review 起票（main- No. 341 予定だった分）」
> 投下先: **a-bloom-006**
> 緊急度: 🟢 低（handoff-026.md §2 と一致）

---

## ⚠️ a-writer-001 注記（main 026 への申し送り、要補正項目多数）

| 項目 | 内容 |
|---|---|
| 起草の経緯 | 東海林さん 2026-05-13 15:13 直接指示「Action 4 / 5 のドラフト起草を開始せよ」|
| **§11 大原則 関連、最重要** | 本件は handoff-026.md §2 Action 5 で「main- No. 341 予定だった分」とのみ記述、**review 対象 PR / 観点 / 期待アウトプット 全て未確定**。a-writer-001 が推測で埋めると §11 違反になるため、skeleton + TBD マークで起草 |
| review 必要点 | main-026 が以下「未確定」セクションを補正 → 確定値を渡してから清書依頼に切替えてください |

---

## 1. 件名（候補、TBD）

`review(bloom): a-bloom-006 PR review 起票（対象 PR 群 TBD、main- No. 350）`

---

## 2. 背景（既知の客観事実のみ）

### 2.1 a-main-024 期で発生していた未起票

handoff-026.md §2 Next Action 5 より:
> a-bloom-006 PR review 起票（main- No. 341 予定だった分）

main- No. 341 は a-main-024 期で予定されていた dispatch 番号。**実際には起票されず**、024 期最終 # 344、025 期 # 345 から # 347、026 期 # 348 と進んだ結果、**未消化のまま** 026 期に持ち越し。

### 2.2 Bloom モジュールの現状（handoff-026.md §1 より）

| 項目 | 状態 |
|---|---|
| Bloom 状態 | 🟢 累計 24 PR review 完走 + plan 6/6 全件採用推奨 |
| 直近 | Phase A-2.2 着手判断待ち |

### 2.3 未確定情報（main 026 補正必要）

| # | 未確定項目 | 推測候補（参考、main 確定必要）| 確定後の反映先 |
|---|---|---|---|
| 1 | review 対象 PR 番号 | 24 PR review 完走後の **次の 25 件目以降**？ それとも別系統？ | §3 依頼内容 |
| 2 | review 観点 | 直近 Bloom plan 6/6 採用済の影響評価？ Phase A-2.2 着手前の整理？ | §3 やってほしいこと |
| 3 | 期待アウトプット | PR review コメント？ 採用 / 却下推奨？ 改善提案 md？ | §4 完了条件 |
| 4 | a-bloom-006 セッションの起動状態 | 起動済 / これから起動？ | 投下経路 |
| 5 | 緊急度 🟢 でよいか | handoff §2 では 🟢、後道さん 5/13 仕訳帳 UI 確認 (§2 Action 8) との優先順位 | メタ情報 |
| 6 | 想定所要時間 | TBD | §6 |
| 7 | 関連 PR 一覧 | TBD（main が gh pr list で抽出 or 既知）| §2 背景 |

---

## 3. 依頼内容（skeleton、TBD 多数）

### 3.1 a-bloom-006 がやること（仮、main 補正必要）

1. 対象 PR 群（TBD）の review
2. review 観点（TBD）に沿った評価
3. 結果アウトプット（TBD）の作成
4. a-main-026 への完了報告

### 3.2 関連 memory（既知範囲）

- `feedback_strict_recheck_iteration.md`（厳しい目で再確認 3 ラウンド）
- `feedback_check_existing_impl_before_discussion.md`（修正前確認 v2）
- 他 Bloom 関連 memory が a-bloom-006 起動時必読 docs に含まれているはず（要確認）

---

## 4. 完了条件（skeleton、TBD）

- 対象 PR の review 完了（件数 TBD）
- アウトプット形式（TBD）で main 026 へ提出
- 想定所要時間: TBD

---

## 5. 制約（既知）

- a-bloom-006 セッション以外で本件を扱わない（セッション分離原則）
- 詰まったら即停止 → a-main-026 へ状況報告
- commit メッセージに `[a-bloom-006]` タグを含める

---

## 6. main 026 への補正依頼（清書依頼前に必須）

main 026 が以下 7 項目を確定して a-writer に渡してください。確定後、本起草案を清書依頼として正式 dispatch # 350 に整形します。

| # | 確定が必要な項目 | 確定方法の例 |
|---|---|---|
| 1 | review 対象 PR 番号一覧 | `gh pr list --search "bloom"` で抽出 or main 既知 |
| 2 | review 観点 | Phase A-2.2 着手判断材料 / 採用推奨 plan 6/6 影響評価 / 他 |
| 3 | 期待アウトプット形式 | PR コメント / md レポート / 採否推奨 / 改善提案 |
| 4 | a-bloom-006 起動状態確認 | 東海林さん経由で確認 |
| 5 | 緊急度確定 | 🟢 で確定 or §2 Action 8 後道さん UI 確認との優先関係 |
| 6 | 想定所要時間 | review 件数 × 1 件あたり想定で算出 |
| 7 | dispatch 番号 # 350 で正しいか | # 348 → # 349 (Action 4) → # 350 (本件) で連番 |

---

## 7. main 確認後の清書フロー

1. main 026 が本起草案を review、§6 7 項目を確定
2. main が「`<draft path> を読んで dispatch # 350 として清書せよ。確定情報は以下: ...」と私に指示
3. 私が v6 規格で清書 → 投下用短文 → 東海林さん経由 a-bloom-006 投下
4. a-bloom-006 が review 実施 → 完了報告
