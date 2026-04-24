# Garden 開発の既知ハマりどころ（known-pitfalls）

> **用途**: §17「現場フィードバック運用ルール」の予防策ナレッジ集。新モジュール構築時・新規レビュー時・auto モードのバグ確認プロンプトで**必読**。
> **初版作成**: 2026-04-24（a-auto / Phase A 先行 batch1 #P38）
> **更新方針**: 新しいハマりを検出したら即追記。カテゴリ別・モジュール中立で記述（Bloom/Bud/Tree 固有の問題も「なぜ起きたか」の一般則を抽出）

---

## 1. 認証・権限

### 1.1 RLS の `auth.uid()` が `null` でクエリが空配列を返す
- **症状**: ログイン済なのに、開発ツール Console で行が 0 件。`error` も出ない
- **原因**: `supabase.auth.getSession()` 前にクエリを投げると JWT 未注入 → RLS が常に false
- **予防**: `ForestStateContext` の `isUnlocked` を見てからデータ取得する `useEffect` に統一（Forest パターン踏襲）
- **対処**: ブラウザ DevTools → Network → supabase の POST に `authorization: Bearer ...` が載っているか確認

### 1.2 `garden_role` 判定を CHECK 制約なしで書いて typo が紛れる
- **症状**: `'admin'` と書くべきところを `'admn'` と書いても DB が通る
- **原因**: ENUM 未使用。CHECK 制約で 7 値固定しないと軽微な誤りがサイレント貫通
- **予防**: テーブル作成時に `CHECK (garden_role IN ('toss','closer','cs','staff','manager','admin','super_admin'))` 必須
- **対処**: `root_employees.garden_role` を SELECT して想定外値を抽出

### 1.3 擬似メール形式 `emp{4桁}@garden.internal` の 4 桁ゼロ詰め忘れ
- **症状**: 社員番号 `8` の人がログインできない（DB は `0008` で登録）
- **原因**: 入力 `8` → `emp8@garden.internal` になり、DB の `emp0008@garden.internal` と不一致
- **予防**: ログイン画面の変換関数で `.padStart(4, '0')` 必須。ユニットテストも書く
- **対処**: Tree login / Forest login の `signIn*` 関数内での正規化を徹底

### 1.4 一般社員パスが誕生日 MMDD（4 桁）だが 1 月 1 日は `0101` / `101` の揺れ
- **症状**: 1 月生まれの人がログインできない
- **原因**: ゼロ詰め忘れ。UI で `maxLength=4` だが値の正規化が不完全
- **予防**: Tree birthday 更新時・パスワード自動同期時に **2 桁ゼロ詰めで結合**（`MM.padStart(2,'0') + DD.padStart(2,'0')`）

### 1.5 Bud の 2 時間セッションが画面遷移まで検知されない
- **症状**: 2 時間経ってもダッシュボードが表示され続け、次の画面遷移で急に /bud/login へ
- **原因**: `BudGate` の `useEffect` が `isBudUnlocked()` を**命令的呼び出し**で非リアクティブ
- **予防**: Context に `isUnlocked` を state で保持し、`setInterval` or `visibilitychange` で再評価
- **対処**: 本日の Bud レビュー 🔴1 指摘事項として記録（a-bud 対応）

---

## 2. 型安全性・フレームワーク

### 2.1 Next.js App Router で `useSearchParams` がサーバーコンポーネントで呼ばれて落ちる
- **症状**: ビルド時 `Invariant: static generation requires ... without useSearchParams`
- **原因**: `useSearchParams` を使うコンポーネントは **Suspense で囲む**か、親を `'use client'` にする必要あり
- **予防**: 検索系 UI は必ず `<Suspense>` でラップ。初期実装から意識
- **対処**: エラーメッセージで指示されたファイルを Suspense 化

### 2.2 Supabase クライアントを複数インスタンス化してしまう
- **症状**: 認証状態が画面ごとにバラバラ、`onAuthStateChange` が複数発火
- **原因**: `createClient()` を複数ファイルで呼ぶと singleton にならない
- **予防**: 各モジュールの `_lib/supabase.ts` で**ただ 1 箇所だけ** `createClient()` を呼び、`export const supabase` とする
- **対処**: Forest 実装パターンを踏襲（他モジュールも同じ形）

