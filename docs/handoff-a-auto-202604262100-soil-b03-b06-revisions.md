# Handoff - 2026-04-26 21:00 - a-auto - Soil B-03 大幅修正 + B-06 重要修正

## 今やっていること
- ✅ Soil Phase B-03 大幅修正（follow-up §1.2、6 件全件反映）→ commit 予定
- ✅ Soil Phase B-06 重要修正（follow-up §1.5、4 件全件反映）→ 同 commit

## B-03 修正内容（前提が大きく変わった）

### 変更前 → 変更後

| # | 旧 | 新 |
|---|---|---|
| 概念 | Soil-Leaf 対等 / 飛び込み案件補完 | **Soil = master / Leaf = ミラー**、Leaf に Soil 不在 = バグ |
| R1 マッチング | phone + 漢字氏名 | **supply_point_22**（22 桁 不変 ID） |
| 用語 | 「飛び込み案件」 | **「リスト外」**（is_outside_list フラグ） |
| 補完バッチ | 月次補完 | **毎日深夜 03:00**（B-02 と統一） |
| orphan 警告 | 100 件超で medium | **テストレコード以外で 1 件即警告**（high + DM） |
| pd_number 変更 | 未定義 | **case_type 連動**（latest/replaced/makinaoshi/outside）+ handle_pd_number_change() DB 関数 |

### 主要新設

- `soil_lists.supply_point_22` UNIQUE 部分インデックス
- `soil_lists.pd_number / old_pd_numbers (jsonb)`
- `soil_lists.is_outside_list / source_channel / source_channel_note / registered_outside_at`
- `leaf_kanden_cases.case_type / old_pd_number / replaced_at / replaced_by`
- 6 ラウンドマッチング（R1〜R6）
- `handle_pd_number_change()` DB 関数（SECURITY DEFINER + search_path 固定）
- `is_test_kanden_record()` IMMUTABLE 関数（テストレコード判定）
- `count_non_test_orphan_leaves()` 1h cron 即警告

## B-06 修正内容（§17 新設で 4 件追加）

### 17.1 商材別アクセスマトリックス
- Garden Tree: 全ロール（toss / closer / cs / staff / outsource / manager+）
- Garden Leaf 関電: cs / staff / outsource（槙さん例外）/ manager+ のみ（**toss / closer 除外**）
- Garden Leaf その他（光・クレカ等）: cs / staff / manager+ のみ（**toss / closer / outsource 除外**）

### 17.2 Tree → Leaf ミラーデータフロー
- toss / closer は Tree で完結、Leaf に直接アクセスしない
- `leaf_kanden_with_tree_context` VIEW（LATERAL JOIN、コピーなしリアルタイム参照）
- データフロー図追加

### 17.3 toss_view_scope root_settings 動的切替
- 初期: `self_only`（自分のみ）
- 拡張: `team_all`（同部門）/ `all`（全社）
- admin が設定変更 UI から切替、再起動なし、30 秒以内反映
- RLS ポリシーが `get_toss_view_scope()` を参照、CASE 文で動的切替

### 17.4 槙さん例外設計
- `root_employees.module_owner_flags jsonb` 列追加
- `{"leaf_kanden": true}` で関電全件アクセス可
- 将来他モジュール責任者外注も同構造で対応可
- super_admin のみ編集可、root_audit_log 記録

## 次にやるべきこと（次セッション向け）

### 即座の対応
- GitHub Support チケット #4325863 復旧確認 → 滞留 6 commits（Batch 18 / Batch 18 整合 / Batch 19 / Batch 14 fix / Kintone 8 件 / Kintone 残 6 件 / 本コミット）一括 push
- a-root に **B-06 §17.6 連携要請 5 件**を伝達
  - `root_settings` toss_view_scope カテゴリ追加
  - `root_employees.module_owner_flags` jsonb 列追加
  - `get_toss_view_scope()` SECURITY DEFINER STABLE 関数
  - `/root/admin/settings` toss_view_scope セクション
  - `/root/admin/employees/[id]/module-owners` 編集 UI

### 後続作業
- a-leaf に **B-03 §3.4 / §6** の `case_type` 列追加 + `handle_pd_number_change()` 連携要請
- a-tree に **B-06 §17.2** Tree → Leaf ミラー View の運用方針説明

## 注意点・詰まっている点

### 設計の核心変化（重要）
B-03 で「Soil = master / Leaf = ミラー」が確定。今後 Leaf 関電関連の全 spec / 実装は **soil_list_id NOT NULL 前提**で書く必要あり。既存 Leaf spec で「飛び込み案件」言及があれば cleanup 対象。

### 確定反映後の判断保留（軽微）

| # | 論点 | spec | スタンス |
|---|---|---|---|
| 判 1 | R1 supply_point_22 NULL の Kintone レコード | B-03 | R2 以降にフォールバック |
| 17-1 | toss_view_scope 切替反映時間 | B-06 | 30 秒以内 |
| 17-3 | 槙さん退職時の flag リセット | B-06 | super_admin が手動 |
| 判 4 | makinaoshi 自動判定 | B-03 | しない、admin 手動のみ |

## 関連情報

### ブランチ
- `feature/soil-phase-b-specs-batch19-auto`
- 2 commits ahead of origin/develop（既存 5afc22e + 本 commit）

### 関連ファイル
- `docs/specs/2026-04-26-soil-phase-b-03-kanden-master-integration.md`（全面書換）
- `docs/specs/2026-04-26-soil-phase-b-06-rls-detailed.md`（§17 新設）
- `docs/effort-tracking.md`（B-03 / B-06 修正行追加）
- `docs/handoff-a-auto-202604262100-soil-b03-b06-revisions.md`（本ファイル）

### 関連 PR / Issue
- 滞留 PR（既存 open）: #44 / #47 / #51 / #57 / #74
- GitHub Support: チケット #4325863

### 関連 memory
- `feedback_kintone_app_reference_format`
- `project_chatwork_bot_ownership`
- `project_session_shared_attachments`

### 添付資料
- `C:\garden\_shared\decisions\decisions-kintone-batch-20260426-a-main-006.md`
- `C:\garden\_shared\decisions\spec-revision-followups-20260426.md` §1.2 + §1.5
