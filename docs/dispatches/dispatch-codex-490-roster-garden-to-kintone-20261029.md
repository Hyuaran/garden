# Codex-490：従業員名簿の向きを Garden→Kintone に（写す処理・Root の編集項目・切り替えスイッチ）（2026-10-29）

## 東海林さんの話（開発ボード root 28c7d46d・2026-10-29 GO）
- 従業員名簿は Garden で編集し、Kintone 従業員名簿（app 56・作り直さない）はバックアップにする。最後は Kintone を東海林さん以外閲覧のみにする。
- 今は Kintone→Garden の取り込み（毎朝 6:00 の cron＋Kintone の Webhook）が Garden の値を毎朝上書きしている（氏名・カナ・生年月日・入社日・退職日・雇用形態・打刻ID・メール・在籍）。これを止め、Garden で直したら Kintone の同じ人の行へ写す。
- Kintone でしか直せない項目を Root の編集に足す（下の 3）。足さない項目（面談・研修説明・東海林メモ・testID・雇用契約書フォルダなど取り込んでいない項目）は Kintone に残すだけ。
- **今回は「写す処理」「Root の編集項目」「切り替えスイッチ（既定は今のまま）」まで。** 入社手続きの順番・Chatwork トークンの入力欄・管理表の読み先は次の Codex（491 以降）で行う。

