# Codex-495 実装報告（2026-10-30）

## 実装
- PageSearchSlot に Context、置き場、ボタン列と置き場の共通レイアウト、表ごとの利用登録・解放、検索入力の参照ヘルパーを追加。
- 801px 以上では、最初の対象 DataTable の検索入力と解除ボタンを createPortal でヘッダーへ移動。入力の状態・並び替え・列フィルター・ページングは従来の DataTable 内に保持。
- 小窓（dialog / role=dialog / role=alertdialog）内、置き場なし、2つ目以降の表は従来どおり。先頭の表が消えると登録を解放し、次の表が引き継ぐ。すべて消えると置き場は高さ0。
- 800px 以下では表の上に全幅で表示。matchMedia の change で切り替え、検索文字を保持する。取り直し・ポーリングは追加していない（追加の取得回数は1日0回）。
- ヘッダー側は「検索」の小見出しを出さず、aria-label「この画面の中を検索」、画面別 placeholder、虫眼鏡、解除ボタンを1行に配置。ボタン列との間隔9px、入力40px、form-kit と同じ8pxの角丸と既存の色変数を使用。
- Root 従業員の検索ショートカットは、表に付けた入力IDを解決することで移動先にもフォーカスできる。

## 変更ファイル
- src/app/system/_components/PageSearchSlot/PageSearchSlot.tsx（新規）
- src/app/system/_components/PageSearchSlot/PageSearchSlot.module.css（新規）
- src/app/system/_components/PageSearchSlot/PageSearchSlot.test.tsx（新規）
- src/app/system/_components/DataTable/DataTable.tsx
- src/app/system/_components/DataTable/DataTable.module.css
- src/app/system/_components/ShachoShell/ShachoShell.tsx
- src/app/system/_components/ShachoShell/shacho-shell.module.css
- src/app/bud/_components/BudShachoShell/BudShachoShell.tsx
- src/app/rill/_components/RillShachoShell.tsx
- src/app/rill/_components/RillShachoShell.module.css
- src/app/my/MyShell.tsx
- src/app/root/employees/page.tsx

## 崩れを避けるための対応・判断
- System / Root：検索が入っているときだけ右上のボタン列を通常フローにし、その直下に検索の行を確保。画面の見出し・歯車・最終更新はその下に流れるため重ならない。この方法では検索のある画面の見出し開始位置が従来より下がる。検索のない画面は従来の絶対配置を維持。
- Bud：既存の topbar 内でボタン列と検索を縦に組み、content より前で高さを確保。
- My：ヘッダーの右側を2段にし、ヘッダー自体の高さで検索の場所を確保。
- Rill：将来置き場が埋まっても既存の高さ60pxで切れないように、その場合だけヘッダーを可変高にする。現状 src/app/rill 配下に DataTable の利用は見つからず、対象の表画面はない。
- 検索入力を探すコードは src 配下を検索し、従業員マスタ以外は DataTable の列フィルターメニュー内の検索だったため、その部分は変更していない。
- Next.js 同梱の Server and Client Components ガイドと、社長スタイル正本の §2.5・§2.6 を確認。

## 検証
- npx tsc --noEmit：成功。
- 指定コマンド（PDF完全性テストを含む）：96ファイル中95成功、1295件中1294成功。失敗は指示書で対象外の employment-contract-pdf-integrity.test.tsx 1件のみ。
- 追加テスト：ヘッダーへの移動、検索と解除、小窓内、置き場なし、2つ目の表、先頭表の解放と引継ぎ、全表消去後の空化、800px境界での移動と検索文字保持、Root用 Ctrl+Shift+G ハンドラーによる移動先フォーカス。
- PDF除外の最終実行結果は下記に記録。
- 指定色から計算したコントラスト比：本文ライト16.24:1／ダーク14.12:1、placeholder ライト4.93:1／ダーク8.91:1。実画面の色を測定した値ではない。

## 未確認事項
computer-use による Chrome 操作を試みたが「Computer Use was not approved to use Google Chrome」で拒否された。したがって /system/onboarding（2タブ）、/system/line、/root/employees、Bud の実画面での1384・1024・800前後・390px × ライト／ダーク、および実際の従業員編集小窓の目視確認は未実施。自動テストとCSSの確認で代替したが、目視確認済みとはしていない。

Git コマンドは一切使用していない。

最終結果：npx vitest run src/app/system/_components src/app/root src/app/system/onboarding src/app/system/line --exclude '**/employment-contract-pdf-integrity.test.tsx' は95ファイル・1295件すべて成功（84.76秒）。ログ：tmp/test-495-excluding-pdf.log。

