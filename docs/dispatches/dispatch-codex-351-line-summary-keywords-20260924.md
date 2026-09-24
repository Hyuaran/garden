# Codex-351：LINE の合言葉を「業務名つき」に変え、部屋ごとに使える集計を決める

作成日: 2026-09-24
作業ツリー: C:\garden\a-bloom-008（main）
※ Codex は git を触らない。**commit も push もしない**
前提: Codex-350（LINE の受け口・NHK訪問の集計）が本番で動いている

---

## 0. なぜ直すか（東海林さん 2026-09-24）

いまの合言葉は `集計`・`20260924集計`・`昨日の集計`・`今月の集計` で、**NHK 訪問業務だけを前提**にしている。
これから同じ仕組みを**ほかの業務（関電・コール数・管理表 など）でも使う**ので、このままだと部屋をまたいで混ざる。

**決まったこと**
- **`集計` 単体は使用不可**（何も返さない）
- 合言葉は**業務名を頭に付ける**：`NHK集計`
- **部屋ごとに「使える集計」を決める**。その部屋に登録されていない集計は、打っても返さない（別部署の数字が出る事故を防ぐ）

---

## 1. 新しい合言葉

| 打つ言葉 | 返すもの |
|---|---|
| `NHK集計` | 今日の分 |
| `NHK集計 昨日` | 昨日の分 |
| `NHK集計 20260924`（`2026-09-24` `2026/09/24` も可） | その日の分 |
| `NHK今月` | 今月の累計 |
| `合言葉` | **その部屋で使える合言葉の一覧**（下記） |
| 上記以外（`集計` 単体を含む） | **何も返さない**（200 を返して終わり） |

- 業務名と合言葉の間の空白は、**半角・全角どちらでも可**。空白なし（`NHK集計20260924`）も受ける
- 大文字小文字は区別しない（`nhk集計` も可）
- `合言葉` の返事の例（その部屋に NHK 訪問だけが登録されている場合）

```
この部屋で使える合言葉

NHK集計　　今日の集計
NHK集計 20260924　　その日の集計
NHK今月　　今月の累計
```

## 2. 集計の種類を 1 か所にまとめる

`src/app/api/system/line/webhook/_lib/summary-registry.ts`（新規）

```ts
export type LineSummaryKind = "day" | "month";

export type LineSummaryDefinition = {
  /** 業務の合い言葉の頭（例：NHK） */
  keyword: string;
  /** 画面や一覧に出す名前（例：NHK訪問業務） */
  name: string;
  /** その日の集計と今月の集計を作る */
  buildDay: (date: string) => Promise<string>;
  buildMonth: (month: string) => Promise<string>;
};

export const LINE_SUMMARIES: LineSummaryDefinition[] = [ /* NHK だけ */ ];
```

- **次の業務を足すときは、この配列に 1 つ足すだけ**で合言葉も一覧も増える形にする
- NHK の中身は Codex-350 の `nhk-visit-summary` をそのまま使う（作り直さない）

## 3. 部屋ごとの登録

`system_line_target` に列を足す migration `supabase/migrations/20260924000003_system_line_target_summaries.sql`

```sql
alter table public.system_line_target
  add column if not exists summary_keywords text[] not null default array['NHK']::text[],
  add column if not exists label text null;              -- 「Garden開発ルーム（検証用）」など人が読む名前
```

- `join` で新しく入った部屋は、いまは既定で `['NHK']` にする（当面 NHK しか無いため）
- 判定：**その部屋の `summary_keywords` に入っている業務の合言葉だけ**に反応する
- `合言葉` の一覧も、その部屋に入っている業務だけを出す
- 部屋が未登録（`system_line_target` に無い）のときは、**何も返さない**

## 4. 触る場所

- `src/app/api/system/line/webhook/_lib/line-keyword.ts`：合言葉の解釈を作り直す（業務名＋種別＋日付）。既存のテストも直す
- `src/app/api/system/line/webhook/route.ts`：部屋の登録を読み、その部屋で使える集計だけを返す
- 文面そのもの（`nhk-visit-summary.ts`）は**変えない**

## 5. テスト（vitest）

- `NHK集計`／`nhk集計`／`NHK集計 昨日`／`NHK集計 20260924`／`NHK集計 2026-09-24`／`NHK今月` が正しく解釈される
- **`集計` 単体・`20260924集計`・`昨日の集計`・`今月の集計` は「該当なし」**（返さない）
- 部屋に `NHK` が入っていなければ `NHK集計` でも返さない
- `合言葉` でその部屋の一覧が返る／部屋が未登録なら返さない
- 署名が違えば 401（既存のまま）

## 6. 完了条件

1. `npx tsc --noEmit -p .` がエラー 0
2. `npx vitest run src/app/api/system src/app/system/forms` が全部緑
3. **commit も push もしない**
4. 変更したファイルの一覧を完了報告に書く

## 7. 完了報告

```
Codex-351 完了報告
■作ったもの：
■変更したファイル：
■tsc：
■vitest：
■やっていないこと／気づいた点：
```
