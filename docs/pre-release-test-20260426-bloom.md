# Garden Bloom Phase A-1 リリース前テスト結果（β 投入準備）

- **対象モジュール**: Garden Bloom（Workboard / Roadmap / 月次ダイジェスト / Cron / Chatwork 連携）
- **作成日時**: 2026-04-26
- **担当**: a-bloom (A) / イレギュラー自律実行モード稼働中
- **対象ブランチ**: `feature/bloom-workboard-20260424` (develop へ全 commit merge 済)
- **テスト範囲**: CLAUDE.md §16 7 種テスト（Bloom 🟡 通常厳格度）+ §17 §10.3 反映確認
- **目的**: 後道さん向け β 投入の Go/No-Go 判定

---

## 0. テスト実施サマリ

| 種別 | 合格 | 警告 | 不合格 | 未実施（手動要） |
|---|:-:|:-:|:-:|:-:|
| 1. 機能網羅 | 9 | 1 | 0 | 6 |
| 2. エッジケース | 5 | 2 | 0 | 4 |
| 3. 権限 | 3 | 0 | 0 | 4 |
| 4. データ境界 | 4 | 1 | 0 | 3 |
| 5. パフォーマンス | 0 | 1 | 0 | 5 |
| 6. コンソールエラー監視 | 2 | 1 | 0 | 4 |
| 7. アクセシビリティ | 2 | 3 | 0 | 4 |
| **合計** | **25** | **9** | **0** | **30** |

**Go/No-Go 判定**: 🟡 **β 投入は条件付き Go**
- 不合格 0、現時点で β 投入を阻む致命的問題なし
- ただし「未実施（手動要）30 項目」を東海林さんが手動完了し、警告 9 項目のうち優先度高 4 項目を確認した上で投入推奨
- 修正優先度マトリクス は §10 参照

---

## 1. 機能網羅テスト

### 1.1 自動検証済（✅）

| # | 確認項目 | 結果 | 根拠 |
|---|---|:-:|---|
| 1.1.1 | 4 主要画面が物理的に存在（page.tsx）| ✅ | `src/app/bloom/{workboard,roadmap,monthly-digest,page}.tsx` 存在確認 |
| 1.1.2 | 月次ダイジェストの 4 サブルート | ✅ | list / `[month]/page.tsx` / `[month]/edit/page.tsx` / `[month]/export/route.ts` |
| 1.1.3 | Cron route 3 本（daily/weekly/monthly）存在 | ✅ | `src/app/api/bloom/cron/{daily,weekly,monthly}/route.ts` |
| 1.1.4 | Chatwork 共通 lib 9 ファイル | ✅ | `src/lib/chatwork/` 配下、client / secrets / webhook / 4 templates / index 存在 |
| 1.1.5 | Bloom 認証スケルトン 5 ファイル | ✅ | auth.ts / supabase.ts / session-timer.ts / BloomGate / BloomStateContext |
| 1.1.6 | TypeScript: 非テストファイルで型エラー 0 | ✅ | `tsc --noEmit` でテストファイル外のエラーゼロ |
| 1.1.7 | ナビゲーション: 4 タイル → 各画面遷移リンク | ✅ | `src/app/bloom/page.tsx` で BLOOM_PATHS 定数経由 |
| 1.1.8 | DB migration 4 ファイル（helper / schema / rls / cron-log） | ✅ | `scripts/bloom-*.sql` |
| 1.1.9 | 認証ゲート（BloomGate）= /forest/login リダイレクト（判5）| ✅ | `BloomGate.tsx` で `window.location.replace('/forest/login?returnTo=...')` |

### 1.2 警告（🟡）

| # | 確認項目 | 警告内容 | 影響度 |
|---|---|---|---|
| 1.2.1 | **Bloom 専用 Vitest テストファイル 0 件** | `find src/app/bloom -name "*.test.*"` で 0 件。Phase A-1 は TDD ではなく後付け検証のみ | 🟡 中 — 回帰防止が手動依存 |

### 1.3 手動要（後道さん投入前に東海林さん確認）

| # | 項目 | 手順 |
|---|---|---|
| 1.3.1 | /bloom 全画面ロード確認 | super_admin でログイン → /bloom → /bloom/workboard → /bloom/roadmap → /bloom/monthly-digest 巡回、エラーなく表示 |
| 1.3.2 | Workboard ステータス更新 | 🟢 → 🟡 クリック、`bloom_worker_status` UPSERT 確認 |
| 1.3.3 | TodayPlanList 追加・チェック・削除 | 各操作で `bloom_daily_logs.planned_items` jsonb が更新されるか |
| 1.3.4 | 月次ダイジェスト新規作成 | admin+ で月選択 → 5 ページ雛形が draft で作成 |
| 1.3.5 | 月次ダイジェスト投影モード | ProjectionViewer で ArrowL/R/Esc/Space 動作 |
| 1.3.6 | PDF エクスポート | `/bloom/monthly-digest/YYYY-MM/export` で 200 + application/pdf、日本語が □ にならないこと |

