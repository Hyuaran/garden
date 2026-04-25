# Cross Ops #06: Garden 全体 運用ハンドブック

- 対象: Garden 全モジュールの日次・週次・月次・四半期運用作業
- 優先度: **🟡 中**（運用品質維持、属人化排除）
- 見積: **0.5d**
- 担当セッション: a-main + 全モジュール
- 作成: 2026-04-26（a-auto 003 / Batch 15 Cross Ops #06）
- 前提:
  - Cross Ops #01 monitoring-alerting / #02 backup-recovery / #03 incident-response / #04 release-procedure / #05 data-retention
  - §14 許可リスト棚卸し
  - §17 現場フィードバック運用ルール

---

## 1. 目的とスコープ

### 1.1 目的

Garden の**定常運用作業を周期別に整理**し、誰が / いつ / 何を / どう確認するかを明文化する。Cross Ops #01〜#05 を「実行」する側のドキュメントとして機能する。

### 1.2 含めるもの

- 日次運用（バックアップ確認 / アラート確認 / 監視ダッシュボード）
- 週次運用（許可リスト棚卸し / フィードバック集約）
- 月次運用（コスト確認 / KPI レビュー / 法令確認）
- 四半期運用（DR 訓練 / セキュリティ監査 / プロセス改善）
- 年次運用（法令準拠監査 / 契約更新 / 大規模 DR 訓練）

### 1.3 含めないもの

- 監視・アラートの仕組み → #01
- バックアップ・リストア手順 → #02
- インシデント対応 → #03
- リリース手順 → #04
- データ保持・アーカイブ → #05

---

## 2. 運用周期の全体像

### 2.1 周期別タスク一覧

| 周期 | タスク数 | 主担当 | 所要時間（合計）|
|---|---|---|---|
| 日次 | 4 | a-main / 自動化 | 5〜10 分 |
| 週次 | 6 | a-main + 各モジュール | 30〜60 分 |
| 月次 | 8 | a-main + 東海林さん | 1〜2h |
| 四半期 | 5 | a-main + 各モジュール | 2〜4h |
| 年次 | 7 | 東海林さん + 全モジュール + 顧問 | 1〜2 日 |

### 2.2 自動化と手動の区分

| 自動化（Cron / システム）| 手動確認 |
|---|---|
| バックアップ取得 | バックアップ整合性確認 |
| 監視通知 | 通知内容のトリアージ |
| アーカイブ実行 | 物理削除承認 |
| KPI 集計 | KPI 解釈・改善判断 |
| エラー記録 | ポストモーテム実施 |

---

## 3. 日次運用

### 3.1 朝の確認ルーチン（毎日 9:00）

a-main が起動時に以下を確認:

#### [Day-01] 監視ダッシュボード確認

```
□ /bloom/monitoring を開く
□ 直近 24h の高重大度イベント有無
□ 未解決の high 以上があれば即対応着手
□ 未通知の medium があれば確認
```

#### [Day-02] バックアップ整合性確認

```
□ /api/cron/backup-verify の前夜実行結果（monitoring_events で確認）
□ 失敗していたら Sev2 として対応着手
```

#### [Day-03] Cron 実行状況確認

```
□ Vercel ダッシュボード → Cron Jobs → 直近 24h の成否
□ 失敗があれば該当ログを確認、再実行 or 修正
□ 主要 Cron:
  - /api/cron/kot-sync（深夜）
  - /api/cron/db-dump（03:00）
  - /api/cron/storage-backup（04:00）
  - /api/cron/backup-verify（05:00）
  - /api/cron/archive-runner（02:00）
```

#### [Day-04] 業務 KPI 速報

```
□ /bloom/kpi を開く
□ 前日の振込件数 / 給与配信成功率 / 案件作成数
□ 異常値（前 7 日平均から ±50% 超）があれば原因確認
```

### 3.2 終業前確認（任意、推奨）

```
□ 当日のコミット状況（git log の振り返り）
□ docs/effort-tracking.md 更新
□ 翌日の予定確認（release-plan / 監視通知予測）
```

### 3.3 日次自動レポート（Chatwork 8:30）

```
🌅 Garden 日次レポート (2026-04-26)

■ 監視サマリ（過去 24h）
- critical: 0 件 ✅
- high: 1 件（解決済）
- medium: 3 件（集約通知済）
- low: 12 件

■ Cron 結果
- /api/cron/kot-sync: ✅
- /api/cron/db-dump: ✅
- /api/cron/storage-backup: ✅
- /api/cron/backup-verify: ✅

■ 業務 KPI（前日）
- 振込実行: 12 件（前 7 日平均 14 件、-14%）
- 給与配信: 0 件（締日でない）
- 案件作成: 25 件

■ 注意事項
- 振込件数がやや低め、明日も継続観察
```

