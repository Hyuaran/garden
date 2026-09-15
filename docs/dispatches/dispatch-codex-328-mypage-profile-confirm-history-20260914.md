# Codex-328 マイページ「登録内容の確認」＋ 90 日確認の履歴化 ＋ Root 従業員の「履歴」＋ 届出確定の履歴書き込み

作成日: 2026-09-14
作業ツリー: C:\garden\a-bloom-008
起点: main 907a9e4（`git log -1` で一致を確認してから着手）
**git は触らないこと（commit するな）。本番のデータ・DB・Kintone に触らないこと。開発サーバ・ブラウザを起動しないこと。migration は supabase/migrations に書くだけで実行しない（実行は Claude が SQL OK の後に行う）。**

必ず先に読むもの：
- ④ Root 履歴：C:\Claude\000_Garden\040_Root_組織マスタ\00_マニュアル\01_従業員情報の履歴と収集\Garden_Root_従業員情報の履歴と収集_4_仕様書_Claude読み込み用.md（**§2 データモデル・§2-4 区分ごとの payload キー・§4 初回ログインの確認・§7 落とし穴**。この指示書と食い違ったら ④ を優先し、§8「既知の差分」に書く）
- ④ マイページ：C:\Claude\000_Garden\150_System_システム\00_マニュアル\05_マイページと届出\Garden_System_マイページと届出_4_仕様書_Claude読み込み用.md（**§2 画面構成・§4-1 4 桁ゲート・§4-2 90 日バナー・§4-4 届出 5 種・§5 API・§9 落とし穴**）
- 履歴表の定義：C:\garden\a-bloom-008\supabase\migrations\20260914000001_root_employee_profile_history.sql（表・ビュー `root_employee_profile_current`・トリガ `root_employee_profile_apply_current()`・RLS）
- 履歴の読み書きの唯一の実装：C:\garden\a-bloom-008\src\app\root\_lib\roster-sync.server.ts（`latestProfilePayload`・`insertProfileHistoryIfChanged`・`mapRosterRecordToProfilePayloads`。**同じ人・同じ区分・同じ出どころの最新行と同じなら足さない**）
- マイページ：C:\garden\a-bloom-008\src\app\system\mypage\tabs\ProfileTab.tsx（4 桁ゲート・90 日バナー `LS_MYPAGE_LAST_CONFIRM = "gardenTree_mypageLastConfirm"`・基本情報カード・提出・登録情報カード）、`_components\SubmissionModal.tsx`（届出 5 種・初期値は今は空）、`_lib\mypage-profile.server.ts`（`buildMyPageProfile`）、`types.ts`（`MyPageProfile`）、`MyPageClient.tsx`
- API：C:\garden\a-bloom-008\src\app\api\system\mypage\unlock\route.ts・submissions\route.ts・submissions\[id]\route.ts、C:\garden\a-bloom-008\src\app\api\root\inbox\route.ts（`PATCH` の `advance`）、権限 `src\app\system\mypage\_lib\submission-server.ts`（`requireEmployee`／`requireManager`）
- Root 従業員画面：C:\garden\a-bloom-008\src\app\root\employees\page.tsx（一覧＋編集モーダル。**`/root/employees/[id]` は無い**）、`src\app\root\_components\Modal.tsx`、権限 `src\app\root\_state\RootStateContext.tsx`（`canWrite`・`hasRoleAtLeast`）
- 見た目：社長スタイル（`C:\Users\shoji\.claude\skills\garden-style\SKILL.md`）。アイコンは絵文字禁止・SVG 線画。画面文言に migration／RPC 等の開発者用語を出さない

## 0. 何を作るか（東海林さん 2026-09-14・④ §4）

マイページ一斉展開のとき、本人に「自分の登録内容」を区分ごとに ［合っている］［違う］ で確認してもらい、その確認を**履歴表に残す**（今の 90 日確認は localStorage だけで記録が残らない）。事務は Root の従業員行から**履歴**（区分・値・出どころ・元資料・登録日時・本人確認日時）を見られるようにする。届出が確定したら履歴にも行を足す。

