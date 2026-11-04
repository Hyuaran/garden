# Codex-517 作業レポート（2026-11-04）

開始時に pwd が `C:\garden\a-bloom-008`、`git log -1 --format=%h` が `cb90602d` であることを確認。以降 git は操作していない。

## 実装

- `src/lib/shift/rules.ts`：選べる勤務の型と本人の平日検査を追加。曜日の既定に一致する勤務も維持。土日祝には候補の時刻を追加で許可しない。
- `src/lib/shift/defaults.server.ts`：候補の取得・入力検査・保存を追加。候補の置換は専用SQL関数内で一括実行。
- `src/lib/shift/service.server.ts`：既定勤務の本人応答に options を追加し、提出検査へ渡す。
- `src/lib/shift/submitters-route.server.ts`：全権管理者の設定GET/PUTに候補を追加。更新前に曜日と候補の入力を検査。
- `src/app/system/shift/DefaultShiftDays.tsx`：平日に名前と時刻の候補を表示し、選んだ開始・終了を保存。責任者の入力と時間計算は維持。
- `src/app/system/shift/MyShift.tsx`、`ShiftSubmitters.tsx`：既存の読み込みに候補を含めて子へ渡す。読み込みの仕組みは維持。
- `src/app/system/shift/DefaultPatternSettings.tsx`：曜日の下に候補の追加・編集・削除を追加。削除は RowActionButton。

## Migration

`supabase/migrations/20261104000518_shift_default_options.sql` を作成した。適用していない。

- `system_shift_default_option`：従業員への外部キー、名前・開始・終了・表示順・更新者等。30分単位・開始＜終了。RLS有効、ポリシーなし、service_roleのみ許可。
- `replace_shift_default_options`：人ごとの候補をトランザクション内で置換。
- `save_shift_person`：517版をコピーし、本人提出時の平日の候補一致だけを追加。ほかの処理が同じことをテストで比較。
- 初期データは含めない。適用・候補登録・画面確認はClaudeが行う。

## マニュアル

指定の `C:\Claude\000_Garden\150_System_システム\00_マニュアル\09_シフト\` 内の④を先に、⓪①②③も直接更新。v2.4・2026-11-04にそろえ、平日の候補、設定方法、従来の勤務との関係を追記。Storageへはアップロードしていない。

## 検証

- `npx tsc --noEmit`：成功。
- `npx vitest run src/lib/shift src/app/system/shift src/lib/ui/no-flicker-source.test.ts`：16ファイル・76テストすべて成功。
- 追加・更新したテスト：`src/lib/shift/default-options.test.ts`、`default-pattern.test.ts`、`default-migration.test.ts`、`submitters.test.ts`、`src/app/system/shift/DefaultShiftDays.test.tsx`、`DefaultPatternSettings.test.tsx`。
- 平日の候補受理、土日祝の拒否、候補なしと既定勤務の維持、本人の応答・提出、設定の追加・削除、既存の権限拒否、時刻つきの名前、テレマ・送信処理の既存テスト、ちらつき防止の検査を実施。
- 変更対象のUTF-8を確認し、文字化けの連続した疑問符・置換文字がないことを確認。

定期取得・cron追加なし。追加の自動実行は1日0回。ブラウザ・computer-use・本番更新・migration適用・KING OF TIME/LINE実呼び出し・ホストPC操作は行っていない。

設定の曜日保存と候補保存は別の要求としてDBへ送るため、候補保存だけが失敗した場合は画面のエラーを確認して再保存する。候補一覧の削除・挿入自体は一括処理。
