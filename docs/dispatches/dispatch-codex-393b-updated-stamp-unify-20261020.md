# Codex-393b：「最終更新」と取り直しボタンの統一（2026-10-20）

前の指示書：`C:\garden\a-bloom-008\docs\dispatches\dispatch-codex-393-tabs-unify-bud-bank-header-20261020.md`（その変更は未コミットで作業ツリーにある。続きとして直す）

## 東海林さんの決定（2026-10-20）
- **取り直しのボタンは丸い矢印のアイコン（↻）で統一**。口座残高・カード利用も「読み直す」の文字ボタンにしない
- **書き方は「○○最終更新：2026/10/20(火) 19:59」に統一**（「日時」は付けない。○○＝どこのデータか。日時の形は今の INNOVERA と同じ `YYYY/MM/DD(曜) HH:MM`）
- **置き場所は「タイトル（h1）の下の行を右端に寄せる」で統一**（今は画面ごとに、タイトルの下の左・右上などバラバラ）
- System の画面すべてと Bud の口座残高・カード利用に当てる

## 画面の絵
```
System / INNOVERA履歴・録音                                         （右上：名前・ベル・明暗・ログアウト＝今のまま）
INNOVERA履歴・録音
（説明があればここ）
                                     INNOVERA最終更新：2026/10/20(火) 19:59  (↻)   ← この行を右端に寄せる
 タブ1   タブ2
━━━━━─────────────────────────
```
- 日時が 2 つある画面（リストマスタ）は同じ行に右寄せで並べる：`コール履歴最終更新：… (↻)   受注履歴最終更新：…`（↻ は取り直せるものにだけ付ける。今 ↻ が無いものに新しく作らない）
- スマホ（760px 以下）は右寄せのまま折り返してよい。ページ全体ははみ出さない

## 作るもの
1. 共通の部品を 1 つ（例：`C:\garden\a-bloom-008\src\app\system\_components\UpdatedStamp\`）：label（○○の部分）・日時・取り直す関数（任意）・取り直し中（↻ が回る・押せない）・日時が無いときの文字（「未取得」など今の文言）。見た目は今の INNOVERA の `syncIconButton` と同じ。aria-label／title は今の文言を引き継ぐ
2. 日時の形を作る関数も 1 か所に（今の INNOVERA の formatSyncStamp と同じ結果）
3. 置き換え（見つけた順に。ほかにもあれば同じく）：
   - `src\app\system\innovera-calls\InnoveraCallsClient.tsx`：「INNOVERA最終更新」
   - `src\app\system\list\_components\ListMasterClient.tsx`：「コール履歴最終更新」「受注履歴最終更新」（FileMaker の書き出しの但し書きは今のまま残す）
   - `src\app\system\call-metrics\CallMetricsClient.tsx`：今「最終更新: …」→「コール履歴最終更新：…」（中身がコール履歴の取り込み時刻なので）
   - `src\app\system\innovera\`（INNOVERA番号の同期）ほか `src\app\system\` の中で「最終更新」「最終同期」「最終読み込み」を出している所
   - `src\app\bud\bank\BankAccounts.tsx`：「MF最終更新：… (↻)」（↻ ＝今の読み直すと同じ動き・1 分に 1 回まで）
4. 対象外：`src\app\system\docs`（資料の「最終更新日」＝資料そのものの日付）、`src\app\system\sites` の「更新日」（一覧表の見出し横の日付）。触らない

## テスト
- 部品（日時の形・↻ で関数が呼ばれる・取り直し中は押せない・日時なしの文字）
- 置き換えた画面の既存テストを今の文言に合わせて直す

## 守ること
- commit・push しない。DB・外部 API に接続しない
- 取り直しの動き・取ってくる中身は変えない。見た目と文言だけ
- `npx vitest run src/app/system src/app/bud src/app/_components src/lib/bud` と `npx tsc --noEmit -p .` が通ること（テスト時は .env.local の NEXT_PUBLIC_SUPABASE_URL／ANON_KEY を環境変数に入れて流す。前から落ちている AppHeader・KpiCard・BackgroundCarousel は触らない）

## 報告（日本語・コードブロック）
変えたファイル・置き換えた所の一覧（対象外にしたものと理由）・テストの結果だけ短く。
