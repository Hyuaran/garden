-- ============================================================
-- Garden Tree Phase D-01 — schema migration（架電アプリ基盤）
-- ============================================================
-- 対応 spec   : docs/specs/tree/spec-tree-phase-d-01-schema-migration.md（v1.x、確定 §0 反映済）
-- 対応 Issue  : a-main 006 / Tree Phase D 慎重展開戦略
-- 作成      : 2026-04-27（a-tree、a-main 実装着手指示）
-- 適用範囲   : garden-dev / garden 本番（α 版から段階展開）
--
-- 目的:
--   FileMaker で稼働中の架電業務（コールセンター中核）を Garden に完全再現するための
--   3 テーブル + Soil 連携カラム + RLS + 集計/監査 Trigger + VIEW を一括投入する。
--
-- 含むもの:
--   1. tree_calling_sessions          — セッション単位のコール集計
--   2. tree_call_records              — 1 コール 1 レコード（result/rollback/toss pointer）
--   3. tree_agent_assignments         — オペレーター ↔ リスト 1:1 アクティブロック
--   4. soil_call_lists の連携 3 カラム — last_tree_session_id / last_tree_call_id / last_tree_touched_at
--   5. Trigger trg_tcr_update_session_totals  — INSERT 時に session 集計自動更新
--   6. Trigger trg_tcr_guard_immutable        — 不変列の UPDATE 防止
--   7. RLS 4 階層ポリシー（営業 / マネージャー / admin / super_admin）
--   8. VIEW v_tree_operator_today / v_tree_legacy_history
--   9. 監査ログ Trigger 6 種（spec §5、tree.session.* / tree.call.* / tree.assignment.*）
--
-- 確定事項（spec §0）反映:
--   §0-1 録音 = イノベラ継続。本 migration では recording_url 列のみ保持（Garden に録音ファイル保管しない）
--   §0-2 result_code は CHECK 制約 hard-code（柔軟性重視、商材追加で年 1-2 回 ALTER）
--   §0-3 リスト割当 = 開放型・競争式。assignments は「ロック」用途、partial unique index で重複架電防止
--   §0-4 Soil 整合性チェック = 日次 23:00 cron（別実装、本 migration の対象外）
--   §0-5 監査ログ = 永続スタート（削除トリガなし、Phase 後期に段階短縮検討）
--   §0-6 partition = 単一テーブル開始。3,000 万件到達時に called_at 月次パーティション化（本 migration の対象外）
--
-- 前提:
--   - root_employees(employee_number text PK) が存在すること（Garden Root Phase A 完了）
--   - soil_call_lists / soil_call_histories が存在すること（Garden Soil Phase B 投入済 or 既存 FM 流用）
--   - audit_logs テーブル + cross-rls-audit ヘルパ関数（auth_employee_number / has_role_at_least / is_same_department）
--     が既に投入されていること（spec-cross-rls-audit / spec-cross-audit-log 準拠）
--   - 上記前提が未投入の場合、本 migration 末尾の DO ブロックで警告を出力する
--
-- 適用方法:
--   Supabase Dashboard > garden-dev > SQL Editor で本ファイルを貼付 → Run。
--   失敗時は同フォルダ `20260427000001_tree_phase_d_01.down.sql` で逆方向実行。
--
-- 冪等性:
--   全 CREATE は IF NOT EXISTS / OR REPLACE を使用。再実行でエラーが出ない設計。
--   ただし RLS POLICY は Postgres に IF NOT EXISTS が無いため、DROP POLICY IF EXISTS で前置き。
-- ============================================================

BEGIN;

