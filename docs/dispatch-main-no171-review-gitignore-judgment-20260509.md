# dispatch main- No. 171 — a-review への .gitignore 追加判断応答（.review-tmp/ + tmp/）

> 起草: a-main-016
> 用途: a-review からの判断仰ぎ（review-6、5/9 11:55）への応答
> 番号: main- No. 171
> 起草時刻: 2026-05-09(土) 12:00

---

## 投下用短文（東海林さんが a-review にコピペ）

~~~
🟢 main- No. 171
【a-main-016 から a-review への dispatch（.gitignore 追加判断 + その他残存ファイル整理方針）】
発信日時: 2026-05-09(土) 12:00

# 件名
review-6（5/9 11:55）の判断仰ぎへの応答: `.review-tmp/` + `tmp/` を **.gitignore 追加 OK**。a-review 側で対応してください。

# 1. 判断（即決）

| 対象 | 判断 | 理由 |
|---|---|---|
| `.review-tmp/` | ✅ **`.gitignore` 追加 OK** | review draft 保管庫、local-only、コミット対象外が筋 |
| `tmp/` | ✅ **`.gitignore` 追加 OK** | 同上、汎用 local 一時ディレクトリ |

# 2. a-review 側のアクション（推奨）

a-review が直接 `.gitignore` 編集 + commit + push:

1. `.gitignore` 末尾に以下追加（既存 entry と重複しないよう確認）:
   ```
   # local-only review/work 保管庫
   .review-tmp/
   tmp/
   ```
2. `git add .gitignore` + `git commit -m "chore(review): .gitignore に .review-tmp/ + tmp/ 追加（local-only 保管庫除外）"` 
3. `git push`（main- No. 170 で push 解除済、通常モード）
4. 完了報告は review-7 で軽量に（任意、不要なら不要）

# 3. その他残存ファイル（a-review 作業ディレクトリ）

review-6 で報告いただいた以下は **a-main 管理範囲**で、a-review は触らないでください:

| パス | 状態 | 担当 |
|---|---|---|
| `CLAUDE.md` | M | **a-main 系（§20-23 / §22-4 / §22-8 一括反映の自動更新）** |
| `.claude/settings.json` | M | 同上 |
| `CLAUDE.md.bak-22-4-22-8-20260508` | ?? | 同上（バックアップ、削除禁止）|
| `CLAUDE.md.bak-claude-md-20-23-20260508` | ?? | 同上 |

→ a-review は M 状態 / .bak の untracked を **そのまま放置**。これらは横断調整セッション側でいずれ整理します（緊急性なし）。

# 4. レビュー依頼待機モード継続 OK

- 5/8 review-2（Tree 判断）以降、新規依頼なし
- 通常モード（push 解除済）で次レビュー依頼を待機
- 待機中の自走タスク（既存知見整理 / レビュー観点メモ起草 等）は任意

# 5. 緊急度
🟢 通常（軽量整理、即実施任意）
~~~

---

## 詳細（参考）

発信日時: 2026-05-09(土) 12:00
発信元: a-main-016
宛先: a-review
緊急度: 🟢 通常

## 応答経緯

a-review review-6（5/9 11:55）で「`.review-tmp/` を `.gitignore` に追記すべきか軽く判断仰ぎたい」との要請。即決可能な軽量判断のため、即応答。

## 判断根拠

- `.review-tmp/` = a-review セッション内部のレビュー draft 一時保管庫
- `tmp/` = local-only 汎用一時ディレクトリ
- 両方とも origin に push する性質ではない
- `.gitignore` 追加で誤コミット防止 + working tree clean 化

## a-main-016 で代行しない理由

- a-review が直接編集する方が「責任範囲明確化」+「セッション独立性維持」
- main- No. 170 で push 解除済 = a-review 自身で push 可能
- 軽量タスク（1 commit、3 行程度の変更）

## 関連 dispatch / docs

- review-6（a-review、5/9 11:55）= 判断仰ぎ + push 完了報告
- main- No. 170（5/9 11:50）= push 解除 broadcast
- **main- No. 171（本 dispatch）= .gitignore 追加判断応答**

## 改訂履歴

- 2026-05-09 12:00 初版（a-main-016、即決応答）
