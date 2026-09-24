# Codex-349：System ＞ フォーム に「NHK訪問業務 報告フォーム」を新設する

作成日: 2026-09-24
作業ツリー: C:\garden\a-bloom-008（main）
※ このツリーでは Codex は git を触らない。**commit も push もしない**（コミットは Claude が行う）

---

## 0. 何を作るか（東海林さん 2026-09-24）

NHK 訪問業務に行ったスタッフが、業務の終わりにスマホから報告するフォームを Garden に作る。
いまは切り離しの HTML（スマホで開いて、結果をコピーして LINE に貼る）を使っている。これを Garden の中に入れて、
**送信すると Garden に記録が残り、Kintone にも同じ内容が入る**ようにする。LINE 用にコピーする機能はそのまま残す。

- 画面：**System ＞ フォーム ＞「NHK訪問業務 報告フォーム」**　URL `/system/forms/nhk-visit`
- 使える人：**正社員以上**（`staff` 以上。`/system/forms/payroll-notice` と同じ判定）
- 元の HTML（そのまま移植するのではなく、**中身と操作感を写して社長スタイルで作り直す**）：
  `C:\Users\shoji\Downloads\NHK訪問業務報告フォーム.html`
- 使い方ガイド（文言の元）：`C:\Users\shoji\Downloads\NHK訪問報告フォーム_使い方.pdf`

**この指示書の範囲は「フォーム本体」まで。** LINE への自動送信（毎日 20 時の集計配信）は別の指示書で行う。
このフォームで貯めたデータを使うので、**テーブルは後で集計しやすい形にしておく**（下の DB を厳守）。

---

## 1. 画面の絵（上から順）

```
System ／ フォーム ／ NHK訪問業務 報告フォーム          ← 既存の SystemBreadcrumb

NHK訪問業務 報告フォーム
業務が終わったら、この画面に入力して送信してください。      ← lead

┌─ ▼ 使い方（タップで開く。最初は閉じている） ───────────┐
│ ① 日付　　開くと今日の日付が入ります。違う日を報告する    │
│ 　　　　　ときだけ変えてください。                      │
│ ② 時間　　標準の時間が入っています。違うときだけ変えて…   │
│ ③ 派遣先　一覧から選びます。必ず選んでください。          │
│ ④ 業務　　「対面アプローチ」で固定です。                 │
│ ⑤ 成約件数 ＋／－で数えます。無ければ 0 のままで OK。     │
│ ⑥ 交通費　「あり」「なし」を選びます。                   │
│ ⑦ 送信　　［報告内容を送信する］を押すと記録されます。    │
│ 　　　　　送信すると Garden と Kintone に記録されます。   │
│ 　　　　　LINE に貼る文面は［コピー］で取れます。         │
└──────────────────────────────────────┘

送信者　東海林 美琴（1234）                              ← ログインから自動。読むだけ

┌ 1 日付 ────────────────┐
│ [2026/09/24 ▼]                      │   ← 開いた日が既定。変更できる
└────────────────────────┘
┌ 2 時間 ────────────────┐
│ [09:30] 〜 [18:00]                   │
└────────────────────────┘
┌ 3 派遣先 ──────────────┐
│ [選択してください ▼]                  │   ← NHK奈良／NHK京都／NHK大阪／NHK大津／NHK神戸
└────────────────────────┘
┌ 4 業務 ────────────────┐
│ 対面アプローチ                        │   ← 変えられない表示だけ
└────────────────────────┘
┌ 5 成約件数 ──────────────┐
│ ■新規                                │
│ 　地上　　　　　[－] [ 0 ] [＋]        │
│ 　衛星　　　　　[－] [ 0 ] [＋]        │
│ 　新規　計　　　　　　　　　0 件        │
│ ■住所変更                             │
│ 　地上　　　　　[－] [ 0 ] [＋]        │
│ 　衛星　　　　　[－] [ 0 ] [＋]        │
│ 　住所変更　計　　　　　　　0 件        │
│ ■口座・クレ                           │
│ 　件数　　　　　[－] [ 0 ] [＋]        │
└────────────────────────┘
┌ 6 交通費 ───────────────┐
│ [ あり ] [ なし ]                     │   ← 2 つのボタン。既定は「あり」
└────────────────────────┘

[ 報告内容を送信する ]                                   ← 幅いっぱい

─ 送信後にここへ出る ─────────────────────
送信しました（Kintone にも記録しました／Kintone は後で送り直します）
┌ 報告内容 ─────────────── [コピー] ┐   ← ［コピー］は枠の上の行の右端
│ 【日付】2026/09/24                        │
│ 【時間】09:30〜18:00                      │
│ 【派遣先】NHK奈良                          │
│ 【業務】対面アプローチ                      │
│ 【成約件数】                               │
│ 　■新規　2件（地上1件、衛星1件）            │
│ 　■住所変更　0件（地上0件、衛星0件）         │
│ 　■口座・クレ　1件                         │
│ 【交通費】あり                             │
└──────────────────────────┘

直近 1 週間のあなたの報告                                ← 自分の分だけ。無ければ「まだありません」
┌──────────────────────────────┐
│ 09/24（火）NHK奈良　09:30〜18:00　新規2・住所0・口座1　交通費あり │
│ 09/23（月）NHK京都　09:30〜18:00　新規0・住所1・口座0　交通費なし │
└──────────────────────────────┘
```

