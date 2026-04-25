# Cross Ops #04: Garden 全体 リリース手順設計

- 対象: Garden 全モジュールの本番リリース／ロールバック／feature flag 運用
- 優先度: **🔴 高**（リリース信頼性、業務無停止）
- 見積: **0.5d**
- 担当セッション: a-main + 各モジュール
- 作成: 2026-04-26（a-auto 003 / Batch 15 Cross Ops #04）
- 前提:
  - §16 リリース前バグ確認ルール（7 種テスト）
  - §17 現場フィードバック運用ルール（α / β / リリース版）
  - §18 Garden 構築優先順位（Tree は最慎重）
  - Cross Ops #01〜03（監視 / バックアップ / インシデント）

---

## 1. 目的とスコープ

### 1.1 目的

Garden の各モジュールを**段階的かつ安全に本番投入**するため、リリース前検査からデプロイ・観察・ロールバックまでの**標準手順**を定義する。Tree（コールセンター）特例を含み、業務影響を最小化する。

### 1.2 含めるもの

- α / β / リリース版の段階展開フロー（§17 詳細化）
- リリース前チェックリスト（§16 7 種テスト統合）
- デプロイ手順（develop → main / Vercel）
- ロールバック手順（複数粒度）
- feature flag 運用方針
- リリースノート / 利用者通知

### 1.3 含めないもの

- 監視・アラート → #01
- バックアップ・リカバリ → #02
- インシデント対応 → #03
- データ保持・アーカイブ → #05

---

## 2. リリース段階の全体像

### 2.1 3 段階の定義（§17 準拠）

| 段階 | 対象 | 期間 | 目的 |
|---|---|---|---|
| **α版** | 東海林さん 1 名 | 即時〜 | 機能完成時の即時確認、修正即反映 |
| **β版** | 3〜5 名（信頼できるスタッフ）| 1〜2 週間 | 実業務試用、フィードバック収集、修正 |
| **リリース版** | 全社 | 段階展開後 | 運用開始、機能拡張 |

### 2.2 Tree 特例（§17）

Tree（架電アプリ、FileMaker 稼働中）は**5 段階で慎重展開**:

1. α版: 東海林さん 1 名（§16 7 種テスト完走後）
2. 1 人現場テスト: コールセンター 1 名 / 1 週間
3. 2〜3 名テスト: 1 週間
4. 半数テスト: 1〜2 週間
5. 全員投入: FileMaker 切替

### 2.3 モジュール別の厳格度（§16 準拠）

| モジュール | 厳格度 | 必須テスト |
|---|---|---|
| **Tree** | 🔴 最厳格 | 7 種完走 + 1 週間ベータ運用 |
| **Bud** | 🔴 厳格 | 金額・振込系のエッジケース必須 |
| **Root** | 🔴 厳格 | 権限テスト、セキュリティ重視 |
| **Leaf** | 🟡 通常 | データ整合性重視 |
| **Forest / Bloom / Rill** | 🟡 通常 | 標準 |

---

## 3. リリース前チェックリスト

### 3.1 7 種テスト（§16）の統合

- [ ] **機能網羅テスト**: 全ボタン・全リンク・全入力パターン
- [ ] **エッジケーステスト**: 空入力 / 極大入力 / 特殊文字 / 絵文字 / マルチバイト
- [ ] **権限テスト**: 7 段階ロール別アクセス範囲
- [ ] **データ境界テスト**: NULL / 負数 / 文字列最大長 / 日付境界
- [ ] **パフォーマンス計測**: ページロード時間 / API 応答時間
- [ ] **コンソールエラー監視**: Console のエラー・警告
- [ ] **アクセシビリティ確認**: axe-core / Lighthouse スコア

成果物: `docs/pre-release-test-YYYYMMDD-<module>.md`

### 3.2 横断的チェック

- [ ] 全テストが develop で green（CI 通過）
- [ ] TypeScript / ESLint エラー 0
- [ ] Bundle size 警告 0（Next.js Build 出力）
- [ ] 環境変数チェック（`.env.local` の必須キーを `.env.example` と diff）
- [ ] DB マイグレーション: develop で実行確認、ロールバック手順記載
- [ ] RLS 影響: 関連テーブル変更があれば spec-cross-rls-audit に追記
- [ ] 監査ログ: 新規操作で `operation_logs` 記録漏れなし
- [ ] 既存機能の回帰テスト（少なくとも主要パス）

### 3.3 文書整備チェック

