# 自律実行レポート - a-auto 002 - 2026-04-25 00:10 発動 - 対象: Tree

## 発動時のシーン

**就寝前モード**（5 時間枠活用、復帰時レビュー想定）

- 発動プロンプト: 「a-auto 002 セッション起動。Batch 8 まで累計 46 spec / 23.95d の引継ぎを把握し、Batch 9 = Tree Phase D spec 6 件を起草」
- 対象: Garden-Tree Phase D（FileMaker 代替の架電アプリ最終段階）
- タスク: D-01 〜 D-06 の 6 spec（~4.5d 分）

---

## やったこと

### ✅ 全 6 件完走

| # | ファイル | 行 | 見積 | 位置付け |
|---|---|---|---|---|
| D-01 | spec-tree-phase-d-01-schema-migration.md | 448 | 0.9d | DB 基盤（最優先）|
| D-02 | spec-tree-phase-d-02-operator-ui.md | 406 | 1.0d | オペレーター UI |
| D-03 | spec-tree-phase-d-03-manager-ui.md | 348 | 0.8d | マネージャー UI |
| D-04 | spec-tree-phase-d-04-tossup-flow.md | 432 | 0.7d | トスアップ連携 |
| D-05 | spec-tree-phase-d-05-kpi-dashboard.md | 408 | 0.7d | KPI ダッシュボード |
| D-06 | spec-tree-phase-d-06-test-strategy.md | 502 | 1.0d | テスト戦略 🔴 |

**合計: 2,544 行 / 実装見積 5.1d**（テスト実装含む）

---

## 各 spec の主な決定事項（a-auto 起草、判断は保留）

### D-01: Schema Migration
- **新設 3 テーブル**: `tree_calling_sessions` / `tree_call_records` / `tree_agent_assignments`
- **Soil 連携方針**: Tree INSERT / Soil 集計（役割分担）、FM 既存データは遡らない
- **RLS**: 営業 / マネージャー / admin / super_admin の 4 階層
- **列制限 Trigger**: Leaf C-01 パターン踏襲、`employee_id` 等を UPDATE で弾く
- **論理削除**: 全 3 テーブルで `deleted_at` カラム必須
- **監査**: 6 イベント（session.open/close, call.record/rollback, assignment.allocate/release）

### D-02: Operator UI
- 既存 `src/app/tree/` 5 画面（sprout/branch/breeze/aporan/confirm-wait）を Supabase 連携へ拡張
- **FM 互換ショートカット F1-F10**（Sprout: トス/担不/見込A-C/不通/NG 4 種）
- **1 クリック進行**（Leaf A-2 パターン）
- **オフライン耐性**（localStorage キュー、上限 500 件、復帰時 flush）
- **通話中画面遷移禁止**（`beforeunload` + in-app Link ラップ）
- **巻き戻し 5 秒窓**（`Ctrl+Z`、`prev_result_code` 保存）

### D-03: Manager UI
- リアルタイム稼働（30s polling、WebSocket は D-2 検討）
- 状態判定: active / idle / break / offline / calling
- **介入機能**: モニタリング（polling 方式）+ Chatwork DM 指示送信
- **自動アラート 5 種**: 低成約率 / 離脱多発 / 長時間離席 / 連続不通 / 好調
- **Forest との役割分担**: Tree はコールセンター専用・日内粒度

### D-04: Tossup Flow
- **2 段階ウィザード**: Step 1 同意確認 / Step 2 商材別情報（関電のみ、他は D-2 拡張）
- **トランザクション関数** `tree_toss_to_leaf(payload)`: Tree UPDATE + Leaf INSERT + 監査 を 1 原子操作
- ロールバック設計: 整合性ジョブ（Cron 日次 23:30）で孤児検出
- Chatwork 通知: 事務チーム / オペレーター / admin、**案 D 署名 URL 不流通**
- Leaf 事務タブ: `review_note` prefix `[Tree トス]` で識別

### D-05: KPI Dashboard
- **Materialized View 3 本**（日次 / 週次 / 月次、CONCURRENTLY REFRESH）
- KPI 10 種: コール / 接続 / トス率 / NG / クレーム率 / 稼働率 / 案件化後（受注率・解約率）
- **非技術者向け UX**: 現場用語、色 3 色、前月比矢印
- エクスポート: CSV（UTF-8 BOM）/ Excel（2 シート構成）
- **Bloom との役割分担**: Tree KPI はオペレーター別・日内粒度

### D-06: Test Strategy
- **Tree 🔴 最厳格**: Unit 85% / Integration 75% / E2E 10 本 / 境界値 100%
- §16 7 種テストの Tree 具体化（結果ボタン 21 種、RLS 7 役割、エッジ 12 種）
- **§17 5 段階展開**: α（1 週間）→ β 1 人（1 週間）→ 2-3 人（1 週間）→ 半数（1-2 週間）→ 全員
- FM vs Garden の **GO/NO-GO 判定基準**（KPI ± 5%、クレーム率急上昇で即 NO-GO）
- **3 段階ロールバック**: L1 指示切替 / L2 Garden 停止 / L3 DB rollback
- CI: カバレッジ未達の PR は **マージ禁止**（🔴 ルール厳守）

