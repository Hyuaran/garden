# Codex-437：閲覧権限の歯車を System の画面にも付ける（第 1 弾・2026-10-26）

## 目的
Codex-432 で作った「画面・タブごとの閲覧権限（歯車で設定）」の仕組みを、入社手続き以外の **System の画面**にも付ける（東海林さん「口座みたいに閲覧権限を全てのページ、必要であればタブごとにつけれるようにしよう」）。決まりは入社手続きと同じ：
- 設定を変えられるのは全権管理者だけ（歯車もその人にだけ）。見られる人＝チェックした役職＋追加した個人。全権管理者は外せない。設定が無ければ**今のコードの決まり（既定）のまま**。タブ→画面→既定の順。
- 「見られる人が人を追加できる」は既定オフ。
- 権限の無い人には**サイドバーの項目・タブを出さず、データも読ませない**。設定で見られるようになった人は、判定後に管理者接続で読む。**書き込みの権限は広げない**。
- 仕組みの正本：`C:\Users\shoji\.claude\projects\C--garden-main028\memory\project_view_permissions.md` と、`src/lib/auth/view-permission.server.ts`・`src/app/system/_components/ViewPermissionButton/`・`supabase/migrations/20261026000002_system_view_permissions.sql`（先に読む）。

## 対象（System のサイドバーの画面）
ホーム（/system）・資料（/system/docs）・マニュアル（/system/manuals）・自分の情報（/system/mypage）・勤怠打刻（/system/attendance）・シフト（/system/shift）・前確依頼（/system/zenkaku）・テレマコール集計（/system/call-metrics）・INNOVERA履歴・録音（/system/innovera-calls）・業務管理ツール（/system/forms）・契約書管理（/system/contracts）・コーポレートサイト（/system/sites）・自動配信（/system/deliveries）・管理表ポータル（/system/kanri）・リストマスタ（/system/list）。
- タブのある画面（リストマスタ・コーポレートサイト・業務管理ツールなど）は、タブごとにも設定できるようにする（タブの key を registry に登録）。
- 既定（今の決まり）は `src/lib/auth/permission-registry.ts` と各画面の入口の判定をそのまま使う。**今の見え方を 1 つも変えない**こと（設定しなければ誰の見え方も変わらない）。
- 「自分の情報（マイページ）」「勤怠打刻」など**本人の分だけを見る画面**は、画面の入口には付けるが、他人のデータが見えるようになるわけではない（本人の分のまま）。
- 関電トスポータル（/p/toss）は対象外（別の入口・外部の人が使う）。

## やること
1. **DB（migration を作るだけ・本番に当てない）**：今の `system_view_default_roles` は入社手続きしか知らない。**画面・タブの一覧と既定の役職を表で持つ**形に直す：`system_view_scopes`（page_key・tab_key・label・default_roles text[]）を作り、対象の画面・タブを登録（既定の役職は registry と同じ）。`system_view_default_roles`・保存・追加・既定に戻すの RPC は、この表を見て「知らない画面は拒否」「既定はこの表」にする。入社手続きの行も入れる。
2. **判定**：各画面の入口（page.tsx／layout.tsx）と、その画面のデータの API を `canView(pageKey, tabKey)` に通す（既定は今と同じ結果になるように）。サイドバー（`ShachoShell`）も canView で出し分け（既に Codex-432 で仕組みがあれば使う）。
3. **歯車**：各画面のタブの行の右端（タブが無い画面は h1 の行の右端）に `ViewPermissionButton`。対象は「画面全体」と「このタブ」。
4. **Root「権限一覧」**に、設定で変えた画面・タブが分かるように出る（Codex-432 の仕組み）。
5. テスト：画面ごとに「設定なし＝今と同じ見え方」（役職ごと）／設定で広げると見える・データも読める／狭めると見えない・API 403／書き込みは広がらない／知らない画面の key は RPC で拒否。

## 触らないもの
- Root・Bud・Sprout などほかのモジュール（次の弾でやる）。口座残高・事業の収支の既存の閲覧者設定。本番 DB・環境変数。**git は触らないでください。コミットは人間側が行います。** npm install はしない。

## 確認
`npx tsc --noEmit`・`npx vitest run src/lib/auth src/app/system src/app/api/system`。日本語が「???」に化けていないこと。ファイルの先頭に BOM を付けないこと。

## 完了報告（コードブロックで）
変更した画面の一覧（画面名・タブ）／migration のファイル名／テスト結果／気になった点（特に「設定なしで見え方が変わってしまう画面」が無いか、判定を通したのに読めないデータ・読めてしまうデータが無いか）。
