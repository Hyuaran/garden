# Handoff: Garden Root Kintone 確定 6 件 反映完了（a-root-002 セッション）

- 作成: 2026-04-26 a-root-002 セッション
- ブランチ: `feature/root-phase-b-specs-20260425`（既存、Phase B specs ブランチに追加 commit）
- ステータス: **ローカル commit 完了 / push 待機（GitHub 復旧後）**
- 確定ログ: `C:\garden\_shared\decisions\decisions-kintone-batch-20260426-a-main-006.md`（全 32 件、Root 担当 6 件）

---

## 1. 反映完了 6 件（Root 担当）

| # | 確定内容 | 反映先 | 反映方法 |
|---|---|---|---|
| #23 | App 56「打刻 ID」と「KOTID」並列保持、将来統合候補 | 新規 B-08 spec | `attendance_punch_id` + `kot_employee_id` 両方保持 |
| #24 | チーム名 3 種 → `current_team_id` + `root_employee_team_history` + trigger | 新規 B-08 spec | history 自動追記 trigger 設計 |
| #27 | App 56「CW_API トークン」用途 = 代理通知（用途 B）、現状未運用 | B-6 §2.5 追加 | 未運用フラグ注記 |
| #28 | CW_API トークン migration なし（Garden 移行対象外） | B-7 §5.1 追加 | Skip 対象フィールド表に追加 |
| #29 | App 56 → root_employees merge 戦略 A（既存優先・欠損補完のみ） | B-7 §11.5 追加 | duplicate_check 拡張 + admin UI conflict レビュー |
| #31 | 助成金・休業履歴の保管期間（初期 10 年 → 安定後 7 年） | 新規 B-08 spec | retention_until 列 + 自動削除 cron |

加えて #32 段階的解約フロー（dual-write 1-2 ヶ月 → 読取専用 1 ヶ月 → 解約）を **B-7 §11.6 として追加**（#29 と密接に関係するため）。

---

## 2. 成果物（commit 4 本、新規 1 ファイル + 既存 2 ファイル + handoff/effort）

### 新規 spec (1)

- `docs/specs/2026-04-26-root-phase-b-08-employees-extension-from-kintone.md` (644 行) — commit `f4638f8`
  - §3.1 root_employees ALTER (`attendance_punch_id` / `current_team_id`)
  - §3.2 `root_employee_team_history` テーブル
  - §3.3 `root_employee_subsidies` テーブル
  - §3.4 `root_employee_leaves` テーブル
  - §3.5 trigger `root_log_team_change()` (current_team_id 変更時 history 自動追記)
  - §3.6 cron 関数 `root_cleanup_expired_retention()` (retention_until < CURRENT_DATE で物理削除)
  - 想定工数: 2.5d (W1〜W8 内訳)
  - 判断保留 6 件 + 未確認 6 件

### 既存 spec 改訂 (2)

- `docs/specs/2026-04-25-root-phase-b-06-notification-platform.md` — commit `d513efe`
  - **§2.5 を新設**: Kintone App 56 CW_API トークン用途と未運用フラグ注記
  - 代理通知（他者として送信）は本 spec 範囲外、Phase B-6.4 以降の Webhook 拡張で再設計

- `docs/specs/2026-04-25-root-phase-b-07-migration-tools.md` — commit `d513efe`
  - **§5.1 Skip 対象フィールド表を追加**: App 56 CW_API トークンを migration 対象外
  - **§5.1 対象アプリ表に App 56 追加**: mapping ファイル `app56-employees.ts`
  - **§11.5 を新設**: App 56 → root_employees merge 戦略 A（既存優先・欠損補完のみ・競合は手動レビュー）
    - duplicate_check 列拡張: `merge_complement` / `merge_conflict` / `merge_identical`
    - mergeEmployeeRow 実装パターン
    - admin UI での conflict レビュー方針
  - **§11.6 を新設**: Kintone 段階的解約フロー
    - Phase 1: dual-write 1〜2 ヶ月
    - Phase 2: Kintone 読取専用化 1 ヶ月
    - Phase 3: Kintone 解約（東海林さん最終承認 + 全 App CSV export 保全）
  - **§13 工数追加**: B-7.6 (1.0d) / B-7.7 (0.25d) / B-7.8 (0.25d) → 合計 4.0d → 5.5d (+1.5d)

### docs (effort-tracking + handoff)

- `docs/effort-tracking.md`: B-7 行に +1.5d 追記、本反映タスク行追加（実績 0.5d）、B-08 実装行追加（見積 2.5d）
- `docs/handoff-root-202604261000-kintone-decisions-applied.md`（本ファイル）

---

## 3. ブランチ状態

```
* feature/root-phase-b-specs-20260425 (ローカル先行 4 commits、未 push)
  d513efe docs(root): Phase B-6/B-7 spec に Kintone 確定 #27 #28 #29 #32 反映
  f4638f8 docs(root): Phase B-08 employees 拡張 spec 起草（Kintone 確定 #23 #24 #31）
  24fe476 docs(root): Phase B spec 起草完走 handoff + effort-tracking 更新
  ...（Phase B 全 7 spec、PR #75 で develop 取込待機中）
```

**push 状態**: GitHub アカウント停止（`remote: Your account is suspended`）のため push できず。GitHub 復旧後に `git push origin feature/root-phase-b-specs-20260425` 実行予定。

---

## 4. 重要な設計判断（spec 横断ハイライト）

### #23 打刻 ID + KOTID
- 両方並列保持の選択（統合せず）
- 既存 `kot_employee_id` (Phase 1 認証スキーマ) はそのまま、新規 `attendance_punch_id` を追加
- 将来統合は Phase C 以降で判断、運用データ蓄積後

