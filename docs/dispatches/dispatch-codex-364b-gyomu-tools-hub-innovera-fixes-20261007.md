# Codex-364b：「フォーム」を「業務管理ツール」に改め、INNOVERA番号の同期をその中に入れる＋364 の直し（2026-10-07）

## 目的（東海林さんの言葉）
「Garden/System のフォームの名称を業務管理ツールとかに変更して、今回のイノベラの番号更新の仕組みや、どこかの Kintone アプリに入れた JS 等もここにまとめておきたい」「メニューに単体で『電話番号の同期』ではなく、業務管理ツールに足しましょう。表記は『INNOVERA番号の同期』にしよう」→ GO 済み。

## 作業場所・禁止事項
- 作業ツリー：`C:\garden\a-bloom-008`（main 2aebf18e＋Codex-364 の未コミット変更が乗っている。**その変更は消さない**）。**git の操作は一切しない**（add / commit / push / stash / checkout すべて禁止）
- 触ってよい場所：`src/app/system/forms/`・`src/app/system/innovera/`・`src/lib/innovera/`・`src/app/system/_components/ShachoShell/`（メニュー定義と現在地判定だけ）・`src/app/system/_components/SystemBreadcrumb/`（必要なら）・それぞれのテスト
- 触らない：`.env.local`・`vercel.json`・`supabase/`・`src/lib/kintone/`・本物の INNOVERA／Kintone／Supabase／Chatwork（テストはモックだけ）
- 絵文字は使わない（アイコンは既存の SVG 線画）。色の直書きはしない。画面の文言に開発者用語（API・cron・sync・JSON・レコード等）を出さない

## 1. 業務管理ツール（/system/forms の改称と 3 グループ化）

### メニュー（`shacho-shell-config.ts`）
- 「フォーム」の行を `{ label: "業務管理ツール", description: "日々の連絡や申請の入力、自動で動いている仕組み、Kintone に入れたしかけをまとめた入口です。", icon: "document", href: "/system/forms", minRole: "staff" }` に
- Codex-364 で足した「電話番号の同期」の行は**削除**（画面 `/system/innovera` 自体は残す）
- サイドバーの現在地：`/system/innovera` を開いているときは「業務管理ツール」が選ばれた状態になること。`SystemMenuItem` に `activePrefixes?: string[]` を足し、業務管理ツールの行に `activePrefixes: ["/system/innovera"]` を入れ、`ShachoShell.tsx` の `resolveSystemActivePath` がそれも見るようにする（既存の判定はそのまま）
- `page.tsx`（System ホーム）のカードは自動で新しい名前・説明になる（メニュー定義から出しているため）。確認だけ

### 画面（`src/app/system/forms/`・既存の FormsHubClient を拡張）
- タイトル `業務管理ツール | Garden`。見出し「業務管理ツール」。パンくず「System ／ 業務管理ツール」
- 冒頭の説明：「連絡や申請の入力、自動で動いている仕組み、Kintone に入れたしかけを 1 か所にまとめています。」
- 既存のリスト表示／グリッド表示の切り替えはそのまま使う（保存キーも変えない）
- 3 つのグループ見出しの下に、それぞれのカード（グリッド）または行（リスト）を出す。グループに 1 つも無ければ見出しごと出さない

```
System ／ 業務管理ツール
業務管理ツール                                               [リスト][グリッド]
連絡や申請の入力、自動で動いている仕組み、Kintone に入れたしかけを 1 か所にまとめています。

入力する
┌ 給与計算連絡 ───────┐ ┌ 出勤表・シフトLINE連絡… ┐ ┌ NHK訪問業務 報告 ──────┐
│ 月に一度、給与計算に…      │ │ KING OF TIME の日別…      │ │ …                          │
│ 社員以上            開く → │ │ 社員以上            開く → │ │ 社員以上            開く → │
└──────────────┘ └──────────────┘ └──────────────┘

自動で動いている
┌ INNOVERA番号の同期 ─────┐ ┌ Chatwork への自動配信 ────┐ ┌ 従業員名簿の同期 ───────┐
│ INNOVERA の回線一覧を Kintone…│ │ 決まった時刻に Chatwork へ…  │ │ Kintone の従業員名簿を Root…│
│ 5 分ごと ／ Garden   開く → │ │ 毎日 ／ Garden       開く → │ │ 毎朝 6:00 ／ Garden         │
└──────────────┘ └──────────────┘ └──────────────┘
（以下同様）

Kintone に入れたしかけ
┌ 担当者の自動入力 ───────┐ ┌ 前確依頼の投入 ────────┐ …
│ 全案件一覧・取次連携用で日付…│ │ マイページの前確依頼を…     │
│ ▸ 詳細（配信元・入れた日）    │ │                              │
│ 全案件一覧・取次連携用  開く →│ │ 全案件一覧・取次連携用 開く →│
└──────────────┘ └──────────────┘

```

