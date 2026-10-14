# Codex-379b：Codex-379 の仕上げ＝合流の照合（退職の同名行で上書きされる）／内線の登録が無い人は「-」／本文の空行／抜けているテスト 2 本（2026-10-14）

## 目的
Codex-379（`docs/dispatches/dispatch-codex-379-call-metrics-lp-columns-20261014.md`）の成果を Claude が手元の dev と本番 DB で確かめ、次の 4 点を見つけた。直す。指示書 379 の決まり（禁止事項・前から落ちているテスト・文言・社長スタイル）はそのまま。

## 作業場所・禁止事項
- 作業ツリー：`C:\garden\a-bloom-008`。**git の操作は一切しない**。`vercel.json`・`.env.local`・`supabase/migrations/**`・`src/lib/innovera/**`・`src/app/api/system/innovera-ingest/**`・`src/app/root/**` は触らない
- **前から落ちているテスト（`KpiCard` 2 本・`BackgroundCarousel` 5 本・`AppHeader` 5 本）は触らない。`src/app/_lib/kpi-fetchers.ts`・`src/components/shared/garden-view/BackgroundCarousel.tsx`・`src/app/_components/AppHeader.tsx` を変えない**
- 本物の外部サービスは呼ばない。長い説明は不要・ファイルは必要な範囲だけ読む
- 注意：Claude が `src/app/system/_lib/lp-kintone.ts` の `loadLpScope` を直してある（239 の回線 ID は子テーブル `lines`〈子 `circuit_id`〉から読む・`BIZ_FIELDS` に `lines`）。**この直しは戻さない**

## 直す 4 点

### 1. 合流の人の照合で、退職の同名行に上書きされる（`call-metrics-merge.ts`）
- 現象：Root に「石原　孝志朗」が 2 行（在籍 EMP-1523・内線 2003／退職 EMP-1384・内線なし・`is_active=false`）。`rootByName`／`rootByFmName` の `Map` は後の行で上書きされ、退職の行に当たって INNOVERA の数字（LP応答 8・LP発信 27）が付かない。API（`src/app/api/system/call-metrics/route.ts` 18 行目）は `is_active`・`deleted_at` を select しているのに絞っていない
- 直し方：`mergeCallMetrics` で `Map` を作るとき **在籍の行（`is_active !== false` かつ `deleted_at` が null）を優先**し、在籍の行が無いときだけ退職の行を使う（退職の行しか無い人も名前は合わせられるように）。`resolveEmployeeIdForCallMetrics` も同じ優先順に。`RootEmployeeForCallMetrics` 型に `is_active?`・`deleted_at?`・`innovera_extension?`・`innovera_mobile_extension?` を足す（API はもう select している）。`call-report/route.ts`・`call-report/cron/route.ts` の Root の読み取りも同じ列を select しているか確かめ、足りなければ足す
- テスト：同名 2 行（在籍＋退職）で在籍に付く／退職の行しか無いときはその行

### 2. 内線の登録が無い人は 0 でなく「-」（§5.5.5・「-」と 0 の区別）
- 現象：今日（10/14）の表で、Root に固定の内線が無く日ごとの内線も無い人（大塚さん等）の通話時間が `0:00:00` と出る。仕様＝**Root に内線の登録が無い人の通話時間・LP応答・LP発信・LP通話時間は「-」**。0 は「内線の登録はあるが期間に通話が無い」とき
- 直し方：`mergeCallMetrics` の 4 列は ①`hasRows=false` → null ②INNOVERA の行がある（固定でも日ごとでも付いた）→ その値 ③INNOVERA の行が無く、Root の `innovera_extension`／`innovera_mobile_extension` のどちらかがある → 0 ④どちらも無い → null。LP申込みは kintone から出すのでこの規則の対象外（kintone が読めないときだけ null）
- 画面・PDF は null を「-」で出す（既存の `nullableN` の扱いを確かめる）。テスト：②③④の 3 通り

### 3. 配信本文の【WEBインバウンド】の前の空行が 2 行（`call-report.ts`）
- 現象：`前確OK率…\n` のあとに `buildLpBlock` が `\n\n【WEBインバウンド】` を返すので空行が 2 行になる（preview の実測＝`（前確OK4件）\n\n\n【WEBインバウンド】`）
- 直し方：空行は **1 行**（`…件）\n\n【WEBインバウンド】\n…`）。`[/title]` 直後の改行なしはそのまま。テストの期待値も直す

### 4. 抜けているテスト（379 の指示書で求めたが作られていない）
- `src/app/system/_lib/lp-kintone.test.ts`：`loadLpScope`（239 の偽レコード＝`lines` 子テーブルの `circuit_id` から回線 ID・`status in ("稼働中")`・読めないとき null）／`loadLpCustomerRecords`（アプリごとの対応状況のコード＝235 は `status`・1 回失敗→3 秒後にやり直し→null）／`countLpApplications`（JST の日付境界・担当者名の空白除去・「-」は担当者未設定）
- `src/app/system/_lib/call-metrics-merge.test.ts`：§13 の内線別の表（石原 2003／小泉 2011／藤木 2006／南薗 2034／宮永 2005）を偽データにして 19 列の値／FileMaker に無い人は LP が 1 以上のときだけ／「（内線未登録）n席」／上の 1・2 の規則
- 偽の fetch／偽の `getRecords` で。本物は呼ばない

## テスト（vitest）
- 上の各項目＋既存テスト（`src/app/system/**`・`src/app/api/system/call-metrics/**`・`src/app/api/system/call-report/**`・`src/lib/kintone/**`）は緑のまま。**KpiCard・BackgroundCarousel・AppHeader の 12 本は対象外**

## 完了報告（コードブロックで。東海林さんがそのまま読む）
1. 変えたファイル一覧（新規／変更）
2. `npx tsc --noEmit` と `npx vitest run src/app/system src/app/api/system/call-metrics src/app/api/system/call-report src/lib/kintone` の結果（件数）
3. 迷った点・決め打ちした点