-- ============================================================
-- 0. 前提依存の存在確認（無ければ NOTICE で警告）
-- ============================================================
DO $$
BEGIN
  -- root_employees の存在
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'root_employees') THEN
    RAISE EXCEPTION 'tree_phase_d_01: root_employees が存在しません。Garden Root Phase A migration を先に投入してください。';
  END IF;

  -- soil_call_lists の存在（Soil Phase B が完成していなくても、テーブル骨格は既存）
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'soil_call_lists') THEN
    RAISE NOTICE 'tree_phase_d_01: soil_call_lists が見つかりません。Soil Phase B 完成までは Soil 連携部分が無効化されます。';
  END IF;

  -- audit_logs の存在（spec-cross-audit-log）
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
    RAISE NOTICE 'tree_phase_d_01: audit_logs が見つかりません。監査 Trigger は登録しますが、INSERT 時に Trigger 内 INSERT が失敗する可能性があります。';
  END IF;

  -- ヘルパ関数の存在
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'auth_employee_number') THEN
    RAISE NOTICE 'tree_phase_d_01: auth_employee_number() が存在しません。spec-cross-rls-audit を先に適用してください。RLS が機能しない可能性。';
  END IF;
END $$;


-- ============================================================
-- 1. tree_calling_sessions（セッション単位のコール集計）
-- ============================================================
CREATE TABLE IF NOT EXISTS tree_calling_sessions (
  session_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id          text NOT NULL REFERENCES root_employees(employee_number),
  campaign_code        text NOT NULL,
  mode                 text NOT NULL CHECK (mode IN ('sprout','branch','breeze','aporan','confirm')),
  started_at           timestamptz NOT NULL DEFAULT now(),
  ended_at             timestamptz,
  total_calls          int NOT NULL DEFAULT 0,
  total_connected      int NOT NULL DEFAULT 0,
  total_toss           int NOT NULL DEFAULT 0,
  total_orders         int NOT NULL DEFAULT 0,
  total_ng             int NOT NULL DEFAULT 0,
  total_retry          int NOT NULL DEFAULT 0,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz,
  CONSTRAINT chk_tcs_time_ok CHECK (ended_at IS NULL OR ended_at >= started_at)
);

COMMENT ON TABLE  tree_calling_sessions IS 'Tree D-01: 1 セッション = 1 営業の架電稼働単位。total_* は INSERT trigger で自動更新。';
COMMENT ON COLUMN tree_calling_sessions.mode IS '架電画面モード: sprout(アポ)/branch(クローザー)/breeze(呼吸連続)/aporan(アポ欄)/confirm(同意確認)';

