# Codex-511b シフト画面修正レポート（2026-11-03）

## 修正したファイル
- `src/app/system/shift/ShiftDays.tsx`：1日1枚の枠・選択欄1つに変更。休み／勤務時間、土日祝・定休日の表示、まとめて設定を共通化。
- `src/app/system/forms/_components/form-kit/form-kit.module.css`：入力枠の自動段組み、16pxの選択欄、候補のボタン、未提出者の表示を追加。既存の共通CSSも整形。
- `src/app/system/shift/ShiftManager.tsx`：56pxの日付列、日・曜日の2段見出し、氏名とチーム名の左固定、数字だけの合計時間、未提出人数と氏名、最新更新日時、候補10日／全日表示、定休日の即時切り替えと失敗時の復元を実装。
- `src/app/system/shift/shift.css`：表だけのスタイルに整理。
- `src/app/system/shift/page.tsx`：既存の初期URL受け渡しを使用し、`?tab=team`を最初から表示。
- `src/app/system/shift/MyShift.tsx`：共通の完了表示を使用。読み込み中も日数分の入力枠を予約。
- `src/app/system/_components/DoneOverlay/DoneOverlay.tsx`：チェックの絵と紺色の幕の共通部品を追加。
- `src/app/system/line/LineSendOverlay.tsx`：完了時に共通部品を使用。従来の文言・色・失敗表示・閉じる操作を維持。
- `src/app/system/shift/Shift.test.tsx`：選択欄、勤務／休み、候補の展開、即時反映と復元、解除、初期タブ、最新更新日時、未取得の非表示、完了の幕を検証。
- `src/app/system/mypage/__tests__/redirects.test.ts`：シフトページの初期URL受け渡しに合わせて検証を更新。

LIFF・スマホの提出画面は同じMyShift／ShiftDaysを使うため、共通部品の変更で反映される。API・DB・migrationは変更していない。

## テスト結果
- `npx tsc --noEmit`：成功（古い`.next`型の除外作業は不要だった）。
- 修正後のシフト／ちらつき防止関連テスト：12件成功。
- マイページ関連のテスト：3件成功。
- `npx vitest run src --exclude '**/employment-contract-pdf-integrity.test.tsx'`：終了コード0。695ファイル成功・6ファイルスキップ、6,694件成功・8件スキップ（471.20秒）。
- 全体テスト中にjsdomの「Not implemented: navigation to another Document」警告が出たが、失敗はなかった。

## 通信回数・作業範囲
定期取得・cronは追加していない（定期取得の増加は1日0回）。従来同様、初回・月変更・手動更新でGETが1回、保存成功後にGETが1回。1日の画面表示回数をV、月変更をM、手動更新をR、保存成功をSとするとGETは概ねV+M+R+S回で、経過時間だけで増える取得はない。

git・computer-use・ブラウザ操作・本番書き込み・実際のLINE送信は実施していない。375px／1280pxの実画面での目視確認は、指示により行っていない。段組み・列幅はCSSとDOMのテストで確認した。