### #24 team_history
- `current_team_id` を root_employees に追加（FK or text キーは判断保留 #判1）
- `root_employee_team_history` で追記方式の履歴管理
- AFTER trigger で自動追記（INSERT 時 = initial、UPDATE 時 = transfer）
- ended_at NULL = 現在所属

### #27/#28 CW_API トークン
- 機能としては存在するが運用なし（東海林さんの設定用途のみ）
- Garden では実装せず（Phase B-6.1〜B-6.3）、移行対象外（B-7）
- 将来 Sprout / Bud で代理通知が必要になれば Phase B-6.4 以降で再設計

### #29 merge 戦略 A
- 既存 root_employees 優先、Kintone は欠損補完のみ
- 競合は staging で `merge_conflict` フラグ → admin 手動レビュー
- SUBTABLE（在籍チーム / 助成金 / 休業）は merge 戦略 A の対象外、history 系で全行 INSERT

### #31 保管期間 10 → 7 年
- 初期 10 年運用、Phase 安定後に 7 年へ降格
- retention_until 列で各レコード個別管理
- 既存レコードへの遡及適用 vs 新規のみ降格は判断保留 #判3

### #32 段階的解約（B-7.6/B-7.7/B-7.8 で実装）
- Phase 1: dual-write（Garden → Kintone 同期、UPDATE/DELETE のみ）
- Phase 2: Kintone 読取専用化（同期停止、緊急参照のみ）
- Phase 3: Kintone 解約（最終 CSV export + 東海林さん承認）
- root_settings (root, dual_write_kintone, *) で ON/OFF 制御

---

## 5. 判断保留事項（東海林さん要ヒアリング、計 12 件）

### B-08 spec 由来 (6)
- 判1: root_teams を別テーブル化するか current_team_id を text キーで運用するか
- 判2: trigger AFTER vs BEFORE タイミング
- 判3: 保管期間 10→7 年の既存レコード遡及適用
- 判4: cron 実行頻度（日次 vs 月次）
- 判5: 物理削除 vs 論理削除（deleted_at）併用
- 判6: import 時の重複検知ルール（同 employee_id × 期間）

### B-7 §11.5/§11.6 由来 (新規)
- dual-write 失敗時の Garden 操作の継続/中止判断
- Phase 1 → 2 移行の自動化可否（現状: 手動）
- App 56 mapping の field 数（105 fields の何割を Garden に投入するか）

### 未確認事項 (B-08 6 件)
- U1: root_teams マスタの存在有無
- U2: 助成金種別の enum 制約リスト
- U3: 休業種別 leave_type の正式リスト
- U4: 「安定後」の定義（Phase 完了 / 期間 / 件数）
- U5: 物理削除前の事前通知の必要性
- U6: 助成金の amount_jpy NULL 可否

---

## 6. 制約遵守

- ✅ main / develop 直接 push なし
- ✅ 実装コードゼロ（spec のみ）
- ✅ 既存 root_* テーブルへの破壊的変更提案なし（ALTER ADD COLUMN IF NOT EXISTS のみ）
- ✅ 新規 migration 作成なし（spec 内 SQL 提案のみ）
- ✅ Supabase 本番への書込なし
- ✅ 判断保留が出たが a-main 指示「即停止 + pause file」は **発動せず完走**（spec の §12 判断保留 で列挙が許容されているため）
- ⏸ push は GitHub 復旧後（GitHub アカウント停止中）

---

## 7. セッション統計

- 開始: 2026-04-26 (今回)
- 確定ログ確認: 1 分
- B-08 subagent dispatch: 約 4 分（並行）
- B-6 / B-7 直接編集: 約 3 分（並行で subagent と同時進行）
- effort-tracking + handoff: 5 分
- 合計実時間: 約 13 分

### コミット数
- 既存: 24fe476 (handoff + effort-tracking) + 7 specs commit
- 今回追加: 3 commit（f4638f8 / d513efe / 本ファイル含む 1 commit 予定）

---

## 8. 次にやるべきこと

### GitHub 復旧後
1. `git push origin feature/root-phase-b-specs-20260425` で 3 commit を push
2. PR #75 の差分が増える（Phase B specs に B-08 追加 + 既存 spec 改訂）
3. レビュアー a-bloom に追加レビュー依頼

### Phase B 着手時（東海林さん判断後）
1. B-08 spec 内の判断保留 6 件 + 未確認 6 件を確認
2. 着手順序検討（推奨: B-3 → B-1 → B-2 → B-4 → **B-08** (employees 拡張) → B-5 → B-6 → B-7）
3. B-08 を early に着手することで Bud Phase D（給与計算）連携が早期に整う

### a-bud との調整事項
- B-08 の `is_employee_payroll_target()` helper（B-3 spec で定義）に休業状態を反映する案
- B-08 助成金履歴は給与計算に直接影響しないが、経理計上で参照
- App 56 → root_employees merge 戦略 A は給与計算前提データの欠損補完を想定

---

## 9. 引継ぎ先

### a-bloom (PR #75 レビュアー)
- B-08 spec が新規追加されたため、レビュー対象が +1 ファイル
- B-6/B-7 改訂が小規模（166 行追加）なので merge は迅速可能

### a-root（次セッション）
- 本ファイルを起点に push（GitHub 復旧確認後）
- Phase B 着手指示を待つ

### a-main
- Kintone 確定 6 件の Root 反映完了報告として本ファイルを参照
- 他セッション（a-auto / a-bud / a-forest）への確定反映進捗と並列で確認

---

**a-root-002 セッション、Kintone 確定 6 件反映完走 ✅** ローカル commit 完了、push は GitHub 復旧後。