### 2.3 Supabase の型生成（`database.types.ts`）を使わず `any` に逃げる
- **症状**: カラム名 typo が実行時まで発覚しない、自動補完が効かない
- **原因**: `supabase gen types typescript --project-id ...` を運用に組み込んでいない
- **予防**: スキーマ変更時の PR チェックで **型再生成を強制**。CI で差分チェック
- **対処**: まずは現状の `Company` / `FiscalPeriod` 等の手書き型を維持し、型生成は Phase A-2 で導入

### 2.4 `useEffect` の依存配列に関数を書くと無限再レンダー
- **症状**: ダッシュボードが一瞬読み込み、すぐ再読み込み、無限ループ
- **原因**: 親で毎回新しい関数を作って props で渡している
- **予防**: 親側で `useCallback` でラップ or state に依存させる
- **対処**: React DevTools の Profiler で再レンダー元を特定

### 2.5 Tree の `TreeAuthGate` `useEffect` 依存に `treeUser` が書かれていない
- **症状**: 誕生日判定の分岐が想定と違うタイミングで走る
- **原因**: 依存配列に `needsBirthday`（派生）のみ書かれている
- **予防**: 派生値を計算するなら派生値と派生元の両方を依存に入れる、または `useMemo` で派生を固定
- **対処**: 本日の Tree レビュー 🟢5 で記録済

### 2.6 UI 行オブジェクトの初期値 `created_at: ""` を upsert に流して Postgres が拒否
- **症状**: 新規作成時に `invalid input syntax for type timestamp with time zone: ""` で upsert 失敗
- **原因**: `emptyX()` ファクトリが型を満たすため `created_at: ""` / `updated_at: ""` を入れ、その値がそのまま payload として Postgres に送られる。`timestamptz NOT NULL DEFAULT now()` 列は空文字を受理できない
- **予防**:
  - Insert/Upsert payload から `created_at` / `updated_at` は**常に除外**し、DB の `DEFAULT now()` と `trg_*_updated_at` トリガに任せる
  - 共通サニタイザ `src/app/root/_lib/sanitize-payload.ts` の `sanitizeUpsertPayload` を各マスタ handleSave で必ず噛ませる
  - nullable date 列（例: `termination_date`, `effective_to`）も `NULLABLE_DATE_KEYS` に登録して空文字 → undefined 変換
  - 新マスタ追加時: `NULLABLE_DATE_KEYS` への追記と handleSave 内の sanitize 適用を PR チェックリストに含める
- **対処**: Root では PR #15 / commit `6f07eef` で KoT 側のみ個別対応、Phase A-3-f で 7 マスタ + KotSyncModal を共通 helper に統合。他モジュールでマスタ追加する場合は同パターンを採用する
- **波及**: 発見は Root Phase A-2 の §16 テストで。Bud / Leaf で同様の「空文字を timestamptz に流す」フォームを書かない

---

## 3. UI・アクセシビリティ

### 3.1 モジュール間でスタイル手法が分裂（インラインスタイル vs Tailwind）
- **症状**: Tree はインラインスタイル、Bud は Tailwind、Forest はインラインスタイル＋コンスタント — メンテ負荷が大
- **原因**: 初期実装時の統一ルール不在
- **予防**: **新モジュールは Tailwind を第 1 選択**（Bud 既存パターン）。どうしてもインラインが必要な場合は共通コンポーネント（GlassPanel / ActionButton 等）に閉じ込める
- **対処**: 段階的移行（Tree レビュー A/B/C 案の C 案で束ね）

### 3.2 エラー表示に `role="alert"` がないと SR で読み上げられない
- **症状**: フォーム送信失敗が視覚的にだけ赤字で出る → 送金業務で「送れたと思った」誤認
- **原因**: 視覚フィードバックのみの設計
- **予防**: エラー UI のテンプレートに最初から `<div role="alert" aria-live="polite">` を入れる
- **対処**: Bud レビュー 🔴2 として記録済