- カードの中身：名前／説明（1〜2 行）／下段の左に「いつ・どこで」（`schedule` と `runsOn` を「／」でつなぐ。無い方は出さない）／右に「開く →」（`href` があるとき。外部 URL `url` のときは新しいタブ）／「詳細」の折りたたみ（`details` の行を「・」区切りで。無ければ出さない）
- リスト表示の列：名前／説明／いつ・どこで／対象（`target`）／開く
- 「入力する」は既存の `SYSTEM_FORMS` をそのまま使う（`forms-registry.ts` と既存テストは壊さない）。残り 2 グループは新しい登録簿から出す

### 登録簿（新規 `src/app/system/forms/_data/gyomu-tools.json`＋`_lib/gyomu-tools-registry.ts`）
- JSON は **Claude が今後も手で直す**データ（技術レシピ＝手元の作業手順は載せない。東海林さん 2026-10-07）。型：

```ts
type GyomuTool = {
  group: "auto" | "kintone";   // 自動で動いている／Kintone に入れたしかけ
  name: string;
  description: string;
  schedule?: string;   // 例 "5 分ごと"・"毎朝 6:00"・"毎月 5 日"
  runsOn?: string;     // 例 "Garden"・"社内 PC"・"各社サイト"・"Kintone"
  target?: string;     // 効く先。例 "Kintone INNOVERA 番号一覧"
  href?: string;       // Garden 内の画面
  url?: string;        // 外部 URL（配信元など）
  since?: string;      // 入れた日 YYYY-MM-DD
  details?: string[];  // 折りたたみに出す行
  minRole?: "staff" | "manager" | "super_admin";  // 省略＝staff
};
```

- 初期データ（この通りに入れる。文言は変えない）：