---

## 4. 週次運用

### 4.1 月曜朝の運用会議（仮想 / 非同期）

a-main が以下のレポートを Chatwork に投稿:

#### [Week-01] 許可リスト棚卸し（§14 連動）

- 7 日経過確認 → 棚卸しフロー発動
- 結果を `permission-review-log.md` に追記
- 必要なら 14 箇所の settings.json 更新提案

#### [Week-02] フィードバック集約

- 過去 1 週間の `docs/field-feedback-*.md` を集約
- 🐛バグ / 💡UX / ✨新機能 / ⚠️重大 別に分類
- 重大があれば即時対応着手

#### [Week-03] effort-tracking.md レビュー

- 前週の予定 vs 実績の差分を集計
- +50% 以上の遅延タスクをハイライト
- 原因（設計の詰まり / 想定外 / 他）を分析

#### [Week-04] PR 滞留確認

```
□ open な PR の滞留期間（7 日以上）
□ レビュー待ち / 修正待ちの分類
□ ブロッカーがあれば優先解決
```

#### [Week-05] feature_flags 棚卸し

- `rollout=all` で 4 週間以上の flag → 削除候補
- コードからも分岐除去計画を立てる

#### [Week-06] 監視ダッシュボード週次サマリ

- カテゴリ別集計（cron_failure / pdf_failure / sync_failure 等）
- 前週比較で増加カテゴリを特定 → 根本対応

### 4.2 週次レポート（Chatwork 月曜 8:30）

```
📊 Garden 週次レポート (2026-04-22 〜 2026-04-26)

■ ハイライト
- Sev1: 0 件 ✅
- Sev2: 1 件（解決済、ポストモーテム完了）
- リリース: 3 件（Bud / Forest / Tree）

■ KPI 週次
- 振込実行: 78 件（前週 65 件、+20%）
- 給与配信成功率: 100%
- 案件作成: 142 件

■ 改善アクション期限
- inc-20260420 改善 #2: a-bud, 期限 2026-04-30 ← 進捗確認お願いします

■ 注意事項
- なし
```

---

## 5. 月次運用

### 5.1 月初タスク（毎月 1 日）

#### [Month-01] DB / Storage コスト確認

```
□ Supabase ダッシュボード → Usage
□ 前月使用量と料金確認
□ 急増していたら原因調査（archive 設定漏れ / 攻撃 / 想定外利用）
```

#### [Month-02] Vercel コスト確認

```
□ Vercel ダッシュボード → Usage
□ Function Invocations / Edge Requests / Bandwidth
□ 急増項目の特定
```

#### [Month-03] release-plan 起票（§4）

```
□ docs/release-plan-YYYYMM.md 起票
□ 各モジュールの当月予定を集約
□ ブロッカー整理
```

#### [Month-04] 月次バックアップ整合性検査（リストアテスト）

§02 §6.2 に従い実 restore テスト。結果を `docs/dr-monthly-YYYYMM.md` に記録。

#### [Month-05] アーカイブ実行レポート確認

`/api/cron/archive-runner` の月次レポート。

```
□ アーカイブ件数 / 物理削除件数の推移
□ 異常な増減があれば原因確認
□ 物理削除候補（次月実行予定）の確認
```

### 5.2 月末タスク（毎月末）

#### [Month-06] 月次レトロスペクティブ

- effort-tracking.md の月次集計
- 計画 vs 実績の差分分析
- §18 構築優先順位への影響評価

#### [Month-07] known-pitfalls 整理

- 当月追加分の確認
- 既存項目の陳腐化チェック（解決済 → archive）

#### [Month-08] 月次 KPI レビュー

- 経営指標との連携（Forest）
- ユーザー利用率（DAU / WAU / MAU）
- 業務効率（処理時間 / 操作回数）

### 5.3 月次レポート（Chatwork 月初 9:00）

```
📈 Garden 月次レポート (2026-04)

■ ハイライト
- リリース: 12 件
- インシデント: Sev1 0 件 / Sev2 2 件 / Sev3 8 件
- 月次 DR テスト: ✅ pass（RTO 65 分）

■ コスト
- Supabase: $32.40（前月比 +8%、Storage 増加）
- Vercel: $20.00（変動なし）
- 外部 R2: $1.20

■ KPI
- 振込実行: 312 件（前月 278 件、+12%）
- 給与配信: 124 件（100% 成功）
- 利用者: DAU 28 / MAU 47

■ 重点課題
- Storage 増加要因が tree-call-recordings → archive 設定見直し検討

■ 来月予定
- Tree β展開（5 名 → 10 名）
- Forest 決算書 ZIP 機能リリース
```

