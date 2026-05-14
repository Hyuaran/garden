# Draft dispatch # 348 — bud_master_rules.memo 列の正式 migration 化

> 起草: a-main-026（2026-05-13(水) 15:08 JST、handoff §2 Action 3）
> 投下先: **a-forest-002**
> 清書担当: a-writer-001（dispatch v6 規格化）
> 緊急度: 🟡（本番 apply 済 + 動作正常、source 整合性回復のみ。CLI 導入時の silent NO-OP 罠予防）

---

## 1 件名

`feat(forest): bud_master_rules.memo 列を正式 migration 化（5/13 手動 ALTER の source 整合性回復）`

---

## 2 背景（客観事実）

### 2.1 5/13 m3 / m5 apply 経緯（handoff-026.md §0 遺言 2 より）

| # | 内容 | 状態 |
|---|---|---|
| Forest m3 apply | bud_corporations / bud_master_rules / bud_transactions / bud_files / bud_yayoi_exports / bud_audit_log 6 テーブル新規 | ✅ 14:30 頃 apply 完了 |
| **手動 ALTER** | **`ALTER TABLE bud_master_rules ADD COLUMN memo text;`**（m5 apply 直前の事前作業） | ✅ a-main-025 が SQL Editor 直接 Run |
| Forest m5 apply | 714 共通仕訳マスタ rules 投入（memo 列値含む 8 列の `INSERT` 文） | ✅ 14:42 頃 apply 完了 |

### 2.2 source 不整合の物理事実

- **m3 source**（`temp-m3.sql` L103-）: `CREATE TABLE bud_master_rules` の列定義に **`memo` 列なし**
- **m5 source**（`temp-m5.sql` L12-): `insert into bud_master_rules (..., memo) values (..., '')` の **8 列目に memo を記述**
- **本番 DB の現状**: `memo text` 列が物理的に存在（手動 ALTER 経由）
- **PR #172 で merge された Forest 5/13 migration の source**: m3 に memo 列の追加なし

つまり「**本番 DB と source repository が乖離した状態**」。

### 2.3 何が問題か

| 観点 | リスク |
|---|---|
| 新環境の再構築 | source から本番を再現できない（memo 列が存在しない bud_master_rules テーブルが生成される） |
| Supabase CLI 導入時 | CLI が m3 source を正解として diff を取ると `memo` 列を「不要列」と判定して削除しかねない |
| 開発者の認知 | コード grep で memo 列を発見しても CREATE TABLE に存在せず混乱 |

---

## 3 修復方針（推奨 B 案）

### 選択肢

| 案 | 内容 | メリット | デメリット |
|---|---|---|---|
| A 案 | m3 ファイルの CREATE TABLE に memo 列を **追記** + m3 を再 apply | source 一発整合 | 既存 m3 の DROP + CREATE 必要、破壊的 |
| **B 案 ★推奨** | **新 migration `<timestamp>_add_memo_to_bud_master_rules.sql`** で `ALTER TABLE ... ADD COLUMN IF NOT EXISTS memo text;` を起票 | 冪等（既存 = NO-OP / 新環境 = ADD）、非破壊的、CLI 導入時に正常追跡 | migration 1 件増 |
| C 案 | m3 ファイル直接書換 + 「source 一致用、本番 apply 不要」コメント明記 | migration 増えない | コメント漏れで再 apply 事故リスク、git history で混乱 |

### 推奨理由（B 案）

- **冪等性**: `IF NOT EXISTS` で既存環境では NO-OP、新環境では ADD 実行 → どこで apply しても安全
- **CLI 導入時の正解パターン**: Supabase CLI が migration order で順次 apply する設計と一致
- **memory 準拠**: `feedback_migration_apply_verification_sop.md` の SOP に沿う（merge → 物理検証 → PR comment 貼付）

---

## 4 a-forest-002 がやること（推奨 B 案実装フロー）

### 4.1 起票前の事前検査

```powershell
# 同名 migration / timestamp 衝突確認（memory feedback_migration_timestamp_collision.md 準拠）
ls supabase/migrations/20260513* 2>$null
ls supabase/migrations/20260514* 2>$null

# 既存の memo 列追加 migration が無いことを確認
grep -r "ADD COLUMN.*memo" supabase/migrations/
grep -r "bud_master_rules" supabase/migrations/
```

### 4.2 timestamp 採番

