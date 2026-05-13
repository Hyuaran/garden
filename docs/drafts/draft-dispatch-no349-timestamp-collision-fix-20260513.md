# [起草案 ★main review 必要] dispatch # 349 — 5/13 系 migration timestamp 衝突 ローカル修正

> 起草: a-writer-001（**通常 scope 外、東海林さん明示指示によるドラフト起草**）
> 起草時刻: 2026-05-13(水) 15:18 JST（powershell.exe Get-Date 取得済、UTF-8 明示）
> 清書担当: a-writer-001（main 承認後、自分で清書）
> 用途: handoff-026.md §2 Next Action 4「timestamp 衝突 #171/#174 のローカル修正」
> 投下先: **a-root-003**
> 緊急度: 🟢 低（本番 apply 済で実害なし、CLI 導入時の予防）

---

## ⚠️ a-writer-001 注記（main 026 への申し送り）

| 項目 | 内容 |
|---|---|
| 起草の経緯 | 東海林さん 2026-05-13 15:13 直接指示「Action 4 / 5 のドラフト起草を開始せよ」|
| 通常 scope | a-writer-001 は清書 / 規格番人、draft 起草は本来 main 担当（AGENTS.md §0 + handoff-026.md §0 遺言 1）|
| 一時逸脱の根拠 | 東海林さん明示指示（CLAUDE.md「User's explicit instructions」最優先）|
| review 必要点 | main-026 が以下を確認 → 補正 → 清書依頼に切替えてください |
| 客観事実 | git log で取得済（推測なし、§11 大原則準拠）|

---

## 1. 件名（候補）

`refactor(root): 5/13 系 migration timestamp 衝突 ローカル修正（PR #174 を 20260513000006 に renumber）`

---

## 2. 背景（客観事実、git log で検証済）

### 2.1 衝突状態の物理事実

a-main-026 worktree の `supabase/migrations/` 配下 5/13 系一覧（2026-05-13 15:18 時点）:

| timestamp | ファイル | 由来 PR | 状態 |
|---|---|---|---|
| `20260513000001` | `_rename_bud_bank_to_root_bank.sql` | PR #171 | 本番 apply 完了（10:27:47 commit `80fc8e9`、apply by a-main-025 11:30 JST）|
| `20260513000001` | `_root_can_helpers_to_has_role_at_least.sql` | PR #174 | 本番 apply 完了（10:28:20 commit `52e7cba`、apply by a-main-025）⚠️ **衝突** |
| `20260513000002` | `_cross_rls_helpers_deleted_at_filter.sql` | PR #173 | 本番 apply 完了 |
| `20260513000003` | `_bud_shiwakechou_b_min.sql` | Forest m3 | 本番 apply 完了 |
| `20260513000004` | `_bud_corporations_accounts_seed.sql` | Forest m4 | 本番 apply 完了 |
| `20260513000005` | `_bud_master_rules_seed.sql` | Forest m5 | 本番 apply 完了 |

### 2.2 なぜ修正が必要か

- **本番 DB**: 順序制御は手動 apply で回避済（実害なし）
- **将来 Supabase CLI 導入時**: 同一 version の 2 件目を **silent skip + 履歴未記録** で扱う → 片方の変更が本番に反映されない silent 障害
- memory `feedback_migration_timestamp_collision.md`（2026-05-13 朝 ② 清書済）で恒久ルール化済の予防対応

### 2.3 どちらを renumber すべきか

| 観点 | PR #171 | PR #174 |
|---|---|---|
| commit 時刻 | 10:27:47（**先**）| 10:28:20（後）|
| 既存 memo 整合（dispatch # 348 内）| `20260513000001 — PR #171 (rename)` と記述済 | `20260513000001 — PR #174 (wrapper 化)` と記述済（衝突状態を memory ② で後日修正と注記）|
| 影響範囲 | rename 系（テーブル名）| RLS helper 系（関数名）|
| 推奨 | **保持**（先発を 000001 に残す）| **renumber**（後発を移す）|

→ **PR #174 を `20260513000001 → 20260513000006` に rename**（5/13 系最初の空き timestamp）

---

## 3. a-root-003 がやること（推奨手順）

### 3.1 事前検査（memory `feedback_migration_timestamp_collision.md` §How to apply 準拠）

PowerShell:

    ls supabase/migrations/20260513*

期待結果: 上記 §2.1 と同じ 6 件、000006 は未使用であること確認

