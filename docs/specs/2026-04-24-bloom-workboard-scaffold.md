# Garden-Bloom Workboard スカフォールド設計書

- 作成元セッション: **a-auto**（自律実行モード / 集中別作業中・60分枠）
- 作業ブランチ: `feature/bloom-workboard-scaffold-20260424-auto`（`main` 派生、コード変更ゼロ）
- 目的: a-bloom セッションが Phase A-1（約 4d）で実装する際の**ドロップインスカフォールド**を docs として先出し。実装本体は a-bloom で行う
- 入力:
  - `06_Garden-Bloom/CLAUDE.md`（本日更新済、Workboard 仕様確定）
  - `src/app/forest/` の既存 TSX 実装（認証・State・Gate パターン流用）
  - `docs/garden-release-roadmap-20260424.md`（本日 a-auto 生成）
- 設計原則:
  1. **疎結合**: `bloom_*` プレフィックスで Seed 移植時に 1〜2h で差替可能
  2. **Forest パターン踏襲**: 認証・Gate・State はコピー＆アダプト
  3. **`bloom_users` は作らない**: 権限は `root_employees.garden_role` を直接参照
  4. **auto モード隠蔽**: ステータス名称は「対応可能 / 取り込み中 / 集中業務中 / 外出中」（一般業務用語）
  5. **月次ダイジェスト最優先**: 毎月 15-20 日の責任者会議で使う

---

## 1. Supabase Migration SQL

### 1.1 ファイル配置

```
scripts/bloom-schema.sql                      # 全テーブル定義 + enum + index
scripts/bloom-rls.sql                         # RLS ポリシー
scripts/bloom-seed-optional.sql               # 任意の初期データ投入（モジュール進捗等）
```

### 1.2 enum 定義

```sql
-- 個人ステータス（auto モード隠蔽済の一般業務用語）
CREATE TYPE bloom_worker_status_kind AS ENUM (
  'available',        -- 🟢 対応可能
  'busy_light',       -- 🟡 取り込み中（電話可、メッセは後回し）
  'focus',            -- 🔴 集中業務中（緊急以外NG）
  'away'              -- ⚪ 外出中（翌日以降）
);

-- ロードマップのエントリ種別
CREATE TYPE bloom_roadmap_entry_kind AS ENUM (
  'phase',            -- Phase A / B / C / D
  'milestone',        -- 主要マイルストーン
  'module',           -- 個別モジュール進捗
  'risk',             -- リスクカード
  'banner'            -- お知らせ（遅延・変更アラート）
);

-- 月次ダイジェスト状態
CREATE TYPE bloom_monthly_digest_status AS ENUM (
  'draft',            -- 編集中
  'published',        -- 会議配布可
  'archived'          -- 過去分
);

-- Chatwork 通知種別
CREATE TYPE bloom_chatwork_kind AS ENUM (
  'daily',            -- 18:00 日次
  'weekly',           -- 金 18:00 週次
  'monthly',          -- 14日 18:00 月次ダイジェスト
  'alert'             -- 随時（PRマージ・Phase完了・スケジュール変更）
);
```

### 1.3 テーブル定義

