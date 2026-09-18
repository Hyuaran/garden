# Codex-341 Root 従業員マスタ：一覧と編集画面で住所が確認できるように（履歴の「今の住所」を出す）

作成日: 2026-09-18
作業ツリー: C:\garden\a-bloom-008
起点: main の最新（`git log -1` で確認・完了報告に書く）
**git は触らないこと（commit するな）。本番のデータ・DB に触らないこと（読むだけ）。開発サーバ・ブラウザを起動しないこと。migration は不要。触ってよいのは `src/app/root/employees/`・`src/app/api/root/employees/` 配下・`src/app/root/_lib/profile-history.server.ts`（読み出し関数の追加だけ）とそのテストだけ。**

必ず先に読むもの：
- ④ Root 従業員情報の履歴と収集：C:\Claude\000_Garden\040_Root_組織マスタ\00_マニュアル\01_従業員情報の履歴と収集\Garden_Root_従業員情報の履歴と収集_4_仕様書_Claude読み込み用.md（§2-2 履歴表・§2-3 `root_employee_profile_current` ビュー・§2-4 address の payload のキー・§3-5 の「実装済み（Codex-328）」＝一覧の［履歴］モーダル）
- 今のコード：`src/app/root/employees/page.tsx`（一覧の `columns`・編集モーダル・［履歴］モーダル `openHistory`・`profileValue`）・`src/app/api/root/employees/[employeeId]/profile-history/route.ts`（権限の取り方＝`requireManager`）・`src/app/root/_lib/profile-history.server.ts`（`getCurrentProfile`）

## 0. 何を作るか（東海林さん 2026-09-18）

「Root の従業員マスタで住所の確認ができない」。住所は `root_employees` に列が無く、履歴表（`root_employee_profile_history`・区分 `address`）にだけあり、一覧の［履歴］ボタンを押したモーダルの中でしか見えない。**一覧の列と編集画面に「今の住所」を出す**。住所そのものの編集はしない（住所は名簿の同期・本人の届出・事務の履歴登録で入る）。

## 1. 画面

一覧（`/root/employees`）：「カナ」の右に **「住所」列**（幅 260）。中身＝郵便番号＋住所（`〒636-0001 奈良県北葛城郡王寺町舟戸1丁目1番25号`）。無い人は「未登録」（薄い色）。列の値をクリックしても何も起きない（行クリックの既存動作はそのまま）。

```
ID       社員番号 氏名       カナ         住所                                     法人 …
EMP-1559 1559    吉田 陽菜   ヨシダ ヒナ   〒636-0001 奈良県北葛城郡王寺町舟戸1丁目1番25号  ヒュアラン …
EMP-0001 0001    ○○ ○○     ○○ ○○      未登録                                    ○○ …
```

編集モーダル：氏名・カナの下あたりに **読み取り専用の「住所」欄**（郵便番号／住所／建物名・部屋番号／出どころと登録日＝「従業員名簿 2026-09-14」「届出 2026-09-16」「MF 電子契約 2026-09-14」）。欄の下に一言「住所の変更は本人の届出（マイページ）か、名簿の同期で入ります。履歴は一覧の［履歴］から」。入力欄にはしない。

```
┌ 従業員を編集 ────────────────────────────────┐
│ 氏名 [吉田　陽菜   ]   カナ [ヨシダ　ヒナ   ]      │
│ 住所（今の値・変更は届出か名簿から）                  │
│   〒636-0001                                    │
│   奈良県北葛城郡王寺町舟戸1丁目1番25号               │
│   出どころ：従業員名簿（2026-09-14）                 │
│ 法人 [                ▼]   雇用形態 [      ▼]     │
│ …（以下は今のまま）                                │
└──────────────────────────────────────────┘
```

## 2. 作り

- API：`GET /api/root/employees/addresses` を新設（`requireManager` で権限確認＝［履歴］と同じ）。`root_employee_profile_current` から `category='address'` を全員分読み（service_role・`getSupabaseAdmin()`）、`{ [employee_id]: { postal_code, full, building, room, source, recorded_at } }` を返す。個人番号・口座は返さない。`profile-history.server.ts` に `getCurrentAddresses(admin)` を足してそこから使う
- 一覧：`load()` のあとに addresses を 1 回取り、`columns` に「住所」を足す。`postal_code` は `636-0001` の形に（7 桁なら 3-4 に区切る。既にハイフンがあればそのまま）。`full` が空なら「未登録」
- 編集モーダル：開いたときに同じ map から今の住所を表示（追加の通信なし）。出どころの表記は `sourceLabel(source)`（既存）＋ `recorded_at` の日付（JST・`YYYY-MM-DD`）
- 権限：一覧が見える人（root-employees-view）は住所も見える（［履歴］モーダルと同じ範囲）。それ以上は絞らない
- 見た目は Root の既存部品（`Column`・`Modal`・`colors`）。絵文字なし・開発者用語なし

## 3. テスト（vitest・全部緑にしてから完了報告）
- API：manager 未満は 403／manager 以上で map が返る／address 以外の区分は返さない
- 一覧：addresses を返すモックで「〒636-0001 奈良県…」が住所列に出る／無い人は「未登録」
- 編集モーダル：住所の読み取り専用表示と出どころが出る・入力欄ではない
- `npx tsc --noEmit`・`npx vitest run src/app/root/employees src/app/api/root/employees src/app/root/_lib`

## 4. 完了報告（コードブロックで）

```
Codex-341 完了報告
- 起点の main（git log -1）
- 触ったファイル（新規／変更）
- 住所の出し方（API・列・編集モーダル・権限）
- テスト結果
- Claude が確認する手順（一覧の住所列 → 吉田 陽菜の行 → 編集モーダルの住所）
- 気になった点
```