```json
[
  { "group": "auto", "name": "INNOVERA番号の同期", "description": "INNOVERA の回線一覧を Kintone の番号一覧へ自動で写します。増えた・消えた・名前が変わった番号をここで確認できます。", "schedule": "5 分ごと", "runsOn": "Garden", "target": "Kintone INNOVERA 番号一覧", "href": "/system/innovera", "since": "2026-10-07" },
  { "group": "auto", "name": "Chatwork への自動配信", "description": "決まった時刻に Chatwork へ自動で送っている連絡（NHK 訪問の集計・コール集計・給与計算連絡など）をまとめて見られます。", "schedule": "毎日", "runsOn": "Garden", "target": "Chatwork", "href": "/system/deliveries" },
  { "group": "auto", "name": "従業員名簿の同期", "description": "Kintone の従業員名簿を Root の組織台帳へ写します。入退社や所属の変更が翌朝には Garden に反映されます。", "schedule": "毎朝 6:00", "runsOn": "Garden", "target": "Root 組織台帳" },
  { "group": "auto", "name": "郵便番号データの月次取込", "description": "日本郵便の郵便番号データを取り込み、住所のチェックに使います。", "schedule": "毎月 5 日", "runsOn": "Garden", "target": "Garden チェック" },
  { "group": "auto", "name": "銀行マスタの月次取込", "description": "銀行・支店の一覧を取り込み、口座の届出で使います。", "schedule": "毎月 1 日", "runsOn": "Garden", "target": "口座の届出" },
  { "group": "auto", "name": "リストマスタの毎朝の更新", "description": "営業リストの分析と、絞り込みの選択肢・件数を毎朝作り直します。", "schedule": "毎朝 6:45・6:55", "runsOn": "Garden", "target": "リストマスタ", "href": "/system/list", "minRole": "manager" },
  { "group": "auto", "name": "法人情報の各社サイトへの反映", "description": "Root の法人情報（住所・代表者など）を変えると、各社の会社HP の表示とお知らせが自動で更新されます。", "schedule": "変更のつど", "runsOn": "Garden・各社サイト", "target": "会社HP", "href": "/system/sites" },
  { "group": "auto", "name": "マニュアル資料の書き戻し", "description": "Garden に載せたマニュアル資料を毎晩、手元のフォルダへ書き戻して控えを取ります。", "schedule": "毎晩 23:30", "runsOn": "社内 PC", "target": "マニュアル", "href": "/system/manuals" },
  { "group": "auto", "name": "前確依頼のチェック係・勤怠の取込", "description": "前確依頼の入力チェックと、KING OF TIME の勤怠の取込を社内 PC の常駐プログラムが行います。", "schedule": "常時", "runsOn": "社内 PC", "target": "前確依頼・勤怠" },
  { "group": "kintone", "name": "担当者の自動入力", "description": "全案件一覧・取次連携用で ET日・後確OK日・開通前FC日・開通後FC日 を入れると、担当者欄に本人の名前が自動で入ります。", "runsOn": "Kintone", "target": "全案件一覧・取次連携用", "url": "https://garden-os.net/kintone/garden-auto-assignee.js", "since": "2026-08-18", "details": ["配信元：garden-os.net（Garden から配信。直すときは Garden 側だけ）", "共有アカウントのときは自動で入れず、担当者が空のままの保存を止めます"] },
  { "group": "kintone", "name": "前確依頼の投入", "description": "マイページの前確依頼をチェックし、全案件一覧と取次連携用へ投入します。", "runsOn": "Garden", "target": "全案件一覧・取次連携用", "href": "/system/zenkaku", "since": "2026-08-25" },
  { "group": "kintone", "name": "関電トスポータルの書込", "description": "関電トスポータルで受け付けたトスアップを Kintone のトスアップへ書き込みます。", "runsOn": "Garden", "target": "トスアップ", "href": "/p/toss" },
  { "group": "kintone", "name": "NHK 訪問報告の書込と集計配信", "description": "NHK 訪問業務の報告を Kintone に書き込み、毎日 20:30 に集計を Chatwork へ送ります。", "schedule": "毎日 20:30", "runsOn": "Garden", "target": "NHK訪問業務 報告フォーム", "href": "/system/forms/nhk-visit", "since": "2026-09-24" },
  { "group": "kintone", "name": "各社サイトの問い合わせ・採用応募の受付", "description": "グループ各社の会社HP の問い合わせと採用応募を Kintone の受付アプリへ書き込み、Chatwork に知らせます。", "runsOn": "各社サイト", "target": "各社の問い合わせ受付・採用エントリー受付", "href": "/system/sites", "since": "2026-09-24" },
  { "group": "kintone", "name": "Kintone に直接入れてあるもの（作り手の確認待ち）", "description": "Kintone の設定に直接アップロードしてある JavaScript。誰が入れたかの記録が無いものです。", "runsOn": "Kintone", "target": "クレジットカード各アプリ・うちのワンニャンNET・ヒカリのプロ電話予約・電気開始受付センター WEB予約・関電件数報告フォーム・デイリータスク", "details": ["クレジットカード 8 アプリ：COUNT.js／実績日変更回数カウント", "うちのワンニャンNET 2 アプリ：retry・cancel・callnumber・construction・numbererror・chatwork・linkopen", "ヒカリのプロ電話予約フォーム：customize・未入力ハイライト・選択式入力・未移行チェック・入力補助ボタン", "電気開始受付センター WEB予約：customize・未入力ハイライト・cv_export・選択式入力・未移行チェック・姓名合体", "関電件数報告フォーム：table10（PC）・table_sp3（スマホ）", "デイリータスク 2 アプリ：次回更新予定日"] }
]
```