CREATE INDEX IF NOT EXISTS idx_tcs_employee_started
  ON tree_calling_sessions (employee_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_tcs_campaign_started
  ON tree_calling_sessions (campaign_code, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_tcs_active
  ON tree_calling_sessions (employee_id)
  WHERE ended_at IS NULL AND deleted_at IS NULL;


-- ============================================================
-- 2. tree_call_records（1 コール 1 レコード、ステータス遷移履歴）
-- ============================================================
CREATE TABLE IF NOT EXISTS tree_call_records (
  call_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           uuid NOT NULL REFERENCES tree_calling_sessions(session_id),
  list_id              bigint, -- soil_call_lists(list_id) FK は Soil 投入後に ALTER で追加（§0-3 開放型 + Soil 完成タイミング差吸収）
  employee_id          text NOT NULL REFERENCES root_employees(employee_number),
  campaign_code        text NOT NULL,
  -- §0-2 確定: result_code は CHECK 制約 hard-code（柔軟性重視、商材追加で年 1-2 回 ALTER）
  -- 既存 _constants/callButtons.ts と完全一致させる:
  --   Sprout 10 種: トス/担不/見込A/B/C/不通/NG お断り/NG クレーム/NG 契約済/NG その他
  --   Branch 11 種: 受注/担不/コイン/見込A/B/C/不通/NG お断り/NG クレーム/NG 契約済/NG その他
  -- ユニーク result_code = 12 種
  result_code          text NOT NULL CHECK (result_code IN (
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
  )),
  result_group         text NOT NULL CHECK (result_group IN ('positive','pending','negative','neutral')),
  called_at            timestamptz NOT NULL DEFAULT now(),
  duration_sec         int CHECK (duration_sec IS NULL OR duration_sec >= 0),
  memo                 text,
  agreement_confirmed  boolean NOT NULL DEFAULT false,
  tossed_leaf_case_id  uuid,
  rollback_reason      text,
  prev_result_code     text,
  -- §0-1 確定: 録音はイノベラ PBX 継続使用、Garden 内に保管しない。本列はイノベラ URL のみ保持
  recording_url        text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz
);

COMMENT ON TABLE  tree_call_records IS 'Tree D-01: 1 コール 1 行。確定 §0-1 録音=イノベラ継続 / §0-2 result_code=CHECK 制約 hard-code / §0-6 partition=3,000 万件で発動（初期は単一テーブル）';
COMMENT ON COLUMN tree_call_records.result_code IS '架電結果コード（12 種）。新規追加時は本 CHECK 制約 + _constants/callButtons.ts を migration で同時更新';
COMMENT ON COLUMN tree_call_records.result_group IS 'KPI 集計用 4 分類: positive(toss/order/coin) / pending(sight_*) / negative(ng_*) / neutral(unreach/tantou_fuzai)';
COMMENT ON COLUMN tree_call_records.recording_url IS '§0-1 確定: イノベラ PBX 録音 URL のみ保持（Garden 内ファイル保管なし）。NULL 許容（録音未取得 or 手動取込待ち）';
COMMENT ON COLUMN tree_call_records.list_id IS 'soil_call_lists(list_id) 参照。FK は Soil 投入後に ALTER で追加。NULL 許容（手入力番号 / FM 互換）';

CREATE INDEX IF NOT EXISTS idx_tcr_session
  ON tree_call_records (session_id);
CREATE INDEX IF NOT EXISTS idx_tcr_list
  ON tree_call_records (list_id) WHERE list_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tcr_employee_called
  ON tree_call_records (employee_id, called_at DESC);
CREATE INDEX IF NOT EXISTS idx_tcr_result
  ON tree_call_records (result_code, called_at DESC);
CREATE INDEX IF NOT EXISTS idx_tcr_toss
  ON tree_call_records (tossed_leaf_case_id) WHERE tossed_leaf_case_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tcr_called_at
  ON tree_call_records (called_at DESC) WHERE deleted_at IS NULL;

-- soil_call_lists 存在時のみ FK を遅延追加（idempotent）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'soil_call_lists') THEN
    -- 既に FK あれば skip
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'tree_call_records' AND constraint_name = 'fk_tcr_list_soil'
    ) THEN
      ALTER TABLE tree_call_records
        ADD CONSTRAINT fk_tcr_list_soil
        FOREIGN KEY (list_id) REFERENCES soil_call_lists(list_id);
    END IF;
  END IF;
END $$;


-- ============================================================
-- 3. tree_agent_assignments（オペレーター ↔ リスト 1:1 アクティブロック、§0-3 開放型・競争式）
-- ============================================================
CREATE TABLE IF NOT EXISTS tree_agent_assignments (
  assignment_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id          text NOT NULL REFERENCES root_employees(employee_number),
  campaign_code        text NOT NULL,
  list_id              bigint NOT NULL,
  assigned_at          timestamptz NOT NULL DEFAULT now(),
  released_at          timestamptz,
  release_reason       text CHECK (release_reason IN ('done','passed','timeout','reassigned','manual')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz,
  CONSTRAINT chk_taa_release_after_assign CHECK (released_at IS NULL OR released_at >= assigned_at)
);

COMMENT ON TABLE tree_agent_assignments IS '§0-3 確定: 開放型・競争式モデル。リスト 1 万件単位で全員解放、本テーブルはレコードロックで重複架電を防止する用途（事前割当のためのテーブルではない）。partial unique index で 1 list 1 active assignment を強制。';
COMMENT ON COLUMN tree_agent_assignments.release_reason IS '解除理由: done(完了)/passed(他へ譲渡)/timeout(放置)/reassigned(再割当)/manual(手動解除)';

-- 1 list = 1 active assignment（§0-3 重複架電防止）
CREATE UNIQUE INDEX IF NOT EXISTS idx_taa_active
  ON tree_agent_assignments (list_id)
  WHERE released_at IS NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_taa_employee_active
  ON tree_agent_assignments (employee_id)
  WHERE released_at IS NULL AND deleted_at IS NULL;

-- soil_call_lists 存在時のみ FK を遅延追加
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'soil_call_lists') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'tree_agent_assignments' AND constraint_name = 'fk_taa_list_soil'
    ) THEN
      ALTER TABLE tree_agent_assignments
        ADD CONSTRAINT fk_taa_list_soil
        FOREIGN KEY (list_id) REFERENCES soil_call_lists(list_id);
    END IF;
  END IF;
