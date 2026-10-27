# Codex-450：マニュアル画面をタブ式に・最初のタブに「Garden とは」・タブの無い画面の歯車が右上のボタンに潜るのを直す（2026-10-27）

## 目的（東海林さんの指摘と決定）
1. **歯車が右上のボタンの下に潜っている**（/system/manuals のスクリーンショット：見出し「マニュアル」の行の右端の歯車が、右上の文字の大きさ「あ」ボタンの下に重なる）。タブの無い画面で歯車を出す共通部品 `SystemViewHeading`（`src/app/system/_components/ViewPermissionButton/SystemViewContext.tsx`）が見出しの行の右端に置くため、右上のボタンと同じ高さで重なる。**全画面で直す**。
2. **マニュアル画面をタブ式にする**。今は「モジュールの一覧 →［開く］→ 機能の一覧 →［開く］」。これを、上にタブ「Garden とは／System／Bud …」を並べ、押すとその下に機能の一覧が出る形にする。
3. **最初のタブ「Garden とは」に Garden 全体のコンセプトをまとめる**（ぶれないように）。本文は Claude が書いた `src/app/system/manuals/_content/garden-concept.md`（直さない・そのまま表示）。
4. 入社手続きのマニュアルに、展開用の資料「応募から入社までの流れ」（HTML）を足す。

先に読む：社長スタイルの正本 §2.5（型）・§2.6（点検）＝ `C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md`。**社長スタイル §2.5 の型・§2.6 の点検に従う。** マニュアル画面の今の作り：`src/app/system/manuals/`（ManualsHubClient・ModuleManualsClient・ManualDetailClient・`_lib/manuals-registry.ts`・`_lib/render-markdown.ts`）。閲覧権限：`C:\Users\shoji\.claude\projects\C--garden-main028\memory\project_view_permissions.md`。

## やること
### A. 歯車の置き場（全画面共通）
- `SystemViewHeading`：歯車を**見出し（h1）の文字のすぐ右**（文字の後ろに 8px 空けて、見出しの高さの真ん中にそろえる）に置く。行の右端には置かない。
- タブがある画面は今どおり**タブの行の右端**（SystemTabs の actions）。
- 幅 4 段階（1384px・1024px・768px・375px）と明暗で、右上のボタンと重ならないことをテストで（位置の計算が難しければ、h1 の中の inline 要素として描くことを確かめるテストでよい）。

### B. マニュアル画面のタブ
- /system/manuals：場所の表示 → h1「マニュアル」→ タブ（SystemTabs）「Garden とは」「System」「Bud」…（MANUAL_MODULES の順・見られるモジュールだけ）。歯車はタブの行の右端。
- 「Garden とは」：`_content/garden-concept.md` を今の `render-markdown` で表示（表も読めるように。見出し・表は社長スタイル）。社員以上が見られる。
- 「System」「Bud」：今の ModuleManualsClient の一覧（機能の名前・説明・件数・［開く］）をタブの下に出す。
- URL は `?tab=concept|system|bud`。今の `/system/manuals/[module]` は `?tab=<module>` へ redirect（ブックマークを壊さない）。機能の詳しいページ（ManualDetailClient・資料のタブ）は今のまま。
- 既定のタブ＝「Garden とは」。

### C. 入社手続きに展開用の資料を足す
- registry に「機能ごとの追加資料」を持てるようにし（例：`extraDocs`）、入社手続き（onboarding）にだけ `{ key: "flow", label: "応募から入社までの流れ", file: "5_flow.html", kind: "html", minRole: "staff" }` を足す。資料のタブの並びは ①操作マニュアル の次。
- Storage への上げ込みは Claude が行う（`system/onboarding/5_flow.html`）。上げ込みのスクリプト `C:\Claude\000_Garden\150_System_システム\00_マニュアル\15_マニュアル画面\001_Storageへ資料を置くスクリプト_upload_manuals.js` は触らない。

## テスト（`npx vitest run` が全部通ること・FAIL 0）
- 歯車：SystemViewHeading の歯車が h1 の中（見出しの文字の後ろ）に出る／タブのある画面は今どおり。
- マニュアル：既定のタブが「Garden とは」で本文の見出しと表が出る／タブを押すと一覧が変わる／`/system/manuals/system` が `?tab=system` に移る／見られないモジュールのタブは出ない。
- 入社手続きの資料タブに「応募から入社までの流れ」が社員以上で出る。

## 触らないもの
- `_content/garden-concept.md` の本文・001_upload のスクリプト・本番 DB・Storage・環境変数・vercel.json。**git は触らないでください。コミットは人間側が行います。** npm install はしない。

## 確認
`npx tsc --noEmit`・`npx vitest run`。日本語が「???」に化けていないこと。BOM を付けないこと。

## 完了報告（コードブロックで）
変更したファイル／テスト結果（件数・FAIL 0）／歯車の置き方を変えた画面の数。
