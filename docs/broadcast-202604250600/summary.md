# Batch 14 Garden 横断 履歴・削除管理 全体サマリ

- 発動: 2026-04-25 05:10 頃 / a-auto 002 セッション 6 連続発動の最終
- 完了: 2026-04-25 約 06:00
- ブランチ: `feature/cross-history-delete-specs-batch14-auto`
- 対象: Garden 全 9 アプリ横断の **Kintone 風履歴 UI + 統一削除パターン**

---

## 🎯 成果物

| 優先度 | # | ファイル | 行 | 見積 |
|---|---|---|---|---|
| 🔴 最高 | #01 | [data-model](../specs/2026-04-25-cross-history-delete-01-data-model.md) | 416 | 0.4d |
| 🔴 最高 | #02 | [rls-policy](../specs/2026-04-25-cross-history-delete-02-rls-policy.md) | 430 | 0.3d |
| 🔴 最高 | #03 | [sidebar-component](../specs/2026-04-25-cross-history-delete-03-sidebar-component.md) | 480 | 0.4d |
| 🔴 最高 | #04 | [delete-pattern](../specs/2026-04-25-cross-history-delete-04-delete-pattern.md) | 444 | 0.4d |
| 🔴 高 | #05 | [module-integration](../specs/2026-04-25-cross-history-delete-05-module-integration.md) | 516 | 0.3d |
| 🔴 最高 | #06 | [test-strategy](../specs/2026-04-25-cross-history-delete-06-test-strategy.md) | 565 | 0.2d |

**合計**: **2,851 行**、実装見積 **2.0d 基盤 + 7.0d 9 モジュール統合 = 約 9.0d**

> Batch 14 起草時見込 2.0d spec / 4.0d 実装 → 実起草 約 50 分、実装 9.0d（モジュール統合の正確な見積反映）

---

## 🔑 各 spec の核心

### #01 データモデル 🔴
- `garden_change_history` 横断テーブル（フィールド単位の差分記録）
- 既存 `audit_logs` との役割分担（イベント vs フィールド）
- 5 種 operation（INSERT/UPDATE/DELETE/SOFT_DELETE/RESTORE）
- BEFORE UPDATE Trigger 共通関数（全列差分自動記録）
- パーティショニング戦略（pg_partman、月次）
- 7 年保存ポリシー、想定 4.4 億行/7 年

### #02 RLS ポリシー 🔴
- **改ざん不可能性**（INSERT のみ、UPDATE/DELETE は admin でも拒否）
- 業務権限と紐付けた閲覧（`can_user_view_record` ヘルパ関数）
- admin/super_admin の全モジュール横断閲覧
- PII マスキング（pgcrypto + 機密列リスト）
- super_admin のみ purge 関数実行可（保存期間経過時）

### #03 ChangeHistorySidebar 🔴
- React コンポーネント（Kintone 風右側収納）
- タイムライン表示 + フィルタ（期間/操作/ユーザー）
- 5 種 operation のアイコン色分け
- diff 表示（テキスト/数値/JSON）
- 削除済・復元の視覚化
- モバイル時はフルスクリーンモーダル

### #04 削除パターン統一 🔴
- 3 段階（論理 / 復元 / 物理）と権限階層
- 共通コンポーネント 4 種（DeleteButton / DeletedBadge / UndoSnackbar / RestoreActions）
- UNDO snackbar 5 秒（自分の削除のみ）
- 削除済バッジ全員可視（誤操作認識）
- 一括削除上限 100 件
- cascade 影響範囲表示

### #05 モジュール統合ガイド 🔴
- 9 モジュール × retrofit 工数（合計 7.0d）
- 4 段階展開（基盤 → 軽量 → 中規模 → 大型）
- 既存データへのバックフィル禁止（コスト > メリット）
- 既実装モジュール（Bud/Root/Leaf）の追加対応計画
- 各モジュール統合 5 ステップ標準手順

### #06 テスト戦略 🔴
- Trigger 単体テスト（5 operation 網羅）
- RLS テスト（7 役割 × 改ざん防止）
- UI RTL（ChangeHistorySidebar / DeleteButton / DeletedBadge）
- 100 万行 seed + k6 性能テスト
- §16 7 種テスト適合性
- 9 モジュール統合の代表 E2E

---

## 🔗 spec 間の依存関係

```
#01 data-model（基盤テーブル）
  ↓
#02 RLS（セキュリティ）
  ↓
#03 sidebar + #04 delete-pattern（UI 層）
  ↓
#05 module-integration（9 モジュール展開）
  ↓
#06 test-strategy（品質保証）

外部依存:
- spec-cross-audit-log（Batch 7、既存）
- spec-cross-rls-audit（Batch 7、ヘルパ関数）
- spec-cross-ui-01〜06（Batch 10、UI 基盤）
```