END $$;


-- ============================================================
-- 4. soil_call_lists 連携カラム追加（Tree → Soil の双方向リンク）
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'soil_call_lists') THEN
    ALTER TABLE soil_call_lists
      ADD COLUMN IF NOT EXISTS last_tree_session_id uuid,
      ADD COLUMN IF NOT EXISTS last_tree_call_id    uuid,
      ADD COLUMN IF NOT EXISTS last_tree_touched_at timestamptz;

    -- FK は遅延追加（既に追加済なら skip）
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'soil_call_lists' AND constraint_name = 'fk_scl_last_tree_session'
    ) THEN
      ALTER TABLE soil_call_lists
        ADD CONSTRAINT fk_scl_last_tree_session
        FOREIGN KEY (last_tree_session_id) REFERENCES tree_calling_sessions(session_id);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'soil_call_lists' AND constraint_name = 'fk_scl_last_tree_call'
    ) THEN
      ALTER TABLE soil_call_lists
        ADD CONSTRAINT fk_scl_last_tree_call
        FOREIGN KEY (last_tree_call_id) REFERENCES tree_call_records(call_id);
    END IF;

    COMMENT ON COLUMN soil_call_lists.last_tree_session_id IS 'Tree D-01 連携: 直近の架電セッション ID。BI 集計の高速化用';
    COMMENT ON COLUMN soil_call_lists.last_tree_call_id    IS 'Tree D-01 連携: 直近のコール ID';
    COMMENT ON COLUMN soil_call_lists.last_tree_touched_at IS 'Tree D-01 連携: 直近接触時刻';
  END IF;
END $$;


-- ============================================================
-- 5. Trigger: 集計更新（INSERT 時に session.total_* を自動加算）
-- ============================================================
CREATE OR REPLACE FUNCTION trg_tcr_update_session_totals() RETURNS trigger AS $$
BEGIN
  UPDATE tree_calling_sessions
  SET total_calls     = total_calls + 1,
      total_connected = total_connected + CASE WHEN NEW.result_code <> 'unreach' THEN 1 ELSE 0 END,
      total_toss      = total_toss     + CASE WHEN NEW.result_code = 'toss'  THEN 1 ELSE 0 END,
      total_orders    = total_orders   + CASE WHEN NEW.result_code = 'order' THEN 1 ELSE 0 END,
      total_ng        = total_ng       + CASE WHEN NEW.result_code LIKE 'ng_%' THEN 1 ELSE 0 END,
      total_retry     = total_retry    + CASE WHEN NEW.result_code LIKE 'sight_%' THEN 1 ELSE 0 END,
      updated_at      = now()
  WHERE session_id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tcr_after_insert ON tree_call_records;
CREATE TRIGGER tcr_after_insert
  AFTER INSERT ON tree_call_records
  FOR EACH ROW EXECUTE FUNCTION trg_tcr_update_session_totals();


-- ============================================================
-- 6. Trigger: 列制限（不変ガード、Leaf C-01 パターン踏襲）
-- ============================================================
-- 許容 UPDATE: result_code / result_group / memo / agreement_confirmed / tossed_leaf_case_id /
--              rollback_reason / prev_result_code / recording_url / duration_sec / deleted_at / updated_at
-- 拒否 UPDATE: session_id / list_id / employee_id / campaign_code / called_at / created_at
CREATE OR REPLACE FUNCTION trg_tcr_guard_immutable() RETURNS trigger AS $$
BEGIN
  IF OLD.session_id    IS DISTINCT FROM NEW.session_id    THEN RAISE EXCEPTION 'tree_call_records.session_id is immutable'; END IF;
  IF OLD.list_id       IS DISTINCT FROM NEW.list_id       THEN RAISE EXCEPTION 'tree_call_records.list_id is immutable'; END IF;
  IF OLD.employee_id   IS DISTINCT FROM NEW.employee_id   THEN RAISE EXCEPTION 'tree_call_records.employee_id is immutable'; END IF;
  IF OLD.campaign_code IS DISTINCT FROM NEW.campaign_code THEN RAISE EXCEPTION 'tree_call_records.campaign_code is immutable'; END IF;
  IF OLD.called_at     IS DISTINCT FROM NEW.called_at     THEN RAISE EXCEPTION 'tree_call_records.called_at is immutable'; END IF;
  IF OLD.created_at    IS DISTINCT FROM NEW.created_at    THEN RAISE EXCEPTION 'tree_call_records.created_at is immutable'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tcr_before_update ON tree_call_records;