```sql
-- =====================================================================
-- bloom_worker_status: 個人の現在ステータス（1 社員 1 行、upsert で更新）
-- =====================================================================
CREATE TABLE bloom_worker_status (
  user_id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status          bloom_worker_status_kind NOT NULL DEFAULT 'available',
  status_note     text,                               -- 任意の自由記述（「顧客打合せ中」等）
  until           timestamptz,                        -- 〜時まで（予想復帰時刻）
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES auth.users(id)      -- 代理更新対応
);

CREATE INDEX bloom_worker_status_updated_idx ON bloom_worker_status(updated_at DESC);

-- =====================================================================
-- bloom_daily_logs: 日次作業ログ（1 ユーザー × 1 日 = 1 行）
-- 既存 send_report.py 日報と共存（別テーブル、別ルーム）
-- =====================================================================
CREATE TABLE bloom_daily_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date        date NOT NULL,
  planned_items   jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{title, estimate_min, done_bool}]
  completed_items jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{title, actual_min, notes}]
  next_steps      jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{title, target_date}]
  highlights      text,                               -- 今日のハイライト（任意）
  hours_logged    numeric(4,2),                       -- 自己申告稼働時間（任意）
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);

CREATE INDEX bloom_daily_logs_user_date_idx ON bloom_daily_logs(user_id, log_date DESC);

-- =====================================================================
-- bloom_roadmap_entries: ロードマップのエントリ（Phase / Milestone / Module / Risk / Banner）
-- garden-release-roadmap-20260424.md の内容を構造化
-- =====================================================================
CREATE TABLE bloom_roadmap_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            bloom_roadmap_entry_kind NOT NULL,
  parent_id       uuid REFERENCES bloom_roadmap_entries(id) ON DELETE CASCADE, -- Phase → Milestone 入れ子
  sort_order      int NOT NULL DEFAULT 0,
  label_dev       text NOT NULL,                      -- ⚙️開発向け: "Phase A / Bud Phase 1b.2"
  label_ops       text,                               -- 👥みんな向け: "経理ソフト構築"
  description     text,
  target_month    text,                               -- "M1" 〜 "M8"
  starts_on       date,
  due_on          date,
  completed_on    date,
  progress_pct    int CHECK (progress_pct BETWEEN 0 AND 100),
  banner_severity text CHECK (banner_severity IN ('info','warn','critical')),
  is_archived     bool NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bloom_roadmap_kind_idx ON bloom_roadmap_entries(kind, sort_order);
CREATE INDEX bloom_roadmap_parent_idx ON bloom_roadmap_entries(parent_id, sort_order);

-- =====================================================================
-- bloom_project_progress: プロジェクト別進捗率（週次スナップショット）
-- 時系列グラフ描画用
-- =====================================================================
CREATE TABLE bloom_project_progress (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_entry_id uuid NOT NULL REFERENCES bloom_roadmap_entries(id) ON DELETE CASCADE,
  snapshot_on     date NOT NULL,                      -- 週次（月曜 or 金曜固定）
  progress_pct    int NOT NULL CHECK (progress_pct BETWEEN 0 AND 100),
  notes           text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (roadmap_entry_id, snapshot_on)
);

CREATE INDEX bloom_project_progress_entry_idx ON bloom_project_progress(roadmap_entry_id, snapshot_on DESC);

-- =====================================================================
-- bloom_chatwork_config: Chatwork API トークン・ルーム ID
-- シングル行（super_admin のみ編集可）
-- =====================================================================
CREATE TABLE bloom_chatwork_config (
  id              int PRIMARY KEY CHECK (id = 1),     -- 単一行強制
  api_token       text,                               -- 暗号化推奨: pgcrypto + secret key
  room_id_progress text,                              -- "Garden開発進捗" ルーム ID
  room_id_alert   text,                               -- 重要アラート用（任意、同ルームでも可）
  enabled         bool NOT NULL DEFAULT false,        -- Cron 配信 ON/OFF トグル
  last_success_at timestamptz,
  last_error      text,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES auth.users(id)
);

-- =====================================================================
-- bloom_module_progress: Garden 9 モジュールの現在進捗（スナップショット用メタ）
-- roadmap_entries.kind='module' と二重持ちになるが、UI 高速化のため別持ち
-- =====================================================================
CREATE TABLE bloom_module_progress (
  module_code     text PRIMARY KEY CHECK (
    module_code IN ('soil','root','tree','leaf','bud','bloom','forest','rill','seed')
  ),
  label_dev       text NOT NULL,                      -- "Garden-Bud"
  label_ops       text NOT NULL,                      -- "経理ソフト"
  phase_label     text,                               -- "Phase 1b.2 Task 5/13"
  progress_pct    int NOT NULL CHECK (progress_pct BETWEEN 0 AND 100),
  status          text CHECK (status IN ('planned','in_progress','at_risk','done')),
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  last_commit_sha text,                               -- 任意：直近コミット
  last_commit_at  timestamptz,
  display_order   int NOT NULL DEFAULT 0
);

-- =====================================================================
-- bloom_monthly_digests: 月次ダイジェストのメタ（本文は jsonb で柔軟化）
-- =====================================================================
CREATE TABLE bloom_monthly_digests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_month    date NOT NULL,                      -- 月の 1 日（2026-05-01 等）
  status          bloom_monthly_digest_status NOT NULL DEFAULT 'draft',
  title           text NOT NULL,                      -- "2026年5月 Garden 進捗"
  summary         text,                               -- 冒頭コメント（東海林さん）
  pages           jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{kind:'achievements', ...}, ...]
  published_at    timestamptz,
  published_by    uuid REFERENCES auth.users(id),
  pdf_url         text,                               -- エクスポート後の格納先（Supabase Storage）
  image_urls      jsonb,                              -- ページ別画像（Chatwork 貼付用）
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (digest_month)
);

CREATE INDEX bloom_monthly_digests_month_idx ON bloom_monthly_digests(digest_month DESC);
```

### 1.4 RLS ポリシー（bloom-rls.sql）

```sql
-- ==============================================================
-- 共通ヘルパー関数（Forest と同じパターン）
-- Forest 既存の forest_has_access / forest_is_admin を踏襲する形で
-- bloom_has_access(role_min text) 関数を作成する
-- ==============================================================
CREATE OR REPLACE FUNCTION bloom_role_rank(role_value text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE role_value
    WHEN 'toss'        THEN 1
    WHEN 'closer'      THEN 2
    WHEN 'cs'          THEN 3
    WHEN 'staff'       THEN 4
    WHEN 'manager'     THEN 5
    WHEN 'admin'       THEN 6
    WHEN 'super_admin' THEN 7
    ELSE 0
  END
$$;

CREATE OR REPLACE FUNCTION bloom_current_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT re.garden_role FROM root_employees re
  WHERE re.user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION bloom_has_access(role_min text)
RETURNS bool LANGUAGE sql STABLE AS $$
  SELECT bloom_role_rank(bloom_current_role()) >= bloom_role_rank(role_min)
$$;

-- ==============================================================
-- 方針
-- super_admin / admin : 全員分 read / 自分 write
-- manager             : 全員の "忙しさ指標のみ" read（閲覧列制限） / 自分 write
-- staff/cs/closer/toss: 自分分のみ read/write
-- ==============================================================

ALTER TABLE bloom_worker_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY bws_read_self ON bloom_worker_status
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY bws_read_manager_plus ON bloom_worker_status
  FOR SELECT USING (bloom_has_access('manager'));
  -- manager 向けの "忙しさ指標のみ" はクライアント側で SELECT 列を status に絞る運用

CREATE POLICY bws_write_self ON bloom_worker_status
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY bws_write_admin ON bloom_worker_status
  FOR ALL USING (bloom_has_access('admin')) WITH CHECK (bloom_has_access('admin'));

-- ---------------------------------------------------------------
ALTER TABLE bloom_daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY bdl_read_self      ON bloom_daily_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY bdl_read_admin     ON bloom_daily_logs FOR SELECT USING (bloom_has_access('admin'));
CREATE POLICY bdl_write_self     ON bloom_daily_logs FOR ALL    USING (user_id = auth.uid())
                                                                WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------
ALTER TABLE bloom_roadmap_entries ENABLE ROW LEVEL SECURITY;

-- ロードマップは staff 以上が閲覧可、編集は admin+
CREATE POLICY bre_read  ON bloom_roadmap_entries FOR SELECT USING (bloom_has_access('staff'));
CREATE POLICY bre_write ON bloom_roadmap_entries FOR ALL    USING (bloom_has_access('admin'))
                                                            WITH CHECK (bloom_has_access('admin'));

-- ---------------------------------------------------------------
ALTER TABLE bloom_project_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY bpp_read  ON bloom_project_progress FOR SELECT USING (bloom_has_access('staff'));
CREATE POLICY bpp_write ON bloom_project_progress FOR ALL    USING (bloom_has_access('admin'))
                                                             WITH CHECK (bloom_has_access('admin'));

-- ---------------------------------------------------------------
ALTER TABLE bloom_chatwork_config ENABLE ROW LEVEL SECURITY;

-- 機密のため super_admin のみ
CREATE POLICY bcc_rw ON bloom_chatwork_config FOR ALL
  USING (bloom_has_access('super_admin'))
  WITH CHECK (bloom_has_access('super_admin'));

-- ---------------------------------------------------------------
ALTER TABLE bloom_module_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY bmp_read  ON bloom_module_progress FOR SELECT USING (bloom_has_access('staff'));
CREATE POLICY bmp_write ON bloom_module_progress FOR ALL    USING (bloom_has_access('admin'))
                                                            WITH CHECK (bloom_has_access('admin'));

-- ---------------------------------------------------------------
ALTER TABLE bloom_monthly_digests ENABLE ROW LEVEL SECURITY;

-- 月次ダイジェスト: 閲覧は staff+、編集は admin+
CREATE POLICY bmd_read  ON bloom_monthly_digests FOR SELECT USING (bloom_has_access('staff'));
CREATE POLICY bmd_write ON bloom_monthly_digests FOR ALL    USING (bloom_has_access('admin'))
                                                            WITH CHECK (bloom_has_access('admin'));
```

