# Codex-476：公式 LINE の連絡先を従業員名簿と結ぶ・メニューの担当を人で選ぶ・メニューの絵の名前を Garden が書き込む（2026-10-29）

## 東海林さんの話
- 公式 LINE の連絡先（個人の LINE のリンク）は従業員名簿にも持たせる。名簿から変えても、公式 LINE の連絡先から変えても、どちらにも同じものが入る。追加もできる。
- 連絡先の名前は「東海林さん」ではなく「東海林 美琴」（氏名）にする。
- メニューの絵の名前（「小泉さんに連絡」など）は、担当を変えたら Garden が文字を差し替える。絵を手で作り直さない。

先に読む：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md` の §2.5〜§2.7（**社長スタイル §2.5 の型・§2.6 の点検に従う。表の行は全体を押す（DataTable の onRowClick）・［変更する］などの列は置かない・押した先は共通 Modal・フォームは form-kit**）。画面の文字はきちんとした言い方。略称・開発者用語・絵文字なし。長い説明は不要・ファイルは必要な範囲だけ読む。

今の作り（読んでから作る）：
- 連絡先 `src/app/system/line/ContactSettings.tsx`・リッチメニュー `src/app/system/line/RichMenuSettings.tsx`・`src/app/system/line/LineManager.tsx`・入口 `src/app/api/system/line/manage/route.ts`
- メニューの決まり `src/lib/line/richmenu.ts`（`menuDefinition`・連絡先の key＝`miyanaga`／`team:小泉チーム`／`team:石原チーム`／`nhk`／`office`／`guest_home`）・反映 `src/lib/line/richmenu.server.ts`（絵は `public/line/richmenu/*.jpg` を読んで LINE に送る）
- 表 `supabase/migrations/20261029000473_system_line_richmenu.sql`（`system_line_contact`）
- Root の社員情報（従業員の詳細・編集の画面と入口）：`src/app/root/employees/` 付近。名簿の取り込み `src/app/root/_lib/roster-sync.server.ts`（Kintone→Garden）

## 1. データ（migration `20261029000476_line_contact_roster.sql`・ファイルの作成のみ・Claude が本番に当てる）
- `root_employees` に `line_contact_url text`（空 or `https://line.me/` で始まる）を足す。
- `system_line_contact` に `employee_id text references root_employees` を足す。`guest_home` 以外は「役割→人」の割り当てにし、リンクは人（`root_employees.line_contact_url`）から読む。
- 役割の名前（画面に出す）：`miyanaga`＝マネージャー／`team:小泉チーム`＝小泉チームのリーダー／`team:石原チーム`＝石原チームのリーダー／`nhk`＝NHK派遣事業の担当／`office`＝事務・その他の担当。`guest_home`＝会社のホームページ（リンクのまま）。
- 今の値を移す：社員番号 1165 宮永＝`https://line.me/ti/p/-xQCaOeokf`・役割 miyanaga／1326 小泉＝`https://line.me/ti/p/gkj0hZCq83`・team:小泉チーム／1523 石原＝`https://line.me/ti/p/9x7lHB1Uy0`・team:石原チーム／1508 桐井＝`https://line.me/ti/p/k8yMfVVJWG`・nhk／0008 東海林＝`https://line.me/ti/p/KRNGw6Bi-N`・office。
- `system_line_contact.url` は guest_home だけで使う（ほかの行は移したあと空にする）。
- 名簿の取り込み（Kintone→Garden）は `line_contact_url` を上書きしない（Kintone に無い項目）。

## 2. 連絡先タブ（名簿と同じものを読み書き）
```
                                             [連絡先を追加する]
[検索]
┌──────────────┬───────────────────────────┐
│     氏名      │           リンク            │   ← 行を押すと小窓（リンクの変更・外す）
├──────────────┼───────────────────────────┤
│ 東海林 美琴    │ https://line.me/ti/p/…      │
│ 宮永 ひかり    │ https://line.me/ti/p/…      │
│ 会社のホームページ │ 未登録                       │   ← これだけは人ではない
└──────────────┴───────────────────────────┘
```
- 行＝`line_contact_url` を持っている在籍者＋会社のホームページ。氏名は名簿の氏名（姓と名の間は半角空白 1 つに整える）。
- ［連絡先を追加する］：小窓で「1 氏名」（普通のプルダウン・在籍者でまだリンクの無い人）・「2 リンク」→［登録する］。
- 行を押す：小窓で「リンク」を変更→［登録する］、［連絡先から外す］（赤い線のボタン・確認つき。メニューの担当になっている人は外せない＝「先にリッチメニュータブで担当を変更してください」）。
- 保存は `root_employees.line_contact_url`。全権管理者だけ（今の入口の権限のまま）。

## 3. Root の社員情報
- 従業員の詳細の画面に「公式 LINE の連絡先」（リンク）を足し、そこから変更できる（今の編集の形に合わせる）。保存先は同じ `line_contact_url` なので、どちらで変えても同じ。

## 4. リッチメニュータブ：担当を人で選ぶ
```
メニューの担当
┌────────────────────┬──────────────┐
│        役割          │     担当       │   ← 行を押すと小窓：担当（プルダウン＝連絡先のある人）→［登録する］
├────────────────────┼──────────────┤
│ マネージャー          │ 宮永 ひかり     │
│ 小泉チームのリーダー    │ 小泉 翔        │
│ 石原チームのリーダー    │ 石原 孝志朗     │
│ NHK派遣事業の担当     │ 桐井 大輔       │
│ 事務・その他の担当     │ 東海林 美琴     │
└────────────────────┴──────────────┘
                                        [リッチメニューに反映する]
（今のメニューの表）
```
- 担当を変えたら「登録したら［リッチメニューに反映する］を押してください。」。担当が空の役割は、今と同じくマネージャーで代わりに開く。

## 5. メニューの絵の名前を Garden が書き込む
- 土台の絵（Claude 作成済み）：`public/line/richmenu/employee_4_base.jpg`（2500×1686・下の 2 つの説明文が空）、`employee_3_base.jpg`（2500×843・右の説明文が空）。`guest_2.jpg` は今のまま。
- 反映のとき、土台に文字を書き込んで LINE に送る：
  - 4 つボタン（小泉・石原チーム）：左下に「{リーダーの姓}さんに連絡」中心 x=625・文字の上端 y=843+640、右下に「{マネージャーの姓}さんに連絡」中心 x=1875・同じ高さ。大きさ 58px・色 #54616D。
  - 3 つボタン（宮永・新人／NHK／事務）：右に「{担当の姓}さんに連絡」中心 x=2083・上端 y=640・大きさ 46px・同じ色。
  - 担当が空のときはマネージャーの名前。姓＝氏名の最初の空白まで。
- 書き込みは `next/og` の `ImageResponse`（同梱済み）で、書体は `src/assets/fonts/NotoSansJP-Regular.ttf`（Claude 作成済み・Noto Sans JP の普通の太さ・SIL Open Font License）。土台の絵は背景に置く。出力は PNG（LINE の上限 1MB 以下を確かめる。超えるなら JPEG にする）。
- `employee_4_koizumi.jpg`・`employee_4_ishihara.jpg`・`employee_3.jpg` は使わなくなるので消す。
- リッチメニュータブの小窓の絵も、同じ書き込み済みの絵を出す（全権管理者だけが見られる入口 `GET /api/system/line/richmenu-image?group=…`。今の担当で作る）。

## 6. テスト
- 移し替え：5 人のリンクと役割が名簿に入る。
- 連絡先：一覧＝名簿のリンクの人＋ホームページ・追加・変更・外す（担当中は外せない）。Root の画面から変えても同じ値。
- 担当：変更→menuDefinition のリンクがその人のリンクになる。空ならマネージャー。
- 絵：グループごとに正しい名前の文字が入る（文字の中身を確かめる関数を分けてテストする）。名簿の取り込みが line_contact_url を消さない。

## 終わったら
- `npx tsc --noEmit` と関係するテストを通す。完了報告（コードブロック）。
- ファイルは UTF-8（BOM なし）。**git は触らない（commit しない）。npm install しない。本番の DB に当てない。LINE へ送らない・反映しない。**

## 実装時の取得回数
- 新しい cron は無し（1 日 0 回）。反映は今と同じ（ボタンを押したとき）。絵の書き込みは反映 1 回につきメニューの数（6）だけ。小窓の絵は開いたとき 1 回。
