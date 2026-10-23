# Codex-416：ブロードバンド事業の収支に「閲覧権限」の歯車を付ける（2026-10-23）

## 目的
`/bud/profit/broadband`（ブロードバンド事業の収支）を見られる人を、口座残高・カード利用（`/bud/bank`）の「閲覧権限」と同じ形で、画面の歯車から設定できるようにする。
今は役職（garden_role が admin / super_admin）で固定。これを「閲覧者の一覧（社員番号）」で決める形に変える。

## 画面の絵
```
ブロードバンド事業の収支
[収支の表]                                   [⇅ 並べ替え] [⚙ 閲覧権限]   ← ⚙ は super_admin だけに出す
┌ ブロードバンド事業の収支の閲覧権限 ─────────────────┐
│ ここに入れた人は、ブロードバンド事業の収支を見られます    │
│ 閲覧権限                                                 │
│ 🔍 名前で探す                                            │
│ ☑ 後道 翔太   ☑ 上田 基人   ☑ 東海林 美琴   □ …        │  ← チェック済みを先頭・在職中だけ
│                                   [保存] [閉じる]        │
└──────────────────────────────────┘
（歯車を押している間は表を隠して、この設定だけを出す。口座の歯車と同じ動き）
```

## 決まっていること（変えない）
- **見られる人** ＝ `bud_has_access()` が真 かつ（`bud_is_super_admin()` または 閲覧者の一覧に入っている在職中の社員）。
  - 在職中＝`root_employees` の `is_active=true and deleted_at is null and (termination_date is null or termination_date > 今日(日本時間))`。退職した人は一覧に残っていても見られない。
- **歯車（設定の変更）** は super_admin だけ。保存の RPC も super_admin 以外は `forbidden`。
- **最初の一覧** ＝ `EMP-0000`（後道）・`EMP-0004`（上田）・`EMP-0008`（東海林）。配備直後に見られる人が今と変わらないこと。
- 口座の `bud_mf_group_viewers`／`bud_mf_save_group_viewers`（`supabase/migrations/20261021000009_bud_mf_group_viewers.sql`）と同じ作り・同じ検査で作る。

## やること
1. **migration** `supabase/migrations/20261023000001_bud_bb_viewers.sql`（`begin; … commit;`・BOM なし）
   - 表 `public.bud_bb_viewers`（1 行だけ：`id smallint primary key default 1 check (id=1)`, `employee_ids text[] not null default '{}'`, `updated_at`, `updated_by uuid references auth.users(id)`）。初期行に上の 3 人。RLS 有効・`bud_has_access()` で select 可・書き込みは RPC だけ。
   - 関数 `public.bud_bb_can_view() returns boolean`（security definer・stable・search_path=public）＝上の「見られる人」の判定。`authenticated` に execute。
   - 既存の ブロードバンドの表すべての読み取りポリシー（`bb_admin_read`＝`bud_bb_settings`/`bud_bb_records`/`bud_bb_payee_rules`/`bud_bb_recon_issues`、`bud_bb_agent_details_read`、そのほか `bud_bb_` で始まる表で `bud_is_admin_or_super_admin()` を使っているもの全部）を drop して、`using (public.bud_bb_can_view())` で作り直す。migrations を grep して漏れなく。
   - RPC `public.bud_bb_save_viewers(p_viewers text[])`：super_admin 以外は例外、null・2000 件超・在職中でない社員番号は例外、重複を除いて保存、`updated_at/updated_by` を入れる。`authenticated` に execute。
2. **サーバー側の判定** `src/lib/bud/broadband/access.ts`：`bud_is_admin_or_super_admin` をやめて `bud_bb_can_view` で判定。戻り値に `admin`（super_admin か）と `employeeId` を足す（`src/lib/bud/mf/access.ts` の作りに合わせる）。
3. **API** `src/app/api/bud/broadband/viewers/route.ts`：
   - `GET`：super_admin だけ。`{ viewers: string[], employees: {employee_id,name,name_kana}[] }`（在職中の社員・名前順。`src/app/api/bud/mf-accounts/route.ts` の employees の読み方と同じ）。
   - `PATCH`：super_admin だけ。本文 `{ viewers: string[] }` を検査（配列・文字列・100 字以内・2000 件以内）して RPC を呼ぶ。エラー文は日本語（例「設定を変更する権限がありません」「保存できませんでした」）。
4. **画面**
   - 共通部品を新設 `src/app/bud/_components/ViewerPicker/`：名前で探す（カタカナ・ひらがな・全角半角を区別しない）・チェック済みを先頭・チェック一覧。見た目は `src/app/bud/bank/BankAccounts.tsx` の `People`／`bank.module.css` の `.people` `.peopleSearch` `.settings` と同じにする（CSS は新しい module に写す）。
   - `src/app/bud/profit/broadband/BroadbandTable.tsx`：`SystemTabs` の actions に `TabActionButton icon="settings" label="閲覧権限"` を super_admin のときだけ追加（並べ替えの右）。押したら設定パネルを出し表を隠す。保存したら閉じる。保存中は「保存中…」、失敗は `role="alert"` で文言表示。`page.tsx` から `admin` を渡す。
   - **左のメニュー** `src/app/bud/_components/BudShachoShell/BudShachoShell.tsx` 70 行目：「ブロードバンド収支」を出す条件を garden_role ではなく「見られる人」（`bud_bb_can_view` の結果）にする。読み込み中・失敗時は出さない。
5. **テスト**：既存の `BroadbandTable.test.tsx` に「super_admin だけ歯車が出る」「保存で PATCH が呼ばれ閉じる」、API の権限（非 super_admin は 403）、ViewerPicker の検索と並び、を追加。BudShachoShell のテストがあればメニュー条件も。

## 触らないもの（読みもしない）
- `src/app/bud/bank/` 配下（別件の変更が作業中。部品の共通化は後で人間がやる）
- `.claude/`・`docs/dispatches/` の他のファイル
- **git は触らないでください。コミットは人間側が行います。** 本番 DB にも触らない（migration は人間が当てる）。

## 確認
- `npx tsc --noEmit` と、変更した範囲の `npx vitest run <対象>` が通ること。
- 画面の文言に開発者用語（RPC・RLS・employee_id 等）を出さない。

## 完了報告（コードブロックで）
変更・追加ファイル一覧／migration の要点／テスト結果（件数）／気になった点。長い説明は不要。
