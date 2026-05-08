# 許可リスト棚卸し 提案 - 2026-05-08(金) 12:30

> 起草: a-main-014
> 用途: CLAUDE.md §14 許可リスト棚卸し（13 日経過、自動発動）の提案レポート
> Scan 対象: ~/.claude/projects/*.jsonl 直近 50 セッション（4/25 棚卸し以降）
> Scan 結果: 3,898 Bash commands / 160 unique normalized
> 生 scan: [docs/permission-review-result-20260508.md](docs/permission-review-result-20260508.md)

---

## 1. サマリ

| 区分 | 件数 | 提案 |
|---|---|---|
| 昇格候補（safe + 既存 allow 外 + 3+ 回）| 22 件 | **15 件 即昇格推奨** |
| deny 強化候補（destructive + 既存 deny 外）| **0 件** | ✅ 既存 deny 充分 |
| 保留（uncertain + 3+ 回）| 33 件 | 7 件は条件付き昇格、26 件は保留 |

→ **15 件昇格** + **deny 強化なし**を推奨。

---

## 2. 昇格推奨（15 件、非破壊・3 回以上、確信度 高）

| # | パターン | 回数 | 判定 | 理由 |
|---|---|---|---|---|
| 1 | `Bash(ls *)` | 475 | 🟢 即昇格 | 純粋 read、最頻出、確認の defacto |
| 2 | `Bash(grep *)` | 211 | 🟢 即昇格 | 純粋 read、ファイル名検索等で Grep tool と棲み分け |
| 3 | `Bash(echo *)` | 131 | 🟢 即昇格 | 純粋出力、副作用なし |
| 4 | `Bash(git log --oneline *)` | 85 | 🟢 即昇格 | 純粋 read、コミット履歴確認 |
| 5 | `Bash(git status *)` | 80 | 🟢 即昇格 | 純粋 read、最頻出の状態確認 |
| 6 | `Bash(cat *)` | 70 | 🟢 即昇格 | 純粋 read、Read tool との棲み分け |
| 7 | `Bash(wc *)` | 53 | 🟢 即昇格 | 純粋 read、行数カウント |
| 8 | `Bash(pwd *)` | 36 | 🟢 即昇格 | 純粋 read、カレント確認 |
| 9 | `Bash(tail *)` | 34 | 🟢 即昇格 | 純粋 read、ログ末尾確認 |
| 10 | `Bash(git diff *)` | 13 | 🟢 即昇格 | 純粋 read、変更確認 |
| 11 | `Bash(head *)` | 11 | 🟢 即昇格 | 純粋 read、ファイル冒頭確認 |
| 12 | `Bash(git log --all *)` | 11 | 🟢 即昇格 | 純粋 read、全 branch ログ |
| 13 | `Bash(npm test -- *)` | 10 | 🟢 即昇格 | テスト実行、副作用なし |
| 14 | `Bash(git show --stat *)` | 9 | 🟢 即昇格 | 純粋 read、コミット差分確認 |
| 15 | `Bash(git ls-remote *)` | 6 | 🟢 即昇格 | 純粋 read、リモートブランチ一覧 |

### 14 箇所の settings.json 一括反映用 JSON 片

```json
"allow": [
  ...既存パターン...,
  "Bash(ls *)",
  "Bash(grep *)",
  "Bash(echo *)",
  "Bash(git log --oneline *)",
  "Bash(git status *)",
  "Bash(cat *)",
  "Bash(wc *)",
  "Bash(pwd *)",
  "Bash(tail *)",
  "Bash(git diff *)",
  "Bash(head *)",
  "Bash(git log --all *)",
  "Bash(npm test -- *)",
  "Bash(git show --stat *)",
  "Bash(git ls-remote *)"
]
```

---

## 3. 条件付き昇格（保留 33 件のうち 7 件、要相談）

| # | パターン | 回数 | 判定 | 理由 |
|---|---|---|---|---|
| 1 | `Bash(curl *)` | 96 | 🟡 慎重昇格 | 外部 HTTP、本番 API 叩く可能性。**読み取り限定**で OK?（curl -s -o /dev/null 等）|
| 2 | `Bash(sleep *)` | 29 | 🟢 昇格 OK | 単純待機、副作用なし |
| 3 | `Bash(until *)` | 27 | 🟢 昇格 OK | bash ループ、内部コマンドは別途チェック |
| 4 | `Bash(netstat *)` | 17 | 🟢 昇格 OK | 純粋 read、ポート確認 |
| 5 | `Bash(git -C *)` | 17 | 🟢 昇格 OK | git のディレクトリ指定実行（既存 `git *` allow 拡張） |
| 6 | `Bash(sed -n *)` | 13 | 🟡 慎重昇格 | sed -n（read mode）のみ OK、`sed -i` は deny 必要 |
| 7 | `Bash(git ls-tree *)` | 13 | 🟢 昇格 OK | 純粋 read、tree 一覧 |

→ **東海林さん判断仰ぎ**: 7 件昇格 OK?

---

## 4. 保留（26 件、当面継続的にプロンプト対応）

頻出だが昇格判断には個別検討必要なパターン。集計のみ、settings 変更なし。

| # | パターン | 回数 | 保留理由 |
|---|---|---|---|
| 1 | `Bash(cd *)` | 661 | shell 内 cd は permission system 対象外（実際には別コマンドの一部）|
| 2 | `Bash(git push *)` | 51 | 既に `git push origin chore/*` 等 allow 済、汎用 allow は develop/main へのリスク |
| 3 | `Bash(for *)` | 42 | bash for ループ、内部コマンド別途チェック |
| 4 | `Bash(# *)` | 32 | コメント行（コマンドではない）、誤集計 |
| 5 | `Bash(npx *)` | 25 | npx vitest 等、個別 allow（`npx tsc` 等）が既存 |
| 6 | `Bash(mv *)` | 15 | ファイル移動、broad allow は誤削除リスク |
| 7 | `Bash(rm *)` | 7 | **既に deny 済**、集計上残存（適用前セッション or deny エラー）|
| 8 | `Bash(npm install *)` | 4 | **既に deny 済**、メモリで運用 |
| 9 | `Bash(git reset *)` | 5 | `git reset --hard` は deny 済、`--soft` は別途検討 |
| 10 | `Bash(git stash push *)` | 4 | stash は読み戻し可、副作用小だが昇格判断は個別 |
| 11 | (その他、集計参照) | 各 3-11 | 個別検討が必要 |

---

## 5. deny 強化（0 件）

既存 deny 設定（rm / git reset --hard / git push --force / npm install / pip install / Remove-Item 等）が **直近 50 セッションで遭遇する破壊系を網羅**。新たな deny 強化は不要。

---

## 6. 実施手順（東海林さん承認後）

### Step 1: 14 箇所の settings.json 一括更新

対象パス（推定）:
- C:/Users/shoji/.claude/settings.json（global）
- C:/garden/a-main-014/.claude/settings.json（このプロジェクト）
- C:/garden/a-soil/.claude/settings.json
- C:/garden/a-root/.claude/settings.json
- C:/garden/a-tree/.claude/settings.json
- C:/garden/a-leaf-002/.claude/settings.json
- C:/garden/a-bud/.claude/settings.json
- C:/garden/a-bloom-004/.claude/settings.json
- C:/garden/a-forest-002/.claude/settings.json
- C:/garden/a-rill/.claude/settings.json
- C:/garden/a-seed/.claude/settings.json
- C:/garden/a-auto-004/.claude/settings.json
- C:/garden/b-main/.claude/settings.json
- G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/.claude/settings.json

### Step 2: タイムスタンプ更新

```
G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/.claude/last-permission-review.txt
→ 2026-05-08 に更新
```

### Step 3: 履歴ログ追記

```
G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/.claude/permission-review-log.md
```

### Step 4: 反映後の各セッション再起動 or 手動リロード

各モジュールセッションは settings.json 変更を反映するため再起動推奨（Thursday 夜次回起動時）。

---

## 7. 東海林さん判断仰ぎ

| # | 質問 | 推奨 |
|---|---|---|
| 1 | 昇格 15 件（§2）即実施 OK? | ✅ |
| 2 | 条件付き 7 件（§3）昇格 OK?（curl / sleep / until / netstat / git -C / sed -n / git ls-tree）| ✅ |
| 3 | 保留 26 件は当面継続的にプロンプト対応で OK? | ✅ |
| 4 | 14 箇所一括反映、a-main-014 自走 OK?（Python スクリプト書いて適用）| 🟢 |
| 5 | 反映後、各セッションへ「settings.json 変更反映のため再起動推奨」横断 broadcast 必要? | 🟢 |

---

## 8. 関連 docs

- 生 scan: [docs/permission-review-result-20260508.md](docs/permission-review-result-20260508.md)
- スキャンスクリプト: [docs/scripts/permission-review-scan.py](docs/scripts/permission-review-scan.py)
- CLAUDE.md §14 許可リスト棚卸し運用
- 履歴ログ: G:/マイドライブ/.../01_東海林美琴/.claude/permission-review-log.md
