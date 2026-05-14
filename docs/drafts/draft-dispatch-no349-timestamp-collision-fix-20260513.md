# Draft dispatch # 349 — 5/13 migration timestamp 衝突解消（#171 / #174 ダブり）

> 起草: a-main-026（2026-05-13(水) 15:14 JST、handoff §2 Action 4）
> 投下先: **a-root-003**（#174 元起票セッション）
> 清書担当: a-writer-001（dispatch v6 規格化）
> 緊急度: 🟢（本番 apply 済 + 影響ゼロ、CLI 導入時の silent NO-OP 罠予防のみ）

---

## 1 件名

`chore(root): migration timestamp 衝突解消 — root_can_helpers_to_has_role_at_least を 20260513000006 に rename（#171 / #174 ダブり、dispatch # 349）`

---

## 2 衝突の物理事実（origin/develop 検証済 5/13 15:13 JST）

```
$ git ls-tree -r origin/develop --name-only | grep "supabase/migrations/2026051" | sort

20260513000001_rename_bud_bank_to_root_bank.sql                ← PR #171 (mergedAt 01:53:01Z)
20260513000001_root_can_helpers_to_has_role_at_least.sql       ← PR #174 (mergedAt 01:53:09Z) ★衝突
20260513000002_cross_rls_helpers_deleted_at_filter.sql         ← PR #173
20260513000003_bud_shiwakechou_b_min.sql                       ← PR #172 forest m3
20260513000004_bud_corporations_accounts_seed.sql              ← PR #172 forest m4
20260513000005_bud_master_rules_seed.sql                       ← PR #172 forest m5
```

**衝突 1 件のみ**: `20260513000001_*` が 2 ファイル存在。
- PR #171（先 merge、8 秒差）: bank rename
- PR #174（後 merge）: has_role_at_least wrapper 化 → これを rename 対象に選定

---

## 3 採番プラン（推奨 A 案、最小手）

### 選択肢

| 案 | 内容 | メリット | デメリット | 推奨 |
|---|---|---|---|---|
| **A 案 ★** | **#174 のみを `20260513000006` に rename**（forest m5 の次、5/13 系列の連続最終番号） | 触る 1 ファイル / 本番影響ゼロ / 連番完成 | — | ★ |
| B 案 | #174 を `20260513000010` 等の余裕番号に rename | 将来 5/13 系列追加余裕 | 番号飛び不整合 | — |
| C 案 | 5/13 全 6 ファイルを merge 順 / apply 順で連番再整理 | 完璧な順序整合 | forest m3/m4/m5 既 merge 済を git history 改変 = 危険 | NG |

### 推奨理由（A 案）

- **触る範囲最小**: 1 ファイル rename のみ
- **本番 DB 影響ゼロ**: 既に手動 apply 済の SQL ファイル名のみ変更、内容は不変
- **連番完成**: 5/13 系列が `000001`〜`000005` + 新 `000006` で連続
- **#348 (memo 列 ALTER) との連動**: 推奨 timestamp `20260513000007` で 5/13 系列 7 連番完成（draft # 348 §4.2 を更新する）

---

## 4 a-root-003 がやること（実装フロー）

### 4.1 rename 実行

```powershell
# 作業ブランチ作成（develop ベース）
git fetch origin develop --quiet
git checkout -b feature/root-migration-timestamp-renumber-20260513 origin/develop

# git mv で rename（git history --follow で追跡可能）
git mv supabase/migrations/20260513000001_root_can_helpers_to_has_role_at_least.sql `
       supabase/migrations/20260513000006_root_can_helpers_to_has_role_at_least.sql
```

### 4.2 ファイル冒頭コメント更新（任意推奨）

migration ファイル冒頭に rename 経緯を追記:

```sql
-- [NOTE] dispatch # 349 (2026-05-13) で 20260513000001 → 20260513000006 に rename
-- 理由: PR #171 (rename_bud_bank_to_root_bank.sql) と timestamp 衝突発生のため
-- 本番 DB には影響なし（既に 5/13 朝 a-main-025 が手動 apply 済）
```

### 4.3 commit + PR

```
git add supabase/migrations/
git commit -m "chore(root): migration timestamp 衝突解消 — root_can_helpers を 20260513000006 に rename

PR #171 と #174 が同じ timestamp 20260513000001 を採用していた衝突を解消。
本番 DB には影響なし（手動 apply 済の SQL ファイル名のみ rename）。
将来 Supabase CLI 導入時の silent NO-OP 罠予防。

dispatch # 349 (a-main-026)
related: handoff-026.md §0 遺言 2 / Next Action 4
related memory: feedback_migration_timestamp_collision

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

git push -u origin feature/root-migration-timestamp-renumber-20260513
gh pr create --base develop --title "chore(root): migration timestamp 衝突解消 — #174 を 20260513000006 に rename (dispatch # 349)" --body "<§2 衝突事実 + §3 A 案 + §4 実装フロー を記載>"
```

### 4.4 merge 後の対応（重要）

- **本番 apply は不要**（file rename のみ、SQL 内容変更なし、DB 影響ゼロ）
- PR comment に明記:
  ```
  ✅ rename 完了 (a-root-003, 2026-05-13 HH:MM JST)
  - 種別: SQL ファイル名 rename only
  - 本番 apply: 不要（手動 apply 済の SQL ファイル名のみ rename、SQL 内容不変）
  - 検証: git log --follow で history 追跡可能確認
  - 検証者: a-root-003
  ```

---

## 5 #348 (memo 列追加) との連動

draft # 348 §4.2 で推奨した timestamp `20260513000040` を、本 # 349 完了後は **`20260513000007`** に変更すべき。

理由: 5/13 系列の連番が #349 完了後 `000006` まで埋まる → #348 は `000007` で連続最終。

**更新タイミング**: # 349 merge 完了後、a-main-026 が draft # 348 を編集して timestamp を更新（または # 348 が a-forest-002 起票時に最新状態を ls 確認して採番）。

---

## 6 関連 memory（必読）

- `feedback_migration_timestamp_collision.md` — 同日複数 migration の timestamp 重複は CLI 導入時 silent NO-OP、起票前 ls 確認必須
- `feedback_rebase_feature_change_approval.md` — chore commit のみ、機能変更なし（commit 規約遵守）
- `feedback_check_existing_impl_before_discussion.md` — 修正前の grep + Read + git log + import 追跡

---

## 7 想定所要時間

- a-root-003 が本 draft 投下を受領後、git mv → commit → PR → merge まで **15〜20 分**
- merge 後の本番 apply 不要のため、検証ステップは git log --follow 確認のみ

---

## 8 a-writer-001 への清書依頼ポイント

- v6 規格（投下先 / 緊急度 / dispatch 番号 / 添付有無 / 期待アクション 先頭明示）
- 本文は §2 衝突事実 / §3 推奨 A 案 / §4 a-root-003 実装フロー / §5 #348 連動を集約
- a-root-003 への投下用短文（投下情報先頭 + コピペ md パスのみ）

---

EOF
