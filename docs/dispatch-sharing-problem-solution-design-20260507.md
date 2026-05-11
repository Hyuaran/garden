# dispatch ファイル共有問題 解決策設計 - 2026-05-07(木) 21:20

> 起草: a-main-014
> 用途: dispatch ファイルが workspace/a-main-NNN 固有ブランチに push される運用課題の解決策起草
> 関連 issue: handoff §「注意点」#1（a-root-002 root-002-5 で指摘）
> ステータス: 設計提案、東海林さん判断後に実装

---

## 1. 課題（再掲）

### 1-1. 現状

- a-main-NNN は dispatch ファイル（`docs/dispatch-main-no*-*.md`）を **`workspace/a-main-NNN` ブランチ**に push
- 各モジュールセッションは自モジュール用ブランチ（`feature/<module>-*` 等）にいる
- `git fetch --all` 後でも、`develop` や `main` から grep すると dispatch ファイル未検出
- 受信モジュール側で「dispatch ファイル どこ？」となるケース発生（root-002-5 指摘）

### 1-2. 91 ファイルが workspace 系に散在

`docs/dispatch-main-no*.md` は 91 ファイル（main- No. 1-111 の累計）。
最新の workspace/a-main-014 には全部が乗っているが、a-main-013 / 012 / 011 等の workspace に分散。

### 1-3. 現状の workaround（handoff 記載）

```
git fetch --all
git show origin/workspace/a-main-013:docs/dispatch-main-no99-...md
```

- 受信側が「どの workspace/a-main-NNN に乗っているか」を知る必要あり
- 認知コスト高、検索が困難

---

## 2. 解決策候補（4 案）

### X 案: develop / main へのマージ

**方法**:
- a-main-NNN は dispatch を `workspace/a-main-NNN` で起草
- 区切りで `develop` にマージ（dispatch ファイルのみ cherry-pick or 全体 PR）

**メリット**:
- 各セッションは `develop` ベースで grep すれば確実に発見
- 既存 workflow 親和性高（develop は共通参照ブランチ）

**デメリット**:
- マージ頻度が高すぎると develop が騒がしくなる
- 1 dispatch あたり 1 PR は overkill、まとめてマージ要
- マージタイミング判断必要

**評価**: 🟢 **本命候補**、ただしマージ頻度設計が必要

---

### Y 案: Drive 共有（手動コピー or 自動 sync）

**方法**:
- dispatch ファイルを Google Drive `_chat_workspace/garden-dispatches/` に並行配置
- a-main-NNN は push と同時に Drive にコピー（手動 or 自動 sync）

**メリット**:
- 各セッションは Drive 経由で全 dispatch にアクセス可能
- git ベースで縛られない、東海林さんも Drive UI で参照可能

**デメリット**:
- 二重管理（git + Drive）、整合性リスク
- 自動 sync 仕組み（rclone / 手動 cp）必要、Windows 環境で安定動作未確認
- markdown link が効かない（git ベースのリンクが Drive で開けない）

**評価**: 🟡 補助手段、メイン解決策には弱い

---

### Z 案: dispatch 専用ブランチ

**方法**:
- `docs/dispatches` ブランチを新設
- 全 a-main-NNN は dispatch ファイルのみ ここに push（fast-forward）
- 各モジュールセッションは `git fetch --all` + `git show origin/docs/dispatches:docs/dispatch-main-no*.md`

**メリット**:
- dispatch のみ集約、コード変更と分離
- ブランチ命名で「dispatches」と明示、検索容易

**デメリット**:
- 新ブランチ運用ルール追加（学習コスト）
- 複数 a-main-NNN が同時に push する場合 conflict リスク
- 既存 workspace/a-main-NNN ブランチとの整合性管理コスト

**評価**: 🟡 中立、運用ルール追加コストが発生

---

### W 案: workspace 命名統一 + 周知強化

**方法**:
- 現状維持（workspace/a-main-NNN に push）
- 各モジュールセッション CLAUDE.md に「dispatch 取得手順」を追記
- 取得手順:
  ```
  git fetch --all
  git show origin/workspace/a-main-014:docs/dispatch-main-no101-*.md
  ```

**メリット**:
- 実装変更なし、即時適用可能
- ブランチ命名規則は既に統一されている（workspace/a-main-NNN）

**デメリット**:
- 認知コスト残る（NNN を知る必要あり）
- 過去 a-main-001-013 の dispatch 取得時に NNN 判定難
- 結局 Z 案や X 案より検索性低い

**評価**: 🟢 即時適用可、ただし根本解決ではない

---

## 3. 比較表

| 案 | 実装コスト | 学習コスト | 検索性 | 整合性リスク | 即時性 | 評価 |
|---|---|---|---|---|---|---|
| **X: develop マージ** | 中（マージ手順追加）| 低（既存 workflow）| ⭐⭐⭐ | 低 | 高 | 🟢 **本命** |
| Y: Drive 共有 | 中-高（sync 実装）| 中 | ⭐⭐ | 中（二重管理）| 中 | 🟡 補助 |
| Z: 専用ブランチ | 低（ブランチ作成）| 中（新ルール）| ⭐⭐ | 中（conflict）| 中 | 🟡 中立 |
| W: 命名統一 + 周知 | ゼロ | 中（手順学習）| ⭐ | ゼロ | 即時 | 🟢 即時策 |