---

## 2. TypeScript 型定義

### 2.1 ファイル配置

```
src/app/bloom/_types/
  ├── index.ts                 # re-export
  ├── worker-status.ts         # WorkerStatus + 定数
  ├── daily-log.ts             # DailyLog + PlannedItem + CompletedItem
  ├── roadmap.ts               # RoadmapEntry + ProjectProgress
  ├── module-progress.ts       # ModuleProgress + ModuleCode
  ├── monthly-digest.ts        # MonthlyDigest + DigestPage
  └── chatwork.ts              # ChatworkMessage + ChatworkConfig
```

### 2.2 型定義本体（抜粋）

```typescript
// src/app/bloom/_types/worker-status.ts
export type WorkerStatusKind = 'available' | 'busy_light' | 'focus' | 'away';

export const WORKER_STATUS_LABELS: Record<WorkerStatusKind, { icon: string; label: string; sub: string }> = {
  available:  { icon: '🟢', label: '対応可能',     sub: '質問・依頼OK' },
  busy_light: { icon: '🟡', label: '取り込み中',   sub: '電話可、メッセは後回し' },
  focus:      { icon: '🔴', label: '集中業務中',   sub: '緊急以外は避けて' },
  away:       { icon: '⚪', label: '外出中',       sub: '翌日以降対応' },
};

export type WorkerStatus = {
  user_id: string;
  status: WorkerStatusKind;
  status_note: string | null;
  until: string | null;           // ISO 8601
  updated_at: string;
  updated_by: string | null;
};
```

```typescript
// src/app/bloom/_types/daily-log.ts
export type PlannedItem = {
  title: string;
  estimate_min?: number;
  done_bool?: boolean;
};
export type CompletedItem = {
  title: string;
  actual_min?: number;
  notes?: string;
};
export type NextStep = {
  title: string;
  target_date?: string;           // YYYY-MM-DD
};
export type DailyLog = {
  id: string;
  user_id: string;
  log_date: string;               // YYYY-MM-DD
  planned_items: PlannedItem[];
  completed_items: CompletedItem[];
  next_steps: NextStep[];
  highlights: string | null;
  hours_logged: number | null;
  created_at: string;
  updated_at: string;
};
```

```typescript
// src/app/bloom/_types/roadmap.ts
export type RoadmapEntryKind = 'phase' | 'milestone' | 'module' | 'risk' | 'banner';
export type BannerSeverity = 'info' | 'warn' | 'critical';

export type RoadmapEntry = {
  id: string;
  kind: RoadmapEntryKind;
  parent_id: string | null;
  sort_order: number;
  label_dev: string;              // ⚙️開発向け
  label_ops: string | null;       // 👥みんな向け（null の場合は label_dev をフォールバック）
  description: string | null;
  target_month: string | null;    // 'M1' ~ 'M8'
  starts_on: string | null;
  due_on: string | null;
  completed_on: string | null;
  progress_pct: number | null;
  banner_severity: BannerSeverity | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type ProjectProgress = {
  id: string;
  roadmap_entry_id: string;
  snapshot_on: string;            // YYYY-MM-DD
  progress_pct: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};
```

```typescript
// src/app/bloom/_types/module-progress.ts
export type ModuleCode =
  | 'soil' | 'root' | 'tree' | 'leaf'
  | 'bud' | 'bloom' | 'forest' | 'rill' | 'seed';

export type ModuleStatus = 'planned' | 'in_progress' | 'at_risk' | 'done';

export type ModuleProgress = {
  module_code: ModuleCode;
  label_dev: string;
  label_ops: string;
  phase_label: string | null;
  progress_pct: number;
  status: ModuleStatus | null;
  last_updated_at: string;
  last_commit_sha: string | null;
  last_commit_at: string | null;
  display_order: number;
};

export const MODULE_DEFAULT_ORDER: ModuleCode[] = [
  'soil','root','tree','leaf','bud','bloom','forest','rill','seed',
];
```

```typescript
// src/app/bloom/_types/monthly-digest.ts
export type DigestPageKind =
  | 'cover' | 'achievements' | 'progress_graph'
  | 'next_month_goals' | 'work_summary' | 'custom';

export type DigestPage = {
  kind: DigestPageKind;
  title: string;
  body: string;                   // Markdown 可
  image_url?: string;
  data_payload?: unknown;         // グラフデータ等
};

export type MonthlyDigestStatus = 'draft' | 'published' | 'archived';

export type MonthlyDigest = {
  id: string;
  digest_month: string;           // YYYY-MM-DD（月初）
  status: MonthlyDigestStatus;
  title: string;
  summary: string | null;
  pages: DigestPage[];
  published_at: string | null;
  published_by: string | null;
  pdf_url: string | null;
  image_urls: Record<number, string> | null;   // { [pageIndex]: url }
  created_at: string;
  updated_at: string;
};
```

