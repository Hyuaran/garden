# DataTable の初期描画

- 仮の場所・既定の見た目で描いてから描き直さない。置き場所が無いうちは場所だけ取る。最初の見た目はサーバーで決められるもの（URL・権限・クッキー）で決める。保存値は useStoredView。表は loading を渡す。
- PC（801px以上）のローカル検索は初期HTMLからCSSで隠す。スマホとダイアログでは表の上に置く。右上の枠は入力前から36pxの高さと見出しの余白を予約する。
- 検索は同じportalコンテナーごと移動する。移動で入力欄を再マウントしない。幅変更でも入力値・フォーカスを保持する。
- URLのあるページは `withInitialUrlView` でサーバーの `searchParams` を渡す。Client Componentのページは別ファイルへ分け、ラッパーの第2引数を `true` にする。タブは共通の `useUrlTab` を使う。
- `useStoredView` の第3引数で保存形式を検証し、第4引数で既存形式に保存する。第3戻り値がfalseの間は該当領域を `visibility:hidden` にし、portalの表示切替にも `ready` を渡す。
- ブラウザ取得の表には `loading` を渡す。読み込み中は空結果の文を出さず、最低3行分の高さを予約する。初期一覧をサーバーで安全に読める場合は、そのデータを最初から渡す。
- 回帰確認：`src/lib/ui/no-flicker-source.test.ts`、`useStoredView.test.tsx`、`DataTable/NoFlicker.test.tsx`、`PageSearchSlot.test.tsx`。周期的な取得は `usePolling` のみ。この変更による定期取得の追加は0回/日。
