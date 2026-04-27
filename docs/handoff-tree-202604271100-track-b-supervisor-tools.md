# Tree Track B 責任者ツール spec 起草 — handoff

- 日時: 2026-04-27 ~11:00 完了
- セッション: a-tree
- ブランチ: `feature/tree-track-b-supervisor-tools-20260427`（develop ベース、新規）
- 反映対象: a-main 006 Track B 早期展開タスク

## 完了成果物

### 新規 spec
- `docs/specs/tree/spec-tree-track-b-supervisor-tools.md`（~600 行、Phase 1 最小版 1.5d / Phase 2 拡張版 +2.0d / 合計 3.5d）

### スコープ
4 候補機能（F1〜F4）+ 優先順位提案 + 最小版 / Phase 2 拡張版分離 + 工数見積。
Track A の +2.0d ソフトフォン実装とは**別建て**。

### 4 機能
- **F1 実件数報告 .xlsx 自動生成**（既存 Excel テンプレを Garden 内で自動化）
- **F2 営業フィードバック集約画面**（現場の声を責任者が一覧で見られる）
- **F3 日次・週次・月次サマリ画面**（KPI 速報・要フォロー対象の可視化）
- **F4 その他 Excel 自動化候補**（要ヒアリング、F1+F3 リリース後）

### 優先順位提案（東海林さん判断仰ぐ）
**推奨: 案 α**（F1+F3 セット最小版 = 1.5d）
- 即効性（F1）+ 朝の体感（F3）の 2 大要素を最小工数でカバー
- 案 β（F1 のみ先行 0.6d）/ 案 γ（F1+F2+F3 全部同時 2.0d）も提示

### 工数見積
- **Phase 1 最小版**: F1（0.6d）+ F3（0.8d）+ 統合 QA（0.1d）= **1.5d**
- **Phase 2 拡張**: F1 拡張（1.0d）+ F3 拡張（1.0d）+ F2 着手（1.0d）= **+2.0d**（Bloom 連携で -0.5d 可）
- **合計**: **3.5d**（最大）
- **Track A との独立進行**: 別ブランチ・別 PR・別 commit

### Dual-Track 戦略との整合
```
Track A: D-1+D-2 セットリリース（慎重展開）
  ↓ 開発期間（4-5 週間）
  ↓ α → β1 → β2-3 → β half → 全員（Tree 特例 §17）

Track B: 責任者ツール（早期展開、社員心象醸成）
  ↓ Track A の D-1 着手と同時 or 数日以内に開始
  ↓ Track A α版開始時に Track B 最小版もリリース
  ↓ 責任者経由で Garden 第一印象醸成
  ↓ Track A 慎重展開期に並行進行
```

### 後道さん FB 範囲
**不要**（Track B は営業側、後道さんは経理側）。
memory `feedback_ui_first_then_postcheck_with_godo.md` の架電画面例外と同方針で整理。

## 判断保留事項（東海林さん確認推奨、§10）

| # | 項目 | 仮スタンス |
|---|---|---|
| 1 | F1 既存 Excel テンプレの提供 | **東海林さん業務知識依存** |
| 2 | F1 ファイル名命名規則 | 業務既存ルール依存 |
| 3 | F1+F3 のスキーマ依存（D-01 完成後 / 独自簡略 / FileMaker→Soil 経由）| **a-main 判断仰ぐ** |
| 4 | 優先順位の最終確定（F1+F3 / F1 のみ / 全部）| **東海林さん判断** |
| 5 | F4 のヒアリング時期 | F1+F3 リリース 1 週間後 |
| 6 | Phase 2 自動配信 cron の配信時刻 | 業務既存ルールに合わせる |
| 7 | F2 のカテゴリ確定 | 4 種仮提案、業務実態と齟齬あれば調整 |

## 反映済関連 memory

- `project_tree_d2_release_strategy.md`（Dual-Track 戦略の根拠）
- `project_godo_ux_adoption_gate.md`（後道さん UX ゲートは Track A 範疇、Track B は対象外）
- `feedback_quality_over_speed_priority.md`（品質最優先方針）
- `feedback_ui_first_then_postcheck_with_godo.md`（架電画面例外 → Track B にも適用）

## ローカル commit

（commit 後に追記）

## 干渉回避

- ✅ a-bud / a-auto / a-soil / a-root / a-leaf / a-forest の進行中ブランチ非接触
- ✅ Track A（架電本体）の慎重展開と独立進行
- ✅ Tree Phase D 既存 6 spec の本体は触らず（参照のみ）
- ✅ 実装コード変更なし（spec のみ）
- ✅ main / develop 直接 push 禁止

## ステータス

判断保留が出なかったため pause file 作成不要。push は GitHub 復旧後（push plan 参照）。

## 次のアクション

1. **GitHub 復旧後 push** + PR 発行（develop 向け、レビュー: a-bloom）
2. **東海林さん確認**:
   - 判断保留 #1（既存 Excel テンプレ提供）
   - 判断保留 #2（ファイル名命名規則）
   - 判断保留 #4（優先順位最終確定、a-tree 推奨は F1+F3 セット）
3. **a-main 判断**:
   - 判断保留 #3（schema 依存方針: 案 A / B / C）
4. 判断保留解消後、Phase 1 最小版実装着手（F1 0.6d + F3 0.8d + 統合 0.1d = 1.5d）
5. Bloom チームと役割分担調整（F3 と Bloom Phase A-1 の重複範囲整理）

---

## 改訂履歴

| 日付 | 版 | 改訂内容 | 担当 |
|---|---|---|---|
| 2026-04-27 | v1.0 | a-main 006 Track B 早期展開タスクとして spec 起草完了。4 機能 + 優先順位提案 + 最小版/Phase 2 分離 + 工数見積（合計 3.5d、Track A の +2.0d とは別建て）。 | a-tree |