先に読む：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md` の §2.5〜§2.7（タブ＝SystemTabs・フォームは form-kit・選ぶ欄の3種・表のマスに選ぶ欄を置かない・押した先は共通 Modal・日時は秒まで・画面の文字はきちんとした日本語）。
今の作り：取り込み `src/app/root/_lib/roster-sync.server.ts`（`syncRootRoster`・`mapRosterRecordToProfilePayloads` が名簿→履歴の対応表・`writeRetirementToRoster`）、履歴 `src/app/root/_lib/profile-history.server.ts`（`root_employee_profile_history`：category＋payload）、チーム履歴 `src/app/root/_lib/team-history.ts`・`TeamHistoryPanel.tsx`、社員画面 `src/app/root/employees/page.tsx`・`/api/root/employees`、マイページの名簿書き込み `src/app/system/mypage/_lib/submission-kintone.server.ts`（`/api/root/inbox` から呼ぶ）、cron `src/app/api/root/roster-sync/cron/route.ts`、Webhook `src/app/api/root/roster-sync/webhook/route.ts`。長い説明は不要・ファイルは必要な範囲だけ読む。

**触らない場所（別の Codex が同時に作業する。読みもしない）**：`src/app/api/system/chatwork/`・`src/app/api/system/line/`・`src/lib/line/`。

## 1. 切り替えスイッチ（migration `20261029000490_roster_direction.sql`・作成のみ・Claude が本番に当てる）
- 設定 `root_roster_settings`（1 行）：`direction text not null default 'kintone_to_garden' check (direction in ('kintone_to_garden','garden_to_kintone'))`・`switched_at`・`switched_by`。
- **`kintone_to_garden`（既定＝今のまま）**：取り込みは今どおり。写す処理は「写す予定」を記録するだけで Kintone に書かない（下の 2 の queue に `status='held'`）。
- **`garden_to_kintone`**：毎朝の cron と Webhook は名簿を **取り込まない**（cron は写し残しの送り直しと、今の `syncRichMenus` だけ）。Webhook は 200 を返して何もしない。`syncRootRoster` は手動（`/api/root/roster-sync` POST・`scripts/sync-root-roster.ts`）では今どおり動く（初回の移し替え・非常用）。写す処理が Kintone に書く。
- 切り替えは Claude が DB で行う（画面は作らない）。

## 2. Garden→Kintone へ写す処理（`src/app/root/_lib/roster-push.server.ts`）
- 表 `root_roster_push_queue`：`id`・`employee_id`・`reason text`（例 'root_edit'・'retire'・'team'・'inbox'）・`status`（'pending'／'held'／'done'／'failed'）・`attempts int`・`last_error text`・`requested_at`・`done_at`。同じ人の pending は 1 行にまとめる。
- `queueRosterPush(employeeId, reason)`：Garden で保存したら呼ぶ。スイッチが `garden_to_kintone` ならその場で `pushEmployeeToRoster` を試し、失敗は pending に残す（保存そのものは止めない・画面には「Kintone への写しは後で送り直します」と小さく出す）。
- `pushEmployeeToRoster(employeeId)`：Garden の今の値（`root_employees`＋各 category の最新の履歴＋今のチーム所属）から Kintone の 1 レコード分を作り、**`roster_record_id`（Kintone の $id）で PUT**。roster_record_id が無い人は打刻ID（`kot_employee_id`）で探し、見つかったら roster_record_id を保存してから PUT。見つからなければ failed（新規作成は次の Codex＝入社手続きで扱う）。
- 送る項目は `mapRosterRecordToProfilePayloads` と `syncRootRoster` の対応の**ちょうど逆**（逆の関数 `mapEmployeeToRosterRecord` を作り、往復テストで同じ値に戻ることを確かめる）。氏名は `従業員名_姓名`・`従業員名_姓名カナ`（姓・名に分かれている列は、今の値があればスペースで分けて送る・分けられなければ送らない）。在籍＝`従業員ステータス`（在籍中／退職済み）と `退職日`。チーム＝`チーム名`（新人チーム→「ヒュアラングループ」・それ以外は同じ名前）とサブテーブル `テーブル`（在籍チーム：`日付_8` 移動日・`ドロップダウン_17` チーム・`文字列__複数行_` メモ。Garden の履歴を全部送る）。
- **選ぶ欄は Kintone の選択肢に無い値を送らない**（Kintone が 400 を返す）。その項目だけ飛ばし、queue の last_error に「〇〇：Kintone の選択肢にない値（××）」と残す。選択肢は 2026-10-29 時点で次のとおり（定数に持つ）：
  - 事業名 `ドロップダウン`：テレマーケティング／SES／所属なし
  - 部署名 `ドロップダウン_0`：営業0部／営業1部／営業2部／所属なし
  - 交通費支給 `ドロップダウン_1`：あり／なし／不明
  - 最寄り駅 `ドロップダウン_3`：長堀橋／心斎橋／難波／堺筋本町／本町
  - 雇用保険 `ドロップダウン_4`：加入経験あり／加入中／未加入
  - 社会保険 `ドロップダウン_5`：加入経験あり／加入中／未加入／国民健康保険／扶養
  - 前払い希望 `ドロップダウン_6`：必要／不要
  - 年末調整 `ドロップダウン_8`：する／しない
  - 所属 `ドロップダウン_15`：ヒュアラン／センターライズ／リンクサポート／ARATA／たいよう／不明／給与支払なし
  - 架電区分 `ドロップダウン_16`：トス／クローザー／事務／なし
  - ●チーム名 `チーム名`：小泉チーム／宮永チーム／石原チーム／ヒュアラングループ／バックヤード／所属なし
  - 雇用形態 `雇用形態`：役員／正社員／準社員／アルバイト／パート／派遣／パートナー（Garden の outsource → パートナー）
  - 種別 `種別`・`種別_1`：普通／当座
  - 銀行名_1 `銀行名_1`：楽天銀行（だけ。他の銀行名は飛ばす）
  - 従業員ステータス：在籍中／退職済み／給与支払なし
- 送らない項目：計算の列（`交通費_往復`）・`マイナンバー`（Garden の暗号化した番号を Kintone に戻さない）・`配属・異動_1`（給与制度のサブテーブル）・`社員番号`（APID は採番が違う）・取り込んでいない項目すべて（面談・研修説明・東海林メモなど）＝Kintone の値をそのまま残す（PUT に含めない）。
- 送り直し：毎朝の cron の中で pending を全部送る（1 人ずつ・失敗は attempts を増やす・5 回失敗で failed）。新しい cron は足さない。
- 今の書き込みを置き換える：`writeRetirementToRoster` と `submission-kintone.server.ts` の名簿への PUT は `queueRosterPush` に置き換える（マイページの提出の **アプリ 92・93 への新規登録は今のまま残す**）。

## 3. Root の編集画面（従業員の小窓）
- 今の「従業員を編集」の小窓（`page.tsx` の Modal・width 860）を **SystemTabs で 4 つのタブ**にする：

```
┌ 従業員を編集：0123 山田 太郎 ─────────────────────────┐
│  基本   住所・連絡先   口座・通勤   雇用の条件             │
│  ━━━                                                    │
│  （今の項目＋生年月日）                                   │
│                                                          │
│                              ［キャンセル］［保存する］   │
└──────────────────────────────────────────────┘
```

- **基本**：今の項目のまま＋**生年月日**（今は見るだけ→変更できる）。
- **住所・連絡先**：郵便番号・都道府県・市町村・町域・建物名・部屋番号・連絡先・連絡先 1〜3（履歴 address・contact）。
- **口座・通勤**：口座 1（今の 8 列のまま）・**口座 2**（銀行名・金融機関コード・支店名・支店コード・種別・口座番号・名義カナ＝履歴 bank_account の sub_account）・交通費 片道・**交通費上限・通勤経路・交通費支給・最寄り駅**（履歴 commute）。
- **雇用の条件**：事業名（旧区分＝テレマーケティング／SES／所属なし。Root の「事業」とは別の項目と画面に書く）・部署名・所属・基準時給・研修時給・研修上限・年末調整（する／しない）・社会保険・雇用保険・雇用保険番号・年金番号・前払い希望・架電区分（履歴 employment）。Root の「社保区分」「年末調整 甲/乙」は今のまま基本タブに残す（中身が違う別の項目）。
- 選ぶ欄は form-kit の普通の select（選択肢は上の Kintone の選択肢と同じ）。2〜3 個の選択肢はラジオ（§2.6 の決まり）。
- 保存：基本は今どおり `root_employees`。ほかのタブは**変わった category だけ** `root_employee_profile_history` に 1 行足す（source='admin'・recorded_by＝操作した社員・今の最新の payload に変わった欄を重ねる＝変えていない欄は消さない）。保存のあと `queueRosterPush(employeeId,'root_edit')`。
- 権限は今の Root の従業員の編集と同じ。チーム所属（TeamHistoryPanel）・事業・退職・在籍の切り替えの保存のあとも `queueRosterPush` を呼ぶ。

## 4. テスト
- `mapEmployeeToRosterRecord`：名簿の 1 件 → 取り込み → 逆変換 → 送る項目が元と同じ（往復）。選択肢に無い値は飛ばして last_error。送らない項目が PUT に入らない。
- スイッチ：kintone_to_garden では Kintone に書かず held／garden_to_kintone では cron・Webhook が取り込まない・pending を送る・5 回で failed。
- Root：4 タブの保存で変わった category だけ履歴が増える・変えていない欄が消えない・生年月日を保存できる。
- マイページの提出・退職が queue に入る（アプリ 92・93 への登録は今のまま）。

## 終わったら
- `npx tsc --noEmit` と関係するテストを通す。完了報告（コードブロック）。本番の手順（migration→スイッチは kintone_to_garden のまま配備→Claude が 1 人で写しを試す→切り替え）を報告に書く。
- ファイルは UTF-8（BOM なし）。**git は触らない（commit しない）。npm install しない。本番の DB に当てない。Kintone に書き込まない（テストはモック）。**

## 実装時の取得回数
- 新しい cron は無し。保存 1 回につき Kintone の PUT 1 回（打刻ID で探すときだけ GET 1 回）。毎朝の送り直しは pending の人数分の PUT。

## Codex-490 実装メモ
- migration は作成のみ。本番 DB・Kintone への書き込みは未実施。
- 本番手順：Claude が migration を適用 → `kintone_to_garden` のまま配備 → Claude が対象1人で写しを検証 → DB の direction を `garden_to_kintone` に切り替え、switched_at・switched_by を記録。逆向きの間は直接の写しも保留するため、1人の検証時も設定の切り替えと既存の held 行・cron の扱いを管理する。
- 切り替え後の既存 cron は1日1回。pending と切り替え前の held を1人ずつ送る。通常の保存件数を S、再送対象人数を R、打刻ID検索が必要な人数を L とすると、1日あたり PUT は S+R 回、GET は L 回。新しい cron・定期取得は追加なし。
- 同じ社員の送信待ちは1行に集約し、同時送信は期限付きのロックで防ぐ。送信中に新たな保存があった場合、その保存の送信待ちを残す。
