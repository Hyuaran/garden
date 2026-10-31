# Codex-501 全画面に「使い方」の？ボタンを置き、歯車をタブの列の右端へそろえる（2026-10-31）

作業場所：C:\garden\a-bloom-008（main）
**git は触らない（add / commit / push / checkout / stash すべて禁止）。** ファイルを直すだけ。
**ファイルは UTF-8。日本語を書いたら読み直して「?」に化けていないことを確かめる。**
社長スタイル §2.5 の型・§2.6 の点検に従う。
**画面の確認にパソコン操作（computer-use）・ブラウザ操作は使わない（東海林さんの画面を動かしてしまう）。** 画面の確認は Claude がやる。Codex はテストまで。

## 東海林さんの指示（画面の言葉）
「〇の中に？のマークを全てのページで配置し、マニュアルの 1 つ目の操作マニュアルを置いておきたい。呼び名は操作マニュアルではなく『使い方』」
「［⚙］は並べ替えと同じく、全てタブの一番右（同じ位置）にしたい」「並べ替えがないページはグレーにし、全てのページで同じ仕様に」

## 今の作り（読むもの）
- 歯車：`src/app/system/_components/ViewPermissionButton/SystemViewContext.tsx`（`SystemViewHeading` が h1 の右に `SystemViewButton` を差し込む）・`ViewPermissionButton.tsx`（中は `TabActionButton icon="settings"`）。使っている画面は `grep -rln "SystemViewButton\|SystemViewHeading" src --include=*.tsx`（約 67 ファイル。Bloom・Bud・Root・System・Leaf など）。h1 の右・タブの右・自前の位置とばらばら
- タブ：`src/app/system/_components/SystemTabs/SystemTabs.tsx`（`actions` に `TabActionButton` を入れる。見本＝`src/app/bud/bank/BankAccounts.tsx` 140 行・`src/app/bud/profit/broadband/BroadbandTable.tsx` 121 行）
- マニュアル：`src/app/system/manuals/_lib/manuals-registry.ts`（`MANUAL_DOCS[0]` が `operation`＝「操作マニュアル」`1_operation.html`・minRole staff）・`src/app/system/manuals/[module]/…/ManualDetailClient.tsx`（資料の出し方＝iframe と高さ通知）・`src/app/api/system/manuals/`（Storage から資料を返す API）
- 小窓：`src/app/system/_components/Modal/Modal.tsx`（`size="lg"`）

## 決まり（画面の絵）
```
System / INNOVERA履歴・録音
INNOVERA履歴・録音 (?)                         ← h1 のすぐ右に ? ボタン（全画面）
                                INNOVERA最終更新：…  ↻
[ 通話・録音 ] [ 発信番号 ]────────────── [⇅][⚙]   ← 歯車はタブの列の一番右（全画面）
                                                       並べ替えがあれば ［並べ替え］［⚙］の順

タブが 1 つ（＝タブなし）の画面：
口座の一覧 (?)
───────────────────────────────── [⚙]     ← タブの名前は出さず、線と右端のボタンだけの行
```
1. **？ボタン（新しい共通部品）**：`src/app/system/_components/HelpButton/HelpButton.tsx`。〇の中に？の線画の SVG（絵文字禁止）。大きさ・色・押したときの見た目は歯車（`TabActionButton`）とそろえる。`aria-label` と `title`＝「この画面の使い方」。
   - 押すと共通 `Modal size="lg"`。題＝「〇〇の使い方」（〇〇＝マニュアルの名前）。中身＝その画面の「使い方」（今の `1_operation.html`）を、マニュアル画面と同じ出し方（iframe＋高さ通知）で出す。上に［別のタブで開く］（マニュアル画面のその資料のページへ・`target="_blank"`）。下に［閉じる］。小窓にスクロールバーを出さない（globals.css の決まり）。
   - **使い方が無い画面**：？は薄い灰色で押せない。マウスを当てると「この画面の使い方は準備中です」（`HeaderViewSlot` の「この画面は表示の切り替えがありません」と同じ出し方）。
   - **置き場所**：h1 のすぐ右（今歯車がある所）。`SystemViewHeading` が歯車の代わりに ？ を入れるように変える。`SystemViewHeading` を使っていない画面（自前の見出し・Bloom の `BloomPageHeader`・`titleAddon` など）も全部 h1 の右に ？ を置く。
2. **画面とマニュアルの結び付け**：`ManualDefinition` に `paths: string[]`（その使い方を出す画面の URL の頭。例 `innovera-calls` → `["/system/innovera-calls"]`、`ap-daily` → `["/my?tab=report","/my?tab=review"]` のように `?tab=` まで見てよい）を足し、今あるマニュアル全部に入れる。今のパスに一番長く一致するものを使う。無ければ「準備中」。名前と説明から画面を判断し、どの画面にも結び付かないマニュアル（裏の仕組みだけのもの）は `paths: []` でよい。報告に全部の対応表を書く。
3. **権限**：「使い方」（operation）は、ログイン中の在籍者なら誰でも読める（`minRole` を一番低い役職へ。マイページだけの役職＝トス・クローザー・CS・業務委託も読める）。⓪②③④は今のまま全権だけ。API 側の判定も合わせる。
4. **呼び名**：画面に出る「操作マニュアル」を全部「使い方」に（`MANUAL_DOCS` の label・マニュアル画面のタブ・一覧・説明文・テスト）。Storage のファイル名 `1_operation.html` と key `operation` は変えない。
5. **並べ替えと歯車の位置**：全画面で、タブの列（`SystemTabs` の `actions`）の右端に ［並べ替え］［⚙］ の順で必ず並べる。
   - **並べ替えが無い画面でも［並べ替え］ボタンは出し、薄い灰色で押せない**。マウスを当てると「この画面は並べ替えがありません」（？の「準備中」と同じ出し方）。`TabActionButton` に「使えない」形を足す。
   - タブの無い画面には、タブの名前の無い同じ行（`SystemTabs` に空のタブ＋`actions`、または `SystemTabs` に「タブなし」の形を足す）を見出しの下・最終更新の行の下に置き、右端に歯車。線は右端まで（タブの列と同じ見た目）。
   - 歯車を見られない人（全権でもなく追加もできない人）には歯車は出ない（今のまま）。並べ替えボタンは誰にでも出るので、タブの無い画面のこの行はいつも出る。
   - 並べ替えを押せる人が限られている画面（例：INNOVERA の発信番号は super_admin だけ）は、押せない人には灰色で出す（「並べ替えは管理者だけが使えます」）。
   - タブごとの歯車（`SystemViewButton tabKey={active}`）は今の動きのまま、置き場所だけそろえる。
6. マイページ（`/my`・`MyShell`）・トスポータル（`/p/toss`）など左メニューの無い画面にも h1 があれば ？ を置く。

## テスト
- `HelpButton` の単体テスト：使い方がある画面で小窓が開き iframe の src がその資料／無い画面は押せず「準備中」の文
- `manuals-registry` のテスト：パスの一番長い一致・`?tab=` つきの一致・全マニュアルに `paths` がある
- 「操作マニュアル」の文字が画面のコードに残っていない（`grep -rn "操作マニュアル" src` がテスト以外 0）
- 既存テストの直し（歯車の位置・呼び名）
- `npx tsc --noEmit` と `npx vitest run src/app --exclude '**/employment-contract-pdf-integrity.test.tsx'` が通ること

## 終わったら
`docs/dispatches/report-codex-501-help-button-gear-position-20261031.md`（UTF-8）に、変えた画面の一覧（歯車をどこからどこへ・？を置いたか）・画面とマニュアルの対応表・テスト結果を書く。