```typescript
// src/app/bloom/_types/chatwork.ts
export type ChatworkKind = 'daily' | 'weekly' | 'monthly' | 'alert';

export type ChatworkConfig = {
  id: 1;
  api_token: string | null;
  room_id_progress: string | null;
  room_id_alert: string | null;
  enabled: boolean;
  last_success_at: string | null;
  last_error: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type ChatworkMessage = {
  kind: ChatworkKind;
  room_id: string;
  body: string;                   // Chatwork 記法対応
  file_path?: string;             // 画像等（Supabase Storage ローカルパス）
  send_at?: string;               // 遅延送信指示
};
```

```typescript
// src/app/bloom/_types/index.ts
export * from './worker-status';
export * from './daily-log';
export * from './roadmap';
export * from './module-progress';
export * from './monthly-digest';
export * from './chatwork';
```

---

## 3. Next.js ページ構造

### 3.1 ファイルツリー

```
src/app/bloom/
  ├── layout.tsx                 # BloomStateProvider + BloomGate でラップ（Forest 流用）
  ├── page.tsx                   # Bloom ホーム（各画面へのナビ）
  ├── login/
  │    └── page.tsx              # ※ Forest 認証を流用するため任意。実装不要なら /forest/login リダイレクト
  ├── workboard/
  │    ├── page.tsx              # 個人可視化（薄い層、汎用 components を組み合わせ）
  │    ├── components/           # 汎用（Bloom 外移植可）
  │    │    ├── WorkerStatusCard.tsx
  │    │    ├── TodayPlanList.tsx
  │    │    ├── RunningProjectCard.tsx
  │    │    ├── WeeklyAchievement.tsx
  │    │    └── NextMilestoneCard.tsx
  │    ├── _lib/                 # データ層（汎用）
  │    │    ├── status-queries.ts
  │    │    ├── daily-log-queries.ts
  │    │    └── mutations.ts
  │    └── _types.ts             # workboard 固有の View 用型
  ├── roadmap/
  │    ├── page.tsx              # 全体ロードマップ
  │    ├── components/
  │    │    ├── OverallProgressBar.tsx
  │    │    ├── TimelineChart.tsx            # M1-M8
  │    │    ├── ModuleProgressGrid.tsx
  │    │    ├── RiskCardList.tsx
  │    │    └── AnnouncementBanner.tsx
  │    └── _lib/
  │         ├── roadmap-queries.ts
  │         └── progress-aggregator.ts
  ├── monthly-digest/
  │    ├── page.tsx              # 一覧（過去分含む）
  │    ├── [month]/
  │    │    ├── page.tsx         # 1 月分の表示（大画面投影モード）
  │    │    ├── edit/page.tsx    # 編集画面（admin+）
  │    │    └── export/route.ts  # /api ルートで PDF 生成
  │    ├── components/
  │    │    ├── DigestCoverPage.tsx
  │    │    ├── AchievementsPage.tsx
  │    │    ├── ProgressGraphPage.tsx
  │    │    ├── NextMonthGoalsPage.tsx
  │    │    ├── WorkSummaryPage.tsx
  │    │    └── ProjectionViewer.tsx         # 投影モード切替
  │    └── _lib/
  │         ├── digest-queries.ts
  │         ├── pdf-export.ts
  │         └── image-export.ts
  ├── daily-reports/
  │    └── page.tsx              # 日報統合（既存 send_report.py データを読み込み、新規は bloom_daily_logs）
  ├── _components/               # Bloom 全体で共有（Shell / Gate / AccessDenied / ViewModeToggle）
  │    ├── BloomShell.tsx
  │    ├── BloomGate.tsx
  │    ├── AccessDenied.tsx
  │    ├── BloomNavBar.tsx
  │    ├── ViewModeToggle.tsx    # 👥/⚙️ 切替
  │    └── LoadingSpinner.tsx
  ├── _state/
  │    ├── BloomStateContext.tsx # 認証 + viewMode + データキャッシュ
  │    └── ViewModeContext.tsx   # 'simple' | 'detail' + localStorage
  ├── _lib/
  │    ├── auth.ts               # Forest 流用（社員番号→擬似メール→Supabase Auth）
  │    ├── supabase.ts           # Forest 流用
  │    ├── permissions.ts        # bloom_has_access 同等の TS 版
  │    ├── term-mapping.ts       # 👥/⚙️ 用語変換マップ
  │    └── format.ts             # 日付・進捗率等のフォーマッタ
  ├── _constants/
  │    ├── colors.ts             # Forest 流用（グリーン系）
  │    ├── theme.ts              # Forest 流用
  │    └── routes.ts             # BLOOM_PATHS 定数
  └── _types/                    # §2 で列挙
       └── ...
```

### 3.2 layout.tsx（Forest 流用パターン）

```typescript
// src/app/bloom/layout.tsx
import type { ReactNode } from "react";
import { BloomStateProvider } from "./_state/BloomStateContext";
import { ViewModeProvider } from "./_state/ViewModeContext";
import { BloomGate } from "./_components/BloomGate";
import { BloomShell } from "./_components/BloomShell";

export const metadata = { title: "Garden-Bloom — Workboard" };

export default function BloomLayout({ children }: { children: ReactNode }) {
  return (
    <BloomStateProvider>
      <ViewModeProvider>
        <BloomGate>
          <BloomShell>{children}</BloomShell>
        </BloomGate>
      </ViewModeProvider>
    </BloomStateProvider>
  );
}
```

### 3.3 BloomStateContext（ForestStateContext の写像）

`ForestStateContext` の構造を踏襲し、以下を保持：
- `loading / isAuthenticated / hasPermission / isUnlocked`
- `userEmail / bloomUser`（= `root_employees` をそのまま利用するため型名のみ）
- `workerStatuses / dailyLogs / roadmapEntries / moduleProgress / monthlyDigests`
- `refreshData / refreshAuth / unlock / lockAndLogout`

