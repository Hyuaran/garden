# Handoff: Garden Root Phase B 全 spec 起草完了（a-root-002 セッション）

- 作成: 2026-04-25 23:10 a-root-002 セッション（auto モード稼働、能動 + 受動ハイブリッド）
- ブランチ: `feature/root-phase-b-specs-20260425`（origin/develop 起点、b10ab6f）
- ステータス: **PR 発行待ち / レビュアー a-bloom 想定**
- 8コミット、Phase B 全 7 spec 起草完了（実装 0、spec のみ）

---

## 1. 稼働サマリ

### 発動経緯
- 前タスク（Phase 品質向上、PR #61）merge 後、a-main から「Phase B 全 spec 起草（auto 推奨型）」指示
- 東海林さん「ガンガン進めよう」方針、待機継続せず能動着手
- subagent-driven-development を活用、7 spec を並列起草

### 実施したタスク（7 spec、全て develop 取込待ち）

| Task | 内容 | 行数 | 実装見積 | 判断保留 | commit |
|---|---|---:|---:|---:|---|
| B-1 | 権限詳細設計（root_settings + 8ロール×機能マトリックス）| 513 | 2.25d | 8 | `b6d3ebc` |
| B-2 | 監査ログ拡張（root_audit_log + 9モジュール横断）| 674 | 1.75d | 9 | `2ba58cb` |
| B-3 | 退職者扱い運用ルール（termination/contract_end/deleted_at）| 473 | 0.5d | 7 | `68be35f` |
| B-4 | マスタ間整合チェック（root_employees/vendors/companies 等）| 439 | 1.25d | 10 | `6ae6327` |
| B-5 | 認証セキュリティ強化（パス再発行 / 2FA / セッション / brute force）| 596 | 2.5d | 7 | `1e8ffef` |
| B-6 | 通知基盤（Chatwork / Email 統合）| 661 | 2.5d | 6 | `b1f7382` |
| B-7 | 移行ツール（Kintone / FileMaker 取り込み）| 502 | 4.0d | 14 | `2601813` |
| **合計** | | **3,858** | **14.75d** | **61** | |

### 並列起草の効果

- 7 subagent を **同時** dispatch（sonnet 全件）
- 約 10 分で全件完了（1 件あたり 4-9 分、最長 B-5 = 9 分）
- 直列だと約 50-60 分相当の作業を 10 分で完走
- 各 subagent は独立した spec ファイルへの書込のため衝突なし

### 受動タスク

- 限定 auto モード期間中、Bud / Leaf / Tree から Root への参照要請は **ゼロ**
- `docs/handoff-root-YYYYMMDDHHMM.md` 形式の追記対象なし

---

## 2. 整備された資産（PR でレビュー対象）

### docs/specs/ に追加された 7 ファイル

```
docs/specs/2026-04-25-root-phase-b-01-permissions-matrix.md      # B-1 権限詳細設計
docs/specs/2026-04-25-root-phase-b-02-audit-log-extension.md     # B-2 監査ログ拡張
docs/specs/2026-04-25-root-phase-b-03-termination-rules.md       # B-3 退職者扱い運用ルール
docs/specs/2026-04-25-root-phase-b-04-master-consistency.md      # B-4 マスタ間整合チェック
docs/specs/2026-04-25-root-phase-b-05-auth-security.md           # B-5 認証セキュリティ強化
docs/specs/2026-04-25-root-phase-b-06-notification-platform.md   # B-6 通知基盤
docs/specs/2026-04-25-root-phase-b-07-migration-tools.md         # B-7 移行ツール
```

各 spec の標準セクション（Bud A-08 形式 mirror）:
1. 目的とスコープ
2. 既存実装との関係
3. データモデル提案（SQL 案、ALTER 案）
4. データフロー（mermaid あり）
5. API / Server Action 契約
6. RLS ポリシー
7. **a-bud / a-leaf / a-tree との連携ポイント**
8. 監査ログ要件
9. UX / バリデーション
10. 受入基準（チェックリスト）
11. 想定工数（内訳、0.25d 刻み）
12. 判断保留
13. 未確認事項

### docs/effort-tracking.md 更新

- Phase B 起草行（実績 0.6d / 見積 1.0d）+ B-1〜B-7 実装 7 行（実績未記入、Phase B 着手時に充填）

---

## 3. 主要な設計判断（spec 横断ハイライト）

