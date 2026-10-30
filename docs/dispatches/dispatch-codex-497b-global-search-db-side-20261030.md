# Codex-497b Garden 全体の検索を速くする（DB の中で絞る・2026-10-30）

作業場所：C:\garden\a-bloom-008（main）
**git は触らない（add / commit / push / checkout / stash すべて禁止）。** migration は `supabase/migrations/` にファイルを置くだけ（**当てない**。当てるのは Claude）。
**ファイルは UTF-8。日本語を書いたら読み直して「?」に化けていないことを確かめる。**

## 問題
Codex-497 の検索（`src/lib/search/search.server.ts`）は、検索のたびに 53 の表（`src/lib/search/catalog.ts` の `SEARCH_SOURCES`）の行を 1,000 行ずつ**全部読み出して**から JS で絞っている。本番で 1 回 **18 秒**（決まりは 2〜3 秒以内・目標 1 秒以内）。

## 直し方
1. **migration**（`supabase/migrations/20261030000497_search_text.sql`）：`SEARCH_SOURCES` の表ごとに、生成列 `search_text text generated always as (...) stored` を足す。
   - 中身＝その source の `fields`（と `title`）の列だけを `concat_ws(' ', ...)` でつなぐ。JSON の列は catalog の `select`（`payload->paid` 等）と同じキーだけを `->>` で取る。**秘密の欄（catalog に無い列）は絶対に入れない。**
   - 正規化：`lower(normalize(..., NFKC))`。数字はカンマを外した形も一緒に入れる（`regexp_replace(x, '[,，]', '', 'g')` を同じ文字列に足す）。電話（`phone: true`）はハイフンを外した形も足す。日付・日時の列は `YYYY-MM-DD` と `YYYY/MM/DD` の両方を足す（`to_char`）。数値・日付の列は `::text` にしてから。
   - 生成列の式は IMMUTABLE である必要がある。使えない関数（`to_char` が timestamptz で不可など）は、IMMUTABLE な自前の SQL 関数（`search_norm(text)` など・`immutable` 宣言）を作って通す。
   - 同じ表を複数の source（タブ違い）が使う場合は、列の和集合で 1 本。
   - 索引：`create index ... using gin (search_text gin_trgm_ops)`（pg_trgm は入っている）。
   - `soil_list_phone` には足さない。表が無い・列が無いものは足さない（catalog と実 DB を突き合わせる：`.tmp_chk.mts` と同じやり方）。
2. **検索の処理**：表ごとに `select(必要な列).ilike("search_text", "%正規化した検索語%").limit(21)` で **DB の中で絞る**（今の 1,000 行ずつ全部読む処理をやめる）。検索語の正規化は生成列と同じ（NFKC・小文字・カンマを外す。電話・日付の揺れは生成列側に両方入っているので検索語はそのまま）。`%` `_` `\` はエスケープ。
   - 権限・本人条件・状態の条件（`client` ごとの `eq`/`in`/`is` と RLS）は**今のまま**。
   - 返ってきた行で今の `rowHit`（どの欄に当たったか・太字の位置・並び）を使う。
   - `bud_mf_accounts` の見える口座の絞り込みも今のまま（行が少ないので全件読みのままでよい）。
3. 速さの目標：1 回の検索が本番で **1 秒以内**。表ごとの読み出しは並べて行う（今のまま `Promise.all`）。

## テスト
- `search.server.test.ts`：ilike で絞った結果を使う／権限の条件が付く／秘密の列を select しない。
- migration の SQL を文法チェック（可能なら式に使う関数が IMMUTABLE であること）。
- `npx tsc --noEmit` と `npx vitest run src/lib/search src/app/api/search src/app/_components/search`。

## 終わったら
`docs/dispatches/report-codex-497b-global-search-db-side-20261030.md`（UTF-8）に：migration の中身の要約（表ごとの列）・当てる順番の注意・テスト結果。