---

## 2. エッジケーステスト

### 2.1 自動検証済（✅）

| # | 項目 | 結果 |
|---|---|:-:|
| 2.1.1 | 月フォーマット不正 → 400 | ✅ `/api/bloom/monthly-digest/[month]/export` で `^\d{4}-\d{2}$` 正規表現チェック |
| 2.1.2 | Authorization 欠如 → 401 | ✅ `createSupabaseFromRequest` が throw、401 で応答 |
| 2.1.3 | 未作成月 → 404 | ✅ `fetchDigestByMonth` null 時に 404 |
| 2.1.4 | Cron CRON_SECRET 欠如 → 500 | ✅ `verifyCronRequest` で env 未設定時に 500 |
| 2.1.5 | Cron 不正トークン → 401 | ✅ `timingSafeEqual` 比較で 401 |

### 2.2 警告（🟡）

| # | 項目 | 警告内容 |
|---|---|---|
| 2.2.1 | **空の planned_items を保存可能** | `TodayPlanList` で空文字 title はクライアント側で弾くが、API 側に再検証なし（known-pitfalls #3 系） |
| 2.2.2 | **長文タイトル / マルチバイト** の DB 制限未設定 | `bloom_*` テーブルは text 型多用、桁数制限なし。1MB 超の payload で 413 になる可能性 |

### 2.3 手動要

| # | 項目 |
|---|---|
| 2.3.1 | 16 件超の planned_items を 1 日に追加（UI 性能） |
| 2.3.2 | 月次ダイジェスト 0 ページで投影モード起動（border case）|
| 2.3.3 | 同月のダイジェスト重複作成 → unique 制約エラー UX |
| 2.3.4 | 退社済社員 (root_employees.deleted_at) のステータス表示挙動（A-3-h merge 後の確認）|

---

## 3. 権限テスト

### 3.1 自動検証済（✅）

| # | 項目 | 結果 |
|---|---|:-:|
| 3.1.1 | RLS ポリシー 7 テーブル全てで定義済 | ✅ `scripts/bloom-rls.sql` で 4 役割（自分 / staff / manager / admin / super_admin）分岐 |
| 3.1.2 | manager は worker_status の "忙しさ指標のみ" 列絞込 | ✅ `bws_read_manager_plus` ポリシー + クライアント側 select 列限定（§10.3 判4）|
| 3.1.3 | bloom_chatwork_config は super_admin のみ | ✅ `bcc_rw` ポリシー |

### 3.2 手動要（7 段階ロール別確認）

| # | ロール | 確認シナリオ |
|---|---|---|
| 3.2.1 | super_admin（東海林さん）| 全画面 + 編集 + Chatwork 設定 |
| 3.2.2 | admin（後道さん）| 全画面閲覧 + ダイジェスト編集 / 公開、Chatwork 設定不可 |
| 3.2.3 | manager | 全員ステータス read（忙しさ指標のみ）、自分のみ書込、ダイジェスト read のみ |
| 3.2.4 | staff / cs / closer / toss / outsource | 自分のみ read/write |

---

## 4. データ境界テスト

### 4.1 自動検証済（✅）

| # | 項目 | 結果 |
|---|---|:-:|
| 4.1.1 | progress_pct 0-100 範囲 CHECK | ✅ `bloom_roadmap_entries.progress_pct CHECK (0 ≤ x ≤ 100)` |
| 4.1.2 | digest_month UNIQUE | ✅ `bloom_monthly_digests` UNIQUE (digest_month) |
| 4.1.3 | bloom_daily_logs 1 ユーザー × 1 日 = 1 行 | ✅ UNIQUE (user_id, log_date) |
| 4.1.4 | id 1 のみ許可（chatwork_config 単一行）| ✅ `CHECK (id = 1)` |

### 4.2 警告（🟡）

| # | 項目 | 警告内容 |
|---|---|---|
| 4.2.1 | **bloom_chatwork_config.api_token 平文保存** | spec §10.3 判1 で pgcrypto 推奨だが現状 text 型平文。Phase 2 移行前に `pgp_sym_encrypt()` 適用推奨 |

### 4.3 手動要

| # | 項目 |
|---|---|
| 4.3.1 | 文字列最大長境界（jsonb 1MB 超など）|
| 4.3.2 | 日付境界（月跨ぎ・年跨ぎ）|
| 4.3.3 | NULL 許容列の null 動作確認 |