### 3.3 行クリック（`<tr onClick>`）のキーボード操作対応なし
- **症状**: テーブル行クリックで遷移する UI がキーボード操作できない
- **原因**: `onClick` だけで `onKeyDown` `tabIndex` `role="button"` を付けていない
- **予防**: テーブル内リンクは `<Link>` でセル単位に包むか、行を `role="button" tabIndex={0} onKeyDown` 化
- **対処**: Bud transfers テーブルが典型例（リファクタ候補）

### 3.4 固定横幅（`width: 380`）で狭幅端末（iPhone SE 等）でスクロール破綻
- **症状**: モバイルで画面が横にはみ出す
- **原因**: `GlassPanel` に `width` 直接指定
- **予防**: `max-width` + `width: 100%` + `padding-inline` の 3 点セット
- **対処**: Tree login / birthday 画面が対象（改修候補）

### 3.5 モーダルの `body` スクロール漏れ
- **症状**: モーダル表示中に背景がスクロール
- **原因**: `body { overflow: hidden }` の切替を忘れる
- **予防**: 共通 Modal コンポーネントで `useEffect` の cleanup まで含めて制御
- **対処**: Forest DetailModal には未実装（将来の共通化タイミングで対応）

---

## 4. 外部連携

### 4.1 Google Drive API の 403 Quota エラー
- **症状**: ZIP ダウンロードで「権限がありません」
- **原因**: Service Account が該当フォルダの共有権限を持っていない or API Rate Limit
- **予防**: 対象フォルダを Service Account に共有、エクスポート単位を分割
- **対処**: Forest v9 Download Section（P4.5）実装時の注意事項

### 4.2 Chatwork API のレート制限（5 req/sec）超過
- **症状**: 大量通知で 429 Too Many Requests
- **原因**: 同時送信の並列化
- **予防**: p-queue 等で同時実行数 1〜2 に制限、指数バックオフリトライ
- **対処**: Bloom Cron（daily/weekly/monthly）で必ず逐次送信

### 4.3 Supabase Storage の署名 URL 期限切れ
- **症状**: 朝は開けたファイルが夕方開けない
- **原因**: signedURL の有効期限をデフォルト（1h 等）のまま発行
- **予防**: 業務文書は長期（24h〜7d）、機密は短期（10min）で使い分け。取得のたびに新規署名
- **対処**: 各画面で都度 `createSignedUrl` を呼ぶ

### 4.4 `.env.local` を Git にコミットしてしまう
- **症状**: Supabase Service Role Key が漏洩 → ロール再発行必要
- **原因**: `.gitignore` に入れたつもりでも既にコミット済の場合に `git add .` で復活する
- **予防**: `git check-ignore .env.local` で必ず確認。初期 commit 時に `.gitignore` を最優先で整備
- **対処**: 漏洩時は **即時 Secret key 再発行**、履歴を `git filter-repo` で消去するか本番ロールを切替

### 4.5 KoT / MF の API 仕様変更が通知されない
- **症状**: 月次取込バッチが突然 400 or 404
- **原因**: ベンダーの API エンドポイント変更
- **予防**: 外部 API 呼び出しの結果フォーマットを **契約テスト**（JSON schema 検証）する
- **対処**: エラー検知時は Chatwork アラート通知、手動 CSV フォールバックに切替

---

## 5. テスト

### 5.1 Supabase を mock するユニットテストが本番 RLS で落ちる
- **症状**: ローカルテストは通る、Vercel preview で 403
- **原因**: mock では RLS をバイパスしていた
- **予防**: `superpowers:test-driven-development` スキルに従い、**統合テストは実 DB（dev 環境）**で回す
- **対処**: 開発用の seed データを `scripts/seed-*.sql` に集約して再現性確保

### 5.2 TDD 導入時に既存コードへのテスト追加がおざなり
- **症状**: 新機能はテスト付きだが既存コードはテストゼロ
- **原因**: 「既存は後で」が後回しのまま
- **予防**: 新機能実装時に、触れた関数の兄弟関数にもテストを 1 本追加する「テストスパイラル」
- **対処**: Bud `_lib/__tests__` の 4 本（duplicate-key / transfer-id / transfer-status / status-display）はこの方針で増やす

