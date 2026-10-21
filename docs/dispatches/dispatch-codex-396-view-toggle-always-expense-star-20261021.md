# Codex-396：一覧／カードの切り替えをいつも出す（無い画面はグレー）＋経費精算の★を線画に（2026-10-21）

正本：社長スタイル `C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md` §2.5・§2.6

## 東海林さんの決定（2026-10-21）
1. **右上（ベルの左）の一覧／カードの切り替えボタンは、全画面でいつも出す**。切り替えの無い画面では**グレーで押せない**（↻ のグレーと同じ考え方・見た目もそろえる）。マウスを乗せる／長押しで「この画面は表示の切り替えがありません」
   - 今の作り：`C:\garden\a-bloom-008\src\app\system\_components\HeaderViewToggle.tsx`（外枠の HeaderViewSlot に、画面が HeaderViewToggle を portal で出したときだけ出る）
   - 直す：画面が切り替えを出していないときは、外枠の置き場所にグレーのボタン（一覧のマーク・disabled）を出す。画面が出したらそれに置き換わる
   - 対象の外枠：System（`src\app\system\_components\ShachoShell\`）・Bud（`src\app\bud\_components\BudShachoShell\`）・**Root（`src\app\root\_components\` の Root の外枠。今は置き場所が無いので足す）**。スマホの上の帯も同じ
   - 右上の並び＝［一覧/カード］［ベル］［明暗］［ログアウト］を全モジュールでそろえる
2. **経費精算（`/bud/expenses`）の右上「全権管理＋経理担当」の横の★のボタンが線画になっていない**（塗りの星の文字・絵）。線画の SVG の星（stroke・fill なし。右上のベルなどと同じ線の太さ・色）に。動き（押したときの働き）は変えない
   - 場所の手がかり：`src\app\bud\expenses\page.tsx` の埋め込み HTML／CSS（SOURCE_CSS など）または `src\app\bud\expenses\_components\` の中。「★」「☆」の文字、星の画像・絵、`star` を含むクラス名を探す
   - ほかにも経費精算の 2 画面（`/bud/expenses`・`/bud/expenses/review`）で、線画でない記号のアイコン（塗りの記号・文字の記号）があれば同じく線画に

## テスト
- 切り替えの無い画面：グレーのボタンが出て押せない・説明の文字／切り替えのある画面：今どおり押すと切り替わる
- Root の外枠にも出る
- 経費精算：★の文字・絵文字が無く、SVG の線画のボタンがある（テストの中に絵文字・★の文字を書かない。`\p{Extended_Pictographic}` や `\u2605` で確かめる）

## 守ること
- commit・push しない。DB・外部 API に接続しない
- 動きは変えない（見た目だけ）
- `npx vitest run src/app/system src/app/root src/app/bud src/app/_components src/lib` と `npx tsc --noEmit -p .` が通ること（テスト時は .env.local の NEXT_PUBLIC_SUPABASE_URL／ANON_KEY を環境変数に入れて流す）

## 報告（日本語・コードブロック）
変えたファイル・直したこと・テストの結果だけ短く。
