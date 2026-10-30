# Codex-495b 作業報告（2026-10-30）

## 実装内容

- ボタン列を通常フローへ戻していた System の規則と、Rill の topbar を高くする規則を削除しました。
- 共通の検索置き場をボタン列の下に絶対配置しました。間隔は 6px、検索欄の外寸は 36px、幅と右端はボタン列に一致します。Bud・My も共通部品を通して topbar の高さを増やさず表示します。
- 検索が存在する間だけ、対応する main に `--page-search-width`（実幅 + 16px）と `--page-search-bottom`（main 上端からの下端位置）を設定します。ResizeObserver と子要素の MutationObserver で変化を検知し、検索の撤去・モバイルへの移動・アンマウント時に解除します。Garden の拡大率を考慮して CSS px に換算します。
- Root の PageHeader は CSS で右側の部品に検索幅分の margin-right を設定し、見出しの高さを確保します。検索がある場合もタイトルを上端に保ちます。
- onboarding の共通見出しに min-height を設定し、入社予定者・入社後の確認の両方で SystemTabs と歯車を検索欄の下へ送ります。
- LINE の「人とタグ」と Bud の「事業の収支」はパンくずとタイトルを見出しにまとめ、検索下端までの高さを確保します。次の最終更新・タブの行を下へ送ります。見出しの実位置も計測するため、Bud の topbar 分の余白を二重加算しません。
- 800px 以下で表の上に検索を戻す既存処理、検索・ソート・絞り込み処理は変更していません。
- 新しい cron・定期処理・データの取り直しはありません。追加の定期取得回数は 0 回/日です。

## 変更ファイル

- `src/app/system/_components/PageSearchSlot/PageSearchSlot.tsx`
- `src/app/system/_components/PageSearchSlot/PageSearchSlot.module.css`
- `src/app/system/_components/PageSearchSlot/PageSearchSlot.test.tsx`
- `src/app/system/_components/PageSearchSlot/PageSearchLayout.test.ts`（新規）
- `src/app/system/_components/ShachoShell/shacho-shell.module.css`
- `src/app/system/_components/DataTable/DataTable.module.css`
- `src/app/rill/_components/RillShachoShell.module.css`
- `src/app/root/_components/root-shell.module.css`
- `src/app/system/onboarding/onboarding.module.css`
- `src/app/system/line/LineManager.tsx`
- `src/app/bud/profit/broadband/BroadbandTable.tsx`

## 検証

- `npx tsc --noEmit`: 成功。
- PageSearchSlot の既存テストと追加テスト: 2 ファイル、14 件成功。
- 寸法を模擬して、System / Root / Bud / My / Rill の main 内・兄弟 header の組み立てで、幅 280px → CSS 変数 296px、下端 120px → CSS 変数 120px を確認しました。幅変更 340px → 356px、モバイル移動・検索撤去時の変数解除、見出し位置の測定も確認しました。
- 対象ページの見出し・タブ・最終更新の順序、および margin-right / min-height / デスクトップ条件をソース検証しました。

## 判断・確認範囲

- Next.js 同梱の CSS ガイドを読んでから変更しました。
- 実ブラウザでの実矩形の交差検証は実施していません。指示書の代替条件に従い、寸法を模擬した DOM テストと CSS・ページ構成の検証で確認しています。
- Root の PageHeader.tsx は既存の class を利用できるため、コンポーネントを変えず CSS で実装しました。
- git コマンドは一切実行していません。

## 指定範囲の最終結果

`npx vitest run src/app/system/_components src/app/root src/app/system/onboarding src/app/system/line --exclude '**/employment-contract-pdf-integrity.test.tsx'`

96 ファイル・1,303 件すべて成功（終了コード 0）。実行中に jsdom の `Not implemented: navigation to another Document` が表示されましたが、テスト失敗はありません。見出し位置の確認を追加した後の PageSearchSlot 単独再実行も 14 件すべて成功しています。