- ［コピー］の位置は **`/system/forms/shukkin` と同じ決まり**＝文面の枠のすぐ上の行の右端、枠の右端とそろえる。
- 元の HTML にあった「※ インターネットに情報が送られることはありません」は **Garden 版では事実と変わるので書かない**。
  代わりにガイド⑦の「送信すると Garden と Kintone に記録されます」を書く。PDF の「検討中」の表示も入れない。

---

## 2. 見た目

- **社長スタイル**。正本：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md`
- 既存 `src/app/system/forms/shukkin/shukkin.module.css` の作り（`--navy` `--teal` `--bg:#f4f5f7` などの変数、カード、`:global(.dark)` の上書き）に合わせる。**生の色を直書きしない。**
- 幅 **1866／1280／768／390** のすべてで、横スクロールが出ない・文字が枠からはみ出さない・押しにくいボタンが無いこと。ライトとダークの両方。
- ＋／−は指で押せる大きさ（44px 角以上）。数字の欄は読むだけ（キーボードを出さない）。
- 絵文字は使わない（アイコンが要る場所は既存の SVG に合わせる）。

---

## 3. データの置き場所（DB）

新しい migration `supabase/migrations/20260924000001_system_nhk_visit_report.sql`

```sql
create table if not exists public.system_nhk_visit_report (
  id uuid primary key default gen_random_uuid(),
  visit_date date not null,
  start_time time not null,
  end_time time not null,
  destination text not null,
  task_name text not null default '対面アプローチ',
  new_ground integer not null default 0,
  new_satellite integer not null default 0,
  address_ground integer not null default 0,
  address_satellite integer not null default 0,
  bank_credit integer not null default 0,
  transport_fee text not null,                  -- 'あり' / 'なし'
  employee_number text not null,
  employee_name text not null,
  submitted_by uuid not null references auth.users(id),
  submitted_at timestamptz not null default now(),
  kintone_record_id text null,                  -- 送れたら Kintone のレコード番号
  kintone_synced_at timestamptz null,
  kintone_error text null,
  created_at timestamptz not null default now()
);
```

- `destination` は `check (destination in ('NHK奈良','NHK京都','NHK大阪','NHK大津','NHK神戸'))`
- `transport_fee` は `check (transport_fee in ('あり','なし'))`
- 件数 5 つは `check (... >= 0)`
- 索引：`(visit_date)` と `(employee_number, visit_date desc)` と `kintone_synced_at is null` の部分索引
- RLS：`system_shukkin_member` と同じ書き方に合わせる
  - select：`staff,outsource,manager,admin,super_admin`（自分の分だけに絞るのは API 側で行う）
  - insert/update：API は service role で書くので、RLS は select だけ許可でよい
- 合計（新規計・住所変更計・成約合計）は **列に持たない**（表示と Kintone 送信のときに足す）

---

## 4. 送信の入口（API）

`src/app/api/system/nhk-visit/route.ts`（`runtime = "nodejs"`）

- **POST**：送信
  1. `requireStaff`（`src/app/system/mypage/_lib/submission-server.ts` の既存の関数）でログインと権限を見る
  2. 入力を検証（日付＝`YYYY-MM-DD`・時刻＝`HH:MM`・派遣先は 5 つのどれか・件数は 0 以上の整数・交通費は あり/なし）。
     おかしければ 400 と**画面に出せる日本語**（「派遣先を選んでください」など。開発者用語を書かない）
  3. `system_nhk_visit_report` に **先に保存**（service role）
  4. そのあと Kintone（アプリ **241**）へ登録。成功したら `kintone_record_id` と `kintone_synced_at` を書く。
     失敗しても **200 を返す**（`kintone_error` に理由を残す）。画面には「送信しました（Kintone は後で送り直します）」と出す
  5. 返す値：保存した 1 件＋組み立てた文面
