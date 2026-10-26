# Codex-442：閲覧権限の歯車を Root の画面にも付ける（第 2 弾・2026-10-26）

## 目的
Codex-437 で System の画面に付けた「閲覧権限の歯車」を **Root（組織台帳）の画面**にも付ける。順番は東海林さんの開発ボードの回答「Root → Bud → Sprout → ほか」。決まりは System と同じ（正本＝`C:\Users\shoji\.claude\projects\C--garden-main028\memory\project_view_permissions.md`・`docs/dispatches/dispatch-codex-437-view-permissions-system-pages-20261026.md`・`src/lib/auth/system-view-scopes.ts`・`supabase/migrations/20261026000005_system_view_scopes.sql` を先に読む）：
- 設定を変えられるのは全権管理者だけ。見られる人＝役職＋個人。設定が無ければ**今の決まり（既定）のまま＝誰の見え方も変えない**。タブ→画面→既定。
- 見られない人にはサイドバーの項目・タブを出さず、URL 直打ち・データの API も止める。設定で見られるようになった人は判定後に管理者接続で読む。**書き込みの権限は広げない**（Root の書き込みは今の `ROOT_WRITE_ROLES` などのまま）。

## 対象（Root の画面）
ホーム（/root）・従業員マスタ（/root/employees）・法人マスタ（/root/companies）・取引先（/root/vendors）・銀行口座（/root/bank-accounts）・口座の点検（/root/bank-check）・給与体系（/root/salary-systems）・社会保険（/root/insurance）・勤怠データ（/root/attendance）・KOT 同期履歴（/root/kot-sync-history）・契約書（/root/contracts）・受信箱（/root/inbox）・権限一覧（/root/permissions）。ログイン（/root/login）は対象外。
- タブのある画面はタブごとにも（key を `system-view-scopes.ts` 相当の一覧に登録）。page_key は `root-employees` のように `root-` で始める。
- 既定は今の入口の判定（`ROOT_VIEW_ROLES` など・`permission-registry.ts`）と同じ結果になるように。

## やること
1. **DB（migration を作るだけ・本番に当てない）**：`system_view_scopes` に Root の画面・タブの行を足す（既定の役職も）。
2. 各画面の入口・データの API を `canView` に通す。Root のサイドバー（Root の外枠）も canView で出し分け。
3. 歯車（`ViewPermissionButton`）を各画面のタブの行の右端（タブが無ければ h1 の行の右端）に。全権管理者だけに出る。
4. 小窓は Codex-440 の共通部品（`src/app/system/_components/Modal/`）の見た目のまま。
5. テスト：画面ごとに「設定なし＝今と同じ見え方」（8 役職）／広げる・狭める／書き込みは広がらない／未登録の key は拒否。`npx vitest run` が全部通ること（Codex-441 で全部通る状態にしてある前提）。

## 触らないもの
- System・Bud など他モジュール。本番 DB・環境変数。**git は触らないでください。コミットは人間側が行います。** npm install はしない。

## 確認
`npx tsc --noEmit`・`npx vitest run`。日本語が「???」に化けていないこと。ファイルの先頭に BOM を付けないこと。

## 完了報告（コードブロックで）
対象の画面とタブ／migration のファイル名／テスト結果／「設定なしで見え方が変わる画面」が無いことの確認結果。
