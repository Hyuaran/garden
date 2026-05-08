# Tree Phase D 統合実装プラン v3（FileMaker 代替・コールセンター本番投入）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Garden Tree を FileMaker 完全代替として本番稼働させる。架電業務の DB スキーマ・オペレーター UI・マネージャー UI・トスアップ Leaf 連携・KPI ダッシュボード・テスト戦略を 6 spec から統合し、Tree 特例（§17 1人→2-3人→半数→全員）の慎重展開で FM 切替まで完走する。

**Architecture:**
1. **DB foundation** (D-01): 3 テーブル（`tree_calling_sessions` / `tree_call_records` / `tree_agent_assignments`）+ 4 ロール RLS + 2 集計 Trigger + 2 VIEW + 監査 Trigger
2. **Server Actions** (D-02/D-04): セッション開閉・トス転記の単一トランザクション関数
3. **Client UI** (D-02/D-03/D-05): FM 互換ショートカット + オフラインキュー + 30s polling マネージャー画面 + Recharts KPI 画面
4. **Leaf 連携** (D-04): `SECURITY DEFINER` 関数で `tree_call_records` UPDATE と `soil_kanden_cases` INSERT を 1 トランザクション化、夜間整合性 Cron で補正
5. **Test foundation** (D-06): Vitest 85%/RTL 75%/Playwright 10 flow + axe-core + Lighthouse、§16 7種テスト + §17 5段階 rollout で本番投入

**Tech Stack:** Next.js 16 App Router (Server Actions / RSC) / Supabase (PostgreSQL + RLS + Realtime 候補) / TypeScript strict / Vitest 4 + jsdom / @testing-library/react / Playwright / Recharts / TanStack Table / sonner / axe-core / Lighthouse CI

**前提となる既存資産:** Tree Phase A (認証 + 7 段階ロール) / Tree Phase B (通話履歴 INSERT) / Tree Phase B-β (誕生日同期 + マイページ変更) / Root Phase A-3-h (`root_employees` 拡張) / Soil 既存テーブル (`soil_call_lists` / `soil_call_histories` / `soil_kanden_cases`) / Leaf C-03 (関電事務入力ウィザード)

---

## 0. プラン全体構造とナビゲーション

| Section | 対応 spec | タスク数 | 見積 (h) | 見積 (d) |
|---|---|---:|---:|---:|
| §0 Pre-flight | — | 3 | 1.0 | 0.125 |
| §1 D-01 Schema migrations | spec-tree-phase-d-01 | 12 | 5.6 | 0.7 |
| §2 D-06 Test scaffolding | spec-tree-phase-d-06 (early) | 3 | 2.0 | 0.25 |
| §3 D-02 Operator UI | spec-tree-phase-d-02 | 13 | 9.0 | 1.125 |
| §4 D-04 Tossup flow | spec-tree-phase-d-04 | 7 | 7.0 | 0.875 |
| §5 D-03 Manager UI | spec-tree-phase-d-03 | 8 | 8.0 | 1.0 |
| §6 D-05 KPI dashboard | spec-tree-phase-d-05 | 9 | 7.5 | 0.94 |
| §7 D-06 E2E + 受入 | spec-tree-phase-d-06 (final) | 8 | 8.0 | 1.0 |
| §8 §16 7種テスト完走 | 親CLAUDE.md §16 | 1 | 4.0 | 0.5 |
| §9 α (東海林1人) | 親CLAUDE.md §17 | 3 | — | — |
| §10 β 1人〜全員 + FM 切替 | 親CLAUDE.md §17 Tree 特例 | 5 | — | — |
| **合計（実装まで）** | | **69** | **52.1h** | **6.5d** |
| **合計（α+β含む）** | | **77** | — | + 5週間 (現場検証期間) |

**実装純工数 6.5d は Batch 9 当初見積 4.5d + Tree 🔴 最厳格分 +0.6d の合計 5.1d を上回る。** 上振れ理由: §0 Pre-flight + §2 Test scaffolding を独立タスク化、§8 §16 7種テスト全完走を独立日として確保したため。これは Tree 特例（失敗厳禁）に必要な保険工数。

---

## 1. ファイル構成（全体像）

### 新規作成ファイル

#### Migrations (Supabase SQL)

| パス | 責務 |
|---|---|
| `supabase/migrations/20260601_01_tree_calling_sessions.sql` + `down.sql` | セッション集約テーブル |
| `supabase/migrations/20260601_02_tree_call_records.sql` + `down.sql` | コール 1 件 1 行（result / rollback / toss pointer） |
| `supabase/migrations/20260601_03_tree_agent_assignments.sql` + `down.sql` | 1:1 アクティブリストロック |
| `supabase/migrations/20260601_04_soil_link_columns.sql` + `down.sql` | Soil 側に Tree への双方向リンク |
| `supabase/migrations/20260601_05_tree_rls_policies.sql` + `down.sql` | 4 ロール RLS |
| `supabase/migrations/20260601_06_tree_views.sql` + `down.sql` | `v_tree_operator_today` + `v_tree_legacy_history` |
| `supabase/migrations/20260601_07_audit_triggers.sql` + `down.sql` | 6 イベント監査連携 |
| `supabase/migrations/20260601_08_kpi_materialized_views.sql` + `down.sql` | KPI 用 MV 3 本（D-05） |
| `supabase/migrations/20260601_09_tree_toss_to_leaf_function.sql` + `down.sql` | D-04 トランザクション関数（SECURITY DEFINER） |

#### TypeScript / React

| パス | 責務 |
|---|---|
| `src/app/tree/_actions/session.ts` | セッション open / close Server Action |
| `src/app/tree/_actions/tossToLeaf.ts` | トスアップ転記 Server Action |
| `src/app/tree/_actions/tossPayloadSchema.ts` | zod バリデーション |
| `src/app/tree/_actions/__tests__/*.test.ts` | Server Action Vitest |
| `src/app/tree/_hooks/useCallShortcuts.ts` | F1-F10 + Ctrl+Z/←/→/Esc/Enter |
| `src/app/tree/_hooks/useCallRollback.ts` | 5 秒 rollback タイマー |
| `src/app/tree/_hooks/__tests__/*.test.ts` | Hook Vitest |
| `src/app/tree/_lib/offlineQueue.ts` | localStorage キュー + flush |
| `src/app/tree/_lib/kpiAggregations.ts` | KPI 集計関数（MV からの読出） |
| `src/app/tree/_lib/__tests__/*.test.ts` | _lib Vitest |
| `src/app/tree/_components/CallGuard.tsx` | 通話中の SPA 内遷移ガード |
| `src/app/tree/_components/Toast.tsx` | sonner ベース統一 toast |
| `src/app/tree/_components/CallShortcutHelp.tsx` | F1-F10 ヘルプモーダル |
| `src/app/tree/_components/__tests__/*.test.tsx` | RTL |
| `src/app/tree/kpi/page.tsx` | KPI 画面（新設） |
| `src/app/tree/kpi/_components/KPICard.tsx` | KPI カード |
| `src/app/tree/kpi/_components/KPITrendChart.tsx` | Recharts 折れ線 |
| `src/app/tree/kpi/_components/KPIRanking.tsx` | TanStack Table |
| `src/app/tree/kpi/_components/ExportButtons.tsx` | CSV / Excel エクスポート |
| `src/app/tree/kpi/_lib/guard.ts` | サーバー側権限ガード |
| `src/app/tree/kpi/__tests__/*.test.ts` | RTL + Vitest |
| `src/app/api/tree/cron/refresh-mv/route.ts` | MV REFRESH Cron |
| `src/app/api/tree/cron/toss-integrity/route.ts` | D-04 整合性ジョブ Cron |
| `src/app/api/tree/cron/__tests__/*.test.ts` | Cron Vitest |
| `tests/e2e/tree/sprout.spec.ts` | Playwright Sprout flow |
| `tests/e2e/tree/branch.spec.ts` | Playwright Branch flow |
| `tests/e2e/tree/rollback.spec.ts` | rollback 5s boundary |
| `tests/e2e/tree/shortcuts.spec.ts` | F1-F10 |
| `tests/e2e/tree/toss.spec.ts` | 2-step wizard |
| `tests/e2e/tree/manager-dashboard.spec.ts` | 30s polling |
| `tests/e2e/tree/kpi.spec.ts` | day/week/month toggle |
| `tests/e2e/tree/permissions.spec.ts` | 7 ロール × RLS |
| `tests/e2e/tree/offline.spec.ts` | オフライン 50 件 → flush |
| `tests/e2e/tree/midnight.spec.ts` | 23:59:58 → 00:00:02 セッション |
| `tests/setup-tree-db.ts` | Vitest dev-DB セットアップ |
| `vitest.config.tree.ts` | Tree 専用 Vitest 設定 (85%/75%) |

#### Documentation / Operations

| パス | 責務 |
|---|---|
| `docs/pre-release-test-20260601-tree.md` | §16 7種テスト記録 |
| `docs/field-feedback-20260601-tree.md` | §17 現場フィードバック蓄積 |
| `docs/handoff-tree-*-phase-d-*.md` | Phase D 進捗 handoff |
| `docs/tree-fm-rollback-drill.md` | L1-L3 rollback 手順書（東海林 + admin 用） |

### 既存変更ファイル

| パス | 変更内容 |
|---|---|
| `src/app/tree/call/page.tsx` | キャンペーン選択画面新設（D-02） |
| `src/app/tree/calling/sprout/page.tsx` | Supabase 連携、結果ボタン、トスウィザード起動（D-02 + D-04） |
| `src/app/tree/calling/branch/page.tsx` | 同上（Branch 11 種） |
| `src/app/tree/breeze/page.tsx` | duration_sec 計測 |
| `src/app/tree/aporan/page.tsx` | アポ予定 Leaf 連携 |
| `src/app/tree/confirm-wait/page.tsx` | 30 分タイマー + 期限超過自動降格 |
| `src/app/tree/dashboard/page.tsx` | KPI 連携 + 30s polling（D-03） |
| `src/app/tree/feedback/page.tsx` | マネージャー指示送信（D-03） |
| `src/app/tree/chatwork/page.tsx` | API 連携（D-03） |
| `src/app/tree/alerts/page.tsx` | アラート集約（D-03） |
| `src/app/tree/_components/SidebarNav.tsx` | KPI メニュー追加 + CallGuard 適用 |
| `src/app/tree/_constants/screens.ts` | KPI パス追加 |
| `vercel.json` | Cron 2 本登録（refresh-mv / toss-integrity） |