- [ ] CHANGELOG 該当モジュール分追記
- [ ] CLAUDE.md / AGENTS.md への影響なし or 更新済
- [ ] known-pitfalls 追加事項あれば反映済
- [ ] リリースノート（利用者向け短文）作成済

### 3.4 コミュニケーションチェック

- [ ] 影響モジュール担当に Chatwork 通知済
- [ ] β 期間中なら β 利用者に変更点通知済
- [ ] 本番投入時刻（業務閑散時）の合意

---

## 4. ブランチ戦略とデプロイフロー

### 4.1 ブランチ構成（§18 準拠）

```
main         ← 本番（自動デプロイ Vercel）
  ↑
develop      ← ステージング（プレビュー Vercel）
  ↑
feature/xxx  ← 各機能ブランチ
```

### 4.2 デプロイフロー

```
[1] feature ブランチで開発
  ↓
[2] PR を develop に対して作成
  ↓
[3] CI 通過 + レビュー（最低 1 名 or auto レビュー）
  ↓
[4] develop へマージ → ステージング自動デプロイ
  ↓
[5] α / β でステージング動作確認
  ↓
[6] §3 リリース前チェックリスト完走
  ↓
[7] develop → main の PR 作成
  ↓
[8] 本番リリース承認（東海林さん）
  ↓
[9] main マージ → 本番自動デプロイ
  ↓
[10] §6 観察期間（4h 〜 24h）
  ↓
[11] 終息確認 or ロールバック判断
```

### 4.3 主要モジュールのリリース時刻ルール

- **金銭処理（Bud）**: 平日 9:00〜17:00 を避け、夕方〜翌朝に投入
- **Tree（架電）**: 平日朝 9:00 前 or 土曜朝（FileMaker 並行運用）
- **Root（認証）**: 全社利用なし時間帯（早朝 6:00 前）
- **その他**: 平日 9:00〜18:00 OK だが、ピーク時間（10:00 / 13:00 / 16:00）は避ける

---

## 5. ロールバック手順

### 5.1 ロールバック粒度

| 粒度 | 対象 | 所要時間 | 適用シナリオ |
|---|---|---|---|
| **Vercel ロールバック** | フロント / API | 30 秒 | デプロイ後すぐの不具合 |
| **DB マイグレーションロールバック** | DB スキーマ | 5〜30 分 | スキーマ変更が原因 |
| **feature flag 無効化** | 特定機能のみ | 即時 | 個別機能のみ問題 |
| **PITR 復元** | DB データ | 1〜2h | データ破壊 / 大量誤更新 |
| **main revert** | コミット単位 | 5 分 | 複数機能の問題 |

### 5.2 Vercel ロールバック

```bash
# 手順 1: Vercel ダッシュボード
# Deployments → 直前の正常デプロイ → "Promote to Production"

# 手順 2: CLI（緊急時）
vercel rollback <previous-deployment-url>
```

**注意**: DB マイグレーション後はロールバックで API がエラーを起こす可能性 → §5.3 を併用

### 5.3 DB マイグレーションロールバック

#### 事前準備

各 migration には**逆方向 SQL**を用意:

```sql
-- supabase/migrations/20260426_add_xxx.sql
-- UP
ALTER TABLE bud_furikomi ADD COLUMN xxx text;

-- DOWN（コメントとして記録）
-- ALTER TABLE bud_furikomi DROP COLUMN xxx;
```

#### 手順

```sql
BEGIN;
  -- DOWN SQL を実行
  ALTER TABLE bud_furikomi DROP COLUMN xxx;
  -- supabase migrations 履歴を整合
  DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260426';
COMMIT;
```

### 5.4 feature flag による即時無効化

- §7 で詳述
- DB レベルで flag を OFF → 即時に該当機能が表示されなくなる

### 5.5 main revert

```bash
git checkout main
git pull origin main
git revert <commit-hash>  # 通常コミット
git revert -m 1 <merge-hash>  # マージコミット
git push origin main
# → Vercel が自動でロールバック相当のデプロイ
```

---

## 6. リリース後の観察期間

### 6.1 観察粒度

| Sev リスク | 観察期間 | 観察頻度 |
|---|---|---|
| Tree / Bud / Root | 24h | 最初 1h は 5 分粒度、以降 30 分粒度 |
| Leaf / Forest | 4h | 30 分粒度 |
| その他 | 1h | 必要時のみ |

### 6.2 観察項目（#01 と連動）

- 5xx エラー率
- API p95 応答時間
- monitoring_events の発生頻度
- ユーザーからの問合せ（Chatwork / 直接）
- 業務 KPI（振込件数 / 給与配信成功率）