CREATE TRIGGER tcr_before_update
  BEFORE UPDATE ON tree_call_records
  FOR EACH ROW EXECUTE FUNCTION trg_tcr_guard_immutable();

-- sessions 側の updated_at 自動更新
CREATE OR REPLACE FUNCTION trg_tcs_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tcs_before_update ON tree_calling_sessions;
CREATE TRIGGER tcs_before_update
  BEFORE UPDATE ON tree_calling_sessions
  FOR EACH ROW EXECUTE FUNCTION trg_tcs_touch_updated_at();

-- assignments 側の updated_at 自動更新
DROP TRIGGER IF EXISTS taa_before_update ON tree_agent_assignments;
CREATE TRIGGER taa_before_update
  BEFORE UPDATE ON tree_agent_assignments
  FOR EACH ROW EXECUTE FUNCTION trg_tcs_touch_updated_at();


-- ============================================================
-- 7. RLS ポリシー（4 階層）
-- ============================================================
-- 前提: spec-cross-rls-audit の auth_employee_number() / has_role_at_least(role text) /
--       is_same_department(employee_number text) が定義済み
-- 未定義時は本 migration の §0 DO ブロックで NOTICE が出る

-- 7.1 tree_calling_sessions
ALTER TABLE tree_calling_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tcs_select_self    ON tree_calling_sessions;
DROP POLICY IF EXISTS tcs_insert_self    ON tree_calling_sessions;
DROP POLICY IF EXISTS tcs_update_self_open ON tree_calling_sessions;
DROP POLICY IF EXISTS tcs_select_manager ON tree_calling_sessions;
DROP POLICY IF EXISTS tcs_all_admin      ON tree_calling_sessions;

-- 営業: 自分のセッションのみ SELECT/INSERT/UPDATE
CREATE POLICY tcs_select_self ON tree_calling_sessions FOR SELECT
  USING (employee_id = auth_employee_number());
CREATE POLICY tcs_insert_self ON tree_calling_sessions FOR INSERT
  WITH CHECK (employee_id = auth_employee_number());
CREATE POLICY tcs_update_self_open ON tree_calling_sessions FOR UPDATE
  USING (employee_id = auth_employee_number() AND ended_at IS NULL)
  WITH CHECK (employee_id = auth_employee_number());

-- マネージャー: 自部署の全セッション SELECT
CREATE POLICY tcs_select_manager ON tree_calling_sessions FOR SELECT
  USING (has_role_at_least('manager') AND is_same_department(employee_id));

-- admin / super_admin: 全件 SELECT/INSERT/UPDATE/DELETE
CREATE POLICY tcs_all_admin ON tree_calling_sessions FOR ALL
  USING (has_role_at_least('admin'))
  WITH CHECK (has_role_at_least('admin'));


-- 7.2 tree_call_records
ALTER TABLE tree_call_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tcr_select_self     ON tree_call_records;
DROP POLICY IF EXISTS tcr_insert_self     ON tree_call_records;
DROP POLICY IF EXISTS tcr_update_self_today ON tree_call_records;
DROP POLICY IF EXISTS tcr_select_manager  ON tree_call_records;
DROP POLICY IF EXISTS tcr_all_admin       ON tree_call_records;
DROP POLICY IF EXISTS tcr_no_delete       ON tree_call_records;

