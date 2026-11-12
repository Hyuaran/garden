# Codex-521 Soil（データベース）の画面を Root と同じ形で作る（2026-11-12）

作業場所：`C:\garden\a-bloom-008`（main）

**git は触らない（commit もしない）。computer-use・ブラウザ操作は使わない。本番に書き込まない（migration が要るならファイルを作るだけ。当てるのは Claude）。Kintone・Chatwork を本当に呼ばない。`vercel.json` の crons に足さない。** ファイルは UTF-8。文字化け（??）を残さない。必要な範囲だけ読む。
画面の文字はきちんとした日本語。英語・開発者用語・略称を出さない。**コードは周りと同じく読みやすく書く**（1行に詰め込まない）。

## 読むもの

- Root の形（まねる元）：`src/app/root/layout.tsx`・`src/app/root/_components/RootShell.tsx`・`src/app/root/RootHomeClient.tsx`・`src/app/root/_constants/types.ts` の `MASTER_MENUS`・`src/lib/auth/root-view.server.tsx`・`src/lib/auth/root-view-scopes.ts`
- 共通の殻：`src/app/_components/layout/GardenShell/ModuleShell.tsx`・`garden-shell-config.ts`（`soil` はもうある）
- 今の Soil：`src/app/soil/page.tsx`・`view.tsx`（準備中の仮の画面）、`src/lib/auth/leaf-forest-view-scopes.ts` の `soil-overview`
- 付与ポイント表（移す画面）：`src/app/system/product-points/`・`src/lib/product-points/`
- 権限：`src/lib/auth/permission-registry.ts`・`system-view-scopes.ts`・`src/app/system/_components/ShachoShell/shacho-shell-config.ts`
- マニュアル登録：`src/app/system/manuals/_lib/manuals-registry.ts`

## 背景（東海林さんの決定）

付与ポイント表のデータは Soil（データベース）にあるのに、画面は System にある。これを機会に、**Root と同じ形の画面を Soil にも作る**。最初に載せるのは付与ポイント表。今後、顧客管理など Soil のデータの画面をここに足していく。

## 画面

```
┌ Garden ─────────┬───────────────────────────────────────────────┐
│ Soil ／ データベース │ Soil                                最終更新：…       │
│                  │                                                     │
│ メニュー           │ ┌───────────────┐                                 │
│ ⌂ ホーム          │ │ ◇ 付与ポイント表   │                                 │
│ ◇ 付与ポイント表   │ │ 商材・獲得方法ごとの │                                 │
│                  │ │ 合計・トス・クローザー│                                 │
│                  │ └───────────────┘                                 │
└──────────────────┴───────────────────────────────────────────────┘
```

### 殻（`src/app/soil/layout.tsx`・新規 `SoilShell`）

- `RootShell` と同じ作り：`ModuleShell moduleId="soil" moduleName="Soil" moduleLabel="Soil ／ データベース"`。左のメニュー（ホーム＋ページ）・利用者名・所属・役職・ログアウト
- メニューの定義は `src/app/soil/_constants/menus.ts`（`MASTER_MENUS` と同じ形：slug・title・description・icon）。最初は `product-points` だけ
- アイコンは線画の SVG（絵文字を使わない）。Root の `RootMenuIcon` と同じ作り
- 見る権限の無いページはメニューに出さない（`viewAccess`）
- ログインしていなければ `/login?returnTo=…` へ

### ホーム（`/soil`）

- 準備中の仮の画面（`LeafForestPlaceholder`）をやめ、Root のホームと同じ「カードの一覧」にする。ただし色は直書きせず、社長スタイルの部品と色の変数を使う（`garden-style` スキル・正本 §2.5／§2.6）
- 見出し「Soil」、説明「Garden の各機能が共通で使うデータの台帳。」
- カードを押すとそのページへ。見る権限のあるカードだけ出す

### 付与ポイント表を移す（`/soil/product-points`）

- 今の `/system/product-points` の画面・サーバーの処理・テストを `src/app/soil/product-points/` へ移す。中身（表・絞り込み・小窓・保存・権限）は変えない
- パンくずは「Soil ＞ 付与ポイント表」
- `/system/product-points` は `/soil/product-points` へ転送する（ブックマーク・マニュアルのリンクが切れないように）
- System のメニュー（`shacho-shell-config.ts`）から付与ポイント表を外す
- マニュアル登録の画面の対応（`"system/product-points": [...]`）を `/soil/product-points` にする

## 権限

- `src/lib/auth/soil-view-scopes.ts` を新しく作る（`root-view-scopes.ts` と同じ形）。
  - `soil-overview`（ホーム）：**キーは変えない**。リストの API（`src/app/api/soil/list/`）と全体の検索がこのキーで見る権限を判断しているため
  - `soil-product-points`（付与ポイント表）：既定＝責任者以上
- `soil-overview` を `leaf-forest-view-scopes.ts` から移すか、そのまま使うかは、今の権限の設定（歯車で保存された値）が消えない方を選び、報告に理由を書く
- 付与ポイント表の今の権限キー（System 側）で保存された設定があれば引き継ぐ。無ければ新しいキーだけでよい
- 書き込みは今どおり全権管理者だけ
- 権限一覧（`permission-registry.ts`）に Soil の 2 ページが出ること。歯車で役職・個人ごとに設定できること

## 変えないもの

- 付与ポイント表の表・関数・データ（migration は要らないはず。要るならファイルだけ）
- リスト（`/system/list`）・リストの API・Root・System のほかの画面

## マニュアル

`C:\Claude\000_Garden\150_System_システム\00_マニュアル\34_付与ポイント表\` の 5 点で、画面の場所を「Soil ＞ 付与ポイント表」（`/soil/product-points`）に直す。版 v1.1・日付 2026-11-12。④を先に。**Storage へは上げない**。

## テスト

Soil のメニュー（見る権限の有無でページが出る・出ない）／ホームのカード／ログインしていないときの転送／`/system/product-points` の転送／付与ポイント表の既存のテストが新しい場所で通る／System のメニューに付与ポイント表が無い／権限一覧に Soil の 2 ページ／リストの API の見る権限（`soil-overview`）が今までどおり／ちらつきの検査。
`npx tsc --noEmit`、`npx vitest run src/app/soil src/lib/product-points src/lib/auth src/app/api/soil src/lib/ui/no-flicker-source.test.ts` が通ること。前から落ちているテスト（System のメニューの数・マニュアルの数など）は、今回の変更で数が変わるなら期待値を正しく直してよい。

## 終わったら

`docs/dispatches/report-codex-521-soil-module-screens-20261112.md` に、直したファイル・権限キーの判断・テスト結果・作れなかったものを書く。