- **GET**：`?mine=1` で**自分の直近 1 週間**（今日を含む 7 日分）を新しい順で返す

Kintone へ送るときの対応（**アプリ 241 の項目コードはすでに本番にある**）

| Kintone の項目コード | 入れる値 |
|---|---|
| `日付` | visit_date |
| `開始時刻` / `終了時刻` | start_time / end_time（`HH:MM`） |
| `派遣先` | destination |
| `業務` | task_name |
| `新規_地上` / `新規_衛星` / `新規_計` | 新規の 2 つと、その合計 |
| `住所変更_地上` / `住所変更_衛星` / `住所変更_計` | 住所変更の 2 つと、その合計 |
| `口座クレ` | bank_credit |
| `成約_合計` | 新規計＋住所変更計＋口座クレ |
| `交通費` | あり／なし |
| `報告者社員番号` / `報告者氏名` | ログインした人 |
| `報告日時` | submitted_at（`YYYY-MM-DDTHH:MM:SSZ`） |
| `Garden記録番号` | 保存した行の id（重複防止のため Kintone 側で重複不可にしてある） |

- 送信先：`https://${process.env.KINTONE_SUBDOMAIN}.cybozu.com/k/v1/record.json`（POST・`X-Cybozu-API-Token`）
- トークンは **新しい環境変数 `KINTONE_NHK_VISIT_REPORT_TOKEN`**（Vercel への登録は Claude が行う。**値を指示書やコードに書かない**）
- 既存の `src/lib/kintone/records.ts` に**登録用の関数が無ければ足す**（`createRecord(app, token, record)`）。GET に `Content-Type` を付けない決まりはそのまま。

---

## 5. 文面の組み立て（`_lib`）

`src/app/system/forms/nhk-visit/_lib/nhk-visit.ts` に、画面と API の両方から使える形で置く。

```
【日付】2026/09/24
【時間】09:30〜18:00
【派遣先】NHK奈良
【業務】対面アプローチ
【成約件数】
　■新規　2件（地上1件、衛星1件）
　■住所変更　0件（地上0件、衛星0件）
　■口座・クレ　1件
【交通費】あり
```

- 元の HTML の出力と**1 文字も変えない**（全角の　や 件 の位置も同じ）。
- 合計の計算もここに置く（画面の「計」と Kintone に送る値が食い違わないようにする）。

---

## 6. 一覧への登録

`src/app/system/forms/_lib/forms-registry.ts` に足す。

```ts
{
  slug: "nhk-visit",
  name: "NHK訪問業務 報告",
  description: "NHK 訪問業務の当日の報告を送ります。Garden に記録し、Kintone にも同じ内容が入ります。",
  roleLabel: "社員以上",
  minRole: "staff",
  icon: "document",
  href: "/system/forms/nhk-visit",
}
```

---

## 7. テスト（vitest）

- `_lib` の文面：件数 0 のとき／地上だけ／全部入りで、1 文字も違わないこと
- 合計：新規計・住所変更計・成約合計
- API の入力検証：派遣先が空・件数が負・時刻の形が違う → 400 と日本語の文言
- Kintone が失敗しても 200 が返り、Garden の保存は残ること（fetch をモックする）
- 画面：ガイドの開閉、＋／−で合計が変わる、送信後に文面と［コピー］が出る

## 8. 完了条件

1. `npx tsc --noEmit -p .` がエラー 0
2. `npx vitest run src/app/system/forms src/app/api/system/nhk-visit` が全部緑
3. 幅 1866／1280／768／390 でライト・ダークとも崩れない（Claude が実機で確認する）
4. **commit も push もしない。** 変更したファイルの一覧を完了報告に書く

## 9. 触らないもの

- `src/app/system/forms/shukkin/` と `payroll-notice/`（読むのは可・直すのは不可）
- 既存の migration（新しいファイルを足すだけ）
- `src/lib/kintone/records.ts` の既存の関数（足すのは可・既存の中身は変えない）

## 10. 完了報告

**次の形のコードブロックで報告する**（そのままコピーできるように）。

```
Codex-349 完了報告
■作ったもの：
■変更したファイル：
■tsc：
■vitest：
■やっていないこと／気づいた点：
```
