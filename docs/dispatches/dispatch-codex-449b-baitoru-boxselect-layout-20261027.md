# Codex-449b：バイトル設定の「通知の宛先」の選び窓が崩れるのを直す（2026-10-27）

あなたは Codex-449b です。作業場所は `C:\garden\a-bloom-008`（main）。git の書き込み（branch・add・commit・checkout）はしないでください。`git log`・`git status`・`git diff` の読み取りはしてよい。

## pre-flight（違えば中断して報告）
1. `pwd` が `C:\garden\a-bloom-008`、`git log --oneline -1` が `15d162e8` 以降
2. `src/app/sprout/postings/baitoru-panel.tsx` に `<BoxSelect label="通知の宛先"` がある

## 触ってよい範囲（ほかは読みもしない）
`src/app/sprout/postings/baitoru-panel.tsx`・`baitoru.module.css`・`baitoru-panel.test.tsx` だけ。BoxSelect 本体（`src/app/system/_components/BoxSelect/`）は変えない。

## 症状（Claude が画面で確認）
1. 「取り込みの設定」の `<form>` の中に BoxSelect を置いたため、BoxSelect の選び窓（それ自体が `<form role="dialog">`）が**入れ子の form** になり、コンソールに「`<form>` cannot contain a nested `<form>`」（hydration error）。選び窓の［OK］で外側の設定 form が送信されるおそれもある
2. `baitoru.module.css` の `.panel label { flex-direction: column }`・`.panel form`・`.panel fieldset`・`.panel button`・`.panel input` が選び窓の中まで効き、**チェック欄が名前の上に縦に並ぶ**・ボタンや枠の見た目が BoxSelect 本来と違う

## 直し方
- 設定の欄を `<form>` でなくす（例：`<div className={styles.card}>`＋保存ボタンは `type="button"` の `onClick={()=>void save()}`）。fieldset の disabled は今のまま使ってよい。見た目（カードの枠・余白）は今と同じに保つ
- CSS は**選び窓に効かない書き方**にする（例：`.panel label` → `.panel fieldset > label`、`.panel form` → `.panel > form, .panel .card`、button／input も直下や自分の部品だけに絞る）。他の 2 つの form（掲載の登録・選択肢の追加）の見た目は変えない
- 保存ボタンは今の見た目（ティールの塗り）を保つ
- テストを合わせる（保存がボタンの click で動くこと・入れ子 form が無いこと）

## 確認
- `npx tsc --noEmit -p .` 0 エラー／`npx vitest run src/app/sprout src/lib/sprout` 緑／差分に `???` 無し

## 完了報告
`docs/dispatches/report-codex-449b-baitoru-boxselect-layout-20261027.md`（変更ファイル・結果だけ・短く）
