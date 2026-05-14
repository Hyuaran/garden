# Draft dispatch # 350 — Bloom PR #150 review 依頼（main 直行 13,327 行統合 PR）

> 起草: a-main-026（2026-05-13(水) 15:16 JST、handoff §2 Action 5）
> 投下先: **a-review** セッション（review 担当） / 副: **a-bloom-006**（実装側、修正対応）
> 清書担当: a-writer-001（dispatch v6 規格化）
> 緊急度: 🟡（main 直行 PR、5/13 後道さんデモ前マイルストーン関連、merge 前 review 必須）

---

## 1 件名

`review request: Bloom PR #150 — Phase A-2 統合 KPI + Garden 統一認証 + Daily Report MVP + 法人アイコン (53 commits / 13,327 行 / 94 files、main 直行)`

---

## 2 PR 概要（gh pr view 150 検証済）

| 項目 | 値 |
|---|---|
| PR 番号 | **#150** |
| タイトル | feat(bloom): Phase A-2 統合 KPI + Garden 統一認証 + Daily Report MVP + 法人アイコン |
| ブランチ | `feature/bloom-6screens-vercel-2026-05-006` → `main` |
| 規模 | **53 commits / 13,327 additions / 94 files changed** |
| state | OPEN |
| 起票元 | a-bloom-006 セッション（branch 名末尾 `-006` 由来、累積 003 → 004 → 005 → 006） |
| base | **main 直行**（develop 経由なし、本番直接反映） |
| 関連 plan | `docs/superpowers/plans/2026-05-07-bloom-phase-a2-unified-kpi-dashboard.md`（942 行）<br>`docs/plan-bloom-progress-display-prep-20260508.md`（142 行） |

---

## 3 主要成果（PR body より要約）

### 3.1 Garden 統一認証ゲート（critical path）
- `src/app/login/page.tsx` 統一ログイン画面 v8（claude.ai 起草版 React 化）
- `src/app/page.tsx` Garden Series ホーム画面 v9 unified（**1,050 行**）
- `src/app/_components/GardenHomeGate.tsx` admin/super_admin 限定ゲート
- `src/app/_lib/auth-redirect.ts` ROLE_LANDING_MAP（7 段階ロール → 着地モジュール）
- legacy 保持: `BloomGate.legacy-forest-redirect-20260507.tsx` / `page.legacy-v28a-step5-20260507.tsx` / `login/page.legacy-bloom-original-login-20260507.tsx`

### 3.2 Phase A-2.1 統合 KPI ダッシュボード
- `src/app/bloom/kpi/page.tsx` + `layout.tsx` 新規ページ
- `_components/UnifiedKpiGrid.tsx` / `ForestKpiCard.tsx` / `PlaceholderKpiCard.tsx`（Tree/Bud/Leaf 準備中）
- `_lib/forest-fetcher.ts`（dev mock + Supabase fetch）+ `types.ts`
- vitest 全 5 tests PASS（forest-fetcher 単体 + UnifiedKpiGrid integration）
- Chrome MCP 視覚確認 + regression check 済

### 3.3 Daily Report MVP（#7 完成）
- `src/app/api/bloom/daily-report/route.ts`（**278 行**、API 実装）
- `src/app/bloom/daily-report/page.tsx` 大幅拡張（**525 行**）
- legacy 保持: `daily-report/page.legacy-placeholder-20260507.tsx`

### 3.4 6 法人 + hyuaran-group-hd アイコン組込
- `src/lib/garden-corporations.ts`（**143 行**、GARDEN_CORPORATIONS + GARDEN_GROUP_HD_META 型定義）
- `public/themes/garden-login/` 配下に WebP 6 法人 + bg-night-garden-with-stars + logo-garden-series 配置
- spec §1-2-b 新設（hyuaran-group-hd 専用セクション）+ Forest 連携 spec 起票

### 3.5 spec / plan 起草（5 件、約 1,400 行）

---

## 4 review 観点（必須 8 点）

### 観点 A: 規模感の妥当性 🔴
- **13,327 additions / 94 files** が 1 PR にまとまっている妥当性
- main 直行 = 本番直接反映 → 部分 revert が困難、commit 単位での切戻し可能性確認
- 53 commits の論理単位 = 主要成果 4 領域（認証 / KPI / Daily Report / アイコン） + spec/plan 起草に対応しているか

### 観点 B: Garden 統一認証ゲートの実装品質 🔴
- claude.ai 起草版 React 化の忠実度（v8 統一ログイン画面）
- ROLE_LANDING_MAP の 7 段階ロール対応漏れなし（toss / closer / cs / staff / manager / admin / super_admin）
- GardenHomeGate の admin/super_admin 限定ロジック（memory `project_super_admin_operation.md` 準拠）
- legacy ファイル保持（memory `feedback_no_delete_keep_legacy.md` 準拠）

### 観点 C: Phase A-2.1 統合 KPI ダッシュボードの設計品質 🟡
- 4 モジュール KPI grid（Forest / Tree / Bud / Leaf）の拡張可能性
- ForestKpiCard の dev mock + Supabase fetch 切替（memory `project_bloom_auth_independence.md` の dev バイパス準拠）
- vitest 5 tests のカバレッジ十分性
- PlaceholderKpiCard 3 件（Tree / Bud / Leaf 準備中）の UI ガイダンス

