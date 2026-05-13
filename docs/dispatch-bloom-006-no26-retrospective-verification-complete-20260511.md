# 🟢 bloom-006- No. 26
【a-bloom-006 から a-main-024 への dispatch（main- No. 312 + No. 317 遡及検証完走報告、11 PR 統合 trace）】
発信日時: 2026-05-11(月)

# 件名

main- No. 312 broadcast (新 memory A-RP-1 / C-RP-1) 遡及検証 + No. 317 PR #90 検証 統合完走（11 PR trace、Bloom 本体 4 PR + cross-module 5 PR + PR #90 + PR #167 + PR #168）

# A-RP-1 §4 形式 3 点併記

| 項目 | 値 |
|---|---|
| 検証手段 | C. 実装側ラウンドトリップ (git history + application code grep + main branch 反映確認) |
| 検証時刻 | 2026-05-11(月) 22:00 頃 |
| 検証者 | a-bloom-006 |

# # 1. Bloom 本体 4 PR (#123-#126) 検証結果

| PR | mergedAt | 検証手段 | 結果 |
|---|---|---|---|
| #123 (Bloom 6 画面 + /bloom/progress 実データ化) | 5/7 14:49 UTC | main branch 反映確認 | ✅ origin/main HEAD で src/app/bloom + src/app/api/bloom 存在確認 |
| #124 (release develop → main) | 5/7 14:50 UTC | main branch 反映確認 | ✅ 上記と同経路、release commit |
| #125 (hotfix daily-report display_name → name) | 5/7 14:58 UTC | main HEAD 41580d3 確認 | ✅ commit 41580d3 が origin/main 最新 = hotfix 反映済 |
| #126 (release hotfix) | 5/7 14:58 UTC | main branch 反映確認 | ✅ #125 と同経路 |

検証結論: ✅ **4 PR すべて origin/main 反映確認**、Vercel production deploy は main 経路で自動実行想定 (具体 URL の動作確認は東海林さん経由必要、検証手段 A 範囲)。

# # 2. cross-module 5 PR Bloom 側影響 grep 結果

## 2-1. PR #154 (cross-rls-helpers: has_role_at_least / auth_employee_number)

| 検証 | 結果 |
|---|---|
| `grep "has_role_at_least|auth_employee_number" src/` | **0 件** (Bloom 側で未使用) |
| 影響評価 | 🟢 影響なし、将来 Bloom 統合 KPI (Phase A-2.2-4) で導入候補 |

## 2-2. PR #148 (bud_payroll / bud_salary / bud_transfer 等)

| 検証 | 結果 |
|---|---|
| `grep "bud_payroll|bud_salary|bud_transfer" src/` | 10 files 該当 |
| Bloom 側参照 | `src/app/_lib/kpi-fetchers.ts` のみ (Phase A-2 統合 KPI placeholder) |
| 他は Bud module 内部参照 | bud/transfers + bud/_lib + bud/_constants + zengin |
| 影響評価 | 🟢 Bloom 直接参照なし、kpi-fetchers.ts は placeholder で実 SELECT なし |

## 2-3. PR #155 / #156 (Tree D-01 tree_calling_sessions / tree_call_records / tree_agent_assignments)

| 検証 | 結果 |
|---|---|
| `grep "tree_calling_sessions|tree_call_records|tree_agent_assignments" src/` | 1 file (kpi-fetchers.ts) |
| Bloom 側参照 | placeholder のみ |
| 影響評価 | 🟢 影響なし、Tree D-01 RLS 縮退 (manager = 自分担当 only) は Bloom 統合 KPI 着手時に再評価 |

## 2-4. PR #157 (employee_number UNIQUE)

| 検証 | 結果 |
|---|---|
| `grep "root_employees" src/` | 46 件 across 15 files |
| Bloom 関連参照 | bloom/daily-report/page.tsx + bloom/_state/BloomStateContext + bloom/_lib/auth.ts + api/ceo-status/route.ts |
| 影響評価 | 🟢 既存 root_employees 参照、UNIQUE 制約は FK 経路で恩恵あり (employee_number ベース FK が安全化) |

## 2-5. PR #163 (RLS template)

| 検証 | 結果 |
|---|---|
| 内容 | scripts/garden-rls-unified-template.sql + 設計ガイド docs |
| 全 SQL コメントアウト形式 | 実適用なし |
| 影響評価 | 🟢 N/A、template として将来 Bloom テーブル追加時の指針 |

# # 3. PR #90 (bloom_ceo_status) trace (No. 21 既報の統合)

| 観察 | 結果 |
|---|---|
| PR #90 commit (179b8e6) | feature/bloom-migration-ceo-status-20260426-auto **のみ** (develop / main 未反映) |
| develop / main の migration ファイル | ❌ `20260426000001_bloom_ceo_status.sql` 不在 |
| application code 参照 | ✅ `src/app/api/ceo-status/route.ts` + tests で `bloom_ceo_status` 参照 |
| 不整合 | **コード期待 vs migration 不在** = silent NO-OP 罠 #2 該当の可能性 |
| 推測 3 候補 | A. 未 merge / B. revert / C. Dashboard 直接 apply |

推奨アクション (5/12 朝 review 議題 12):
- 東海林さんに Supabase Studio で `bloom_ceo_status` テーブル実存確認依頼 (`SELECT to_regclass('public.bloom_ceo_status')`)
- GitHub API rate limit 回復後 `gh pr view 90 --json state` で merge 状態最終確認
- 真因確定後の対応 (再 merge / 補助 PR で repo 取込 / 等)

# # 4. PR #167 / PR #168 review 結果 (No. 23 / No. 24 既報の統合)

