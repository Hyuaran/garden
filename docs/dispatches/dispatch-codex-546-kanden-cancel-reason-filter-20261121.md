# Codex-546 関電：キャンセルの理由で絞れるようにする（2026-11-21）

## 背景（東海林さん 2026-11-21）
「郵送前キャンセル 634 件はキャンセルに書き直していいが、後から絞れるようにしておいて」
→ Claude が本番で 634 件を `cancel_reason = '郵送前キャンセル（入金なし）'` でキャンセルにした。今の理由は 4 種類：
`郵送前キャンセル（入金なし）` 634・`戻入あり` 493・`取消日あり` 27・`要確認（明細が PDF の月）` 14（ステータスは諸元待ち・申込書待ちのまま）。

今は案件一覧・事務入力のどちらでも、理由で絞り込めない（`leaf_kanden_case_page`・`leaf_kanden_entry_page` の絞り込みに cancel_reason が無い）。

## やること
1. migration `supabase/migrations/20261121000546_leaf_kanden_cancel_reason_filter.sql`
   - `leaf_kanden_case_page`：`cancel_reason` を絞り込みの対象と選択肢（options）に足す。空は「（なし）」として選べる
   - `leaf_kanden_entry_page`：同じく `reason`（cancel_reason）を足す
2. 案件一覧 `/leaf/kanden`：表に「理由」列（取消・要確認の理由）を出し、見出しの絞り込み（BoxSelect・複数選択）で選べるようにする。キャンセル タブでは既定で表示、ほかのタブは列の表示切り替えで出せればよい
3. 事務入力 `/leaf/kanden/entry`：一覧の見出しの絞り込みに理由を足すのは不要。代わりに検索欄で「郵送前キャンセル」と打てば当たるよう、検索の対象（search の concat_ws）に cancel_reason を足す。案件一覧の検索も同じ
4. 要確認（明細が PDF の月）の 14 件が見つけやすいよう、案件一覧の理由の選択肢にも出る（上の 2 で満たす）
5. テスト：絞り込みの選択肢に理由が出る・理由で絞ると件数が合う・検索で当たる

## 守ること
- **git 操作禁止**・**ブラウザ・computer-use 禁止**・**本番 DB への書き込み禁止**（migration は書くだけ・Claude が当てる）
- 前の関数を消して作り直す場合は、権限（revoke/grant）も同じに戻す
- 社長スタイル §2.5〜2.7・画面の文字はきちんとした日本語
- 改行は LF

## 確かめ
- `npx vitest run src/app/leaf src/lib/leaf-kanden` が緑、`npx tsc --noEmit` でエラーなし

## 報告
`docs/dispatches/report-codex-546-kanden-cancel-reason-filter-20261121.md`