- 役職で絞る：`minRole` が自分の役職より上のものは出さない（`isRoleAtLeast`）。既存の `getVisibleSystemForms` と同じ考え方で `getVisibleGyomuTools(role)` を作る

## 2. INNOVERA番号の同期（`src/app/system/innovera/`・`src/lib/innovera/`）の直し
1. 表記：画面の見出し・タイトル（`INNOVERA番号の同期 | Garden`）・Chatwork の件名（`[title]INNOVERA番号の同期（INNOVERA → Kintone）[/title]`）をすべて「INNOVERA番号の同期」に。パンくずは「System ／ 業務管理ツール（/system/forms へのリンク）／ INNOVERA番号の同期」
2. **「見るだけ」は記録しない**：`runInnoveraSync` の `apply=false` のときは `system_innovera_sync_log` に書かない（手動でも）。記録するのは `apply=true` のときだけ（変化なしの自動実行は従来どおり記録しない。手で「今すぐ反映」を押したときは 0 件でも記録）。テストを直す
3. 「最後の反映」は記録の最新行（＝反映した行）から出す。画面の `latest` が「見ただけ」の結果を拾わないこと（2 の直しで記録に見るだけの行が無くなるが、画面側も `applied` が true のものだけを見る）
4. Kintone の履歴テーブルを送り返すとき、**既存行は `{ id, value: { 列: { value } } }` の形にそろえる**（Kintone から読んだ行には各列に `type` が付いている。`type` を落とし、`value` だけにする）。`stripHistoryUser` と同じ場所（`diff.ts`）に `normalizeHistoryRows` を作って `renamedRecord`／`retiredRecord` で使う。テスト：`type` 付きの既存行を渡して、送る本文に `type` が無いこと
5. 新規の行の「内容」は「FD番号 ／ 回線名称（発番 YYYY-MM-DD）」の形に（例 `08006000830 ／ 08006000830（発番 2026-09-16）`）。`InnoveraSyncDetail` に `issuedDate?: string` を足して `detailFor` で入れる
6. 「今すぐ反映」を押している間は画面全体に待ち画面を出す（二重押し防止）。`src/app/system/list/_components/ListProcessingOverlay.tsx` と同じ見た目・同じ作り（くるくる＋「Kintone に反映しています」の文言。暗くするだけにしない。失敗したら必ず閉じる）
7. 画面の冒頭の説明の末尾を「変更があったときは Chatwork「Garden通知」にも知らせます。」のままでよい

## テスト（vitest）
- `src/app/system/forms/`：登録簿の読み込み（group ごとの件数＝auto 9・kintone 6）／役職で絞れる（cs は何も出ない・staff はリストマスタの行が出ない・manager は出る）／FormsHubClient に 3 つの見出しと INNOVERA番号の同期のカード（`/system/innovera` へのリンク）が出る／既存の `forms-registry.test.ts`・`FormsHubClient.test.tsx`・`page.test.tsx` を壊さない（文言の変更に合わせて直すのは可）
- `src/app/system/_components/ShachoShell/`：メニューに「電話番号の同期」が無い・「業務管理ツール」がある／`resolveSystemActivePath("/system/innovera")` が `/system/forms` を返す（既存テストがあればそこに足す）
- `src/lib/innovera/`：上の 2・4・5 のテスト。Chatwork 本文の件名が「INNOVERA番号の同期」
- `src/app/system/innovera/`：見出し・パンくず・新規行の表示・待ち画面が出て閉じる
- 最後に `npx.cmd vitest run src/app/system/forms src/app/system/innovera src/lib/innovera src/app/api/system/innovera-sync src/app/system/_components` と `npx.cmd tsc --noEmit -p .` を実行し、結果を報告に書く

## 完了報告（この形で・コードブロックで出力）
```
Codex-364b 完了報告
1. 変えた・足したファイル：
2. 追加・変更したテストの本数と結果（vitest の PASS/FAIL 数）：
3. tsc のこの範囲に関するエラー数：
4. 指示と違う作りにした点・迷った点：
5. 触っていないこと（git・.env.local・vercel.json・supabase・本物の外部サービス）の確認：
```
