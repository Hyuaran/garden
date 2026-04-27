#!/bin/bash
# Phase 2: 重大指摘 5 PR 一括発行スクリプト
# 実行: Phase 1 (docs 5 PR) 完了後
# 5 分間隔遵守、burst 回避

{
  echo "=== Phase 2: 重大指摘 5 PR 発行 開始: $(date) ==="
  echo "予定完了: 約 25 分後"
  echo ""

  # PR #1: cross-history #47 SQL injection
  echo "[1/5] cross-history #47 PR 発行 $(date '+%H:%M:%S')"
  gh pr create --repo Hyuaran/garden --base develop \
    --head feature/cross-history-delete-specs-batch14-auto \
    --title "fix(cross-history): SQL injection 脆弱性修正（a-review #47）" \
    --body "$(cat <<'BODY'
## Summary
- a-review 重大指摘 #47 の対応：cross-history Trigger に SQL injection 脆弱性
- Trigger 内部の動的 SQL 構築でユーザー入力をエスケープなしで連結 → 即修正
- a-review 5 重大指摘の最後の 1 件（残 0）

## a-review 重大指摘 #47
SQL injection 脆弱性 — cross-history Trigger 内部の動的 SQL 構築
（パラメータ化されていない、ユーザー入力が直接 SQL に含まれるリスク）

## 修正前後（要点）
- **修正前**: Trigger 内 EXECUTE 文でテーブル名・カラム名を string concat
- **修正後**: format() + %I 識別子 quoting + パラメータ化（USING 句）

## 影響範囲
- 影響モジュール: cross-history（横断履歴 Trigger）
- 影響テーブル: 全モジュールの履歴 Trigger（cross-history 経由）
- 既存データ migration: 不要
- 後方互換性: あり（外部 API 不変）

## レビュー観点（a-review #47 完了確認用）
- [ ] format() / %I quoting が全 EXECUTE 文に適用されているか
- [ ] パラメータ化 (USING 句) でユーザー入力が SQL に直接含まれないか
- [ ] 既存テスト（あれば）が pass、追加テストで injection 試行が rejected か
- [ ] a-review 重大指摘 5 件すべて closed（残 0）の最終確認

## Test plan
- [ ] cross-history Trigger SQL injection テスト（malicious input → 拒否確認）
- [ ] 既存 cross-history 機能の回帰テスト
- [ ] Vercel preview build pass 確認後 merge

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
    )" 2>&1

  echo "--- sleep 300 ---" && sleep 300

  # PR #2: leaf-a1c #65 SECURITY DEFINER
  echo "[2/5] leaf-a1c #65 PR 発行 $(date '+%H:%M:%S')"
  gh pr create --repo Hyuaran/garden --base develop \
    --head feature/leaf-a1c-task-d1-pr \
    --title "fix(leaf): SECURITY DEFINER 修正（a-review #65）" \
    --body "$(cat <<'BODY'
## Summary
- a-review 重大指摘 #65 の対応：Leaf A-1c の SECURITY DEFINER 関数のセキュリティ脆弱性
- 関電業務委託 spec 関連の RLS 設計見直し含む
- ハンドオフ docs 同梱（a-review #65 修正完了 ハンドオフ）

## a-review 重大指摘 #65
Leaf A-1c の SECURITY DEFINER 関数で **search_path 未指定** → 実行時の権限昇格リスク

## 修正前後（要点）
- **修正前**: SECURITY DEFINER 関数 で search_path がデフォルト
- **修正後**: SET search_path = pg_catalog, public 等を明示、関数定義時に固定

## 影響範囲
- 影響モジュール: Leaf（関電業務委託 spec 関連）
- 影響関数: leaf_a1c 関連の SECURITY DEFINER 関数すべて
- 既存データ migration: 不要
- 後方互換性: あり

## レビュー観点（a-review #65 完了確認用）
- [ ] 全 SECURITY DEFINER 関数に SET search_path 明示
- [ ] 関電業務委託 spec の RLS 設計と整合
- [ ] 関電以外の Leaf 商材への影響がないか確認
- [ ] テストで SECURITY DEFINER 関数の動作が正常か

## Test plan
- [ ] SECURITY DEFINER 関数の動作回帰テスト
- [ ] search_path 明示確認（pg_proc クエリ）
- [ ] Vercel preview build pass 確認後 merge

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
    )" 2>&1

  echo "--- sleep 300 ---" && sleep 300

  # PR #3: forest-t-f5 #64 ENUM typo
  echo "[3/5] forest-t-f5 #64 PR 発行 $(date '+%H:%M:%S')"
  gh pr create --repo Hyuaran/garden --base develop \
    --head feature/forest-t-f5-tax-files-viewer \
    --title "fix(forest): ENUM typo 修正（a-review #64: zanntei → zantei）+ #21 反映" \
    --body "$(cat <<'BODY'
## Summary
- a-review 重大指摘 #64: ENUM typo 修正（zanntei → zantei、データ整合性影響）
- 併せて #21（Forest Phase B 関連）反映
- T-F5 tax files viewer 関連の修正含む

## a-review 重大指摘 #64
**ENUM typo**: `zanntei` → 正しくは `zantei`（残定）。データ書き込み時 ENUM 拒否 → エラーで業務停止リスク。

## 修正前後（要点）
- **修正前**: ENUM 値に `zanntei`（typo）含む、API/UI が typo 値を期待
- **修正後**: `zantei` に統一、migration で既存データ ALTER（typo → 正値）

## 影響範囲
- 影響モジュール: Forest（決算資料、tax files viewer）
- 影響テーブル: forest_* 関連 ENUM 列を持つテーブル
- 既存データ migration: **必要**（typo → 正値、migration SQL 同梱）
- 後方互換性: 破壊的変更（typo 値は無効化）