```
[本人] 4 桁ゲート ─▶ 登録内容の確認（区分カード×6）──［合っている］──▶ 履歴に employee_confirm 行（confirmed_by_employee_at）
                                        └─［違う］────▶ 今の届出モーダルを「今の値」入りで開く ─▶ 送信 ─▶ 事務が受信箱で完了 ─▶ 履歴に submission 行
[事務] Root 従業員一覧 ─「履歴」─▶ 区分ごとの行（出どころ・元資料リンク・本人確認日時。食い違いは色）
```

制限はしない（確認が済んでいなくても打刻・シフト・前確依頼・届出は使える）。帯だけ。

## 1. データ（migration は要らない見込み）

- 表・ビュー・トリガは Codex-327 で本番にある。**新しい表は作らない**。`source='employee_confirm'`・`confirmed_by_employee_at` も定義済み
- 履歴の insert は必ず service_role（API 経由）。RLS で本人は自分の行を select 可・責任者以上は全員分 select 可（ビュー `root_employee_profile_current` は security_invoker なので、画面からは読まず API で service_role から読む）
- 「今の値」＝`root_employee_profile_current`（employee_id × category の最新行）。**bank_account の口座番号は API で下 4 桁に伏せる**（`****1234`）。マイナンバーは扱わない（区分 my_number_status は「提出済み／未提出」だけ・確認カードに出さない）

## 2. マイページ「登録内容の確認」（本人・`ProfileTab.tsx`）

### 2-1 いつ出すか
- 4 桁ゲート通過直後（生年月日未登録でゲート省略の人も同じ）
- 区分 6 つ（address／contact／emergency_contact／bank_account／commute／dependents）のうち、**「その区分の最新の `employee_confirm` 行の `confirmed_by_employee_at` が 90 日以内」でないもの**が 1 つでもあれば表示。全部 90 日以内なら出さない
- 出している間、マイページ上部に帯「登録内容の確認が済んでいません（残り n 件）」。n＝未確認の区分数。**他の機能は制限しない**
- 今の `localStorage`（`gardenTree_mypageLastConfirm`）と「個人情報の定期確認中（3ヶ月に1度）」バナーは**廃止**（コードから消す。キーが残っていても無視）

### 2-2 画面の絵（ゲート通過直後）

```
┌──────────────────────────────────────────────────────────────┐
│ ▮ 登録内容の確認が済んでいません（残り 4 件）                    │  ← 帯（黄・閉じない・全部済むと消える）
├──────────────────────────────────────────────────────────────┤
│ 登録内容の確認                                                  │
│ 会社に登録されているあなたの情報です。区分ごとに確認してください。   │
│                                                                │
│ ┌ 住所 ──────────────────────────────┐ ┌ 連絡先 ─────────────────┐ │
│ │ 兵庫県赤穂市三樋町2-7                │ │ 携帯 080-8940-6530        │ │
│ │ 出どころ：雇用契約書（2026-09-01）   │ │ メール regu_…@icloud.com  │ │
│ │ [ 合っている ]  [ 違う ]            │ │ [ 合っている ]  [ 違う ]  │ │
│ └────────────────────────────────────┘ └──────────────────────────┘ │
│ ┌ 緊急連絡先 ─────────────────────────┐ ┌ 給与受取口座 ────────────┐ │
│ │ 廣門 由紀（母） 090-5366-9756       │ │ 楽天銀行 ジャム支店       │ │
│ │ 住所：本人と同じ                     │ │ 普通 ****3397             │ │
│ │ [ 合っている ]  [ 違う ]            │ │ [ 合っている ]  [ 違う ]  │ │
│ └────────────────────────────────────┘ └──────────────────────────┘ │
│ ┌ 交通費 ─────────────────────────────┐ ┌ 扶養の人数 ─────────────┐ │
│ │ 日額 1,000円（片道 500円・上限 20,000円）│ │ 0 人                     │ │
│ │ 最寄り駅：播州赤穂                    │ │ 違う場合は事務へご連絡ください │ │
│ │ [ 合っている ]  [ 違う ]            │ │ [ 合っている ]            │ │
│ └────────────────────────────────────┘ └──────────────────────────┘ │
│                                                                │
│ ✓ 確認済み（2026-09-14）の区分は「確認済み」と日付だけ表示（ボタン無し） │
├──────────────────────────────────────────────────────────────┤
│ 基本情報（今のカード・そのまま）                                  │
│ 提出・登録情報（今の 5 ボタン・そのまま）                          │
└──────────────────────────────────────────────────────────────┘
```

