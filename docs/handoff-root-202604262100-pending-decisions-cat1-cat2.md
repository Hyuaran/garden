# Handoff: Garden Root 33 件判断保留消化 Cat 1 + Cat 2 反映完了（a-root-002 セッション）

- 作成: 2026-04-26 21:00 a-root-002 セッション
- ブランチ: `feature/root-pending-decisions-applied-20260426`（**`feature/root-permissions-and-help-specs` ベース**、ヘルプ spec が必要なため）
- ステータス: **ローカル commit 完了 / push 待機（GitHub 復旧後）**
- 確定ログ: `C:\garden\_shared\decisions\decisions-pending-batch-20260426.md`（実在）

---

## 1. 反映完了 15 件

### Cat 1: Root 権限管理（8 件、表現訂正後 全件 OK）

| # | 確定 | 内容 | 反映先 |
|---|---|---|---|
| 1 | A | 権限変更画面の操作権限 = super_admin（東海林さん本人）のみ | B-01 §3 / §6 / §7 |
| 2 | A | 削除ロックの変更も super_admin のみ | B-01 §3.5 |
| 3 | A | 個別 override = 全モジュールで使用可 | B-01 §3.4 |
| 4 | A | 権限変更は即時反映 | B-01 §6 / §8 |
| 5 | **B** | outsource Leaf 編集 = **既定 denied、案件単位で個別 override** | B-01 §4.3 / §7.2 |
| 6 | A | toss 閲覧 = 自分担当分のみ | B-01 §4.4 / §7.3 |
| 7 | A | 申請承認 = 削除系・権限変更のみ承認必須 | B-01 §10.5 |
| 8 | A | 緊急時超過権限 = super_admin が手動でワンタイムキー発行 | B-01 §11 新設 |

### Cat 2: ヘルプモジュール（7 件、2 件修正 + 5 件 OK）

| # | 確定 | 内容 | 反映先 |
|---|---|---|---|
| 9 | C | ヘルプ配置 = ハイブリッド（独立 `/help` + 各モジュール `/<module>/help`）| ヘルプ spec §0 |
| **10** | **修正** | ヘルプ編集権限 = **誰も直接編集しない**、責任者以上はコメント追加レベルのみ、編集は「開発者依頼ボタン」経由で東海林さんに集約 | ヘルプ spec §3 / §6 / §7 / §8 大幅変更 |
| 11 | A | 検索 = Postgres FTS（外部サービス不要）| ヘルプ spec §10 |
| 12 | A | 動画 = Supabase Storage | ヘルプ spec §11 |
| 13 | A | 多言語 = 当面日本語、将来 i18n 構造のみ準備 | ヘルプ spec §15 判断保留解消 |
| **14** | **拡張** | 問い合わせ送信先 = Chatwork 通知 + Garden 内 開発者ページに一覧集約 | ヘルプ spec §12 + 新規 dev-inbox spec |
| 15 | A | ヘルプ閲覧 = 権限と完全連動 | ヘルプ spec §3 / §8 既存通り |

---

## 2. 重要な設計判断ハイライト

### 「東海林さん」表現統一

- **「社長」表現禁止** → super_admin = **東海林さん本人専任**
- 委託あっても「東海林やっといて」になるのが運用実態
- B-01 spec §0 / §1 / §11 などで明示
- memory `project_super_admin_operation.md`（新規）参照

### Cat 1 #5: outsource Leaf 編集の厳格化

既存設計で槙さん例外を `module_owner_flags = {"leaf-kanden": "owner"}` で全件編集可としていた箇所を**修正**:

- 既定: outsource ロールは Leaf （関電含む）の編集 = **denied**
- 例外: 必要な案件単位で `root_user_permission_overrides` に個別 allow を追加
- 案件単位 scope を override に持たせる設計

### Cat 1 #8: 緊急時ワンタイムキー（新規機能）

`root_emergency_keys` テーブル + `has_permission_v2()` の **0 段階目（最優先）** で判定。

| 用途 | 例 |
|---|---|
| admin 不在時の振込承認 | super_admin が経理担当に 24h キー発行 |
| 障害対応 | 通常権限外のテーブルアクセス |
| 監査 | 外部監査人に一時閲覧権限 |

- 発行は super_admin（東海林さん本人）のみ、2FA 再認証必須
- 全発行・使用・revoke が監査ログに記録

