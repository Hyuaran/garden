# Codex-518 派遣管理（第1弾）：受け入れた人の台帳と書類（2026-11-04）

作業場所：`C:\garden\a-bloom-008`（main）

**git は触らない（commit もしない）。computer-use・ブラウザ操作は使わない。本番に書き込まない（migration はファイルを作るだけ。当てるのは Claude）。Chatwork・Google ドライブ・KING OF TIME を本当に呼ばない。ホスト PC に触らない。`vercel.json` の crons に足さない。** ファイルは UTF-8。文字化け（??）を残さない。必要な範囲だけ読む。
画面の文字はきちんとした日本語。英語・開発者用語・略称を出さない。**コードは周りと同じく読みやすく書く**（1行に詰め込まない）。

## 読むもの

- 設計：`C:\Claude\000_Garden\150_System_システム\05_派遣管理\000_設計_派遣管理.md`（§3・§6・§12・§13）
- 台帳の手本：`G:\マイドライブ\01_経理部\18_派遣事業\03_派遣先として受入\01_株式会社エモーション\派遣先管理台帳_株式会社エモーション.xlsx`
- 画面の型：`src/app/system/contracts/`（`page.tsx`・`layout.tsx`・`_lib/contract-drive.server.ts`）、`src/app/api/system/contracts/route.ts`、`src/app/_components` ではなく `src/app/system/_components/`（`SystemBreadcrumb`・`SystemTabs`・`UpdatedStamp`・`DataTable`・`Modal`・`ViewPermissionButton`・`BoxSelect`・`RowActionButton`）、`src/app/system/forms/_components/form-kit`
- 登録先：`src/lib/auth/permission-registry.ts`、`src/app/system/_components/ShachoShell/shacho-shell-config.ts`、`src/lib/search/catalog.ts`、`src/app/system/manuals/_lib/manuals-registry.ts`
- 定時の知らせの型：`src/app/api/root/mail-forwarding/cron`
- 従業員画面：`src/app/root/employees/UrlViewClient.tsx`（897 行目付近の雇用形態）

## 背景

ヒュアランは派遣先として人を受け入れている。法律（派遣法 第42条）で、派遣先管理台帳を作り、派遣終了から 3 年間保存する義務がある。今は Excel が 1 枚あるだけで、個別契約書の回収も追えていない。KOSMO の支払い漏れもあったので、派遣元の会社を Garden で持つ。

**第1弾は受け入れ側だけ**。ただし器は派遣元側（ヒュアランが派遣する）も入る形にする（`side`）。第1弾では派遣元側の画面を出さない。

**第1弾に入れないもの**（作らない）：就業記録の自動取り込み、派遣元管理台帳・教育訓練記録・キャリア相談の画面、来るはずの請求チェック、本人入力のスキップ。

**東海林さんの追加要望（2026-11-04）**：派遣の人は、入社予定者を登録するときに、ヒュアランが発行する書類をダウンロードできるようにする（下の「入社予定者の登録からの書類発行」）。

## 画面

URL は `/system/haken`。サイドバーの「契約書管理」の下に「派遣管理」。社長スタイルの型（場所の表示・見出し・最終更新・タブ・表）。

```
System ／ 派遣管理                                   最終更新 2026-11-04 17:00:00
派遣管理
 [ 受け入れた人 ] [ 派遣会社 ] [ 期限と未回収 ]                    （歯車）
```

### タブ「受け入れた人」＝台帳の一覧

1 行＝1 人の 1 契約。行全体を押すと詳細へ。

```
絞り込み：派遣会社[すべて▼] 状態[すべて▼] 氏名[        ]        ［追加する］［Excel を出力する］
┌─────────┬──────────┬───────────┬──────┬──────┬───────┬───────┐
│ 氏名     │ 派遣会社  │ 部署         │ 開始日 │ 終了日 │ 個別契約書 │ 状態   │
├─────────┼──────────┼───────────┼──────┼──────┼───────┼───────┤
│ 藤田 悠誠 │ 株式会社KOSMO │ 営業課   │ …     │ 2026-09-30 │ 未回収 │ 終了    │
│ 籔 僚太   │ …        │ 営業課       │ 2026-11-02 │ … │ 回収済み │ 受入中 │
└─────────┴──────────┴───────────┴──────┴──────┴───────┴───────┘
```

### 受け入れた人の詳細（`/system/haken/ukeire/[id]`）

小窓にせず 1 画面。項目が多いので見出しで分ける。保存は下の［保存する］。エラーは画面の上に出す。

