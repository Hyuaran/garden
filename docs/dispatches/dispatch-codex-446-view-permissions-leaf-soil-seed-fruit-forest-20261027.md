# Codex-446：閲覧権限の歯車を Leaf・Soil・Seed・Fruit・Forest の画面にも付ける（第 5 弾・2026-10-27）

## 目的
Codex-437（System）・442（Root）・444（Bud）・445（Sprout・Rill）と同じ仕組みを、**Leaf（案件アプリ）・Soil（データベース）・Seed・Fruit・Forest** の画面にも付ける（開発ボードの回答「Root → Bud → Sprout → ほか」）。

決まりは同じ（先に読む：`C:\Users\shoji\.claude\projects\C--garden-main028\memory\project_view_permissions.md`・`docs/dispatches/dispatch-codex-444-view-permissions-bud-pages-20261026.md`・`docs/dispatches/dispatch-codex-445-view-permissions-sprout-rill-20261027.md`・`src/lib/auth/system-view-scopes.ts`・`supabase/migrations/` の 20261026000005〜07 と 445 の migration）：
- 設定を変えられるのは全権管理者だけ。見られる人＝役職＋個人。**設定が無ければ今の決まりのまま＝誰の見え方も変えない**。タブ→画面→既定。
- 見られない人にはサイドバーの項目・タブを出さず、URL 直打ち・データの API／server action も止める。設定で見られるようになった人は判定後に管理者接続で読む。**書き込みの権限は広げない**。

## 対象
- **Leaf**（今の入口＝`src/app/leaf/layout.tsx`）：/leaf・/leaf/kanden・/leaf/kanden/input・/leaf/kanden/backoffice。page_key は `leaf-` で始める。タブがあればタブごとにも。**関電トスポータル（/p/toss）は対象外**＝今のまま。
- **Soil**（`src/app/soil/layout.tsx`）：/soil。`soil-`。
- **Seed**（`src/app/seed/layout.tsx`）：/seed。`seed-`。
- **Fruit**（`src/app/fruit/layout.tsx`）：/fruit。`fruit-`。
- **Forest**（`src/app/forest/layout.tsx`）：/forest 配下 12 画面（ダッシュボード・会社概要・決算書・登記変更・レポート・進行期・仕訳帳と残高一覧・確認画面など）。`forest-`。決算・仕訳＝お金の画面なので「見られる人が人を追加できる」は **DB の check で禁止**（Bud と同じ）。
- Leaf の顧客情報（氏名・住所・電話）が出る画面も「見られる人が追加」は禁止。
- 各モジュールの `src/app/api/<module>/` の読み取りも canView に通す。外部からの受け口（cron・Webhook・Bearer 認証の口）は対象外。
- 既定は今の入口の判定と同じ結果に（8 役職で今と同じ見え方）。中身がモックの画面も、今見られる人がそのまま見られること。

## やること
1. **DB（migration を作るだけ・本番に当てない）**：`system_view_scopes` に上の画面・タブの行を足す。「見られる人が追加」禁止の check も。
2. 各画面の入口・データの読み取りを `canView` に通す。各モジュールの外枠のサイドバーも canView で出し分け。
3. 歯車（`ViewPermissionButton`）を各画面のタブの行の右端（タブが無ければ h1 の行の右端）に。全権管理者だけ。
4. テスト：画面ごとに「設定なし＝今と同じ見え方」（8 役職）／広げる・狭める／書き込みは広がらない／/p/toss は変わらない。`npx vitest run` が全部通ること（FAIL 0）。

## 触らないもの
- System・Root・Bud・Sprout・Rill・Tree・Bloom。/p/toss。本番 DB・環境変数。**git は触らないでください。コミットは人間側が行います。** npm install はしない。

## 確認
`npx tsc --noEmit`・`npx vitest run`。日本語が「???」に化けていないこと。ファイルの先頭に BOM を付けないこと。

## 完了報告（コードブロックで）
対象の画面とタブ／migration のファイル名／テスト結果（件数・FAIL 0）／「設定なしで見え方が変わる画面」が無いことの確認結果。
