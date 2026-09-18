# Codex-343 Root を社長スタイルに（第 2 段）：共通部品の形の仕上げ・残りの絵文字と直書きの色・ダークの入力欄

作成日: 2026-09-18
作業ツリー: C:\garden\a-bloom-008
起点: main の最新（Codex-342 の取り込み後。`git log -1` で確認・完了報告に書く）
**git は触らないこと（commit するな）。本番のデータ・DB に触らないこと。開発サーバ・ブラウザを起動しないこと。migration は不要。触ってよいのは `src/app/root/` 配下（下の「触らないもの」を除く）とそのテストだけ。**

必ず先に読むもの：
- 見た目の正本：C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md
- 第 1 段の指示書：C:\garden\a-bloom-008\docs\dispatches\dispatch-codex-342-root-shacho-style-shell-20260918.md（色変数の表・枠の作り）
- 見本：System の画面の部品の形＝`src/app/system/docs/docs.module.css`（カード・角丸・影）・`src/app/system/list/_components/list-master.module.css`（表・入力欄・ボタン）
- 今のコード：`src/app/root/_components/{Button,DataTable,Modal,FormField,PageHeader,StatusBadge,SessionWarningModal,KotSyncModal}.tsx`・`_components/root-shell.module.css`（第 1 段で作った変数）

## 0. 何をするか

第 1 段で枠と色は社長スタイルになった。第 2 段は **部品の「形」** を System に寄せ、残った絵文字と直書きの色を無くす。**機能・文言（下の 2 か所を除く）・データ・権限は変えない。**

## 1. 共通部品（`_components/`）

```
 従業員マスタ                                   [会社で絞る ▼] [検索…      ] [＋ 新規追加]
 給与処理対象者。退職時は…
 ┌──────────────────────────────────────────────────────────────────────┐
 │ ID        社員番号  氏名       カナ        住所            法人   …   状態  │ ← 見出し行：薄い地＋濃紺の文字
 ├──────────────────────────────────────────────────────────────────────┤
 │ EMP-1559  1559     吉田 陽菜  ヨシダ ヒナ  〒636-0001 …    …         [有効] │ ← 行の区切りは薄い線・ホバーで薄い地
 └──────────────────────────────────────────────────────────────────────┘   角丸 16・影は控えめ
```

- **PageHeader**：h1 は `colors.heading`・26px・太字。説明文は `textMuted`。下の罫線は無くし、下の余白 20px。右側の actions は今のまま
- **DataTable**：外枠＝角丸 16・`border`・影 `0 4px 14px rgba(16,35,63,.07)`（ダークは `rgba(0,0,0,.22)`＝変数にする）。見出し行＝地 `bg`・文字 `heading`・12px 太字。行ホバー＝`bg`。選択行＝`infoBg`。セルの余白は今のまま
- **Button**：角丸 10・高さをそろえる（padding 7px 14px）。primary＝ティール地に白、secondary＝カード地＋`borderStrong`、danger＝`dangerSolid` 地に白、ghost＝今のまま。キーボードのフォーカスでティールの輪（`outline: 2px solid`）
- **FormField**（TextField／SelectField／TextareaField）：角丸 8・枠 `border`・フォーカスでティールの枠。ラベルは `textMuted` 12px 太字のまま
- **Modal**：角丸 18・題は `heading`。暗幕は `rgba(8,15,28,.55)`。閉じるの「×」は線画の SVG に
- **StatusBadge**：角丸 999・今の色変数のまま
- **SessionWarningModal／KotSyncModal**：上と同じ角丸・題の色。動きは変えない
- **ダークのときのブラウザ標準の入力欄**（各画面に直書きの `<select>`・`<input>` が多い）：枠のクラスに `color-scheme: light`（ライト）／`color-scheme: dark`（ダーク）を足し、標準の入力欄・スクロールバーが暗い地でも読めるようにする。背景や文字色が未指定の `<select>`／`<input>` は枠の CSS で `background: var(--root-panel); color: var(--root-text); border-color: var(--root-border)` を既定にする（インラインで指定済みのものはそのまま勝つ）

## 1-2. 第 1 段の実機確認で見つかったこと（Claude・2026-09-18 22:5x・必ず直す）

