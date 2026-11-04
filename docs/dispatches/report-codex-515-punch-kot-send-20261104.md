# Codex-515 作業レポート（2026-11-04）

## 確認と実施範囲

- 最初の確認：作業場所 `C:\garden\a-bloom-008`、`git log -1 --format=%h`＝`10d7b872`。一致してから編集した。その後の git 操作・commit はなし。
- 本番接続・配備・本番 migration・取得スクリプトの main 実行・KING OF TIME／LINE／Chatwork の実呼び出し・ホスト PC 操作・ブラウザ操作はしていない。
- migration は成果物として作成。本番に適用していない。別のテスト専用メモリ内 PostgreSQL で旧スキーマを再現し、追加 migration と関数を検証した。環境ファイル・本番の DB 接続は使っていない。
- `vercel.json` は変更していない。追加の定期実行は **1日0回**。新しい画面の間隔取得・自動再送・通知はなし。取得スクリプトの1秒待ちは手動実行中の中継結果待ちだけ。

## 実装したファイル

- 取得：`scripts/attendance/import-kot-november.mjs`。既定は dry-run、`--apply` は人×日の DB 関数。UUID v5、対象外種別の報告、提出対象者の共通判定、予定の終了21:00、18:30開始、上書き、責任者変更行、定休日候補を扱う。`kot_import` だけ置き換え、`web`／`correction` と開始日以降を保護する。
- migration：`supabase/migrations/20261104000516_attendance_corrections_kot_send.sql`。設定・申請・送信結果、端末・無効化列、承認／取得／送信の関数、RLS、閲覧タブ、検索、シフトの上限・備考を追加。
- シフト：`src/lib/shift/{rules,service.server,route.server}.ts`、`src/app/system/shift/{MyShift,ShiftDays,ShiftManager}.tsx`。本人は既存の18:00まで、責任者は20:30まで。現在値が選択肢外でも保持。備考500字を提出と同時に保存し、確定・締切後は読むだけ。4入口は既存の共通 MyShift を使う。備考による新しい通知はなし。
- 共通加工：`src/app/api/system/attendance/kot-export/_lib/kot-transform.ts`。明示した休憩は秒を切り捨て、その時刻を使う。片側・逆順・勤務枠外は要確認。休憩が無い日は従来の固定休憩。office は従来どおり。
- 時間集計：`src/app/system/kanri/_lib/kot-daily.ts`。既存の書き出し「休憩時間」（小数時間）を優先し、固定休憩と二重に引かない。列のない古い入力だけ従来の固定休憩へ戻す。
- 打刻と修正：`src/lib/attendance/`、`src/app/api/system/attendance/{my,punch,sync-status,settings,corrections,day,kot-send}/route.ts`、`src/app/system/attendance/AttendanceClient.tsx`、`CorrectionsPanel.tsx` と CSS、`sync-status/{page,SyncStatusClient,AttendanceSettings}.tsx`、`src/app/system/_lib/attendance.ts`。3タブ、本人の申請・取消、承認・却下・手動修正済み、開始日、端末を追加。
- 打刻参照：上記に加え `src/app/api/my/ap-daily-report/route.ts` と CSV の生成・確定・取消で `voided_at=null` を適用。打刻の再試行の一意ID照合だけは監査用の元行を照合する。CSV の確定・取消は束付きの行だけを扱い、API の確認待ちに触らない。
- ポータル：`src/app/system/kanri/{KanriPortalClient,KotPunchPanel}.tsx` と CSS、`src/app/api/system/kanri/kot-closing/route.ts`。送信の確認と進捗、失敗一覧、締め確認、取得不能時の確認付き迂回、対象日変更時の解除を追加。締めは押したときだけ読む。
- 中継：`scripts/relay-agent/{agent.mjs,config.example.json,README.md}`、`src/lib/relay/types.ts`。1.4.0、本文・クエリ・件数・サイズ制限、1秒間隔、打刻 POST は429だけ再試行。シフトの1.3.1判定は維持。
- 権限・検索：`src/lib/auth/system-view-scopes.ts`、`src/lib/search/catalog.ts`。既存の画面全体の設定を残してタブを追加。承認は canView に従い、自分の申請は全権管理者以外拒否する。
- スマホ：`src/app/m/attendance/page.tsx`。打刻と申請を共通化し、承認タブは出さない。