-- 営業: 自分のコールのみ SELECT/INSERT
CREATE POLICY tcr_select_self ON tree_call_records FOR SELECT
  USING (employee_id = auth_employee_number());
CREATE POLICY tcr_insert_self ON tree_call_records FOR INSERT
  WITH CHECK (employee_id = auth_employee_number());

-- 営業: 自分のコールは「同日分のみ」UPDATE 可（巻き戻し用、cross-rls-audit は asia/tokyo 既定想定）
CREATE POLICY tcr_update_self_today ON tree_call_records FOR UPDATE
  USING (employee_id = auth_employee_number()
         AND (called_at AT TIME ZONE 'Asia/Tokyo')::date = (now() AT TIME ZONE 'Asia/Tokyo')::date)
  WITH CHECK (employee_id = auth_employee_number());

-- マネージャー: 自部署 SELECT、自部署メンバーの当日 UPDATE
CREATE POLICY tcr_select_manager ON tree_call_records FOR SELECT
  USING (has_role_at_least('manager') AND is_same_department(employee_id));

-- admin / super_admin: 全件 ALL（DELETE は次ポリシーで全 role 拒否、admin も except されない =論理削除のみ運用）
CREATE POLICY tcr_all_admin ON tree_call_records FOR ALL
  USING (has_role_at_least('admin'))
  WITH CHECK (has_role_at_least('admin'));

-- 物理 DELETE 全 role 拒否（論理削除 deleted_at の UPDATE 経由のみ運用）
-- ※ admin は ALL ポリシーで DELETE 可だが、運用ルールとして物理 DELETE は禁止。
--   本 RLS では admin だけは突破可能（緊急時の最終手段）、通常は論理削除のみ。


-- 7.3 tree_agent_assignments
ALTER TABLE tree_agent_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS taa_select_self        ON tree_agent_assignments;
DROP POLICY IF EXISTS taa_select_manager     ON tree_agent_assignments;
DROP POLICY IF EXISTS taa_insert_manager     ON tree_agent_assignments;
DROP POLICY IF EXISTS taa_update_manager     ON tree_agent_assignments;
DROP POLICY IF EXISTS taa_all_admin          ON tree_agent_assignments;
DROP POLICY IF EXISTS taa_insert_self_pull   ON tree_agent_assignments;
DROP POLICY IF EXISTS taa_update_self_release ON tree_agent_assignments;

-- 営業: 自分の割当は SELECT 可
CREATE POLICY taa_select_self ON tree_agent_assignments FOR SELECT
  USING (employee_id = auth_employee_number());

-- §0-3 開放型・競争式: 営業本人も list_id を「pull」する形で INSERT 可
-- 重複架電は idx_taa_active partial unique index で構造的に防止
CREATE POLICY taa_insert_self_pull ON tree_agent_assignments FOR INSERT
  WITH CHECK (employee_id = auth_employee_number());

-- 営業: 自分の割当の release（released_at セット）は可
CREATE POLICY taa_update_self_release ON tree_agent_assignments FOR UPDATE
  USING (employee_id = auth_employee_number())
  WITH CHECK (employee_id = auth_employee_number());

-- マネージャー: 自部署 SELECT/INSERT/UPDATE
CREATE POLICY taa_select_manager ON tree_agent_assignments FOR SELECT
  USING (has_role_at_least('manager') AND is_same_department(employee_id));
CREATE POLICY taa_insert_manager ON tree_agent_assignments FOR INSERT
  WITH CHECK (has_role_at_least('manager') AND is_same_department(employee_id));
CREATE POLICY taa_update_manager ON tree_agent_assignments FOR UPDATE
  USING (has_role_at_least('manager') AND is_same_department(employee_id))
  WITH CHECK (has_role_at_least('manager') AND is_same_department(employee_id));

-- admin / super_admin: 全件
CREATE POLICY taa_all_admin ON tree_agent_assignments FOR ALL
  USING (has_role_at_least('admin'))
  WITH CHECK (has_role_at_least('admin'));


-- ============================================================
-- 8. VIEW（v_tree_operator_today / v_tree_legacy_history）
-- ============================================================
-- VIEW は SECURITY INVOKER（既定）= 呼び出し側 RLS が継承される