- 値が無い区分（履歴に行が無い）は「未登録」と出し、ボタンは ［違う］（＝届出へ）だけ。［合っている］は出さない
- 電話・郵便番号は見やすくハイフン区切りで表示（保存値は変えない）。住所は `full` をそのまま
- 各カードの「出どころ」＝最新行の source の日本語（従業員名簿／口座一覧／電子契約の書類／入社手続き／事務の入力／届出／本人確認）＋ effective_from
- 幅 768px 未満は 1 列。社長スタイル・ダーク対応

### 2-3 ［合っている］
- `POST /api/system/mypage/profile-confirm` `{ category }` → サーバが**その区分の今の値（current）をそのまま payload に**して `source='employee_confirm'`・`confirmed_by_employee_at=now()`・`recorded_by=社員番号`・`effective_from=今日`・`note='本人がマイページで確認'` の行を insert。今の値が無い区分は 409「登録内容がありません」
- 成功でカードが「確認済み（今日）」に変わり、帯の n が減る。全部済むと帯が消える
- 楽観更新でよい（体感即時）。失敗したら元に戻して「保存できませんでした。もう一度お試しください」

### 2-4 ［違う］→ 今の届出モーダルを「今の値」入りで開く
| 区分 | 開く届出（`SubmissionModal` の type） | 初期値に入れる今の値 |
|---|---|---|
| 住所・連絡先・緊急連絡先 | `emergency_contact`（区分＝変更） | 現住所＝address.full、個人の電話番号＝contact.phone、緊急連絡先の氏名／続柄／住所（same_address_as_employee なら「同上」）／電話＝emergency_contact |
| 給与受取口座 | `bank_account` | 銀行名／金融機関コード／支店名／支店コード／口座名義カナ（**口座番号は入れない**＝本人に打ってもらう） |
| 交通費 | `commute_route` | 新しい最寄り駅＝commute.nearest_station |
| 扶養の人数 | （届出なし） | 「扶養の変更は事務までご連絡ください」を出すだけ |
- `SubmissionModal` に `initialValues?: Record<string, string>` を足す（今の props は type／employeeName／onClose／onSent）。既存の呼び出し（提出・登録情報の 5 ボタン）は初期値なしのまま
- 送信して受付になったら、そのカードは「届出済み（受付日）」表示にして ［合っている］［違う］ を消す（届出が完了して履歴に `submission` 行が入ったら、次に開いたとき通常のカードに戻る＝未確認扱いでよい。本人が改めて ［合っている］ を押す）