---

## コミット一覧

- `<hash>`: [a-auto] Batch 9 Tree Phase D spec 6 件（D-01〜D-06 合計 2,544 行）+ broadcast/report

（commit hash は push 完了後に broadcast/to-a-main.md に追記）

---

## 詰まった点・判断保留

### a-auto 起草中に迷った点（すべて各 spec §最終章に集約）

- **D-01 判1**: 録音 Storage を PBX URL 格納 / Garden Storage 統合 どちらにするか → D-1.5 で別途検討を推奨
- **D-01 判3**: リスト割当アルゴリズム（手動 vs round-robin vs skill-based）→ D-1 は手動維持
- **D-02 判2**: オフラインキュー上限 → 500 件（it'a judgment call）
- **D-03 判2**: モニタリング方式（polling vs WebSocket）→ Phase D-1 は polling、D-2 で WebSocket
- **D-04 判1**: 他商材対応時期 → Phase D-1 関電のみ、D-2 光、D-3 クレカ
- **D-05 判5**: MV サイズ超過時のパーティション化時期 → 2 年後（約 1,000 万行）
- **D-06 判1**: 負荷試験ツール → k6 推奨（Supabase 公式、JS）

### 最優先合意事項 5 件（東海林さん判断必須）

上記を含め、§broadcast to-a-main.md §to-a-tree.md に整理済み：
1. 録音 Storage 設計
2. オフラインキュー上限
3. 他商材対応時期
4. FM vs Garden 統計照合自動化
5. 本番 rollback の実行権限

---

## 次にやるべきこと

### 1. 判断保留の合意（東海林さん + a-tree）

- 最優先 5 件を `docs/decisions/tree-phase-d-decisions.md` に起草
- 合意結果は各 spec PR に追記 or develop マージ前に spec 本体を更新

### 2. Batch 9 PR #30 のマージ（a-main）

- 内容レビュー（2,544 行の変更、すべて新規 `docs/`）
- `develop` へマージ → a-tree が M7 着手準備可能に

### 3. M7 着手準備（a-tree、2026-10 頃）

- Vitest / RTL+MSW / Playwright の Tree 🔴 専用設定
- FM 並行運用計画書（総務・マネージャー連携）
- D-01 schema migration から実装開始

### 4. 並列自律化候補

a-auto 次回発動時の候補（§15 並列自律提案ルール経由）:
- **Bud Phase C**（年末調整、6 spec、~3.5d 分）- M6 前
- **Leaf 他商材スケルトン**（光回線 / クレカ、大量生成、~1.0d 分）- 就寝前軽量バッチ
- **Soil / Rill 基盤設計**（Phase C 補完、~3.0d 分）- 中期

---

## 使用枠

- **開始時使用率**: 不明（セッション起動直後）
- **終了時使用率**: 低（6 spec 起草 + broadcast は compact、`/cost` で詳細要確認）
- **稼働時間**: 2026-04-25 00:10 〜 01:00 頃（約 **50 分**）
- **停止理由**: **全 6 タスク完走**（停止条件 1: 初期タスクリスト全件完了）
- **特記**: 就寝前モードで発動したが、実効 50 分で完走。残り枠は十分、Batch 10 の追加発動も可能な状態。

---

## 自己評価

### 🟢 良かった点

1. **タスク分割が明確**: 6 spec が独立・整合性あり、相互参照も正確
2. **既存パターン踏襲**: Leaf C-01 列制限 Trigger、A-2 1 クリック、A-FMK1 ショートカット等、成功パターン完全継承
3. **判断保留の明示**: 42 件を各 spec §最終章に集約、優先度付き
4. **FileMaker 互換性への配慮**: Tree 特有の要求（§18 最慎重）を D-02/D-06 で徹底反映

### 🟡 改善余地

1. **D-03 行数（348）**: 目安 370〜490 の下限未達、録音聴取詳細が §判断保留のため削られた結果
2. **見積 4.5d → 5.1d**: Tree 🔴 最厳格のテスト戦略が想定より厚く、+0.6d 増加
3. **PR #30 作成**: 自律モードで PR 作成するが、ラベル付与（`tree`, `batch9` 等）は未実施、a-main 側で追加推奨

---

## a-auto 002 セッション状態

- ブランチ: `feature/tree-phase-d-specs-batch9-auto`（push 済、PR #30 予定）
- 次セッション引継ぎ: 必要に応じて `docs/handoff-a-auto-002-to-003.md` を起草可能（本 Batch 9 完走のみで終了の場合は不要）

---

— a-auto 002 Batch 9 Tree Phase D 自律実行レポート end —