### 6.3 ロールバック判断基準

| 状況 | 判断 |
|---|---|
| 5xx 率が連続 5 分 1% 超 | 即時ロールバック |
| 業務影響あり（特定機能停止）| 即時ロールバック |
| 軽微なバグ（操作で回避可）| feature flag で機能無効化 |
| UI の表示崩れ（業務影響なし）| 翌日に hotfix |

---

## 7. feature flag 運用

### 7.1 設計概要

```sql
CREATE TABLE public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  flag_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  rollout_strategy text NOT NULL DEFAULT 'all',
    -- 'all' | 'beta_users' | 'percentage' | 'role'
  rollout_value jsonb,
    -- percentage: { "value": 25 }
    -- role: { "roles": ["admin", "manager"] }
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module, flag_name)
);
```

### 7.2 ヘルパー関数

```typescript
// src/lib/feature-flags/check.ts
export async function isFeatureEnabled(
  module: string,
  flagName: string,
  ctx: { userId?: string; role?: string }
): Promise<boolean> {
  const flag = await fetchFlag(module, flagName);
  if (!flag || !flag.enabled) return false;

  switch (flag.rollout_strategy) {
    case 'all':
      return true;
    case 'beta_users':
      return await isBetaUser(ctx.userId);
    case 'percentage':
      return hashUserId(ctx.userId) % 100 < (flag.rollout_value?.value ?? 0);
    case 'role':
      return (flag.rollout_value?.roles as string[]).includes(ctx.role ?? '');
    default:
      return false;
  }
}
```

### 7.3 利用パターン

#### パターン A: 大型機能の段階公開

```typescript
// src/app/bud/year-end-adjustment/page.tsx
const enabled = await isFeatureEnabled('bud', 'year_end_adjustment_v1', {
  userId: session.user.id,
  role: session.user.role,
});

if (!enabled) {
  return <ComingSoonNotice feature="年末調整" />;
}
```

#### パターン B: A/B テスト

```typescript
const variant = await isFeatureEnabled('tree', 'new_call_ui', { /* ... */ })
  ? 'new'
  : 'old';
```

#### パターン C: 緊急停止

```typescript
// /api/cron/kot-sync の冒頭
const enabled = await isFeatureEnabled('root', 'cron_kot_sync_enabled', {});
if (!enabled) return Response.json({ skipped: true });
```

### 7.4 flag のライフサイクル

| フェーズ | 状態 | 期間目安 |
|---|---|---|
| 1. 実装中 | `enabled=false`, `rollout=all` | 開発期間 |
| 2. α検証 | `enabled=true`, `rollout=role` (admin) | 1 週間 |
| 3. β展開 | `rollout=beta_users` | 1〜2 週間 |
| 4. 段階展開 | `rollout=percentage` (25→50→100) | 1〜2 週間 |
| 5. 全員公開 | `rollout=all` | 安定期間 |
| 6. 削除 | flag を削除、コード分岐除去 | 1 ヶ月後 |

### 7.5 flag 棚卸し

- 月次で `feature_flags` テーブルを棚卸し
- `rollout=all` で 1 ヶ月以上経過した flag は**削除**（コードからも分岐除去）
- 削除しないと flag テーブルがゴミ屋敷化

---

## 8. リリースノート

### 8.1 内部向けリリースノート

`docs/release-notes/YYYY-MM-DD-<module>.md` に記録:

```markdown
# Release Note - 2026-04-26 - Bud Phase A 振込機能

## 新機能
- 振込申請の 6 ステップフォーム
- 承認フロー（manager → admin）
- 領収書 PDF アップロード

## 改善
- 検索画面のレスポンス改善（300ms → 80ms）

## 既知の問題
- IE では PDF プレビューが動かない（推奨ブラウザ: Chrome / Edge）

## 影響範囲
- 経理担当者
- super_admin（承認権限）

## ロールバック手順
- feature flag `bud.furikomi_v1` を OFF
- migration ロールバック: なし（互換性のため revert 不要）
```

### 8.2 利用者向けリリースノート（Chatwork）

```
📢 Garden Bud 振込機能 リリースのお知らせ

本日 18:00 より、Garden Bud に振込機能が公開されました。

【新機能】
- 振込申請の 6 ステップフォーム
- 承認フロー（manager → admin）

【ご利用方法】
Garden トップ → Bud → 振込管理

【ご注意】
- IE では PDF プレビューが動きません。Chrome / Edge をお使いください。
- 不具合がありましたら〇〇までご連絡ください。

引き続きよろしくお願いします。
```

