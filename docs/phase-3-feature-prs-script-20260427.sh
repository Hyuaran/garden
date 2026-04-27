#!/bin/bash
# Phase 3: 通常 feature PR 一括発行スクリプト（34 PR）
# 実行: Phase 2 完了後
# 5 分間隔遵守、burst 回避、想定 ~170 分

# 共通テンプレ関数
create_pr() {
  local branch="$1"
  local title="$2"
  local body="$3"
  local i="$4"
  local total="$5"
  echo ""
  echo "[${i}/${total}] $(date '+%H:%M:%S') $branch"
  gh pr create --repo Hyuaran/garden --base develop --head "$branch" \
    --title "$title" --body "$body" 2>&1
  echo "B 垢: $(gh api user --jq '.login + " / " + (.suspended_at // "active" | tostring)' 2>&1)"
  echo "rate: $(gh api rate_limit --jq '.rate.remaining' 2>&1)"
}

FOOTER='

🤖 Generated with [Claude Code](https://claude.com/claude-code)'

{
  echo "=== Phase 3: 通常 feature PR 34 件 発行 開始: $(date) ==="
  TOTAL=34
  i=0

  # ==========================================
  # §1. a-auto グループ 14 件（a-auto-004 起草 bodies 流用）
  # ==========================================

  # #1
  i=$((i+1))
  create_pr "feature/auto-task-ab-broadcast-20260426-auto" \
    "docs(auto): a-auto A+B broadcast（4/26 朝の dispatch ログ）" \
    "## Summary
- a-auto Task A+B 完走時の broadcast ファイル群（dispatch ログ）
- _shared/decisions/ への記録、外部影響なし

## Test plan
- [x] docs only、ビルド影響なし
- [x] Vercel preview build 失敗は無視可（CLAUDE.md §4.3）${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # #2
  i=$((i+1))
  create_pr "feature/auto-task-cdef-broadcast-20260427-auto" \
    "docs(auto): a-auto C+D+E+F broadcast（4/26 夜の task ログ）" \
    "## Summary
- a-auto Task C+D+E+F 完走時の broadcast ファイル群
- M-1/M-2/M-4 矛盾解消、bloom-migration、bloom-tests dispatch 記録

## Test plan
- [x] docs only、ビルド影響なし
- [x] Vercel preview build 失敗は無視可${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # #3
  i=$((i+1))
  create_pr "feature/auto-task-hi-broadcast-20260427-auto" \
    "docs(auto): a-auto H+I broadcast（4/27 朝の task ログ）" \
    "## Summary
- a-auto Task H (盆栽ビュー仕様化) + I (画像生成プロンプト 11 パターン) の broadcast
- 後道さんデモ準備材料の起源記録

## Test plan
- [x] docs only、ビルド影響なし${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # #4
  i=$((i+1))
  create_pr "feature/bloom-migration-ceo-status-20260426-auto" \
    "feat(bloom): bloom_ceo_status migration SQL（85 行）" \
    "## Summary
- bloom_ceo_status テーブル migration SQL（85 行）
- ShojiStatus 機能の永続化基盤、Bloom ホーム画面の経営者ステータス表示用
- garden-dev 適用後、Bloom-002 が活用

## 関連
- spec: docs/specs/2026-04-25-bloom-shoji-status-spec.md
- memory: project_shoji_status_visibility.md

## Test plan
- [ ] migration SQL up + down 試行（dev 環境）
- [ ] RLS ポリシーが期待通り動作
- [ ] Vercel preview build pass${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # #5
  i=$((i+1))
  create_pr "feature/bloom-tests-ceo-status-20260426-auto" \
    "test(bloom): ShojiStatus regression test 20 ケース（597 行）" \
    "## Summary
- ShojiStatus 機能の回帰テスト 20 ケース（597 行）
- a-auto が CRUD + RLS + edge cases を網羅
- a-bloom が新規 tests と統合・spec drift 解消で再構築の可能性あり（注意）

## Test plan
- [ ] vitest run で 20/20 PASS
- [ ] a-bloom-002 第 1 波の API tests と整合
- [ ] Vercel preview build pass${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # #6
  i=$((i+1))
  create_pr "feature/cross-modules-8-role-fix-residual-20260427-auto" \
    "fix(cross): 残スコープ外 4 ファイル 8-role 化（soil/bud/root）" \
    "## Summary
- 4/26 夜 G タスク: 残スコープ外 4 ファイルの 8-role 化（outsource 追加）
- 影響: soil/bud/root の権限テーブル

## Test plan
- [x] spec only、ビルド影響なし${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # #7 ⚠️ batch10 base
  i=$((i+1))
  create_pr "feature/cross-ui-8-role-fix-20260426-auto" \
    "fix(cross-ui): cross-ui-02/06 を 8-role 化（outsource 追加）" \
    "## Summary
- cross-ui-02 と cross-ui-06 spec を 7-role → 8-role 化（outsource 追加）
- ⚠️ batch10 (commit c0b9576) 派生、batch10 merge 後の diff 整合に注意

## ⚠️ 発行順序注意
本 PR は **batch10 が develop merge 後** に diff を整合させること。
batch10 merge 前は diff に batch10 の全変更が混入する。

## Test plan
- [x] spec only、ビルド影響なし
- [ ] batch10 merge 後の diff 確認${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # #8
  i=$((i+1))
  create_pr "feature/cross-ui-audit-20260426-auto" \
    "docs(cross-ui): 6 spec 整合性監査（重大矛盾 4 件指摘）" \
    "## Summary
- cross-ui 6 spec 整合性監査
- M-1/M-2/M-4 重大矛盾 4 件を指摘 → cross-ui-conflicts-fix で解消（PR #9）

## Test plan
- [x] docs only、ビルド影響なし${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # #9 ⚠️ batch10 base
  i=$((i+1))
  create_pr "feature/cross-ui-conflicts-fix-20260426-auto" \
    "fix(cross-ui): M-1/M-2/M-4 矛盾解消（3 spec）" \
    "## Summary
- cross-ui-audit 指摘の M-1/M-2/M-4 矛盾解消（cross-ui-01/04/06 の 3 spec）
- ⚠️ batch10 派生、batch10 merge 後の diff 整合に注意

## Test plan
- [x] spec only${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # #10 ⚠️ batch10 base、★ 後道さんデモ最重要
  i=$((i+1))
  create_pr "feature/cross-ui-godo-redesign-20260427-auto" \
    "docs(cross-ui): 盆栽ビュー仕様化 cross-ui-04/06/01 大改訂" \
    "## Summary
- 盆栽ビュー（旧称、現 Garden View）仕様化に伴う cross-ui-04/06/01 大改訂
- ★ **後道さんデモ最重要**：5/5 後道さん UX 採用ゲートのベース spec
- ⚠️ batch10 派生

## Test plan
- [x] spec only${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # #11 ★ 後道さんデモ最重要
  i=$((i+1))
  create_pr "feature/image-prompts-3candidates-final-20260427-auto" \
    "docs(images): 3 案 × 朝 プロンプト Refinement（590+ 行）" \
    "## Summary
- 朝の 3 案対比（水彩 / 和モダン / 北欧テラリウム）プロンプト Refinement
- ★ **後道さんデモ最重要**：UX 採用ゲートの画像生成材料

## Test plan
- [x] docs only${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # #12
  i=$((i+1))
  create_pr "feature/image-prompts-godo-bonsai-20260427-auto" \
    "docs(images): 画像生成プロンプト 11 パターン（563 行）" \
    "## Summary
- 後道さんデモ向け画像生成プロンプト 11 パターン基本版
- 5/5 デモ準備材料

## Test plan
- [x] docs only${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # #13
  i=$((i+1))
  create_pr "feature/pending-prework-20260426-auto" \
    "docs(cross): 後追い 33 件 prework 整理" \
    "## Summary
- 後追い 33 件の prework 整理（即決可 22 / 議論必要 11 に分類）
- a-main 判断材料

## Test plan
- [x] docs only${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # #14
  i=$((i+1))
  create_pr "feature/tree-phase-d-8-role-fix-20260426-auto" \
    "fix(tree): Phase D 01/06 を 8-role 化（outsource 追加）" \
    "## Summary
- Tree Phase D-01 + D-06 spec を 7-role → 8-role 化（outsource 追加）

## Test plan
- [x] spec only${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # ==========================================
  # §2. a-auto-002 グループ 2 件
  # ==========================================

  # #15
  i=$((i+1))
  create_pr "feature/soil-phase-b-specs-batch19-auto" \
    "docs(soil): Phase B 7 spec 起草（Batch 19）" \
    "## Summary
- Soil Phase B 全 7 spec 起草（DB 基盤、リスト 253 万件・コール履歴 335 万件 対応）
- 実装見積 ~5.25d、起草時間 約 2.5h

## Test plan
- [x] docs only${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # #16
  i=$((i+1))
  create_pr "feature/sprout-fruit-calendar-specs-batch18-auto" \
    "docs(sprout): Sprout/Fruit/Calendar batch + Y 案 + Kintone 14 件" \
    "## Summary
- Sprout/Fruit/Calendar 仕様 batch（12 モジュール化対応）
- Y 案（給与明細配信）整合 + Kintone 14 件反映

## Test plan
- [x] docs only${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # ==========================================
  # §3. a-bloom グループ 3 件
  # ==========================================

  # #17
  i=$((i+1))
  create_pr "chore/bloom-effort-tracking-backfill-202604261" \
    "chore(bloom): A+C+後道さん資料 effort-tracking backfill" \
    "## Summary
- effort-tracking に Bloom 関連の過去実績を後追い記録
- 後道さん資料整理含む

## Test plan
- [x] docs only${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # #18 ⚠️ Vercel build failure (known develop issue)
  i=$((i+1))
  create_pr "feature/bloom-login-and-returnto-fix" \
    "feat(bloom): 独立 login 画面 + /forest/login returnTo バグ修正" \
    "## Summary
- /bloom/login 独立画面新設（Forest/Tree と非対称な 404 解消）
- /forest/login?returnTo=/bloom が無視されるバグ修正
- セキュリティ: sanitizeReturnTo() で /bloom prefix のみ許可、絶対 URL/javascript: 拒否
- Vitest 17 件追加（Bloom 11 + Forest 6）

## ⚠️ Known issue
- Vercel build: failure
- 原因: 既存 develop の test-utils → vitest 不在問題（develop 全体課題、本 PR 範囲外）
- author 自身が commit message で範囲外と明記

## レビュー観点（a-review）
- [ ] sanitizeReturnTo() / sanitizeForestReturnTo() のセキュリティ仕様
- [ ] /bloom/login 独立画面の実装が Forest/Tree login パターンと整合
- [ ] returnTo 機能のテスト網羅
- [ ] develop test-utils 問題は別 PR で対処（本 PR 内では範囲外）

## Test plan
- [ ] tsc --noEmit: 非テストファイル 0 エラー（commit message 確認済）
- [ ] Vitest 17 件（npm install 後）
- [x] Vercel build failure は known develop issue として無視可${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # #19
  i=$((i+1))
  create_pr "fix/develop-next-build-lockfile-sync" \
    "fix(develop): Next.js build lockfile sync + npm install 手順書" \
    "## Summary
- develop の next build lockfile 同期問題修正
- npm install 手順書を docs/runbooks/ に追加

## Test plan
- [ ] npm install 手順通りで lockfile 整合
- [ ] next build 成功確認${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # ==========================================
  # §4. a-bloom-002 グループ 1 件（大規模 31+ commits）
  # ==========================================

  # #20 ★ 大規模、5/5 デモ UI 完成
  i=$((i+1))
  create_pr "feature/garden-common-ui-and-shoji-status" \
    "feat(bloom): garden-common-ui + ShojiStatus + 6 atmospheres カルーセル + 12 アイコン（Phase 2 累計 39 commits）" \
    "## Summary
- ★ **5/5 後道さんデモ UI 完成版**（Pattern B カルーセル統合）
- garden-common-ui 基盤 + ShojiStatus + BackgroundCarousel（6 atmospheres）+ ModuleSlot（12 透明アイコン）+ hover 演出
- Phase 1 (17) + Phase 2-0 (4) + Phase 2-1 (4) + Phase 2-2 候補 7+第 1 波+候補 6 (14) = 累計 39 commits

## 主要実装
- BackgroundCarousel（6 atmospheres、auto 8 秒 / manual キーボード `1`-`6`/`A`/`←→`、6 layers fade transition）
- ModuleSlot 12 透明アイコン（40×40px、Garden glass crystal style、disabled grayscale 0.6）
- hover 演出 12 種固有（葉揺れ・月瞬き・川波紋 等、prefers-reduced-motion 対応）
- URL クエリパラメータ `?atmosphere=N` (0-5)
- a11y: aria-label / INPUT/TEXTAREA/SELECT 除外 / aria-live

## tests
- 累計 ~150 ケース（Phase 1+2 合算、BackgroundCarousel 16 + atmospheres 9 + GardenView 4 + ModuleSlot 30 + 第 1 波 14 + Phase 1 80+）

## レビュー観点（a-review、★ 重要）
- [ ] 6 atmospheres カルーセル動作（auto/manual + キーボード + URL クエリ）
- [ ] 12 透明アイコンと既存 hover 演出の互換維持
- [ ] a11y（reduced-motion / aria-label / 入力フィールド除外）
- [ ] BackgroundCarousel の 6 layers + opacity transition のパフォーマンス
- [ ] ShojiStatus 機能の API + RLS + UI 整合

## Test plan
- [ ] vitest run で 全 PASS（npm install 後）
- [ ] localhost:3000 で 6 atmospheres カルーセル動作確認
- [ ] hover 演出が 12 アイコンで完全動作
- [ ] Vercel preview build pass${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # ==========================================
  # §5. a-bud グループ 1 件（Phase B 以外）
  # ==========================================

  # #21
  i=$((i+1))
  create_pr "feature/bud-review-20260424-auto" \
    "refactor(bud): a-review 4/24 fb 反映" \
    "## Summary
- 4/24 a-review からのフィードバック反映
- Bud 振込・明細 spec の細部修正

## Test plan
- [x] spec only${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # ==========================================
  # §6. a-forest グループ 1 件
  # ==========================================

  # #22
  i=$((i+1))
  create_pr "docs/forest-phase-b-app85-archive-note" \
    "docs(forest): Phase B App85 アーカイブ注記" \
    "## Summary
- Forest Phase B App85 アーカイブ判断の注記追加
- Kintone 旧アプリの保管方針記録

## Test plan
- [x] docs only${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # ==========================================
  # §7. a-leaf グループ 4 件
  # ==========================================

  # #23
  i=$((i+1))
  create_pr "feature/leaf-a1c-task-0-2-npm-install" \
    "chore(leaf): A-1c Task 0-2 npm install 完了" \
    "## Summary
- Leaf A-1c Task 0-2 完了：npm install + 依存追加
- 関電業務委託 spec 関連の前段階作業

## Test plan
- [ ] npm install 成功確認${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # #24
  i=$((i+1))
  create_pr "feature/leaf-a1c-task-d1-migration" \
    "feat(leaf): A-1c Task D-1 migration（8 commits + runbook）" \
    "## Summary
- Leaf A-1c v3 Task D.1 migration SQL + 実行手順書 runbook
- 関電業務委託 spec の DB 基盤
- supabase/migrations/20260425000005_leaf_a1c_attachments.sql 含む

## Test plan
- [ ] migration up + down 試行（dev 環境）
- [ ] runbook 通りで適用可能${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # #25
  i=$((i+1))
  create_pr "feature/leaf-future-extensions-spec" \
    "docs(leaf): 将来拡張 spec" \
    "## Summary
- Leaf 将来拡張（光回線・クレカ等の Phase C 以降）spec 起草

## Test plan
- [x] docs only${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # #26
  i=$((i+1))
  create_pr "feature/leaf-handoff-20260426-evening" \
    "docs(leaf): 4/26 夕方 ハンドオフ書出（86%、a-leaf-002 引継ぎ用）" \
    "## Summary
- a-leaf 4/26 夕方コンテキスト 86% でのハンドオフ
- a-leaf-002 への引継ぎ材料

## Test plan
- [x] docs only${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # ==========================================
  # §8. a-root グループ 4 件
  # ==========================================

  # #27
  i=$((i+1))
  create_pr "feature/root-permissions-and-help-specs" \
    "docs(root): 権限管理 UI + Garden ヘルプモジュール spec" \
    "## Summary
- Root 権限管理 UI spec
- Garden ヘルプモジュール（KING OF TIME 風オンラインヘルプ）spec 新規

## Test plan
- [x] docs only${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # #28
  i=$((i+1))
  create_pr "feature/root-phase-b-decisions-applied" \
    "feat(root): Phase B 確定 60 件反映（8 commits）" \
    "## Summary
- Root Phase B 全 60 件の判断確定 反映
- 8 commits、root_settings + root_audit_log + 8-role × 機能マトリクス 等

## Test plan
- [ ] migration 適用後、RLS が期待通り
- [ ] root_audit_log の writeAudit() 動作確認${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # #29
  i=$((i+1))
  create_pr "feature/root-phase-b-specs-20260425" \
    "docs(root): Phase B 全 7 spec 起草（B-1〜B-7、3,858 行 / 実装見積 14.75d）" \
    "## Summary
- Root Phase B 全 7 spec 起草（権限管理 + 監査ログ + 8-role × 機能マトリクス 等）
- 3,858 行、実装見積 14.75d

## Test plan
- [x] docs only${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # #30 (a-root-002 worktree から)
  i=$((i+1))
  create_pr "feature/root-pending-decisions-applied-20260426" \
    "feat(root): Cat 1+2 反映 + Garden 開発者ページ新規 spec" \
    "## Summary
- Root Cat 1 (8 件) + Cat 2 (7 件) 判断確定 反映
- Garden 開発者ページ spec 新規（問い合わせ・ヘルプ修正依頼の集約 UI）
- base = feature/root-permissions-and-help-specs（依存）

## Test plan
- [x] spec only
- [ ] base ブランチ（root-permissions-and-help-specs）merge 後に diff 整合${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # ==========================================
  # §9. a-soil グループ 1 件
  # ==========================================

  # #31
  i=$((i+1))
  create_pr "feature/soil-phase-b-decisions-applied" \
    "feat(soil): Phase B 判断保留 5 件確定反映" \
    "## Summary
- Soil Phase B 判断保留 5 件の確定反映
- 実装段階に向けた spec 修正

## Test plan
- [x] spec only${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # ==========================================
  # §10. a-tree グループ 4 件
  # ==========================================

  # #32
  i=$((i+1))
  create_pr "feature/tree-phase-d-01-implementation-20260427" \
    "feat(tree): Phase D-01 schema migration 実装（677+135 行 SQL）" \
    "## Summary
- Tree Phase D-01: schema migration 実装（up 677 行 + down 135 行）
- tree_calling_sessions / tree_call_records / tree_agent_assignments の 3 テーブル
- RLS 4 階層 + Trigger 6 種 + 監査ログ + result_code 12 種 CHECK

## レビュー観点
- [ ] result_code 12 種（spec 11 + 「担不」追加）の妥当性
- [ ] RLS ポリシー 4 階層の網羅性
- [ ] Trigger（集計更新 + 不変列保護 + 監査ログ）の動作
- [ ] 冪等性（54 箇所の IF NOT EXISTS / OR REPLACE）

## Test plan
- [ ] migration up + down 往復試行（dev 環境）
- [ ] RLS で営業 INSERT/UPDATE 可、admin 物理 DELETE 可の確認
- [ ] 監査ログ Trigger 6 種の動作${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # #33
  i=$((i+1))
  create_pr "feature/tree-phase-d-decisions-applied" \
    "feat(tree): Phase D 判断保留 42 件 + softphone + toast spec" \
    "## Summary
- Tree Phase D 判断保留 42 件の確定反映
- softphone 連携 spec + Toast 通知 spec 追加

## Test plan
- [x] spec only${FOOTER}" "$i" "$TOTAL"
  sleep 300

  # #34
  i=$((i+1))
  create_pr "feature/tree-track-b-supervisor-tools-20260427" \
    "docs(tree): Track B 責任者ツール spec 起草（v1.1）" \
    "## Summary
- Tree Track B 責任者ツール spec 起草（拡張機能 10 件）
- 判断保留 #3 確定反映含む

## Test plan
- [x] docs only${FOOTER}" "$i" "$TOTAL"
  # 最後の sleep 不要

  # #35（追加: a-tree D-02 新ブランチ）
  sleep 300
  i=$((i+1))
  TOTAL=35
  create_pr "feature/tree-phase-d-02-implementation-20260427" \
    "feat(tree): Phase D-02 Step 1+2+3 実装（オペレーター UI 着手、31 tests）" \
    "## Summary
- Tree Phase D-02 オペレーター UI 実装の Step 1+2+3 完走（10 ステップ中 3）
- 3 commits（bc3bcfa Step 1+2 + 60fbc7d Step 3 + be6ef68 handoff）+ vitest 31/31 PASS
- 既存 /tree/call (InCallScreen) 完全保護、新 path /tree/select-campaign 新設

## 主要実装
- Step 1+2: キャンペーン選択画面 + Server Action openSession/closeSession
- Step 3: Sprout 画面の Supabase 連携（insertTreeCallRecord、CHECK 制約準拠 + メモ必須 + 500 文字 truncate + resultCodeMapping 12 種）

## 残 Step 4-10（次セッション、想定 0.7d）
Branch 画面 + FM 互換ショートカット F1-F10 + 巻き戻し UI + オフライン耐性 + 画面遷移ガード + Breeze/Aporan/Confirm-wait 連携 + 結合テスト

## レビュー観点
- [ ] 既存 /tree/call、insertCall、callButtons.ts、TreeStateContext 不変の確認
- [ ] insertTreeCallRecord の result_code CHECK 制約準拠
- [ ] vitest 31/31 PASS

## Test plan
- [ ] vitest run で 31/31 PASS
- [ ] /tree/select-campaign + Sprout 画面の動作確認${FOOTER}" "$i" "$TOTAL"

  echo ""
  echo "=== Phase 3: 通常 feature PR 35 件 発行 完了: $(date) ==="
  echo "B 垢: $(gh api user --jq '.login + " / " + (.suspended_at // "active" | tostring)')"
  echo "rate: $(gh api rate_limit --jq '.rate.remaining')"
  echo ""
  echo "=== 全発行 PR 一覧 ==="
  gh pr list --state open --limit 50 --json number,title --jq '.[] | "#\(.number) \(.title)"'
} 2>&1
