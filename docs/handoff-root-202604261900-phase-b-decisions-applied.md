# Handoff: Garden Root Phase B 確定 60 件 + 設計修正 11 件 反映完了（a-root-002 セッション）

- 作成: 2026-04-26 19:00 a-root-002 セッション
- ブランチ: `feature/root-phase-b-decisions-applied`（develop ベース新ブランチ）
- ステータス: **ローカル commit 完了 / push 待機（GitHub 復旧後）**
- 確定ログ: `C:\garden\_shared\decisions\decisions-root-phase-b-20260426-a-main-006.md`（a-main 006 で東海林承認、別途作成予定）
- spec 改訂 follow-up: `C:\garden\_shared\decisions\spec-revision-followups-20260426.md`（既存）

---

## 1. 反映完了 11 件 + 残課題 3 件

| spec | # | 確定内容 | commit | 差分 |
|---|---|---|---|---|
| B-1 | #4 | 槙さん例外（leaf_kanden_module_owner フラグ）→ has_permission_v2() の override 段階で実現 | `fcdd260` | +168/-12 |
| B-2 | #2 | actor_account_name + actor_employee_id 併用、改名履歴テーブル新設 | `fa63954` | +197/-15 |
| B-2 | #4 | before_state / after_state は全フィールド snapshot、差分はクライアント側計算 | (同上) | (同上) |
| B-3 | #1 | 退職日翌日 03:00 JST に Vercel Cron で `is_active=false` 自動切替 | `55aabf9` | +125/-24 |
| B-4 | #1 | 法人マスタ一元（root_business_entities）+ partner_relationships / vendor_relationships 分離 | `eb6d33b` | +231/-55 |
| B-4 | #4 | App 55 申込者・代表者は受注後追加項目（BIZ-11 ルール追加） | (同上) | (同上) |
| B-4 | #8 | 段階的エスカレーション（事務局 Bot → 専用ルーム 30分後 → 東海林 DM 2時間後） | (同上) | (同上) |
| B-5 | #4 | パスワード変更時 D 案: 旧 JWT/refresh revoke + 不正検知ログ + Chatwork 通知 | `d868456` | +129/-1 |
| B-6 | #2 | Email ハイブリッド（業務=Microsoft 365 / トランザクション=Resend）+ DKIM/SPF/DMARC | `0c0751a` | +109/-18 |
| B-7 | #5 | App 38 取引先（partner_relationships）/ 訪問営業（root_employees outsource）分離 | `99e6a19` | +164/-30 |
| B-7 | S-1+OP-3 | staging + truncate / Vercel Cron 5 分間隔 chunk 管理 | (同上) | (同上) |

### 残課題 3 件（spec 内に保留マーク明示）

| spec | # | 残課題 | 状態 |
|---|---|---|---|
| B-4 | 保留 #1 | root_business_entities を Garden Fruit と統合するか独立か | 🔵 要協議 (a-main 経由で東海林さん確認後、本 spec 再改訂) |
| B-7 | 保留 FM-3 | FileMaker DB の正確なスキーマ（実 CSV サンプル）| 🔵 a-main 006 で確認中、後日共有 |
| B-7 | 保留 OP-2 | 移行スケジュール詳細（段階移行 + 業務量増加禁止条件）| 🔵 要協議 |

### 全 spec 共通: §0 確定事項セクション新設

7 spec すべての front-matter 直後・§1 直前に新セクション §0 を追加:
- decisions-root-phase-b-20260426-a-main-006.md（別途作成予定）への参照
- 各 spec 関連の確定事項を表で要約
- 残課題があれば §0 表で明示

---

## 2. 成果物（ローカル先行 7 spec commits + 1 final commit 予定）

### 改訂された 7 spec ファイル

| spec | 改訂後の行数 | 元の行数 | 差分 |
|---|---:|---:|---:|
| B-1 permissions-matrix | 669 | 513 | +156 |
| B-2 audit-log-extension | 856 | 674 | +182 |
| B-3 termination-rules | 574 | 473 | +101 |
| B-4 master-consistency | 615 | 439 | +176 |
| B-5 auth-security | 724 | 596 | +128 |
| B-6 notification-platform | 752 | 661 | +91 |
| B-7 migration-tools | 636 | 502 | +134 |
| **合計** | **4,826** | **3,858** | **+968** |

### 実装見積の更新

| spec | 旧見積 | 新見積 | 差分 | 理由 |
|---|---:|---:|---:|---|
| B-1 | 2.25d | 2.25d | 0 | (変動なし、has_permission_v2 と槙さん例外検証は既存内訳で吸収) |
| B-2 | 1.75d | 2.20d | +0.45 | actor_account_name + name_history テーブル + UI 差分計算追加 |
| B-3 | 0.5d | 0.55d | +0.05 | Vercel Cron 配線追加 |
| B-4 | 1.25d | 1.8d | +0.55 | 3 テーブル分離（root_business_entities + 2 役割テーブル）+ migration |
| B-5 | 2.5d | 2.5d | 0 | (D 案は既存の §3.1 範囲で吸収、新規工数発生なし) |
| B-6 | 2.5d | 2.75d | +0.25 | ハイブリッド構成 (Microsoft + Resend) + DNS 整備 |
| B-7 | 4.0d | 4.5d | +0.5 | chunk 管理テーブル + cron 分割実行 + 進捗 UI |
| **合計** | **14.75d** | **16.55d** | **+1.8d** | |