---

## 9. リリース承認フロー

### 9.1 承認権限

| モジュール | 承認者 | 補助 |
|---|---|---|
| Tree | 東海林さん | + コールセンター責任者の合意 |
| Bud（金銭）| 東海林さん | + 経理リーダーの合意 |
| Root（認証）| 東海林さん | — |
| その他 | 東海林さん | — |

### 9.2 承認フロー

```
PR を main に作成
  ↓
リリース前チェックリスト記入（PR 本文）
  ↓
Chatwork で東海林さんに承認依頼
  ↓
東海林さん承認 → main マージ
  ↓
Vercel 自動デプロイ
```

---

## 10. 緊急リリース（Hotfix）

### 10.1 適用シナリオ

- 本番で Sev1 / Sev2 インシデント発生
- 通常フローでは間に合わない

### 10.2 簡略フロー

```
[1] hotfix ブランチを main から派生
  ↓
[2] 修正 + ローカル検証
  ↓
[3] PR を main に直接作成（develop はスキップ）
  ↓
[4] 東海林さん即時承認
  ↓
[5] main マージ → 本番デプロイ
  ↓
[6] 同時に develop にも同コミットを cherry-pick
```

### 10.3 hotfix 後の遅延作業

- ポストモーテム（#03 §8）
- 関連テスト追加
- known-pitfalls 追記

---

## 11. リリース計画ボード

### 11.1 月次リリース計画

`docs/release-plan-YYYYMM.md` に記録:

```markdown
# Release Plan - 2026-05

## 計画リリース
| 日付 | モジュール | 内容 | 段階 | 承認 |
|---|---|---|---|---|
| 2026-05-01 | Bud | 給与計算エンジン | α | 東海林さん |
| 2026-05-08 | Forest | 決算書 ZIP 機能 | β | 東海林さん |
| 2026-05-15 | Tree | パス再発行 UI | α | 東海林さん |

## ブロッカー
- Tree のパス再発行は Root の認証 Phase A 完了待ち

## 完了予定の β 卒業
- Forest 納税カレンダー（2026-04-15 に β 入り → 2026-05-01 卒業予定）
```

### 11.2 release-plan の更新タイミング

- 月初に a-main が起票
- 各モジュール担当が随時更新
- 月末にレトロスペクティブ（計画 vs 実績の比較）

---

## 12. 既知のリスクと対策

### 12.1 develop の長期不安定化

- 多数の feature が同時マージ → 複合バグで動かない
- 対策: develop CI を毎晩実行、失敗時は当日中に修正

### 12.2 main マージ後のすぐの不具合

- リリース直後に不具合発覚
- 対策: 観察期間を必ず確保（§6）、ロールバック手順を即実行可能に

### 12.3 feature flag の剥がし忘れ

- §7.5 で対策

### 12.4 リリースノート作成漏れ

- 対策: PR テンプレートに「Release note: [何か書く / 不要の理由]」を必須化

### 12.5 Tree 投入時の二重運用負荷

- FileMaker と Garden 並行運用は現場負荷大
- 対策: §17 Tree 特例（5 段階）に従い、各段階で**現場満足度をヒアリング**してから次段階

---

## 13. 関連ドキュメント

- `docs/specs/2026-04-26-cross-ops-01-monitoring-alerting.md`
- `docs/specs/2026-04-26-cross-ops-02-backup-recovery.md`
- `docs/specs/2026-04-26-cross-ops-03-incident-response.md`
- `docs/specs/2026-04-26-cross-ops-06-runbook.md`
- `docs/known-pitfalls.md`
- CLAUDE.md §16 §17 §18

---

## 14. 受入基準（Definition of Done）

- [ ] α / β / リリース版の段階定義を CLAUDE.md §17 と整合
- [ ] §3 リリース前チェックリストを `docs/templates/release-checklist.md` に転記
- [ ] feature_flags テーブル + ヘルパー関数 実装済
- [ ] feature flag の月次棚卸しが Cron で動作（or 月初リマインド）
- [ ] release-notes / release-plan のテンプレ配置済
- [ ] hotfix フローを 1 度実演（drill）
- [ ] Tree 特例 5 段階を `docs/runbooks/tree-rollout.md` に詳述
- [ ] ロールバック手順（5 種）を東海林さんが**手順通りに 1 回実施成功**
- [ ] PR テンプレートにリリースノート欄を追加
