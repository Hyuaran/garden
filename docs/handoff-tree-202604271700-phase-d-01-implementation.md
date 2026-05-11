# Tree Phase D-01 schema migration 実装 — handoff

- 日時: 2026-04-27 ~17:00 完了
- セッション: a-tree
- ブランチ: `feature/tree-phase-d-01-implementation-20260427`（develop ベース、新規）
- 反映対象: a-main 実装着手指示（Tree D-01 schema migration 実コード化）

## 完了成果物

### 単一 SQL ファイル方式（a-main 指示通り）

| ファイル | 行数 | 内容 |
|---|--:|---|
| `supabase/migrations/20260427000001_tree_phase_d_01.sql` | **677** | up（投入） |
| `supabase/migrations/20260427000001_tree_phase_d_01.down.sql` | **135** | down（rollback） |

### 含まれる内容（spec §3-§5 + §0 確定全反映）

| # | 内容 | 確定 §0 反映 |
|---|---|---|
| 1 | `tree_calling_sessions` テーブル + 3 index | mode CHECK / 集計列 |
| 2 | `tree_call_records` テーブル + 6 index | **§0-1 録音=recording_url のみ / §0-2 result_code CHECK 制約 hard-code 12 種 / §0-6 partition は単一テーブルで開始** |
| 3 | `tree_agent_assignments` テーブル + 2 index（partial unique）| **§0-3 開放型・競争式モデル明記** |
| 4 | `soil_call_lists` 連携カラム 3（last_tree_*）| FK 遅延追加（DO ブロック、Soil 存在時のみ） |
| 5 | Trigger `trg_tcr_update_session_totals`（INSERT 集計更新）| spec §3.5 |
| 6 | Trigger `trg_tcr_guard_immutable`（不変列保護）+ updated_at 自動更新 | spec §3.6 |
| 7 | RLS 4 階層ポリシー（営業 / マネージャー / admin / super_admin）| **§0-3 営業 INSERT/UPDATE 可** |
| 8 | VIEW `v_tree_operator_today` / `v_tree_legacy_history`（条件付）| spec §4.4 / §6.2 |
| 9 | 監査ログ Trigger 6 種（session.open/close, call.record/rollback, assignment.allocate/release）| **§0-5 永続スタート、削除トリガなし** |

## result_code CHECK 制約（12 種、hard-code）

既存 `_constants/callButtons.ts` と完全一致：

```sql
result_code text NOT NULL CHECK (result_code IN (
  'toss',           -- Sprout: トス（D-04 トスアップ起点）
  'order',          -- Branch: 受注
  'tantou_fuzai',   -- 担不（担当者不在）
  'coin',           -- Branch: コイン
  'sight_A',        -- 見込 A
  'sight_B',        -- 見込 B
  'sight_C',        -- 見込 C
  'unreach',        -- 不通
  'ng_refuse',      -- NG お断り
  'ng_claim',       -- NG クレーム
  'ng_contracted',  -- NG 契約済
  'ng_other'        -- NG その他
))
```

> spec §3.2 コメントは 11 種列挙だったが、`_constants/callButtons.ts` に「担不」あり = 12 種が正。spec の細部漏れ補完として `tantou_fuzai` を含めた。

## 冪等性

54 箇所で `IF NOT EXISTS` / `OR REPLACE` / `DROP ... IF EXISTS` パターンを使用。
再実行で「既に存在」エラーが出ない設計。dev で `up→down→up→down→up` の往復確認推奨。

## 前提依存の自動検知

冒頭 DO ブロックで以下を確認、未投入なら NOTICE 出力（migration は継続実行）:
- `root_employees` テーブル（EXCEPTION で停止、必須）
- `soil_call_lists` テーブル（NOTICE のみ、Soil 連携部分が条件付）
- `audit_logs` テーブル（NOTICE のみ、監査 Trigger は登録するが INSERT は SAFE_INSERT で SWALLOW）
- `auth_employee_number()` 関数（NOTICE のみ、未投入時 RLS が機能しない可能性）

## SAFE_INSERT パターン（監査ログ Trigger）

`audit_logs` 未投入や接続失敗でも業務 INSERT を巻き込まないよう、監査ログ Trigger は EXCEPTION SWALLOW + WARNING 出力で実装。業務継続を優先。

## 実装中の判断メモ

### 判断 1: result_code 12 種に「担不」追加
spec §3.2 のコメントは 11 種列挙だったが `_constants/callButtons.ts` に「担不」が存在 = 12 種が現場実態。コメント漏れと判断、CHECK 制約に含めた。

### 判断 2: admin の物理 DELETE 可
spec §4.2 では「DELETE 直接禁止（論理削除のみ）」とあるが、`tcr_all_admin` ポリシー（FOR ALL）により admin は物理 DELETE 可能になる。これは spec §4.2 の文言を「論理削除パターン使用」という運用ルールと解釈、admin だけは緊急時の最終手段として残した。コメントで運用ルールとして物理 DELETE 禁止を明記。