**bloom_users テーブルは作らない**。`forestUser` に相当する `bloomUser` は `root_employees` 行の薄いラッパ型とする：
```typescript
export type BloomUser = {
  user_id: string;
  employee_no: string;
  name: string;
  garden_role: string;  // 'toss'..'super_admin'
  birthday: string | null;
};
```
読み取り元は `root_employees` の既存クエリを流用。

### 3.4 汎用コンポーネント責任範囲

| Component | 責任 | 主要 props |
|---|---|---|
| `WorkerStatusCard` | 現在ステータス表示 + 自己更新ボタン | `status: WorkerStatusKind`, `onUpdate(next)` |
| `TodayPlanList` | 本日の予定 3-5 項目 | `items: PlannedItem[]`, `onToggle(i)` |
| `RunningProjectCard` | 進行中プロジェクト 1 枚 | `project: RoadmapEntry` |
| `WeeklyAchievement` | 今週の実績（達成率・コミット数）| `stats: { commits, hours, pct }` |
| `NextMilestoneCard` | 次のマイルストーン | `milestone: RoadmapEntry` |
| `OverallProgressBar` | 全体進捗バー | `entries: RoadmapEntry[]` |
| `TimelineChart` | M1-M8 タイムライン | `entries: RoadmapEntry[]` |
| `ModuleProgressGrid` | 9 モジュール別グリッド | `modules: ModuleProgress[]` |
| `RiskCardList` | リスクカード | `risks: RoadmapEntry[]` |
| `AnnouncementBanner` | お知らせバナー | `banners: RoadmapEntry[]` |
| `DigestCoverPage` 他 | 月次ダイジェストの各ページ（1 頁 1 情報） | `digest: MonthlyDigest` |
| `ProjectionViewer` | 投影モード切替（全画面・文字大）| `digest, pageIndex` |
| `ViewModeToggle` | 👥⚙️ 切替 | なし（ViewModeContext 経由） |

---

## 4. Chatwork 連携ライブラリ設計

### 4.1 ディレクトリ構成（**Bloom 外の共有ライブラリ**）

```
src/lib/chatwork/
  ├── client.ts                 # Chatwork API クライアント（fetch ベース）
  ├── types.ts                  # Chatwork API 型（Room / Message / File 等）
  ├── templates/
  │    ├── daily.ts             # 日次通知テンプレ
  │    ├── weekly.ts            # 週次通知テンプレ
  │    ├── monthly.ts           # 月次通知テンプレ
  │    └── alert.ts             # 重要アラート
  ├── webhook.ts                # Webhook 検証・受信ハンドラ
  └── secrets.ts                # トークンの読み出し（pgcrypto or env）
```

`src/app/bloom/` 内ではなく `src/lib/` に置く理由:
- 将来 Rill（チャット本体）や他モジュールから再利用可能にする
- Bloom から移植する際も Chatwork ライブラリはそのまま共有

### 4.2 API ラッパー（`client.ts`）

```typescript
// src/lib/chatwork/client.ts
const BASE = 'https://api.chatwork.com/v2';

export class ChatworkClient {
  constructor(private apiToken: string) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'X-ChatWorkToken': this.apiToken, ...init.headers },
    });
    if (!res.ok) throw new ChatworkError(res.status, await res.text());
    return res.json() as Promise<T>;
  }

  sendMessage(roomId: string, body: string, opts?: { selfUnread?: boolean }) {
    const params = new URLSearchParams({
      body,
      self_unread: opts?.selfUnread ? '1' : '0',
    });
    return this.request<{ message_id: string }>(
      `/rooms/${roomId}/messages`,
      { method: 'POST', body: params },
    );
  }

  uploadFile(roomId: string, file: File | Blob, opts: { message?: string }) {
    const form = new FormData();
    form.append('file', file);
    if (opts.message) form.append('message', opts.message);
    return this.request<{ file_id: string }>(
      `/rooms/${roomId}/files`,
      { method: 'POST', body: form },
    );
  }

  getRoom(roomId: string) {
    return this.request<{ room_id: number; name: string }>(`/rooms/${roomId}`);
  }
}

export class ChatworkError extends Error {
  constructor(public status: number, public raw: string) { super(`Chatwork ${status}: ${raw}`); }
}
```

### 4.3 Webhook 受信ハンドラ

```typescript
// src/lib/chatwork/webhook.ts
import { createHmac } from 'crypto';

export function verifyChatworkWebhook(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest('base64');
  return expected === signature;
}

// Next.js Route: src/app/api/chatwork/webhook/route.ts（別途実装）
// POST: body を verify → 通知種別に応じて bloom_* テーブル側でアクション
```

### 4.4 Vercel Cron 設定（`vercel.json`）

```json
{
  "crons": [
    { "path": "/api/bloom/cron/daily",   "schedule": "0 9 * * *"  },
    { "path": "/api/bloom/cron/weekly",  "schedule": "0 9 * * 5"  },
    { "path": "/api/bloom/cron/monthly", "schedule": "0 9 14 * *" }
  ]
}
```

※ Vercel Cron は UTC。日本時間 18:00 = UTC 09:00（サマータイムなし）。
※ route は `src/app/api/bloom/cron/{daily,weekly,monthly}/route.ts` に実装（本設計書のスコープ外、a-bloom 実装時に作成）。

### 4.5 通知テンプレート文面

#### 日次（`templates/daily.ts`）
```
[info][title]📅 Garden 日次進捗（{YYYY-MM-DD}）[/title]
✅ 完了タスク: {done_count} 件
📌 今日のハイライト:
{highlights_bullets}

📅 明日の予定:
{tomorrow_bullets}

📊 Garden 全体進捗: {overall_pct}%（先週比 {diff_pct:+d}%）
🔗 詳細: {bloom_url}/roadmap
[/info]
```

#### 週次（`templates/weekly.ts`）
```
[info][title]📊 Garden 週次サマリ（{week_label}）[/title]
🎯 今週の成果:
{weekly_achievements}

📈 月次目標達成率: {monthly_goal_pct}%

⚠️ アラート:
{alerts_or_none}

🔗 グラフ画像（週次進捗）→ 添付
🔗 詳細: {bloom_url}/roadmap
[/info]
```

