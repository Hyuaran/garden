# Codex-448：閲覧権限の歯車を Bloom と Tree の画面にも付ける（第 6 弾・最後・2026-10-27）

## 目的
Codex-437（System）・442（Root）・444（Bud）・445（Sprout・Rill）・446（Leaf・Soil・Seed・Fruit・Forest）と同じ仕組みを、**Bloom と Tree の画面**にも付ける。これで全モジュールがそろう。

決まりは同じ（先に読む：`C:\Users\shoji\.claude\projects\C--garden-main028\memory\project_view_permissions.md`・`docs/dispatches/dispatch-codex-446-view-permissions-leaf-soil-seed-fruit-forest-20261027.md`・commit 8eca7a61 の `src/lib/auth/leaf-forest-view*.ts(x)`・`supabase/migrations/20261027000446_*.sql`）：
- 設定を変えられるのは全権管理者だけ。見られる人＝役職＋個人。**設定が無ければ今の決まりのまま＝誰の見え方も変えない**。タブ→画面→既定。
- 見られない人にはサイドバーの項目・タブを出さず、URL 直打ち・データの API も止める。設定で見られるようになった人は判定後に管理者接続で読む。**書き込みの権限は広げない**。

## 対象
### Bloom（今の入口＝`src/app/bloom/layout.tsx` の BloomGate）
/bloom・/bloom/blueprint・/bloom/ceo-status・/bloom/daily-report・/bloom/kpi・/bloom/monthly-digest（一覧・月・編集）・/bloom/progress・/bloom/roadmap・/bloom/workboard・/bloom/workboard/ceo-status。page_key は `bloom-` で始める。タブがあればタブごとにも。
- `src/app/api/bloom/` の読み取りも canView に通す。**`/api/bloom/cron`（定期実行の口）は対象外**＝今のまま。

### Tree（今の入口＝`src/app/tree/layout.tsx` の TreeAuthGate・全役職が通る）
/tree 配下の 24 画面（ダッシュボード・マイページ・架電・トス待ち・確認待ち・ラップアップ・フォローコール・検索・スクリプト・QA・動画・ランキング・アラート・アポラン・誕生日・休憩予定・Breeze・Chatwork・モニタリング・フィードバック一覧・架電の支店／Sprout など）。page_key は `tree-` で始める。
- Tree はトス・クローザーが毎日使う架電の画面。**既定は今の画面ごとの判定（各画面の role 判定・TreeShell のメニューの出し分け）と完全に同じに**。1 画面でも見えなくなる役職が出ないこと（ここが一番大事）。
- 中身がモックの画面も、今見られる人がそのまま見られること。
- `src/app/api/tree/` の読み取りも canView に通す。外部からの受け口（Bearer・cron・Webhook）は対象外。
- Tree は client の判定なので、サイドバー・タブの出し分けは client でよいが、データの API は server で止めること。

### 見られる人の追加
- Bloom（経営の数字）は「見られる人が人を追加」を **DB の check で禁止**。Tree は既定オフ（禁止まではしない）。

## やること
1. **DB（migration を作るだけ・本番に当てない）**：`system_view_scopes` に Bloom・Tree の画面・タブの行を足す。Bloom の追加禁止の check も。**既存の表に RLS の policy を足すときは、その表をほかのモジュールが読んでいないか確かめ、読んでいるなら足さない**（完了報告に書く）。
2. 各画面の入口・データの読み取りを `canView` に通す。外枠のサイドバーも canView で出し分け。
3. 歯車（`ViewPermissionButton`／`SystemViewButton`）を各画面のタブの行の右端（タブが無ければ h1 の行の右端）に。全権管理者だけ。
4. 英語のまま画面に出ている見出し・タブ名があれば、対象の画面に限り日本語に（完了報告に一覧）。
5. テスト：画面ごとに「設定なし＝今と同じ見え方」（8 役職。Tree はトス・クローザー・CS を特に）／広げる・狭める／書き込みは広がらない／cron の口は変わらない。`npx vitest run` が全部通ること（FAIL 0）。

## 触らないもの
- ほかのモジュール（System・Root・Bud・Sprout・Rill・Leaf・Soil・Seed・Fruit・Forest）。/api/bloom/cron。本番 DB・環境変数。**git は触らないでください。コミットは人間側が行います。** npm install はしない。

## 確認
`npx tsc --noEmit`・`npx vitest run`。日本語が「???」に化けていないこと。ファイルの先頭に BOM を付けないこと。

## 完了報告（コードブロックで）
対象の画面とタブ／migration のファイル名／テスト結果（件数・FAIL 0）／「設定なしで見え方が変わる画面」が無いことの確認結果（Tree は役職×画面の表で）／日本語にした見出し。
