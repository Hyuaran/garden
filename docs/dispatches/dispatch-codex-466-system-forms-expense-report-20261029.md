# Codex-466：System ＞ フォームに「経費 報告」を作る（3 種類・Kintone 経費一覧へ写す）（2026-10-29）

## 東海林さんの話
- 今は「じぶんフォーム」（【経費】報告フォーム）で入力して、Kintone「経費一覧」（アプリ 95）にたまっている。これを Garden に移す。Kintone にたまる形は今と同じ。
- NHK訪問業務 報告フォーム（`/system/forms/nhk-visit`）と同じ作り：ログインした Garden アカウントで本人が決まる。
- **フォームは 3 種類**（事業選択の選択肢だけが違う）：
  1. **NHK だけ**：事業＝NHK（1 つだけなので選ぶ欄は出さず、「事業：NHK」と表示）
  2. **NHK／関電 組**：事業＝関電・関電トス・NHK
  3. **上田くん専用**：事業＝関電トス・NHK・ブレーカー・取引先打合せ
- **使える人＝Garden のアカウントがあれば誰でも**（在籍中の人。役職で絞らない）。
- 決済方法の「クレジットカード」は「**会社クレジットカード**」に名前を変える（Kintone は Claude が変更・置換済み）。

先に読む：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md` §2.5・§2.6（社長スタイルの型・点検に従う）。画面の文字に略称・開発者用語を書かない。絵文字なし（印は SVG の線）。iPhone で入力欄が拡大しないこと（globals.css の pointer:coarse を消さない）。

まねる元（読んでから作る）：
- `src/app/system/forms/nhk-visit/`（page.tsx・NhkVisitClient.tsx・nhk-visit.module.css・_lib）
- `src/app/api/system/nhk-visit/route.ts`（Garden に保存 → Kintone へ。Kintone が落ちても 200 で返し `kintone_error` に残す）
- `src/app/m/nhk/page.tsx`（スマホ用の入口）
- `supabase/migrations/20260924000001_system_nhk_visit_report.sql`
- `src/app/system/forms/_lib/forms-registry.ts`（フォーム一覧への登録）

## 1. 画面
- `/system/forms/expense`（パソコン）と `/m/expense`（スマホ）。どちらも同じ部品。
- 3 種類は**タブ**（社長スタイルの SystemTabs）：「NHK」「NHK・関電」「上田専用」。URL は `?form=nhk` `?form=nhk-kanden` `?form=ueda`。最後に開いたタブをその人のブラウザに覚えておく（localStorage・読み書きは try/catch）。スマホでも同じタブ。
- 頭の型は §2.5 どおり（場所の表示 → h1「経費 報告」→ タブ）。
- 画面の絵（スマホ・「NHK・関電」タブ）：
```
経費 報告
[NHK] [NHK・関電] [上田専用]
─────────────────────────────
申告者   桐井 大輔（1508）            ← ログインから自動・変えられない
［前と同じ内容で入れる ▼］            ← 自分の最近の入力（用途・詳細・金額）から選ぶと 3 つが入る
事業      ○関電  ○関電トス  ○NHK      ← 最初は前回その人が選んだ事業（無ければ未選択）
決済方法  ●現金  ○会社クレジットカード
決済日    [2026-10-29]                ← 今日が既定・変更可
金額      [        430] 円（税込）     ← 数字だけ・スマホは数字のキーボード
使用用途  [交通費 電車(現金)] [駐車場代] [宿泊費]
          [ETC/高速代] [交通費] [ガソリン代] [PITAPA]
          ［ほかの用途 ▼］→ 交通費 自転車レンタル／備品代／郵送代／会食費／その他
用途の詳細 [帰宅 新大宮-瓢箪山        ]  ← 例を薄く表示。用途が「その他」のときは必須
備考      [                          ]  ← 任意
                           ［送信する］
