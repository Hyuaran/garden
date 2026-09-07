# Codex-291c リストマスタ：画面を System へ移す（データと API は Soil のまま）

作業ツリー：`C:\garden\a-list-001`（ブランチ feat/list-master・すべて未コミット）
**git を触らない（commit / branch / stash 禁止）。SQL・本番データを触らない。** 完了報告はコードブロックで出す。

## 0. 背景（東海林さんの決定 2026-09-07）
- リストマスタのデータの置き場所は Soil のまま（表 soil_list_*・API `/api/soil/list/*`）
- **画面だけを System に置く**。理由：今の `/soil/list` は「準備中」モジュールの下で、Soil の入口は管理者（admin）限定。マネージャー以上が使う画面なのに入口が無い。System はマネージャー以上が使う裏方の道具の置き場で、管理表ポータルなどのカードが並んでいる
- 画面の名前は「リストマスタ」。上部は「System / リストマスタ」

## 1. やること

### 1-1. 画面の移動
- `C:\garden\a-list-001\src\app\soil\list\page.tsx` → `C:\garden\a-list-001\src\app\system\list\page.tsx`
  - `C:\garden\a-list-001\src\app\system\kanri\page.tsx` と同じ形にする：ログイン確認は `src/app/system/layout.tsx`（ShachoShell）が行う。役割が manager 未満なら「この画面は責任者以上が使えます／必要な場合は責任者に確認してください。」の案内だけを出す（kanri と同じ文言・同じ見た目）
  - `metadata.title` は `"リストマスタ | Garden"`
- `C:\garden\a-list-001\src\app\soil\list\_components\SoilListClient.tsx` と `SoilListClient.module.css` → `C:\garden\a-list-001\src\app\system\list\_components\`（ファイル名は `ListMasterClient.tsx` / `list-master.module.css` に改名）
- `C:\garden\a-list-001\src\app\soil\list\_lib\list-fields.ts` → `C:\garden\a-list-001\src\app\system\list\_lib\list-fields.ts`。API 側（`src/app/api/soil/list/**`）の import `@/app/soil/list/_lib/list-fields` をすべて `@/app/system/list/_lib/list-fields` に直す（テストも）
- 旧 `C:\garden\a-list-001\src\app\soil\list\` は**丸ごと削除**（まだ公開していないので置き換えでよい）。`src/app/soil/page.tsx`（準備中）と `layout.tsx` はそのまま
- API のパス `/api/soil/list/*` と中身は**変えない**（データ層＝Soil）

### 1-2. 見出しと見た目（System の枠の中に入る）
```
┌ ShachoShell（左：メニュー／上：System のヘッダー）────────────────────────┐
│ System / リストマスタ                                                      │
│ リストマスタ                                                               │
│ 営業リストを条件で絞って件数を見て、.mer に書き出します。                  │
│                                                                            │
│ ┌ 絞り込み（10 項目）──────────────┐ ┌ 保存した条件 ───────────────┐   │
│ │ 都道府県 ▾  AU光架電可否 ▾ …      │ │ …                             │   │
│ │ [件数を見る] [条件を保存]  該当 ○件│ └───────────────────────────────┘   │
│ └───────────────────────────────────┘                                       │
│ ┌ 一覧（先頭 100 件・個人情報は一部伏せる）────────────────────────────┐ │
│ ┌ 書き出し（列・上限・並び・[.mer を書き出す]・書き出し記録）──────────┐ │
└────────────────────────────────────────────────────────────────────────────┘
```
- 上部の 2 行は kanri と同じ部品の使い方：eyebrow「System / リストマスタ」＋ h1「リストマスタ」＋説明 1 行。「Soil ／ リストマスタ」「営業リスト抽出」の表記は無くす
- `.page` の `min-height: 100vh`・全面背景・`padding: 32px` は、ShachoShell の枠と二重にならないよう `C:\garden\a-list-001\src\app\system\kanri\kanri.module.css` の `pageShell`／`header`／`eyebrow` と同じ扱いにする（色・フォント・角丸・余白は kanri と揃える＝社長スタイル）
- 絵文字は使わない。画面文言に開発者用語（API・migration 等）を出さない
- 絞り込み・件数・一覧・保存した条件・書き出し・書き出し記録の**機能と並びは変えない**

### 1-3. System ホームにカードを足す
- `C:\garden\a-list-001\src\app\system\_components\ShachoShell\shacho-shell-config.ts` の `SYSTEM_MENU_ITEMS` に追加（「管理表ポータル」の直後）：
  `{ label: "リストマスタ", description: "営業リストを条件で絞って件数を見て、.mer に書き出します。", icon: <既存の SystemIcon から選ぶ（folder か chart。新しいアイコンを足さない）>, href: "/system/list", minRole: "manager" }`
- カードの並びと数を見ているテストを直す：`src/app/system/page.test.tsx`、`src/app/system/_components/ShachoShell/ShachoShell.test.tsx`、`SidebarNavigation.test.tsx`（準備中は 3 つのまま）
```
System ホーム（カード）
… [契約書管理] [関電トスポータル] [コール数配信(準備中)] [テレマ日報(準備中)] [給与試算(準備中)] [管理表ポータル] [リストマスタ]
```

## 2. 変えないもの
- API（`src/app/api/soil/list/**`）の処理・送る形（`{ condition: { filters } }`）・権限（manager 以上）・.mer の形式・伏せ字・書き出しの記録・選択肢の作り方（soil_list_option）
- soil_list_* の表（読むだけ）。migration は触らない

## 3. 受け入れ基準
1. `npx vitest run src/app/system src/app/api/soil` が通る（合否行を読む）
2. `npx tsc --noEmit` に今回の変更由来のエラーが無い（Rill 等の既存エラーは対象外）
3. `npx eslint src/app/system/list src/app/system/_components src/app/api/soil/list` が通る
4. `/system` のカードに「リストマスタ」が出て `/system/list` に飛ぶ（Claude が実機で確認）
5. `/system/list` が System の枠（左メニュー・上ヘッダー）の中に「System / リストマスタ」「リストマスタ」で表示され、絞り込み → 件数を見る → 一覧 → .mer を書き出す → 書き出し記録 が動く（Claude が実機で確認）
6. `/soil/list` は無い（404）。`src/app/soil/list/` が残っていない
7. 絵文字なし・開発者用語なし

**実機・実データの確認は Claude が行う。本番は読むだけ。git・SQL は触らない。**

## 4. 完了報告（コードブロックで出力）
- 「未コミット」と明記／変更・追加・削除ファイルのフルパス／受け入れ基準 1〜7 の結果（実機分は「Claude 確認待ち」）／本番データ・git・SQL に触っていないことの明記
