# Codex-468：フォームの部品箱（form-kit）を作り、NHK訪問業務 報告と経費 報告をそれに置き換える（2026-10-29）

## 東海林さんの話
- 「今後はフォームのデザインがそろうように作成できる準備をしておいて」
- 「フォーム内の部品（ラジオボタン、プルダウン、＋−の入力など）も、ばらつかないようにしておいてね」
- 手本＝NHK訪問業務 報告（`/system/forms/nhk-visit`・スマホ `/m/nhk`）。経費 報告（`/system/forms/expense`・スマホ `/m/expense/<種類>`）は Codex-467 で NHK の css を借りて同じ見た目にした。

先に読む：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md` §2.5・§2.6。絵文字なし（印は SVG の線）。iPhone で入力欄が拡大しないこと（入力の文字は 16px 以上・globals.css の pointer:coarse を消さない）。

## 1. 部品箱を作る：`src/app/system/forms/_components/form-kit/`
NHK の `nhk-visit.module.css` と経費の `expense.module.css` にある見た目を 1 つの `form-kit.module.css` にまとめ、次の部品にする（名前は目安。props は今の 2 画面で要るものだけ）：

| 部品 | 中身 |
|---|---|
| `FormPage` | ページの外枠（社長スタイルの背景・ライト／ダーク）。`mobile` のとき：題と「〇〇 さん」を 1 行（題が長いときは**切らずに折り返す**・Codex-467 の後に Claude が経費で直した形）。パソコンのとき：場所の表示（SystemBreadcrumb）・h1・説明・送信者の行。タブ（SystemTabs）と歯車を受け取れる |
| `FormRow` | 番号つきの 1 行（「1 日付」の左の列＋右の入力）。左の列は**長い項目名（例「用途の詳細」）でも折れない幅**にそろえる（今は NHK 74px・経費 100px で違う → 1 つの値に） |
| `RadioGroup` | ラジオボタン（今の `garden-radio` の見た目）。横に並べ、幅が足りなければ折り返す |
| `SelectField` | プルダウン（普通の select・「選んでください」を先頭に）。社長スタイルの決まり：フォームは普通の select／選択肢 2〜3 個はラジオ |
| `Stepper` | ＋−の数の入力（NHK の成約件数の形・0 未満にしない・数字は直接も打てる） |
| `TextField` / `NumberField` | 1 行の文字・数字（数字はスマホで数字のキーボード・右に「円（税込）」などの単位を付けられる） |
| `TextArea` | 複数行 |
| `FixedValue` | 決まっている値を太字の文字で（例「4 業務 対面アプローチ」「1 事業 NHK」） |
| `SubmitButton` | 幅いっぱいの大きい送信ボタン（送信中は「送信中...」・二重押し防止は呼ぶ側の busy で） |
| `ResultMessage` | 送信の結果（成功＝`message` の色／失敗・注意＝`error` の色）。NHK と同じ場所・同じ色 |
| `RecentList` | 「自分の最近の報告」（1 件 1 段の並び・空なら「まだありません」） |

- ライト／ダーク（Garden の切り替えとパソコン側の設定の両方）で、今の NHK と同じ色になること。
- 部品ごとに小さなテスト（描画・押したときの動き・Stepper の下限）。

## 2. 2 つの画面を部品箱に置き換える
- `src/app/system/forms/nhk-visit/NhkVisitClient.tsx` と `src/app/system/forms/expense/ExpenseClient.tsx` を、部品箱だけで組み立て直す。**見た目と動きは今と同じ**（スマホ・パソコンとも）。違いが出るのは、項目名の列の幅がそろうことと、NHK の題が長い名前の人でも切れなくなることだけ。
- 画面ごとの css（`nhk-visit.module.css`・`expense.module.css`）は、画面にしかない物（NHK の集計の表示・コピーなど）だけを残し、部品箱と同じ中身は消す。経費が NHK の css を import している所（`../nhk-visit/nhk-visit.module.css`）はなくす。
- 今あるテスト（NhkVisitClient.test.tsx・ExpenseClient.test.tsx・ページのテスト）は全部通す。

## 3. 使い方の説明を書く
- `src/app/system/forms/_components/form-kit/README.md`：新しいフォームを作るときの手順（部品の一覧と使い方・パソコンの URL `/system/forms/<名前>` とスマホの入口 `/m/<名前>` を必ずセット・種類が複数ならスマホは種類ごとに URL を分ける・forms-registry への登録・Garden に保存してから外へ送る／外へ送れなかったら画面と Garden通知に出す）。短く。

## 終わったら
- `npx tsc --noEmit` と関係するテストを通す（`src/app/system/forms`・`src/app/m`）。完了報告（コードブロック）。
- **git は触らない（commit しない）。npm install しない。本番の DB に当てない。Kintone へ送らない。**

## 実装時の取得回数
- 取得の回数は変えない（画面を開いたときの読み込みのみ・定期の取得 0 回）。