### 観点 D: Daily Report MVP の API 実装 🟡
- `/api/bloom/daily-report/route.ts` 278 行の RLS 連携（memory `project_rls_server_client_audit.md` 準拠、Route Handler で anon 流用していないか）
- 入力 validation / 認証チェック / エラーハンドリング
- legacy placeholder からの差分妥当性

### 観点 E: 6 法人アイコン整合性 🟢
- GARDEN_CORPORATIONS 6 法人 + hyuaran-group-hd の Forest 連携
- WebP ファイル名規則（`public/themes/garden-login/`）
- spec §1-2-b 整合性

### 観点 F: develop merge 群との conflict 🔴
- PR #150 base = main、最新 develop merge 群（#170 / #171 / #172 / #173 / #174）と未統合
- 特に **`bud_bank_*` → `root_bank_*` rename**（PR #171）の Bloom 側参照影響有無
- has_role_at_least wrapper 化（PR #174）の Bloom 認証連携への影響有無

### 観点 G: パフォーマンス / バンドルサイズ 🟢
- 13,327 行追加によるバンドル肥大化（特に WebP 7 枚 + 142 行 + UnifiedKpiGrid 関連 component）
- Vercel ビルド時間 / TTFB 計測
- Chrome MCP Lighthouse（memory § 16 リリース前バグ確認 7 種テストの参考）

### 観点 H: 後道さん 5/13 仕訳帳本番運用 UI への前提整合 🔴
- Bloom 統合 KPI ダッシュボードが Forest 仕訳帳機能（PR #172、本日 apply 完了）と協調動作するか
- ForestKpiCard の Supabase fetch 先 = 本日 seed 投入済の `bud_corporations` / `root_bank_accounts` を参照可能か
- 後道さん UI 確認時に表示が空 / エラーにならないか

---

## 5 review 担当者選定（推奨）

| 候補 | メリット | デメリット | 推奨 |
|---|---|---|---|
| **a-review-001（独立 review セッション）** | 独立性高、a-bloom-006 と無関係 = 客観評価 | 起動から context 構築必要 | ★ |
| a-bloom-006（自己 review） | PR 全文 context あり、修正即対応可 | 自己 review = 客観性低 | NG |
| 第三者 sonnet dispatch（Agent tool） | 並列化可、軽量 | review 観点の網羅性 sonnet 依存 | サブとして併用可 |

**推奨**: **a-review-001 主担当 + sonnet dispatch サブ**（並列）

---

## 6 期待アウトプット（review 完了基準）

### 6.1 review 結果 md
- パス: `C:/garden/a-main-026/docs/review/bloom-pr150-review-result-20260513.md`
- 構成:
  - §1 観点別判定（A〜H 各観点に GREEN / YELLOW / RED）
  - §2 RED / YELLOW 項目の修正提案（具体ファイル + 行番号 + 推奨実装）
  - §3 merge 可否判断（即 merge OK / 修正後 OK / 大規模分割提案）
  - §4 後道さん UI 確認前の前提整合検証結果

### 6.2 a-bloom-006 への修正依頼（必要時）
- review で RED 項目があれば、a-main-026 経由で a-bloom-006 へ修正 dispatch 起票
- 修正完了後、再 review → merge 判断

---

## 7 観点 F（develop conflict）の事前検査推奨（review 前に a-main-026 が補佐）

```powershell
# develop merge 群と PR #150 の conflict 事前確認
git fetch origin develop --quiet
git fetch origin pull/150/head:pr150-review --quiet
git checkout pr150-review
git rebase --dry-run origin/develop 2>&1 | head -30
git checkout workspace/a-main-026
```

結果次第で:
- conflict 0 件 → 観点 F GREEN 確定、review に伝達
- conflict 1+ 件 → review 観点 F に「rebase 必須」前提として伝達

---

## 8 関連 memory（必読）

- `project_bloom_auth_independence.md` — Bloom と Forest 独立認証、dev バイパス必須
- `project_super_admin_operation.md` — super_admin = 東海林さん本人専任
- `project_rls_server_client_audit.md` — Route Handler で anon supabase 流用 = RLS 100% ブロック
- `feedback_no_delete_keep_legacy.md` — legacy 保持規約
- `feedback_self_visual_check_with_chrome_mcp.md` — 視覚確認は Chrome MCP で Claude 自身が実施
- §16 リリース前バグ確認ルール（7 種テスト）

---

## 9 想定所要時間

- a-review-001 起動 + PR 全 file 読み込み + 8 観点審査 + review md 起草: **2〜3 時間**
- 並列 sonnet dispatch（観点 G + 観点 E 限定）: **30 分**
- a-bloom-006 修正対応（RED 項目数次第）: **30 分〜2 時間**

---

## 10 a-writer-001 への清書依頼ポイント

- v6 規格（投下先 / 緊急度 / dispatch 番号 / 添付有無 / 期待アクション 先頭明示）
- 本文は §3 主要成果（4 領域要約） / §4 review 観点 8 点 / §5 担当選定 / §6 期待アウトプットを集約
- a-review-001 起動時の最初の context（PR #150 番号 + 本 draft md パス + handoff-026.md 参照）を投下用短文に明記

---

EOF
