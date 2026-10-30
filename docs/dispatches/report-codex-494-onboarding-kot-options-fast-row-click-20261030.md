# Codex-494 実装報告（2026-10-30）

## 実装内容・変更ファイル

- `src/app/system/onboarding/_lib/hire-candidates.server.ts`
  - `system_kot_options_cache` の `hire` を先に読み、控えがあれば KOT の取得を待たず `cached: true` 付きで返す。法人一覧は従来どおり DB から取得する。
  - `updated_at` が10分より古い場合、`next/server` の `after()` で応答後に取得・保存する。取得失敗と DB 保存失敗はログだけにし、既存の控えと応答を維持する。
  - 控えがない場合は KOT を取得し、控えへの保存を待ってから返す。KOT の停止時間判定は既存関数に任せる。
- `src/app/system/onboarding/HireCandidatesClient.tsx`
  - 入社後の確認表の「操作」列と「確認する」ボタンを削除した。既存の行クリックと共通表のキーボード操作を使用する。入社予定者の操作列は変更していない。
- `src/app/system/onboarding/_lib/hire-candidates.test.ts`
  - 新しい控え・10分ちょうどの控えでは KOT を呼ばないこと、10分を超える控えの更新が `after` に渡り実行されること、控えがなければ取得・保存すること、背景の取得・保存失敗でも応答を保つことを追加検証した。
- `src/app/system/onboarding/HireCandidatesClient.test.tsx`
  - 確認ボタン・操作列の不在、行のフォーカス可能属性、Enter での表示、閉じた後のフォーカス復帰、行クリックでの再表示を検証した。既存の確認操作テストも行から開くよう変更した。
- `docs/dispatches/dispatch-codex-494-onboarding-kot-options-fast-row-click-20261030.md`
  - AGENTS.md に従い取り直しの1日あたりの回数見積もりを追記した。

## 検証結果

- `npx tsc --noEmit`：成功（終了コード0）。
- `npx vitest run src/app/system/onboarding src/app/api/system/hire-candidates`：32ファイル・320テストすべて成功（終了コード0）。
- 最初のテスト実行では、削除したボタンを探す既存テスト3件が失敗した。行操作への変更後、上記の全件成功を確認した。
- インストール済み Next.js の `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md` と、既存の roster-sync webhook の `after()` 使用例を確認した。
- 本番への接続・速度計測は行っていない。控えがある場合に KOT 取得が応答を妨げないことはテストで確認済みだが、0.5秒以内の実測確認は未実施。

## 判断した点・制限

- 背景更新はアクセス時にのみ予約し、cron・定期ポーリング・DB テーブルは追加していない。順次アクセス・更新成功時は約144更新/日以下（KOT は1更新あたり2 API）。同時アクセスや更新失敗時の再試行はリクエスト数に依存し、厳密な日次上限ではない。
- Supabase は保存エラーを戻り値で返すため、保存結果も既存の `checked()` で検査し、背景処理ではログに残すようにした。
- 指示書が参照する「社長スタイル §2.5・§2.6」の本文は今回確認できた資料内では見つからなかった。既存の共通 DataTable と Modal をそのまま使い、独自の表・小窓は追加していない。
- git コマンドは一切実行していない。
