# Codex-445：閲覧権限の歯車を Sprout（採用）と Rill（メッセージ）の画面にも付ける（第 4 弾・2026-10-27）

## 目的
Codex-437（System）・442（Root）・444（Bud）と同じ仕組みを **Sprout と Rill の画面**にも付ける（開発ボードの回答「Root → Bud → Sprout → ほか」）。あわせて、開発ボードの回答「採用管理の表の上に検索の欄が2つある → 表の部品の検索を消して『名前・電話で探す』だけにする」も直す。

決まりは同じ（先に読む：`C:\Users\shoji\.claude\projects\C--garden-main028\memory\project_view_permissions.md`・`docs/dispatches/dispatch-codex-437-view-permissions-system-pages-20261026.md`・`docs/dispatches/dispatch-codex-444-view-permissions-bud-pages-20261026.md`・`src/lib/auth/system-view-scopes.ts`・`supabase/migrations/20261026000007_*.sql`）：
- 設定を変えられるのは全権管理者だけ。見られる人＝役職＋個人。**設定が無ければ今の決まりのまま＝誰の見え方も変えない**。タブ→画面→既定。
- 見られない人にはサイドバーの項目・タブを出さず、URL 直打ち・データの API／server action も止める。設定で見られるようになった人は判定後に管理者接続で読む。**書き込み（応募者の登録・更新・面接の予定変更・バイトルの取り込みや設定の保存・メールの送信など）の権限は広げない**。

## 対象
### Sprout（今の入口＝`src/app/sprout/layout.tsx` の ModuleGate module="sprout"）
- 採用管理（/sprout）：タブ「応募者」「面接予定」「研修予定」それぞれにも。page_key は `sprout-applicants` のように `sprout-` で始める。
- 掲載管理（/sprout/postings）：タブ「バイトル」にも。
- データ：`src/app/sprout/actions.ts`・`src/app/sprout/postings/baitoru-actions.ts`・`src/app/api/sprout/` の読み取りを canView に通す。`/api/sprout/baitoru/ingest`（外からの取り込み口）は対象外＝今のまま。
- 応募者は個人情報なので「見られる人が人を追加できる」は **DB の check で禁止**（Bud と同じやり方）。

### Rill（今の入口＝`src/app/rill/layout.tsx` の admin 以上）
- メッセージ（/rill・/rill/mail）。画面の中にタブ（受信箱の切り替えなど）があれば、タブごとにも。page_key は `rill-` で始める。
- メールは個人の受信箱なので「見られる人が人を追加できる」は **DB の check で禁止**。広げても**読める受信箱の範囲は今の判定のまま**（他人の受信箱が読めるようにはしない）。送信・既読・移動などの書き込みも広げない。
- `/api/rill/` の読み取りも canView に通す。

### 既定（設定が無いとき）
今の入口の判定と同じ結果になるように（Sprout＝ModuleGate の sprout の判定、Rill＝admin 以上）。8 役職で今と同じ見え方。

## 検索の欄（Sprout 採用管理）
- 表の上に「名前・電話で探す」（`src/app/sprout/sprout.tsx` の FilterBox）と、表の部品（`src/app/system/_components/DataTable/DataTable.tsx`）の検索の 2 つが出ている。**表の部品の検索を消して「名前・電話で探す」だけにする**。
- DataTable に検索を出さないための指定（例：`searchable={false}`・既定は今どおり出す）を足し、Sprout だけで使う。**ほかの画面の表の見え方は変えない**。

## やること
1. **DB（migration を作るだけ・本番に当てない）**：`system_view_scopes` に Sprout・Rill の画面・タブの行を足す。「見られる人が追加」禁止の check も。
2. 各画面の入口・データの読み取りを `canView` に通す。Sprout の外枠（sprout-shell）・Rill の外枠（RillShachoShell）のサイドバーも canView で出し分け。
3. 歯車（`ViewPermissionButton`）を各画面のタブの行の右端（タブが無ければ h1 の行の右端）に。全権管理者だけ。
4. 検索の欄を 1 つに（上記）。
5. テスト：画面ごとに「設定なし＝今と同じ見え方」（8 役職）／広げる・狭める／書き込みは広がらない／Rill は他人の受信箱が読めない／Sprout の表に検索が 1 つだけ。`npx vitest run` が全部通ること（FAIL 0）。

## 触らないもの
- System・Root・Bud。バイトルの取り込み口。本番 DB・環境変数。**git は触らないでください。コミットは人間側が行います。** npm install はしない。

## 確認
`npx tsc --noEmit`・`npx vitest run`。日本語が「???」に化けていないこと。ファイルの先頭に BOM を付けないこと。

## 完了報告（コードブロックで）
対象の画面とタブ／migration のファイル名／テスト結果（件数・FAIL 0）／「設定なしで見え方が変わる画面」が無いことの確認結果／検索の欄の直し方。
