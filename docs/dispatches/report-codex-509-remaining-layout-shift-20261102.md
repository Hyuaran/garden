# Codex-509 作業レポート（2026-11-02）

## 修正
- 共通 UpdatedStamp：非表示の日時見本文字と表示文字を同じグリッドセルに重ね、等幅数字で取得前後の幅を予約。
- Bud 口座残高：法人マスター7法人＋合計行の高さを初回から予約。通常表も行高64pxを確保。カード利用も読み込み枠を表示し、期間操作の位置を維持。
- Bud 振込：ポータル接続前のHTMLに表見出しと7行の読み込み枠を配置。接続後は枠を隠す。カレンダーは読み込み中も42日分を描画。右上 access-badge は共通フレームで幅を予約。

## 追加点検で見つけて修正した画面
- 銀行・カード明細：/bud/bank/accounts/[id]
- 明細一覧・取込履歴・集計：/bud/statements、/bud/statements/imports、/bud/statements/summary
- 振込の承認待ち・振込予定・一覧・受信トレイ：/bud/transfers 内各タブ
- 振込CSV出力：/bud/transfers/csv-export
- 振込詳細・詳細内の履歴：/bud/transfers/[transfer_id]
- 明細の手動照合モーダル

いずれも短い読み込み文だけだった箇所に、表の見出し・行高を持つ共通読み込み枠を追加。権限確認の BudGate は認証境界として維持。

## 変更ファイル
- src/app/system/_components/UpdatedStamp/{UpdatedStamp.tsx,updated-stamp.module.css}
- src/app/bud/_components/{BudTableLoading.tsx,BudTableLoading.module.css,BudFaithfulFrame.module.css}
- src/app/bud/bank/{BankAccounts.tsx,BankAccounts.test.tsx,TransactionDetail.tsx,bank.module.css}
- src/app/bud/statements/StatementsContent.tsx
- src/app/bud/statements/imports/StatementsImportsContent.tsx
- src/app/bud/statements/summary/StatementsSummaryContent.tsx
- src/app/bud/statements/_components/ManualAssignModal.tsx
- src/app/bud/transfers/{page.tsx,page.test.tsx}
- src/app/bud/transfers/csv-export/page.tsx
- src/app/bud/transfers/[transfer_id]/UrlViewClient.tsx
- src/app/bud/transfers/_components/{TransferAmountCalendar.tsx,TransferApprovalPanel.tsx,TransferPaymentCategoryPanel.tsx,TransferInboxTray.tsx,TransferDetailContent.tsx,StatusHistoryTab.tsx}
- src/lib/ui/remaining-layout-shift.test.tsx

## 検証
- 追加点検＋既存関連点検：5ファイル26テスト成功。最終調整後、口座・振込・レイアウト点検3ファイル20テストも成功。
- npx tsc --noEmit：.next/dev/types/validator.ts の削除済み hire-candidates API参照7件のみエラー。
- .next を除外する一時設定による npx tsc --noEmit：成功。
- 指定の全体 Vitest：終了コード0。686ファイル成功・6ファイルスキップ、6648テスト成功・8テストスキップ（510.78秒）。全体実行開始後に追加した2テストファイルは上記の個別実行で成功を確認。jsdom の画面遷移未実装メッセージあり、失敗なし。
- ブラウザ操作・本番への書き込み・git操作は実施していない。実測CLSの再計測は未実施。
- cron・定期取得・取得回数の追加なし（増加0回/日）。