─────────────────────────────
自分の最近の報告（直近 1 週間）           ← 表。日付・事業・用途・詳細・金額・送った時刻（秒まで）
```
- 送信できたら「送信しました」を出し、金額・用途の詳細・備考を空に戻す（事業・決済方法・決済日は残す＝続けて入れやすく）。二重押しを防ぐ（送信中はボタンを止める）。
- 入力の確認：事業・決済方法・決済日・金額（1 円以上の整数）・使用用途は必須。「その他」なら用途の詳細も必須。
- 「NHK」タブは事業を選ぶ欄を出さず、事業は NHK に決まり。
- ライト／ダーク、幅 4 段階（スマホ 375・タブレット・1384・広い画面）で崩れないこと。

## 2. データ（Garden が正本）
- migration `supabase/migrations/20261029000466_system_expense_report.sql`：表 `system_expense_report`（1 送信 1 行）
  - id uuid・employee_number・employee_name・form（'nhk'|'nhk-kanden'|'ueda'）・business（'関電'|'関電トス'|'NHK'|'ブレーカー'|'取引先打合せ'）・payment（'現金'|'会社クレジットカード'）・paid_on date・amount integer（>0）・purpose（下の 12 個のどれか）・purpose_detail・note・created_at・kintone_record_id・kintone_error・kintone_sent_at
  - check で form ごとに選べる business を縛る（nhk→NHK だけ、nhk-kanden→関電/関電トス/NHK、ueda→関電トス/NHK/ブレーカー/取引先打合せ）。
  - RLS：本人は自分の行だけ読める・追加は API（service_role）から。全権管理者は全部読める。
- 本番 DB に当てるのは Claude。Codex は当てない。

## 3. 送信の入口 `POST /api/system/expense-report`
- ログイン中の在籍者なら誰でも。本人は**ログインから決める**（送られてきた社員番号は使わない）。
- 流れ：入力を確かめる → Garden に保存 → Kintone アプリ 95 へ 1 件追加 → 成功なら kintone_record_id、失敗なら kintone_error に残して 200 で返す（NHK と同じ）。
- Kintone の欄（フィールドコード → 中身）：
  - `ルックアップ`（ラベル KOTID・**ルックアップ**・引き先＝アプリ 56 従業員名簿）→ 社員番号（例 1508）だけを送る。従業員名・事業名・部署名・チーム名（`文字列__1行__0`・`__3`・`__2`・`__1`）は Kintone が自動で入れる（Claude が 2026-10-29 にテストの 1 件で確認済み・そのレコードは削除済み）。これらの欄は送らない。
  - **ルックアップを API トークンで動かすには、引き先のアプリ 56 のトークンも一緒に送る**：`X-Cybozu-API-Token: <アプリ95のトークン>,<KINTONE_EMPLOYEE_ROSTER_TOKEN>`（カンマでつなぐ）。
  - `事業選択` → business
  - `ラジオボタン`（決済方法）→ payment（「現金」「会社クレジットカード」）
  - `日付`（決済日）→ paid_on
  - `数値`（金額）→ amount（税込。`計算`・`計算_0` は Kintone が計算するので送らない）
  - `ラジオボタン_0`（使用用途）→ purpose。値は Kintone の選択肢と**同じ文字**：ETC/高速代・備品代・郵送代・宿泊費・駐車場代・PITAPA・交通費 電車(現金)・会食費・ガソリン代・交通費・交通費 自転車レンタル・その他
  - `文字列__1行__5`（使用用途詳細）→ purpose_detail
  - `文字列__複数行__0`（備考）→ note
  - `文字列__1行__6`（決済年）→ paid_on の年（例 2026）／`文字列__1行__4`（決済年月）→ 例 202610
  - `文字列__1行_`（タイムスタンプ(SS)）→ 送信の日時 `2026-10-29 10:19:00`（日本時間・秒まで）
  - `清算日` は送らない（経理が入れる）
- 環境変数：`KINTONE_EXPENSE_REPORT_APP_ID`（既定 95）・`KINTONE_EXPENSE_REPORT_TOKEN`（東海林さんが発行中。無いときは Kintone へは送らず kintone_error に「Kintone の設定がありません」と残す）。
- `GET /api/system/expense-report?recent=1`：本人の直近 1 週間の行と、「前と同じ内容で入れる」用の最近の組み合わせ（用途・詳細・金額の重複を除いた新しい順 10 個）。

## 4. 登録
- `forms-registry.ts` に「経費 報告」を足す（roleLabel「全員」・役職で絞らない。説明文：「立て替えた経費・会社クレジットカードの利用を報告します。Garden に記録し、Kintone の経費一覧にも同じ内容が入ります。スマホは garden-os.net/m/expense から開けます。」）。
- 画面ごとの閲覧権限（歯車）の決まりに合わせる：在籍者なら誰でも開ける既定にする（`withSystemView` の既定が絞るなら、この画面は全員に開く設定にする）。
- 業務管理ツールの登録簿 `src/app/system/forms/_data/gyomu-tools.json` に 1 行（group kintone・「経費報告の書込」・target「Kintone 経費一覧」・href・since 2026-10-29）。

## 5. テスト
- 入力の確かめ（必須・その他のとき詳細必須・金額は 1 以上の整数・form と business の組み合わせ）。
- 本人はログインから決まり、送られた社員番号を無視する。
- Kintone へ送る中身（欄の対応・決済年／決済年月・タイムスタンプの形・計算の欄と従業員名などルックアップで入る欄を送らない・トークンを 2 つカンマでつなぐ）。Kintone 失敗で 200＋kintone_error。
- 画面：3 つのタブで事業の選択肢が違う／NHK タブは選ぶ欄が無い／前と同じ内容で 3 つが入る／送信後に金額・詳細・備考が空になり事業・決済方法・日付は残る／二重押しできない。

## 6. 終わったら
- `npx tsc --noEmit` と関係するテストを通す。完了報告（コードブロック）。
- **git は触らない（commit しない）。npm install しない。本番の DB に当てない。Kintone へのテスト送信も Codex はしない（Claude がやる）。**

## 実装時の取得回数
- 定期的な取り直し・cron の追加は無し（自動の定期取得は 1 日 0 回）。
- 画面を開いたときに直近の報告を 1 回読む。送信 1 回につき Kintone への書き込み 1 回。
