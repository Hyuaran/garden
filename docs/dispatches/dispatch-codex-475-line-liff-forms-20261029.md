# Codex-475：公式 LINE の「申告フォーム」を LINE の中のページで開く（通勤経路の変更・給与受取口座の変更）＋メニューの絵の差し替え（2026-10-29）

## 東海林さんの話
- リッチメニューの「申告フォーム」は、文を送る形をやめて、シフトと同じく LINE の中のページで開く。
- 申告は「通勤経路の変更」と「給与受取口座の変更」の 2 つだけ。
- 4 つボタンのメニューの右下は「マネージャー／宮永さんに連絡」、左下は「チームリーダー／小泉さんに連絡」（チームごとに名前）。絵は Claude が作成済み。

先に読む：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md` の §2.5〜§2.7（**社長スタイル §2.5 の型・§2.6 の点検に従う・フォームは form-kit だけで組む**）。画面の文字はきちんとした言い方（変更する・入力する・送信する）。略称・開発者用語・絵文字なし。長い説明は不要・ファイルは必要な範囲だけ読む。

今の作り（読んでから作る）：
- シフト確認の LINE 内ページ `src/app/liff/shift/ShiftPage.tsx`・本人確認 `src/app/api/liff/me/route.ts`（ID トークンを LINE の verify で確認→`root_employees.line_user_id` で本人）
- マイページの申告：画面 `src/app/system/mypage/_components/SubmissionModal.tsx`・受け口 `src/app/api/system/mypage/submissions/route.ts`・種類と入力の確認 `src/app/system/mypage/_lib/submission-types.ts`・`submission-server.ts`・届出の PDF `todoke-generation.server.ts`
- フォーム部品 `src/app/system/forms/_components/form-kit/`（README.md）
- メニュー `src/lib/line/richmenu.ts`・設定画面 `src/app/system/line/RichMenuSettings.tsx`
- 環境変数：`NEXT_PUBLIC_LIFF_FORMS_ID`（申告フォームの LIFF ID・本番と .env.local に登録済み。シフトは `NEXT_PUBLIC_LIFF_SHIFT_ID`）。2 つとも同じ LINE ログインのチャネル（2012276091）なので、ID の前の数字は同じ。

## 1. LINE の中のページ `/liff/forms`（スマホの幅だけ・社長スタイル・form-kit）
```
┌────────────────────────────┐
│ 山田さんの申告                  │   ← 見出し（名前は姓だけ）
│                                │
│ 1 申告の種類                    │
│   (●) 通勤経路の変更  ( ) 給与受取口座の変更 │ ← ラジオ（form-kit の RadioGroup）
│                                │
│ 2 …（選んだ種類の入力欄：マイページと同じ項目・同じ確認） │
│                                │
│        [ 送信する ]              │   ← 主ボタン（form-kit）
│                                │
│ これまでの申告                    │
│  2026/10/29 通勤経路の変更  受付  │   ← 直近の自分の 2 種類の申告と状況
└────────────────────────────┘
```
- LIFF の読み込み・ID トークンの取り方はシフトのページと同じ。LINE の外で開いたら「LINE の中で開いてください」、紐づいていない・退職した人は「この画面は従業員の方だけが使えます」。
- 入力欄・入力の確認・文言はマイページの申告（SubmissionModal の `commute_route` と `bank_account`）と同じにする。画面ごとに別の入力の決まりを書かない（共通にできるところは部品・関数に切り出して両方で使う）。入力欄は 16px 以上（iPhone で拡大しないため）。
- 送信したら「送信しました。担当者が確認します。」を出し、「これまでの申告」に増える。
- 状況の言葉はマイページと同じ（受付・対応中 など）。

## 2. 受け口 `/api/liff/submissions`
- GET：ID トークン（ヘッダー `Authorization: Bearer <IDトークン>` または本文）で本人を確かめ、自分の `commute_route`・`bank_account` の申告を新しい順に 10 件。
- POST：本人を確かめ、`submission_type` は `commute_route`／`bank_account` だけ受ける。保存・Kintone・届出 PDF などのその後の流れは、マイページの受け口と**同じ関数**を通す（受け口の中身を共通の関数に切り出して、マイページの受け口とこの受け口の両方から呼ぶ。マイページの動きは変えない）。
- 本人確認は `/api/liff/me` と共通の関数にする（`src/lib/line/liff-verify.server.ts` など）。client_id は ID トークンを出した LIFF の ID の前の数字（シフト・申告とも同じチャネル）。失敗は 401、従業員でなければ 403。
- 入れられる回数の上限：同じ人から 1 分に 5 回まで（越えたら 429「少し時間をおいてから送信してください」）。

## 3. リッチメニュー
- 「申告フォーム」のボタン：`NEXT_PUBLIC_LIFF_FORMS_ID` があれば `https://liff.line.me/{ID}` を開く。無ければ今のまま文を送る。
- 絵：小泉チーム＝`employee_4_koizumi.jpg`、石原チーム＝`employee_4_ishihara.jpg`（Claude 作成済み・public/line/richmenu）。ほかは今のまま（employee_3・guest_2。employee_3 は説明文だけ差し替え済み）。`employee_4.jpg` は使わなくなるので消す。
- 設定画面の説明（RichMenuSettings）：申告フォームは「LINE の中で申告フォームのページが開きます（通勤経路の変更・給与受取口座の変更）」。4 つボタンの右下の名前は「マネージャー」（絵と同じ）。

## 4. テスト
- 本人確認：トークンなし・確認失敗＝401、紐づいていない・退職＝403、従業員＝OK。
- 申告：2 種類以外は 400。マイページと同じ入力の確認。保存は共通の関数を通る（マイページの既存テストが通ったまま）。上限 429。
- ページ：LINE の外・従業員でない・送信して一覧に増える。
- メニュー：申告フォームが LIFF を開く（ID があるとき）・小泉／石原で絵が分かれる・説明文。

## 終わったら
- `npx tsc --noEmit` と関係するテストを通す。完了報告（コードブロック）。
- ファイルは UTF-8（BOM なし）。**git は触らない（commit しない）。npm install しない。本番の DB に当てない。LINE へ送らない・反映しない。**

## 実装時の取得回数
- 新しい cron は無し（1 日 0 回）。ページを開いたとき：本人確認 1 回＋これまでの申告 1 回。送信 1 回ごとに本人確認 1 回＋保存。LINE の verify はその都度 1 回。

### Codex-475 実装記録
- 初回は GET `/api/liff/submissions` 1 回で本人確認と履歴取得を行う（LINE verify 1 回）。送信は POST 1 回（LINE verify 1 回＋回数制限の確認＋共通の保存処理）。送信後の履歴再取得なし。定期取得・cron は 0 回／日。
- 送信上限は DB の行ロックで同一従業員の直近 1 分を数える。`20261029000475_liff_submission_limit.sql` は追加のみで未適用。本番 DB・LINE への接続、反映は行わない。