---

## 📊 判断保留（計 39 件）

| # | spec | 件数 | 主要論点 |
|---|---|---|---|
| 1 | #01 | 8 | 共通テーブル vs 別々 / パーティション時期 |
| 2 | #02 | 6 | ヘルパ関数 vs 直書き / 改ざんハッシュ |
| 3 | #03 | 8 | 開閉ボタン位置 / ページング方式 |
| 4 | #04 | 7 | 削除権限既定 / UNDO duration |
| 5 | #05 | 6 | 段階数 / 検証期間長さ |
| 6 | #06 | 6 | 性能環境 / k6 同時接続数 |

**最優先合意事項 6 件**（東海林さん判断）:

1. 共通テーブル `garden_change_history` 採用（推奨案承認）
2. 改ざん検知ハッシュ Phase 2 送り（推奨）
3. 削除権限の既定値（業務スコープ全員可、admin で物理削除）
4. UNDO snackbar duration 5 秒（推奨）
5. 段階的展開 4 Phase（基盤 → 軽量 → 中規模 → 大型）
6. 9 モジュール並列実装の許可（独立性確保）

---

## 🚀 推奨実装順序

```
Phase 1（M3 前 = 2026-06）: 基盤実装 2.0d
├─ #01 garden_change_history テーブル + Trigger（0.4d）
├─ #02 RLS ポリシー（0.3d）
├─ #03 ChangeHistorySidebar（0.4d）
├─ #04 削除パターン共通コンポーネント（0.4d）
├─ #05 モジュール統合ガイド（spec、起草済）
└─ #06 テスト戦略（0.2d、テスト基盤）

Phase 2（M3 = 2026-07）: 軽量モジュール 1.6d
├─ Rill（0.3d）
├─ Seed（0.3d）
├─ Soil（0.5d）
└─ Bloom（0.5d）

Phase 3（M3-M4 = 2026-07-08）: 中規模 2.7d
├─ Tree（0.7d）
├─ Forest（1.0d）
└─ Leaf 関電（1.0d）

Phase 4（M4 = 2026-08）: 大型 3.0d
├─ Bud（1.5d）
└─ Root（1.5d）

合計: 9.3d / 約 2 ヶ月
```

---

## 🚨 重要リスクと対策

### R1: 履歴量 4.4 億行（7 年累計）
- **対策**: pg_partman 月次パーティション、Phase 1 から導入
- **判定**: dev 環境で 100 万行 seed + 性能テスト

### R2: 改ざん不可能性の保証
- **対策**: RLS で UPDATE/DELETE 完全禁止、Trigger 経由 INSERT のみ
- **判定**: admin/super_admin でも改ざん不可を実機検証

### R3: PII 漏洩
- **対策**: pgcrypto 暗号化 + admin+ 復号 + 監査記録
- **判定**: テスト用ダミー値で復号テスト

### R4: 既存モジュールへの統合影響
- **対策**: 4 段階展開 + 各 Phase 2 週間検証期間
- **判定**: 各モジュール E2E 回帰テスト

### R5: パフォーマンス劣化
- **対策**: 各 Phase 後に EXPLAIN ANALYZE + k6 性能比較
- **判定**: p95 10% 以上劣化でリリースブロック

---

## 📥 次アクション（a-auto 停止後）

1. **a-main**: 本サマリ確認 → 判断保留 6 件を東海林さんに提示
2. **東海林さん**: 共通テーブル採用 + 4 Phase 展開計画の承認
3. **a-leaf / a-bud / a-root 等**: 既実装モジュールの retrofit 計画作成
4. **a-auto 003**（次セッション）: Batch 15 候補（Soil 基盤 / Rill / Root Phase B 等）

---

## 🗂 累計（Batch 1-14）

| Batch | 対象 | spec 数 | 行 | 工数 |
|---|---|---|---|---|
| 1-8 | Phase A-C + 横断 + Leaf C | 46 | ~18k | 23.95d |
| 9 | Tree Phase D | 6 | 2,544 | 5.1d |
| 10 | Garden 横断 UI | 6 | 2,760 | 3.1d |
| 11 | Bud Phase C | 6 | 2,935 | 4.1d |
| 12 | Leaf 他商材スケルトン | 5 | 1,741 | 1.0d |
| 13 | Leaf 関電 UI 再設計 | 8 | 3,628 | 10.0d |
| **14** | **Cross History/Delete** | **6** | **2,851** | **9.0d** |
| **合計** | — | **83** | **~35k** | **約 56.25d** |

**Garden コア + UX 改善 + 横断履歴 コンプリート、完成度 約 95%**。残るは Soil / Rill / Seed / Root Phase B / 運用設計。

---

— Batch 14 Cross History/Delete summary end —
