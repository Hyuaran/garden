# Codex-432：画面・タブごとの閲覧権限（歯車で設定）の共通の仕組み＋入社手続きに適用（2026-10-26）

## 目的（東海林さん 2026-10-26 決定）
口座残高・事業の収支のように、**全部の画面（必要ならタブごと）に「見られる人」を歯車で設定できる**ようにする。今回は**共通の仕組み＋入社手続きの 4 タブへの適用**まで。ほかの画面は次から順に付ける（この指示書ではやらない）。

決まり：
1. 歯車で設定を変えられるのは**全権管理者（super_admin）だけ**。歯車も全権管理者にだけ出す。
2. 見られる人＝**チェックした役職 ＋ 追加した個人**。全権管理者は常に見られる（外せない）。
3. 何も設定していない画面・タブは**今のコードの決まり（既定）のまま**。設定した画面・タブだけ設定に従う。タブに設定が無ければ画面の設定、画面にも無ければ既定。
4. 画面（タブ）ごとに「**見られる人が人を追加できる**」のオン／オフ（既定オフ）。オンの画面では、見られる人が［＋ 人を追加］だけできる（役職のチェック・人を外す・オン／オフの切り替えは全権管理者だけ）。追加されたら Garden通知（Chatwork）へ「○○さんが△△さんを『画面名／タブ名』に追加しました」。
5. 誰がいつ何を変えたかを記録する。
6. 権限の無い人には**タブ・サイドバーの項目を出さず、データも読まない**（見えないだけで中身が取れる、にしない）。

## 画面の絵
```
入社手続き
 自分の入社手続き  入社予定者  入社後の確認  みんなの入社手続き              ⚙   ← タブの行の右端（TabActionButton icon="settings"）・全権管理者だけ
                                                    ↓
┌ 見られる人の設定 ──────────────────────┐
│ 対象  ( ) 画面全体  (●) このタブ「みんなの入社手続き」   │
│ 役職  ☑全権管理者（外せない） ☑管理者 ☑責任者 □社員 □CS □トス □クローザー □業務委託 │ ← 初めて開いたときは既定どおりにチェック
│ 個人  ［＋ 人を追加］  山田 花子 ×  鈴木 一郎 ×          │ ← 人を選ぶ部品は事業の収支の閲覧者設定と同じもの
│ □ 見られる人が人を追加できる                          │
│ 最終変更：東海林 美琴 2026/10/26(月) 12:01:33            │
│                         ［既定に戻す］［閉じる］［保存］ │
└──────────────────────────────┘
```
見本の見た目＝`src/app/bud/profit/broadband/BroadbandTable.tsx` の閲覧者設定（読むだけ・変えない）。社長スタイル §2.5（選ぶ欄の 3 種類・モーダル・ボタン）に従う。

## やること
1. **DB（migration を `supabase/migrations/` に追加・本番には当てない）**
   - `system_view_permissions`（`page_key text`・`tab_key text`（画面全体は `''`）・`roles text[]`・`employee_ids text[]`・`viewers_can_add boolean default false`・`updated_by`・`updated_at`・主キー (page_key, tab_key)）。
   - `system_view_permission_logs`（変更・追加の記録：誰が・いつ・何を・前後の値）。
   - RLS：読むのは本人がログインしていれば可（判定に使う）、書くのは RPC 経由だけ。
   - RPC：`system_save_view_permission(p_page, p_tab, p_roles, p_employee_ids, p_viewers_can_add)`（super_admin だけ）／`system_add_viewer(p_page, p_tab, p_employee_id)`（super_admin か、`viewers_can_add` がオンでその画面を見られる人）／`system_reset_view_permission(p_page, p_tab)`（super_admin だけ）。どれも記録を残す。
2. **判定（サーバー）**：`src/lib/auth/view-permission.server.ts` に `canView(pageKey, tabKey, viewer)`：設定（タブ→画面→既定）で判定。既定は `src/lib/auth/permission-registry.ts` の `allows(role)` を使う（画面・タブの key を registry に持たせる。入社手続きの 4 タブを `kind:"タブ"` で登録）。全権管理者は常に true。1 回の画面表示で設定を何度も読みに行かない（まとめて読む）。
3. **歯車と設定の画面（共通部品）**：`src/app/system/_components/ViewPermissionButton/`（タブの行の右端に置く歯車＋上の絵のモーダル）。API `src/app/api/system/view-permissions/route.ts`（GET＝その画面の設定・選べる人の一覧／PATCH＝保存・追加・既定に戻す）。人の一覧は在籍者（`root_employees` の is_active・退職日が今日より後）。
4. **入社手続きに適用**（Codex-431 で 1 画面 4 タブにした `src/app/system/onboarding/page.tsx`）：4 タブの出し分けを `canView("system-onboarding", tab)` に置き換える。既定は今のまま（自分の入社手続き＝全員／入社予定者・入社後の確認＝super_admin／みんなの入社手続き＝MANAGER_ROLES）。**設定で見られるようになった人がデータも読めるよう**、そのタブのデータ読み込み・API（`/api/system/hire-candidates*`・事務の一覧・1 人ぶんの詳細 `/system/onboarding/admin/[employeeId]` とその API）も同じ判定に通し、判定が通ったらサーバー側の管理者接続（`getSupabaseAdmin()`）で読む。判定が通らなければ今までどおり 403。
   - ［入社］（KOT 登録）・［辞退］・修正など**書き込みの操作は今の権限のまま**（見られるようになっても、書き込みは広げない）。
5. **サイドバー**：画面全体が見られない人にはサイドバーの項目を出さない（入社手続きは既定で全員なので今は変化なし。仕組みだけ）。
6. **Root「権限一覧」**（`/root/permissions`）：設定で変えた画面・タブは「設定で変更あり（○○さん 2026/10/26）」と分かるように出す。
7. **Garden通知**：追加の知らせは既存の Garden通知 の送り方（既存のヘルパー）を使う。**テストでは実際に送らない**（モック）。
8. テスト：既定どおり／役職のチェックで広げる・狭める／個人の追加／タブ→画面→既定の順／super_admin 以外は保存できない／viewers_can_add オフで追加できない・オンで追加できて通知が呼ばれる／見られない人は API が 403／書き込みの API は広がらない。

## 触らないもの
- `src/app/bud/bank/` 配下・事業の収支の閲覧者設定（今回は移さない）。本番 DB・環境変数。**git は触らないでください。コミットは人間側が行います。** npm install はしない。migration は作るだけ（本番に当てるのは人間側）。

## 確認
`npx tsc --noEmit`・`npx vitest run src/lib/auth src/app/system/onboarding src/app/system/_components src/app/api/system`。日本語が「???」に化けていないこと。

## 完了報告（コードブロックで）
変更ファイル／migration のファイル名／テスト結果／気になった点（特に、判定を通したのに読めないデータが残っていないか）。
