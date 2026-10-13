# Codex-371：スマホ向けの短い入口 `/m/nhk` で NHK訪問業務 報告フォームをそのまま開けるようにする（2026-10-13）

## 目的（東海林さんの言葉）
- 「今後もこのフォームを送信するのは正社員の訪販部隊。使用ツールはスマホ。リンクを押せば、ログインは必要ですが、フォーム入力画面にしたい」
- 「System→業務管理ツール→NHK訪問業務 報告フォーム と辿るのが面倒」
- 決定（2026-10-13）：**既存のスマホ土台 `/m` の中に `/m/nhk` を足す**。System のメニューや左の一覧は出さない。ログインが要るのは今までどおり

※ 「フォームの URL を開いてもログイン後に System ホームへ飛ぶ」不具合は Claude が別途修正済み（`src/app/system/layout.tsx` が戻り先を `/system` に固定していた → ミドルウェアの `x-pathname` から実際のパスを使う）。この指示書の範囲外

## 作業場所・禁止事項
- 作業ツリー：`C:\garden\a-bloom-008`。**git の操作は一切しない**
- 触らない：`.env.local`・`vercel.json`・既存の `src/app/system/forms/nhk-visit/**` の送信ロジック（Kintone への書き込み・Chatwork 配信・履歴の読み込み）。本物の外部サービスは呼ばない（テストはモック）
- 流用する：`src/app/system/forms/nhk-visit/NhkVisitClient.tsx`（フォーム本体）・`src/app/m/layout.tsx`（ログイン必須ゲート `MobileAuthGate`＋下の共通ナビ `MobileBottomNav`）
- 文言は日本語・開発者用語を出さない・絵文字は新しく足さない（アイコンが要るなら SVG 線画）

## 現状（Claude が読んだ）
- `/system/forms/nhk-visit/page.tsx`：サーバー側でログイン→在籍→`staff` 以上の確認 → `<NhkVisitClient submitterName employeeNumber />`
- `NhkVisitClient.tsx`：`"use client"`。先頭に `SystemBreadcrumb`（フォーム > NHK訪問業務 報告フォーム）と見出し `h1`。入力＝訪問日・開始／終了時刻・訪問先（`NHK_VISIT_DESTINATIONS`）・件数 5 種・交通費あり／なし・送信ボタン・送信後の履歴。CSS は `nhk-visit.module.css`（`pageShell`・`header`・`panel`…・社長スタイルの配色）
- `/m`（スマホ土台）：`layout.tsx` が `MobileAuthGate`（未ログインなら `/login?returnTo=<現在地>` へ）で包み、下に `MobileBottomNav`（ホーム／検索／やること／お知らせ／アカウントの 5 つ・固定・高さ約 78px）を出す。配色はベージュ系（`_lib/mobile-theme.ts`）。各ページは `src/app/m/<name>/page.tsx`
- ログイン画面は `returnTo` を受け取るとログイン後にそこへ戻す（入社手続きが未完了でも戻り先が優先）

## 作るもの

### 1. `src/app/m/nhk/page.tsx`（新規・サーバー側）
- ログイン・在籍・役職の確認は `/system/forms/nhk-visit/page.tsx` と同じ。未ログインは `MobileAuthGate` が `/login?returnTo=%2Fm%2Fnhk` へ送るので、ページ側では `auth.user` が無ければ同じく `redirect("/login?returnTo=%2Fm%2Fnhk")`
- `staff` 未満のときは、System 側と同じ文言「この画面は社員以上が使えます／必要な場合は責任者に確認してください。」を画面幅いっぱいのカードで
- 通れば `<NhkVisitClient submitterName employeeNumber mobile />`
- `metadata.title` は「NHK訪問業務 報告 | Garden」

### 2. `NhkVisitClient` に `mobile?: boolean`（既定 false）を足す
画面（幅 390px のスマホの例）：
```
┌──────────────────────────────────┐
│ NHK訪問業務 報告        桐井 大輔 さん │ ← 小さな見出し（h1 相当・1 行）。パンくずは出さない
├──────────────────────────────────┤
│ 訪問日   [ 2026-10-13 ]            │
│ 時間     [ 09:30 ] 〜 [ 18:00 ]    │
│ 訪問先   [ NHK大阪放送局 ▼ ]        │
│ 新規 地上 [ 0 ]  新規 衛星 [ 0 ]    │ ← 件数は 2 列（指で押しやすい高さ 44px 以上）
│ 住所変更 地上 [ 0 ] 住所変更 衛星 [ 0 ] │
│ 口座・クレジット [ 0 ]               │
│ 交通費   ( ● あり )( ○ なし )        │
│ ┌──────────────────────────────┐ │
│ │        送信する（大きなボタン）   │ │ ← 画面幅いっぱい・高さ 52px
│ └──────────────────────────────┘ │
│ 今日の送信済み（履歴）…              │
└──────────────────────────────────┘
│ ホーム  検索  やること  お知らせ  ｱｶｳﾝﾄ │ ← 既存の下ナビ（そのまま）
```
- `mobile` のとき：`SystemBreadcrumb` を出さない／見出しは 1 行・小さめ（18px 程度）で右に氏名／左右の余白 16px・カードの角は既存のまま／入力欄とボタンの高さを 44px 以上・文字サイズ 16px 以上（iOS で拡大されないため）／送信ボタンは幅いっぱい
- 送信の流れ・API・履歴の表示は System 側と**完全に同じ**（同じ関数・同じ `fetch` 先）。`mobile` は見た目の切り替えだけ
- CSS は `nhk-visit.module.css` に `.mobile` 系のクラスを足す形（System 側の見た目は変えない）。ダーク／ライトは `/m` の土台に合わせる（`/m` はライト固定なら合わせてライト）

### 3. 下ナビ（`MobileBottomNav`）はそのまま
- 5 つで枠が埋まっているので項目は足さない。`/m/nhk` を開いているときはどれも非選択でよい

### 4. 入口の案内
- `src/app/m/page.tsx`（スマホのホーム）に「NHK訪問業務 報告」へのカード（またはリンク）を 1 つ足す（`staff` 以上のときだけ表示できるなら表示条件を付ける。役職が取れない作りなら全員に出してよい＝開いた先で社員以上の確認が効く）

## テスト（vitest・既存の流儀）
- `NhkVisitClient` の `mobile` でパンくずが出ない・送信ボタンがある・送信の `fetch` 先が System 側と同じ
- `/m/nhk` のページ：未ログイン→`/login?returnTo=%2Fm%2Fnhk`／`staff` 未満→案内文／`staff` 以上→フォーム
- 既存テスト（`NhkVisitClient.test.tsx` ほか）は緑のまま

## 完了報告（コードブロックで。東海林さんがそのまま読む）
1. 変えたファイル一覧（新規／変更）
2. `npx tsc --noEmit` と `npx vitest run` の結果（件数）
3. 画面の確認手順（スマホ幅でのログイン→フォーム→送信まで。実際の送信はしない）
4. 迷った点・決め打ちした点