### 5.3 E2E テストで認証画面を通過できない
- **症状**: Playwright が login 画面で止まる
- **原因**: テストユーザーの birthday が未設定 or `/tree/birthday` へ誘導されて停止
- **予防**: テスト専用ユーザーを DB に作成し、birthday を固定（例: `0101`）
- **対処**: `scripts/seed-test-users.sql` に集約

---

## 6. デプロイ・運用

### 6.1 Vercel 環境変数の `NEXT_PUBLIC_*` とそれ以外を混同
- **症状**: `SUPABASE_SERVICE_ROLE_KEY` がクライアント側バンドルに含まれて漏洩
- **原因**: 環境変数名の接頭辞を無視 / or `server-only` パッケージを使わずクライアントで import
- **予防**: Service Role Key は **API Route / Server Action でのみ利用**。`server-only` パッケージで import 境界を強制
- **対処**: Forest の `/api/forest/parse-pdf` のような Route Handler で封じる

### 6.2 `main` ブランチ直 push
- **症状**: Vercel 本番が壊れる
- **原因**: `.claude/settings.json` の deny 忘れ、または警告を無視
- **予防**: `a-auto/.claude/settings.json` の deny に `Bash(git push * main:*)` 相当を追加検討。GitHub Branch Protection で main を保護
- **対処**: 即時 revert（新コミットで戻す、force push 禁止）

### 6.3 Supabase 本番と dev の切替ミス
- **症状**: dev のつもりが本番に UPDATE してしまう
- **原因**: `.env.local` が本番を指していた / or RLS バイパス用 service role key を手癖で使った
- **予防**: 本番用の service role key は **ローカルに置かない**。操作時は Supabase Studio の本番/dev 切替を視覚確認
- **対処**: バックアップ（毎日の snapshot）から復元、影響範囲を特定

### 6.4 Vercel Cron と Supabase Edge Function の時刻差
- **症状**: Cron が意図した時間に動かない
- **原因**: Vercel Cron は UTC、Supabase Edge Function は UTC（ただし設定次第）。JST で指定したつもりが UTC 指定になる
- **予防**: Cron 式は必ず UTC で書き、コメントに JST 換算を併記（`"0 9 * * *"  # 18:00 JST`）
- **対処**: Bloom 設計書 §4.4 準拠

---

## 7. ドキュメント・運用

### 7.1 設計書が実装と乖離
- **症状**: 「仕様書ではこう」「実装ではこう」の食い違い
- **原因**: 実装優先で仕様書更新が後回し
- **予防**: PR マージ時に「仕様書更新済？」のチェック項目を必須化
- **対処**: 月次レビュー（§18）で差分洗い出し

### 7.2 `docs/effort-tracking.md` の実績記入忘れ
- **症状**: 見積と実績の比較ができず、次の見積が感覚頼り
- **原因**: Phase 完了時の記入ルールが浸透しきっていない
- **予防**: Phase 完了の commit に「effort-tracking 更新」を含める運用
- **対処**: `§12` 準拠、各セッションで継続徹底

### 7.3 auto モードの存在を社内で隠蔽しきれない
- **症状**: ステータス「集中業務中」が頻繁すぎて不審がられる
- **原因**: 用語選択の詰めが甘い
- **予防**: Bloom CLAUDE.md のステータス 4 種（対応可能/取り込み中/集中業務中/外出中）を厳守。通知文面に「AI アシスト」等の言葉を使わない
- **対処**: 月次ダイジェストでも「稼働サマリ」は auto/手動を区別せずに合算

---

## 8. 記載方針

- 新ハマりを追記するときは **症状 / 原因 / 予防 / 対処** の 4 点セットで書く
- モジュール固有の例も書くが「一般則」を冒頭に抽出する
- 解消されたハマりは「解消済：YYYY-MM-DD」注記を付けて残す（削除しない）
- 月次レビュー時に本ファイルを棚卸しし、陳腐化した項目を整理

### 今後追加予定のカテゴリ（未起票）
- セキュリティ（CSRF / XSS / SQL injection の Next.js + Supabase 特有事情）
- パフォーマンス（N+1 / Supabase の PostgREST 特性）
- 国際化・多言語（全角/半角、文字コード）

— end of known-pitfalls v1 —
