# Codex-510 実装レポート（2026-11-02）

## 変更内容
- 公式LINEの定型文をDBから取得。鉛筆の小窓で変更、追加、確認後の削除ができるようにした。必須欄は FormRow、絞り込みは BoxSelect、確認も Garden Modal を使用。
- 題名・本文の `{年}` `{月}` `{令和}` を、ボタンを押した日の日本時間で置換。タグが見つからないときの注意は維持。
- 保存者の従業員ID・氏名と更新日時を記録。追加時は末尾の順番にする。
- 公式LINE・お知らせ・INNOVERA同期を閲覧設定に登録。LINEは既定で全権管理者のみ、タブ単位で表示・API操作を制限。middleware の固定制限も撤去してページ側の閲覧判定に統一。
- INNOVERAの既定は従来と同じ staff 以上。同期APIも新しい画面の権限を確認する。反映操作の既存役職制限は維持。
- System画面の登録漏れを検出するテストを追加。

## 変更ファイル
- `src/lib/auth/system-view-scopes.ts`
- `src/lib/auth/system-view-integration.test.tsx`
- `src/lib/auth/system-view-coverage.test.ts`（新規）
- `src/lib/line/broadcast-template.ts`（新規）
- `src/lib/line/tags.server.ts`
- `src/lib/line/line-view-access.test.ts`（新規）
- `src/app/system/line/page.tsx`
- `src/app/system/line/LineManager.tsx`
- `src/app/system/line/broadcast-templates.ts`
- `src/app/system/line/broadcast-templates.test.ts`
- `src/app/system/line/template-fixtures.test-data.ts`（新規・テスト用）
- `src/app/system/line/settings.test.tsx`
- `src/app/system/line/access.test.ts`
- `src/app/system/notices/page.tsx`
- `src/app/system/innovera/page.tsx`
- `src/app/api/system/line/manage/route.ts`
- `src/app/api/system/line/manage/route.test.ts`
- `src/app/api/system/line/groups/route.ts`
- `src/app/api/system/line/richmenu-image/route.ts`
- `src/app/api/system/innovera-sync/route.ts`
- `src/app/api/system/innovera-sync/route.test.ts`（新規）
- `src/middleware.ts`

## migration
`supabase/migrations/20261102000510_line_broadcast_templates.sql`（新規）

定型文の表・RLS（ポリシーなし）、従来の2つの定型文の初期データ、3画面の閲覧設定対象を登録するSQLを用意した。本文の文字・LF改行を維持し、年月だけを差し込みに変更。**適用していない。Claudeによる適用が必要。**

## テスト
- 関連15ファイル・168件成功（定型文API、権限、差し込み、画面、登録漏れ、no-flicker-source を含む）。
- 追加のINNOVERA APIテスト2件成功。
- 最新の画面テスト12件成功（追加・変更・確認後の削除を含む）。
- `npx tsc --noEmit`：`.next/dev/types/validator.ts` が参照する削除済み hire-candidates API の生成型エラー7件のみ。指示に従い `.next` を除く一時設定で `tsc --noEmit` を実行し成功。一時設定は削除。
- 指定の `npx vitest run src --exclude '**/employment-contract-pdf-integrity.test.tsx'`：688ファイル成功・6ファイルスキップ、6,667件成功・8件スキップ（483.73秒）。開始後に追加・変更したテストは上記の関連テストで別途成功。jsdom の画面遷移未実装メッセージは出たが失敗なし。

定期再取得・cronは追加なし（追加の定期実行は0回/日）。初回読み込みと操作後の既存の読み直しを使用。git・computer-use・ブラウザ操作・本番への書き込みは行っていない。
