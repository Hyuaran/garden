# Codex-350：NHK訪問報告の集計を「Chatwork へ毎日 20 時」と「LINE の合言葉に返信」で出す

作成日: 2026-09-24
作業ツリー: C:\garden\a-bloom-008（main）
※ このツリーでは Codex は git を触らない。**commit も push もしない**（コミットは Claude が行う）
前提: Codex-349（`/system/forms/nhk-visit`・表 `system_nhk_visit_report`）が本番で動いている

---

## 0. 何を作るか（東海林さん 2026-09-24）

NHK 訪問業務の報告（Garden に貯まる）を、**現場と役職者それぞれの道具に合わせて**届ける。

- **役職者＝Chatwork**：**毎日 20 時**に、その日の集計＋月の累計＋分析が自動で届く。Chatwork は通数の上限が無い
- **現場＝LINE**：公式アカウント「Garden からの自動連絡」のグループで**合言葉**を送ると、その場で集計が返る。
  **返信（Reply）は無料・無制限**。**こちらから送りつける送信（Push）は使わない**（LINE は人数分の通数がかかるため）

数字のもとは `system_nhk_visit_report`（Kintone は見に行かない）。

---

## 1. 出す文章の見本

### 1-1. Chatwork（毎日 20 時・当日分）

```
[info][title]NHK訪問業務 集計（2026/09/24 木）[/title]
■ 本日の報告　3 人

山田 太郎　NHK奈良　09:30-18:00
　新規 2（地上1・衛星1）／住所変更 0／口座・クレ 1　＝ 3 件
田中 花子　NHK京都　10:00-18:00
　新規 1（地上1・衛星0）／住所変更 2（地上2・衛星0）／口座・クレ 0　＝ 3 件
佐藤 次郎　NHK大阪　09:30-17:00
　新規 0／住所変更 0／口座・クレ 0　＝ 0 件

本日の合計　新規 3・住所変更 2・口座クレ 1　＝ 6 件

■ 今月の累計（9/1〜9/24）
山田 太郎　38 件／田中 花子　31 件／佐藤 次郎　12 件
合計　81 件（報告のあった日数 18 日）

■ 見立て
・前日 4 件 → 本日 6 件（＋2）。先週の木曜は 5 件（＋1）
・今月は 1 日あたり 4.5 件。このペースだと月末は 135 件
・派遣先別（本日／今月）　NHK奈良 3／30・NHK京都 3／28・NHK大阪 0／23
・1 時間あたり 0.26 件（本日の稼働 23.0 時間）
[/info]
```

- 0 件の日は、人別の行を出さず「本日の報告はまだありません」と書く（0 で埋めた表は出さない）
- 名前は `employee_name` をそのまま使う
- `[info][title]…[/title]…[/info]` は Chatwork の記法。既存の `src/lib/chatwork` の送り方に合わせる

### 1-2. LINE の返信

```
NHK訪問業務 集計（2026/09/24 木）

本日の報告 3 人
山田 太郎　NHK奈良　新規2・住所0・口座1＝3件
田中 花子　NHK京都　新規1・住所2・口座0＝3件
佐藤 次郎　NHK大阪　0件

本日の合計 6 件
今月の累計 81 件（1日あたり 4.5 件）
```

- スマホで読むので**短く**。分析は 1 行だけ（1 日あたり）。飾り記号は使わない
- 5000 文字を超えるときは切って「…（以下省略）」を付ける

---

## 2. LINE の受け口

`src/app/api/system/line/webhook/route.ts`（`runtime = "nodejs"`）

- 署名の確認：ヘッダ `x-line-signature` を `LINE_CHANNEL_SECRET` で HMAC-SHA256 → base64 で突き合わせ。合わなければ **401**
- 受け取るできごと
  - `join`（グループに招待された）→ `system_line_target` に記録し、「この部屋で『集計』と送ると、その日の NHK 訪問の集計をお返しします。」と返信
  - `leave` → その行を `active = false`
  - `message`（type が text）→ 合言葉を判定して返信。**当てはまらない言葉には何も返さない**（`null` を返して 200）
- 合言葉（関電の Bot と同じ言い方にそろえる）

  | 送る文字 | 返すもの |
  |---|---|
  | `集計` | 今日 |
  | `昨日の集計` | 昨日 |
  | `20260924集計` `2026-09-24集計` `2026/09/24集計` | その日 |
  | `今月の集計` | 今月の累計だけ |

  判定の正規表現は `/^(\d{4})[-\/]?(\d{1,2})[-\/]?(\d{1,2})\s*集計$/` と、固定の 3 語
- 返信は `https://api.line.me/v2/bot/message/reply`（`LINE_CHANNEL_ACCESS_TOKEN`）。**push は使わない**
- 日付は日本時間で解釈する（UTC のまま数えない）