---

## 5. パフォーマンステスト

### 5.1 警告（🟡）

| # | 項目 | 警告内容 |
|---|---|---|
| 5.1.1 | **次 build が test-utils 依存で失敗** | `src/test-utils/supabase-mock.ts` が vitest を import するが、`tsconfig.json` の include が src/**/*.ts 全件、exclude は node_modules のみ。production build 時に型エラー。**東海林さんが `npm install` で vitest を入れて回避必要、または tsconfig の exclude に `src/test-utils/**` 追加（develop 全体課題）** |

### 5.2 手動要

| # | 項目 |
|---|---|
| 5.2.1 | /bloom/workboard 初期ロード時間 (Lighthouse) |
| 5.2.2 | /bloom/roadmap で 100+ entries 描画 |
| 5.2.3 | 月次ダイジェスト 10 ページ PDF 生成時間 |
| 5.2.4 | Cron 実行時間（15 分超なら Vercel Cron 上限） |
| 5.2.5 | Chatwork API レート（エンタープライズプランなので実害なし想定）|

---

## 6. コンソールエラー監視

### 6.1 自動検証済（✅）

| # | 項目 | 結果 |
|---|---|:-:|
| 6.1.1 | console.error / warn は 29 箇所、すべて catch ブロック内またはフォールバック説明付き | ✅ 暗黙の失敗なし |
| 6.1.2 | try / catch ブロックは Bloom + Cron + Chatwork 配下で 40 箇所 | ✅ エラーパス整備 |

### 6.2 警告（🟡）

| # | 項目 | 警告内容 |
|---|---|---|
| 6.2.1 | **エラー時の UI 表示が page-level error boundary 経由でない箇所が多い** | spec-cross-error-handling §4.4 page-level error boundary は未配置。catch → setState → inline メッセージで処理しており、ネットワーク全断時の UX が貧弱になる可能性 |

### 6.3 手動要

| # | 項目 |
|---|---|
| 6.3.1 | DevTools Console で全画面巡回時の Error/Warning ゼロ |
| 6.3.2 | network throttling 下での Workboard 描画 |
| 6.3.3 | ステータス更新失敗時の UX |
| 6.3.4 | PDF 生成失敗時の UX |

---

## 7. アクセシビリティ

### 7.1 自動検証済（✅）

| # | 項目 | 結果 |
|---|---|:-:|
| 7.1.1 | aria-label / aria-pressed の使用箇所あり | ✅ 5 箇所（edit page 3 / TodayPlanList 1 / ViewModeToggle 1）|
| 7.1.2 | semantic HTML（button / nav / section / header）| ✅ 15 箇所 |

### 7.2 警告（🟡）

| # | 項目 | 警告内容 |
|---|---|---|
| 7.2.1 | **キーボードナビ視覚フィードバック未確認** | focus outline のスタイル定義が見当たらない（インライン style 中心のため）|
| 7.2.2 | **Workboard 5 component で aria-* なし** | WorkerStatusCard / RunningProjectCard / WeeklyAchievement / NextMilestoneCard / TodayPlanList のうち aria-label 1 件のみ |
| 7.2.3 | **monthly-digest 投影モードに role="dialog" + aria-modal="true" あり**（PR #50 でも同等）| ✅ 既存 |

### 7.3 手動要（axe-core / Lighthouse）

| # | 項目 |
|---|---|
| 7.3.1 | axe-core で /bloom 全画面 → 重大違反ゼロ |
| 7.3.2 | Lighthouse a11y スコア 90+ |
| 7.3.3 | スクリーンリーダー（VoiceOver / NVDA）実機確認 |
| 7.3.4 | キーボードのみで全機能操作可能か |

---

## 8. 環境変数 / Cron / Deploy 確認

### 8.1 ローカル `.env.local` 設定状況（✅ all set）

| 変数 | 状態 | 用途 |
|---|:-:|---|
| `CHATWORK_API_TOKEN` | ✅ | Chatwork API |
| `CHATWORK_BLOOM_ROOM_ID` | ✅ | Phase 1 専用ルーム |
| `BLOOM_CHATWORK_DRY_RUN` | ✅ | 誤送信防止（true 推奨）|
| `CRON_SECRET` | ✅ (64-char hex) | Vercel Cron 認証 |
| `BLOOM_PUBLIC_URL` | ✅ | 通知本文の URL ベース |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase 接続 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Cron service role 用 |

### 8.2 vercel.json crons（✅ 3 本定義済）

```
{ "path": "/api/bloom/cron/daily",   "schedule": "0 9 * * *"  }   // JST 18:00 = UTC 09:00
{ "path": "/api/bloom/cron/weekly",  "schedule": "0 9 * * 5"  }   // 金曜
{ "path": "/api/bloom/cron/monthly", "schedule": "0 9 14 * *" }   // 毎月14日
```