#### 月次（`templates/monthly.ts`）— 会議前日
```
[info][title]📆 {month} 月次ダイジェスト（明日の会議資料）[/title]
東海林です。明日の責任者会議用の月次ダイジェストを添付します。

📄 PDF: {pdf_url}
🖼️ サムネイル画像（各ページ）: 本メッセージに添付

会議前にご確認ください。
[/info]
```

#### 重要アラート（`templates/alert.ts`）
```
[info][title]🚨 {severity_label} — {subject}[/title]
発生: {occurred_at}
影響範囲: {scope}
内容: {detail}

🔗 詳細: {url}
[/info]
```

---

## 5. 表示切替機能設計（ViewMode）

### 5.1 ViewModeContext

```typescript
// src/app/bloom/_state/ViewModeContext.tsx
'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ViewMode = 'simple' | 'detail';
const STORAGE_KEY = 'bloom:viewMode';

type Ctx = { mode: ViewMode; setMode: (m: ViewMode) => void; toggle: () => void };
const ViewModeContext = createContext<Ctx | null>(null);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>('simple');

  // マウント時に localStorage 復元（SSR 配慮）
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'simple' || saved === 'detail') setModeState(saved);
    } catch { /* ignore */ }
  }, []);

  const setMode = (m: ViewMode) => {
    setModeState(m);
    try { window.localStorage.setItem(STORAGE_KEY, m); } catch { /* ignore */ }
  };
  const toggle = () => setMode(mode === 'simple' ? 'detail' : 'simple');

  return (
    <ViewModeContext.Provider value={{ mode, setMode, toggle }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const ctx = useContext(ViewModeContext);
  if (!ctx) throw new Error('useViewMode must be used inside ViewModeProvider');
  return ctx;
}
```

### 5.2 用語変換マッピング（`term-mapping.ts`）

```typescript
// src/app/bloom/_lib/term-mapping.ts
import type { ViewMode } from '../_state/ViewModeContext';

export const TERM_MAP: Record<string, { simple: string; detail: string }> = {
  // Phase
  phase_a: { simple: '経理総務の効率化',    detail: 'Phase A' },
  phase_b: { simple: '事務業務の効率化',    detail: 'Phase B' },
  phase_c: { simple: '補完モジュール',      detail: 'Phase C' },
  phase_d: { simple: 'コールシステム切替',  detail: 'Phase D' },
  // Module
  'module.bud':    { simple: '経理ソフト',           detail: 'Garden-Bud' },
  'module.forest': { simple: '経営ダッシュボード',   detail: 'Garden-Forest' },
  'module.root':   { simple: '従業員マスタ',         detail: 'Garden-Root' },
  'module.leaf':   { simple: '関電業務アプリ',       detail: 'Garden-Leaf' },
  'module.tree':   { simple: '架電アプリ',           detail: 'Garden-Tree' },
  'module.soil':   { simple: 'データ基盤',           detail: 'Garden-Soil' },
  'module.bloom':  { simple: '進捗ダッシュボード',   detail: 'Garden-Bloom' },
  'module.rill':   { simple: 'チャット連携',         detail: 'Garden-Rill' },
  'module.seed':   { simple: '新事業枠',             detail: 'Garden-Seed' },
  // Branch / Commit 用語
  'branch': { simple: '作業コース',        detail: 'ブランチ' },
  'commit': { simple: '作業の保存',        detail: 'コミット' },
  'pr':     { simple: '変更反映の依頼',    detail: 'Pull Request' },
  // 進捗率
  'progress_with_context_dev':    { simple: '', detail: 'Phase A 22%（M1 目標 30%）' },
  'progress_with_context_simple': { simple: '22%', detail: '' },
};

export function t(key: string, mode: ViewMode): string {
  const entry = TERM_MAP[key];
  if (!entry) return key;                    // フォールバック: キーそのまま
  return entry[mode] || entry.detail;
}
```

### 5.3 localStorage 保存方式

- キー: `bloom:viewMode`
- 値: `'simple'` or `'detail'`
- 初期値: `'simple'`（👥みんな向け優先）
- `super_admin / admin` でも初期は `'simple'`（会議中に共有しやすい側をデフォルトに）
- **ブラウザ間同期はしない**（個人設定扱い）

### 5.4 UI 配置

- `ViewModeToggle` コンポーネントを `BloomShell` 右上に固定配置
- 表記: `👥 みんな向け / ⚙️ 開発向け`
- トグル操作時に **即座に全画面再描画**（props drilling ではなく Context 経由）

---

## 6. 月次ダイジェスト画面仕様

### 6.1 投影モード要件

| 要件 | 仕様 |
|---|---|
| 1 ページ 1 情報 | 縦スクロールではなく**スライドショー**。PageUp/PageDown キー・矢印キーで切替 |
| 文字サイズ | 本文は `clamp(18px, 2.2vw, 36px)`、タイトルは `clamp(28px, 4vw, 72px)` |
| カラー | Forest 流用のグリーン系 + 達成ゴールド（Tree 設計と整合） |
| ショートカット | `F` キー or ボタンで `requestFullscreen()` |
| 進行インジケータ | 下部に小さく `1 / 6` ページ番号 |
| 離席時非表示 | 操作無しで 5 分経過したらロゴ画面に戻す（機密保護） |

### 6.2 PDF エクスポート候補比較

| 候補 | 採否推定 | 理由 |
|---|---|---|
| **`@react-pdf/renderer`** | 🟢 **推奨** | React コンポーネントでレイアウトを宣言的に書ける。MonthlyDigest の各 Page コンポーネントをそのまま PDF コンポーネントに再マップ可。Node / Edge 両対応（ただし Edge だとフォント埋め込みに工夫必要） |
| `jspdf` + `html2canvas` | 🟡 候補 | 既存 HTML を画像経由で PDF 化。文字検索性が落ちる。日本語フォント埋め込みが煩雑 |
| `puppeteer` / `playwright` サーバサイド | 🔴 非推奨 | Vercel で serverless だと重量級。Cron 時に起動コスト大 |
| `pdf-lib` | 🟡 候補 | 既存 PDF 加工に強いが、ゼロから作る用途では `@react-pdf` のほうが素直 |

