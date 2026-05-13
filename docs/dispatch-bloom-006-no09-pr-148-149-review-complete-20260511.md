# 🟢 bloom-006- No. 9
【a-bloom-006 から a-main-021 への dispatch（PR #148 + #149 レビュー完走報告）】
発信日時: 2026-05-11(月)

# 件名

main- No. 189 依頼分（先行依頼）PR #148 + #149 レビュー完走（4 観点 × 2 PR = 8 観点完走、両 PR 採用推奨 + PR #148 重要観察 1 件）

# PR #148 (Bud Phase D 100% 完成) レビュー結果

| 観点 | 結果 |
|---|---|
| 1. FK 整合 (bud → root / auth) | ✅ |
| 2. 認証ロール 8 段階 + payroll roles 5 種 | ✅ |
| 3. payslip 配信 (D-04) ↔ Bloom 日報 / KPI 衝突 | ✅ 現状なし |
| 4. 旧版データ保持 | ✅ 完全遵守 |

総評: **採用推奨** ✅、merge 阻害なし、⚠️ 重要観察 1 件（scope 確認推奨）。

主要観察:
- bud_payroll_periods / attendance_snapshots / notifications / employee_bank_accounts 全 FK 整合
- Garden 8 段階 + Bud 5 payroll roles (calculator/approver/disburser/auditor/visual_checker、4 次 follow-up Cat 4 #26) 完全実装
- RLS v3 で重大指摘 3 件修正済 (B1 自起票二重チェック / B2 状態遷移 canTransition / B4 振込完了 admin+ 緩和)
- D-04 payslip 配信 Y 案 + フォールバック (メール DL ワンタイム + LINE Bot + マイページ PW) は Bloom 未参照、衝突なし
- legacy パターン (`*.legacy-YYYYMMDD.tsx`) 大量維持確認 (BloomNavGrid 4 versions / BloomTopbar 3 versions / BloomSidebar 3 versions 等)
- `feedback_no_delete_keep_legacy` ルール完全遵守

⚠️ 重要観察 (PR scope 確認推奨):
- PR title: "Phase D 100% 完成 — 給与処理 12 件統合 (D-01〜D-12 全揃い、544 tests green)"
- 実 diff: 931 files / +177,162 / -245 / 30 commits
- 実 bud Phase D 実装 = ~30 files (12 migrations + zengin lib + bud-specific)
- 残り ~900 files = Bloom legacy 系 + avatar PNGs + bloom-003 dispatches + handoff docs 等
- 推測原因: base (develop) が main から大幅に遅れ → main 由来の commits spillover
- 推奨: merge 前に base sync 検討 (rebase / merge 戦略)、または diff scope 認識合わせ
- 緊急度: 🟡 軽微 (scope 認識の確認、merge 自体は阻害なし)

レビューコメント: https://github.com/Hyuaran/garden/pull/148 (shoji-hyuaran COMMENTED 2026-05-11T03:40:07Z)

# PR #149 (Bud Phase E spec batch) レビュー結果

| 観点 | 結果 |
|---|---|
| 1. FK 整合 | N/A (docs only) |
| 2. 認証ロール 8 段階 | ✅ spec 内で踏襲明記 |
| 3. Bloom 衝突 | ✅ 現状なし (spec 段階、実装時に再評価)|
| 4. 旧版データ保持 | N/A (新規 spec のみ) |

総評: **採用推奨** ✅、merge 阻害なし。

主要観察:
- E-01 月次運用 Cron + リマインダ拡張 (0.75d, 🟢 高)
- E-02 退職者・中途入社特例 (1.0d, 🟢 高)
- E-03 産休育休フロー (0.75d, 🟡 中)
- E-04 役員報酬区分 (0.5d, 🟡 中)
- E-05 KoT 完全同期 + Excel 取込 (1.0d, 🟢 高)
- 合計実装見積 4.0d (5 件 spec のみ、本 PR は起草)
- Phase D との依存関係明示 (E-01 ← D-12 / E-02 ← D-02+D-05+D-06 等)
- 共通制約 5 件遵守: 設計判断なし / npm install なし / 動作変更なし / 本番影響なし / 既存 helpers 再利用
- Phase E v2 候補 (E-06〜E-09) も spec 化済

Bloom 観点での補足:
- E-01 cron 運用化 → Vercel cron 統合の衝突 / 並行実行確認推奨 (実装時)
- E-05 KoT 同期 → 同期タイミングが Bloom Daily Report / 統合 KPI に与える影響確認推奨 (実装時)

レビューコメント: https://github.com/Hyuaran/garden/pull/149 (shoji-hyuaran COMMENTED 2026-05-11T03:40:24Z)

# 観点 1-4 で指摘した内容（要約）

**観点 1 (FK 整合)**: PR #148 全 FK 整合 ✅ / PR #149 N/A

**観点 2 (認証ロール 8 段階)**: 両 PR Garden 8 段階完全整合 + Bud 5 payroll roles 追加 ✅

**観点 3 (payslip 配信 ↔ Bloom)**: PR #148 D-04 Y 案 + フォールバック方式は Bloom 未参照、衝突なし ✅ / PR #149 spec 段階、E-01 cron + E-05 KoT 同期は実装時に再評価推奨

**観点 4 (旧版データ保持)**: PR #148 legacy パターン大量維持 ✅ / PR #149 N/A

# 並行確認

| 項目 | 状態 |
|---|---|
| PR #150 mergeStateStatus | CLEAN ✅ |
| PR #150 Vercel Preview | SUCCESS ✅ |
| PR #147 / #148 / #149 / #152 / #154 / #155 レビュー | すべて COMMENTED post 済 ✅ |
| 累計 review 件数 (a-bloom-006) | 6 PR |

# 次に想定される作業

1. PR #148 重要観察 (scope 確認推奨) → a-bud-002 + 東海林さん協議待ち
2. PR #150 / #147 / #148 / #149 / #152 / #154 / #155 merge 待ち (東海林さん最終判断)
3. PR #154 / #155 / #128 連動 merge 後の a-tree-002 連携確認 (main 経由 dispatch 受領待ち)
4. unrelated 14 test 別 issue 起票 (任意、優先度低)
5. a-root-002 連携 #1 + #3 着手 (5/9 朝以降の予定、handoff §🔴2 参照)

# self-check

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時 (~~~ 内配置、v5.1/v5.2 完全準拠)
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 4 観点 × 2 PR = 8 観点完走
- [x] 両 PR 採否推奨明示 (両者 採用推奨)
- [x] PR #148 重要観察 (scope 確認) 明示
- [x] レビューコメント URL + timestamp 明記
- [x] Bloom 観点補足 (E-01 / E-05 実装時の再評価推奨)
- [x] 番号 = bloom-006- No. 9 (main- No. 245 §「報告フォーマット No. 8 以降」継続、No. 8 は受領 inline 完結)
