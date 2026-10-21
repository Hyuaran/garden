# Codex-395：Bud 経費精算 2 画面を社長スタイルに（見た目だけ）（2026-10-20）

**並行で Codex-394 が `src\app\root\`・`src\app\system\`・`src\app\bud\_components\`・`src\app\bud\bank\` を直している。そこは読むだけ（部品を使うのは可）・触らない。あなたが触るのは `C:\garden\a-bloom-008\src\app\bud\expenses\` の中だけ。**

## 正本
- 社長スタイル：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md`（全部。特に §3 の 11〜14）
- 手本の画面：`C:\garden\a-bloom-008\src\app\bud\bank\`（同じ Bud の外枠の中の社長スタイルの画面）・`C:\garden\a-bloom-008\src\app\system\forms\FormsHubClient.tsx`
- 部品：場所の表示 `src\app\system\_components\SystemBreadcrumb\`（`root={{label:"Bud",href:"/bud/dashboard"}}`）・タブ `src\app\system\_components\SystemTabs\`
- 経費精算の仕様（動きの正本・読むだけ）：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\100_Projects\110_Garden\070_Bud_経理収支\` の経費精算の仕様書（v1.4）

## 東海林さんの決定（2026-10-20）
- `/bud/expenses`（経費精算）と `/bud/expenses/review`（承認待ち（経理））を社長スタイルに。**毎日の承認に使っている画面なので、動き（承認・差戻し・仕訳・CSV・絞り込み・キー操作・保存）は一切変えない。見た目だけ**
- 今の残り：英字の明朝の見出し（Pending／Final／Booking／Done／List／Deleted／Categories・Cormorant Garamond）、金色の丸いタブ・ボタン、「日々の足跡を、整えて返す」と芽の絵、⚠ の絵文字、h1 の上の場所の表示なし、タイトル下の説明文

## 画面の絵（/bud/expenses）
```
（右上：名前さん [ベル] [明暗] [ログアウト]＝外枠のまま）
Bud / 経費精算
経費精算
 承認待ち   完了待ち   仕訳待ち   完了   一覧   削除済み   区分マスタ     ← SystemTabs（英字は消して日本語だけ）
━━━━━━━──────────────────────────────
 全法人合計  ヒュアラン  センターライズ …                            ← 法人の切り替え＝社長スタイルの小さな切り替え（金色の丸い塗りはやめ、選んでいる法人＝ティール）
（中身：今のまま。色・文字・ボタンだけ社長スタイルに）
```
- h1＝「経費精算」（キャッチコピー・芽の絵は消す）。右上の「全権管理＋経理担当」の札と星のボタンは、社長スタイルの小さな文字・線画のボタンに（動きはそのまま）
- 承認待ち（経理）の画面：場所の表示「Bud / 経費精算 / 承認待ち（経理）」（「経費精算」は /bud/expenses へのリンク）→ h1「承認待ち（経理）」。説明文「スマホ申請を確認して承認／差戻し。Ctrl+↓…」は消す（キー操作はマニュアルにある）。⚠ は線画の注意マークに
- 色：金色・茶色系はやめ、社長スタイルの変数（濃紺・ティール・赤・グレー）に。件数の札（承認待ち 210 件 など）は社長スタイルのカード。主ボタン＝ティール、取り消し・差戻し系＝赤の線、その他＝線のボタン
- 文字：ゴシック（明朝・Cormorant を使わない）。見出しの大きさは System と同じ（h1 30px）
- 明暗どちらでも読めること。幅 1384px（東海林さんのノートパソコン）でページ全体が横にはみ出さない。スマホ（390px）で崩れない
- 表の見出しは中央・金額は右寄せ・日時は秒まで（今の表示がそうでなければ直す。データの中身は変えない）

## 進め方の注意
- `page.tsx`（150KB）・`ExpenseReviewPanel.tsx`（110KB）は大きい。**ロジックの行には手を入れず、見た目（className・CSS・見出しの文字）だけ**を変える。インラインの色指定は CSS 変数に置き換える
- 長い説明は不要。ファイルは必要な範囲だけ読む

## テスト
- 2 画面の場所の表示と h1、タブが SystemTabs、絵文字なし（テストの中にも絵文字を書かない。`\p{Extended_Pictographic}` で確かめる）
- 既存の経費精算のテストが全部通ること（動きを変えていない証拠）

## 守ること
- commit・push しない。DB・外部 API に接続しない
- `npx vitest run src/app/bud/expenses src/app/bud` と `npx tsc --noEmit -p .` が通ること（テスト時は .env.local の NEXT_PUBLIC_SUPABASE_URL／ANON_KEY を環境変数に入れて流す）

## 報告（日本語・コードブロック）
変えたファイル・見た目で変えたこと・変えていない（動き）ことの確認・テストの結果だけ短く。