### 2-5 データの取り方
- `POST /api/system/mypage/unlock` の応答 `profile` に **`current`（区分ごとの今の値・口座番号は下 4 桁）と `confirmations`（区分ごとの最新 confirmed_by_employee_at）と `pendingSubmissions`（受付〜対応中の届出の type と created_at）** を足す（`buildMyPageProfile` を拡張。`MyPageProfile` の既存フィールドは変えない）。生年月日未登録で `MyPageSectionPage` が最初から渡す `initialProfile` も同じ形
- 新設 `GET /api/system/mypage/profile-current`（本人・`requireEmployee`）＝同じものを返す（［合っている］の後の再取得用）
- 履歴の読み取り関数は `src\app\root\_lib\` に新設（例 `profile-history.server.ts`：`getCurrentProfile(admin, employeeId)`／`getProfileHistory(admin, employeeId)`／`getLatestConfirmations(admin, employeeId)`／`insertProfileHistory(admin, row)`）。`roster-sync.server.ts` の private 関数と重複するなら、そちらから呼べる形にまとめてよい（既存テストは通す）。Supabase の型は既存と同じ流儀（`LooseSupabase` キャスト）で可

## 3. 届出が確定したら履歴に行を足す（事務側 API）

- `PATCH /api/root/inbox` `advance` で **`completed`** になったとき：
  - `bank_account`：payload（銀行名・金融機関コード・支店名・支店コード・種別 ordinary・口座番号・名義カナ・slot 1）を `source='submission'`・`source_ref=届出 id`・`recorded_by=事務の社員番号`・`effective_from=handled_at の日` で insert（Bud 台帳の入替・Kintone 反映は今のまま。**トリガが root_employees.bank_* にも写す**＝Bud 台帳と同じ値なので矛盾しない）
  - `emergency_contact`：payload から `address`（full＝現住所。prefecture 等は分けられなければ null・full だけ必須）、`contact`（phone＝個人の電話番号。**email は今の値を引き継ぐ**＝トリガは email が空なら触らないが、履歴の見た目のため）、`emergency_contact`（name／relation／phone／address／same_address_as_employee＝「同上」なら true）の 3 行
  - `resignation`・`nda`：履歴は足さない
- `PATCH /api/system/mypage/submissions/{id}` `accept`（通勤の本人承諾）で `confirmed` になったとき：`commute` 行（`one_way=proposed_one_way`・`round_trip=one_way×2`・**`monthly_cap=今の commute_monthly_cap（変えない）`**・`nearest_station=届出の駅`・`paid=今の値`）を `source='submission'` で insert。**トリガが `commute_daily_allowance=one_way×2`・`commute_monthly_cap=payload.monthly_cap` を root_employees に書く**ので、monthly_cap を落とすと上限が消える＝必ず今の値を入れる（今の直接 update は残してよいが二重にならないよう順序に注意）
- どれも「同じ人・同じ区分・同じ出どころの最新行と同じなら足さない」（`insertProfileHistoryIfChanged` と同じ）

## 4. Root 従業員の「履歴」（事務・`src\app\root\employees\page.tsx`）

- 一覧の各行に「履歴」ボタン（編集の隣・SVG 線画アイコン＋文字）。押すと `ProfileHistoryModal`（`Modal` width 960）
- API `GET /api/root/employees/{employee_id}/profile-history`（`requireManager`）：全区分の全行（新しい順・最大 500）＋ 区分ごとの今の値の id。**口座番号は admin 以上なら全桁・manager は下 4 桁**
- 画面の絵：

```
┌ 廣門 彩季（1551）の履歴 ───────────────────────────────────────── ✕ ┐
│ 区分：[すべて ▾]   出どころ：[すべて ▾]                                │
│                                                                      │
│ 住所                                                                  │
│ ● 2026-09-01  兵庫県赤穂市三樋町2-7            電子契約の書類  [書類を開く]  今の値 │
│   2026-06-17  兵庫県赤穂市三樋町2-7            電子契約の書類  [書類を開く]        │
│   2026-09-14  兵庫県赤穂市三樋町2-7            従業員名簿（レコード 412）          │
│ 連絡先                                                                │
│ ● 2026-06-17  080-8940-6530 / regu_…@icloud.com  電子契約の書類  [書類を開く]  今の値 │
│   2026-09-14  080-8940-6530 / regu_…@icloud.com  従業員名簿                        │
│ 緊急連絡先                                                            │
│ ● 2026-06-17  廣門 由紀（母）090-5366-9756 本人と同じ  電子契約の書類 [書類を開く] 今の値 │
│ 給与受取口座                                                          │
│ ● 2026-09-14  楽天銀行 ジャム支店 普通 ****3397   事務の入力   本人確認 2026-09-20 ✓ │
│ ▲ 2026-09-14  ゆうちょ銀行 四三八店 普通 ****7256  口座一覧（レコード 88）   ← 今の値と違う（薄い赤） │
│ 交通費 …  扶養 …  雇用条件 …  マイナンバー（提出済み・2026-09-14 名簿から）        │
└──────────────────────────────────────────────────────────────────────┘
```

- 行の中身：有効日（effective_from）／値の要約（区分ごとに 1 行。address＝full、contact＝電話／メール、emergency_contact＝氏名（続柄）電話 住所、bank_account＝銀行 支店 種別 番号、commute＝日額・片道・上限・駅、employment＝雇用形態・入社日・部署、dependents＝n 人、my_number_status＝提出済み／未提出）／出どころ（source の日本語＋source_ref）／元資料リンク（source_document_url があれば「書類を開く」＝別タブ）／登録日時・登録者／本人確認日時（confirmed_by_employee_at）
- **今の値と違う行は色を変える**（同じ区分で payload が今の値と違う行＝薄い赤の帯・先頭 ▲）。今の値の行は先頭 ●
- 「値を訂正」ボタンは**今回は作らない**（④ §8 未決）

## 5. テスト（vitest）
- `profile-history.server`：current の取り方（recorded_at desc, id desc）／confirmations（区分ごとの最新 confirmed_by_employee_at）／口座番号の伏せ方／同じ値なら足さない
- `POST profile-confirm`：本人以外 401／区分不正 400／今の値なし 409／成功で employee_confirm 行（payload＝今の値・confirmed_by_employee_at・recorded_by＝社員番号）
- `ProfileTab`：確認画面の出る条件（90 日以内が揃えば出ない）／帯の n／［合っている］で楽観更新・失敗で戻る／［違う］で `SubmissionModal` が初期値付きで開く／扶養は ［違う］なし／localStorage を読まない
- `SubmissionModal`：`initialValues` が入力欄に入る・無ければ今までどおり
- 受信箱 `advance`：bank_account 完了で履歴 1 行・emergency_contact 完了で 3 行・resignation は 0 行／submissions accept で commute 行（monthly_cap が今の値のまま）
- Root 履歴 API：manager は口座下 4 桁・admin は全桁／権限なし 403
- 既存テスト（src/app/system/mypage・src/app/api/system/mypage・src/app/api/root・src/app/root）は全部通す

## 6. 変えてはいけないもの
- 4 桁ゲートの仕組み（サーバ照合）・届出 5 種の項目と検証・受信箱の状態遷移・Kintone つなぎ・PDF 生成・Bud 口座台帳の入替
- 履歴表の update／delete 禁止（訂正＝新しい行）。`root_employees` の既存列はトリガ経由でしか書かない（commute の accept で直接 update している既存コードは、履歴 insert と二重にならない順序にして残す）
- 打刻・シフト・前確依頼は確認が済んでいなくても使える

## 7. 受け入れ基準
1. vitest（上記）が通る　2. `npx tsc --noEmit` に今回の変更由来のエラーが無い（既知の AppHeader 1 件は除く）　3. eslint（変更ファイル単位）が通る
4. Claude が本番 DB＋デモ垢（9999／4 桁 1111）で E2E：確認画面 6 カード → ［合っている］で履歴に employee_confirm 1 行・帯の n が減る → ［違う］で届出が今の値入りで開く → 送信 → 受信箱で完了 → 履歴に submission 行 → Root 一覧の「履歴」で色分けが見える → 90 日後の再表示（confirmed_by_employee_at を過去日にした行で確認）→ テスト行を削除して残 0（履歴は削除できないので、デモ垢の行は**残る前提で件数を控える**）

## 8. 完了報告（コードブロックで出力）
- 「未コミット」と明記／変更・追加ファイルのフルパス／受け入れ基準 1〜3 の結果（実行したコマンドと結果）／本番データ・DB・Kintone・git に触っていないことの明記／④ と食い違った点（§9）

## 9. 既知の差分（Codex が追記する）