---

## 3. ブランチ状態

```
* feature/root-phase-b-decisions-applied (ローカル先行 8 commits、未 push)
  fcdd260 docs(root): Phase B-1 spec に §0 + #4 槙さん例外
  fa63954 docs(root): Phase B-2 spec に §0 + actor 2 重化 + 全フィールド diff
  55aabf9 docs(root): Phase B-3 spec に §0 + #1 退職日翌 03:00 cron
  eb6d33b docs(root): Phase B-4 spec に §0 + #1 法人マスタ一元 + #4 + #8
  d868456 docs(root): Phase B-5 spec に §0 + #4 D 案
  0c0751a docs(root): Phase B-6 spec に §0 + #2 ハイブリッド Email
  99e6a19 docs(root): Phase B-7 spec に §0 + #5 App 38 分離 + S-1/OP-3
  + 本 commit (handoff + effort-tracking)
  49ad687 (origin/develop tip)
```

**push 状態**: GitHub アカウント停止中（`remote: Your account is suspended`）。GitHub 復旧後に `git push origin feature/root-phase-b-decisions-applied` 実行予定。

### 既存ブランチとの関係（merge 順序の考慮）

| ブランチ | 状態 | 含まれる commits | merge 順 |
|---|---|---|---|
| `feature/root-phase-b-specs-20260425` | 未 push、PR #75 は merged | Kintone 確定 6 件反映 (3 commits、B-6/B-7 修正) | 1 番目に merge 推奨 |
| `feature/root-permissions-and-help-specs` | 未 push | 新規 spec 2 件 (権限管理 + ヘルプ) + handoff | 2 番目 (独立性高) |
| **`feature/root-phase-b-decisions-applied`** (本ブランチ) | 未 push | 7 spec に §0 + 設計修正 11 件 | 3 番目 |

⚠️ **B-6 / B-7 の conflict 注意**:
- 1 番目のブランチで B-6 §2.5 / B-7 §5.1/§11.5/§11.6 が追加される
- 本ブランチで B-6 §0 / B-7 §0 が追加される
- §0 は冒頭、§2.5/§5.1 は中盤に配置のため **conflict は最小限**
- merge 時に手動でセクション順序確認推奨

---

## 4. 重要な設計判断ハイライト

### B-1 #4 槙さん例外: has_permission_v2() の override 段階で実現

`module_owner_flags` jsonb 列を `root_employees` に追加（例: `{"leaf-kanden": "owner"}`）。`has_permission_v2()` の 3 段階解決の **override 段階で deny を allow に変換**する。outsource ロールでも leaf-kanden に限り manager+ 相当の権限を持つ。

### B-2 #2 actor 二重化: 改名対応 + 不変識別

- `actor_account_name`（その時点のアカウント表示名スナップショット）+ `actor_employee_id`（不変の社員 ID）を併用
- 新規テーブル `root_employee_name_history` で改名履歴管理
- UI 表示時「ログ作成時の名前: 〇〇 → 現在の名前: △△」併記

### B-3 #1 自動切替 cron

- Vercel Cron `0 18 * * *`（03:00 JST = 18:00 UTC 前日）
- 関数 `root_deactivate_terminated_employees()` で `termination_date < CURRENT_DATE` または `contract_end_on < CURRENT_DATE` の従業員を一括非活性化
- 監査ログ + Chatwork 通知（admin ルーム）連携

### B-4 #1 法人マスタ一元: 3 テーブル分離

`root_business_entities`（法人マスタ）+ `partner_relationships`（取引先役割）+ `vendor_relationships`（外注先役割）の 3 テーブル分離。既存 `root_vendors` は段階的に deprecated 化（移行期は view 化で互換維持）。

memory `project_partners_vs_vendors_distinction.md` 準拠。

### B-4 #8 段階的エスカレーション

| 段階 | タイミング | 通知先 |
|---|---|---|
| ① | 即時 | 事務局 Bot（chatwork-jimukyoku） |
| ② | 30 分後（未対応時） | 専用ルーム（chatwork-consistency-alert）+ admin メンション |
| ③ | 2 時間後（未対応時） | 東海林さん DM + super_admin 緊急対応依頼 |

新テーブル `root_consistency_escalation_log` で段階遷移履歴を記録。

### B-5 #4 D 案: パスワード変更時の三本柱

| ① | 旧 JWT/refresh の revoke | `auth.admin.signOut(user_id)` で全 device 強制ログアウト |
| ② | 不正検知ログ | root_login_attempts に `attempt_type='password_changed'` + suspicious 判定 |
| ③ | 管理者通知 | Chatwork critical ルーム、不審判定時は東海林 DM 転送 |

### B-6 #2 Email ハイブリッド構成

