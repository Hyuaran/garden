# Batch 9 Tree Phase D 全体サマリ

- 発動: 2026-04-25 00:10 頃 / a-auto 002 セッション就寝前モード
- 完了: 2026-04-25 約 01:00
- ブランチ: `feature/tree-phase-d-specs-batch9-auto`（develop 派生、`8331585` 基点）
- 対象: Garden-Tree Phase D（コールセンター主力・FileMaker 代替の最終段階）

---

## 🎯 成果物

| 優先度 | # | ファイル | 行 | 見積 |
|---|---|---|---|---|
| 🔴 最高 | 1 | [D-01 schema-migration](../specs/tree/spec-tree-phase-d-01-schema-migration.md) | 448 | 0.9d |
| 🔴 最高 | 2 | [D-02 operator-ui](../specs/tree/spec-tree-phase-d-02-operator-ui.md) | 406 | 1.0d |
| 🔴 高 | 3 | [D-03 manager-ui](../specs/tree/spec-tree-phase-d-03-manager-ui.md) | 348 | 0.8d |
| 🔴 高 | 4 | [D-04 tossup-flow](../specs/tree/spec-tree-phase-d-04-tossup-flow.md) | 432 | 0.7d |
| 🟡 中 | 5 | [D-05 kpi-dashboard](../specs/tree/spec-tree-phase-d-05-kpi-dashboard.md) | 408 | 0.7d |
| 🔴 最高 | 6 | [D-06 test-strategy](../specs/tree/spec-tree-phase-d-06-test-strategy.md) | 502 | 1.0d |

**合計**: **2,544 行**、実装見積 **5.1d**（テスト含む）

> Batch 9 依頼時見積 4.5d → 実見積 5.1d（+0.6d）。Tree 🔴 最厳格のテスト戦略（D-06）が Leaf 🟡 比 +0.25d で増加した分がドライバ。

---

## 🔑 各 spec の核心

### D-01 Schema Migration 🔴
- 新設 3 テーブル: `tree_calling_sessions` / `tree_call_records` / `tree_agent_assignments`
- Soil 連携（営業リスト 253 万 / コール履歴 335 万）: Tree INSERT / Soil 集計のハイブリッド
- **4 階層 RLS**（営業 / マネージャー / admin / super_admin）
- 列制限 Trigger（Leaf C-01 パターン踏襲）、論理削除、監査ログ 6 イベント
- **FM 既存データは遡って INSERT しない**、Soil 投入済データのみ使う方針
- Materialized View（KPI pre-aggregate）は D-05 に委譲

### D-02 Operator UI 🔴
- 既存 `src/app/tree/{call,calling/sprout,calling/branch,breeze,aporan,confirm-wait}` を Supabase 連携に拡張
- **FM 互換ショートカット F1-F10**（トス・担不・見込 A-C・不通・NG 4 種）
- 1 クリック結果 INSERT + 次リスト自動遷移（Leaf A-2 パターン）
- **オフライン耐性**（localStorage キュー、復帰時 flush、上限 500 件）
- 通話中の画面遷移禁止ガード（`beforeunload` + in-app Link ラップ）
- 5 秒以内の巻き戻し（`Ctrl+Z`、prev_result_code 保存で完全復元）
- モバイル対応（関電フィールド訪問のスマホ利用想定）

### D-03 Manager UI 🔴
- リアルタイム稼働状況（在席 / 通話中 / 休憩 / 離席、30s polling）
- オペレーター別パフォーマンス（コール数 / トス数 / 成約率）+ ドリルダウン
- **介入機能**（モニタリング + Chatwork DM 指示送信）
- 自動アラート 5 種（低成約率 / 離脱多発 / 長時間離席 / 連続不通 / 好調）
- **案 D 準拠**: Chatwork 本文に署名 URL 不流通、Garden ログイン誘導のみ
- Forest（全社 KPI）との役割分担: Tree はコールセンター専用・日内粒度

### D-04 Tossup Flow 🔴
- Tree → Leaf（案件化）の **2 段階ウィザード**（同意確認 + 商材別情報）
- Phase D-1 は関電のみ（光回線・クレカは D-2 で拡張）
- PostgreSQL 関数（`tree_toss_to_leaf`）で **1 トランザクション** → 中途半端状態を作らない
- ロールバック: オフラインキュー経由の再送、夜間整合性ジョブで孤児検出
- Chatwork 通知（事務チーム / オペレーター / admin に案 D で送信）
- Leaf 事務タブの「🆕 NEW」マークで Tree 由来案件を識別

### D-05 KPI Dashboard 🟡
- 日次 / 週次 / 月次の **Materialized View** 3 本（CONCURRENTLY REFRESH）
- KPI 10 種（コール / 接続 / トス率 / NG / クレーム率 / 稼働率 / 案件化後）
- **非技術者向け UX**（現場用語、色 3 色、前月比の矢印表示）
- CSV / Excel エクスポート（UTF-8 BOM / 2 シート構成）
- 月次レポート: Storage 保存 + Chatwork 誘導（案 D 準拠）
- Bloom（全社）との役割分担: Tree KPI はオペレーター別・日内粒度

### D-06 Test Strategy 🔴
- **Tree 🔴 最厳格**（spec-cross-test-strategy 準拠、Leaf 🟡 比で +15pp カバレッジ）
- Unit 85% / Integration 75% / E2E 10 本 / 境界値 100%
- §16 7 種テストの Tree 特化（結果ボタン 21 種 / RLS 7 役割 / エッジ 12 種）
- §17 **5 段階展開**具体化（α → β 1 人 → 2-3 人 → 半数 → 全員）
- FM 並行運用中の GO/NO-GO 判断基準（KPI ± 5%、クレーム率 急上昇 で即 NO-GO）
- **3 段階ロールバック**（L1 指示切替 / L2 Garden 停止 / L3 DB rollback）

