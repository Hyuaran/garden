# Codex-444：閲覧権限の歯車を Bud（経理・収支）の画面にも付ける（第 3 弾・2026-10-26）

## 目的
Codex-437（System）・442（Root）と同じ仕組みを **Bud の画面**にも付ける（開発ボードの回答「Root → Bud → Sprout → ほか」）。決まりは同じ（先に読む：`C:\Users\shoji\.claude\projects\C--garden-main028\memory\project_view_permissions.md`・`docs/dispatches/dispatch-codex-437-view-permissions-system-pages-20261026.md`・`docs/dispatches/dispatch-codex-442-view-permissions-root-pages-20261026.md`・`src/lib/auth/system-view-scopes.ts`）：
- 設定を変えられるのは全権管理者だけ。見られる人＝役職＋個人。**設定が無ければ今の決まりのまま＝誰の見え方も変えない**。タブ→画面→既定。
- 見られない人にはサイドバーの項目・タブを出さず、URL 直打ち・データの API も止める。設定で見られるようになった人は判定後に管理者接続で読む。**書き込み（承認・振込・仕訳・取り込み・設定の保存など）の権限は広げない**。

## 既にある閲覧者の設定との関係（大事）
- **口座残高・カード利用**（`/bud/bank`・`bud_mf_group_viewers` と口座ごとの viewers）と**事業の収支**（`/bud/profit/broadband`・`bud_bb_viewers`）は、もう独自の閲覧者設定と歯車がある。**この 2 画面は今の設定と歯車をそのまま残す**（新しい仕組みに移さない・二重に歯車を出さない）。新しい仕組みの scope にも登録しない（完了報告に「既存の設定のまま」と書く）。

## 対象（それ以外の Bud の画面）
ダッシュボード（/bud/dashboard）・入金管理（/bud/receivables）・請求書管理（/bud/invoices）・経費精算（/bud/expenses）・給与管理（/bud/payroll）・振込管理（/bud/transfers）・仕訳帳（/bud/journal・/bud/shiwakechou）・明細（/bud/statements）・損益管理（/bud/profit のうち事業の収支以外）・マスタ管理（/bud/masters）・監査ログ（/bud/audit）・設定（/bud/settings）。ログイン（/bud/login）は対象外。
- タブのある画面（経費精算・振込管理など）はタブごとにも。page_key は `bud-expenses` のように `bud-` で始める。
- 既定は今の入口の判定（Bud の権限・`permission-registry.ts`・各画面の role 判定）と同じ結果になるように。大半がモックの画面（振込管理など）も、今見られる人がそのまま見られること。

## やること
1. **DB（migration を作るだけ・本番に当てない）**：`system_view_scopes` に Bud の画面・タブの行を足す。
2. 各画面の入口・データの API を `canView` に通す。Bud の外枠（BudShachoShell）のサイドバーも canView で出し分け。
3. 歯車（`ViewPermissionButton`）を各画面のタブの行の右端（タブが無ければ h1 の行の右端）に。全権管理者だけ。
4. テスト：画面ごとに「設定なし＝今と同じ見え方」（8 役職）／広げる・狭める／書き込みは広がらない／口座残高・事業の収支は今の設定のまま。`npx vitest run` が全部通ること。

## 触らないもの
- 口座残高・事業の収支の閲覧者設定と歯車。System・Root。本番 DB・環境変数。**git は触らないでください。コミットは人間側が行います。** npm install はしない。

## 確認
`npx tsc --noEmit`・`npx vitest run`。日本語が「???」に化けていないこと。ファイルの先頭に BOM を付けないこと。

## 完了報告（コードブロックで）
対象の画面とタブ／migration のファイル名／テスト結果／「設定なしで見え方が変わる画面」が無いことの確認結果。
