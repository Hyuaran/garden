# Codex-511 作業レポート（2026-11-03）

## 実装
- 本人の希望提出・締切判定・今月の確定シフト表示を共通化。Garden、マイページ、スマホ、LIFFで使用。
- 責任者のチーム別一覧、日別合計、個人変更の小窓、定休日候補、確定・再確定・提出依頼の確認小窓を追加。
- 対象者・時間・日付・月全体の入力をサーバーで検証。本人APIは本人の行だけを返し、責任者APIはteamの閲覧設定で認可。LIFFも本人認証後にmineの閲覧設定を確認。
- LINE通知と送信記録を実装。テストは送信・DBともモック。実送信なし。
- 希望保存・提出記録、確定、定休日変更は月ごとの排他制御を使うDB関数にまとめた。

## 変更ファイル
- `src/lib/shift/{eligibility,rules,service.server,route.server}.ts`、対応する3テスト
- `src/app/system/shift/{page,MyShift,ShiftManager,ShiftDays}.tsx`、`shift.css`、`Shift.test.tsx`
- `src/app/api/system/shift/my/route.ts`、`team/route.ts`、`team/{person,holiday,confirm,remind}/route.ts`
- `src/app/api/liff/shift/route.ts`、`src/app/liff/shift/ShiftPage.tsx`、`ShiftPage.test.tsx`
- `src/app/m/shift/page.tsx`、`src/app/system/mypage/tabs/ShiftTab.tsx`
- `src/app/system/mypage/__tests__/{page.test.tsx,redirects.test.ts}`
- `src/app/system/forms/_components/form-kit/form-kit.module.css`（共通の1日1行入力）
- `src/app/system/_components/DataTable/DataTable.tsx`（任意のグループ見出しと合計行）
- `src/app/system/_components/UpdatedStamp/{UpdatedStamp.tsx,formatSyncStamp.ts}`（任意の秒表示）
- `src/lib/auth/{system-view-scopes.ts,system-view-integration.test.tsx}`
- `src/lib/search/{catalog.ts,migration.test.ts}`

## migration
`supabase/migrations/20261103000511_shift_submit_confirm.sql` を作成しただけで、適用していない。
4表・外部キー・RLS（ポリシーなし）、service_role専用の3操作関数、管理表側の定休日変更を反映するトリガー、mine/teamの閲覧設定、検索ビュー・索引を含む。既存migrationは変更していない。

## 判断したこと
- 締切は前月15日23:59:59.999（日本時間）まで。APIに加えてDBの保存時にも判定する。
- 未入力の保存は認めず、月の全日を送る。初期値は休み。未提出者も確定時には全日を作り、希望がない日は休みにする。
- 責任者の個別保存では本人の提出済み印を付けない。確定後の個別保存は希望を変更しない。
- 定休日を確定後に追加すると、その日の確定シフトも休みにする。解除しても以前の時間を自動復元せず、個別変更または再確定で直す。
- 確定し直すと希望から作り直すことを確認小窓に明記。未接続・ブロック済みのLINEには送らず、件数を表示する。
- 定期取得・cronの追加は **0回/日**。取得は画面表示・月切替・保存後・責任者の手動更新のみ（操作回数に依存）。
- 375px向けの共通CSSとDOM操作を確認。指定によりブラウザでの実画面確認は行っていない。
- KOT連携は追加していない。git・computer-use・ブラウザ操作・本番書き込みはいずれも行っていない。

## テスト
- `npx tsc --noEmit`：`.next/dev/types/validator.ts` に既存の削除済みAPI参照7件。指示どおり `.next` を除いた一時設定で `npx tsc --noEmit -p tsconfig.shift-check.json` を実行し、成功。一時設定は元のtsconfigを継承し、excludeをnode_modules・.nextにしたもの。確認後に削除。
- `npx vitest run src --exclude '**/employment-contract-pdf-integrity.test.tsx'`：**695ファイル成功、6ファイルスキップ／6,688件成功、8件スキップ、失敗0件**（489.97秒）。初回に出た旧画面・旧カタログ前提の4失敗を修正後、全体を再実行して成功。既存のjsdom画面遷移警告は出るが失敗はない。
- 個別確認：時間・締切・対象者・定休日・403・通知先と本文・送信失敗記録・未提出者の選別・本人提出・責任者小窓・検索・閲覧設定・共通表・更新日時をモックで確認。
