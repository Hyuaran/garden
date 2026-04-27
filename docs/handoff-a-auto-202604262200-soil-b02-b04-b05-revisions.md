# Handoff - 2026-04-26 22:00 - a-auto - Soil B-02 / B-04 / B-05 軽微修正完走

## 今やっていること
- ✅ Soil Phase B-02 軽微修正（follow-up §1.1、2 件）
- ✅ Soil Phase B-04 軽微修正（follow-up §1.3、1 件）
- ✅ Soil Phase B-05 軽微修正（follow-up §1.4、5 件）

合計 8 件の改訂、同一ブランチ `feature/soil-phase-b-specs-batch19-auto` に追加 commit。

## 修正内容サマリ

### B-02（コール履歴インポート）

| 項目 | 変更前 | 変更後 |
|---|---|---|
| 投入時刻 | 土曜深夜 23:00 開始 | **毎日深夜 03-04 時開始 / 朝 06-07 時完了**（cron `0 3-6 * * *`）|
| アーカイブ | 24 ヶ月超を 6-12 ヶ月後に判断 | **当面なし**、将来拡張可能な hooks のみ |

### B-04（検索性能最適化）

| 項目 | 変更前 | 変更後 |
|---|---|---|
| MV REFRESH | 4 時間ごと | **1 時間ごと、朝 8 時〜夜 20 時（13 回/日、cron `0 8-20 * * *`）、夜間停止** |
| 対象 MV | 一般集計 | **Leaf 関電 KPI 集計に明示**（kpi_summary / revenue_monthly）|

### B-05（バックアップ・リカバリ）

| 項目 | 変更前 | 変更後 |
|---|---|---|
| R2 保管 | 12 ヶ月で削除 | **12 ヶ月超を Google Drive 自動移管**（永続保管、追加コスト 0）|
| リストア訓練 | 年 4 回 / 年 2 回 / 年 1 回 必須 | **YAGNI 降格**、手順書整備優先、四半期セルフレビューのみ必須 |
| 槙さん権限 | 言及なし | **module_owner_flags['leaf_kanden']=true で Leaf 関電のみ復元可**（B-06 §17.4 連携）|
| 復元時 UX | 通知のみ | **全画面ポップアップ + DB+UI 両層書込ブロック**（is_module_in_restore()）|
| Supabase プラン | Team 推奨 | **Pro 維持**、Team は Phase B-1 完了 + 業務影響評価後 |

## 主要新設

- `soil_backup_migration_logs` テーブル（R2 → GDrive 移管ログ）
- `is_archive_eligible_partition()` IMMUTABLE 関数（B-02 将来拡張用）
- `is_module_in_restore()` SECURITY DEFINER STABLE 関数（B-05 復元中判定）
- `can_restore_leaf_kanden()` SECURITY DEFINER STABLE 関数（B-05 槙さん権限）
- `RestoreInProgressGuard` UI コンポーネント（B-05 ポップアップ強制）
- `/api/cron/soil-backup-r2-to-gdrive`（毎月 1 日 04:00）

## 次にやるべきこと（次セッション向け）

### 即座の対応
- GitHub Support チケット #4325863 復旧確認 → 滞留 commits 一括 push（最新 7 commits）
- a-root に **B-06 §17.6 連携要請 5 件**を伝達（既存 handoff 記載）

### 後続作業
- a-leaf に B-03 / B-06 / B-05 §6.4 の槙さん例外 + Tree → Leaf ミラー View を spec で参照
- Workspace 法人 Google Drive アカウント + service account 鍵設定（B-05 §5.5 GDrive 移管前提）
- vercel.json crons に `/api/cron/soil-refresh-mv`（B-04）と `/api/cron/soil-backup-r2-to-gdrive`（B-05）追加準備

## 注意点・詰まっている点

### 業務時間帯設計の整合
- B-02 投入: 03:00-07:00
- B-04 MV REFRESH: 08:00-20:00
- B-05 GDrive 移管: 月 1 日 04:00（B-02 とほぼ同時間帯だが月次なので影響限定）

時間帯重複なし、業務影響回避を意識した設計に統一。

### 確定反映後の判断保留（軽微）

| # | 論点 | spec | スタンス |
|---|---|---|---|
| 判 3 | アーカイブ実装時期 | B-02 | 容量逼迫トリガで判断 |
| MV-1 | 夜間 REFRESH の force=1 監査 | B-04 | 必須記録 |
| §5.5-1 | GDrive service account 鍵管理 | B-05 | 1Password + 年 1 回ローテーション |
| §11.3-1 | super_admin もポップアップ閉じれない仕様 | B-05 | 復元実行者は閉じれる、他 admin はモニタリング |

## 関連情報

### ブランチ
- `feature/soil-phase-b-specs-batch19-auto`
- 3 commits ahead of origin/develop（5afc22e + bf07922 + 本 commit）

### 関連ファイル
- `docs/specs/2026-04-26-soil-phase-b-02-call-history-import.md`（§8.3 / §14 改訂）
- `docs/specs/2026-04-26-soil-phase-b-04-search-optimization.md`（§7 改訂）
- `docs/specs/2026-04-26-soil-phase-b-05-backup-recovery.md`（§5.4-5.5 / §6.4 / §8 / §10.3 / §11.3 改訂）
- `docs/effort-tracking.md`（B-02 / B-04 / B-05 修正行追加）

### 関連 PR / Issue
- 滞留 PR（既存 open）: #44 / #47 / #51 / #57 / #74
- GitHub Support: チケット #4325863

### 関連 memory
- `feedback_kintone_app_reference_format`
- `project_session_shared_attachments`

### 添付資料
- `C:\garden\_shared\decisions\decisions-kintone-batch-20260426-a-main-006.md`
- `C:\garden\_shared\decisions\spec-revision-followups-20260426.md` §1.1 / §1.3 / §1.4

## 投下まとめ

a-auto への投下完了状況:
1. ✅ Kintone batch 32 件反映（完走）
2. ✅ #47 SQL injection 修正（完走）
3. ✅ B-03 大幅修正（完走、commit bf07922）
4. ✅ B-06 重要修正（完走、commit bf07922 同梱）
5. ✅ **B-02/04/05 軽微修正（完走、本 commit）**

5 個目完走、待機状態。