---

## 3. 集計（`_lib`）

`src/app/system/forms/nhk-visit/_lib/nhk-visit-summary.ts`

- `summarizeDay(rows, date)`：人別（氏名・派遣先・時間・新規/住所変更/口座クレ・合計）＋全体合計＋報告人数
- `summarizeMonth(rows, month)`：人別の合計・全体・報告のあった日数
- `analyze(...)`：
  1. 前日比（前日の合計と差）・前週同曜日比
  2. 今月の 1 日あたり平均（報告のあった日数で割る）と、このペースの月末着地（1 日あたり × 当月の日数）
  3. 派遣先別の合計（本日／今月）
  4. 1 時間あたりの成約数（各報告の 終了−開始 の合計が分母。0 時間なら「—」）
- 割り算の分母が 0 のときは 0 や `—` にする（`Infinity` や `NaN` を出さない）
- 小数は第 1 位まで（四捨五入）

## 4. Chatwork の毎日 20 時

- `src/app/api/system/nhk-visit/daily-report/route.ts`（POST・`CRON_SECRET` の Bearer で守る・`runtime = "nodejs"`）
- `vercel.json` の cron に **毎日 11:00 UTC（＝日本時間 20:00）** を足す
- 送り先：`NHK_REPORT_CHATWORK_ROOM_ID` が無ければ **`CHATWORK_DEV_ROOM_ID`（開発ルーム 433894375）**。**コードに部屋番号を直書きしない**
- 送信は既存の `src/lib/chatwork`（`CHATWORK_API_TOKEN`）を使う
- 同じ日に 2 回送らない（`system_nhk_visit_daily_report_log` に当日の成功があればやめる）
- 手で動かせるように、`?date=2026-09-24` で日付を指定できるようにする（Claude が本番で 1 回試す）

## 5. 置き場所（DB）

新しい migration `supabase/migrations/20260924000002_system_nhk_visit_delivery.sql`

```sql
create table if not exists public.system_line_target (
  id uuid primary key default gen_random_uuid(),
  line_target_id text not null unique,        -- グループ ID
  target_type text not null,                  -- 'group' / 'room' / 'user'
  purpose text not null default 'nhk_visit',
  active boolean not null default true,
  joined_at timestamptz not null default now(),
  left_at timestamptz null
);

create table if not exists public.system_nhk_visit_daily_report_log (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  destination text not null,                  -- 'chatwork:433894375' など
  body text not null,
  succeeded boolean not null,
  error text null,
  created_at timestamptz not null default now()
);
create index if not exists idx_nhk_visit_daily_report_log_date on public.system_nhk_visit_daily_report_log (report_date desc);
```

- どちらも RLS を有効にし、select は `system_nhk_visit_report` と同じ書き方（staff 以上）にする。書き込みは service role だけ

## 6. System ＞ 自動配信に足す

`src/app/system/deliveries/_lib/deliveries-registry.ts` に追加（既存のテストも直す）。

```ts
{
  slug: "nhk-visit-summary",
  name: "NHK訪問 集計配信",
  description: "その日の NHK 訪問業務の集計（人別・合計・月累計・見立て）を Chatwork へ送ります。LINE では「集計」と送ると返信します。",
  schedule: "毎日 20:00",
  recipient: "（テスト中）開発ルーム",
  status: "active",
  statusLabel: "稼働中",
  minRole: "staff",
  icon: "message",
  href: "/system/forms/nhk-visit",
}
```

## 7. テスト（vitest）

- 合言葉の判定（4 種類が当たる／当たらない言葉は `null`／日付の 3 通りの書き方）
- 署名が違えば 401
- 集計：0 件の日・1 人・複数人・月をまたぐ・同じ人が 1 日に 2 回出した場合（両方足す）
- 分析：前日が無い／今月の初日／稼働 0 時間のときに壊れない
- Chatwork の文章の組み立て（見本と同じ形）
- **実際の送信はしない**（`fetch` をモックする）

## 8. 完了条件

1. `npx tsc --noEmit -p .` がエラー 0
2. `npx vitest run src/app/system/forms src/app/api/system` が全部緑
3. **commit も push もしない**
4. 変更したファイルの一覧を完了報告に書く

## 9. 触らないもの

- Codex-349 で作った画面と API（`route.ts` の中身）は変えない。`_lib` に足すのは可
- 既存の migration・`src/lib/chatwork` の既存の関数（足すのは可・既存の中身は変えない）
- 出勤表・給与計算連絡・コール数配信

## 10. 完了報告

```
Codex-350 完了報告
■作ったもの：
■変更したファイル：
■tsc：
■vitest：
■やっていないこと／気づいた点：
```
