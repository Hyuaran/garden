# Codex-499 AP日報「振り返り」実装報告（2026-10-31）

## 変更ファイル
- `src/app/my/ApDailyReport.tsx`：従来の RecentList を振り返り専用部品に置き換え。
- `src/app/my/ApDailyReview.tsx`：5 系列・左右 2 軸の折れ線グラフ、共通 DataTable、共通 Modal（md）、HeaderViewToggle、表示形式の localStorage 保存を実装。
- `src/app/my/ApDailyReview.module.css`：グラフを PC 360px／スマホ 260px、本文幅いっぱいに設定。小窓の改行・長文折り返し、合計の表示を調整。
- `src/app/my/ApDailyReport.test.tsx`：9 件。グラフの系列名・日付順・軸、合計の加重有効率／件数からの率、日付降順、日報小窓、入力タブのボタン非表示、表示形式の保存・復元、0 件／0 コール、OS／Garden の明暗設定、既存入力機能を検証。
- 本報告書。

API・保存処理は変更していない。グラフの元データと表の rows は古い順、表の初期ソートは日付降順。合計は検索・絞り込み後の行から計算し、日々の率を単純平均しない。空のコインは小窓で「記録なし」。

## 色（系列順）
| 系列 | ライト | ダーク |
|---|---|---|
| 総コール | `#10233F` | `#93B8EA` |
| 留守 | `#0EA5A0` | `#2DD4BF` |
| 見込み | `#64748B` | `#A9B8CC` |
| トス／獲得 | `#7856A0` | `#C4A7E7` |
| コイン作成数 | `#B9536B` | `#F095A5` |
| 軸・凡例の文字 | `#394B63` | `#DFE8F5` |
| 目盛り線 | `#DFE5ED` | `#34455C` |

`html[data-theme]` の明示指定を優先し、指定がなければ `prefers-color-scheme` を使う。MutationObserver と matchMedia の change で即時反映し、解除処理も実装。

## 検証
- `npx tsc --noEmit`：成功。
- `npx vitest run src/app/my/ApDailyReport.test.tsx`：9 件成功。
- `npx vitest run src/app --exclude '**/employment-contract-pdf-integrity.test.tsx'`：成功（終了コード 0）。546 ファイル成功・6 ファイルスキップ、4,427 件成功・8 件スキップ。実行時間 456.10 秒。jsdom の「Not implemented: navigation to another Document」警告は出たがテスト失敗なし。
- UTF-8 で書き込み、読み直して日本語を確認。
- 社長スタイル §2.5・§2.6 を参照。表・小窓・右上切り替えは共通部品を使用。数字は右、日付・時間は中央。表内の横スクロール・日付列固定は DataTable 標準を使用。
- 実ブラウザ確認は接続ホストが利用できず未実施（`The browser access host is unavailable`）。390px、ライト／ダークの実画面点検は未完了。テーマ切り替えはコンポーネントテストで検証した。

## 取得回数・作業範囲
定期取得・cron の追加は 0 回／日。既存の初回表示・日付変更時の取得を維持し、表示切り替え・テーマ変更では再取得しない。git コマンドは一切実行していない。
