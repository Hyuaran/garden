# Codex-516 作業レポート（2026-11-04）

## 着手確認

- `pwd`：`C:\garden\a-bloom-008`
- `git log -1 --format=%h`：`8ea46a4a`
- 一致を確認後に編集。以後git操作なし、commitなし。

## 実装

- 在籍するテレマ以外の正社員・契約社員・パート・アルバイトを既定勤務の対象にした。例外は既存の提出者設定にdefaultを追加。
- 2027年1月分から開始。開始前・未設定の案内を出し、提出を禁止。
- 本人は曜日ごとの既定勤務・休み・有給だけを選択。備考・締切・確定後の変更禁止・読み込み中の形を維持。
- 責任者は開始と終了を30分単位で変更。表はチームに混ぜ、既定勤務だけ開始〜終了を表示。合計時間・定休日候補はテレマだけ。
- 確定時の既定勤務の補完、定休日の適用をテレマだけに限定する処理をmigrationに記述。管理表側のトリガーも同じ。
- KING OF TIMEへの終了時刻はend_timeを使用。13:00〜14:00を含む勤務だけ休憩を送る。有給は勤務の登録を送らず、既存の勤務予定があれば削除。公休・欠勤は残す。
- 有給の手入力一覧・入力済み記録を追加。開始・終了・種別の変更で入力済み記録を解除。
- 全権管理者の歯車に既定勤務の対象設定・曜日ごとの設定を追加。

## ファイル

変更：

- `src/lib/shift/eligibility.ts`
- `src/lib/shift/rules.ts`
- `src/lib/shift/service.server.ts`
- `src/lib/shift/submitters-route.server.ts`
- `src/lib/shift/kot-push.server.ts`
- `src/app/system/shift/MyShift.tsx`
- `src/app/system/shift/ShiftManager.tsx`
- `src/app/system/shift/ShiftSubmitters.tsx`
- `src/app/system/shift/KotSendPanel.tsx`
- `src/app/api/system/shift/submitters/route.ts`
- `src/lib/shift/kot-push.test.ts`
- `src/lib/shift/submitters.test.ts`

追加：

- `src/lib/shift/defaults.server.ts`
- `src/app/system/shift/DefaultShiftDays.tsx`
- `src/app/system/shift/DefaultPatternSettings.tsx`
- `src/app/api/system/shift/team/manual/route.ts`
- `src/lib/shift/default-pattern.test.ts`
- `src/lib/shift/default-migration.test.ts`
- `src/app/system/shift/DefaultShiftDays.test.tsx`
- `supabase/migrations/20261104000517_shift_default_pattern.sql`
- `scripts/shift/seed-default-pattern.mjs`
- 本レポート

マニュアル下書き：`docs/manual-drafts/09_シフト/` の⓪①②③④、共通の`manual.css`。④を先に作成し、5点すべてv2.3・2026-11-04で統一。元のマニュアル保管場所は読み取りだけ。Storageへは上げていない。

## Migration・初期値

Migrationは**ファイル作成のみ、未適用**。515の備考付きsave_shift_personを土台にして置換。既存の取込処理が開始だけを入れるINSERTも保つ。

初期値スクリプトは**未実行**。直近の完了した2か月の予定から最頻形を算出（当月途中の欠けを休みと数えないため、完了月を採用）。祝日枠は休み。既定は読取り、`--apply`で未登録行だけを保存。競合時も既存行を上書きしない。従業員が照合できない場合は報告して除外。30分単位でない予定は停止。

cron追加なし。画面の定期取得追加なし。**自動実行は1日0回**。手動スクリプト1回につきKING OF TIMEの読取りは従業員一覧1回＋対象所属数。中継の仕事完了待ちは最大55回／仕事、1秒間隔。

## テスト

- `npx tsc --noEmit`：成功。
- `npx vitest run src/lib/shift src/app/system/shift src/lib/ui/no-flicker-source.test.ts`：14ファイル・70件成功。
- `node --check scripts/shift/seed-default-pattern.mjs`：構文確認成功。本体の実行はしていない。
- `npx vitest run src --exclude '**/employment-contract-pdf-integrity.test.tsx'`：成功。710ファイル成功・6スキップ、6,802件成功・8スキップ（569.31秒）。実行中に追加した検証も含む最終確認は上記のシフト関連テストで実施。既存テストからjsdomの画面遷移未実装メッセージが出たが、失敗はなし。

テストは対象判定・開始前・未設定・曜日と祝日の初期値・本人の時刻制限・備考と一緒の提出・責任者の変更・休憩・定休日候補からの除外・有給の入力済み記録・設定権限・21:00以外の終了・有給の勤務削除・既存テレマ・ちらつき防止を含む。

## Claudeへの引継ぎ

- SQLは未適用で、実DB上での動作確認はしていない。未提出の確定と定休日トリガーはSQLの内容をテストで確認した段階。適用前に確認する。
- 祝日は既存の`jp-holidays.ts`と同じ2026・2027年一覧をSQL側にも記述。両者一致のテストあり。2028年以降の追加時は両方更新する。
- 既定勤務の初期値を読取りで確認し、必要な人・曜日を確認してから適用する。未設定の人がいると確定も止める。
- 係1.3.1の既存PUT・DELETE・休憩形式の範囲内。実通信による検証はしていない。
- 画面確認はClaude担当。ブラウザ・computer-use未使用。KING OF TIME・LINEの実呼出しなし。本番更新・ホストPC操作・Storage公開なし。vercel.json変更なし。