**推奨採用**: `@react-pdf/renderer` + 日本語 Noto Sans JP フォント埋め込み。

PDF 生成は `/api/bloom/monthly-digest/[month]/export/route.ts`（Route Handler）で Node ランタイム実行。生成 Blob を **Supabase Storage `bloom-digests/` bucket にアップロード**→ `bloom_monthly_digests.pdf_url` に保存。

### 6.3 画像保存候補比較

| 候補 | 採否推定 | 理由 |
|---|---|---|
| **`html2canvas`** | 🟢 **推奨** | ブラウザ側で各ページの DOM → PNG 変換。Chatwork 貼付用にちょうど良い。ただし SVG グラフに弱点がある場合あり |
| `dom-to-image` | 🟡 候補 | html2canvas と同系。SVG 対応良い |
| `satori` + `@vercel/og` | 🟡 候補 | サーバサイド生成、OG 画像用の標準。ページ構造が単純なら綺麗 |

**推奨採用**: 各 Page が Chart.js 等の canvas ベースなら `html2canvas` で十分。SVG 多用なら `dom-to-image-more`。

### 6.4 ページ構成（`pages` jsonb の既定パターン）

1. **表紙**（`cover`）: タイトル / 月 / 作成者 / ロゴ
2. **今月の主要達成**（`achievements`）: 3-5 項目の箇条書き + アイコン
3. **全体進捗グラフ**（`progress_graph`）: Chart.js の週次推移
4. **来月の目標**（`next_month_goals`）: Phase の目標・ハイライト
5. **稼働サマリ**（`work_summary`）: 自分の稼働時間・コミット数・PR 数（auto モードは「AI アシスト」と曖昧化）
6. **カスタム**（`custom`）: 任意追加

---

## 7. 疎結合設計ガイドライン

### 7.1 依存の境界線

| カテゴリ | Bloom 依存 | Bloom 非依存（汎用） |
|---|---|---|
| DB テーブル | `bloom_*` プレフィックス | `root_employees` 等の既存マスタ |
| コンポーネント | `_components/BloomShell` 等 | `workboard/components/` 配下 |
| データ層 | `_state/BloomStateContext` | `workboard/_lib/*-queries.ts` |
| API route | `/api/bloom/...` | `src/lib/chatwork/*` |
| 定数 | `_constants/routes.ts` | `_constants/colors.ts`, `theme.ts` |

**ルール**:
- 「workboard/components/」「workboard/_lib/」「_types/」は **Bloom を import しない**（モジュール外に出ても動く）
- 「_components/」「_state/」は Bloom 依存 OK
- テーブル名は必ず `bloom_*` で始める

### 7.2 将来 Seed への移植手順（具体ステップ）

1. **新モジュールの雛形作成**
   ```
   cp -r src/app/bloom/workboard/components src/app/seed/workboard/components
   cp -r src/app/bloom/workboard/_lib      src/app/seed/workboard/_lib
   cp -r src/app/bloom/_types              src/app/seed/_types
   ```
2. **テーブル rename**（Supabase SQL）
   ```sql
   ALTER TABLE bloom_worker_status RENAME TO seed_worker_status;
   -- 同様に daily_logs, roadmap_entries, project_progress, module_progress
   -- monthly_digests は Bloom 残し（会議資料は Bloom に残す場合）
   ```
3. **クエリ層の書き換え**（参照テーブル名の一括置換）
   - `src/app/seed/**/*.ts` で `"bloom_` → `"seed_` 文字列置換
4. **State Context の差替**
   - `BloomStateContext` → `SeedStateContext` にリネーム、新 provider へ切替
5. **ルーティング・レイアウト**
   - `/bloom/*` → `/seed/*` の新ルート作成、旧ルートは一定期間 redirect
6. **Chatwork 連携**
   - ルーム ID を新規発行し、`seed_chatwork_config` へ切替
7. **動作確認**
   - 既存 Bloom と並行運用で動作確認 → 完全切替

**想定所要時間**: 1〜2 時間（複雑な機能追加が無い前提）

### 7.3 テーブル名プレフィックス規則

| プレフィックス | 意味 |
|---|---|
| `root_*` | Garden-Root（マスタ）— 削除・破壊的変更禁止 |
| `soil_*` | Garden-Soil（大量データ基盤） |
| `tree_*` | Garden-Tree |
| `leaf_*` / `soil_kanden_*` | Garden-Leaf（商材テーブル。大量系は soil 側に置く例外あり） |
| `bud_*` | Garden-Bud |
| `bloom_*` | Garden-Bloom — **本設計書のスコープ** |
| `forest_*` / `companies` / `fiscal_periods` / `shinkouki` | Garden-Forest（既存命名のため非プレフィックスも存在） |
| `rill_*` | Garden-Rill |
| `seed_*` | Garden-Seed |

**注意**:
- Forest は既存テーブル `companies` / `fiscal_periods` / `shinkouki` がプレフィックスなし。**新規テーブルは `forest_*` プレフィックス必須**（親 CLAUDE.md §5 の統合方針に従う）
- Bloom は**全テーブル `bloom_*` 必須**（移植容易化の核）

---

## 8. Supabase Auth との統合

### 8.1 Forest 認証フローの流用

Forest 既存の以下を Bloom で**そのまま流用**（コピー＋リネームのみ）:

| Forest ファイル | Bloom 対応ファイル | 変更点 |
|---|---|---|
| `forest/_lib/auth.ts` | `bloom/_lib/auth.ts` | `FOREST_UNLOCK_KEY` → `BLOOM_UNLOCK_KEY`、関数名 `signInForest` → `signInBloom` |
| `forest/_lib/session-timer.ts` | `bloom/_lib/session-timer.ts` | セッションタイムアウト（2h）同一、storage key のみ差替 |
| `forest/_lib/supabase.ts` | `bloom/_lib/supabase.ts` | 完全同一（Supabase クライアント singleton） |
| `forest/_components/ForestGate.tsx` | `bloom/_components/BloomGate.tsx` | import 先だけ差替 |
| `forest/_state/ForestStateContext.tsx` | `bloom/_state/BloomStateContext.tsx` | データ対象（companies→modules 等）のみ差替 |

