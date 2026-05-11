# a-main-020 完全リセット手順（018 / 019 廃止 → 020 で仕切り直し）

> 起草: a-main-017 + 東海林さん 議論成果（2026-05-09 23:30 〜 24:00）
> 対象: 018 信頼喪失 + 019 完全リセット採択 → 020 で 6+1 重防御 + a-memory 6a/6b ベースで仕切り直し
> 永続化: 017 セッション消滅後も本手順を Read で 020 起動可能

---

## §1 起動条件 + 背景

### 1-1 経緯

| 日時 | 出来事 |
|---|---|
| 5/9 23:00 | a-main-018 起動時に「ガンガン = skip OK」誤解で 8 件違反（リセット症状）|
| 5/9 23:00 過ぎ | 6 重防御確立、+ 017 + 東海林さん議論で改善 |
| 5/9 23:30 過ぎ | 018 ダメすぎて無理 = 引退決定 |
| 5/10 直前 | 018 が日付ジャンプ事故（最低限ルール違反）= 信頼喪失確定 |
| 5/9 23:50 | 019 起動 + テストラン成功確認、ただし「コピペ形式違反」等 3 件 |
| 5/9 23:50 過ぎ | 東海林さん判断「019 も完全リセット」= 020 で仕切り直し |

### 1-2 020 で達成する 4 つの柱

| 柱 | 内容 |
|---|---|
| 1 | **層 0 最低限ルール 8 項目を起動時から徹底** |
| 2 | **6+1 重防御**（3 層基本 + 4 層補助、a-analysis / a-audit 含む）|
| 3 | **a-memory 役割分割**（a-analysis 判断提案 001 / a-audit 監査 001）|
| 4 | **三点セット同期 v2 + 「Claudeへの指示」管理を a-analysis / a-audit が支援** |

---

## §2 worktree 作成手順（017 主導、本手順起草直後実施）

### 2-1 a-main-020

```
git worktree add C:/garden/a-main-020 -b workspace/a-main-020 origin/develop
```

### 2-2 a-analysis-001

```
git worktree add C:/garden/a-analysis-001 -b workspace/a-analysis-001 origin/develop
```

### 2-3 a-audit-001

```
git worktree add C:/garden/a-audit-001 -b workspace/a-audit-001 origin/develop
```

### 2-4 各 worktree に handoff / 設計書 / memory 同期

各 worktree で以下を実行:
```
git pull origin workspace/a-main-017
```

→ a-main-017 の最新 commit（handoff / 設計書 / memory 含む）が各 worktree に取り込まれる。

---

## §3 020 起動時のアクション（§0 必読 docs ロック実施）

### 3-1 起動コマンド（東海林さん作業）

```
新 PowerShell 起動 → cd C:\garden\a-main-020 → claude
```

### 3-2 §0 必読 docs ロック 8 項目（020 が即実施）

| # | 必読対象 | 完了確認返答 |
|---|---|---|
| 1 | handoff `a-main-019-to-020`（仮、本手順から派生）| 「Read 済」|
| 2 | governance-rules-v1（最新版） | 「Read 済」|
| 3 | **memory 最重要 27 件**（MEMORY.md 索引）| 「Read 済 + 層 0 最低限ルール 8 項目内化」|
| 4 | claudeai-instructions-snapshot + claudeai-procedures-snapshot | 「Read 済」|
| 5 | **a-memory 役割分割設計書 v1**（`docs/a-memory-role-split-design-v1-20260509.md`）| 「Read 済 + 6a/6b フロー内化」|
| 6 | handoff §A 重要決定（a-main-017 期 8 件）| 「内化確認、適用準備完了」|
| 7 | handoff §B 違反 + 再発防止策 + マッピング表 | 「再発防止策内化完了」|
| 8 | sentinel 5 項目通過 + 東海林さんに最終 GO 依頼 | 東海林さん明示 GO 待ち |

### 3-3 dispatch 起草ロック（東海林さん最終 GO 受領まで継続）

§0-1 # 8 完了 + 東海林さん「020 稼働 GO」明示まで dispatch 起草・即実行禁止。

---

## §4 a-analysis-001 / a-audit-001 起動順序

### 4-1 020 → a-analysis-001 起動指示

020 稼働 GO 受領後:
1. 020 が a-analysis-001 起動指示 dispatch 起草（main- No. NN）
2. 東海林さんが新 PowerShell で `cd C:\garden\a-analysis-001` → `claude`
3. a-analysis-001 が初期化（memory 全件 Read + キャッシュ作成、30-60 分）
4. a-analysis-001 が「初期化完了」を 020 に dispatch（analysis-001- No. 1）

### 4-2 020 → a-audit-001 起動指示（並行可）

a-analysis-001 と並行で起動可:
1. 020 が a-audit-001 起動指示 dispatch 起草
2. 東海林さんが新 PowerShell で `cd C:\garden\a-audit-001` → `claude`
3. a-audit-001 が初期化（同上）
4. a-audit-001 が「初期化完了」を 020 に dispatch（audit-001- No. 1）

### 4-3 各セッションの初期化動作

| セッション | 初期化内容 |
|---|---|
| a-analysis-001 | memory 全件 Read（50+ 件）+ キャッシュ作成（`docs/a-analysis-cache-YYYYMMDD.json`）+ 設計書 v1 §2-§7 内化 |
| a-audit-001 | memory 全件 Read + キャッシュ作成（`docs/a-audit-cache-YYYYMMDD.json`）+ 既存 snapshot との整合性 baseline 確立 + 事故パターン log 初期化（`docs/incident-pattern-log.md`）|

