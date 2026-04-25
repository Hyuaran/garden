# 🔍 a-review レビュー — Garden 横断 運用設計 6 件（Batch 15）

## 📋 概要

Phase B-1 着手前の運用基盤 spec 6 件（合計 3,050 行 / 実装見積 3.0d）。監視・アラート / バックアップ・リカバリ / インシデント対応 / リリース手順 / データ保持・アーカイブ / 運用ハンドブック。Garden 全モジュール横断の運用設計、本番投入前の必須インフラ的位置づけ。

## ✅ 良い点

1. **CLAUDE.md §16-§17 ルールの忠実な実装指示書化**: #04 リリース手順が α/β/リリース版 + Tree 特例 5 段階を明記、#04 §3.1 7 種テストチェックリストとして再構成。新モジュール着手時に「ここを見れば必要十分」な仕上がり。
2. **法令根拠付き保持期間表（#05 §2）**: 労基法 109 条 / 法人税法 / 電子帳簿保存法 / 個人情報法を Garden データ別に対応付け。顧問税理士・弁護士確認推奨と明記、判断保留として PR body にも転記。
3. **データ資産分類 + RPO/RTO 明示（#02 §2）**: 致命/重要/通常/軽量の 4 分類で復旧目標を具体化（致命: RPO 5 分・RTO 1h）。Supabase PITR 7d + 日次 pg_dump + 月次 R2 外部 + 月 $27 コスト試算まで含む。
4. **段階導入計画の現実性**: #01 監視は B-1（インフラ + Cron 失敗のみ）→ B-2（Sentry）→ C（業務層）→ D（KPI/SLO）と現状リソースに合わせた展開順序。最初から完璧を求めない設計。
5. **インシデント役割定義（#03 §3）**: IC / Responder / Communicator / Scribe の 4 役 + フェイルオーバー（Sev1 翌朝まで待たず代理 IC）。属人化排除と現実的な待機ルールが両立。
6. **feature_flags テーブル + isFeatureEnabled() ヘルパー（#04 §7）**: rollout_strategy 4 種（all/beta_users/percentage/role）+ ライフサイクル 6 段階 + 月次棚卸しまで含む完成度。Tree の慎重展開や緊急停止に直接利用可能。
7. **Cross History (#47) との連携明示**: #02 §1.3 / #05 §1.3 で「論理削除復元 UI は Cross History」「履歴の改ざん防止は spec-cross-audit-log」と参照。spec 間の責務境界が明確。

## 🔴 / 🟡 / 🟢 指摘事項

### 🔴 #02 §3.4 月次外部コピー先（Cloudflare R2）が新規外部依存

「月初に最新の `pg_dump` を外部 S3 互換 Storage（Cloudflare R2 等）にコピー」（L107）。**Cloudflare R2 アカウント開設・IAM 設定・Garden への接続情報埋込が前提だが、CLAUDE.md「新規 npm パッケージ追加は事前相談」の精神では新規外部サービス契約も承認事項**。

→ #02 §10 コスト試算「月 $27」に R2 含むなら明記、含まないなら別途承認フロー記載要。判断保留に「外部 Storage の選択（R2 / S3 / Supabase Storage 内同一プロジェクト分離）」を追加すべき。

### 🔴 #02 §3.2 pg_dump コマンドに DB password 必須なのに spec で言及なし

```bash
pg_dump --host=db.xxx.supabase.co --username=postgres --no-owner ...
```
**`PGPASSWORD` 環境変数 or `.pgpass` ファイル設定が必須**。Vercel Cron で実行する場合の安全な認証情報注入が spec で未記述。Supabase 標準では `service_role` キー経由は pg_dump できないため、専用 DB ユーザー作成 + 権限制御の手順が必要。

→ Supabase の **Database Password**（Settings → Database → Connection string）を Vercel 環境変数に登録する手順を spec に追加。または Supabase Management API 経由の `pg_dump` 代替手段を検討。

### 🔴 #04 §5.3 DB マイグレーションロールバック手順が破壊的

```sql
DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260426';
```
**supabase_migrations.schema_migrations を直接 DELETE するのは Supabase CLI の管理外操作**。次回 `supabase db push` 時に整合性が壊れる、または再実行されてエラー。

→ Supabase 公式推奨は「down migration を新規作成して適用」（migration を消さず、打ち消し migration を追加）。spec を「逆方向 migration を新規作成して `supabase db push`」に修正すべき。memory「品質最優先 / リリース遅延は許容」に従い、ここは慎重に。

### 🔴 #04 §7.1 feature_flags の RLS 設計が未定義

```sql
CREATE TABLE public.feature_flags (...)
```
**RLS ポリシーが spec 内で言及なし**。flag 操作は admin/super_admin 限定のはずだが、業務スコープ全員に SELECT 許可 / 変更は admin+ という階層化が必要。

→ #04 §7.1 直後に RLS ポリシー追加。known-pitfalls #2 の RLS anon 流用予防の観点でも明示要。

### 🟡 #01 §5.1 monitoring_events に `deleted_at` がない

「Garden 全モジュール削除パターン」（memory）では論理削除統一だが、`monitoring_events` テーブル定義（L127-140）に `deleted_at` カラムなし。**Cross History #04（PR #47）との整合性が取れていない**。

→ 解決策 2 つ:
- (a) monitoring_events は「INSERT only / 改ざん不可」として `deleted_at` を意図的に持たない設計（その場合 §5.1 にコメントで明記）
- (b) 統一規格に従い `deleted_at` を追加

#02 監視テーブルの spec の意図は「resolved_at で完了管理 + ログとして保管」と読めるので (a) が正解と推測。**spec にその設計意図を明記**すべき。

### 🟡 #03 §3.1 IC 既定が「東海林さん」一点集中

「既定: 東海林さん」（L93）はリーダー確定だが、**東海林さん不在時の Sev1 対応「super_admin の最初に応答した者」が暫定的すぎる**。フェイルオーバー連絡網（電話番号・連絡優先順）を `docs/runbooks/incident-contacts.md` に確定し、本 spec から参照リンクを追加すべき。

### 🟡 #04 §4.3 リリース時刻ルールの矛盾

- 「Bud: 平日 9:00〜17:00 を避け、夕方〜翌朝に投入」
- 「Tree: 平日朝 9:00 前 or 土曜朝（FileMaker 並行運用）」
- 「Root（認証）: 全社利用なし時間帯（早朝 6:00 前）」

**早朝 6:00 前のリリースは東海林さん 1 人で承認・観察するため、§9 リリース承認 + §6 観察期間（24h）と非現実的に競合**。Sev1 観察 1h は 5 分粒度で即時対応必須。

→ 現実解として「平日 18:00 以降 + 夜間自動観察 (alerting)」または「土曜午前」に統一推奨。判断保留に追加。

### 🟡 #05 §3.3 通話録音の保持「録音 30 日」が短すぎる懸念

Tree モジュールの通話録音 = 「録音 30 日 → Archived 60 日」=合計 **90 日で物理削除**（§3.3）。**労基法・コンプライアンス・トラブル時の証拠としての 90 日は短い場合がある**（クレーム対応の 90 日経過後に発覚するケース）。

→ Tree 現場（コールセンター）の慣行を確認、判断保留として明示推奨。memory「品質最優先」観点で慎重に。

### 🟡 #02 §4.3 Storage rsync 差分バックアップの所要時間と帯域考慮なし

「日次差分バックアップ」（L141-146）だが、Storage バケット容量が 100GB 超えた時の rsync 完了時間 / Vercel Function timeout（10s〜300s）との関係が未記述。

→ 大型バケット（forest-tax-files / tree-call-records）は **Supabase Edge Function or 外部 worker（Cloudflare Workers / GitHub Actions Cron）で実行**する手順を別途明記すべき。

### 🟢 #01 §3.2 Vercel アラート閾値「5xx エラー率 連続 5 分 1% 超」のキャリブレーション

初期値としては妥当だが、ユーザー数が少ない初期段階では 1% は 1 件のエラーで超過する。**段階的にキャリブレーション**することを spec に明記推奨。

### 🟢 #06 運用ハンドブックの定期作業（日 4・週 6・月 8・四半期 5・年 7）

詳細未確認だが、CLAUDE.md §14 許可リスト棚卸し（週次）/ feature_flags 棚卸し（月次）/ permission レビュー（月次）等との重複・統合が `runbook` 全体で取れているか別途確認推奨。

## 📚 横断整合チェック

### known-pitfalls.md との整合
- ✅ #1 timestamptz 空文字: `monitoring_events` の `notified_at`/`resolved_at` は nullable timestamptz で正しい
- ⚠️ **#2 RLS anon 流用**: `feature_flags` テーブルの RLS 未定義（指摘済）、`monitoring_events` も同様に確認要
- ✅ #5 Vercel Cron + Fixie: #02 §3.2 pg_dump で Vercel Cron 実行記述あり、Fixie 経由が必要かは要確認（Supabase は IP 制限なしのはず）
- ✅ 既存 pitfall を spec で予防している箇所は概ね整合

### 既存 spec / CLAUDE.md との矛盾
- ✅ §16 リリース前バグ確認 / §17 現場フィードバック運用 / §18 構築優先順位 と整合（#04 が明示参照）
- ⚠️ Cross History (#47) との `deleted_at` 統一規格 vs `monitoring_events` の整合性（指摘済）
- ✅ §13 自律実行モード との整合（#01 §1.2 で「Cron 失敗時 Webhook」明示）

### memory ルールとの整合
- ⚠️ **削除パターン**: monitoring_events の deleted_at 不在の意図を spec 内で明記要（指摘済）
- ✅ **権限ポリシー設定変更可能設計**: feature_flags の rollout_strategy が「role」を含み、root_settings 連動は容易
- ✅ **品質最優先**: 法令根拠付き保持期間 / RPO/RTO 明確化 / DR 訓練年 2 回 / コスト試算明示 → 妥協なし
- ✅ **Chatwork Bot ownership**: #01 §6 で Bot 所有が a-rill である前提を踏まえた通知経路設計

## 🚦 判定

**REQUEST CHANGES（軽度）**

理由（マージ前修正推奨）:
1. 🔴 #02 §3.2 pg_dump 認証情報注入手順を spec に追加（PGPASSWORD or 専用 DB ユーザー）
2. 🔴 #02 §3.4 R2 等の外部依存承認フローを明記、コスト試算範囲を確認
3. 🔴 #04 §5.3 DB マイグレーションロールバック手順を「打ち消し migration 新規作成」方式に修正
4. 🔴 #04 §7.1 feature_flags の RLS ポリシーを spec に追加
5. 🟡 #01 §5.1 / #02 monitoring_events 系の `deleted_at` 不在の設計意図を明記（Cross History 統一規格との関係）
6. 🟡 #03 §3.1 IC フェイルオーバー連絡網を別ファイル化、本 spec から参照
7. 🟡 #04 §4.3 リリース時刻ルールの夜間 vs 24h 観察の整合性を再確認

これらは spec の致命的欠陥ではなく、**Phase B-1 着手の前段階で整えるべき詳細補強**。網羅性 / 法令根拠 / 段階導入計画の現実性は高水準。修正後 LGTM が容易。

なお運用 spec として「Phase B-1 着手前の前提資料」と位置づけられているため、**#04 リリース手順だけは先行して develop merge → α 運用テスト**して検証するのが安全（実装即着手すべき監視 #01 と並行で）。

---
🤖 a-review (PR レビュー専属セッション) by Claude Opus 4.7 (1M context)