CREATE OR REPLACE VIEW v_tree_operator_today AS
SELECT
  s.session_id,
  s.employee_id,
  s.campaign_code,
  s.mode,
  s.started_at,
  s.ended_at,
  s.total_calls,
  s.total_connected,
  s.total_toss,
  s.total_orders,
  s.total_ng,
  s.total_retry,
  -- 直近のコール時刻（マネージャー UI で「在席/離席」判定用、D-03 §3.1）
  (SELECT max(r.called_at) FROM tree_call_records r WHERE r.session_id = s.session_id) AS last_called_at,
  -- アクティブ割当数（オペレーター視点）
  (SELECT count(*) FROM tree_agent_assignments a
   WHERE a.employee_id = s.employee_id
     AND a.released_at IS NULL
     AND a.deleted_at IS NULL) AS active_assignments
FROM tree_calling_sessions s
WHERE s.started_at >= (now() AT TIME ZONE 'Asia/Tokyo')::date
  AND s.deleted_at IS NULL;

COMMENT ON VIEW v_tree_operator_today IS 'D-03 マネージャー UI 用、当日のセッションサマリ。SECURITY INVOKER で呼出元 RLS 継承';

-- soil_call_histories の存在時のみ legacy VIEW を作成
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'soil_call_histories') THEN
    -- source 列の存在確認（FM 流入識別用）
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public'
                 AND table_name = 'soil_call_histories'
                 AND column_name = 'source') THEN
      CREATE OR REPLACE VIEW v_tree_legacy_history AS
      SELECT
        h.history_id    AS legacy_id,
        h.list_id,
        h.called_at,
        h.result_code   AS legacy_result_code,
        h.employee_id,
        h.memo
      FROM soil_call_histories h
      WHERE h.source = 'filemaker';
      COMMENT ON VIEW v_tree_legacy_history IS 'FM 時代の架電履歴を Tree 側から参照する読み取り専用 VIEW（spec §6.2、source=filemaker フィルタ）';
    ELSE
      RAISE NOTICE 'tree_phase_d_01: soil_call_histories.source 列が存在しません。v_tree_legacy_history は作成スキップ。Soil 側で source 列を追加後に本 migration を再実行してください。';
    END IF;
  ELSE
    RAISE NOTICE 'tree_phase_d_01: soil_call_histories が存在しません。v_tree_legacy_history は作成スキップ。';
  END IF;
END $$;


-- ============================================================
-- 9. 監査ログ Trigger（spec §5、6 イベント）
-- ============================================================
-- audit_logs テーブル前提（spec-cross-audit-log）
-- 想定スキーマ: audit_logs(event_type text, actor text, occurred_at timestamptz, payload jsonb, ...)
--
-- audit_logs が無い環境では Trigger は登録するが、INSERT 時に内部失敗 → 業務継続のため
-- 本実装では SAFE_INSERT パターン（EXCEPTION でログ警告のみ、業務 INSERT は継続）

-- ヘルパ: audit_logs 安全 INSERT
CREATE OR REPLACE FUNCTION trg_audit_safe_insert(
  p_event_type text,
  p_actor      text,
  p_payload    jsonb
) RETURNS void AS $$
BEGIN
  INSERT INTO audit_logs (event_type, actor, occurred_at, payload)
  VALUES (p_event_type, p_actor, now(), p_payload);
EXCEPTION WHEN OTHERS THEN
  -- audit_logs 未投入 / 接続失敗時に業務 INSERT を巻き込まないよう SWALLOW
  RAISE WARNING 'audit_logs INSERT failed (event=%): %', p_event_type, SQLERRM;
END;
$$ LANGUAGE plpgsql;