## 重要なガード

人×日のロック、送信の処理期限、打刻の集合照合、未承認の修正の再確認、CSVとの競合防止を DB 側にも置いた。KING OF TIME に打刻が1件でもあれば新規登録しない。結果不明は unknown として次回に読み直し、既存の送信内容を保存する。期限切れの手入力済みは打刻も同期済みにし、CSVへ再び出さない。

公式説明 [KING OF TIME WebAPI](https://developer.kingoftime.jp/) を確認した。GET の打刻配列は `dailyWorkings[].timeRecord`、POST は `employeeTimeRecordRequests[].timeRecords`。成功の recordId を全件照合する。締め後の登録可否は説明から確定できないため、Claude の本番1件確認が必要。

## 取得分の日報への影響

AP日報は source で除外せず、その本人の月内の有効打刻から自動値を計算する。取得分も入力になるため、切り替え前でも自動値は実打刻に変わる。既に保存した日報の手入力の差分は既存の計算で維持される。取得だけで既存日報を書き換えたり、Chatworkへ送ったりする処理はない。無効化した元行は計算から除外する。

## マニュアル下書き

`C:\Claude\000_Garden\150_System_システム\00_マニュアル\` の `03_勤怠打刻KOT取込`・`07_管理表ポータル`・`26_ホストPC中継` を各5点、計15点更新。④を先に更新し、⓪①②③にも v1.4 下書き・2026-11-04 を記載した。旧手順・履歴を残し、新しい下書きが優先する旨を明記した。Storageへは上げていない。

## テスト

- `npx tsc --noEmit`：成功。
- 関連の取得・加工・送信・シフト・ポータル・権限・検索のテストを追加・更新し、下記の最終全体実行に含めて成功。
- `npx vitest run src --exclude '**/employment-contract-pdf-integrity.test.tsx'`：**709ファイル・6,793件成功**、6ファイル・8件スキップ。終了コード0。PDFの指定除外は指示どおり。
- `npx vitest run src/lib/ui/no-flicker-source.test.ts`：4件成功。並行実行時に一度5秒制限へ達したが、検査内容は変えず単独で再確認した。最終の全体実行でも成功。
- `npx vitest run --config scripts/relay-agent/vitest.config.mjs`：4ファイル・63件成功。
- `node scripts/attendance/test-migration.mjs`：メモリ内 PostgreSQL で22確認成功。取得の再実行・削除・他source保護・18:30・送信済み維持・開始日保護、修正の3操作、元時刻維持、自己承認拒否、送信後の手動修正、途中失敗のロールバック、送信の二重取得拒否、送信結果、備考上限、RLSを確認。
- テスト用の PGlite／整形ツールは一時フォルダーへ入れただけで、プロジェクトの package.json／lockfile に依存は追加していない。一時フォルダーも片付け済み。

検証ログ：`docs/dispatches/codex-515-validation/`。本番画面の確認はしていない。

## Claude に頼むこと

1. 日本語のラベルを含む全変更と migration を確認し、本番へ migration・配備する。画面確認は未実施。幅4段階、ライト／ダーク、スマホ、読み込み時の高さを確認する。
2. 係1.4.0を設置キットの `relay-agent_1.4.0` へ配置し、08・09を用意する。利用者不在を確認してからホストの係を入れ替え、生存確認の版を見る。Codexは設置キット・ホストを操作していない。
3. 11/1以降の取得を dry-run し、件数・除外・責任者変更行・定休日候補を Garden開発責任者へ確認してから apply する。切り替え前日の締め後に再取得し、開始日を設定する。取得スクリプトは Codex 未実行。
4. 本番で1人分の打刻→送信を通し、締めた日に登録できるか確認し、KING OF TIMEの画面で後片付けする。
5. マニュアル下書き15点を確認して Storage へ上げ、版を点検する。開始日は Garden開発責任者が決める。