---

## 6. 四半期運用

### 6.1 四半期タスク（3 月末 / 6 月末 / 9 月末 / 12 月末）

#### [Q-01] DR 訓練（年 4 回のうち 2 回）

§02 §7 に従い、PITR 復元 / Storage 復旧などを実演。

#### [Q-02] セキュリティ監査

```
□ Supabase Auth ログ確認（不審なログイン / Brute force）
□ RLS 設計レビュー（spec-cross-rls-audit と整合）
□ 権限の妥当性（不要な super_admin 付与がないか）
□ Vercel 環境変数の整理（不要なキー削除）
□ Service Role Key のローテーション検討（年 1 回）
```

#### [Q-03] パフォーマンス計測

```
□ Lighthouse スコア（主要ページ 5 つ）
□ Core Web Vitals（LCP / FID / CLS）
□ DB クエリ slow log の集計
□ 前四半期からの劣化を分析
```

#### [Q-04] ドキュメント整備

```
□ CLAUDE.md / AGENTS.md の陳腐化チェック
□ docs/specs/ の整理（実装済 → completed フォルダへ）
□ known-pitfalls.md の重複統合
□ runbook（本ドキュメント）の更新
```

#### [Q-05] §18 優先順位レビュー

- Phase 進捗の総括
- 6 ヶ月目標との乖離評価
- スコープ調整 or リソース投入の判断

---

## 7. 年次運用

### 7.1 年初タスク（1 月）

#### [Year-01] 法令保持期間レビュー

§05 §2 を顧問税理士 / 顧問弁護士に確認、改正があれば反映。

#### [Year-02] 契約更新

- Supabase / Vercel / R2 等の契約継続 or 見直し
- 別契約形態（Enterprise 等）の検討

### 7.2 年末タスク（12 月）

#### [Year-03] 大規模 DR 訓練

- 全社員参加のシナリオベース訓練
- 障害発生 → 復旧 → 業務復帰までを通しで実演
- 結果を `docs/drills/drill-YYYY-annual.md` に記録

#### [Year-04] セキュリティ監査（外部）

- 年 1 回、外部セキュリティ専門家のレビュー（簡易ペネトレーションテスト）
- 結果に基づく修正計画策定

#### [Year-05] 個人情報管理状況の自己点検

- 個人情報保護法に基づく自己点検
- 削除要請対応履歴の確認
- privacy_requests テーブルの整合性

#### [Year-06] アーキテクチャレビュー

- 全モジュールの技術スタック陳腐化チェック
- Next.js / Supabase 等のメジャーアップデート計画
- 大規模リファクタの優先度判断

#### [Year-07] 年次レポート

`docs/annual-report-YYYY.md` を作成、CEO（東海林さん）向けに以下を集約:

- 年間インシデント件数
- 年間リリース件数
- 年間 KPI 推移
- 年間コスト推移
- 来年度の重点課題

---

## 8. 担当者ロスター

### 8.1 役割マッピング

| 役割 | 第一担当 | 代理 |
|---|---|---|
| **a-main 運用** | 東海林さん | b-main |
| **インシデント司令官** | 東海林さん | super_admin の最初の応答者 |
| **バックアップ管理** | 東海林さん | a-root |
| **コスト管理** | 東海林さん | — |
| **法令確認** | 東海林さん（顧問税理士 / 弁護士に外部委託）| — |
| **データ保持監督** | 東海林さん | — |
| **個人情報削除要請対応** | 東海林さん（super_admin 必須）| — |

### 8.2 不在時のフェイルオーバー

- 東海林さん不在時、Sev1 / Sev2 のみ b-main に引き継ぎ可
- Sev3 は東海林さん復帰まで保留可
- 重要意思決定（リリース承認 / 物理削除承認）は原則東海林さん必須

---

## 9. 運用ツールリスト

### 9.1 主要ツール

| ツール | 用途 | アクセス |
|---|---|---|
| Vercel ダッシュボード | デプロイ / Analytics / Cron | 東海林さん |
| Supabase ダッシュボード | DB / Auth / Storage / Logs | 東海林さん |
| Chatwork | 通知 / 連絡 | 全員 |
| GitHub | PR / Issue / リリース管理 | 開発者 |
| UptimeRobot | 外部 uptime 監視 | 東海林さん |
| Cloudflare R2 | 外部 dump 保管 | 東海林さん（IAM 限定）|
| Bloom 監視ダッシュボード | Garden 内部監視 | manager+ |
| Bloom データライフサイクル | アーカイブ可視化 | admin+ |
| Bloom KPI ダッシュボード | 業務 KPI | 全員（権限内）|