- 既存 5/13 migration: `20260513000001` (PR #171 / #174 で衝突済 = 既知地雷) / `20260513000010` (forest m3) / `20260513000020` (forest m4) / `20260513000030` (forest m5) など
- 新 migration の推奨 timestamp: **`20260513000040_add_memo_to_bud_master_rules.sql`**（forest m5 の次）
  - 注: 実際の forest m3/m4/m5 timestamp は forest-002 が現物で確認 + 衝突回避すること

### 4.3 migration ファイル内容（推奨）

```sql
-- 5/13 a-main-025 が SQL Editor で手動 ALTER した memo 列を、source repository へ正式登録
-- 適用方法: Supabase Dashboard > SQL Editor で本ファイル内容を貼付し Run（既存環境では IF NOT EXISTS で NO-OP）
-- 起源: handoff-026.md §0 遺言 2、dispatch # 348 (a-main-026)

ALTER TABLE public.bud_master_rules
  ADD COLUMN IF NOT EXISTS memo text;

COMMENT ON COLUMN public.bud_master_rules.memo IS '共通仕訳マスタの注釈欄（5/13 m5 投入時に追加、source 整合性回復 by # 348）';

-- 動作検証 SQL
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'bud_master_rules' AND column_name = 'memo';
-- 期待結果: 1 行（memo / text）
```

### 4.4 PR 起票

- ブランチ名: `feature/forest-bud-master-rules-memo-migration-20260513`
- base: `develop`
- タイトル: `feat(forest): bud_master_rules.memo 列を正式 migration 化（5/13 手動 ALTER の source 整合性回復、dispatch # 348）`
- 本文: 本 draft の §2 / §3 / §4.3 内容 + 5/13 経緯の客観記述

### 4.5 commit メッセージ

```
feat(forest): bud_master_rules.memo 列を正式 migration 化

5/13 m5 apply 前に a-main-025 が SQL Editor で手動 ALTER した memo 列を、
source repository へ正式登録（冪等 IF NOT EXISTS）。

- m3 source の CREATE TABLE には memo 列定義なし
- m5 INSERT 文は memo 列値を含む（手動 ALTER 経由で apply 済）
- 新環境再構築時 / CLI 導入時の silent NO-OP 罠予防

dispatch # 348 (a-main-026)
related: handoff-026.md §0 遺言 2
related memory: feedback_migration_apply_verification_sop / feedback_migration_timestamp_collision

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

### 4.6 merge 後の検証（memory `feedback_migration_apply_verification_sop.md` 準拠）

1. Chrome MCP で Supabase Studio SQL Editor を開く
2. 検証 SQL 実行:
   ```sql
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'bud_master_rules' AND column_name = 'memo';
   ```
3. 期待結果: 1 行（`memo` / `text` / `YES`）
4. screenshot 取得
5. PR comment 貼付（標準フォーマット）:
   ```
   ✅ apply 完了 (a-forest-002, 2026-05-13 HH:MM JST)
   - 検証手段: Chrome MCP + Supabase Studio SQL Editor
   - 検証クエリ: <上記 SQL>
   - 検証結果: memo / text / YES（既存 1 行確認、新規 ADD なし、IF NOT EXISTS による NO-OP 動作）
   - 検証者: a-forest-002
   - screenshot: <attached>
   ```

---

## 5 関連 memory（必読）

- `reference_supabase_manual_apply.md` — Garden 本番 = 手動 apply 設計
- `feedback_migration_apply_verification_sop.md` — merge 後 30 分以内の物理検証 SOP
- `feedback_migration_timestamp_collision.md` — 起票前の ls 確認必須
- `feedback_migration_apply_verification.md` — apply 完了記述に検証手段 + 時刻 + 検証者 3 点併記必須

---

## 6 想定所要時間

- forest-002 が a-main-026 から本 draft 投下を受領後、起票 → merge → apply → 検証完了まで **30〜45 分**
- migration 1 件 + PR 起票 + Chrome MCP 検証のみ、複雑な実装なし

---

## 7 a-writer-001 への清書依頼ポイント

- v6 規格（投下先 / 緊急度 / dispatch 番号 / 添付有無 / 期待アクション 先頭明示）
- 本文は §2 背景 / §3 推奨 B 案 / §4 forest-002 実装フロー を集約（コピペ md 経由）
- forest-002 への投下用短文（投下情報先頭 + コピペ md パスのみ）

---

EOF
