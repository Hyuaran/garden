# Codex-513 シフトを提出する人を歯車から設定する（2026-11-04）

作業場所：C:\garden\a-bloom-008（main）
**git は触らない（commit もしない）。computer-use・ブラウザ操作は使わない。本番に書き込まない（migration はファイルを作るだけ。当てるのは Claude）。KING OF TIME・LINE を本当に呼ばない。** ファイルは UTF-8。必要な範囲だけ読む。
画面の文字はきちんとした日本語。英語・開発者用語を出さない。**コードは周りと同じく読みやすく書く**（1行に詰め込まない）。

## 背景
今は「提出する人」を `src/lib/shift/eligibility.ts` の決まり（アルバイト＋ブロードバンド事業＋チームがバックヤード・所属なし以外）だけで決めている。業務委託の藤木さんなど、決まりから外れる人も提出できるように、東海林さんが歯車から人を足す・外すようにしたい。

## 決まりごと
- 提出する人 ＝（今の決まりに合う人 ＋ 追加した人）− 外した人。退職者（`is_active` が false・削除済み・退職日が今日以前）は追加していても対象にしない
- 新しく入った人は今までどおり決まりで自動で入る（毎回設定しなくてよい）
- 設定できる人＝歯車を使える人（全権管理者）。API も同じ判定で止める
- 確定シフト・提出済みの希望はこの設定で消さない。外した人は、提出の画面に「シフトの提出はありません。」と出て、みんなのシフトの表と未提出の数から外れる

## 保存先（migration `supabase/migrations/20261104000513_shift_submitters.sql`）
新しい表 `system_shift_submitter`：employee_id text 主キー（`root_employees(employee_id)` への外部キー）・mode text（`include`＝追加／`exclude`＝外す）・updated_at・updated_by。RLS 有効・ポリシーなし（ほかの system_shift_* と同じ形）。
**初期データ：藤木さん `EMP-1490` を include**。

## 画面（みんなのシフトのタブの歯車）
今の歯車（`src/app/system/_components/ViewPermissionButton/ViewPermissionButton.tsx`）の小窓は閲覧権限の設定。`system-shift` の `team` タブの小窓だけ、閲覧権限の下に次の欄を足す（ほかの画面には影響させない。部品に差し込み口を足す形でよい。`SystemTabs`・`SystemViewContext` の渡し方を読んで、いちばん小さい変更にする）。
```
┌ 見られる人の設定 ─────────────────── × ┐
│ （今の閲覧権限の欄）                          │
│ ─────────────────────────────── │
│ シフトを提出する人（17人）                     │
│  決まり：アルバイト・ブロードバンド事業・チームあり │
│  [ ＋ 提出する人を追加 ]  ← 今の ViewerPicker    │
│  藤木 誠希  石原チーム  追加    [ごみ箱]         │
│  大塚 響    宮永チーム  決まり  [ごみ箱]         │
│  …                                            │
│  提出しない人に設定した人                       │
│  山田 太郎  宮永チーム          [元に戻す]       │
└──────────────────────────────┘
```
- ごみ箱＝`RowActionButton` の `kind="delete"`（label＝「{氏名}を提出する人から外す」）。押すとすぐ反映（楽観更新・失敗したら元に戻して知らせる）。追加した人は行が消える（設定を消す）、決まりの人は「提出しない人」へ移る（exclude）
- ［元に戻す］で exclude の行を消す
- 並びはチームごと・社員番号順。小窓にスクロールバーを出さない（`feedback`：全部の小窓）。人数が多くて収まらないときは一覧の枠の中だけを内側でスクロールさせず、列を2列にして収める
- 変更したら みんなのシフトの表を読み直す

## API
`GET/POST/DELETE /api/system/shift/submitters`（`src/lib/shift/*` に処理をまとめる）。POST＝{employee_id, mode}、DELETE＝{employee_id}。全権管理者以外は 403。

## 直す所
- `src/lib/shift/eligibility.ts`：`isShiftEligible(employee, settings?)` のように設定を渡せる形に。`service.server.ts` の対象者の読み込みで設定を読む
- 本人用の提出（Garden・/m/shift・/liff/shift）・みんなのシフト・確定・未提出の知らせ・KING OF TIME への送信（`route.server.ts` の対象者確認）が全部同じ判定になること
- 藤木さんは `employment_type='outsource'`。役割の判定などで弾かれないこと

## テスト
決まり＋追加−外す・退職者は追加していても外れる・403・本人の提出画面の出し分け・歯車の欄（追加・ごみ箱・元に戻す）。`npx tsc --noEmit` と `npx vitest run src --exclude '**/employment-contract-pdf-integrity.test.tsx'` が通ること。`src/lib/ui/no-flicker-source.test.ts` を壊さない。

## 終わったら
`docs/dispatches/report-codex-513-shift-submitters-20261104.md` に、直したファイル・migration・テスト結果を書く。
