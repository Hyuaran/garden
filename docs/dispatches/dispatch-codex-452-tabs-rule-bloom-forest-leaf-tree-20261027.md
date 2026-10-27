# Codex-452：タブの決まりを全画面にそろえる ②Bloom・Forest・Leaf・Tree（2026-10-27）

## 決まり（2026-10-27 東海林さん決定・社長スタイル正本 §2.5「タブを使うかどうか」）
- **1 つの画面の中で切り替える中身が 2 つ以上ならタブ必須（共通部品 SystemTabs＝`src/app/system/_components/SystemTabs/SystemTabs.tsx`）・1 つならタブなし。**
- 自前のタブ（`role=tablist` の自作・`.tabs`／`.subTabs`／`.tabNav` のボタン・TabButtons）は使わない。全部 SystemTabs に置き換える。見た目は SystemTabs のまま（文字だけ・選んでいるタブはティールの太い下線・下の線は右端まで）。
- 選んでいるタブは URL の `?tab=` に持つ（読み込み直しても同じタブ）。見られないタブは出さない。見られるタブが 1 つ以下ならタブの行を出さず、歯車は `SystemViewHeading`（`src/app/system/_components/ViewPermissionButton/SystemViewContext.tsx`）で見出しの右。
- 絞り込み（法人・期間・全員／トス／クローザー など同じ中身を絞るだけ）はタブにしない。今のまま。
- **押しても何も変わらない飾りのタブ**（中身が 1 つしか無い）は、タブの行ごと消す。

先に読む：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md` の §2.5・§2.6。**社長スタイル §2.5 の型・§2.6 の点検に従う**（ただしこの画面たちの外枠・配色は今のまま。タブの部分だけ直す）。閲覧権限の歯車は今の置き場（タブの行の右端 actions）を保つ。

## 直す画面
| 画面 | 今 | 直し方 |
|---|---|---|
| /forest/dashboard | 自前 tablist（概要／6法人マトリクス） | SystemTabs |
| /forest/shinkouki・/forest/shinkouki/[companyId] | ShinkoukiWorkspace の TabButtons（数値更新／期の切り替え） | SystemTabs |
| /bloom/ceo-status | 自前 `.tabNav`（4） | SystemTabs |
| /bloom/progress | `.tabs`＋activeTab（3） | SystemTabs |
| /bloom/blueprint | `.tabs`＋activeTab（2） | SystemTabs |
| /bloom/kpi | `.subTabs`（サマリ／売上／架電／経理）。法人の行は絞り込み＝そのまま | SystemTabs |
| /bloom/workboard・/bloom/daily-report・/bloom/monthly-digest | `.tabs` だが押しても何も変わらない | 中身を確かめ、本当に 1 つならタブの行を消す。中身を切り替える作りが既にあるなら SystemTabs で動くようにする。どちらにしたかを完了報告に書く |
| /leaf/kanden/input | 自前 tablist（3・iframe の切り替え） | SystemTabs。iframe の中の HTML（`leaf/_templates/*.html`）は触らない |
| /tree/call | 右の引き出し ConfirmSidePanel の中のタブ（トス／前後確） | 引き出しの中で SystemTabs（引き出しなので `?tab=` は不要） |
| /tree/monitoring | 絞り込みの丸ボタン（全員／トス／クローザー）に「座席表」が混ざり、押すと別の中身に替わる | SystemTabs「一覧／座席表」に分け、全員／トス／クローザーは一覧の中の絞り込みとして残す |

## 触らないもの
- System・Sprout・Bud の画面と `SystemTabs.tsx` 本体（Codex-451 が同時に作業中。**そのファイルは開いても直さない**）。
- `leaf/_templates/*.html`・本番 DB・Storage・環境変数・vercel.json。**git は触らないでください。コミットは人間側が行います。** npm install はしない。

## テスト（FAIL 0）
- 上の各画面：SystemTabs で出る（`role=tablist` が 1 つ）／押すと中身が替わる／`?tab=` で開くとそのタブ／見られないタブは出ない。
- 消した飾りのタブ：タブの行が無い。
- tree/monitoring：「座席表」タブで座席表・「一覧」で絞り込みが効く。
- 自分が直したファイルのテスト＋ `npx tsc --noEmit`。最後に `npx vitest run src/app/bloom src/app/forest src/app/leaf src/app/tree`。

## 確認
日本語が「???」に化けていないこと（Python で数える）。BOM を付けないこと。

## 完了報告（コードブロックで）
変更したファイル／直した画面の一覧（飾りのタブを消したか動かしたか）／テスト結果（件数・FAIL 0）／判断に迷ったところ。