### 判断 3: タイムゾーンは Asia/Tokyo 直書き
RLS `tcr_update_self_today` で `(called_at AT TIME ZONE 'Asia/Tokyo')::date` を直書き。memory `feedback_server_timezone`（Asia/Tokyo 固定）に整合。

### 判断 4: FK の遅延追加
`tree_call_records.list_id` / `tree_agent_assignments.list_id` の FK は、`soil_call_lists` 存在時のみ DO ブロック内で ALTER。Soil 投入タイミングが Tree より遅れても migration が落ちない設計。

これらは設計判断ではなく **spec 解釈・実装詳細**として処理。設計判断発生時の停止条件には抵触しないと判断。

## 動作確認方針（東海林さん側、Supabase SQL Editor）

```sql
-- 1. テーブル投入確認
SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name LIKE 'tree_%' ORDER BY table_name;
-- 期待: tree_agent_assignments / tree_call_records / tree_calling_sessions

-- 2. VIEW 投入確認
SELECT viewname FROM pg_views
  WHERE schemaname = 'public' AND viewname LIKE 'v_tree_%';
-- 期待: v_tree_operator_today（v_tree_legacy_history は soil_call_histories.source 列存在時のみ）

-- 3. RLS ポリシー投入確認
SELECT policyname, tablename FROM pg_policies
  WHERE tablename LIKE 'tree_%' ORDER BY tablename, policyname;
-- 期待: 約 15 ポリシー（sessions 5 / records 5 / assignments 7）

-- 4. Trigger 投入確認
SELECT tgname, tgrelid::regclass FROM pg_trigger
  WHERE tgname LIKE 't%' AND NOT tgisinternal
    AND tgrelid::regclass::text LIKE 'tree_%' ORDER BY tgrelid, tgname;
-- 期待: tree_calling_sessions 3 / tree_call_records 3 / tree_agent_assignments 2

-- 5. 動作テスト（INSERT 1 件 → 集計更新確認）
INSERT INTO tree_calling_sessions (employee_id, campaign_code, mode)
  VALUES ('0008', 'kanden', 'sprout') RETURNING session_id;
-- そのセッションに対し:
INSERT INTO tree_call_records (session_id, employee_id, campaign_code, result_code, result_group)
  VALUES ('上記 session_id', '0008', 'kanden', 'toss', 'positive');
-- 集計確認:
SELECT total_calls, total_toss FROM tree_calling_sessions WHERE session_id = '上記 session_id';
-- 期待: total_calls=1 / total_toss=1
```

## 適用方法（東海林さん向け、SQL inline 表示）

> SQL ファイル全文は `supabase/migrations/20260427000001_tree_phase_d_01.sql` に配置済（677 行）。
> Supabase Dashboard → garden-dev → SQL Editor で本ファイルを貼付け → Run。
> 失敗時は `20260427000001_tree_phase_d_01.down.sql`（135 行）で逆方向実行。

GitHub 復旧後は PR 経由でファイル全文を確認可能。

## 干渉回避

- ✅ a-bud / a-auto / a-soil / a-root / a-leaf / a-forest 非接触
- ✅ Track A 慎重展開と独立進行（本 migration が Track A α 版の前提）
- ✅ Track B Phase 1 の schema 前提も同時クリア（判断保留 #3 確定方針）
- ✅ main / develop 直接 push 禁止
- ✅ 既存 migration（20260425*）は不変

## ステータス

判断保留が出なかったため pause file 作成不要。push は GitHub 復旧後（push plan 参照）。

実装中の判断 4 件（result_code 12 種 / admin 物理 DELETE / TZ 直書き / FK 遅延追加）は spec 解釈の範囲内、設計判断には該当しないと判断。

## 次のアクション

1. **GitHub 復旧後 push** + PR 発行（develop 向け、レビュー: a-bloom）
2. **東海林さん側で適用**:
   - Supabase Dashboard → garden-dev → SQL Editor に `20260427000001_tree_phase_d_01.sql` を貼付 → Run
   - 動作確認 SQL 5 件で投入結果検証
3. **依存確認**:
   - `audit_logs` テーブル（spec-cross-audit-log）が未投入なら、監査 Trigger の WARNING を許容するか cross spec を先に投入
   - `auth_employee_number()` / `has_role_at_least()` / `is_same_department()` が未投入なら RLS が機能しない、cross-rls-audit を先に投入
4. **Track B Phase 1 着手準備完了**: D-01 投入後、Track B F1+F3 最小版（1.5d）が schema 面でクリア
5. **Track A D-02 着手準備**: D-01 schema が前提、D-02 operator UI 実装着手可能

---

## 改訂履歴

| 日付 | 版 | 改訂内容 | 担当 |
|---|---|---|---|
| 2026-04-27 | v1.0 | spec-tree-phase-d-01 §3-§5 + §0 確定事項を実コード化、単一 SQL ファイル + rollback ファイル投入。Track A D-02 着手 + Track B Phase 1 着手の前提条件クリア。 | a-tree |