```
System ／ 派遣管理 ／ 藤田 悠誠
┌ 派遣労働者（派遣元からの通知で入力） ────────────────┐
│ 従業員 [藤田 悠誠 ▼]（名簿に無い人は空のまま） 氏名 [藤田 悠誠]        │
│ 性別 (男)(女)   雇用期間 (無期)(有期)   60歳以上 (はい)(いいえ)         │
│ 協定対象 (対象)(対象外)   派遣元からの通知の受領日 [        ]             │
│ 健康保険 (あり)(なし) 厚生年金 (あり)(なし) 雇用保険 (あり)(なし) なしの理由 [ ]│
├ 派遣元 ─────────────────────────────────┤
│ 派遣会社 [株式会社KOSMO ▼]（住所・許可番号・責任者は派遣会社タブの内容）   │
├ 個別契約 ────────────────────────────────┤
│ 受入事業所 [大阪本社 ▼]  組織単位 [ブロードバンド事業部 営業課]           │
│ 業務の種類 [架電業務およびその他付随する業務]   責任の程度 [役職なし・部下なし]│
│ 開始日 [        ] 終了日 [        ]   終了の理由 [        ]               │
│ 就業日 [        ] 始業・終業 [        ] 休憩 [        ]                   │
│ 派遣先責任者 [上田 基人 ▼] 指揮命令者 [上田 基人 ▼] 苦情の担当 [東海林 美琴 ▼]│
│ 紹介予定派遣 (はい)(いいえ)  期間制限なしの理由 [        ]                 │
├ 抵触日（自動） ─────────────────────────────┤
│ 事業所単位 2029-09-11（通知した日 2029-09-11）／個人単位 2029-09-11       │
│ 意見聴取の期限 2029-08-11／保存期限 2029-09-30                           │
├ 書類 ──────────────────────────────────┤
│ 種類 [個別契約書▼] 日付 [        ] [ファイルを選択] ［追加する］             │
│ 個別契約書 2026-09-07 開く  （ごみ箱）                                     │
├ 教育訓練・苦情 ─────────────────────────────┤
│ 日付 区分[教育訓練▼] 内容 対応者 結果 派遣元への連絡  ［追加する］        │
└───────────────────────────────────────┘
                         ［台帳を Excel で出力する］［保存する］
```

### タブ「派遣会社」

会社名・事業所・所在地・許可番号・派遣元責任者（氏名・連絡先）・苦情の担当（氏名・連絡先）・請求書の届き方（`メールで届く`／`自分で見に行く`）・基本契約書の締結日・備考。一覧の行全体を押すと小窓（`Modal`・スクロールバーを出さない・必要なら 2 列）。

### タブ「期限と未回収」

```
┌──────────┬──────────┬────────────────┐
│ 期限       │ 種類        │ 内容                        │
├──────────┼──────────┼────────────────┤
│ 2026-12-01 │ 契約の更新確認 │ 籔 僚太（終了 2026-12-31）  │
│ 2029-08-11 │ 意見聴取       │ 大阪本社                    │
│ 未回収     │ 個別契約書     │ 藤田 悠誠                   │
└──────────┴──────────┴────────────────┘
```

### 従業員画面（Root）

`/root/employees` の編集で雇用形態が「派遣」のとき、`派遣会社` の選ぶ欄を出す（`root_employees.haken_party_id`）。一覧の絞り込みと列にも足す。他の雇用形態には出さない。詳細の「従業員」を選ぶと、名前と派遣会社を入れる。

### 入社予定者の登録からの書類発行（`src/app/system/onboarding/HireCandidatesClient.tsx`）

雇用形態で「派遣」を選んだときだけ、小窓の項目の下に足す。スクロールバーを出さない。

```
入社予定者を登録
 …今の項目…
 雇用形態 [派遣 ▼]
┌ 派遣 ──────────────────────────────┐
│ 派遣会社 [株式会社エモーション ▼]  派遣期間の終了日 [2026-12-31]    │
│ 発行日 [2026-11-04]                                             │
│ ヒュアランが発行する書類                                         │
│ ［抵触日通知書をダウンロードする］                               │
│ ［待遇情報提供書をダウンロードする］                             │
│ ［個別契約の回答書をダウンロードする］                           │
│ 抵触日 2029-09-11（計算）                                        │
└──────────────────────────────────┘
```

- 派遣期間の開始日は入社予定日。派遣会社・入社予定日・終了日・発行日が空のときはボタンを押せない
- 雇用形態が派遣のときは、派遣会社と終了日を必須にする（`isHireFieldRequired` の形）。派遣会社が一覧に無いときは「派遣会社」タブで登録する案内を出す
- ダウンロードは PDF。ファイル名は `抵触日通知書_<派遣会社名>_YYYYMMDD.pdf` の形。発行するたびに `system_haken_document` へ記録し（`document_status='issued'`）、Google ドライブにも保存する。ドライブの保存に失敗しても PDF は渡し、画面の上に「保存できませんでした」と出す
- 入社予定者に `haken_party_id`・`haken_period_end` を足す。**［入社］を押して社員になったら**、`root_employees.haken_party_id` を入れ、`system_haken_contract` と `system_haken_worker` を自動で作る（項目は発行書類の初期値から。性別は入社予定者の値）。同じ入社予定者で 2 回作らない
- 計算した抵触日が、その事業所の通知済みの抵触日と違うときは、ボタンの上に「通知した抵触日（YYYY-MM-DD）と違います」と出す。**発行は止めない**