### 触れない領域（干渉回避厳守）

- `src/app/leaf/` — Leaf C 担当、Tree 側は API contract のみ
- `src/lib/supabase/admin.ts` — Leaf 先行、import のみ流用
- `src/app/forest/` `/bloom/` `/bud/` `/root/` — 各セッション担当
- `supabase/migrations/2026042*` — 既存 migration は不変

---

## 2. 依存関係マップ

```
PR #31 (Phase D 6 spec docs) merge ─┐
PR #46 (Root A-3-h employees ext) ───┤
spec-cross-rls-audit (Batch 7) ──────┼─→ §1 D-01 (Schema)
spec-cross-audit-log (Batch 7) ──────┤
Soil call_histories.source 列存在 ───┘
                                       │
                                       ↓
                            §2 D-06 Test scaffolding
                                       │
                                       ↓
                              ┌────────┴────────┐
                              ↓                 ↓
                         §3 D-02              §5 D-03
                       (Operator UI)        (Manager UI)
                              │                 │
                              ↓                 │
                         §4 D-04                │
                       (Tossup flow)            │
                              │                 │
                              └────────┬────────┘
                                       ↓
                                  §6 D-05
                              (KPI dashboard)
                                       │
                                       ↓
                              §7 D-06 E2E final
                                       │
                                       ↓
                              §8 §16 7種テスト
                                       │
                                       ↓
                              §9 α (東海林 1人)
                                       │
                                       ↓
                              §10 β 1人 → 全員 → FM切替
```

**外部依存（実行前確認必須）:**
- PR #31 (`feature/tree-phase-d-specs-batch9-auto`) が develop merge 済
- PR #46 (Root A-3-h) merge 済 — `root_employees.deleted_at` `garden_role` 必須
- Batch 7 cross-cutting specs (`audit_logs` テーブル / `auth_employee_number()` / `has_role_at_least()` / `is_same_department()` 関数) が garden Supabase に apply 済
- Soil `soil_call_histories.source` カラム — D-01 の `v_tree_legacy_history` で `source = 'filemaker'` フィルタに必要、a-soil と要調整
- `.env.local` に `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `CRON_SECRET` / `CHATWORK_API_TOKEN` / `CHATWORK_ROOM_ID_TREE_MANAGER` / `CHATWORK_ROOM_ID_LEAF_BACKOFFICE` 全揃 (Vercel 本番にも同様)
- @testing-library/user-event インストール状況確認 (Phase B-β では未インストール、本 plan 着手前に `npm install --save-dev @testing-library/user-event` 実行を推奨)

---

## 3. known-pitfalls.md 反映表（横断）

| Pitfall | 発火箇所 | 反映タスク |
|---|---|---|
| #1 timestamptz 空文字 | session/record 全 INSERT、rollback の `released_at` `ended_at` `deleted_at` | 全 Server Action で `sanitizePayload()` 経由 — Task 16 / 21 / 30 |
| #2 RLS anon 流用 | Server Action / Route Handler が `getSupabaseAdmin()` か anon+JWT 転送のいずれか厳格選択 | Task 16 / 30 / 36 / 47 で確認、テストで仕掛け |
| #3 空オブジェクト insert | 結果ボタン押下前の partial submit、トスウィザード Step 1 未確定で送信 | `REQUIRED_CALL_RECORD_FIELDS` / `REQUIRED_TOSS_FIELDS` 定数 + `isEmptyPayload` — Task 19 / 31 |
| #6 garden_role CHECK | RLS 内で `has_role_at_least('manager')` 等参照、新ロール追加時に CHECK と関数同時更新必要 | Task 1 で migration コメントに警告、Task 7 RLS テストでロール一覧を assert |
| #8 deleted_at vs is_active | RLS SELECT 全てで `is_active = true AND deleted_at IS NULL`、`v_tree_operator_today` も同様 | Task 1 / 7 / 8 で必須記載、レビューチェックリストに含める |

---

## 4. Tree 特例（§17）段階展開とゲート（§9-§10）

### α版（§9）: 東海林さん 1 人 (即時, 〜 1 週間)

**通過条件（all ✅必須）:**
- §16 7 種テスト全完走（Task 61）
- 100 件実コール（実リスト使用）の通し確認
- オフライン → 復帰 50 件 flush 動作
- F1-F10 ショートカット動作確認
- FM vs Garden 5 件 spot-check で結果一致
- マネージャー UI で東海林の活動が見える

### β1（§10 Task 65）: 信頼スタッフ 1 人 (1 週間, FM 並行)

**通過条件:**
- 1 週間ログ 0 critical
- 新旧コール数 ±10% 以内
- UX フィードバック 5 件以下
- ショートカット衝突・オフライン失敗ゼロ

### β2-3（§10 Task 66）: 2-3 人 (1 週間)

**通過条件:**
- 同時 INSERT 競合ゼロ（partial unique index 動作）
- マネージャー指示送信動作
- 3 人 KPI のダッシュボード比較整合

### β half（§10 Task 67）: 半数 (1-2 週間)

**通過条件:**
- 100K calls/day 負荷下でも遅延 < 1s
- 月次 MV REFRESH 5 分以内
- FM vs Garden KPI ±5% 以内（β half 以降は ±3% に厳格化）
- 0 critical

### Full release（§10 Task 68-69）: 全員 + FM 切替 + 30 日並行参照

**通過条件:**
- β half で 0 critical 持続
- L1 rollback drill 月次実施で 5 分以内復帰確認
- FM ODBC 出力停止後、`v_tree_legacy_history` で履歴参照可
- 30 日後に FM 履歴を Soil から archive

---

## 5. タスク本体

> 凡例: 各タスクには [見積分] [対応 spec] [前提タスク] [テスト方針] を明記。
> Step は subagent-driven-development の 1 task = 複数 step に対応するもの。

---

### §0 Pre-flight (Tasks 0-2, ~1.0h)

#### Task 0: PR #31 merge 確認 + 本ブランチを develop 最新化

**Files:** None (verification only)

- [ ] **Step 0.1: PR #31 / PR #46 merge 確認**

```bash
cd C:/garden/a-tree
git fetch --all
git ls-tree -r origin/develop -- docs/specs/tree/ | grep "spec-tree-phase-d" | wc -l
# Expected: 6 (D-01 through D-06)

git log origin/develop --oneline | grep -E "PR #31|PR #46|tree-phase-d|root.*phase.*a.*3.*h" | head -5
```

- [ ] **Step 0.2: Batch 7 cross-cutting 関数の存在確認**

Supabase Dashboard → Database → Functions で以下が存在:
- `auth_employee_number(uuid)`
- `has_role_at_least(text)`
- `is_same_department(uuid)`

存在しなければ a-main にエスカレーション（Batch 7 spec 適用 SQL の手動実行が必要）。

- [ ] **Step 0.3: develop ベースから新ブランチ派生**

```bash
git checkout develop
git pull origin develop
git checkout -b feature/tree-phase-d-impl
```

> **Note**: 大型実装のため、必要に応じてサブブランチ（`-d01-schema`, `-d02-ui` 等）に派生して個別 PR を組み立てる戦略も可。本プランは単一ブランチ前提で記述、subagent-driven 実行時にサブブランチ判断 OK。

#### Task 1: 環境変数・依存パッケージ整備

**Files:**
- Modify: `.env.local`（東海林さんのみ、git 対象外）
- Modify: `package.json`（必要なら追加）

- [ ] **Step 1.1: 必須環境変数チェックリスト**

`.env.local` に以下が揃っているか目視 + smoke テスト:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`（D-04/D-05 Cron 認証）
- `CHATWORK_API_TOKEN` / `CHATWORK_ROOM_ID_TREE_MANAGER` / `CHATWORK_ROOM_ID_LEAF_BACKOFFICE`

- [ ] **Step 1.2: 不足パッケージインストール**

```bash
npm install --save sonner          # Toast 統一（D-02 §5、判5 由来）
npm install --save-dev @testing-library/user-event  # B-β で未導入、Phase D で必須
npm install --save-dev @axe-core/playwright         # axe-core 統合
npm install --save-dev @lhci/cli                    # Lighthouse CI
npm install --save-dev k6                           # 負荷テスト（D-06 판1 採用案）
npm install --save recharts                         # 既存採用済の場合 skip
npm install --save @tanstack/react-table            # 既存採用済の場合 skip
```

> **判断保留**: `k6` は判1 で採用方針確定。CI ピンが必要なら判定者と要相談。

- [ ] **Step 1.3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(tree): Phase D 必要パッケージ追加（sonner / user-event / axe / lhci / k6）"
```

#### Task 2: effort-tracking 予定 11 行追記

**Files:** Modify `docs/effort-tracking.md`

- [ ] **Step 2.1: 11 行追加（モジュール = Tree、各 Phase D-XX に対応 + α/β 行）**

`## 履歴` セクション末尾の表に以下を追記（折衷案 = 日本語列名フォーマット準拠）:

```markdown
| Tree | Phase D-01 schema migrations | 0.7 | | | a-tree (A) | 2026-04-25 | | spec-tree-phase-d-01 準拠、12 タスク。Soil link 列 + 7 migration + 2 VIEW + audit。|
| Tree | Phase D-06 test scaffolding | 0.25 | | | a-tree (A) | 2026-04-25 | | Vitest config 分離、85%/75% 閾値、real-DB セットアップ。D-02 着手前に必須。|
| Tree | Phase D-02 operator UI | 1.125 | | | a-tree (A) | 2026-04-25 | | spec-tree-phase-d-02 準拠、13 タスク。FM 互換 + offline + rollback。|
| Tree | Phase D-04 tossup flow | 0.875 | | | a-tree (A) | 2026-04-25 | | spec-tree-phase-d-04 準拠、7 タスク。Tree → Leaf 1 トランザクション + 整合性 Cron。|
| Tree | Phase D-03 manager UI | 1.0 | | | a-tree (A) | 2026-04-25 | | spec-tree-phase-d-03 準拠、8 タスク。30s polling + Chatwork 介入。|
| Tree | Phase D-05 KPI dashboard | 0.94 | | | a-tree (A) | 2026-04-25 | | spec-tree-phase-d-05 準拠、9 タスク。MV 3 本 + Recharts + CSV/Excel。|
| Tree | Phase D-06 E2E + 受入 | 1.0 | | | a-tree (A) | 2026-04-25 | | spec-tree-phase-d-06 準拠、8 タスク。Playwright 10 flow + axe + Lighthouse。|
| Tree | Phase D §16 7種テスト | 0.5 | | | a-tree (A) | 2026-04-25 | | 親CLAUDE.md §16 準拠、α 投入前に全完走必須。|
| Tree | Phase D α (東海林1人) | — | | | a-tree (A) | 2026-04-25 | | 1 週間想定。100 件実コール + spot-check 5 件 + 7種テスト全 ✅。|
| Tree | Phase D β1 (1人現場) | — | | | a-tree (A) | 2026-04-25 | | 1 週間想定、FM 並行。新旧 ±10% 以内、UX フィードバック ≤5 件。|
| Tree | Phase D Full release + FM 切替 | — | | | a-tree (A) | 2026-04-25 | | β half (±3%) 0 critical 後。FM 30日並行参照。|
```

