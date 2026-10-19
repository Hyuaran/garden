# Codex-386：新機能のお知らせ（モーダル＋お知らせページ＋ベル 第 1 弾）（2026-10-19）

## 正本（必ず全文を読む）
`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\100_Projects\110_Garden\150_System_システム\08_新機能のお知らせ\001_設計_新機能のお知らせ_モーダルとお知らせページ_v1_20261019.md`

## 下調べ（Claude 調べ・ファイルは読んで確かめること）
- ログイン＝Supabase Auth。画面側の利用者・役職＝`src/app/_lib/auth-unified.tsx` の `useAuthUnified()`（root_employees の garden_role・employee_number）
- 役職＝`src/app/root/_constants/types.ts`（8 種類・`isRoleAtLeast`・`GARDEN_ROLE_LABELS`）
- 全画面に 1 か所で差し込める場所＝`src/app/layout.tsx`（AuthProvider > ThemeProvider > ClarityTracker > ShojiStatusProvider）。モーダルは ClarityTracker と同じ位置に 1 つ置く
- System の外枠＝`src/app/system/_components/ShachoShell/ShachoShell.tsx`（右上の操作欄・スマホの上部バー。今はテーマ切替とログアウトだけ）
- ホームの「お知らせ」リンク＝`GardenHomeClient.tsx` の `/notices`（ページが無い）。スマホ＝`src/app/m/news`（仮画面）・下部ナビ `m/_lib/mobile-nav.ts`
- 本人だけ書ける RLS の手本＝`supabase/migrations/20260508000001_bud_phase_d04_statement_distribution.sql` の `employee_id = (select id from root_employees where user_id = auth.uid())`
- 権限一覧の正本＝`src/lib/auth/permission-registry.ts`
- 汎用モーダルの例＝`src/app/root/_components/Modal.tsx`

## 画面の絵
モーダル（その日に初めて開いたとき・未確認があるとき）
```
┌──────────────────────────────────────────────┐
│  Garden からのお知らせ（2 件）                    │
├──────────────────────────────────────────────┤
│  [新しい機能]  2026-10-19                         │
│  契約書・条件表の保存チェックができました            │
│  説明（2〜3 行）                                   │
│  → マニュアルを見る                                │
│ ─────────────────────────────────────────── │
│  [不具合の修正]  2026-10-19                        │
│  見出し                                           │
│  これまで：…                                      │
│  これから：…                                      │
│  → マニュアルを見る                                │
├──────────────────────────────────────────────┤
│  すべてのお知らせを見る                             │
│                  [ あとで ]   [ 確認しました ]       │
└──────────────────────────────────────────────┘
```
お知らせページ `/notices`
```
┌ お知らせ ───────────────────────────── [未確認だけ表示 □] ┐
│ 種類：[すべて▼]   モジュール：[すべて▼]                      │
├────────────────────────────────────────────┤
│ ● 2026-10-19 [新しい機能] 見出し                              │
│      説明 …                        → マニュアルを見る          │
│   2026-10-15 [使い勝手の改善] 見出し                          │
│      これまで：… ／ これから：…        → マニュアルを見る       │
├────────────────────────────────────────────┤
│ （super_admin だけ）下書き  n 件                              │
│   [新しい機能] 見出し … （モーダルでの見え方）  [ 公開する ]     │
└────────────────────────────────────────────┘
```
ベル（ShachoShell の右上・テーマ切替の左）：` [ベル 2] [テーマ] [ログアウト] `

## 作るもの
1. **migration** `supabase/migrations/20261019000002_system_notices.sql`（適用は Claude がする）
   - `system_notices`：id uuid・kind text check in ('feature','improvement','fix')・title・body・before_text・after_text（改善・修正のとき必須＝check で kind='feature' 以外は両方 not null）・manual_href・module text・visible_roles text[] default '{}'（空＝全員）・status text check in ('draft','published') default 'draft'・published_at timestamptz・created_at
   - `system_notice_reads`：notice_id・employee_id・acknowledged_at default now()・主キー（notice_id, employee_id）
   - `system_notice_snoozes`：employee_id 主キー・snoozed_on date
   - RLS：notices は published かつ（visible_roles が空 か 本人の garden_role を含む）を authenticated が読める。draft は super_admin だけ読める・公開（status と published_at の更新）も super_admin だけ。reads・snoozes は本人の行だけ読み書き
2. **部品** `src/app/_components/notices/`
   - `NoticeModal.tsx`（ルート layout に置く）：ログイン中で、除外パス（`/login`・`/p/` で始まる・`/access-denied`・`(orientation)` の発表用画面＝パスに `/present` を含む）でなければ、未確認の公開済みお知らせを取る。**未確認が 1 件以上・今日（日本時間）「あとで」を押していない・入社日より後に公開されたもの**だけ出す（入社日＝root_employees にある入社日の列。無ければこの条件は外す）
   - 新しい順に最大 5 件。6 件以上は「ほか n 件はお知らせページで」
   - 「確認しました」＝表示中の全件を reads に入れる／「あとで」・×・Esc・外側＝snoozes を今日にする。**押した瞬間に閉じ、記録は裏で**（失敗しても画面は止めない）
   - 画面の表示を待たせない（取得は描画のあと）。スマホ幅は全画面・ボタンは下に固定
   - 見た目は社長スタイル（ゴシック・濃紺／ティール・`globals.css` の色の変数を使い、ライト・ダーク両方で読めること）。絵文字は使わない（種類はことばのラベル）
   - `NoticeBell.tsx`：未確認の数（0 なら数字なし）。押すと `/notices`
   - `NoticeList.tsx`：お知らせページとスマホで共用
   - データの読み書きは `src/lib/notices/`（型・取得・既読・あとで・公開）にまとめ、テストを書く
3. **お知らせページ** `src/app/notices/page.tsx`（ログインだけ必要・役職で見えるものだけ）。絞り込み＝種類・モジュール・未確認だけ。super_admin には「下書き」欄（モーダルでの見え方のプレビュー＋「公開する」ボタン＝status を published・published_at を今に）
4. **スマホ** `src/app/m/news` を `NoticeList` に置き換え。下部ナビの「お知らせ」に未確認の数
5. **ベル**：ShachoShell の右上（テーマ切替の左）とスマホの上部バーに `NoticeBell`
6. **権限一覧** `permission-registry.ts` にお知らせページ（全員）を足す。テストの件数も合わせる
7. 表の見出し行は中央ぞろえ、日時は `2026-10-19 12:34:56` の形（お知らせの日付は日だけでよい）

## 守ること
- **commit・push しない・DB に接続しない**（migration の適用と本物での確認は Claude がする）
- 他の外枠（Rill・Root・Tree・GardenShell）のベルは触らない（第 2 弾）
- 画面の文言に開発者用語を書かない
- `npx vitest run src/lib/notices src/app/_components/notices src/app/notices src/app/m src/app/system/_components src/lib/auth` と `npx tsc --noEmit -p .` が通ること。前から落ちているテスト（AppHeader・KpiCard・BackgroundCarousel）は触らない

## 報告（日本語・コードブロック）
- 作った・変えたファイル
- テストの結果（対象・型チェック）
- Claude が手元で確かめるときの手順（下書きを 1 件入れる SQL の例を含む）
