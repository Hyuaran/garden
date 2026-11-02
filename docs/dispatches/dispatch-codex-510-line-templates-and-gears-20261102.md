# Codex-510 公式LINE の定型文を画面で直せるようにする／歯車の無い System 画面に歯車を付ける（2026-11-02）

作業場所：C:\garden\a-bloom-008（main）
**git は触らない。パソコン操作（computer-use）・ブラウザ操作は使わない。本番に書き込まない（migration はファイルを作るだけ。当てるのは Claude）。** ファイルは UTF-8。長い説明は不要・必要な範囲だけ読む。
画面の文字はきちんとした日本語（「変える」→「変更する」、「入れる」→「入力する」）。開発者用語を画面に出さない。

## A. 公式LINE「一斉送信」タブの定型文を画面で直す

今：定型文は `src/app/system/line/broadcast-templates.ts` に直書き（雇用契約書のお知らせ・年末調整のお知らせ）。押すと絞り込み（タグ）・題名・送信内容が入る（`templateTagIds`）。

### 画面の絵
```
定型文
 [雇用契約書のお知らせ](鉛筆) [年末調整のお知らせ](鉛筆)  [＋ 定型文を追加]
```
- 定型文のボタンの右に、鉛筆のアイコンだけのボタン（文字の［編集］は置かない）。部品は `src/app/system/_components/RowActionButton/RowActionButton.tsx` の `kind="edit"`（label＝「{ボタンの名前}を変更する」）
- 鉛筆を押すと小窓「定型文の変更」、［＋ 定型文を追加］は小窓「定型文の追加」：
```
┌ 定型文の変更 ─────────────────────── × ┐
│ ボタンの名前＊ [雇用契約書のお知らせ        ]   │
│ 絞り込み      (BoxSelect：今あるタグから複数)   │
│ 題名＊        [{年}年{月}月分 雇用契約書     ]   │
│ 送信内容＊    [お疲れ様です！ ...           ]   │
│ 使える差し込み：{年} {月} {令和}（押した日の値） │
│ 最終更新：2026/11/02(月) 18:10:05 東海林 美琴    │
│ [削除する]                        [保存する]    │
└───────────────────────────────┘
```
- 削除は確認してから（Garden の確認の小窓。ブラウザの confirm は使わない）
- 小窓は Garden の Modal（スクロールバーを出さない）。必須の欄は FormRow `required`（赤い＊）
- 差し込み：`{年}`＝西暦、`{月}`＝月（1〜12）、`{令和}`＝令和の年。押した日の日本時間で置き換える（今の `broadcastTemplates()` と同じ計算）。題名・送信内容の両方で使える
- 押したときの動きは今と同じ（絞り込み・題名・送信内容が入る。見つからないタグは今と同じ注意）

### 保存先
- 新しい表 `system_line_broadcast_template`：id uuid・label text not null・title text not null・body text not null・tags jsonb（`[{kind,name}]`）not null default '[]'・sort int・updated_at timestamptz・updated_by text（employee_id）・updated_by_name text。RLS 有効・ポリシーなし（サーバーの管理者接続だけで読み書き。ほかの system_line_* と同じ形）
- migration：`supabase/migrations/20261102000510_line_broadcast_templates.sql`。**今の2つの定型文を初期データとして入れる**（年月の所は `{年}` `{月}` `{令和}` に置き換えた文。本文は今の `broadcast-templates.ts` の文と一字一句同じ・改行も同じ）
- 一覧の読み込み（`src/lib/line/tags.server.ts` の `loadLineData`）で `templates` を返す（sort の順）
- 保存・追加・削除は `src/app/api/system/line/manage/route.ts` に action を足す（`templateSave` / `templateDelete`）。updated_by・updated_by_name は保存した人
- `broadcast-templates.ts` は「差し込みの置き換え（`fillTemplate(text, now)`）」と `templateTagIds` だけにする（直書きの定型文は消す）

## B. 歯車の無い System 画面に歯車を付ける

閲覧権限の歯車は「`src/lib/auth/system-view-scopes.ts` の `SYSTEM_VIEW_SCOPES` に載っている画面」にだけ出る。次の3画面が載っていない：
1. 公式LINE `/system/line`（タブ：人とタグ `tags`・あいさつ文 `greeting`・一斉送信 `broadcast`・連絡先 `contacts`・リッチメニュー `richmenu`・グループ `groups`）。**既定＝全権管理者（super_admin）だけ**（今と同じ）
2. 新機能のお知らせ `/system/notices`。既定＝全員（今と同じ）
3. INNOVERA番号の同期 `/system/innovera`。既定＝今の画面の判定と同じ役職

やること：
- 3画面を `SYSTEM_VIEW_SCOPES` に載せ、ほかの画面と同じ作り（`withSystemView`・タブがある画面はタブごとの判定・`SystemTabs` に歯車）にする。見られないタブは出さない
- 公式LINE：今は `requireLineAdmin()`（super_admin 固定）で画面と API を止めている。これを閲覧権限の判定（`canView("system-line", タブ)`）に置き換える。API は**そのタブの閲覧権限がある人だけ**通す（一斉送信の preview/send/定型文の保存＝`broadcast`、タグ＝`tags`…と action ごとにタブを決める）。マイナンバーなどは無いが、従業員全員に送れる画面なので、既定は必ず super_admin だけにする
- `/system/payroll-notice` は転送だけなので対象外
- **再発防止のテスト**：`src/app/system/*/page.tsx`（転送だけのページを除く）がすべて `SYSTEM_VIEW_SCOPES` に載っていること（または onboarding のような独自の歯車）を確かめるテストを足す。新しい画面を作って載せ忘れたら落ちるように

## テスト
- 定型文：保存・追加・削除の API（権限なしは 403）、差し込みの置き換え、鉛筆を押すと小窓、押すと絞り込み・題名・送信内容が入る
- 歯車：3画面の判定・API の 403
- `npx tsc --noEmit`（`.next/` の古い型は対象外）と `npx vitest run src --exclude '**/employment-contract-pdf-integrity.test.tsx'` が通ること。点検テスト `src/lib/ui/no-flicker-source.test.ts` を壊さない（最初の見た目を localStorage で決めない）

## 終わったら
`docs/dispatches/report-codex-510-line-templates-and-gears-20261102.md`（UTF-8）に、直したファイル・migration・テスト結果を書く。
