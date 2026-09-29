# Codex-361b Clarity の続き：受け皿の直し＋残りの場所に「伏せる」の印を付ける

作成日: 2026-09-29
作業ツリー: C:\garden\a-bloom-008（Codex-361 の変更が未コミットのまま入っている状態から続ける）
**git は触らないこと（commit・branch・stash すべて禁止）。本番のデータ・DB に触らないこと。開発サーバ・ブラウザを起動しないこと。見た目と日本語の文言は変えない。**

必ず先に読むもの：C:\garden\a-bloom-008\docs\dispatches\dispatch-codex-361-clarity-20260929.md（特に §1-B の表）

## 1. Codex-361 の点検で分かったこと
- 伏せる印を付けたのは リストマスタ・マイページ・Root の従業員の 3 か所だけで、表の残り（共通の枠・System 各画面・Root の残り・Bud・Tree・Rill・ポータル・Bloom・BudFaithfulFrame）が付いていない。付けなかった理由の報告も無い
- `ClarityTracker.tsx` に**呼び出しの受け皿（キュー）が無い**：公式の読み込みコードは、本体が届く前に `window.clarity = window.clarity || function(){ (window.clarity.q = window.clarity.q || []).push(arguments) }` を作る。今は `window.clarity` が無いと identify をせずに終わり、本体が届いた後も呼び直されないので、最初の画面で identify が抜ける

## 2. やること
### A. 受け皿（`src/app/_components/analytics/ClarityTracker.tsx`）
- ID が有効なとき、identify の前に上の受け皿を必ず作る（受け皿を作る関数を切り出してテストできるように）。その後 `window.clarity("identify", …)` を呼ぶ（本体が届けば、ためた呼び出しを処理する）
- `window.clarity` の型に `q?: unknown[]` を足す
- テスト：ID ありで `window.clarity` が無い状態から、identify が受け皿の `q` にたまる／ID 無しでは受け皿を作らない

### B. 残りの場所すべてに `{...CLARITY_MASK}` を付ける
- 361 の §1-B の表のうち、まだ付いていない行を**全部**。1 ファイルずつ、氏名・住所・名義・差出人などを出している**まとまり（外側の要素）**に付ける
- サーバーコンポーネントでも属性を足すだけでよい（`CLARITY_MASK` はただのオブジェクト）
- 表の行番号とずれていたら中身を見て正しい要素に付ける。どうしても付けられない場所は理由を報告に書く

## 3. テスト
- `npx vitest run src/app` 全部。**前から落ちている 4 ファイル**（KpiCard・employment-contract-pdf・todoke-pdf・kanri runs excel）はそのままでよいが、それ以外は緑に
- 代表として Bud の振込の詳細・Tree の通話画面・Rill のメール一覧・ShachoShell の本人の名前で、祖先に `data-clarity-mask="true"` があるテストを足す
- `npx tsc --noEmit`・触ったファイルの eslint

## 4. 完了報告（コードブロックで）
- 印を付けたファイルの一覧（361 の分も含めて全部）と数
- 付けられなかった場所と理由
- テスト・tsc・eslint の結果（前から落ちているものは別に）
