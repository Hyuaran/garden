# PR #150 独立レビュー結果

- **対象**: PR #150 / `feat(bloom): Phase A-2 統合 KPI + Garden 統一認証 + Daily Report MVP + 法人アイコン`
- **ブランチ**: `feature/bloom-6screens-vercel-2026-05-006` → **main**（直行）
- **規模**: +13,327 / -538 / 100 files / 53 commits
- **MergeStateStatus**: CLEAN（5/13 16:30 時点 origin/main に対して）
- **作成**: 2026-05-13(水) 17:10（a-review-001、main- No. 350 依頼）
- **依頼元**: a-main-026

---

## 1. 評価方法

| 項目 | 内容 |
|---|---|
| 物理検証 | `gh pr view 150` + `gh pr diff 150` で実差分取得、`git fetch origin pull/150/head:pr-150` で local branch 作成、`git show pr-150:<path>` で核心 7 ファイル直接読込 |
| 推測禁止 | すべての判定は実 file content / git diff / gh API 結果に基づく、HTML 構造比較や Drive Read で確認 |
| 並行禁止 | review-19 完了後、本 PR #150 専属、他作業並行なし |
| Self-prep | review-13 で確立した「DOM/Code 抽出 + ファイル ls 検証」を継続採用 |

## 2. 観点別判定