### 発行する 3 つの PDF

手本（文面・見出し・順番を同じにする。派遣会社・日付・抵触日だけ差し替える）：`G:\マイドライブ\01_経理部\18_派遣事業\03_派遣先として受入\01_株式会社エモーション\` の `抵触日通知書_株式会社エモーション_20260907.pdf`／`待遇情報提供書_株式会社エモーション_20260907.pdf`／`個別契約_回答書_株式会社エモーション_20260907.pdf`。読めないときは止めて報告する。

- 作り方：`src/app/system/contracts/_lib/contract-template.server.ts` の pdf-lib＋fontkit（游明朝）を流用。`src/lib/haken/haken-pdf.server.ts`
- 宛名は「<会社名> <事業所名>　御中」。差出人は受入事業所の会社
- **派遣会社タブの小窓**に「発行書類の初期値」を足す（`system_haken_party.issue_defaults jsonb`）：組織単位・業務内容・派遣期間の開始と終了は入社予定者から・就業日・就業時間・指揮命令者・派遣先責任者・苦情の申出を受ける者・締め日・支払日・タイムカードの送付・残業割増・請求書の送付先・請求書の提出期日・貴社へのご確認事項（複数行）。小窓に収まらないので、ここは派遣会社の詳細ページ（`/system/haken/parties/[id]`）にしてよい
- ご確認事項が空のときは「5．貴社へのご確認事項」の見出しごと出さない
- 受入事業所（`system_haken_office`）に待遇情報を持つ：教育訓練の有無と内容・給食施設・休憩室の有無と内容・更衣室
- 第2弾の「PDF 発行」はここで作るので、派遣会社の詳細からも同じ 3 つをダウンロードできるようにする

## データ

`supabase/migrations/20261104000519_haken_ledger.sql`（ファイルを作るだけ・初期データは入れない）。全部 RLS 有効・ポリシーなし。`revoke`／`grant` は `system_shift_default_option` と同じ形。文字の長さは CHECK で抑える。

- `system_haken_party`：相手先。`name`・`office_name`・`address`・`permit_no`・`manager_name`・`manager_tel`・`complaint_name`・`complaint_tel`・`invoice_delivery`（`mail`／`portal`）・`basic_contract_on`・`note`・`side_supplier boolean`・`side_client boolean`・監査列
- `system_haken_office`：受入事業所。`company_id`・`name`・`address`。抵触日の単位
- `system_haken_contract`：`side`（`ukeire`／`haken`）・`party_id`・`office_id`・`org_unit`・`work_content`・`responsibility`・`period_start`・`period_end`・`work_days`・`work_hours`・`break_note`・`supervisor_name`・`commander_name`・`complaint_owner_name`（Garden 側は文字で持つ）・`is_introduction`・`no_limit_reason`・`notified_conflict_on`（相手に通知した抵触日）・監査列
- `system_haken_worker`：`contract_id`・`employee_id`（`root_employees` への外部キー・null 可）・`name`・`gender`・`is_indefinite`・`is_over_60`・`is_agreement`・`health_insurance`・`pension`・`employment_insurance`・`insurance_reason`・`party_notice_on`・`start_on`・`end_on`・`end_reason`・`deleted_at`
- `system_haken_document`：`contract_id`（null 可）・`party_id`（null 可）・`doc_type`（`basic`／`individual`／`conflict_notice`／`treatment`／`reply`／`party_notice`／`other`）・`issued_on`・`file_name`・`drive_file_id`・`drive_url`・`deleted_at`
- `system_haken_event`：`worker_id`・`on_date`・`kind`（`training`／`complaint`）・`content`・`handler`・`result`・`party_contact`・`deleted_at`
- `system_haken_notice_log`：`notice_key` 一意・`sent_at`（同じ知らせを 2 回送らない）
- `root_employees.haken_party_id`：`system_haken_party` への外部キー・null 可

**消さない**：`system_haken_worker` は物理削除しない。保存期限（`end_on` + 3 年）より前は `deleted_at` も入れられない（受け口で止めて、理由を画面の上に出す）。誤登録を消せるように、`end_on` が空の人だけは消せる。

## 自動で決めるもの（`src/lib/haken/rules.ts`・純粋な関数＋テスト）

| 項目 | 計算 |
|---|---|
| 事業所単位の抵触日 | その事業所の受入の、**連続する一番最初の開始日** + 3 年。受入が無い期間が 3 か月を超えると、次の開始日からやり直す |
| 個人単位の抵触日 | 同じ人・同じ組織単位の、連続する一番最初の開始日 + 3 年（派遣会社が変わっても続く）。空き 3 か月超でやり直す。無期雇用・60 歳以上は「対象外」と出す |
| 意見聴取の期限 | 事業所単位の抵触日 − 1 か月 |
| 更新の確認日 | 契約の終了日 − 1 か月 |
| 保存期限 | 派遣終了日 + 3 年 |

- うるう年：2/29 + 3 年は 2/28 にする
- 計算した抵触日と `notified_conflict_on` が違うとき、詳細と「期限と未回収」に「通知した抵触日と違います」と出す（**自動で書き換えない**）。通知書を出し直すかは人が決める

## 書類の保存

Google ドライブ。`contract-drive.server.ts` の形にそろえて `src/lib/haken/haken-drive.server.ts` を作る。環境変数 `GARDEN_HAKEN_DRIVE_ROOT_FOLDER_ID` の下に `03_派遣先として受入/<派遣会社名>/`。環境変数が無いときは保存せず、画面の上にエラーを出す（登録だけ成功したように見せない）。PDF のみ・20MB まで（`MAX_CONTRACT_SIZE`）。ファイル名の重複は今の `unique` と同じ形。

## 台帳の Excel

`exceljs`。受け入れた人 1 人につき 1 シート。手本の Excel の「台帳」シートと同じ項目・同じ順番（区分・項目・内容・備考）。就業記録と教育訓練のシートも付ける。就業記録は第1弾では枠だけで、「就業記録は別途添付」と書く。一覧の［Excel を出力する］は絞り込み後の全員分。ファイル名は `派遣先管理台帳_YYYYMMDD.xlsx`。先頭に「派遣法第42条」「保存期限」を出す。

## 権限

- 見る：`MANAGER_VIEW_ROLES`（契約書管理と同じ）。歯車は `ViewPermissionButton`。`permission-registry.ts` に登録
- 書く：manager 以上。教育訓練・苦情も同じ
- 受け口は全部サーバーで権限を確かめる。権限が無ければ 403

## 期限の知らせ

`src/app/api/system/haken/cron/route.ts`（mail-forwarding の形・`CRON_SECRET`）。**vercel.json には足さない**（Claude が初回を確かめてから足す）。Garden通知の部屋へ。TO なし。`system_haken_notice_log` で同じ知らせは 1 回だけ。

- 契約の更新確認日の当日
- 意見聴取の期限の 60 日前と当日
- 個別契約書が未回収で、開始日から 7 日たった人（1 人 1 回）
- 通知した抵触日と計算が違う事業所（1 回）

知らせが 0 件の日は送らない。失敗は 1 回だけ知らせる形にそろえる。

## 登録

サイドバー、検索（`catalog.ts`）、権限一覧、マニュアル登録（slug `haken`）。

## マニュアル 5 点（⓪①②③④）

`C:\Claude\000_Garden\150_System_システム\00_マニュアル\33_派遣管理\` に新規で作る。`32_Garden全体の検索` の形にそろえる。④を先に。v1.0・2026-11-04。①は「使い方」の書き方（業務の言葉で短く・いつ／だれの行なし・タブごとの章立て）。略称なし。カードにしない。**Storage へは上げない**。

## テスト

3 つの PDF の文字が手本と同じ（エモーションの 2026-09-07 の値で）／ご確認事項が空のとき見出しごと出ない／派遣のときだけ欄が出る／派遣以外の入社予定者の流れが変わらない／入社で契約と台帳の行が 1 回だけできる／ドライブ失敗でも PDF は渡す／抵触日の計算（うるう年・空き 3 か月ちょうど／超え・派遣会社をまたぐ・無期と 60 歳以上）／通知した抵触日との差／保存期限前は消せない／PDF 以外を断る／環境変数が無いときのエラー／権限 403／Excel の項目が手本と同じ／知らせの重複なし／0 件で送らない／文字化けなし／読み込み中にちらつかない形。
`npx tsc --noEmit`、`npx vitest run src/lib/haken src/app/system/haken src/app/api/system/haken src/lib/auth/permission-registry.test.ts src/lib/ui/no-flicker-source.test.ts` が通ること。

## 終わったら

### 実行回数の見積り（Codex-518・2026-11-04）

- 今回は定期実行を登録しないため、追加した定時処理は **0 回／日**。
- 将来 Claude が 1 日 1 回で登録する場合は **1 回／日（月最大 31 回）**。通知対象がない日は送信しない。
- 派遣管理の画面に一定間隔の取り直しは追加しないため、追加した定期取得は **0 回／日**。初回表示と保存などの操作時だけ取得する。

`docs/dispatches/report-codex-518-haken-ukeire-ledger-20261104.md` に、直したファイル・migration・テスト結果・作れなかったものを書く。