### 8.2 `bloom_users` を作らない設計

Forest は `forest_users` テーブル（permission-scoped）を持つが、**Bloom は作らない**:

```typescript
// bloom/_lib/auth.ts（抜粋）
export async function fetchBloomUser(userId: string): Promise<BloomUser | null> {
  const { data, error } = await supabase
    .from('root_employees')
    .select('user_id, employee_no, name, garden_role, birthday')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`fetchBloomUser failed: ${error.message}`);
  return data as BloomUser | null;
}
```

**判断理由**:
1. Bloom は「全社員が見える化対象」であり、Forest のような**招待制**ではない
2. `root_employees.garden_role` が既に 7 段階でロール定義されており、十分に粒度がある
3. 追加テーブルを作るとメンテ負荷が増え、Seed 移植時の手間が増える

### 8.3 RLS 関数の再利用

Forest 側に既に `forest_has_access()` / `forest_is_admin()` 相当があれば、本設計書 §1.4 の `bloom_has_access()` は**同一ロジック**。
可能なら親スキーマ側に `garden_role_rank(text)` / `garden_has_access(text)` を置いて**両モジュールで共有**する改善案あり（本設計書では安全サイドで `bloom_*` 独立関数を用意）。

### 8.4 権限マッピング（Bloom CLAUDE.md §権限設計 準拠）

| ロール | 実装で表現 |
|---|---|
| `super_admin` | 全員分 + 全編集（`bloom_has_access('super_admin')`） |
| `admin` | 全員分 read + ロードマップ/月次ダイジェスト編集（`bloom_has_access('admin')`） |
| `manager` | **全員の忙しさ指標のみ** read + 自分の詳細（RLS は読めるが、**クライアントで SELECT 列を `status` のみに絞る**運用） |
| `staff` / `cs` / `closer` / `toss` | 自分分のみ |

> manager の「忙しさ指標のみ」は DB 側で SELECT 列制限しにくいため、**クライアント実装で絞る**。将来的には View（`bloom_worker_status_public`）を切って RLS で列制限するのが理想。

---

## 9. Phase A-1 タスク分解（a-bloom 引き渡し用・参考）

| # | タスク | 見積 | 依存 | 補足 |
|---|---|---|---|---|
| T1 | Supabase migration 実行（§1）| 0.5d | — | `scripts/bloom-schema.sql` + `bloom-rls.sql` 投入 |
| T2 | 型定義・定数（§2）| 0.25d | — | auto で生成可能 |
| T3 | 認証・Shell・Gate（§8、Forest コピー）| 0.5d | T2 | `_components/_state/_lib` 流用 |
| T4 | Workboard 画面（§3.1）| 0.5d | T3 | WorkerStatusCard + TodayPlanList 等 |
| T5 | Roadmap 画面（§3.1）| 0.5d | T3 | OverallProgressBar + TimelineChart |
| T6 | 月次ダイジェスト画面（§6）| 0.5d | T3 | 投影モード・PDF export |
| T7 | ViewMode 切替（§5）| 0.25d | T3 | toggle + localStorage |
| T8 | Chatwork 連携基盤（§4.1-4.3）| 0.25d | — | `src/lib/chatwork/` 新設 |
| T9 | Cron 3 本（§4.4-4.5）| 1.0d | T8, T1 | vercel.json + Route Handler 3 本 |
| T10 | 疎結合化仕上げ（§7）| 0.25d | 全部 | ESLint ルール等で依存境界をチェック |
| **Phase A-1 合計** | | **約 4.0d** | | （Bloom CLAUDE.md の工数と一致） |

---

## 10. 付録

### 10.1 参考ファイル
- [Bloom CLAUDE.md（本日更新）](file:///G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/015_Gardenシリーズ/06_Garden-Bloom/CLAUDE.md)
- [Forest ForestStateContext.tsx](C:/garden/a-auto/src/app/forest/_state/ForestStateContext.tsx)
- [Forest ForestGate.tsx](C:/garden/a-auto/src/app/forest/_components/ForestGate.tsx)
- [Forest layout.tsx](C:/garden/a-auto/src/app/forest/layout.tsx)
- [garden-release-roadmap-20260424.md](../garden-release-roadmap-20260424.md)
- [forest-v9-to-tsx-migration-plan.md](../forest-v9-to-tsx-migration-plan.md)

### 10.2 本設計書が明示的にカバーしない範囲
- **既存 `send_report.py` との統合詳細**（Bloom daily_logs との双方向同期は T6 後の別Phase）
- **Tree KPI との統合**（Phase D 以降）
- **Leaf 案件データとの統合**（Phase B 以降）
- **Bud 営業損益との統合**（Phase A-2 以降）
- **Chatwork Webhook の具体ハンドラ**（受信した通知ごとの処理は T9 実装時に仕様化）
- **バックアップ / リストア手順**（Supabase スナップショット運用は親ルール側で規定）

### 10.3 判断保留事項（a-bloom 実装時に再確認）
| 判# | 論点 | 推定スタンス |
|---|---|---|
| 判1 | Chatwork API トークンの暗号化方式（pgcrypto / env / Vault） | pgcrypto（DB 内で完結、運用が楽） |
| 判2 | PDF 生成のランタイム（Node / Edge） | Node（日本語フォント埋込のため） |
| 判3 | `bloom_monthly_digests.pages` の JSON スキーマ厳格化 | 当面は `DigestPage` 型で運用、厳格化は v2 で |
| 判4 | manager の「忙しさ指標」実装（クライアント絞込 / View） | まずクライアント絞込、パフォーマンス課題が出たら View 切替 |
| 判5 | Bloom 独自ログイン画面 | 当面は `/forest/login` へリダイレクト、将来 Bloom 固有ブランディング必要なら分離 |

— end of scaffold —