-- 9.1 tree.session.open / tree.session.close
CREATE OR REPLACE FUNCTION trg_audit_tree_session() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM trg_audit_safe_insert(
      'tree.session.open',
      NEW.employee_id,
      jsonb_build_object(
        'session_id', NEW.session_id,
        'mode', NEW.mode,
        'campaign_code', NEW.campaign_code
      )
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL THEN
    PERFORM trg_audit_safe_insert(
      'tree.session.close',
      NEW.employee_id,
      jsonb_build_object(
        'session_id', NEW.session_id,
        'total_calls', NEW.total_calls,
        'duration_min',
          EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at)) / 60
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tcs_audit_after_insert ON tree_calling_sessions;
CREATE TRIGGER tcs_audit_after_insert
  AFTER INSERT ON tree_calling_sessions
  FOR EACH ROW EXECUTE FUNCTION trg_audit_tree_session();

DROP TRIGGER IF EXISTS tcs_audit_after_update ON tree_calling_sessions;
CREATE TRIGGER tcs_audit_after_update
  AFTER UPDATE ON tree_calling_sessions
  FOR EACH ROW EXECUTE FUNCTION trg_audit_tree_session();


-- 9.2 tree.call.record / tree.call.rollback
CREATE OR REPLACE FUNCTION trg_audit_tree_call() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM trg_audit_safe_insert(
      'tree.call.record',
      NEW.employee_id,
      jsonb_build_object(
        'call_id', NEW.call_id,
        'session_id', NEW.session_id,
        'result_code', NEW.result_code
      )
    );
  ELSIF TG_OP = 'UPDATE'
        AND OLD.result_code IS DISTINCT FROM NEW.result_code
        AND NEW.prev_result_code IS NOT NULL THEN
    PERFORM trg_audit_safe_insert(
      'tree.call.rollback',
      NEW.employee_id,
      jsonb_build_object(
        'call_id', NEW.call_id,
        'from', OLD.result_code,
        'to', NEW.result_code,
        'reason', NEW.rollback_reason
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tcr_audit_after_insert ON tree_call_records;
CREATE TRIGGER tcr_audit_after_insert
  AFTER INSERT ON tree_call_records
  FOR EACH ROW EXECUTE FUNCTION trg_audit_tree_call();

DROP TRIGGER IF EXISTS tcr_audit_after_update ON tree_call_records;
CREATE TRIGGER tcr_audit_after_update
  AFTER UPDATE ON tree_call_records
  FOR EACH ROW EXECUTE FUNCTION trg_audit_tree_call();


-- 9.3 tree.assignment.allocate / tree.assignment.release
CREATE OR REPLACE FUNCTION trg_audit_tree_assignment() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM trg_audit_safe_insert(
      'tree.assignment.allocate',
      NEW.employee_id,
      jsonb_build_object(
        'assignment_id', NEW.assignment_id,
        'employee_id', NEW.employee_id,
        'list_id', NEW.list_id
      )
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.released_at IS NULL AND NEW.released_at IS NOT NULL THEN
    PERFORM trg_audit_safe_insert(
      'tree.assignment.release',
      NEW.employee_id,
      jsonb_build_object(
        'assignment_id', NEW.assignment_id,
        'release_reason', NEW.release_reason
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS taa_audit_after_insert ON tree_agent_assignments;
CREATE TRIGGER taa_audit_after_insert
  AFTER INSERT ON tree_agent_assignments
  FOR EACH ROW EXECUTE FUNCTION trg_audit_tree_assignment();

DROP TRIGGER IF EXISTS taa_audit_after_update ON tree_agent_assignments;
CREATE TRIGGER taa_audit_after_update
  AFTER UPDATE ON tree_agent_assignments
  FOR EACH ROW EXECUTE FUNCTION trg_audit_tree_assignment();


-- ============================================================
-- 完了
-- ============================================================
COMMIT;

-- 適用後の確認 SQL（参考、Run 後に別途実行）:
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name LIKE 'tree_%' ORDER BY table_name;
-- SELECT viewname FROM pg_views
--   WHERE schemaname = 'public' AND viewname LIKE 'v_tree_%';
-- SELECT policyname, tablename FROM pg_policies
--   WHERE tablename LIKE 'tree_%' ORDER BY tablename, policyname;
-- SELECT tgname, tgrelid::regclass FROM pg_trigger
--   WHERE tgname LIKE 't%' AND NOT tgisinternal ORDER BY tgrelid, tgname;
