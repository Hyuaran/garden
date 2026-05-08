# Tree Phase D plan v3 起草 — handoff

- 日時: 2026-04-25 ~21:00 終了想定
- セッション: a-tree（イレギュラー自律実行モード）
- ブランチ: `feature/tree-phase-d-plan-v3`
- 採択方式: 6 並列 subagent digest → 統合プラン起草

## 完了成果物

### 主要ファイル
- `docs/superpowers/plans/2026-04-25-tree-phase-d-implementation.md`（**1,832 行・70 タスク**）

### 構造
- §0 Pre-flight (3 task)
- §1 D-01 Schema migrations (12 task, 0.7d)
- §2 D-06 Test scaffolding (3 task, 0.25d)
- §3 D-02 Operator UI (13 task, 1.125d)
- §4 D-04 Tossup flow (7 task, 0.875d)
- §5 D-03 Manager UI (8 task, 1.0d)
- §6 D-05 KPI dashboard (9 task, 0.94d)
- §7 D-06 E2E + 受入 (8 task, 1.0d)
- §8 §16 7 種テスト全完走 (1 task, 0.5d)
- §9 α (3 task)
- §10 β + Full release + FM 切替 (5 task)
- 合計: **70 task / 6.5d 実装純工数 + 5 週間検証期間**

### 統合した内容
- D-01〜D-06 6 spec すべての要件を統合
- Tree 特例 §17 5 段階展開（α → β1 → β2-3 → β half → 全員）
- §16 7 種テスト（機能網羅・エッジケース・権限・データ境界・パフォーマンス・コンソールエラー・アクセシビリティ）
- known-pitfalls.md 8 項目中 5 項目（#1, #2, #3, #6, #8）反映
- 判断保留 38 件を §6 で集約（D-01:3 / D-02:7 / D-03:7 / D-04:7 / D-05:8 / D-06:7）
- 既存 Tree Phase A/B 連携ポイント明記（§8）
- リスクレジスタ 12 項目（§7）
- Spec coverage 完全（self-review §9 にてゼロギャップ確認）

## 採用した重要設計判断

### 全体アーキテクチャ
- **DB foundation 先行（D-01）→ Test scaffolding（D-06 早期分）→ Operator UI（D-02）→ Tossup（D-04）→ Manager UI（D-03）→ KPI（D-05）→ E2E + 受入（D-06 最終）→ §16 7 種**
- D-04 を D-03 より前に置いた理由: D-03 のマネージャー UI で「トスアップ済み件数」をリアルタイム表示するため D-04 のフロー確定が先

### 手法
- subagent-driven-development 前提でタスクを 10-30 分単位に細分化
- TDD 厳守: テスト先行 → 失敗確認 → 実装 → PASS → commit
- 1 task = 1 commit を目安、巨大タスクのみ複数 commit 許容

### Tree 特例の組込
- 各段階で「通過条件 ✅必須」を明示
- L1-L3 rollback drill 手順書を §7 Task 61 で作成必須化
- FM 並行運用 30 日 + Archive を §10 Task 67/69 で設計

### 干渉回避
- `src/app/leaf/` 不触（D-04 は API contract のみ）
- `src/lib/supabase/admin.ts` import のみ
- `supabase/migrations/2026042*` 既存不変
- main / develop 直 push 禁止

## 自律実行中の判断

### 完了
- 6 spec 並列 subagent digest 取得（合計 token 消費約 35K、実時間 約 90s）
- 統合プラン起草・self-review・effort-tracking 追記
- handoff 文書化

### 保留（着手前に東海林さん確認推奨）
- 判断保留 38 件の一括承認・否認・修正回答
- 特に重要: D-04-判4（同意確認の全商材必須化）、D-06-判6（L3 承認者）、D-02-判2（オフラインキュー上限）
- これらは α テスト着手前に確定が望ましい

## 次のアクション（東海林さん復帰時）

1. **PR レビュー**（PR レビューは a-bloom 担当）
2. **判断保留 38 件の一括承認**
3. **PR #31（Phase D 6 spec）の develop merge**（a-main 担当、未 merge の場合）
4. **Batch 7 cross-cutting 関数の Supabase apply 確認**（`auth_employee_number()` / `has_role_at_least()` / `is_same_department()`）
5. plan 修正点があれば v3.1 として追加 commit、なければ実装段階に移行（subagent-driven-development で §0 Task 0 から着手）

## 備考

- @testing-library/user-event は Phase B-β で未インストール → §0 Task 1 で `npm install --save-dev @testing-library/user-event` を計画に組込
- `k6` `@axe-core/playwright` `@lhci/cli` も §0 Task 1 で同時導入
- `sonner` は D-02 §5 採用、Toast 統一に使用