### 9.2 認証情報管理

- すべての認証情報は **1Password** 等のパスワード管理ツールに保管
- 共有が必要な場合のみ、組織共有ボールトに格納
- 個人 PC へのプレーンテキスト保存禁止

---

## 10. 緊急連絡先

### 10.1 エスカレーション順序

1. 東海林さん（一次）
2. b-main（深夜 Sev1 で東海林さん不在時のみ）
3. 顧問税理士（法令 / 経理関連）
4. 顧問弁護士（個人情報 / 契約関連）
5. Supabase / Vercel サポート（技術障害）

### 10.2 連絡先一覧（実値は別途 1Password に保管）

```
- 東海林さん: 携帯電話 / メール / Chatwork DM
- b-main: メール / Chatwork DM
- 顧問税理士: 〇〇会計事務所、TEL / FAX
- 顧問弁護士: 〇〇法律事務所、TEL / FAX
- Supabase Support: support@supabase.com（Pro プラン以上は優先対応）
- Vercel Support: support@vercel.com
- Cloudflare Support: ダッシュボードからチケット
```

---

## 11. 運用ナレッジの蓄積

### 11.1 docs/ 配下の運用ファイル

```
docs/
├─ runbooks/
│  ├─ daily.md            … 本ドキュメントの日次部分
│  ├─ weekly.md           … 同 週次
│  ├─ monthly.md          … 同 月次
│  ├─ quarterly.md        … 同 四半期
│  ├─ annual.md           … 同 年次
│  ├─ incident-playbook.md … #03 から
│  └─ tree-rollout.md     … #04 から
├─ incidents/             … インシデント記録
├─ drills/                … DR 訓練記録
├─ release-plans/         … 月次リリース計画
├─ release-notes/         … リリースノート
├─ field-feedback/        … 現場フィードバック
├─ effort-tracking.md     … 工数記録
├─ known-pitfalls.md      … 既知の落とし穴
└─ specs/                 … 設計仕様
```

### 11.2 ナレッジの陳腐化対策

- 各ドキュメントに **last-reviewed: YYYY-MM-DD** ヘッダ
- 半年以上更新がないファイルは四半期レビューで確認
- 不要になったら `docs/archive/` に移動 or 削除

---

## 12. 既知のリスクと対策

### 12.1 運用作業の属人化

- 東海林さん 1 名に集中 → 不在時に運用停止リスク
- 対策: 各タスクを runbook に明文化、b-main / a-main で代行可能な状態を維持

### 12.2 ルーチンの形骸化

- 「いつもの通り OK」と確認が雑になる
- 対策: 月次レポートに「異常値検出ルール」を組み込み、自動 flag

### 12.3 ドキュメント更新の追随漏れ

- システム変更 → runbook が古いまま
- 対策: PR チェックリストに「runbook 更新が必要か」を必須項目化

### 12.4 通知疲れ

- 日次レポートが流し読みされる
- 対策: 異常時のみ Chatwork DM、通常は週次サマリに集約

### 12.5 自動化の盲信

- 自動化が壊れていることに気付かない
- 対策: 自動化自体を週次で「動作している」確認、Cron に Heartbeat（成功も記録）

---

## 13. 関連ドキュメント

- `docs/specs/2026-04-26-cross-ops-01-monitoring-alerting.md`
- `docs/specs/2026-04-26-cross-ops-02-backup-recovery.md`
- `docs/specs/2026-04-26-cross-ops-03-incident-response.md`
- `docs/specs/2026-04-26-cross-ops-04-release-procedure.md`
- `docs/specs/2026-04-26-cross-ops-05-data-retention.md`
- CLAUDE.md §11〜§18

---

## 14. 受入基準（Definition of Done）

- [ ] 日次タスク（§3）4 項目を 1 週間連続で実施 → 定着確認
- [ ] 週次レポート（§4）が月曜 8:30 に Chatwork 配信
- [ ] 月次レポート（§5）が月初に Chatwork 配信
- [ ] 月次 DR リストアテスト（§02 §6.2）が 1 回完了
- [ ] 四半期運用（§6）の各項目を `docs/runbooks/quarterly.md` に転記
- [ ] 緊急連絡先を 1Password に保管、全 super_admin が参照可能
- [ ] 担当者ロスター（§8）を東海林さん + b-main で合意
- [ ] runbook 自体の半年レビューを Cron で予約（リマインド）
- [ ] 異常値検出ルール（§12.2）を週次レポートに統合