grep:

    grep -r "20260513000001_root_can_helpers" .

→ ファイル名参照箇所を全件抽出（README / spec / ドキュメント / 連動コード）

### 3.2 ファイル rename

    git mv supabase/migrations/20260513000001_root_can_helpers_to_has_role_at_least.sql supabase/migrations/20260513000006_root_can_helpers_to_has_role_at_least.sql

### 3.3 ファイル内コメント追記

migration ファイル冒頭に注記追加:

    -- 注記 (2026-05-13 a-root-003): timestamp 20260513000001 → 20260513000006 に renumber
    --   理由: 同日 PR #171 (bud_bank rename) と timestamp 衝突、将来 CLI 導入時の silent NO-OP 罠予防
    --   apply 状態: 本番は変更前 timestamp で既 apply 済（手動 apply のため実害なし）
    --   対応 dispatch: main- No. 349 (a-main-026)
    --   関連 memory: feedback_migration_timestamp_collision.md

### 3.4 連動ドキュメント修正

§3.1 grep で抽出した参照箇所を全件 `20260513000001` → `20260513000006` に書換:
- README / spec / handoff 等の md ファイル
- 関連 dispatch md（本番投下前なら反映、投下済なら次回参照のための注記のみ）
- code 内コメント（あれば）

### 3.5 PR 起票

- ブランチ名: `feature/root-migration-timestamp-collision-fix-20260513`
- base: `develop`
- タイトル: `refactor(root): 5/13 系 migration timestamp 衝突 ローカル修正（PR #174 を 20260513000006 に renumber、dispatch # 349）`
- 本文: §2 背景 + §3.2-3.4 実施内容 + §4 検証結果

### 3.6 commit メッセージ

    refactor(root): 5/13 系 migration timestamp 衝突 ローカル修正

    PR #174 の migration timestamp を 20260513000001 → 20260513000006 に renumber。
    同日 PR #171 (bud_bank rename) と衝突状態だったため、将来 CLI 導入時の
    silent NO-OP 罠予防として後発側を 5/13 系最初の空き番号に移動。

    - 本番 DB は既 apply 済（手動 apply 設計のため実害なし）
    - 連動ドキュメント参照箇所も全件書換
    - 関連 memory: feedback_migration_timestamp_collision.md

    dispatch # 349 (a-main-026)
    [a-root-003]

    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

### 3.7 検証

- `git mv` 後の `ls supabase/migrations/20260513*` で renumber 反映確認
- TypeScript / test に影響なし（migration ファイル名は code から参照されない設計）
- `npm test` で全体テスト pass 確認
- 本番 DB への再 apply は **不要**（既存 apply 済、ファイル名のみ整合）

---

## 4. 完了条件

- PR が develop に merge 済
- `git ls-files supabase/migrations/20260513*` で 000001 が 1 件のみ（PR #171）に正常化
- 000006 に PR #174 migration が配置されていることを確認
- 連動ドキュメント全件で参照書換完了（grep で 20260513000001 を検索しても PR #174 への参照が残っていないこと）
- a-main-026 への完了報告 1 行
- **本番再 apply 不要**（既 apply 済、ファイル名整合のみ）

---

## 5. 制約

- 本 PR は **ファイル名 + 参照書換 + コメント追記のみ**（schema / 関数 / RLS は一切変更しない）
- 本番再 apply は禁止（既 apply 済の重複実行は意味なし、`IF NOT EXISTS` のみで保護されていない箇所がある可能性）
- 詰まったら**即停止** → a-main-026 へ状況報告

---

## 6. 想定所要時間

- 起票 → grep + rename + 連動書換 → PR → merge まで **20-30 分**
- 検証なし（本番影響なし）、軽量 PR

---

## 7. main 026 への確認依頼（清書依頼前）

| # | 確認事項 | 推奨 |
|---|---|---|
| 1 | dispatch 番号 # 349 で正しいか | # 348 → # 349 で連番（# 347 → # 348 → # 349）|
| 2 | 投下先 a-root-003 で正しいか | handoff-026.md §2 Next Action 4 と一致 |
| 3 | renumber 先 `20260513000006` で問題ないか | 5/13 系最初の空き、forest 003-005 と隣接 |
| 4 | renumber 対象を PR #174 で確定するか | git log で後発確認済（PR #171 が 33 秒先発）|
| 5 | 緊急度 🟢 で問題ないか | handoff-026.md §2 と一致 |
