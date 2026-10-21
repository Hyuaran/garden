# Codex-405：口座残高・カード利用の「設定モード」を見やすく（閲覧権限・在職中だけ・検索）（2026-10-21）

## 正本
- 社長スタイル `C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md` §2.5・§2.6（線画アイコン・絵文字なし・文言に開発者用語なし）
- 今の作り：`C:\garden\a-bloom-008\src\app\bud\bank\BankAccounts.tsx`（設定モード settings・SettingsForm・カードの一覧）・`bank.module.css`・API `src\app\api\bud\mf-accounts\route.ts`（employees を返している・settings の保存）・同期 `src\lib\bud\mf\sync.ts`・DB 関数 `bud_mf_save_settings`（`supabase\migrations\20261021000003_bud_mf_arrival.sql` の最新版）
- 社員の表 `root_employees`（employee_id・name・name_kana・is_active・termination_date・deleted_at）

## 東海林さんの決定（2026-10-21）
1. **設定モード（タブの行の右端の歯車）のときは、下のいつものカード（口座）の一覧を出さない**（今は設定のカードの下に、ふつうのカードの一覧も出ている）
2. **「○○の設定」ボタンをやめる**（カード名の復唱が多すぎる）。**各カード（口座）の名前の右に歯車の線画アイコン**を置き、押すとその設定が開く。口座残高のタブの設定も同じ形
3. **「見てよい人」→「閲覧権限」**。チェックボックスは**列をそろえて**並べる（CSS grid・同じ幅の列・名前は 1 行・長い名前は省略して title で全文）
4. **選べるのは在職中の人だけ**（is_active かつ退職日が今日以前でない・deleted_at なし）。**退職になった人は閲覧権限から自動で外す**：MF の読み込み（30 分ごと）のたびに、bud_mf_accounts.visible_employee_ids から在職中でない人を取り除く（DB 関数で。WHERE の無い UPDATE は Supabase が断るので必ず WHERE を付ける）。画面でも在職中でない人は出さない
5. **閲覧権限の中に検索欄**（虫眼鏡・名前の漢字・カナの部分一致）。チェック済みの人は検索中も上にまとめて出す（外し忘れを防ぐ）

## 画面の絵
```
 口座残高   カード利用                                         ↑↓  歯車(押している)
━━━━━━━━━━━━──────────────────────────────
┌ オリコカード（ヒュアラン）        (歯車) ┐ ┌ 三井住友カード（ヒュアラン）   (歯車) ┐
│ EX Gold for Biz M …                       │ │ …                                   │
└───────────────────────┘ └──────────────────┘
（設定モードの間は、ふつうのカードの一覧・期間は出さない）

 歯車を押すと（今の設定の窓の中身）：
┌ オリコカード（ヒュアラン）──────────────────────────┐
│ 閲覧権限                         ［(虫眼鏡) 名前で探す              ］│
│ ☑ 上田　基人     ☑ 後道　翔太     ☑ 東海林　美琴                     │  ← チェック済みを先頭
│ ☐ 井上　聡       ☐ 伊藤　純也     ☐ 上田　成法     ☐ …              │  ← 列をそろえる
│ ☐ このカードを表示しない                                             │
│ （口座のときは今どおり：残高の出し方・帳簿の補助科目・MF の知らせメールでの名前） │
│                                                   ［閉じる］［保存］  │
└────────────────────────────────────┘
```

## テスト
- 設定モードではふつうの一覧が出ない
- 「○○の設定」の文字のボタンが無く、名前の右の歯車で設定が開く（aria-label「○○の設定」は残してよい）
- 「閲覧権限」の見出し・検索で絞れる・チェック済みが先頭
- 在職中でない人は選べない（出ない）／読み込みで退職者が閲覧権限から外れる
- テストの中に絵文字を書かない

## 守ること
- migration が要るときは `supabase\migrations\20261021000007_bud_mf_viewers_active.sql`（**適用は Claude**）
- commit・push しない。DB・外部 API に接続しない
- `npx vitest run src/app/bud/bank src/app/api/bud src/lib/bud src/app/system/_components` と `npx tsc --noEmit -p .` が通ること（テスト時は .env.local の NEXT_PUBLIC_SUPABASE_URL／ANON_KEY を環境変数に入れて流す）

## 報告（日本語・コードブロック）
変えたファイル・テストの結果・Claude がやること（migration）だけ短く。