- [ ] **Step 2.2: Commit**

```bash
git add docs/effort-tracking.md
git commit -m "docs: effort-tracking 更新 (tree) — Phase D 11 行先行記入"
```

---

### §1 D-01 Schema migrations (Tasks 3-14, ~5.6h)

> **対応 spec**: `docs/specs/tree/spec-tree-phase-d-01-schema-migration.md`
> **見積合計**: 5.6h (12 タスク)
> **前提**: Task 0-2 完了、PR #31/#46 merge 済、Batch 7 関数 apply 済

#### Task 3: `tree_calling_sessions` migration

**Files:**
- Create: `supabase/migrations/20260601_01_tree_calling_sessions.sql`
- Create: `supabase/migrations/20260601_01_tree_calling_sessions.down.sql`
- Test: smoke (psql up/down/up)

- [ ] **Step 3.1: spec §1 表 1 通りの DDL を起こす**

ポイント:
- `session_id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `employee_id text NOT NULL REFERENCES root_employees(employee_number) ON UPDATE CASCADE`
- `mode text NOT NULL CHECK (mode IN ('sprout','branch','aporan','breeze','confirm_wait','offline'))`
- `started_at timestamptz NOT NULL DEFAULT now()` / `ended_at timestamptz NULL` / `deleted_at timestamptz NULL`
- `total_calls int NOT NULL DEFAULT 0` / `total_toss int NOT NULL DEFAULT 0` / `total_ng int NOT NULL DEFAULT 0`
- COMMENT は日本語明確に
- INDEX: `(employee_id, started_at DESC) WHERE deleted_at IS NULL`

down.sql は `DROP TABLE IF EXISTS tree_calling_sessions CASCADE` のみ。

- [ ] **Step 3.2: dev Supabase に apply + smoke test**

```bash
# Supabase Dashboard SQL Editor で apply (or supabase CLI)
# 確認:
SELECT column_name, data_type, is_nullable FROM information_schema.columns
  WHERE table_name = 'tree_calling_sessions' ORDER BY ordinal_position;
```

idempotency: 2 回 apply してエラーが出ないこと（`CREATE TABLE IF NOT EXISTS` 必須）。

- [ ] **Step 3.3: Commit**

```bash
git add supabase/migrations/20260601_01_tree_calling_sessions*.sql
git commit -m "feat(tree): D-01 tree_calling_sessions migration"
```

#### Task 4: `tree_call_records` migration + 不変ガード Trigger

**Files:**
- Create: `supabase/migrations/20260601_02_tree_call_records.sql`
- Create: `supabase/migrations/20260601_02_tree_call_records.down.sql`

- [ ] **Step 4.1: テーブル DDL**

ポイント:
- `call_id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `session_id uuid NOT NULL REFERENCES tree_calling_sessions(session_id)`
- `employee_id text NOT NULL`
- `list_id uuid NOT NULL REFERENCES soil_call_lists(list_id)`
- `campaign_code text NOT NULL`
- `result_code text NOT NULL CHECK (result_code IN (...10 sprout + 11 branch + 'unreach'))`
- `result_group text NOT NULL CHECK (result_group IN ('toss','ng','clm','unreach','other'))`
- `duration_sec int NULL CHECK (duration_sec IS NULL OR duration_sec >= 0)`
- `memo text NULL`
- `tossed_leaf_case_id uuid NULL` (D-04 で UPDATE)
- `is_rolled_back boolean NOT NULL DEFAULT false`
- `called_at timestamptz NOT NULL DEFAULT now()`
- `deleted_at timestamptz NULL`
- INDEX: `(session_id, called_at DESC)`, `(list_id, called_at DESC)`, `(employee_id, called_at DESC) WHERE deleted_at IS NULL`

- [ ] **Step 4.2: 不変ガード Trigger `trg_tcr_guard_immutable`**

`employee_id` `campaign_code` `session_id` の UPDATE を禁止（クライアント不正対策）:

```sql
CREATE OR REPLACE FUNCTION fn_tcr_guard_immutable() RETURNS trigger AS $$
BEGIN
  IF NEW.employee_id <> OLD.employee_id THEN
    RAISE EXCEPTION 'tree_call_records.employee_id is immutable';
  END IF;
  IF NEW.session_id <> OLD.session_id THEN
    RAISE EXCEPTION 'tree_call_records.session_id is immutable';
  END IF;
  IF NEW.campaign_code <> OLD.campaign_code THEN
    RAISE EXCEPTION 'tree_call_records.campaign_code is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tcr_guard_immutable BEFORE UPDATE ON tree_call_records
  FOR EACH ROW EXECUTE FUNCTION fn_tcr_guard_immutable();
```

- [ ] **Step 4.3: smoke test**

```sql
-- INSERT 成功
INSERT INTO tree_call_records (session_id, employee_id, list_id, campaign_code, result_code, result_group)
  VALUES (...);
-- UPDATE employee_id 失敗
UPDATE tree_call_records SET employee_id = '0009' WHERE call_id = '...';
-- → ERROR: tree_call_records.employee_id is immutable
```

- [ ] **Step 4.4: Commit**

#### Task 5: `tree_agent_assignments` migration + partial unique

**Files:**
- Create: `supabase/migrations/20260601_03_tree_agent_assignments.sql`
- Create: `supabase/migrations/20260601_03_tree_agent_assignments.down.sql`

- [ ] **Step 5.1: テーブル DDL**

ポイント:
- `assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `employee_id text NOT NULL` / `list_id uuid NOT NULL REFERENCES soil_call_lists(list_id)`
- `acquired_at timestamptz NOT NULL DEFAULT now()`
- `released_at timestamptz NULL`
- `deleted_at timestamptz NULL`
- **Partial UNIQUE INDEX**: `CREATE UNIQUE INDEX uq_active_assignment ON tree_agent_assignments(list_id) WHERE released_at IS NULL AND deleted_at IS NULL`
  - 同一リストに同時 active 担当を 1 件に制限

- [ ] **Step 5.2: smoke test for concurrent insert**

```sql
-- 2 オペレーターが同一 list_id に同時 INSERT を試みると、後から来た方が UNIQUE 違反
```

- [ ] **Step 5.3: Commit**

#### Task 6: Soil 連携カラム追加 migration

**Files:**
- Create: `supabase/migrations/20260601_04_soil_link_columns.sql`
- Create: `supabase/migrations/20260601_04_soil_link_columns.down.sql`

> ⚠ **a-soil 担当領域を Tree が一時的に編集**するため、merge 前に a-main 経由で a-soil に通知必要

- [ ] **Step 6.1: ALTER TABLE で 3 列追加**

```sql
ALTER TABLE soil_call_lists
  ADD COLUMN IF NOT EXISTS last_tree_session_id uuid NULL,
  ADD COLUMN IF NOT EXISTS last_tree_call_id uuid NULL,
  ADD COLUMN IF NOT EXISTS last_tree_touched_at timestamptz NULL;
```

`IF NOT EXISTS` で idempotency 担保。

- [ ] **Step 6.2: COMMENT + INDEX (任意)**

- [ ] **Step 6.3: down は ALTER TABLE DROP COLUMN（ただし dev のみ、本番は実行禁止 — データ消失）**

- [ ] **Step 6.4: Commit**

#### Task 7: 集計 Trigger `trg_tcr_update_session_totals`

**Files:**
- Modify (or create): `supabase/migrations/20260601_02_tree_call_records.sql` の末尾、または `20260601_02b_session_totals_trigger.sql` 別ファイル

- [ ] **Step 7.1: Trigger 実装**

INSERT 後に `tree_call_records.session_id` の `total_calls / total_toss / total_ng` を increment:

```sql
CREATE OR REPLACE FUNCTION fn_tcr_update_session_totals() RETURNS trigger AS $$
BEGIN
  IF (NEW.is_rolled_back IS NOT TRUE) AND (NEW.deleted_at IS NULL) THEN
    UPDATE tree_calling_sessions
      SET total_calls = total_calls + 1,
          total_toss = total_toss + CASE WHEN NEW.result_group = 'toss' THEN 1 ELSE 0 END,
          total_ng = total_ng + CASE WHEN NEW.result_group = 'ng' THEN 1 ELSE 0 END
      WHERE session_id = NEW.session_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tcr_update_session_totals AFTER INSERT ON tree_call_records
  FOR EACH ROW EXECUTE FUNCTION fn_tcr_update_session_totals();
```

> **Note**: rollback / soft-delete 時の decrement も別途必要だが、本プランでは UPDATE Trigger で同様の補正を実装（spec §6.2）。判断: spec の通り UPDATE Trigger も追加する。

- [ ] **Step 7.2: Vitest（pgTap or SQL 直叩き）**

```sql
-- INSERT 1 件 (toss) → session.total_calls = 1, total_toss = 1
-- INSERT 1 件 (ng) → session.total_calls = 2, total_ng = 1
-- UPDATE is_rolled_back = true → session.total_calls = 1
```

- [ ] **Step 7.3: Commit**

#### Task 8: RLS policies (sessions)

**Files:**
- Create: `supabase/migrations/20260601_05_tree_rls_policies.sql`（sessions セクション）

- [ ] **Step 8.1: 4 ポリシー定義（spec §5）**

```sql
ALTER TABLE tree_calling_sessions ENABLE ROW LEVEL SECURITY;

-- self_select: 本人 + same-day OK
CREATE POLICY tcs_self_select ON tree_calling_sessions FOR SELECT
  USING (employee_id = auth_employee_number()
         AND deleted_at IS NULL);

-- self_insert
CREATE POLICY tcs_self_insert ON tree_calling_sessions FOR INSERT
  WITH CHECK (employee_id = auth_employee_number());

-- self_update_today
CREATE POLICY tcs_self_update_today ON tree_calling_sessions FOR UPDATE
  USING (employee_id = auth_employee_number()
         AND started_at::date = CURRENT_DATE
         AND deleted_at IS NULL);

