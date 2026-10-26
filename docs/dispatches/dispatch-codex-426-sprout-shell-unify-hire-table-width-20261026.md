# Codex-426：Sprout のシェルを Bud／Root と同じ作りに統一＋入社予定者の表の幅（2026-10-26）

## 1. Sprout のシェルを統一
今の `src/app/sprout/sprout-shell.tsx` は左のアイコン列（レール）が root・bud・sprout の 3 つだけで、右上の「名前・お知らせ・文字の大きさ『あ』・明暗・ログアウト」も無く、サイドバー下の本人の表示も無い（東海林さん「サイドバー左のアイコンが3つしか反映されてない。統一して」）。
- `src/app/bud/_components/BudShachoShell/BudShachoShell.tsx`（または `src/app/root/_components/RootShell.tsx`）と**同じ作り**にする：レールは他のモジュールと同じ全モジュール（役職で見せる・見せないも同じ判定＝`renderModuleRail` 相当）、右上のヘッダー（名前・お知らせ・FontSizeButton・明暗・ログアウト）、サイドバー下の本人、スマホ幅の三本線メニュー。
- 一番よいのは Bud／Root のシェルから共通部品を使い回すこと（重複コードを作らない）。Sprout のサイドバーの中身は今のまま：掲載管理（上・`/sprout/postings`）・採用管理（下・`/sprout`）。今いる画面に印。
- 見出し「掲載管理」「採用管理」は右上のヘッダーと重ならないこと。ライト／ダーク両方で読めること。

## 2. 入社予定者の表の幅
`src/app/system/onboarding/HireCandidatesClient.tsx`（入社予定者タブ）の表が、囲みの幅（狭い）に押し込まれて右の列（入社後の確認）が切れている。
- 「入社手続き」タブの一覧と同じく、画面の幅いっぱいを使う（囲みの max-width を外す／表は横スクロールの固定バー付き＝既存の `DataTable`／`StickyTable` の作り）。
- 「入社後の確認」は 1 行に詰め込まず、項目ごとに改行して読めるように（チェックボックスと文字がくっつかない）。

## 触らないもの
- `src/app/bud/bank/`。本番には触らない。**git は触らないでください。コミットは人間側が行います。** npm install はしない。

## 確認
`npx tsc --noEmit`・`npx vitest run src/app/sprout src/app/system/onboarding src/app/bud/_components src/app/root/_components`。日本語が「???」に化けていないこと。

## 完了報告（コードブロックで）
変更・追加ファイル／使い回した部品／テスト結果／気になった点。
