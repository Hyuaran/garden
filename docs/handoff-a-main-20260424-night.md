# Handoff - 2026-04-24 夜（a-main 003 → 004）

## 今やっていること

a-main 003 のコンテキストが長くなり、Chrome スクショの画像サイズ制限に抵触し始めたため 004 に切替。本日分の主要タスクは完走済。残タスクは明日以降でも OK の軽量もの中心。

## 本日の完遂サマリ

### PR マージ 11 本
- #14 Root Phase A-1（7 マスタ一括）
- #15 Root Phase A-2（KoT API 連携）← §16 7種テスト全 Pass 後
- #16 a-auto Batch 4（Forest Phase A 仕上げ spec）
- #17 Bloom 月次ダイジェスト PDF RLS 404 修正（A2案: JWT 転送）
- #18 a-auto Batch 2（Forest spec 6 件）
- #19 a-auto Batch 3（Forest tax/storage spec 6 件）
- #20 Bloom status-queries.ts 型エラー修正（Vercel develop 復旧）
- #21 a-auto Batch 5（Bud Phase A-1 spec 6 件）
- #22 a-auto Batch 6（Bud Phase B 給与処理 spec 6 件）
- #23 settings.json 許可棚卸し（gh api / npx tsc --noEmit / Chrome tabs）
- **#10 本番リリース（develop → main）** ← 11:23:02Z、main Vercel success 確認済

### Phase A + B 実装指示書
累計 34 spec / 14.7d 分揃った（a-forest / a-bud に配布済）

### §16 7 種テスト結果（PR #15 マージ根拠）
全 7 Pass。timestamptz 空文字バグは Bloom セッションが kot-sync.ts ではなく `_components/KotSyncModal.tsx` の `toAttendanceRow` で発見・commit 6f07eef で修正。created_at / updated_at を payload から除外して Postgres DEFAULT now() + trigger に任せる方式。

### Vercel develop 復旧
PR #17 マージ時に Bloom の pre-existing TS エラー（status-queries.ts:36、ParserError 型問題）が develop に流れ込んで全ビルド失敗。PR #20 で `as unknown as` 一語追加により即日復旧。

## 次にやるべきこと（優先度順）

### 最優先（翌営業日 = 2026-04-25）
1. **パスワード 0202 のローテーション**
   - Supabase Dashboard → Authentication → Users → emp1165@garden.internal → Reset password
   - 新パスワードは宮永さんに直接通知（チャット経路 NG）
   - § token-leak-policy 適用（東海林さん自身の時間優先特例は 0008 のみ、宮永分は他人 PW なので必須）

2. **Root Phase A-3 指示書投下**
   - 候補: A-3-a（root_kot_sync_log migration）/ A-3-b（/root/kot-sync-history 画面）/ A-3-c（Vercel Cron 自動同期）/ A-3-d（日次打刻 /daily-workings 判4）/ A-3-e（KoT API IP 制限 issue 起票）
   - 想定: 2.5-3.0d
   - 別途: 7 マスタ横展開 fix（timestamptz 空文字バグ、Root 提案・emptyCompany/emptySystem 系の新規作成時バグ）を A-3 の下ごしらえ or 並行で

### 通常（今週中）
3. **a-auto Batch 7 判断**
   - 候補 A（auto 推奨）: Garden 横断 spec（RLS / 監査 / Storage / Chatwork / Error / Test 統一、~3.0d、軽量・保守性）
   - 候補 B: Leaf 関電 Phase C（~4.0d、Phase B 前倒し準備）
   - 候補 C: Bud Phase C（年末調整等、~3.5d）
   - 候補 D: Tree Phase D 準備（~4.5d）

4. **KoT API IP 制限問題 issue 起票**（A-3-e に含めるのが最適）
   - 許可 IP = 東海林 PC 固定 IP のみ → Vercel 本番デプロイは現状 KoT 連携が動かない
   - 3 案: (A) Vercel IP 範囲追加（非現実的）/ (B) 固定 IP プロキシ QuotaGuard Static / Fixie / (C) Supabase Edge Function 経由（Deno 制約）