-- manager_select_dept (同部署 manager+)
CREATE POLICY tcs_manager_select ON tree_calling_sessions FOR SELECT
  USING (has_role_at_least('manager')
         AND is_same_department(
           (SELECT user_id FROM root_employees WHERE employee_number = tree_calling_sessions.employee_id))
         AND deleted_at IS NULL);

-- admin_select_all
CREATE POLICY tcs_admin_select ON tree_calling_sessions FOR SELECT
  USING (has_role_at_least('admin') AND deleted_at IS NULL);
```

> **注意**: `auth_employee_number()` `has_role_at_least()` `is_same_department()` は Batch 7 cross-cutting 関数。事前 apply 必須。

- [ ] **Step 8.2: 4 ロール × 操作の動作確認**

```sql
-- toss ロール: 自分のセッション SELECT OK、他人のセッション SELECT 0 件
-- manager ロール（同部署）: 部下のセッション SELECT OK、他部署 0 件
-- admin: 全件 SELECT OK
```

- [ ] **Step 8.3: Commit**

#### Task 9: RLS policies (records + assignments)

**Files:** Modify `20260601_05_tree_rls_policies.sql` に追記

- [ ] **Step 9.1: tree_call_records 4 policies**

- self_select / self_insert / self_update_today (同日のみ自己 UPDATE 可) / DELETE 禁止 (全ロール)
- manager_select_dept / admin_select_all
- DELETE 拒否ポリシー（明示）

- [ ] **Step 9.2: tree_agent_assignments 4 policies**

- self_select / self_insert / self_update (release のみ可) / admin_force_release

- [ ] **Step 9.3: 7 ロール × 操作のマトリクステスト（D-06 §3 §3-3 連携）**

- [ ] **Step 9.4: Commit**

#### Task 10: VIEW `v_tree_operator_today` + `v_tree_legacy_history`

**Files:**
- Create: `supabase/migrations/20260601_06_tree_views.sql`
- Create: `supabase/migrations/20260601_06_tree_views.down.sql`

- [ ] **Step 10.1: `v_tree_operator_today`**

```sql
CREATE OR REPLACE VIEW v_tree_operator_today
  WITH (security_invoker = true)
AS
SELECT
  s.session_id,
  s.employee_id,
  e.name AS employee_name,
  s.mode,
  s.started_at,
  s.ended_at,
  s.total_calls,
  s.total_toss,
  s.total_ng,
  CASE
    WHEN s.total_calls = 0 THEN 0
    ELSE ROUND(s.total_toss::numeric / s.total_calls * 100, 1)
  END AS toss_rate_pct,
  (SELECT MAX(called_at) FROM tree_call_records r WHERE r.session_id = s.session_id) AS last_called_at
FROM tree_calling_sessions s
JOIN root_employees e ON e.employee_number = s.employee_id
WHERE s.started_at::date = CURRENT_DATE
  AND s.deleted_at IS NULL;
```

`security_invoker = true` で呼び出し側 RLS が効く（spec §4.4 + known-pitfalls #2 安全策）。

- [ ] **Step 10.2: `v_tree_legacy_history`** (FM archive)

`soil_call_histories` から `source = 'filemaker'` のレコードのみ参照。read-only。

- [ ] **Step 10.3: Commit**

#### Task 11: 監査 Trigger 6 イベント

**Files:**
- Create: `supabase/migrations/20260601_07_audit_triggers.sql`
- Create: `supabase/migrations/20260601_07_audit_triggers.down.sql`

- [ ] **Step 11.1: 6 イベント Trigger（spec §7）**

1. `tree_calling_sessions.INSERT` → audit_logs (`session_open`)
2. `tree_calling_sessions.UPDATE WHERE ended_at IS NEW NOT NULL` → audit_logs (`session_close`)
3. `tree_call_records.INSERT` → audit_logs (`call_record_insert`)
4. `tree_call_records.UPDATE WHERE is_rolled_back BECAME true` → audit_logs (`call_record_rollback`)
5. `tree_agent_assignments.INSERT` → audit_logs (`list_acquire`)
6. `tree_agent_assignments.UPDATE WHERE released_at BECAME NOT NULL` → audit_logs (`list_release`)

- [ ] **Step 11.2: Vitest で 6 イベント動作確認**

- [ ] **Step 11.3: Commit**

#### Task 12: 3-round-trip idempotency test

**Files:** Documentation only (`docs/tree-d-01-migration-test.md` 一時メモ)

- [ ] **Step 12.1: dev で `up → down → up → down → up` 実行**

7 migration ファイルすべて。各 step で `\d tree_*` で schema diff ゼロを確認。

- [ ] **Step 12.2: 結果記録**

エラーが出たら該当 migration の `IF NOT EXISTS` `IF EXISTS` 不足を修正。

- [ ] **Step 12.3: Commit (修正があれば)**

#### Task 13: シードデータ + パフォーマンス probe

**Files:** `scripts/tree-d01-seed.sql` (一時)

- [ ] **Step 13.1: 50 セッション + 200 コール seed**

リアル業務想定の規模（1 オペレーター 1 日約 100 コール × 50 人）。

- [ ] **Step 13.2: `v_tree_operator_today` 応答時間計測**

`EXPLAIN ANALYZE SELECT * FROM v_tree_operator_today;` で 100ms 未満確認（spec §8 目標）。

- [ ] **Step 13.3: 計測結果を `docs/pre-release-test-20260601-tree.md` に記録**

#### Task 14: §1 完了マーク + 中間 commit

- [ ] **Step 14.1: §1 進捗を effort-tracking 実績欄に記入**

- [ ] **Step 14.2: 全 §1 commit を確認、push**

```bash
git push origin feature/tree-phase-d-impl
```

---

### §2 D-06 Test Scaffolding (Tasks 15-17, ~2.0h)

> **対応 spec**: `docs/specs/tree/spec-tree-phase-d-06-test-strategy.md` (early stage)
> **見積合計**: 2.0h
> **前提**: §1 完了

#### Task 15: Vitest config 分離（Tree 専用）

**Files:**
- Create: `vitest.config.tree.ts`
- Modify: `package.json`

- [ ] **Step 15.1: Tree 専用 config**

```typescript
// vitest.config.tree.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup-tree-db.ts"],
    globals: true,
    include: ["src/app/tree/**/*.{test,spec}.{ts,tsx}", "tests/unit/tree/**/*.{test,spec}.ts"],
    coverage: {
      enabled: true,
      provider: "v8",
      thresholds: {
        lines: 85,
        functions: 85,
        statements: 85,
        branches: 75, // RTL分はやや低めの 75%
      },
      include: ["src/app/tree/**/*.{ts,tsx}"],
      exclude: ["**/__tests__/**", "**/node_modules/**", "**/types.ts"],
    },
  },
});
```

- [ ] **Step 15.2: package.json scripts**

```json
"test:tree": "vitest run --config vitest.config.tree.ts",
"test:tree:watch": "vitest --config vitest.config.tree.ts",
"test:tree:coverage": "vitest run --config vitest.config.tree.ts --coverage"
```

- [ ] **Step 15.3: Commit**

#### Task 16: real-DB セットアップファイル

**Files:**
- Create: `tests/setup-tree-db.ts`

- [ ] **Step 16.1: dev Supabase への接続初期化 + テスト fixture INSERT**

beforeAll で test 用社員（社員番号 0001-0009 reserved per D-06 판7）の seed、afterAll で cleanup。

- [ ] **Step 16.2: Commit**

#### Task 17: _lib テスト雛形（5 ファイル）

**Files:**
- Create:
  - `src/app/tree/_lib/__tests__/offlineQueue.test.ts` (placeholder + 1 sanity test)
  - `src/app/tree/_lib/__tests__/resultCodes.test.ts`
  - `src/app/tree/_lib/__tests__/rollback.test.ts`
  - `src/app/tree/_lib/__tests__/shortcuts.test.ts`
  - `src/app/tree/_lib/__tests__/tossPayloadValidator.test.ts`

- [ ] **Step 17.1: 5 ファイル雛形作成**

それぞれ `describe.skip("...", ...)` + 1 sanity assertion で開始。Task 18+ で実装と並行充填。

- [ ] **Step 17.2: `npm run test:tree` で雛形 PASS（skip 含めて）**

- [ ] **Step 17.3: Commit**

---

### §3 D-02 Operator UI (Tasks 18-30, ~9.0h)

> **対応 spec**: spec-tree-phase-d-02
> **見積合計**: 9.0h (13 タスク)
> **前提**: §1 §2 完了

#### Task 18: キャンペーン選択画面 (`/tree/call`)

**Files:**
- Modify: `src/app/tree/call/page.tsx`
- Modify: `src/app/tree/_constants/screens.ts`（既存）

- [ ] **Step 18.1: campaign セレクタ + 「前回と同じ」自動遷移ボタン**

> **判断保留 D-02-判1**: 前日と同じキャンペーンなら自動遷移するか。**仮スタンス**: 前日同一なら自動、新商材時のみ強制選択（実装でこのスタンスで進め、α テストで判断）。

- [ ] **Step 18.2: 選択後 `session.ts` `openSession()` を呼出 → /tree/calling/sprout へ遷移**

- [ ] **Step 18.3: RTL test for campaign select**

- [ ] **Step 18.4: Commit**

#### Task 19: セッション open/close Server Action

**Files:**
- Create: `src/app/tree/_actions/session.ts`
- Create: `src/app/tree/_actions/__tests__/session.test.ts`

- [ ] **Step 19.1: `openSession({ mode, campaign_code, accessToken })` Server Action**

- access_token 検証 → user_id 取得
- `getSupabaseAdmin()` で `tree_calling_sessions` INSERT
- 戻り値: `{ success: true, session_id } | { success: false, errorCode, errorMessage }`

- [ ] **Step 19.2: `closeSession({ session_id })`**

- [ ] **Step 19.3: Vitest 5 ケース** (UNAUTHENTICATED / 不正 mode / 重複 INSERT / DB error / 成功)

- [ ] **Step 19.4: Commit**

#### Task 20: Sprout 画面 Supabase 連携

**Files:**
- Modify: `src/app/tree/calling/sprout/page.tsx`

- [ ] **Step 20.1: 既存 UI を保護コメントで wrap → 新ロジック注入**

- 担当 list の pull (`tree_agent_assignments` INSERT + `soil_call_lists` SELECT)
- 結果ボタン 10 種 → `tree_call_records` INSERT (Server Action 経由)
- 次リスト自動遷移

- [ ] **Step 20.2: RTL + 既存ボタン全動作テスト**

- [ ] **Step 20.3: Commit**

#### Task 21: Branch 画面 同等対応

**Files:**
- Modify: `src/app/tree/calling/branch/page.tsx`

- [ ] **Step 21.1: 11 種ボタン + Sprout と同等の Supabase 連携**

- [ ] **Step 21.2: Commit**

#### Task 22: FM 互換ショートカット Hook

**Files:**
- Create: `src/app/tree/_hooks/useCallShortcuts.ts`
- Create: `src/app/tree/_hooks/__tests__/useCallShortcuts.test.ts`

- [ ] **Step 22.1: Hook 実装**

```typescript
import { useEffect, useRef } from "react";