---

## 4. 推奨（折衷案）

### 短期（5/8-5/13、5/14-16 デモまで）: W 案

- 各モジュール CLAUDE.md に dispatch 取得手順を追記（5/8 朝の起動 dispatch 7 件にも明記済）
- 実装ゼロ、即時適用
- 5/14-16 デモまでこのまま運用

### 中期（5/14-16 デモ後、post-デモ運用整理）: X 案

- a-main-NNN セッション切替時 or 1 日 1 回、dispatch ファイル群を **`develop` にマージ**
- マージ専用 PR（`chore(docs): dispatch backfill YYYY-MM-DD`）
- バッチで 5-10 件まとめて、PR 1 件で
- 各モジュールは `develop` ベースで grep 可能になる

### 長期（後追い）: Y 案 補助

- Drive `_chat_workspace/garden-dispatches/` にも並行配置（過去分も後追い）
- 東海林さんが UI で全 dispatch を時系列で確認可能
- コード補助、git ベースを置き換えない

---

## 5. 実装ステップ（X 案中期、5/14-16 デモ後）

### Step 1: マージタイミング設計

- セッション切替時（a-main-NNN → a-main-NNN+1 引き継ぎ時）に handoff と同梱で develop マージ
- 例: a-main-014 → 015 切替時に `chore(docs): dispatch backfill main- No. 101-130` PR 起票

### Step 2: マージスクリプト準備

```bash
# a-main-NNN 切替時
git checkout develop
git pull origin develop
git checkout -b chore/dispatch-backfill-YYYYMMDD
git checkout workspace/a-main-NNN -- docs/dispatch-main-no*.md docs/dispatch-counter.txt docs/handoff-*.md
git commit -m "chore(docs): dispatch backfill main- No. NN-MM"
git push origin chore/dispatch-backfill-YYYYMMDD
gh pr create --base develop --title "chore(docs): dispatch backfill main- No. NN-MM" --body "..."
```

### Step 3: 各モジュール CLAUDE.md 更新

- 「dispatch ファイルは `develop` から取得可」と明記
- 取得コマンド例を併記

### Step 4: 過去 dispatch（main- No. 1-100 等）の後追いマージ

- a-main-013 までの分は `workspace/a-main-013` に既に集約されているはず
- 1 PR で全部 develop に流す（巨大だが運用上一度きり）

---

## 6. 即時適用（短期 W 案）の dispatch 追記文例

5/8 朝の起動 dispatch（main- No. 102-108）には以下を追記すれば即時適用可能:

~~~
## dispatch ファイル取得手順（再掲）

dispatch ファイルは `workspace/a-main-014` ブランチに push されています。
各セッションでの取得方法:

```
git fetch --all
git show origin/workspace/a-main-014:docs/dispatch-main-no101-bud-d11-thursday-night-continue-20260507.md
```

または:

```
git fetch --all origin workspace/a-main-014
git checkout origin/workspace/a-main-014 -- docs/dispatch-main-no101-bud-d11-thursday-night-continue-20260507.md
# 該当ファイルを read で確認後、git restore で取り消し（自モジュールブランチを汚さない）
git restore --staged docs/dispatch-main-no101-bud-d11-thursday-night-continue-20260507.md
git restore docs/dispatch-main-no101-bud-d11-thursday-night-continue-20260507.md
```

5/14-16 デモ後に develop マージ運用に切替予定です（CLAUDE.md 改訂時）。
~~~

→ 5/8 朝起動 dispatch 7 件には既に「詳細は以下ファイル参照」で markdown link を入れているが、取得手順は明記していない。明記推奨。

---

## 7. CLAUDE.md 改訂候補（post-5/14-16 デモ）

§13 / §14 / §19 等のどこかに「§20 dispatch ファイル運用」セクション新設:

- 起草先: `workspace/a-main-NNN`
- 共有: 区切りで `develop` にマージ（X 案）
- 取得: `develop` から grep で発見可能
- 過去分: Drive `_chat_workspace/garden-dispatches/` 補助参照（Y 案）

---

## 8. 東海林さん判断仰ぎ

| # | 質問 | 推奨 |
|---|---|---|
| 1 | 短期 W 案（5/8 朝 dispatch に取得手順追記）即時適用 OK? | ✅ OK |
| 2 | 中期 X 案（5/14-16 デモ後 develop マージ運用切替）方針 OK? | ✅ OK |
| 3 | 長期 Y 案（Drive 補助配置）必要? | ⏸ 後決定 |
| 4 | CLAUDE.md §20 新設 起草開始 OK?（5/14-16 デモ後）| ✅ OK |

---

## 9. リスク

- X 案の develop マージ頻度が低すぎると、デモまでの間 W 案の認知コスト残存
- a-main-NNN 切替が短期間（1-2 日）で起きるため、毎回マージは現実的
- マージ PR 集積で develop が騒がしくなる懸念 → PR タイトル `chore(docs):` で識別容易、騒がしさ最小化

---

## 10. 関連 docs

- handoff-a-main-013-to-014-20260507.md §「注意点」#1
- root-002-5 指摘（dispatch ファイル未存在報告、a-main-013 が workaround 提示）
- CLAUDE.md §11 横断調整セッション運用
- 過去 dispatch 91 ファイル（docs/dispatch-main-no1-no111）
