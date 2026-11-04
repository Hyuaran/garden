# Codex-519 シフト3タブ 作業レポート

日付：2026-11-04

## 開始確認

- `pwd`：`C:\garden\a-bloom-008`
- `git log -1 --format=%h`：`de8cab74`
- 一致を確認してから作業開始。以降は git を実行していない。commit なし。

## 実装

- 「自分のシフトを提出」「確定した自分のシフト」「みんなのシフト」の3タブに変更。
- 提出候補は今月・来月・再来月から未確定を古い順に2つ。今月は本人の提出がある場合だけ。既定勤務は2026-12以降。
- 確定候補は本人の確定行がある月と確定済みの月を合わせ、新しい順に2つ。月の確定情報がない取込済みの確定行も対象。
- 確定側は変更不可、備考・提出ボタンなし。確定日時がある場合だけ表示。0か月の案内、1か月の場合の月ラジオ非表示に対応。
- スマホ・LIFFは共通のMyShiftで「提出／確定」を切り替える。最初は提出。`/m/shift`の既存titleは維持。マイページの共通利用箇所も同じ切り替えになる。
- 月一覧の取得後に月を選び、その月のデータが届くまでカレンダーを描かない。shownと読み込み表示を維持。
- 本人PUTは来月または再来月、締切まで、未確定の場合だけ保存。既定勤務・テレマの勤務内容の検査は維持。
- 確定GETはconfirmed権限、PUTはmine権限。既定は本人の2タブとも全員。

## 変更ファイル

実装：

- `src/app/system/shift/ShiftManager.tsx`
- `src/app/system/shift/MyShift.tsx`
- `src/lib/shift/rules.ts`
- `src/lib/shift/service.server.ts`
- `src/lib/shift/route.server.ts`
- `src/lib/auth/system-view-scopes.ts`

テスト：

- `src/app/system/shift/Shift.test.tsx`
- `src/app/system/shift/DefaultShiftDays.test.tsx`
- `src/app/system/shift/MyShift-tabs.test.tsx`（新規）
- `src/lib/shift/months.test.ts`（新規）
- `src/lib/shift/two-month-submit.test.ts`（新規）
- `src/lib/shift/route.test.ts`
- `src/lib/auth/permission-registry.test.ts`

マニュアルは次のフォルダーの⓪①②③④を直接更新。④を先に更新し、v2.6・2026-11-04に統一。①はタブごとの使い方に変更。⓪内蔵の④も同期。

`C:\Claude\000_Garden\150_System_システム\00_マニュアル\09_シフト\`

- `Garden_System_シフト_0_要点サマリ.html`
- `Garden_System_シフト_1_操作マニュアル_研修用.html`
- `Garden_System_シフト_2_仕様書マニュアル_非エンジニア向け.html`
- `Garden_System_シフト_3_仕様書マニュアル_エンジニア向け.html`
- `Garden_System_シフト_4_仕様書_Claude読み込み用.md`

## migration

`supabase/migrations/20261104000520_shift_submit_two_months.sql`を作成しただけで、適用していない。

518のsave_shift_personをそのまま土台にし、本人提出の月条件だけを来月・再来月へ変更。条件を元に戻した関数全文が518と一致することを機械比較で確認。締切・確定後の禁止・排他・勤務内容の検査・責任者保存などは同一。

## テスト結果

- `npx tsc --noEmit`：成功。
- `npx vitest run src/lib/shift src/app/system/shift src/app/liff/shift src/lib/auth/permission-registry.test.ts src/lib/auth/system-view-coverage.test.ts src/lib/ui/no-flicker-source.test.ts`：22ファイル、104テストすべて成功。
- 月計算の3例、月またぎ、年またぎ、既定勤務の開始前、本人の提出あり／なし、確定行だけの月、締切のミリ秒境界を確認。
- テレマ・既定勤務それぞれで再来月の保存、3か月先・締切後・確定後の拒否をモックで確認。
- 確定側の変更不可・備考と提出ボタンなし・確定日時なし・0か月・月ラジオなし、スマホ切り替え、初期読み込み、3タブの権限を確認。
- 変更した実装とmigration、マニュアル5点のUTF-8を読み取り、文字化けの連続疑問符・置換文字がないことを確認。

## 自動取得・外部への操作

追加の定期取得・cron・自動実行は1日0回。vercel.jsonのcronsは変更していない。共通画面は初期表示時に一覧の取得と選択月の取得を行い、以後は月・表示の切り替えや本人の提出操作に応じて取得する。定期的な取り直しは追加していない。

computer-use・ブラウザ・本番書込み・migration適用・KING OF TIME／LINEの実呼出し・ホストPC操作・Storageへのアップロードは行っていない。

## 作れなかったもの・引継ぎ

依頼された実装の未作成項目なし。画面とマニュアルの見た目の確認、migration適用は指示どおりClaudeが行う。Codexは型チェックと自動テストまで。