export type ShortcutHandler = {
  onResult: (resultCode: string) => void;
  onUndo: () => void;
  onPrev: () => void;
  onNext: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

const F_KEY_MAP: Record<string, string> = {
  F1: "toss", F2: "ng", F3: "absent", /* ... 10 entries */
};

export function useCallShortcuts(handlers: ShortcutHandler, enabled: boolean = true) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key in F_KEY_MAP) {
        e.preventDefault(); // F5 リロード防止等
        handlersRef.current.onResult(F_KEY_MAP[e.key]);
        return;
      }
      if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        handlersRef.current.onUndo();
        return;
      }
      // ... Ctrl+← Ctrl+→ Esc Enter
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
```

- [ ] **Step 22.2: Vitest（10 F-key + 5 Ctrl 系）**

- [ ] **Step 22.3: ON/OFF トグル localStorage 連携**

> **判断保留 D-02-判4**: F1-F10 のブラウザ機能 override は OK か。**仮スタンス**: OK（ユーザー教育で周知、トグル提供）。

- [ ] **Step 22.4: Commit**

#### Task 23: 巻き戻し Hook + UI

**Files:**
- Create: `src/app/tree/_hooks/useCallRollback.ts`
- Create: `src/app/tree/_hooks/__tests__/useCallRollback.test.ts`

- [ ] **Step 23.1: 5 秒タイマー + UPDATE call**

> **判断保留 D-02-判3**: 巻き戻し時間枠（5/10/30 秒）。**仮スタンス**: 5 秒固定。

- [ ] **Step 23.2: Vitest（5 秒以内 success / 5 秒超過 reject / Trigger 連動 total decrement）**

- [ ] **Step 23.3: Commit**

#### Task 24: オフラインキュー

**Files:**
- Create: `src/app/tree/_lib/offlineQueue.ts`
- Create: `src/app/tree/_lib/__tests__/offlineQueue.test.ts`（雛形を充填）

- [ ] **Step 24.1: localStorage + flush 機構**

```typescript
const QUEUE_KEY = "tree_offline_queue_v1";
const MAX_ITEMS = 500; // D-02-判2 仮スタンス

export function enqueue(item: QueuedCall): void { /* ... */ }
export async function flush(serverAction: (item: QueuedCall) => Promise<Result>): Promise<FlushResult> {
  // 3 リトライ + 失敗時は手動再送 UI 表示用の状態を返す
}
export function size(): number { /* ... */ }
```

> **判断保留 D-02-判2**: キュー上限。**仮スタンス**: 500 件、超過 = 業務停止扱い（Toast 警告）。

- [ ] **Step 24.2: Vitest（enqueue / dequeue / flush 成功 / リトライ / 失敗時の手動再送 UI 状態）**

- [ ] **Step 24.3: 復帰検出 (`navigator.onLine` + visibilitychange) で auto-flush 起動**

- [ ] **Step 24.4: Commit**

#### Task 25: 画面遷移ガード

**Files:**
- Create: `src/app/tree/_components/CallGuard.tsx`
- Create: `src/app/tree/_components/CallLink.tsx`（カスタム Link）
- Modify: `src/app/tree/_components/SidebarNav.tsx`

- [ ] **Step 25.1: CallLink で `isCalling` 中は preventDefault + 確認モーダル**

> **R2 known issue**: Next.js App Router で `router.events` 不可。`beforeunload` は SPA 内遷移に効かないため CallLink で網羅。SidebarNav の全 Link を CallLink に置換する必要あり、棚卸しチェックを Task 30 で実施。

- [ ] **Step 25.2: RTL（モーダル表示・キャンセル・続行）**

- [ ] **Step 25.3: Commit**

#### Task 26: Toast 統一 (sonner)

**Files:**
- Create: `src/app/tree/_components/Toast.tsx` (sonner ラッパー)
- Modify: 架電画面 3 枚で `toast.error`/`toast.success` を統一

- [ ] **Step 26.1: sonner Toaster をルートに mount**

- [ ] **Step 26.2: role="alert" 自動付与**（spec-cross-error-handling §4 準拠）

- [ ] **Step 26.3: Commit**

#### Task 27: Breeze duration_sec 計測 + 格納

**Files:**
- Modify: `src/app/tree/breeze/page.tsx`

- [ ] **Step 27.1: `useRef` でタイマー値保持、結果 INSERT に渡す**

- [ ] **Step 27.2: visibilitychange で elapsed 補正**

- [ ] **Step 27.3: RTL（タイマー進行 + INSERT 引数確認）**

- [ ] **Step 27.4: Commit**

#### Task 28: Aporan / Confirm-wait 連携

**Files:**
- Modify: `src/app/tree/aporan/page.tsx`
- Modify: `src/app/tree/confirm-wait/page.tsx`

- [ ] **Step 28.1: aporan は「トスアップ準備」スタブ**（詳細は §4 D-04 で）

- [ ] **Step 28.2: confirm-wait 30 分タイマー + 期限超過自動降格**

サーバー側判定（`tree_call_records.created_at + 30min < now()`）優先。

- [ ] **Step 28.3: Commit**

#### Task 29: モバイル対応（架電画面 5 枚）

**Files:** Tailwind / inline style 調整のみ

- [ ] **Step 29.1: タップターゲット最低 44px、全画面 sm/md ブレークポイント対応**

- [ ] **Step 29.2: PC は表示のみ、モバイルは `tel:` リンク（D-02-判6 仮スタンス）**

- [ ] **Step 29.3: Commit**

#### Task 30: D-02 結合テスト + 既存挙動非破壊確認

**Files:** None（テスト実行のみ）

- [ ] **Step 30.1: `npm run test:tree` で §3 全テスト PASS**

- [ ] **Step 30.2: 手動: 既存 Tree Phase B 動作（通話履歴 INSERT）が変わっていないこと**

- [ ] **Step 30.3: SidebarNav Link 棚卸し（CallGuard 全適用）**

- [ ] **Step 30.4: Commit (修正があれば) + push**

---

### §4 D-04 Tossup Flow (Tasks 31-37, ~7.0h)

> **対応 spec**: spec-tree-phase-d-04
> **見積合計**: 7.0h (7 タスク)
> **前提**: §1 §3 完了

#### Task 31: zod schema (`tossPayloadSchema.ts`)

**Files:**
- Create: `src/app/tree/_actions/tossPayloadSchema.ts`
- Create: `src/app/tree/_actions/__tests__/tossPayloadSchema.test.ts`

- [ ] **Step 31.1: 必須項目 zod 化**

```typescript
import { z } from "zod";