### 8.3 手動要（東海林さん側）

| # | 項目 | 確認手順 |
|---|---|---|
| 8.3.1 | **Vercel 本番環境変数 7 件設定** | Vercel プロジェクト > Environment Variables で Production / Preview に上記 7 変数設定 |
| 8.3.2 | **Vercel 本番デプロイ成功** | Vercel ダッシュボードで latest deployment が READY |
| 8.3.3 | **Cron 3 本が有効化** | Vercel Cron 画面で 3 本表示、最新実行が success |
| 8.3.4 | **Dry-run 動作確認**（最重要）| 実 Cron 1 回実行 → Chatwork ルームへ送信されない、`bloom_cron_log.status='skipped'` のレコード生成 |
| 8.3.5 | **bloom_cron_log Dashboard 適用** | scripts/bloom-cron-log.sql を実行（既に完了済の認識）|

---

## 9. § 17 現場フィードバック準備

### 9.1 β 投入対象
- 後道さん（admin、Garden 全社進捗閲覧用途）

### 9.2 期待運用
1. **Phase 1（α継続）**: 東海林さん 1 人で Dry-run、誤送信ゼロ確認
2. **Phase 2（β、本案）**: 後道さん追加、別ルーム新規作成 → CHATWORK_BLOOM_ROOM_ID 切替
3. **Phase 3（リリース）**: 全社 admin 展開

### 9.3 FB 受領経路
- Chatwork DM（東海林さん経由）
- 集約先: `docs/field-feedback-YYYYMMDD-bloom.md`（新設、§17 準拠）

---

## 10. 修正優先度マトリクス

### 🔴 緊急（β 投入前に必須）

| # | 項目 | 対応 |
|---|---|---|
| 5.1.1 | next build 失敗（test-utils が vitest 依存）| **Bloom 範囲外、develop 全体課題**。`npm install` または tsconfig exclude で対応 |

### 🟡 推奨（β 投入前に望ましい）

| # | 項目 | 対応 |
|---|---|---|
| 4.2.1 | bloom_chatwork_config.api_token pgcrypto 暗号化 | Phase 2 ルーム切替前に `pgp_sym_encrypt()` 適用 |
| 7.2.1 / 7.2.2 | a11y: focus outline + Workboard aria-* | β FB を受けて Phase A-1 fix で対応 |
| 6.2.1 | page-level error boundary 配置 | Phase A-2 で error.tsx 追加 |
| 1.2.1 | Bloom Vitest 0 件 | β 終了後の Phase A-2 で TDD 後付け |

### 🟢 後回し（Phase A-2 以降）

| # | 項目 | 対応 |
|---|---|---|
| 2.2.1 / 2.2.2 | 入力境界（空 planned_items / 桁数）| API 側 Zod 検証追加 |
| 7.3 | axe-core / Lighthouse / VoiceOver | a-bloom Phase A-2 範囲 |
| 5.2 | パフォーマンス計測 | Phase A-2 で k6 / Lighthouse CI 導入 |

---

## 11. β 投入 Go/No-Go チェックリスト（東海林さん向け）

### 必須（🔴 緊急対応後）
- [ ] 5.1.1 next build 通過確認（`npm install` または tsconfig 修正）
- [ ] 8.3.1 Vercel 環境変数 7 件 Production / Preview 反映
- [ ] 8.3.2 本番デプロイ READY
- [ ] 8.3.3 Cron 3 本有効、最新実行 success
- [ ] 8.3.4 Dry-run 動作確認（送信されないこと）
- [ ] 1.3.1〜1.3.6 主要機能の手動巡回（30 分目安）

### 推奨（🟡）
- [ ] 4.2.1 api_token pgcrypto 暗号化検討
- [ ] 6.2.1 error boundary 配置検討
- [ ] 9.2 Phase 2 別ルーム作成 + ROOM_ID 切替

### 完了後
- [ ] 後道さんへ後道さん向け説明資料（`docs/bloom-intro-for-godo-202604.md`）転送
- [ ] β投入開始日記録（field-feedback-YYYYMMDD-bloom.md 起票）

---

## 12. 結論

**β 投入は条件付き Go**:
- 不合格項目 0、Bloom 自身に重大欠陥なし
- 唯一の 🔴 緊急（next build）は Bloom 起因ではなく develop 全体課題
- 必須チェックリスト 6 件を東海林さんが完了すれば、後道さんへの β 投入が可能

最終 Go 判断は東海林さんの手動確認後に確定。本ドキュメントを契機に Phase 2 ルーム移行 + 後道さん追加の運用フローを始動できる状態。