### Cat 2 #10: ヘルプ編集禁止化（最重要修正）

**誰も直接編集しない**設計に変更:

- admin / manager / super_admin 含めて記事の直接編集は不可
- 責任者以上（manager+）は `root_help_article_comments` でコメント追加のみ可
- 改善・修正提案は「開発者依頼ボタン」→ `root_help_article_change_requests` 経由で東海林さんに集約
- 編集 UI `/admin/help/edit/[article_id]` は **東海林さん専任**
- 理由: ヘルプ品質管理の分散防止、東海林さんが追える状態を維持

### Cat 2 #14: Chatwork + 開発者ページ 2 経路通知

```
社員がヘルプから「分からない」「修正してほしい」を送信
   ↓ ① Chatwork 事務局ルームに通知（休日・離席時用）
   ↓ ② Garden 内 開発者ページ /admin/dev-inbox に「未消化リスト」登録
   ↓
東海林さんが作業時、開発者ページの一覧で 1 件ずつ消化
```

新規 spec `2026-04-26-root-developer-inbox.md` を起草:
- Phase A-B は Chatwork のみ運用、Phase C-D で本格実装
- root_developer_inbox_items + comments + status_log の 3 テーブル
- ヘルプ依頼 (root_help_article_change_requests) との **統合 view** で一覧
- 東海林さん専任の消化 UX（キーボードショートカット、urgent ピン留め、24h 警告色）

---

## 3. 成果物

### 改訂・新規 spec（合計 +1,486 行）

| spec | 種類 | 行数 | 差分 | commit |
|---|---|---:|---:|---|
| 2026-04-25-root-phase-b-01-permissions-matrix.md | 改訂 | 754 | +257/-16 | `19b617c` |
| 2026-04-26-root-help-module.md | 改訂 | 1,131 | +454/-151 | `f52633f` |
| 2026-04-26-root-developer-inbox.md | **新規** | 775 | +775/-0 | `770a3bf` |
| **合計** | | **2,660** | **+1,486 / -167** | |

### 実装見積の更新

