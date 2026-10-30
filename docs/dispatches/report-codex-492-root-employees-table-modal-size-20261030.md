# Codex-492 実装報告（2026-10-30）

## 実装内容・変更ファイル

- `src/app/root/employees/page.tsx`
  - 共通 DataTable に移行。全15列に value/type を設定し、既存の表示と CLARITY_MASK を維持。
  - 社員番号の昇順、employee_id の行キー、500件表示、氏名・カナ・社員番号検索、列ごとの並べ替え・複数選択絞り込みを使用。
  - 旧検索欄・法人選択欄・右端の操作列・PageHeader の説明を削除。取り込みと新規追加を toolbar に移動。
  - 行クリック／Tab と Enter で編集小窓を開く。既存従業員のみ、タブ下に履歴・Garden 権限変更・有効／無効の操作を配置。従来の有効条件・title を維持。
  - 状態変更の成功後は編集小窓を閉じる。権限変更の成功後は、開いたままの編集内容にも権限を反映して古い値での上書きを防ぐ。
- `src/app/root/_lib/useMasterShortcuts.ts`
  - onSearch と rowNavigation オプションを追加。他画面の既定動作を維持しつつ、従業員では Ctrl+Shift+G を共通検索欄へ接続し、Ctrl+↑↓／Ctrl+Enter の行操作を無効化。
- `src/app/system/_components/Modal/Modal.tsx`
  - size に lg を追加。
- `src/app/root/_components/Modal.tsx`
  - width <= 520 は sm、width >= 800 は lg、それ以外は md に変換。
- `src/app/globals.css`
  - lg の960px幅を追加。既存の sm 520px／md 640px と同じ画面幅・garden-zoom の制約を使用。FieldGrid のレスポンシブ指定は維持。
- `src/app/root/employees/role-edit-ui.test.tsx`
  - 行から編集小窓を開く操作に更新。権限／状態変更の既存検証を維持し、共通検索・退職日の「なし」候補・編集から履歴を開く操作・新規追加で操作ボタンを出さないことを検証。
- `src/app/system/_components/Modal/Modal.test.tsx`
  - lg の data-size がパネルに付くテストを追加。

## 検証結果

- `npx tsc --noEmit`：成功（終了コード0）。
- `npx vitest run src/app/root/employees src/app/system/_components/Modal src/app/system/_components/DataTable`：成功（5ファイル、46テスト、終了コード0）。
- Next.js 同梱の `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md` を確認。
- 共通 DataTable の既存CSSで、hover／focus-visible 時は全 td（先頭列を含む）に同じ背景指定が適用されることを確認。
- ブラウザでの実画面・スマホ幅の目視確認は未実施。幅の制約と既存 FieldGrid 指定はコード確認。

## 判断した点

- ChoiceFilter／FilterRow は履歴小窓でも使うため、法人検索部分だけ削除して import は維持。
- 編集小窓を残して履歴・権限小窓を重ねる方式を採用。
- 共通 DataTable 本体と他の Root 画面の表は変更していない。
- 定期取得・cron は追加していない（追加の定期実行は0回／日）。
- git コマンドは一切実行していない。