1. **表が縦に潰れる**：左に 2 列（rail 68px＋side 236px）が並んで本文が狭くなり、`/root/employees` の表のセルが 1 文字ずつ縦に折り返している（画面幅 1333px で「株式会社ヒュアラン」が縦書き状態、カナ・雇用形態・日付も折り返し）。
   - **DataTable**：`<table>` は `width: 100%` のまま `minWidth: "max-content"` を足し、`<td>` の既定を `whiteSpace: "nowrap"` にする（外枠の `overflow: auto` で**表の中だけ横スクロール**。ページ全体は横スクロールさせない）。ただし住所・説明文のように長い列は折り返してよいので、`Column` に `wrap?: boolean` を足し、`wrap` の列だけ `whiteSpace: "normal"`＋`minWidth: col.width` にする。従業員マスタの「住所」列と、各画面の説明・備考の列に `wrap: true` を付ける（どの列かは各画面を見て判断し、完了報告に一覧を書く）
   - **Button**：`whiteSpace: "nowrap"`（ボタンの文字を折り返さない）
   - **PageHeader**：右側の actions を `flexWrap: "wrap"`・`justifyContent: "flex-end"`・`gap: 8`。狭いときは題の下に回り込んでよい（`flexWrap` を外側にも）。右上の［◯◯さん］［切替］［ログアウト］と重ならないこと
   - 直書きの `<table>` を持つ画面（`bank-check`・`attendance`・`kot-sync-history`・`permissions`・`inbox` など DataTable を使っていない所）も同じ方針（外側 `overflow-x: auto`・セル既定 nowrap）にそろえる
2. **左下の所属が「COMP-001」**：利用者欄の 2 行目が会社 ID になっている。会社名（`root_companies.company_name`。`useRootState` に無ければ RootShell で 1 回読む）＋「／」＋役職（`GARDEN_ROLE_LABELS`）に。会社名が取れないときは「所属会社未登録」（System と同じ）
3. **確認の物差し**：画面幅 1333px（ライト）で `/root/employees` の表に 1 文字ずつの折り返しが無いこと・ヘッダーのボタンが 1 行で読めることを、テスト（`whiteSpace` の既定と `wrap` 列）で固定する

## 2. 残りの絵文字と直書きの色

| 場所 | 今 | 直し方 |
|---|---|---|
| `kot-sync-history/page.tsx` の警告 | 「⚠ 5 分以上「実行中」のまま滞留しているログが n 件あります。Server Action 途中終了 / クライアント upsert 未完了の可能性。」 | 絵文字を外し、線画の注意アイコン＋文言を「5 分以上「実行中」のまま止まっている記録が n 件あります。もう一度同期を実行しても変わらないときは、管理者へお問い合わせください。」に（画面に開発者の言葉を出さない） |
| `kot-sync-history/_components/SyncLogDetailModal.tsx` | 「💡 このエラーの対処：」 | 絵文字を外し、線画の電球ではなく「対処」の小さなラベル（`infoBg` 地）に |
| `_components/SessionWarningModal.tsx` | 「⚠️ 開発モード中 (タイマー短縮)」 | 絵文字を外す（文言は「開発モード中（タイマー短縮）」） |
| `employees/page.tsx`・`bank-check/page.tsx` の直書きの色（各 1〜2 か所） | `#…` | いちばん近い `colors.*` に |
| `page.tsx`（Root ホーム）のカードの影 | `rgba(0,0,0,0.08)` | 影の変数に |

- コメントの中の絵文字（`_lib/kot-api.ts`・`_lib/session-timer.ts`・`_types/kot.ts`）は画面に出ないので触らない

## 3. 触らないもの
- `contracts/_lib/employment-contract-pdf.server.tsx`（帳票）・`login/page.tsx`・`*.legacy-*`
- 各画面の機能・データの読み書き・権限・キーボード操作（Ctrl+Shift+G・Ctrl+↑↓・Ctrl+Enter）

## 4. テスト（vitest・全部緑にしてから完了報告）
- 部品：DataTable の見出し行・選択行の色が変数／Button の 4 種類／Modal の閉じるボタンに `aria-label="閉じる"` が残っている
- Root 配下の画面に出る文字列に絵文字の範囲の文字が無い（帳票 PDF とコメントは除く）
- KoT 同期履歴の警告文が新しい文言
- 既存の Root のテストが全部通る
- `npx tsc --noEmit`・`npx vitest run src/app/root`

## 5. 完了報告（コードブロックで）

```
Codex-343 完了報告
- 起点の main（git log -1）
- 触ったファイル
- 部品ごとの変更点
- 絵文字・直書きの色の残り（0 のはず。残したものは理由）
- テスト結果
- Claude が確認する手順
- 気になった点
```