| spec | 旧見積 | 新見積 | 差分 | 理由 |
|---|---:|---:|---:|---|
| B-01 (root_settings + UI) | 2.25d | 2.5d | +0.25d | ワンタイムキー機能 (#8) 追加 |
| ヘルプモジュール | 2.5d | 3.0d | +0.5d | コメント + 開発者依頼テーブル + UI 拡張 |
| dev-inbox（新規） | — | 2.25d | +2.25d | 新規 spec、Phase C-D 着手 |
| **合計実装増分** | | | **+3.0d** | |

### docs

- `docs/effort-tracking.md`: 反映タスク行 (実績 0.7d) + 実装見積 3 行追記
- `docs/handoff-root-202604262100-pending-decisions-cat1-cat2.md`（本ファイル）

---

## 4. ブランチ状態

```
* feature/root-pending-decisions-applied-20260426 (本ブランチ、ローカル先行 4 commits)
  770a3bf docs(root): Garden 内 開発者ページ spec 起草 (/admin/dev-inbox)
  f52633f docs(root): ヘルプ spec に Cat 2 全 7 件
  19b617c docs(root): Phase B-01 spec に Cat 1 全 8 件 + 「東海林さん」表現統一
  + final commit (handoff + effort-tracking、本ファイル含む 1 commit 予定)
  ↑
  feature/root-permissions-and-help-specs (3 commits ahead of develop, 未 push)
  ↑
  origin/develop (49ad687)
```

**push 状態**: GitHub アカウント停止中（`remote: Your account is suspended`）。GitHub 復旧後に `git push origin feature/root-pending-decisions-applied-20260426` 実行予定。

### 既存未 push ブランチとの関係

| ブランチ | base | commit 数 | merge 順推奨 |
|---|---|---:|---|
| `feature/root-phase-b-specs-20260425` | develop | 3 (Kintone 確定 6 件) | 1 |
| `feature/root-permissions-and-help-specs` | develop | 3 (新規 spec 2 件) | 2 |
| `feature/root-phase-b-decisions-applied` | develop | 8 (Phase B 確定 60 件) | 3 |
| **`feature/root-pending-decisions-applied-20260426`** | help-specs | 4 (本ブランチ、Cat 1+2) | 4 |

⚠️ 本ブランチは `feature/root-permissions-and-help-specs` に依存（ヘルプ spec が必要）。

merge 順序を厳守すれば conflict 最小:
1. 1 → develop merge
2. 2 → develop merge（独立性高）
3. 3 → develop merge（B-6/B-7 で 1 と少 conflict 可能性）
4. 4 → develop merge（本ブランチ、help spec を 2 ベースで継承済み）

---

## 5. 制約遵守

- ✅ main / develop 直接 push なし（新ブランチ作成）
- ✅ 実装コードゼロ（spec のみ）
- ✅ 既存 spec との conflict 最小化（ベースを `feature/root-permissions-and-help-specs` に変更してヘルプ spec 整合）
- ✅ 各 commit メッセージに `[a-root]` タグ含む
- ✅ 「社長」表現を「東海林さん」「super_admin（東海林さん本人）」に統一
- ✅ 判断保留が出ず完走（spec 内 §判断保留 で許容パターン）
- ⏸ push は GitHub 復旧後

---

## 6. セッション統計

- 開始: 2026-04-26 (前タスク完了後)
- ブランチ作成 + base 切替: 1 分
- subagent 3 並列 dispatch: 19:30
- 完了通知 (B-01 → ヘルプ → dev-inbox): 19:38-19:46
- effort-tracking + handoff: 19:46-21:00
- 合計実時間: 約 30 分

---

## 7. 次にやるべきこと

### GitHub 復旧後 (push 順序)
1. `git push origin feature/root-phase-b-specs-20260425` (Kintone 確定 6 件)
2. `git push origin feature/root-permissions-and-help-specs` (新規 spec 2 件)
3. `git push origin feature/root-phase-b-decisions-applied` (Phase B 確定 60 件)
4. **`git push origin feature/root-pending-decisions-applied-20260426`** (本ブランチ、Cat 1+2)
5. develop 向け PR 4 本発行（レビュアー a-bloom）

### Phase B / D-E 着手指示時
- B-01 ワンタイムキー (#8) は B-01 本体と同時実装推奨 (+0.25d)
- ヘルプ コメント + 開発者依頼ボタン (#10) はヘルプ本実装と同時 (+0.5d)
- dev-inbox 実装は Phase A-B では行わず、Chatwork のみで運用

### 開発者ページ運用（Phase A-B 中）
- 「開発者依頼ボタン」相当は Chatwork 事務局ルームのみで運用
- 東海林さんが Chatwork で消化、終わったら 「OK」スタンプ等で完了マーク
- Phase C-D 着手時に過去依頼を dev-inbox に一括取込 (handoff)

---

## 8. 引継ぎ先

### a-bloom (PR レビュアー)
- 4 ブランチ × 累計 ~5,000 行の差分レビュー
- 特に Cat 1 #5 outsource Leaf 編集の override 設計妥当性
- Cat 2 #10 ヘルプ編集禁止化の運用負荷確認
- dev-inbox spec の Phase A-B 運用との接続性確認

### a-root（次セッション）
- 本ファイルを起点に push（GitHub 復旧確認後）
- Phase B / D-E 着手指示を待つ

### a-main
- 33 件判断保留消化の Root 担当 15 件反映完了報告として本ファイルを参照
- 他カテゴリ (Cat 3 Tree / Cat 4 Bud / Cat 5 Soil) の進捗と並列で確認
- memory 反映 5 件は本セッション範囲外（a-main 側で実施想定）:
  - `project_super_admin_operation.md`（新規）
  - `project_garden_help_module.md`（更新）
  - `project_garden_developer_page.md`（新規）

---

**a-root-002 セッション、Cat 1 + Cat 2 反映完走 ✅** ローカル commit 完了、push は GitHub 復旧後。

### 累計成果（本日中の a-root-002 全タスク）
- PR #61 (Vitest 拡充、merged 済)
- PR #75 (Phase B 全 7 spec 起草、merged 済)
- feature/root-phase-b-specs-20260425 (Kintone 確定 6 件、未 push)
- feature/root-permissions-and-help-specs (新規 spec 2 件、未 push)
- feature/root-phase-b-decisions-applied (Phase B 確定 60 件、未 push)
- **feature/root-pending-decisions-applied-20260426 (本ブランチ、Cat 1+2 + dev-inbox、未 push)**

5 タスク完走、4 ブランチ push 待機中。
