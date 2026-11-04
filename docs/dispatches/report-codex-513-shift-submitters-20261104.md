# Codex-513 作業レポート（2026-11-04）

## 実装
- 提出対象を「既定の決まり＋追加−除外」に統一。在籍無効・削除済み・退職日が今日以前の人は追加済みでも対象外。
- 本人提出（Garden・モバイル・LIFF）、みんなのシフト、確定対象、未提出通知、KING OF TIME送信前の対象確認は共通の `employees()` を使用。
- 業務委託も追加対象にできる。本人提出の既存の入口には業務委託を除く役職制限がないことを確認。
- みんなのシフトの歯車に提出者設定を追加。既存の ViewerPicker と RowActionButton を使用し、追加・除外・復元は楽観更新、失敗時は復元して通知。
- 成功時は表を再取得。取得中に既存の表を消さない。提出者一覧はチーム・社員番号順、2列で表示し、一覧内部にスクロールを作らない。
- 小窓のスクロールバーは既存の全小窓共通CSSで非表示。提出者設定がある小窓だけ幅を拡大。
- APIの全メソッドで全権管理者を確認。変更時は同一オリジンも確認。設定操作は希望・確定シフトを更新・削除しない。

## 変更ファイル
- `src/lib/shift/eligibility.ts`
- `src/lib/shift/service.server.ts`
- `src/lib/shift/submitters.server.ts`（新規）
- `src/lib/shift/submitters-route.server.ts`（新規）
- `src/app/api/system/shift/submitters/route.ts`（新規）
- `src/app/system/shift/ShiftSubmitters.tsx`（新規）
- `src/app/system/shift/shift-submitters.module.css`（新規）
- `src/app/system/shift/ShiftManager.tsx`
- `src/app/system/_components/ViewPermissionButton/ViewPermissionButton.tsx`
- `src/app/system/_components/ViewPermissionButton/SystemViewContext.tsx`
- `src/app/system/_components/ViewPermissionButton/view-permission.module.css`
- `src/lib/shift/service.test.ts`
- `src/lib/shift/submitters.test.ts`（新規）
- `src/app/system/shift/ShiftSubmitters.test.tsx`（新規）

## Migration
`supabase/migrations/20261104000513_shift_submitters.sql` を作成。`system_shift_submitter` の主キー・外部キー・mode制約・更新日時・更新者・RLS有効（ポリシーなし）を定義。`EMP-1490` を include で初期登録。

**未適用。適用は Claude が行う。コード利用前にmigrationの適用が必要。**

## テスト
- `npx tsc --noEmit`：成功。
- 関連範囲（shift、歯車、`src/lib/ui/no-flicker-source.test.ts`）：11ファイル・63件成功。
- `npx vitest run src --exclude '**/employment-contract-pdf-integrity.test.tsx'`：成功（終了コード0）。697ファイル成功・6ファイルスキップ、6,712件成功・8件スキップ。実行中にjsdomの画面遷移未実装の警告あり。
- 新規2テストファイルは全体テスト開始後の追加のため、上記全体件数には含まれない。関連範囲11ファイル・63件の実行で両方を含めて成功を確認済み。
- 最終の追加操作調整後も提出者UIテスト3件と型チェックが成功。
- テストはDB・LINE・KING OF TIMEをモックし、実サービスへの呼び出しは行っていない。

## 再取得回数・実行上の制約
定期再取得・cronの追加なし（追加の定期処理は0回/日）。設定欄を開くと設定APIを1回読み込み、変更成功ごとにみんなのシフトの表を1回読み直す。回数は利用者の操作回数に依存する。

git、computer-use、ブラウザ操作、本番書き込み、migration適用、LINE・KING OF TIMEの実呼び出しは行っていない。