### B-1 権限詳細設計
- **三項 PK**: (module, feature, role) → permission（'allowed' / 'denied' / 'readonly'）
- **後方互換**: root_settings に登録なし → 既存 SQL 関数 fallback
- **outsource ロール**: Phase A-3-g で staff と manager の間に追加済を明示、8 ロール固定
- **マトリックスエディタ**: super_admin 専用 UI、変更は AFTER trigger で root_audit_log 自動記録

### B-2 監査ログ拡張
- 既存 root_audit_log（10 カラム）への **ALTER 拡張** のみ（DROP 一切なし）
- 新カラム: occurred_at / actor_role / module / entity_type / entity_id / before_state / after_state / diff_summary / severity / request_id / source
- **CI チェック**: 金銭・人事 Server Action に writeAudit() がないと CI 失敗
- 横断 spec `cross-cutting/spec-cross-audit-log.md` との役割分担を明示

### B-3 退職者扱い運用ルール
- 既存 `is_user_active()` の **deleted_at IS NULL 漏れ** を発見、修正案を spec 内で提示
- 新 helper 2 本: `is_employee_payroll_target()` (Bud 給与計算用) / `get_nencho_targets()` (年末調整用)
- 状態定義 10 パターンの組合せマトリックスで網羅
- known-pitfalls #8 の deleted_at vs is_active を実装ルールに昇格

### B-4 マスタ間整合チェック
- 整合性ルール 20 件（参照 6 / 状態 8 / 業務 10）を REF/STA/BIZ プレフィックスで分類
- root_consistency_violations + root_consistency_check_log の 2 テーブル + cron 配線
- **root_partners**: 現状 root_vendors のみ存在 → 別名仮定で進行、東海林さん要ヒアリング
- assertVendorActive() 等の utility を Root 側から Bud/Leaf に提供

### B-5 認証セキュリティ強化
- 4 サブテーマ（パスワード / 2FA / セッション / brute force）を統合
- Supabase Auth MFA（TOTP）採用、root_user_2fa は補助情報のみ
- root_login_attempts でブルートフォース対策、IP 単位レート制限
- zxcvbn npm 追加が判断保留 → a-main 承認後に確定
- **共用 PC（Tree 端末）運用が最大の判断保留**

### B-6 通知基盤
- 3 段階移行（B-6.1 Chatwork のみ → B-6.2 購読 DB 駆動 → B-6.3 Email 統合）
- root_notification_channels / subscriptions / log の 3 テーブル
- **Bloom 既存 Chatwork 基盤の Root 移管** が判1（東海林さん判断）
- Email プロバイダ未確定（Resend / SendGrid / Vercel）

### B-7 移行ツール
- 5 段階（B-7.1 基盤 → B-7.2 Kintone → B-7.3 FileMaker → B-7.4 関電業務委託 → B-7.5 営業リスト 253 万件）
- root_migration_batches / staging / log の 3 テーブル + rollback 24h
- Kintone は kot-api.ts パターン流用、FileMaker は csv-parse.ts + SJIS 変換
- **大量データ chunk 分割** （10,000 行/chunk）+ progress UI

---

## 4. 全 spec 共通の「東海林さん要ヒアリング」事項

### 業務判断（Phase B 着手前に必要）

| # | 質問 | 関連 spec |
|---|---|---|
| Q1 | 機能ごとの権限マトリックス初期値（特に outsource の編集権限）| B-1 |
| Q2 | 給与改定の権限（admin のみ / manager にも委譲）| B-1 |
| Q3 | 中途退職者の扱い（業務クエリから除外する範囲）| B-3 |
| Q4 | root_partners という概念（root_vendors と別か同じか）| B-4 |
| Q5 | 2FA 必須化のタイミング（Phase B 内 vs C 以降）| B-5 |
| Q6 | 共用 PC（Tree 端末）での 2FA 運用方針 | B-5 |
| Q7 | Email プロバイダ選定（既存契約の有無）| B-6 |
| Q8 | Bloom Chatwork 基盤を Root に移管するか | B-6 |
| Q9 | Kintone API トークンの権限スコープ | B-7 |
| Q10 | FileMaker からの export 自動化（手動 vs ODBC）| B-7 |
| Q11 | 移行スケジュール（一括 vs 段階）| B-7 |

### 技術判断（実装段階で必要）