## レビュー観点（a-review #64 完了確認用）
- [ ] ENUM typo 修正が migration SQL に反映済（既存データ ALTER 含む）
- [ ] API / UI 側で `zantei` 参照に統一
- [ ] migration apply 後の既存データ整合性確認
- [ ] #21 反映内容の確認

## Test plan
- [ ] migration SQL の up + down 試行（dev 環境）
- [ ] API/UI から ENUM 書き込み・読み取りが正常
- [ ] tax files viewer の表示確認
- [ ] Vercel preview build pass 確認後 merge

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
    )" 2>&1

  echo "--- sleep 300 ---" && sleep 300

  # PR #4: bud-phase-0-auth #55 RLS
  echo "[4/5] bud-phase-0-auth #55 PR 発行 $(date '+%H:%M:%S')"
  gh pr create --repo Hyuaran/garden --base develop \
    --head feature/bud-phase-0-auth \
    --title "fix(bud): RLS 修正（a-review #55）+ Phase 1a 認証基盤" \
    --body "$(cat <<'BODY'
## Summary
- a-review 重大指摘 #55 の対応：Bud Phase 0 認証の RLS 設計修正
- Bud Phase 1a 認証基盤実装含む（Forest 認証パターン流用、admin 例外パスワード対応）
- Bud 経理機能の権限分離（振込・明細・給与）

## a-review 重大指摘 #55
Bud RLS 設計の不備 — 振込権限と閲覧権限の分離が不十分、admin 例外パスワード処理に脆弱性

## 修正前後（要点）
- **修正前**: RLS ポリシー粒度が粗い、admin 例外がバイパス可能
- **修正後**: 振込/閲覧/編集の権限分離、admin 例外は Server Action で再検証

## 影響範囲
- 影響モジュール: Bud（経理・収支）
- 影響テーブル: bud_transfers / bud_statements / bud_employees 関連
- 既存データ migration: 不要（ポリシー追加のみ）
- 後方互換性: あり（既存ロールに対する制限のみ追加）

## レビュー観点（a-review #55 完了確認用）
- [ ] RLS ポリシー網羅（振込/閲覧/編集の権限分離）
- [ ] admin 例外パスワード処理の検証強化
- [ ] 8-role（toss/closer/cs/staff/manager/admin/super_admin/outsource）対応
- [ ] Forest 認証パターンとの整合性

## Test plan
- [ ] RLS ポリシーで各ロールが期待通り制限されること
- [ ] admin 例外パスワード処理の安全性
- [ ] 振込権限分離の動作確認
- [ ] Vercel preview build pass 確認後 merge

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
    )" 2>&1

  echo "--- sleep 300 ---" && sleep 300

  # PR #5: bud-phase-d-specs-batch17 #74 給与 PDF + Y 案 + Kintone
  echo "[5/5] bud-phase-d-specs-batch17 #74 PR 発行 $(date '+%H:%M:%S')"
  gh pr create --repo Hyuaran/garden --base develop \
    --head feature/bud-phase-d-specs-batch17-auto-fixes \
    --title "fix(bud): 給与 PDF + Y 案 + Kintone 反映（a-review #74 + Cat 4 #26/#27/#28）" \
    --body "$(cat <<'BODY'
## Summary
- a-review 重大指摘 #74: 給与 PDF レイアウト修正
- Y 案（メール DL リンク + LINE Bot 通知 + マイページ PW 確認）整合反映
- Kintone CSV カラム整合（Cat 4 #26/#27/#28 確定反映）
- Bud Phase D 関連 4 次 follow-up

## a-review 重大指摘 #74
給与 PDF レイアウト不備 — 印字位置・項目順・MFC 互換性問題

## 修正前後（要点）
- **修正前**: 給与 PDF レイアウトが MFC（マネーフォワードクラウド）給与 CSV と不整合、印字位置ずれ
- **修正後**: MFC 72 列 9 カテゴリ規格に整合、Y 案配信フローと連動

## 影響範囲
- 影響モジュール: Bud（経理・給与）
- 影響 spec: bud-phase-d-04-statement-distribution / bud-phase-d-05-payroll-mfc-csv 等
- 既存データ migration: 不要（spec 改訂中心）
- 後方互換性: あり

## Y 案（給与明細配信フロー）
- メール DL リンク（pgcrypto 暗号化トークン）
- LINE Bot 通知（オプション）
- マイページ PW 確認（自社員ログイン）
- 詳細: memory `project_payslip_distribution_design.md` 参照

## レビュー観点（a-review #74 完了確認用）
- [ ] 給与 PDF レイアウトが MFC CSV 規格と整合
- [ ] Y 案配信フローが spec に反映済
- [ ] Kintone Cat 4 #26/#27/#28 反映が正しい
- [ ] Bud Phase D 全体（D-01〜D-12）整合性

## Test plan
- [ ] 給与 PDF 生成テスト（複数雇用形態 / 月次・賞与）
- [ ] MFC CSV インポート互換性
- [ ] Y 案配信フローの動作（暫定 mock OK）
- [ ] Vercel preview build pass 確認後 merge

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
    )" 2>&1

  echo ""
  echo "=== Phase 2: 重大指摘 5 PR 発行 完了: $(date) ==="
  echo "B 垢: $(gh api user --jq '.login + " / " + (.suspended_at // "active" | tostring)')"
  echo "rate: $(gh api rate_limit --jq '.rate.remaining')"
  echo ""
  echo "=== 発行済 PR 一覧 ==="
  gh pr list --state open --limit 15 --json number,title --jq '.[] | "#\(.number) \(.title)"'
} 2>&1