---

## §5 初回テスト dispatch（動作確認）

### 5-1 標準フロー動作確認

020 が軽微 memory 改訂依頼を発行:
1. 020 → a-analysis-001 dispatch（例: 「memory feedback_xxx の表現微調整」）
2. a-analysis-001 が改訂案起草 → analysis-001- No. NN で 020 報告
3. 020 → a-audit-001 dispatch（critique 依頼）
4. a-audit-001 が critique → audit-001- No. NN で 020 報告
5. 020 が修正版起草 → 東海林さん最終決裁
6. 東海林さん GO → 020 が memory ファイル登録

→ 全 6 ステップが 30-60 分で完走すれば動作確認 OK。

### 5-2 違反検出フロー動作確認

020 → a-audit-001 単独 dispatch（例: 「既存 memory 群の整合性 critique」）→ a-audit-001 が監査 → 020 報告。

→ 動作確認 OK なら稼働 GO。

### 5-3 緊急 bypass フロー動作確認

020 が typo 修正を main 単独編集 → a-audit-001 に即時報告 → a-audit-001 が「軽微 OK、流す」確認返答。

→ 動作確認 OK。

---

## §6 稼働 GO 判断

### 6-1 020 稼働 GO（東海林さん判断）

§3 §0 ロック 8 項目完了 + §4 a-analysis/audit 初期化完了 + §5 動作確認完了 → 東海林さん「020 稼働 GO」明示。

### 6-2 020 期 Garden 開発再開

020 稼働 GO 後:
- a-bloom-006 / a-bud-002 / a-soil-002 / a-leaf-002 / a-forest-002 等のモジュールセッションへの dispatch 投下再開
- ガンガンモード本質「全モジュール並列稼働 + 5h フル + 東海林作業時間無視」発動
- 30 分巡回チェック実施

---

## §7 トラブルシュート

### 7-1 worktree 作成失敗

| エラー | 原因 | 対処 |
|---|---|---|
| `branch already exists` | 既存ブランチ名衝突 | branch 名変更 or 既存 branch 削除（`git branch -D` は destructive、東海林さん確認後）|
| `worktree path already exists` | 既存ディレクトリ | ディレクトリ rename or 削除 |
| permissions denied | OS 権限 | 管理者権限で実行 |

### 7-2 §0 ロック未通過

東海林さん最終 GO 受領前に dispatch 起草しそうになったら:
- sentinel # 3「§0 ロック解除されてる？」で自動停止
- レベル 3 強度（人間ゲート）で東海林さん明示 GO 必須
- 失敗時フォールバック: `docs/section-0-bypass-log-YYYYMMDD.md` 記録 + 解除理由明記

### 7-3 a-analysis-001 / a-audit-001 起動失敗

| 状況 | 対処 |
|---|---|
| 初期化中に context 限界 | 別 PC で起動 or 初期化 docs 分割 Read |
| キャッシュ破損 | キャッシュ削除 + 再生成 |
| memory 全件 Read 中断 | 中断点から再開（git で commit 履歴確認）|

### 7-4 a-analysis / a-audit 認識ズレ（main 介入）

- 設計書 §4-6 不採択ログ永続化（`docs/audit-critique-rejected-log.md`）に記録
- 東海林さん最終決裁

---

## §8 020 期での運用ルール（要点再掲）

### 8-1 層 0 最低限ルール 8 項目（毎応答前必達）

1. 日付・時刻は system reminder 信頼
2. ファイル存在は ls 確認
3. 状態冒頭明示
4. 既存実装 3 トリガー
5. 提案・報告前 N ラウンド
6. 応答前 sentinel 5 項目
7. コピペ形式
8. system reminder 全体再読

### 8-2 ガンガンモード本質 v3（誤解禁止）

- 3 軸（全モジュール並列 / 5h フル / 東海林作業時間無視）= **東海林さん介在最小化**
- ≠ 規律 skip OK（規律は維持必須）
- 違反は層 0-1 で即検出、層 6b（a-audit）で事後 critique

### 8-3 dispatch flow（5 種）

- 標準（main → analysis → audit → main）
- 違反検出（main → audit → main）
- 事故報告（即時、main → audit）
- 緊急 bypass（main 単独 + audit 報告義務）
- Claudeへの指示管理（analysis 起草 + audit 整合 critique）

---

## §9 改訂履歴

- 2026-05-09 24:00 v1 初版（a-main-017、020 完全リセット手順、慎重モードで起草）

---

## §10 020 起動後の最初のメッセージ（東海林さん向け、想定）

020 が起動完了 + §0 ロック 8 項目通過後、東海林さんへ以下のメッセージを送る想定:

```
[稼働中、§0 ロック 8 項目完了、東海林さん最終 GO 待ち]

# a-main-020 起動完了報告

§0 ロック 8 項目すべて Read + 内化確認完了:
- handoff Read 済
- governance Read 済
- memory 最重要 27 件 + 層 0 最低限ルール 8 項目内化
- claudeai snapshot Read 済
- a-memory 役割分割設計書 v1 内化（6a/6b フロー把握）
- §A 重要決定 8 件 + §B 違反 5 件 内化
- sentinel 5 項目通過

東海林さんの「稼働 GO」明示で:
1. a-analysis-001 起動指示 dispatch
2. a-audit-001 起動指示 dispatch
3. 動作確認テスト（§5）実施
4. Garden 開発再開

GO お願いします。
```

→ 東海林さんが「稼働 GO」明示 → 020 期始動。
