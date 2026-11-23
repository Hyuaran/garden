# Codex-554 関電：ステータスを保存して事務入力を速くする（2026-11-23）

## 測った結果（Claude・本番）
- `/leaf/kanden/entry` の表示＝サーバー 約 2.4 秒（前は 0.8 秒）
- DB だけで `leaf_kanden_entry_page('エントリー待ち', …, counts=false)`＝**2.7 秒**、counts=true＝3.3 秒。`leaf_kanden_order_status(o)` を全受注（約 2 万件・写メの exists 付き）で毎回計算しているため
- 東海林さんの決まり：画面は体感即時（ゼロストレス）・ちらつかせない

## やること
1. migration `supabase/migrations/20261123000554_leaf_kanden_status_stored.sql`
   - `leaf_kanden_orders` に `computed_status text`（ステータスの計算結果）を足し、索引（computed_status, ordered_on desc）。今の全件を `leaf_kanden_order_status(o)` で埋める
   - 計算し直すきっかけ：受注の行が変わったとき（trigger・before insert/update で自分の行）、写メが増えた／種類が変わったとき（`leaf_kanden_photos` の insert/update/delete → 同じ kanri_no・set_id の受注）、入金明細の取り込み（`leaf_kanden_import_payments` の最後）、フォームの送信（submissions）、TimeTree ラベルの付け直し
   - `leaf_kanden_entry_page`・`leaf_kanden_case_page`・件数の集計・`leaf_kanden_sales_statuses` は `computed_status` を使う（毎回の計算をやめる）
   - `leaf_kanden_order_status` の中身（判定）は変えない。status.ts と同じ結果のまま
2. 目標：`leaf_kanden_entry_page` が 300ms 以下（counts=true でも）・`/leaf/kanden/entry` のサーバー応答 1 秒以下
3. テスト：計算し直しのきっかけごとに computed_status が変わること（SQL のテストファイル）・画面のテストは今のまま緑

## 守ること
- **git 操作禁止**・**ブラウザ・computer-use 禁止**・**本番 DB への書き込み禁止**（migration は書くだけ・Claude が当てて測る）
- 改行は LF

## 確かめ
- `npx vitest run src/app/leaf src/lib/leaf-kanden src/app/system/forms` が緑、`npx tsc --noEmit` でエラーなし

## 報告
`docs/dispatches/report-codex-554-kanden-status-stored-20261123.md`