---

## 🔗 既存 / 関連への接続

| D-0X | 依存・参照先 |
|---|---|
| D-01 | spec-cross-rls-audit（RLS パターン）, spec-cross-audit-log（監査）, spec-leaf-kanden-phase-c-01（列制限 Trigger）|
| D-02 | D-01, spec-leaf-kanden-phase-c-03（ウィザード / ショートカット）, spec-cross-error-handling |
| D-03 | D-01, D-02, spec-cross-rls-audit（部署別 RLS）, spec-cross-chatwork-notification（案 D）|
| D-04 | D-01, D-02, spec-leaf-kanden-phase-c-03（Leaf 側受信）, spec-cross-chatwork |
| D-05 | D-01, D-03, Bloom 既存設計, spec-cross-storage（CSV/Excel エクスポート）|
| D-06 | spec-cross-test-strategy, 親 §16 / §17 / §18 |

---

## 📊 判断保留（計 42 件）

| # | spec | 件数 | 主要論点 |
|---|---|---|---|
| 1 | D-01 | 6 | 録音 Storage 設計 / 監査ログ保存期間 / パーティショニング時期 |
| 2 | D-02 | 7 | オフラインキュー上限 / 巻き戻し時間枠 / `tel:` リンク |
| 3 | D-03 | 7 | 録音聴取方式 / モニタリング方式 / アラート閾値 |
| 4 | D-04 | 7 | 他商材対応時期 / トス取消 / 事務チーム振り分け |
| 5 | D-05 | 8 | KPI 目標設定 / PDF 出力 / モバイル対応 / MV パーティション |
| 6 | D-06 | 7 | 負荷試験ツール / カバレッジ未達 PR / FM 照合自動化 |

**最優先合意事項 5 件**（a-main 経由で東海林さん判断）:
1. D-01 判1: 録音 Storage 設計（PBX URL 格納 or Garden Storage 統合）
2. D-02 判2: オフラインキュー上限（500 件で十分か）
3. D-04 判1: 他商材対応時期（光回線 D-2 / クレカ D-3 で OK か）
4. D-06 判3: FM vs Garden 統計照合自動化（Python + FM ODBC の実装負担）
5. D-06 判6: 本番 rollback の実行権限（東海林さん + admin 2 人承認）

---

## 🚀 推奨実装順序

```
M7 前半（2026-10 頃）: 2.4d
├─ D-01 schema migration（0.9d）
└─ D-02 operator UI（1.0d）— D-01 完走後 α 前提

M7 後半: 1.5d
├─ D-03 manager UI（0.8d）
└─ D-04 tossup flow（0.7d）

M8 前半: 1.7d
├─ D-05 KPI dashboard（0.7d）
└─ D-06 test strategy（1.0d）— 7 種テスト完走で α 開始

M8 後半 〜 M9: 展開期（5-6 週間）
├─ α版（東海林さん 1 人 × 1 週間）
├─ β 1 人（1 週間）
├─ β 2-3 人（1 週間）
├─ β 半数（1-2 週間）
└─ リリース（全員 + FM 切替）
```

---

## 🚨 最重要リスクと対策

### R1: FileMaker 切替失敗 = コールセンター業務停止
- **対策**: §17 5 段階展開 + §7 3 段階ロールバック計画（D-06）
- **判定**: KPI ± 5% / クレーム率 急上昇 / 重大事故 0 件 で GO

### R2: オペレーター UX 互換性欠如
- **対策**: FM ショートカット F1-F10 完全再現（D-02 §4）
- **判定**: α版で「手癖でキー押してミス」検証

### R3: データ損失（オフライン / 重複 / 中途トス）
- **対策**: オフラインキュー + トランザクション関数 + 整合性ジョブ（D-01/D-02/D-04）
- **判定**: 24h 連続稼働試験で損失 0

### R4: マネージャー介入で情報漏洩
- **対策**: 案 D 署名 URL 不流通 + RLS 部署境界（D-03）
- **判定**: 指示メッセージ本文に機密情報 0 件検証

---

## 📥 次アクション（a-auto 停止後）

1. **a-main**: 本サマリを確認 → 配布用短文を生成 → ユーザー手動配布
2. **a-tree**: 周知 `to-a-tree.md` 受信後、5 ステップで内容把握 + 判断保留 5 件を東海林さんに提示
3. **a-main**: 東海林さん回答を受けて、合意事項を各 spec PR に追記 or `docs/decisions/` に起草
4. **a-auto 003**（次回）: 判断保留未解消の論点を反映した Batch 10 候補生成

---

## 🗂 累計（Batch 1-9）

| カテゴリ | spec 数 | 工数 |
|---|---|---|
| 設計・基盤（B1）| 6 | — |
| Forest Phase A（B2-4）| 16 | 8.7d |
| Bud Phase A-1（B5）| 6 | 3.0d |
| Bud Phase B 給与（B6）| 6 | 3.0d |
| Garden 横断（B7）| 6 | 4.75d |
| Leaf 関電 C（B8）| 6 | 4.5d |
| **Tree Phase D（B9）** | **6** | **5.1d** |
| **合計** | **52 spec** | **約 29.05d** |

**Phase A + B + 横断 + Leaf C + Tree D の骨格コンプリート**。残るは Bud Phase C（年末調整）/ Soil・Rill・Seed 基盤 / Leaf 他商材。

---

— Batch 9 Tree Phase D summary end —