export const TossPayloadSchema = z.object({
  call_id: z.string().uuid(),
  campaign_code: z.string().min(1),
  customer_name: z.string().min(1).max(255),
  customer_phone: z.string().regex(/^[\d-]+$/).min(10).max(15),
  supply_point_22: z.string().regex(/^\d{22}$/).optional(),
  agreement_confirmed: z.boolean(),
  agreement_memo: z.string().max(500),
  call_memo: z.string().max(500).optional(),
});
export type TossPayload = z.infer<typeof TossPayloadSchema>;
```

> **判断保留 D-04-判4**: 同意確認の全商材必須化。**仮スタンス**: 全商材で必須（景表法・特商法）。

- [ ] **Step 31.2: Vitest（境界値テスト）**

- [ ] **Step 31.3: Commit**

#### Task 32: PostgreSQL `tree_toss_to_leaf` 関数

**Files:**
- Create: `supabase/migrations/20260601_09_tree_toss_to_leaf_function.sql`

- [ ] **Step 32.1: SECURITY DEFINER 関数で 1 トランザクション化**

```sql
CREATE OR REPLACE FUNCTION tree_toss_to_leaf(
  p_call_id uuid,
  p_employee_number text,
  -- ...payload fields
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_case_id uuid;
BEGIN
  -- 重複チェック
  IF EXISTS (SELECT 1 FROM tree_call_records WHERE call_id = p_call_id AND tossed_leaf_case_id IS NOT NULL) THEN
    RAISE EXCEPTION 'already tossed';
  END IF;

  -- soil_kanden_cases INSERT
  INSERT INTO soil_kanden_cases (...) VALUES (...)
    RETURNING case_id INTO v_case_id;

  -- tree_call_records UPDATE
  UPDATE tree_call_records SET tossed_leaf_case_id = v_case_id WHERE call_id = p_call_id;

  -- audit log
  INSERT INTO audit_logs (...) VALUES (...);

  RETURN v_case_id;
END $$;
```

- [ ] **Step 32.2: 重複・FK・必須欄エラー smoke test**

- [ ] **Step 32.3: Commit**

#### Task 33: `tossToLeaf` Server Action

**Files:**
- Create: `src/app/tree/_actions/tossToLeaf.ts`
- Create: `src/app/tree/_actions/__tests__/tossToLeaf.test.ts`

- [ ] **Step 33.1: Server Action 実装**

zod 検証 → access_token 検証 → admin client で関数呼出 → Chatwork 通知 → 戻り値

- [ ] **Step 33.2: Vitest 6 ケース** (UNAUTHENTICATED / VALIDATION / DUPLICATE / DB_ERROR / SUCCESS / Chatwork 失敗時 best-effort)

- [ ] **Step 33.3: Commit**

#### Task 34: Sprout 画面 トスウィザード Step 1/2

**Files:**
- Modify: `src/app/tree/calling/sprout/page.tsx`
- Create: `src/app/tree/calling/_components/TossWizard.tsx`
- Create: `src/app/tree/calling/_components/__tests__/TossWizard.test.tsx`

- [ ] **Step 34.1: 「トス」ボタン押下時 → モーダル Step 1（同意確認） → Step 2（商材別追加）**

- [ ] **Step 34.2: RTL: 同意未取得で送信ブロック / リトライ / オフライン enqueue**

- [ ] **Step 34.3: Commit**

#### Task 35: Leaf ステータス poll + Tree 表示

**Files:**
- Modify: `src/app/tree/calling/sprout/page.tsx`（直近結果欄）
- Create: `src/app/tree/_lib/leafStatusPoll.ts`

- [ ] **Step 35.1: 5 分間隔 poll**（Phase D-1 は polling、D-2 で Realtime 検討、D-04-판7 推奨）

- [ ] **Step 35.2: Leaf status → Tree 表示マッピング 6 種**

- [ ] **Step 35.3: Commit**

#### Task 36: 整合性 Cron (`/api/tree/cron/toss-integrity`)

**Files:**
- Create: `src/app/api/tree/cron/toss-integrity/route.ts`
- Modify: `vercel.json`（crons 配列、CRON_SECRET 認証）

- [ ] **Step 36.1: Cron route**

```typescript
export async function POST(req: Request) {
  // CRON_SECRET 検証
  // 孤児検出: tree_call_records.tossed_leaf_case_id IS NOT NULL AND soil_kanden_cases にない
  // 逆検出: soil_kanden_cases に [Tree トス] prefix あり、tree_call_records 未参照
  // 補正 UPDATE
  // 差分 > 10 件 → Chatwork admin alert
}
```

- [ ] **Step 36.2: vercel.json `crons_pending_fixie_root` ではなく `crons` 配列に登録**（Tree 用は事務所 IP 制限対象外、Vercel 標準の Cron で OK）

- [ ] **Step 36.3: Vitest（mock で孤児パターン 3 種）**

- [ ] **Step 36.4: Commit**

#### Task 37: D-04 結合テスト + 干渉回避確認

**Files:** None

- [ ] **Step 37.1: Tree → Leaf 1 件通しで E2E**

> ⚠ **a-leaf 領域に入らないこと厳守**: `src/app/leaf/` には触れず、`soil_kanden_cases` に正しい payload で INSERT されることだけを確認。

- [ ] **Step 37.2: Commit + push**

---

### §5 D-03 Manager UI (Tasks 38-45, ~8.0h)

> **対応 spec**: spec-tree-phase-d-03
> **見積合計**: 8.0h (8 タスク)
> **前提**: §1 §3 完了

#### Task 38: D-01 への列追加依頼（spec §3 step 1）

**Files:**
- Modify: `supabase/migrations/20260601_06_tree_views.sql`

- [ ] **Step 38.1: `v_tree_operator_today` に `last_called_at`・`alert_flag`・`status_code` 列追加**

`status_code` 算出ロジックは VIEW 内に CASE WHEN で埋め込む（spec §3 状態判定ロジック相当）。

- [ ] **Step 38.2: Commit**

#### Task 39: ダッシュボード骨格 + 30s polling

**Files:**
- Modify: `src/app/tree/dashboard/page.tsx`
- Create: `src/app/tree/dashboard/_hooks/useDashboardPolling.ts`

- [ ] **Step 39.1: visibilitychange 検知 + 30s setInterval**

> **判断保留 D-03-判2**: WebSocket vs polling。**仮スタンス**: D-1 は polling 採用。

- [ ] **Step 39.2: Vitest (タブ非アクティブで停止)**

- [ ] **Step 39.3: Commit**

#### Task 40: オペレーター一覧テーブル

**Files:**
- Create: `src/app/tree/dashboard/_components/OperatorTable.tsx`

- [ ] **Step 40.1: TanStack Table、状態バッジ、コール数、トス率**

- [ ] **Step 40.2: RTL**

- [ ] **Step 40.3: Commit**

#### Task 41: 個別ドリルダウンモーダル

**Files:**
- Create: `src/app/tree/dashboard/_components/OperatorDrilldown.tsx`

- [ ] **Step 41.1: 行クリック → モーダル: 当日タイムライン (`tree_call_records` 一覧)**

- [ ] **Step 41.2: Commit**

#### Task 42: 介入 UI（指示メッセージ送信）

**Files:**
- Modify: `src/app/tree/feedback/page.tsx`
- Create: `src/app/tree/_actions/sendDirective.ts`

- [ ] **Step 42.1: マネージャー → オペレーター DM 送信フォーム**

- 配信先: Chatwork DM + Tree 内通知バッジ
- **署名 URL は本文に含めない（D-03 案 D 準拠）**

> **判断保留 D-03-判5**: 他部署マネージャーが別部署オペレーターに指示送信可能か。**仮スタンス**: 不可（自部署のみ）、全社横断は admin+ のみ。

- [ ] **Step 42.2: Vitest + RTL**

- [ ] **Step 42.3: Commit**

#### Task 43: アラート検出ロジック + バッジ

**Files:**
- Create: `src/app/tree/_lib/alertDetection.ts`
- Modify: `src/app/tree/alerts/page.tsx`

- [ ] **Step 43.1: 5 種アラート検出**

- 🔴 低成約率 (≥30 calls かつ toss_rate < 5%)
- 🔴 離脱多発 (≥3 NG クレーム)
- 🟡 長時間離席 (last_called_at > 30min ago)
- 🟡 連続不通 (10 連続 unreach)
- 🟢 好調 (toss_rate > 20% かつ calls > avg×1.5)

> **判断保留 D-03-判3**: 閾値の具体数字。**仮スタンス**: 業務統計平均の 50% を基準、初期 3 ヶ月で調整。

- [ ] **Step 43.2: 重複制御**: 同一オペレーター × 同一アラートは 30 分に 1 回まで（記憶: localStorage）

- [ ] **Step 43.3: Commit**

#### Task 44: Chatwork 連携（通知送信）

**Files:**
- Create: `src/app/tree/_lib/chatworkNotify.ts`

- [ ] **Step 44.1: spec-cross-chatwork-notification §6 準拠の p-queue 5req/sec**

- [ ] **Step 44.2: 5 種アラート通知 + 指示送信通知 + 週次サマリ**

- [ ] **Step 44.3: Vitest（mock fetch）**

- [ ] **Step 44.4: Commit**

#### Task 45: D-03 結合テスト

- [ ] **Step 45.1: 30s polling + アラート + 介入 UI 通し動作**

- [ ] **Step 45.2: 7 ロール × 操作の権限境界テスト**

- [ ] **Step 45.3: Commit + push**

---

### §6 D-05 KPI Dashboard (Tasks 46-54, ~7.5h)

> **対応 spec**: spec-tree-phase-d-05
> **見積合計**: 7.5h (9 タスク)
> **前提**: §1 §3 §5 完了（リアルタイム部分の流用）

#### Task 46: MV 3 本 + REFRESH スケジュール

**Files:**
- Create: `supabase/migrations/20260601_08_kpi_materialized_views.sql`

- [ ] **Step 46.1: `mv_tree_kpi_daily` / `mv_tree_kpi_weekly` / `mv_tree_kpi_monthly`**

集計キー: `(date, employee_id, campaign_code)` UNIQUE。タイムゾーン Asia/Tokyo。

- [ ] **Step 46.2: REFRESH MATERIALIZED VIEW CONCURRENTLY スクリプト**

REFRESH スケジュール（JST）:
- 日次 23:30
- 週次 月曜 05:00
- 月次 1 日 05:00

- [ ] **Step 46.3: 索引設計（spec §3）**

- [ ] **Step 46.4: Commit**

#### Task 47: REFRESH Cron (`/api/tree/cron/refresh-mv`)

**Files:**
- Create: `src/app/api/tree/cron/refresh-mv/route.ts`
- Modify: `vercel.json`

- [ ] **Step 47.1: 3 つの MV を順次 REFRESH（CRON_SECRET 認証）**

- [ ] **Step 47.2: 失敗時 Chatwork admin アラート**

- [ ] **Step 47.3: Commit**

#### Task 48: KPI 画面骨格 + フィルタ UI (`/tree/kpi`)

**Files:**
- Create: `src/app/tree/kpi/page.tsx`
- Modify: `src/app/tree/_constants/screens.ts`（パス追加）
- Modify: `src/app/tree/_components/SidebarNav.tsx`（メニュー追加）

- [ ] **Step 48.1: フィルタ行（粒度/期間/対象/キャンペーン）**

- [ ] **Step 48.2: Server Component で MV を SELECT、権限ガード `kpi/_lib/guard.ts` 経由**

> **R: known-pitfalls #2**: MV は RLS 効かない → Server Component / Server Action でのみ SELECT。クライアント直 SELECT 禁止。

- [ ] **Step 48.3: Commit**

#### Task 49: KPI カード 10 種

**Files:**
- Create: `src/app/tree/kpi/_components/KPICard.tsx`

- [ ] **Step 49.1: 5 営業 + 3 品質 + 2 稼働 = 10 種**

- [ ] **Step 49.2: 前期比矢印（↑↓→）**

- [ ] **Step 49.3: RTL**

- [ ] **Step 49.4: Commit**

#### Task 50: Recharts トレンドグラフ

**Files:**
- Create: `src/app/tree/kpi/_components/KPITrendChart.tsx`

- [ ] **Step 50.1: 直近 30 日折れ線 3 系統**（コール数・トス数・NG 率）

- [ ] **Step 50.2: 期間比較表示**

> **判断保留 D-05-判3**: 期間比較表示（同時 vs トグル）。**仮スタンス**: 同時表示（折れ線 2 系統）。

- [ ] **Step 50.3: Commit**

#### Task 51: ランキングテーブル

**Files:**
- Create: `src/app/tree/kpi/_components/KPIRanking.tsx`

- [ ] **Step 51.1: TanStack Table、トス率降順、ドリルダウンリンク**

- [ ] **Step 51.2: Commit**

#### Task 52: CSV / Excel エクスポート

**Files:**
- Create: `src/app/tree/kpi/_components/ExportButtons.tsx`
- Create: `src/app/api/tree/kpi/export/route.ts`

- [ ] **Step 52.1: CSV (UTF-8 BOM)**

ファイル名: `tree-kpi-{period}-{target}-{yyyymmdd}.csv`

- [ ] **Step 52.2: Excel 2 シート（サマリ + 日別詳細）**

`anthropic-skills:xlsx` 活用。

- [ ] **Step 52.3: Vitest + RTL（mock fetch）**

- [ ] **Step 52.4: Commit**

#### Task 53: 月次レポート Chatwork 連携 + ドリルダウン

**Files:**
- Create: `src/app/api/tree/kpi/monthly-report/route.ts`
- Create: `src/app/tree/kpi/_components/Drilldown.tsx`

- [ ] **Step 53.1: 月次レポート PDF/Excel を Supabase Storage `reports/tree-kpi/YYYY-MM/` へ保存**

- [ ] **Step 53.2: Chatwork 投稿（ログイン誘導のみ、署名 URL 不流通）**

- [ ] **Step 53.3: Drilldown: ランキング行クリック → 個人別直近 100 件**

- [ ] **Step 53.4: Commit**

#### Task 54: D-05 結合テスト

- [ ] **Step 54.1: 7 種 × 7 ロール 権限テスト**

- [ ] **Step 54.2: パフォーマンス計測（spec §6 目標）**

- [ ] **Step 54.3: Commit + push**

---

### §7 D-06 E2E + 受入 (Tasks 55-62, ~8.0h)

> **対応 spec**: spec-tree-phase-d-06
> **見積合計**: 8.0h (8 タスク)
> **前提**: §3 §4 §5 §6 完了

#### Task 55: Playwright config + 10 spec ファイル雛形

**Files:**
- Modify: `playwright.config.ts`（tree project 追加: `headless: false`, `slowMo: 50`, `retries: 2`）
- Create: `tests/e2e/tree/sprout.spec.ts`（雛形 + 1 sanity test）
- Create: `tests/e2e/tree/branch.spec.ts`（雛形）
- Create: `tests/e2e/tree/rollback.spec.ts`
- Create: `tests/e2e/tree/shortcuts.spec.ts`
- Create: `tests/e2e/tree/toss.spec.ts`
- Create: `tests/e2e/tree/manager-dashboard.spec.ts`
- Create: `tests/e2e/tree/kpi.spec.ts`
- Create: `tests/e2e/tree/permissions.spec.ts`
- Create: `tests/e2e/tree/offline.spec.ts`
- Create: `tests/e2e/tree/midnight.spec.ts`

- [ ] **Step 55.1: 10 ファイル雛形（test.skip + 1 sanity）**

> **判断保留 D-06-判3**: F1-F10 ショートカット test に物理キーボード必須か。**仮スタンス**: `headless: false` + xvfb (CI)。

- [ ] **Step 55.2: Commit**

#### Task 56: Sprout / Branch E2E (合計 21 ケース)

**Files:**
- Modify: `tests/e2e/tree/sprout.spec.ts`（10 結果ボタン × INSERT 動作）
- Modify: `tests/e2e/tree/branch.spec.ts`（11 結果ボタン）

- [ ] **Step 56.1: 5 ケース sprout 実装、PASS**

- [ ] **Step 56.2: 5 ケース sprout 残り + 11 ケース branch 実装、PASS**

- [ ] **Step 56.3: Commit**

#### Task 57: Rollback / Shortcuts E2E (12 ケース)

**Files:**
- Modify: `tests/e2e/tree/rollback.spec.ts`（5 秒以内 success / 超過 reject）
- Modify: `tests/e2e/tree/shortcuts.spec.ts`（F1-F10 × 10）

- [ ] **Step 57.1: 実装、PASS**

- [ ] **Step 57.2: Commit**

#### Task 58: Toss / Manager / KPI / Permissions / Offline / Midnight E2E

**Files:** 残り 6 spec ファイルを充填

- [ ] **Step 58.1: 各 spec 実装**

- [ ] **Step 58.2: 全 10 spec で PASS 確認**

- [ ] **Step 58.3: Commit**

#### Task 59: axe-core + Lighthouse 統合

**Files:**
- Create: `tests/e2e/tree/a11y.spec.ts`（全画面 axe-core）
- Modify: `.lighthouserc.json`（tree URLs、accessibility ≥ 95）
- Modify: `.github/workflows/ci.yml`（lhci 実行）

- [ ] **Step 59.1: axe-core 統合**

- [ ] **Step 59.2: Lighthouse CI 設定**

- [ ] **Step 59.3: 既存 a11y 違反があれば修正**

- [ ] **Step 59.4: Commit**

#### Task 60: GitHub Actions CI 更新

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 60.1: Tree Vitest + Playwright + lhci のジョブ追加**

- [ ] **Step 60.2: 85% カバレッジ未満で merge block**

> **判断保留 D-06-判2**: sub-85% PR を block か warn か。**仮スタンス**: block（🔴 strict）。

- [ ] **Step 60.3: Commit**

#### Task 61: Rollback drill 手順書 (`docs/tree-fm-rollback-drill.md`)

**Files:**
- Create: `docs/tree-fm-rollback-drill.md`

- [ ] **Step 61.1: L1-L3 手順詳述（spec §6.3）**

- L1: オペレーターに今日は FM 使用指示（5 分）
- L2: Tree router 手動切断（15 分）
- L3: Tree テーブル DROP + FM データ再 sync（2 時間）

> **判断保留 D-06-判6**: L3 承認者。**仮スタンス**: 東海林さん + admin 2 名（dual 承認）。

- [ ] **Step 61.2: Commit**

#### Task 62: §7 完了マーク + フルテスト実行

**Files:** None

- [ ] **Step 62.1: `npm run test:tree:coverage`、Playwright 全実行**

- [ ] **Step 62.2: 各種計測結果を `docs/pre-release-test-20260601-tree.md` に記録**

- [ ] **Step 62.3: Commit + push**

---

### §8 §16 7 種テスト全完走 (Task 63, ~4.0h)

> **対応**: 親CLAUDE.md §16
> **見積**: 4.0h (auto モードで網羅実行)
> **前提**: §7 完了

#### Task 63: §16 7 種テストを Tree 全機能に適用

**Files:**
- Create: `docs/pre-release-test-20260601-tree.md`（最終版）

- [ ] **Step 63.1: 7 種すべて auto 実行**

1. 機能網羅（Playwright 10 spec）
2. エッジケース（D-06 §3-2 全項目）
3. 権限テスト（7 ロール × RLS マトリクス）
4. データ境界（D-06 §3-4）
5. パフォーマンス（D-06 §3-5、目標値全項目）
6. コンソールエラー監視（Playwright `page.on('console')` で error 検出 = fail）
7. アクセシビリティ（axe 0 violations + Lighthouse ≥ 95）

- [ ] **Step 63.2: 不合格・警告項目を🔴緊急 / 🟡推奨 / 🟢後回しで記録**

- [ ] **Step 63.3: 🔴 緊急項目を即修正、retest**

- [ ] **Step 63.4: 全 ✅ で α リリース可判定、handoff 作成**

- [ ] **Step 63.5: Commit + push**

---

### §9 α 版（東海林 1 人、〜 1 週間）

#### Task 64: α リリース準備 + 通知

**Files:**
- Modify: `docs/effort-tracking.md`（α 行を「実施中」マーク）
- Create: `docs/handoff-tree-YYYYMMDDHHMM-phase-d-alpha.md`

- [ ] **Step 64.1: develop merge 後の本番 Vercel デプロイ確認**（develop = preview、main = production）

> **重要**: 本タスクは a-main / 東海林さんによる承認 + 本番 deploy 必須。a-tree が単独で main 直 push は禁止。develop merge → preview Vercel で α テスト後、本番デプロイは別 PR で main へ。

- [ ] **Step 64.2: 東海林さんに α 開始通知（Chatwork or 直接）**

- [ ] **Step 64.3: handoff 文書作成**

#### Task 65: α 検証実施（東海林さん側、約 1 週間）

> **a-tree が直接実施するタスクではない。** ただし問題発生時に補助。

- [ ] **Step 65.1: §9 通過条件チェックリスト**（東海林さん用）

✅ 100 件実コール（実リスト使用）の通し
✅ オフライン → 復帰 50 件 flush
✅ F1-F10 ショートカット動作
✅ FM vs Garden 5 件 spot-check 結果一致
✅ マネージャー UI で活動見える

- [ ] **Step 65.2: バグ・UX フィードバック収集 → `docs/field-feedback-20260601-tree.md`**

- [ ] **Step 65.3: 🔴 緊急バグは即修正サイクル（fix → retest → α 再開）**

#### Task 66: α 合格判定 + β1 移行準備

- [ ] **Step 66.1: 全項目 ✅ で α 合格判定、handoff 更新**

- [ ] **Step 66.2: 不合格項目があれば §3-§7 該当タスクへ戻して修正**

---

### §10 β + Full release + FM 切替

#### Task 67: β1（信頼スタッフ 1 人、1 週間、FM 並行）

> **a-tree 担当**: 並行運用ログ自動収集 + 日次 KPI 比較レポート生成

**Files:**
- Create: `src/app/api/tree/cron/parallel-comparison/route.ts`（夜間 23:30 JST、FM ODBC vs Garden の差分計算）
- Create: `docs/field-feedback-20260601-tree.md`（β1 セクション）

- [ ] **Step 67.1: 並行比較 Cron 実装**

> **判断保留 D-06-判4**: FM vs Garden 日次照合の自動化。**仮スタンス**: Python + FM ODBC + Supabase で自動化。Tree 側は Cron で結果を受信して `docs/parallel-comparison-YYYYMMDD.md` を生成。

- [ ] **Step 67.2: 1 週間運用 → 通過条件**

- 0 critical
- 新旧コール数 ±10% 以内
- UX フィードバック 5 件以下

- [ ] **Step 67.3: handoff 更新、β2-3 移行判定**

#### Task 68: β 2-3 人 → β half → 全員投入

**Files:** 各段階の `docs/field-feedback-...` に追記

- [ ] **Step 68.1: 段階毎の通過条件確認**（§4 で定義済）

- [ ] **Step 68.2: KPI ±5% → ±3% 厳格化**

- [ ] **Step 68.3: Rollback drill 月次実施（β half 中）**

#### Task 69: FM 切替 + 30 日並行参照 + Archive

- [ ] **Step 69.1: FM 出力停止確認**（FM ODBC バッチを停止、`v_tree_legacy_history` で参照のみ可）

- [ ] **Step 69.2: 30 日間 FM 履歴を read-only 参照可（Soil から SELECT）**

- [ ] **Step 69.3: +30 日後、FM-sourced rows を Soil から archive テーブルに移動**

- [ ] **Step 69.4: Phase D 完了 handoff、effort-tracking 全実績入力、PR / merge 完了報告**

---

## 6. 判断保留事項（東海林さん要確認、合計 38 件）

> spec 起草時点で a-auto が「仮スタンス」を提示済の項目。実装着手前または α テスト中に確定が望ましいもの。

### D-01（3 件）
| # | 内容 | 仮スタンス |
|---|---|---|
| 01-判1 | Soil 既存スキーマ調査の必要性 | 着手前に a-soil と要調整 |
| 01-判2 | 3-round-trip テストの自動化 | dev のみ手動、CI は別途検討 |
| 01-判3 | パフォーマンス目標未達時 | partition 化 or 索引追加 |

### D-02（7 件）
| # | 内容 | 仮スタンス |
|---|---|---|
| 02-判1 | 前日同一キャンペーンの自動選択 | 自動、新商材時のみ強制選択 |
| 02-判2 | オフラインキュー上限 | 500 件、超過 = 業務停止扱い |
| 02-判3 | 巻き戻し時間枠 | 5 秒固定 |
| 02-判4 | F1-F10 ブラウザ機能 override | OK（教育で周知 + トグル） |
| 02-判5 | 音声 beep ON/OFF | 既定 OFF |
| 02-判6 | 電話番号リンク | モバイルは `tel:`、PC は表示のみ |
| 02-判7 | メモ文字数上限 | 500 文字、超過 truncate 警告 |

### D-03（7 件）
| # | 内容 | 仮スタンス |
|---|---|---|
| 03-判1 | 録音聴取 | D-1 は PBX リンク誘導、D-2 で再検討 |
| 03-判2 | モニタリング方式 | D-1 polling 採用 |
| 03-判3 | アラート閾値具体数字 | 業務統計 50% 起点、3 ヶ月で調整 |
| 03-判4 | 指示メッセージテンプレ化 | D-1 手動、D-2 でテンプレ |
| 03-判5 | 他部署マネージャー横断指示 | 不可、admin+ のみ |
| 03-判6 | アラートミュート | 可、`alert_preferences` jsonb |
| 03-判7 | 1 日 2+ セッションの集計 | 合算、詳細リンクで個別 |

### D-04（7 件）
| # | 内容 | 仮スタンス |
|---|---|---|
| 04-判1 | 他商材対応時期 | D-2 光、D-3 クレカ |
| 04-判2 | トス後 Tree メモ編集 | 不可（原本性） |
| 04-判3 | トス取消機能 | 不可（Leaf 事務 cancel 依頼） |
| 04-判4 | 同意確認の全商材必須化 | 全商材必須（景表法・特商法） |
| 04-判5 | 商材別 Chatwork 振り分け | `campaign_code → room_id` マッピング |
| 04-判6 | ピーク負荷 500 トス/時 | 1 関数 < 200ms で問題なし |
| 04-判7 | Leaf ステータス poll 頻度 | D-1 5 分固定、D-2 で Realtime |

### D-05（8 件）
| # | 内容 | 仮スタンス |
|---|---|---|
| 05-判1 | KPI 目標設定機能 | D-2 先送り |
| 05-判2 | 閾値アラート | D-03 でリアルタイム対応 |
| 05-判3 | グラフ期間比較表示 | 同時表示 2 系統 |
| 05-判4 | PDF 出力 | D-1 Excel のみ、D-2+ で要望次第 |
| 05-判5 | MV 長期運用 | 2 年後に partition 検討 |
| 05-判6 | スマホ対応 | タブレット止まり |
| 05-判7 | KPI 目標値ソース | 自社 3 ヶ月移動平均 |
| 05-判8 | 非稼働日 | 既定含める、トグル提供 |

### D-06（7 件）
| # | 内容 | 仮スタンス |
|---|---|---|
| 06-判1 | 負荷テストツール | k6 採用 |
| 06-判2 | sub-85% PR | block merge |
| 06-判3 | F1-F10 物理キーボード | `headless: false` + xvfb |
| 06-判4 | FM vs Garden 照合 | 自動化 |
| 06-判5 | α audio playback | α 除外、β で D-03 §5 確定後 |
| 06-判6 | L3 承認者 | 東海林 + admin 2 名 |
| 06-判7 | テスト社員番号予約範囲 | 0001-0009 |

### 推奨アクション
- 実装着手前に **東海林さんへ全 38 項目を一括提示**して仮スタンス承認/否認/修正の回答を得る
- 否認・修正項目は plan v3 を v3.1 に更新（spec 修正は別 PR で a-auto に依頼）
- α テスト中に発見された判断事項は β 移行前にまとめて確定

---

## 7. リスクレジスタ

| # | リスク | 影響 | 対策 |
|---|---|---|---|
| R1 | FM ショートカットとブラウザ機能衝突 | 既存 F5 リロード等が機能しない | preventDefault + 教育 + トグル提供（Task 22） |
| R2 | App Router で SPA 内遷移ガード | 通話中の誤遷移でデータ喪失 | CallLink で全 SidebarNav Link 適用、棚卸し（Task 25/30） |
| R3 | オフラインキュー復帰失敗 | 50+ 件のコール記録ロスト | 3 リトライ + 手動再送 UI（Task 24） |
| R4 | Breeze タイマー精度（バックグラウンド throttle） | duration_sec が短く記録 | visibilitychange 補正（Task 27） |
| R5 | 既存画面破壊（Phase B 動作不良） | 業務停止リスク | _legacy 保護コメント + 既存ボタン全動作テスト（Task 30） |
| R6 | MV REFRESH 失敗 | KPI 古いデータ表示 | Chatwork admin alert + 手動 REFRESH SQL（Task 47） |
| R7 | Leaf ステータス poll 過剰負荷 | Supabase 帯域圧迫 | 5 分固定 + 同時 poll 数制限（Task 35） |
| R8 | RLS 設計バグ（other-dept manager が見えてしまう） | 情報漏洩 | 7 ロール × RLS マトリクステスト Task 9 + Task 63 §16-3 |
| R9 | Trigger による集計値ズレ | 統計不正確 | rollback / soft-delete 時の補正 Trigger Task 7 |
| R10 | FM 切替後の FM 履歴ロスト | 過去案件の参照不能 | `v_tree_legacy_history` + 30 日並行参照（Task 69） |
| R11 | Vercel Cron 失敗（夜間 MV REFRESH 等） | KPI / 整合性ジョブ未実行 | CRON_SECRET 認証 + 失敗時 Chatwork（Task 47/36） |
| R12 | 100K calls/day 負荷下の遅延 | UX 悪化 → 業務効率低下 | β half で 100K calls/day 負荷テスト（Task 63 §16-5） |

---

## 8. 既存 Tree Phase A / B との連携ポイント

| Phase | 連携内容 |
|---|---|
| Tree Phase A 認証 | `useTreeState()` / `signInTree()` を流用（Task 19+ で既存ヘルパ参照） |
| Tree Phase A garden_role 7 段階 | RLS / マネージャー UI で参照、新ロール追加時は known-pitfalls #6 適用 |
| Tree Phase B 通話履歴 | 既存 `insertCall()` を `tree_call_records` に置換、Phase B Step 4-6 が稼働中なら段階的に切替（α 期間中は Phase B コードは保護コメントで残す） |
| Tree Phase B-β 誕生日同期 | 影響なし（認証パス同期は別経路） |
| Tree Phase B-β B 経路 | 影響なし（PR #60 マージ後の状態を前提） |

**重要**: Phase B `insertCall()` から `tree_call_records` への移行は、α テスト合格まで `if (FEATURE_FLAG_TREE_PHASE_D)` で切替可能にしておき、ロールバック時に旧経路へ戻せるようにする（Task 18-21 で考慮）。

---

## 9. Self-Review

このプランを起草後、以下のチェックを実施した結果:

### Spec coverage
- D-01 12 タスク → §1 Tasks 3-14 ✅
- D-02 13 タスク → §3 Tasks 18-30 ✅
- D-03 8 タスク → §5 Tasks 38-45 ✅
- D-04 7 タスク → §4 Tasks 31-37 ✅
- D-05 9 タスク → §6 Tasks 46-54 ✅
- D-06 8 タスク → §7 Tasks 55-62 ✅
- 親CLAUDE.md §16 7 種 → §8 Task 63 ✅
- 親CLAUDE.md §17 5 段階 → §9-§10 Tasks 64-69 ✅

ギャップなし。

### Placeholder scan
- 「TBD」「TODO」「fill in details」検出: ゼロ
- 仮スタンス記載は §6 で網羅、判断保留として明示
- 「以後 Task X で〜」のような後続参照は意図的（subagent-driven 実行で確実に埋まる）

### Type / Naming consistency
- `tree_calling_sessions` / `tree_call_records` / `tree_agent_assignments` 全タスクで統一
- `openSession` / `closeSession` / `tossToLeaf` Server Action 名全タスクで統一
- 関数 / Trigger 名 `fn_tcr_*` `trg_tcr_*` プレフィックス統一

### Tree 特例（§17）反映
- α / β1 / β2-3 / β half / 全員 5 段階を §9-§10 に組込済 ✅
- 各段階の通過条件を §4 で明示 ✅
- L1-L3 rollback drill を Task 61 で文書化 ✅
- FM 並行運用 → 30 日参照 → Archive を Task 67/69 で組込済 ✅

### known-pitfalls.md 反映
- §3 横断表で 5 件 (#1, #2, #3, #6, #8) 反映済 ✅

### 干渉回避
- `src/app/leaf/` 不触（D-04 は API contract のみ）✅
- `src/lib/supabase/admin.ts` import のみ ✅
- Phase A/B 既存 Tree 動作保護（Task 30 で確認）✅
- main / develop 直 push 禁止厳守 ✅

検出された改善点はインライン修正済。

---

## 10. 変更履歴

| 日付 | 版 | 改訂内容 | 担当セッション |
|---|---|---|---|
| 2026-04-25 | v3.0（初版） | 起草。Phase D 6 spec を統合、Tree 特例 §17 段階展開と §16 7 種テストを完備した実装プラン。69 タスク、見積 6.5d + 5 週間検証期間。判断保留 38 件を §6 で網羅。 | a-tree |

---

## 付録A: 完了基準チェックリスト

実装プランがすべて完走したと宣言できる条件:

- [ ] §1〜§7 の Task 3-62 すべてが ✅
- [ ] §8 Task 63 で §16 7 種テスト全 ✅（不合格 0、警告は記録）
- [ ] §9 α テストで東海林さん sign-off
- [ ] §10 β1 で 0 critical、新旧 ±10%
- [ ] §10 β half で 0 critical、新旧 ±3%
- [ ] §10 全員投入後 30 日で 0 critical
- [ ] §10 Task 69 で FM Archive 完了
- [ ] effort-tracking 全 11 行に実績入力
- [ ] handoff-tree-*-phase-d-completion.md で総括

—  end of plan v3 —