| # | 質問 | 関連 spec |
|---|---|---|
| T1 | zxcvbn npm パッケージ追加承認 | B-5 |
| T2 | audit_id を bigserial → uuid 移行するか | B-2 |
| T3 | Chatwork レート制限への対応方針 | B-6 |
| T4 | 大量データ取込の worker / streaming 採用 | B-7 |

合計 **未確認事項 36 件** はそれぞれの spec 末尾の §13 に記載。

---

## 5. 次にやるべきこと

### 即時（PR レビュー後）
1. **PR 発行 → develop 取込み**
   - `feature/root-phase-b-specs-20260425` → `develop` の PR 作成
   - レビュアー: a-bloom（a-root セッションが現在 idle のため）
   - spec のみなので merge は迅速可能

### Phase B 着手前（東海林さん判断）
1. 上記 Q1-Q11（業務判断 11 件）への回答
2. T1-T4（技術判断 4 件）の方針決定
3. 着手順序の確定（推奨: B-3 退職者ルール → B-1 権限 → B-2 監査 → B-4 整合 → B-5 認証 → B-6 通知 → B-7 移行）

### Phase B 実装着手時
1. 各 spec の §11 想定工数 内訳に従い実装
2. effort-tracking.md の対応行に実績を充填
3. spec の §12 判断保留 を実装直前に再確認、未解決ならブロッカー化

---

## 6. 開発インフラ・運用メモ

### 検証コマンド（spec フェーズなので最小）
```bash
git status
git log --oneline -10
ls docs/specs/2026-04-25-root-phase-b-*.md
wc -l docs/specs/2026-04-25-root-phase-b-*.md
```

### 並列 subagent 活用統計
- implementer dispatch: 7 回（B-1〜B-7、全 sonnet 並列）
- code-reviewer dispatch: 0 回（spec のため省略、PR レビュー時に a-bloom が一括確認）
- 平均 dispatch 時間: 約 4-9 分（並列実行のため total 約 10 分）
- 合計実時間: 約 30 分（context 把握 5 分 + 並列 dispatch 10 分 + 統合 + handoff 15 分）

### 限定 auto モード遵守事項
- ✅ main / develop 直接 push なし
- ✅ 実装コードの修正なし（spec のみ）
- ✅ 既存 schema への破壊的変更提案なし（拡張のみ）
- ✅ 新規 migration 作成なし（B-1/B-2/B-3 等の SQL は spec 提案のみ）
- ✅ Supabase 本番への書込なし
- ✅ 受動要請ゼロ（Bud / Leaf / Tree からの参照要請なし）

---

## 7. セッション統計

- 起動: 2026-04-25 17:00 頃（a-root-002 として）
- Phase A-3 完走報告: 17:18
- 限定 auto モード（テスト拡充）: 17:18 - 17:50（約 30 分、PR #61）
- Phase B spec 起草着手: 22:30 頃
- Phase B spec 完走: 23:10
- 累計セッション稼働: 約 90 分（5 時間枠の 30%）
- 起点: develop tip `b10ab6f` (2026-04-25)
- コミット数: 7 (spec のみ、handoff/effort-tracking 別 commit で +1)

---

## 8. 引継ぎ先

### a-bloom（PR レビュアー）
- 7 spec の構造一貫性、判断保留事項の明示性、連携ポイントの妥当性をレビュー
- 特に a-bud / a-leaf / a-tree への影響箇所が現実的か確認
- spec 自体の merge は迅速可能（実装ゼロのため）

### a-root（次セッション、Phase B 着手指示時）
- 本ファイル（`docs/handoff-root-202604252310-phase-b-specs.md`）を起点に Phase B 着手
- 推奨着手順序: B-3 → B-1 → B-2 → B-4 → B-5 → B-6 → B-7
- 各 spec 着手時、§12 判断保留 と §13 未確認事項を東海林さんに確認

### a-main
- ユーザー復帰時、本ハンドオフを起点に PR レビュー / merge / 次 Phase 着手判断
- 上記 Q1-Q11（業務判断 11 件）を東海林さんに確認、回答を spec 内に追記

---

**a-root-002 セッション、Phase B spec 起草完走 🎉**
- 累計成果: PR #61 (品質向上) + Phase B spec PR (今回) = 2 PR
- Phase B 実装見積合計 14.75d、Garden 全体の Phase B 規模感を可視化
- 次は東海林さん判断 → Phase B 段階着手