| PR | 内容 | 採否 |
|---|---|---|
| PR #167 (Task 2 Series Home) | 12 module × 8 role visibility matrix + Server Component 化 + supabase/server.ts | ✅ 採用推奨 GO |
| PR #168 (Task 3 ModuleGate 統一) | ModuleGate 共通基盤 + MODULE_MIN_ROLES 一元管理 + 12 module layout 装着 + legacy 保管 | ✅ 採用推奨 GO |

両 PR とも Bloom 側影響:
- visibility matrix で Bloom = staff/cs+ 表示 (Task 2) vs ModuleGate minRole = staff (Task 3) で若干差異 → Phase B-2 統一検討
- BloomGate ラッパー化で dev バイパス継承 (memory `project_bloom_auth_independence` 整合)

# # 5. 検証手段別の限界

本セッション単独では:
- 検証手段 A (Supabase Studio) 不可、東海林さん経由必要
- 検証手段 B (supabase CLI db diff) 不可、環境依存
- 検証手段 C (実装側ラウンドトリップ) 主軸で実施 = git history + grep + main branch 反映確認

主要限界:
- Bloom 本体 4 PR の Vercel production deploy 実動作確認は東海林さん経由 (URL アクセス) 必要
- PR #90 bloom_ceo_status テーブル実存確認は Supabase Studio 必要

# # 6. 用語統一準拠 (A-RP-1 §6)

| PR | マージ済 | apply 済 | 稼働中 |
|---|---|---|---|
| #123-#126 (Bloom 本体) | ✅ | N/A (migration なし) | ⚠️ Vercel 確認要 (東海林さん経由) |
| #148 (Bud) | ✅ | ⚠️ Supabase 確認要 | ⚠️ |
| #154 (cross-rls-helpers) | ✅ | ✅ (main- No. 260 で 14:00 JST apply 報告、3 点併記 不完全) | ✅ |
| #155 (Tree spec) | ✅ | N/A (spec) | ✅ |
| #156 (Tree SQL) | ✅ | ⚠️ Supabase 確認要 | ⚠️ |
| #157 (employee_number UNIQUE) | ✅ | ⚠️ Supabase 確認要 | ⚠️ |
| #163 (RLS template) | ✅ | N/A (template) | N/A |
| **PR #90 (bloom_ceo_status)** | ⚠️ **不明 (GitHub API 確認要)** | ⚠️ **不明** | ⚠️ |

# # 7. 推奨アクション (a-main-024 + 東海林さん へ)

| # | 推奨 | 緊急度 | 対応タイミング |
|---|---|---|---|
| 1 | Supabase Studio で migration apply 状態一括確認 (#148/#154/#156/#157/#90 各テーブル / 関数の実存確認) | 🔴 高 | 5/12 朝 review 議題 |
| 2 | GitHub API rate limit 回復後、PR #90 merge 状態確認 | 🟡 中 | 5/12 朝 review |
| 3 | A-RP-1 §4 3 点併記の遡及補完 (過去 dispatch の「apply 完了」報告に検証手段 + 時刻 + 検証者 を補記) | 🟢 低 | 運用改善 |
| 4 | Bloom 本体 4 PR の Vercel production URL 動作確認 (/bloom + /bloom/progress + /bloom/daily-report) | 🟡 中 | 5/12 朝 |

# # 8. silent NO-OP 罠検出 (A-RP-1 §5)

| 罠 | 該当 PR |
|---|---|
| 1. RLS policy 重複 | 未検出 (Supabase 確認必要) |
| 2. DROP IF EXISTS + CREATE NO-OP | ⚠️ **PR #90** (migration 実行 0 回の可能性) |
| 3. migration 順序依存 | 未検出 |
| 4. transaction rollback | 未検出 |

→ PR #90 を audit 議題 12 として 5/12 朝 review でカバー予定。

# # 9. 累計 review + 検証統計

| カテゴリ | 件数 |
|---|---|
| 累計 review | **18 PR** (#147-#168) |
| main 反映済 | 5 PR (#148 / #154 / #155 / #156 / #163) |
| 遡及検証 (本 No. 26) | 11 PR (#90 / #123-#126 + #148 / #154-#157 + #163) |
| Bloom 本体 4 PR | main 反映 ✅、Vercel 動作確認は東海林さん経由 |
| cross-module 5 PR | Bloom 直接影響なし or 軽微 (kpi-fetchers placeholder) |
| **PR #90 重大発見** | 5/12 朝 review 議題 12 で真因確定 |

# # 10. self-check

- [x] 冒頭 3 行 ~~~ 内配置 (v5.1/v5.2 完全準拠)
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A-RP-1 §4 形式 3 点併記 (検証手段 + 時刻 + 検証者)
- [x] A-RP-1 §5 silent NO-OP 罠 4 種チェック
- [x] A-RP-1 §6 用語統一準拠 (マージ済 / apply 済 / 稼働中)
- [x] # 1: Bloom 本体 4 PR 検証
- [x] # 2: cross-module 5 PR Bloom 影響 grep
- [x] # 3: PR #90 trace (No. 21 統合)
- [x] # 4: PR #167 / #168 review 結果 (No. 23 / No. 24 統合)
- [x] # 5: 検証手段別の限界明示
- [x] # 6: 用語統一準拠表
- [x] # 7: 推奨アクション 4 件
- [x] # 8: silent NO-OP 罠検出
- [x] # 9: 累計 18 PR review + 11 PR 遡及検証統計
- [x] # 10: self-check
- [x] 番号 = bloom-006- No. 26 (主観 ETA 22:00 完走宣言準拠)
- [x] 案 A 即実行採用 + 完走報告