| # | 観点 | 判定 | 一行要約 |
|---|---|---|---|
| 1 | 規模感の妥当性（13,327 行 / main 直行）| 🟡 YELLOW | main 直行 = develop bypass、論理的乖離リスク、ただし規模自体は 1 ヶ月累積として妥当 |
| 2 | Garden 統一認証ゲート実装品質（ROLE_LANDING_MAP 7 段階）| 🟡 YELLOW | クライアント側のみの認証チェック = bypass 可能、ROLE_LANDING_MAP と getPostLoginRedirect 不整合 |
| 3 | 統合 KPI ダッシュボード設計品質（拡張性・dev mock）| ✅ GREEN | dev mock + Supabase 両対応、PlaceholderKpiCard で 3 モジュール対応、テスト 5 件 PASS |
| 4 | Daily Report MVP API 実装（RLS 連携・anon 流用禁止）| 🔴 **RED** | **SERVICE_ROLE_KEY で RLS 迂回 + Route Handler 内 garden_role 検証なし = known-pitfalls #2 違反** |
| 5 | 5/13 大手術（#170-#174）との Conflict | ✅ GREEN | 直接的 file overlap 0 件、bank rename / cross_rls_helpers / root_can_* いずれも PR #150 touch なし |
| 6 | 後道さん 5/13 仕訳帳 (PR #172) との整合性 | 🟡 YELLOW | forest_balance_sheets revenue カラム前提が a-forest-002 と未調整、forest_journals (PR #172) とは別系統で論理的 conflict なし |

🎯 重大度サマリ: 🔴 **1** / 🟡 **3** / ✅ **2**

---

## 3. 詳細評価

### 観点 1: 規模感の妥当性（🟡 YELLOW）

**PR 構造**:
- 100 files、+13,327 / -538
- 内訳推定: 実装 ~30 files / docs (dispatch-bloom-* + handoff + plan) 大量 / spec (3 件) / legacy 保持
- base = **main**（develop bypass）
- 5/13 大手術 #170-174 すべて develop merged 済（main 未反映）

**懸念**:
- 通常運用 (`feature/* → develop → main`) を bypass し、`feature → main` 直行
- develop の最新 (#170-174) を取込まずに main 反映 → develop と main の **論理的乖離** 発生
- PR 本文に「main 直行の理由」明記なし
- mergeStateStatus: CLEAN は「現在 main に対する file conflict なし」を意味するだけ、develop ahead の論理整合性は別問題

**事実確認** (`git diff origin/develop...pr-150 --name-status` 結果):
- 追加ファイル多数（dispatch-bloom-* 30+ files, CLAUDE.md.bak 1,536 行）
- 削除なし、変更ファイル `.claude/settings.json` / `CLAUDE.md` のみ
- **bank rename / cross_rls_helpers / root_can_* / forest_journals すべて PR #150 touch なし** = file レベル conflict 0 件

**判定根拠**: main 直行は cmodel 違反だが、5/13 デモ前 critical path で許容範囲。ただし PR body に「**develop bypass の理由** + **develop の #170-174 取込み計画**」明記推奨。

**修正案** (推奨、必須ではない):
- PR body に「main 直行理由（5/13 デモ前 critical path、a-bloom 累積成果統合）」追記
- merge 後、`git merge main` を develop へ即座に反映する後続 PR 起票

### 観点 2: Garden 統一認証ゲート実装品質（🟡 YELLOW）

**実装内容**:
- `src/app/_components/GardenHomeGate.tsx`（104 行）: admin/super_admin 限定ゲート、`useEffect` + `supabase.auth.getSession()` + `root_employees.garden_role` 取得
- `src/app/_lib/auth-redirect.ts`（26 行）: `ROLE_LANDING_MAP` (8 ロール対応) + `getPostLoginRedirect` (旧関数、coexist)

**強み**:
- ✅ ROLE_LANDING_MAP に 8 ロール完備（super_admin / admin / manager / staff / cs / closer / toss / outsource + default）→ known-pitfalls #6 garden_role CHECK 制約と整合
- ✅ dev (NODE_ENV=development) で bypass、Chrome MCP 視覚確認可
- ✅ legacy 保持: `BloomGate.legacy-forest-redirect-20260507.tsx`

**懸念**:

🟡 **CL-2-1**: クライアント側のみの認証チェック
```ts
// GardenHomeGate.tsx (client component)
const { data: sessionData } = await supabase.auth.getSession();
// ...クライアントで role 取得 → window.location.replace(...)
```
- ブラウザ DevTools でクライアントコード書換 / `setAllowed(true)` 強制で **bypass 可能**
- 本来は middleware / Server Component で role 検証する設計が望ましい
- 作者コメントに「a-root-002 が 5/9-12 で認証 backend 共通化、合流時に Server Gate に置換予定」明記済 → **次フェーズで強化前提**

🟡 **CL-2-2**: `ROLE_LANDING_MAP` vs `getPostLoginRedirect` 不整合

| role | ROLE_LANDING_MAP | getPostLoginRedirect | 差分 |
|---|---|---|---|
| super_admin / admin | `/` | `/` | OK |
| manager | `/root` | `/` | ❌ 不整合 |
| staff | `/tree` | `/` | ❌ 不整合 |
| cs | `/tree` | `/` | ❌ 不整合 |
| closer / toss | `/tree` | `/tree` | OK |
| outsource | `/leaf/kanden` | `/leaf/kanden` | OK |

- 同ファイル内で 2 つの redirect マップが coexist → どちらを使うか文脈依存、混乱の元
- 作者コメントで「getPostLoginRedirect 統合は a-root-002 が 5/9-12 で実装予定」と自覚あり

**修正案** (推奨、必須ではない):
- ROLE_LANDING_MAP に統一、getPostLoginRedirect を削除 or alias 化
- 次フェーズ a-root-002 で Server Component / middleware ベースの認証ゲートに置換

### 観点 3: 統合 KPI ダッシュボード設計品質（✅ GREEN）

**実装内容**:
- `src/app/bloom/kpi/page.tsx` + `layout.tsx` 新規ページ
- `_components/UnifiedKpiGrid.tsx` + `ForestKpiCard.tsx`（137 行、法人別月次売上）+ `PlaceholderKpiCard.tsx`（Tree/Bud/Leaf 準備中）
- `_lib/forest-fetcher.ts`（dev mock + Supabase fetch）+ `types.ts`（UnifiedKpiData / ForestMonthlyRevenue）
- vitest 全 5 tests PASS

**強み**:
- ✅ dev mock fallback: NODE_ENV=development で 2 法人 × 6 ヶ月の mock データ生成、Chrome MCP 視覚確認可能
- ✅ `useEffect` + `cancelled` フラグでメモリリーク防止
- ✅ PlaceholderKpiCard で 3 モジュール (Tree/Bud/Leaf) スロット確保 = 拡張性高
- ✅ ForestKpiData / ForestMonthlyRevenue 型定義済

**軽微指摘** (🟢):
- 🟢 forest_balance_sheets の revenue カラム前提だが、a-forest-002 と未調整（作者自覚あり、ファイル冒頭 docstring に「Phase A-2.1 着手時に a-forest-002 と確認」明記）
- 🟢 `groupByCorporation` で Map 使用 OK、`formatYen` で 10M / 1万円 単位切替正しい

**判定**: ✅ GREEN（merge 可）。a-forest-002 との revenue カラム調整は post-merge で OK。

### 観点 4: Daily Report MVP API 実装（🔴 RED）

**実装内容**:
- `src/app/api/bloom/daily-report/route.ts`（278 行）
- GET ?date=YYYY-MM-DD で root_daily_reports + root_daily_report_logs 取得
- POST で upsert / delete-and-insert（置換方式）

**🔴 重大問題 CL-4-1**: `SERVICE_ROLE_KEY` で RLS 迂回 + Route Handler 内 garden_role 検証なし

```ts
function buildSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
```

`SERVICE_ROLE_KEY` は RLS を完全 bypass する全権限 key。これを使う場合、**Route Handler 内で手動権限チェックが必須** (known-pitfalls #2)。本 API には:

- `auth.getUser()` 呼び出しなし
- `garden_role` 検証なし
- `req.headers.Authorization` チェックなし
- → **認証ユーザーかどうかすら確認していない、外部から呼べる**

**実害シナリオ**:
1. 攻撃者が `/api/bloom/daily-report?date=2026-05-13` を curl で叩く
2. API は RLS bypass + 認証チェックなしで Supabase から root_daily_reports を返す
3. **東海林さん日報内容が認証なしで漏洩**

POST も同様、認証なしで任意日付の root_daily_reports を upsert 可能 = **データ改ざんリスク**。

**🔴 修正必須案** (merge 前対応):

修正案 A（推奨、known-pitfalls #2 推奨パターン）: anon + JWT 転送
```ts
// クライアント側で Authorization header 付与
const supabase = createClient(url, anonKey, {
  global: { headers: { Authorization: req.headers.get('Authorization') } },
});
// RLS が auth.uid() で発動、root_daily_reports の作成者 = 認証ユーザーかチェック
```

修正案 B（service_role 維持 + 手動権限チェック）:
```ts
const { data: { user } } = await supabaseAnon.auth.getUser(jwt);
if (!user) return NextResponse.json({error:'unauth'}, {status:401});
const { data: emp } = await sb.from('root_employees')
  .select('garden_role').eq('user_id', user.id).maybeSingle();
if (!['super_admin','admin','manager','staff'].includes(emp?.garden_role)) {
  return NextResponse.json({error:'forbidden'}, {status:403});
}
// service_role で RLS 迂回処理 OK
```

→ **merge 前に修正必須**。修正案 A / B どちらでも可、a-bloom-006 と相談推奨。

**他観点**:
- ✅ todayJst() で JST 日付計算 (UTC+9) 正しい
- ✅ dev mock fallback 妥当
- ✅ delete-and-insert（置換方式）は冪等性確保 OK
- ✅ MOCK_REPORT / MOCK_LOGS 定数化

### 観点 5: 5/13 大手術 (#170-174) との Conflict（✅ GREEN）

**5/13 大手術 PR 列挙**:

| PR | 内容 | merged | files | PR #150 と overlap |
|---|---|---|---|---|
| #170 | tree spec D-01 Soil 連携 | ✅ develop | 1f (docs/specs/tree/...) | 0 |
| #171 | bud_bank_* → root_bank_* rename | ✅ develop | 2f (src/app/bud/bank/_lib/types.ts + migration) | 0 |
| #172 | forest 仕訳帳 Phase 1 (8141+) | ✅ develop | 37f (forest 関連) | 0 |
| #173 | cross_rls_helpers deleted_at filter | ✅ develop | 1f (migration) | 0 |
| #174 | root_can_* has_role_at_least wrap | ✅ develop | 3f (migration + helper) | 0 |

**verify コマンド結果**:
```
git diff origin/main...pr-150 --name-only | grep -iE "bank|cross_rls|root_can|forest_shiwake|deleted_at"
→ 0 件
```

→ **直接的な file conflict なし**、5/13 大手術と PR #150 は機能領域が完全分離。

**論理的 conflict 残存** (🟡 軽微、観点 1 と重複):
- develop に存在する #170-174 が main 未反映 = main 反映後の develop / main 乖離継続
- ただし PR #150 の scope (Bloom 認証 + KPI + Daily Report) と #170-174 (Tree spec / Bank rename / Forest 仕訳帳 / RLS helpers) は完全に別領域、機能干渉なし

**判定**: ✅ GREEN（merge 後の develop 再同期を別 PR で実施推奨）

### 観点 6: 後道さん 5/13 仕訳帳 (PR #172) との整合性（🟡 YELLOW）

**PR #172 概要**:
- forest 仕訳帳 Phase 1 (8141+ / 37f)
- `feature/forest-shiwakechou-phase1-min-...` → develop
- merged 済

**PR #150 の forest 関連**:
- `ForestKpiCard.tsx`: forest_corporations + forest_balance_sheets から月次売上 fetch
- `forest-fetcher.ts`: dev mock + Supabase 実装の両対応
- `forest-corporations-mock-migration.md` spec

**整合性**:
- ✅ PR #172 は forest_journals テーブル (仕訳帳)、PR #150 は forest_corporations / forest_balance_sheets (法人マスタ / 財務諸表) → **別テーブル系統**、データ干渉なし
- 🟡 ただし PR #150 ForestKpiCard で `revenue` カラム前提だが、a-forest-002 と未調整 (作者自覚あり)
- 🟡 後道さん 5/13 仕訳帳本番運用は PR #172 経由、KPI dashboard (PR #150) との UI 統合は別フェーズ

**判定**: 🟡 YELLOW（merge 可、ただし forest_balance_sheets の revenue カラム実在確認が必要、a-forest-002 経由）

---

## 4. その他検出問題（観点外、軽微）

### 4-1. 🟡 CLAUDE.md.bak-claude-md-20-23-20260508 (1,536 行) 混入

PR diff に CLAUDE.md backup ファイル (1,536 行) が新規追加されている。これは a-main-014 期の §20-23 追加時の backup で、git ignore 対象候補。

**修正推奨** (post-merge OK): backup ファイル削除 + `.gitignore` に `CLAUDE.md.bak-*` 追加

### 4-2. 🟡 docs/dispatch-bloom-* 大量混入 (30+ files)

a-bloom session の dispatch ログが大量に同 PR に含まれる。実装 PR と docs PR を分離する運用が推奨だが、bloom 累積 1 ヶ月分のため例外措置。

**判定**: 許容範囲（次回以降は docs 系を別 PR で切出推奨）

### 4-3. ✅ legacy ファイル保持

- `BloomGate.legacy-forest-redirect-20260507.tsx`
- `page.legacy-v28a-step5-20260507.tsx`
- `login/page.legacy-bloom-original-login-20260507.tsx`
- `daily-report/page.legacy-placeholder-20260507.tsx`
- `BloomStateContext.legacy-20260507-dev-mock.tsx`

→ CLAUDE.md「コードリプレース時の旧版データ保持（削除禁止）」memory `feedback_no_delete_keep_legacy.md` 遵守 ✅

---

## 5. apply 検証状況 (A-RP-1 §4 形式)

PR #150 に含まれる migration: **なし** (src/lib/garden-corporations.ts はマスタ定数、root_daily_reports / root_daily_report_logs / forest_corporations / forest_balance_sheets はすべて既存テーブル想定)

→ **apply 検証対象なし** (A-RP-1 cross-check 該当なし)

確認:
```
git show pr-150 --stat | grep -i migration
→ 0 件
```

---

## 6. merge 可否の最終判断

### 🟡 **CONDITIONAL APPROVE**（条件付き merge 可）

**merge 前必須対応 (1 件、観点 4 RED)**:
- **🔴 CL-4-1**: `src/app/api/bloom/daily-report/route.ts` の Route Handler に **認証ユーザー検証 + garden_role 権限チェック追加**（修正案 A or B、上記 §3 観点 4 参照）

**merge 後対応推奨 (5 件、観点 1/2/5/6 + その他)**:
- 🟡 ROLE_LANDING_MAP vs getPostLoginRedirect 統一（a-root-002 5/9-12 タスク）
- 🟡 GardenHomeGate を Server Component / middleware に移行（a-root-002 次フェーズ）
- 🟡 main 反映後の develop 再同期 PR（#170-174 の main 取込み）
- 🟡 forest_balance_sheets revenue カラム実在確認（a-forest-002）
- 🟡 CLAUDE.md.bak ファイル削除 + `.gitignore` 拡張

**許容範囲 (3 件)**:
- main 直行（5/13 デモ前 critical path、PR body 補足あれば望ましい）
- docs/dispatch-bloom-* 大量混入（累積 1 ヶ月分の例外措置）
- legacy ファイル保持（memory 遵守、OK）

---

## 7. summary table

| 項目 | 値 |
|---|---|
| 評価 PR | #150 (Bloom Phase A-2 統合) |
| 規模 | 100 files / +13,327 / -538 |
| base | main 直行 |
| 評価実施 | 2026-05-13(水) 16:30-17:10 |
| 観点別判定 | 🔴 1 / 🟡 3 / ✅ 2 |
| 5/13 大手術 #170-174 | file conflict 0 件、論理整合性 OK |
| apply 検証対象 migration | 0 件 |
| **最終判定** | 🟡 **CONDITIONAL APPROVE** (Daily Report API 権限検証修正必須、他は post-merge 対応可) |

---

🤖 a-review-001 by Claude Opus 4.7 (1M context)
