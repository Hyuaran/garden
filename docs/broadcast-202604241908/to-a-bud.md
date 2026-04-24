# 【a-auto セッションからの周知】Batch 5 完成 — Bud Phase A-1 実装指示書 6 件

- 発信日時: 2026-04-24 19:08 発動 / 約 20:38 配布
- 対象セッション: **a-bud**
- 発動シーン: 集中別作業中（約 90 分、Batch 5 6 件完走）

---

## ■ 完了した作業（6 spec、合計 2,010 行）

**Bud Phase A-1 の仕様書がコンプリート**。合計約 **3.0d 分の実装指示書**で、M1 末（2026-05 末）の Bud α版開始に向けた下敷きを用意。

| # | ファイル | 行数 | 想定 | 性質 |
|---|---|---|---|---|
| A-03 | [furikomi-6steps.md](docs/specs/2026-04-24-bud-a-03-furikomi-6steps.md) | 401 | 0.5d | 状態遷移・RLS・監査 |
| A-04 | [furikomi-create-form.md](docs/specs/2026-04-24-bud-a-04-furikomi-create-form.md) | 287 | 0.5d | 新規作成 UI + Server Action |
| A-05 | [furikomi-approval-flow.md](docs/specs/2026-04-24-bud-a-05-furikomi-approval-flow.md) | 327 | 0.5d | 承認・差戻し・CSV 出力 UI |
| A-06 | [meisai-requirements.md](docs/specs/2026-04-24-bud-a-06-meisai-requirements.md) | 328 | 0.75d | 明細管理 + 自動照合 |
| A-07 | [cash-payment-undecided.md](docs/specs/2026-04-24-bud-a-07-cash-payment-undecided.md) | 253 | 0.25d | 手渡し現金 5 論点整理 |
| A-08 | [cc-meisai-rules.md](docs/specs/2026-04-24-bud-a-08-cc-meisai-rules.md) | 414 | 0.5d | CC 明細 5,000 円区切り判定 |

---

## ■ あなた（a-bud）が実施すること

### 1. 事前ヒアリング（A-07 が最優先）
**A-07 の 5 論点 + 5 未確認事項を東海林さんにヒアリング**（Bud 給与処理モジュールの前提条件）：

**論点（採択判断 5 件）**
1. 手渡し受給者の識別方法（A/B/C）
2. `bud_transfers` への扱い（A/B/C）
3. 給与明細配信（A/B/C）
4. 現金原資管理（A/B/C）
5. 受領確認（A/B/C）

**未確認（情報収集 5 件）**
- 現在の手渡し受給者数・法人分布・引出しルール
- MF クラウド給与計算対象か
- 給与日の同期

### 2. 実装順序の推奨

#### Week 1（振込管理完結、1.5d）
1. **A-03** 振込 6 段階遷移（`bud_transfer_status_history` + `bud_can_transition` + Server Action）— 0.5d
2. **A-04** 新規作成フォーム（regular + cashback）— 0.5d
3. **A-05** 承認フロー UI（詳細画面 + 一括操作 + CSV 出力骨格）— 0.5d

#### Week 2（明細管理、1.25d）
4. **A-06** 明細管理（`bud_statements` 投入 + 自動照合ロジック + UI）— 0.75d
5. **A-08** CC 明細処理（5,000 円区切り + 自動分類 + インボイス管理）— 0.5d

#### Week 3（給与関連、A-07 合意後 Phase B に繰越候補）
6. **A-07** 合意内容を Phase B 給与処理設計書へ移植 — 0.25d（本 spec の外、Phase B のタスク）

### 3. 判断保留 49 件の合意優先度

**🔴 即時合意**（M1 内に必要）
- A-03 判1: status_history の二重化
- A-03 判3: super_admin 自起票 reason 自動挿入
- A-04 判1: 取引先追加 UI 位置（Bud 内モーダル vs Root 画面遷移）
- A-04 判2: 当日振込の扱い
- A-05 判1: 本人承認禁止の厳密化方針
- A-06 判1: CSV 形式の対応範囲（楽天 + みずほ 2 種）
- A-08 判1: 対応カード種類（楽天ビジネス 1 種から）