| 用途 | プロバイダ | DNS |
|---|---|---|
| 業務メール | Microsoft 365 / Outlook（既存契約）| 既存 DKIM/SPF/DMARC |
| トランザクション | Resend（新規導入）| `notify.hyuaran.com` 新規 DKIM/SPF/DMARC |

- コスト: Microsoft = 既存契約内、Resend = 月 60 通想定で当面無料枠

### B-7 #5 App 38 分離

```typescript
if (kintone.区分 === '法人' || kintone.法人番号) {
  → root_business_entities + partner_relationships
} else {
  → root_employees (employment_type='outsource')
}
```

### B-7 S-1+OP-3 chunk 管理

新テーブル `root_migration_chunks` + Vercel Cron 5 分間隔 + commit 後 staging TRUNCATE。253 万件取込で約 253 chunks 想定。

---

## 5. 制約遵守

- ✅ main / develop 直接 push なし（新ブランチ作成）
- ✅ 実装コードゼロ（spec のみ改訂）
- ✅ 既存 root spec (Kintone 確定 6 件 / 新規 2 spec ブランチ) との conflict 最小化
- ✅ 新規 migration 作成なし（spec 内 SQL 提案のみ）
- ✅ Supabase 本番への書込なし
- ✅ 各 commit メッセージに `[a-root]` タグ含む
- ✅ 残課題 3 件は §0 表に明示 + §15 未確認事項にも記載、停止せず完走
- ⏸ push は GitHub 復旧後

---

## 6. セッション統計

- 起動: 2026-04-26 (前タスク完了後)
- 確定ログ・参照確認: 2 分
- ブランチ作成 + 7 subagent 並列 dispatch: 18:30
- subagent 完了通知 (B-1 → B-3 → B-2 → B-5 → B-6 → B-4 → B-7): 18:36-18:54
- effort-tracking + handoff: 18:54-19:00
- 合計実時間: 約 30 分

### コミット数
- 7 spec commits: fcdd260, fa63954, 55aabf9, eb6d33b, d868456, 0c0751a, 99e6a19
- final commit (本ファイル + effort-tracking): 1 件予定

---

## 7. 次にやるべきこと

### GitHub 復旧後 (push 順序)
1. `git push origin feature/root-phase-b-specs-20260425` (Kintone 確定 6 件、3 commits)
2. `git push origin feature/root-permissions-and-help-specs` (新規 spec 2 件、3 commits)
3. **`git push origin feature/root-phase-b-decisions-applied` (本ブランチ、8 commits)**
4. develop 向け PR 3 本発行（レビュアー a-bloom）
5. merge 順序: 1 → 2 → 3 (または 2 → 1 → 3、conflict 最小)

### 残課題 3 件の解消（東海林さん確認後）
1. **B-4 保留 #1**: root_business_entities を Fruit と統合するか独立か → 確定後 spec 再改訂
2. **B-7 保留 FM-3**: FileMaker 実 CSV サンプル取得 → §5.2 FileMaker mapping 確定
3. **B-7 保留 OP-2**: 移行スケジュール段階定義 → §11 Phase 段階分け に追記

### Phase B 着手指示時
- 着手順序検討（推奨）: B-3 → B-2 → B-1 → B-4 → B-5 → B-6 → B-7
- B-3 は最軽量 (0.55d) で運用効果大
- B-2 は監査基盤、他 spec から参照される
- B-4 は法人マスタ刷新、Bud / Leaf に大きな影響、Fruit 統合判断後着手

---

## 8. 引継ぎ先

### a-bloom (PR レビュアー)
- 3 ブランチ × ~1,000-1,800 行の差分レビュー
- 特に B-4 の法人マスタ 3 テーブル分離設計の妥当性確認
- B-2 actor 二重化 + name_history の運用負荷確認
- B-7 chunk 管理の Vercel Cron 設計妥当性確認

### a-root（次セッション、Phase B 着手指示時）
- 本ファイル + 過去 2 件の handoff（202604261000 / 202604261800）を起点
- 確定ログ decisions-root-phase-b-20260426-a-main-006.md（GitHub 復旧後に共有）も読み込み

### a-main
- Phase B 確定 60 件のうち、本セッションで反映 11 件 + 残課題 3 件
- 60 件のうち残り 46 件は spec への明示的な改訂を要しない（§0 で要約参照）or 他セッションが反映予定

---

**a-root-002 セッション、Phase B spec 改訂完走 ✅**
- 累計成果（本日中の a-root-002 全タスク）:
  - PR #61 (Vitest 拡充、merged 済)
  - PR #75 (Phase B 全 7 spec 起草、merged 済)
  - feature/root-phase-b-specs-20260425 (Kintone 確定 6 件、未 push、PR 未発行)
  - feature/root-permissions-and-help-specs (新規 spec 2 件、未 push、PR 未発行)
  - **feature/root-phase-b-decisions-applied (本ブランチ、未 push、PR 未発行)**
- 4 タスク完走、3 ブランチ push 待機中

GitHub 復旧後、push plan に従って一括処理予定。