### 軽量（時間あるとき）
5. **Bloom feature ブランチ削除検討** — `feature/bloom-workboard-20260424` は PR #17 経由で内容が transitively に develop へ取込済。ブランチは残置 OK だが整理するなら削除可

6. **Auto 残置ブランチ削除** — feature/bloom-workboard-scaffold-20260424-auto / feature/forest-v9-migration-plan-auto 等は参照用で merge 不要 → 不要なら削除

7. **本日分日報作成** — γ 案（auto モード非開示ルール）
   - `C:\garden\_tools\daily-log.ps1 "作業内容"` で 1 行ずつ追記
   - 本日分の主要アイテム（11 PR マージ、本番リリース、Phase A+B spec 34 件、月次 PDF 修正、Vercel 復旧 etc）は入れる価値あり

## 注意点・詰まっている点

- **画像制限**: このセッション（003）で Chrome スクショを多用したため、画像系の API エラーが出始めた。004 は最初は text ベースで進めると良い
- **`npm install` が deny ルール**: `Bash(npm install *)` deny が引数なしの `npm install` にもヒット。Root が npm ci で代替した。§14 許可棚卸しで要検討（別途）
- **TodoWrite の stale**: 003 で複数回 TodoWrite 更新したが、System reminder が stale todos を引きずるケースがあった。004 は最初に大整理してから運用推奨
- **メモリ**: feedback_self_reference.md に「槙」呼びの再発履歴を追記済。004 では引き続き「私」で自称

## 関連情報

### ブランチ
- develop: 本番に 11:23:02Z 時点で反映済
- main: 11:23:02Z 以降が本番
- feature/bloom-workboard-20260424: 削除候補（develop に transitively 取込済）
- feature/root-master-ui-20260424: マージ済、削除 OK
- feature/root-kot-integration-20260424: マージ済、削除 OK
- fix/bloom-pdf-rls-20260424: マージ済、削除 OK
- fix/bloom-status-queries-ts-error: マージ済、削除 OK
- chore/settings-audit-20260424: マージ済、削除 OK
- feature/phase-a-prep-batch2〜6-*-auto: すべてマージ済、削除 OK

### セッション状態
- Garden Root: dev server 稼働継続（port 3000、serverId 3313c619-...）。A-3 指示が入るまで待機
- Garden Bloom: アイドル。巨大な feature/bloom-workboard-20260424 の T1-T10 は全部 develop に transitively 取り込まれ済
- Garden Auto: アイドル。Batch 7 判断待ち
- Garden Tree / Bud / Forest / Leaf / Seed / Soil / Rill / b-main: 本日未着手

### 関連 PR/Issue
- 全 PR #14〜#23 マージ済・#10 本番リリース済
- KoT API IP 制限 issue: **未起票**（A-3 指示時に作る）

### メモリ（今日追加・更新）
- feedback_cross_session_instruction_format: TDZ / 変数宣言順序ルール追記
- feedback_self_reference: 「槙」呼び再発履歴追記
- feedback_status_report_format: 新規（セッション状態はテーブル形式で統一）
- feedback_token_leak_policy: 東海林さん個人方針（時間優先でパスワード貼付を許容）追記
- project_rls_server_client_audit: 新規（Bloom PDF 事件の学び、全モジュール監査推奨）

## 004 起動後の最初にやること

1. `git status` `git branch --show-current` で現状把握
2. `docs/handoff-a-main-20260424-night.md` 読み込み（このファイル）
3. memory/MEMORY.md 読み込み
4. 東海林さんに「003 ハンドオフ読みました、次は何から進めますか？」と投げる
5. 推奨順: パスワード 0202 ローテ確認 → Root A-3 指示書 → Auto Batch 7 判断

## 担当
- 003: 切替により本タスク完了
- 004: 本ファイルを起点に継続