**🟡 M1 中合意**（実装前に決定）
- A-04 判8: 確認済み保存の可否判定
- A-05 判7: 一括操作の最大件数制限
- A-06 判2: 自動照合の信頼度レベル

**🟢 後回し可**（Phase B 以降で判断）
- 各 spec の費目自動判定 AI / モバイル対応 / 統計的異常検出

### 4. effort-tracking.md への先行記入
6 タスクを予定時間付きで追記（§12 準拠）。

### 5. 本ブランチの扱い
- PR 化は a-auto が完走同時に実施済（PR URL は to-a-main.md 参照）
- マージ後、各 spec を参照しながら実装ブランチを個別に切る

---

## ■ 特筆すべき設計判断

### A-03 super_admin 自起票スキップ
東海林さん（super_admin）は**下書き → 承認済み**へ直接遷移可能。`bud_can_transition()` 関数で特別扱い。reason には自動的に「自起票」が挿入される（判3）。

### A-04 重複検出は「警告」であり「ブロック」でない
Phase 0 の `_lib/duplicate-key.ts` を活用し、同条件の未完了振込があれば DUPLICATE_SUSPECTED を返すが、UI 側で「承知の上で登録」ボタンで強制登録可（誤検出への対処）。

### A-05 承認者の本人承認を Phase A は警告のみ
super_admin 自起票スキップと整合させるため、`status_changed_by !== 起票者` 判定は**警告レベル**で実装。Phase B で厳密化判断。

### A-06 自動照合の 2 段階戦略
- **exact**: 金額 + 日付 + 取引先名の完全一致
- **high**: 金額 + ±3 日の範囲一致
- それ以外は手動割当。目標自動照合率 **70%**。

### A-07 未決事項の推奨スタンスを全論点で提示
5 論点全てで auto の推奨を明示しつつ、最終判断は東海林さんに委譲。ヒアリング用質問 8 項目で合意形成を加速。

### A-08 飲食店判定は**キーワードマスタ方式**
`bud_restaurant_keywords` テーブルに 15 キーワード（居酒屋・寿司・レストラン等）を初期投入し、店舗名含有判定。誤判定は admin 手動修正可。AI 判定は Phase C。

---

## ■ Bud 既存実装との整合（重複排除）

| 既存（Phase 0）| 本 Batch 5 での扱い |
|---|---|
| `transfer-status.ts`（7 ステータス + canTransition）| A-03 §2 で**そのまま正本として維持**、業務意味を補足 |
| `types.ts`（BudTransfer 型）| A-04 で `BudStatement` / `BudCcStatement` 追加型を提案 |
| `_lib/duplicate-key.ts`| A-04 で**そのまま活用**（新規 UI 側から呼出）|
| `_lib/transfer-id.ts`（FK-/CB- ID 生成）| A-04 で**触らない**、DB 自動採番に依存 |
| `_lib/__tests__/*.test.ts`（4 種）| A-03 で遷移テスト追加を推奨 |
| `StatusBadge.tsx`| A-05 で**そのまま流用** |
| `FilterBar.tsx`| A-05 で status 絞込に活用 |

---

## ■ 参考

- **作業ブランチ**: [`feature/phase-a-prep-batch5-bud-20260424-auto`](https://github.com/Hyuaran/garden/pull/new/feature/phase-a-prep-batch5-bud-20260424-auto)
- **既存 Bud**（`feature/bud-phase-0-auth`）:
  - `src/app/bud/_constants/transfer-status.ts`
  - `src/app/bud/_constants/types.ts`
  - `src/app/bud/_lib/duplicate-key.ts`
  - `src/app/bud/_lib/transfer-id.ts`
  - `src/app/bud/transfers/_lib/transfer-form-schema.ts`
- **関連ドキュメント**:
  - Bud CLAUDE.md（振込管理 / 明細管理 / 給与処理 / CC 明細ルール / 未決事項）
  - MEMORY `project_cc_processing`, `project_bud_cash_payment_issue`, `project_sales_cost_analysis`
  - `docs/known-pitfalls.md`（§1.5 Bud Gate 非リアクティブなど）
- **Bud レビュー**（Batch earlier、`feature/bud-review-20260424-auto`）: `b371ed5`
