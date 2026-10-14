# Codex-377：出勤表・シフトLINE連絡テキスト生成の小直し 3 件（並びの［外す］が保存されない／LINE「連携」の案内が 1 日 2 回返る／［もう一度］が全員に送り直す）（2026-10-14）

## 目的
マニュアル作成時のコード点検で見つかった 3 件（Claude がコードで確認済み）を直す。画面の見た目・文言は変えない。

## 作業場所・禁止事項
- 作業ツリー：`C:\garden\a-bloom-008`。**git の操作は一切しない**（commit・branch・checkout・stash 禁止。コミットは人間側）
- 触ってよいのは次の 6 ファイルとそのテストだけ：
  - `src/app/api/system/shukkin/members/route.ts`（＋ `route.test.ts`）
  - `src/app/api/system/line/staff/webhook/route.ts`（＋ `route.test.ts`）
  - `src/app/system/forms/shukkin/_components/LineSendDialog.tsx`（＋ テストがあれば）
- 触らない：`.env.local`・`vercel.json`・`scripts/**`・`supabase/migrations/**`（表は変えない）・`src/app/api/system/shukkin/line-send/route.ts`（送信 API は変えない）・`ShukkinClient.tsx`（画面の作りは変えない）
- **前から落ちているテスト（`KpiCard` 2 本・`BackgroundCarousel` 5 本・`AppHeader` 5 本）は触らない。通すために `src/app/_lib/kpi-fetchers.ts`・`src/components/shared/garden-view/BackgroundCarousel.tsx`・`src/app/_components/AppHeader.tsx` を変えない**
- 本物の外部サービス（LINE・Supabase 本番）は呼ばない（テストは偽の fetch／偽の client）。長い説明は不要・ファイルは必要な範囲だけ読む

## 直す 3 件

### 1. 並びの設定で［外す］した人が保存されない
- 現状：`PUT /api/system/shukkin/members`（`members/route.ts`）は送られてきた `rows` を `upsert`（`onConflict: "employee_number"`）するだけ。画面（`ShukkinClient.tsx` の `removeMember`）は外した人を**配列から消して**送るので、外した人の行は `active=true` のまま残り、`GET`（`active=true` で絞る）で戻ってくる
- 直し方：`PUT` で upsert のあと、**送られてきた `employee_number` に含まれない行を `active=false`** にする（`system_shukkin_member` を `.update({ active: false, updated_by })` ＋ `.not("employee_number", "in", "(…)")`。送られた番号が 0 件なら全員 `active=false` にしてよいが、`rows` が空配列のときは 400 のまま＝今の `normalizeMembers` の判定を変えない）
- 戻り値は従来どおり `active=true` の並び（無効にした行は返さない）
- 注意：Supabase の `.not("col","in", …)` の書き方は既存コードで使われている形に合わせる（`in.(a,b)` の括弧形式）。無ければ「全行取得→差分を update」でもよい。番号は 4 桁ゼロ埋めで比べる

### 2. 「連携 社員番号」の案内が同じ日に 2 回返ることがある
- 現状：`webhook/route.ts` の 151 行目付近 `shouldReply = !String(pending?.last_seen_at).startsWith(todayJstDate())`。`last_seen_at` は `new Date().toISOString()`＝**UTC** の文字列、`todayJstDate()` は **日本の日付**。日本時間 0〜9 時は UTC の日付が前日なので一致せず、同じ日に 2 回案内を返す
- 直し方：`last_seen_at` を **日本の日付に変換してから**比べる（`new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",…})` で `last_seen_at` を日付文字列にする小関数を作り、`todayJstDate()` と同じ形で比較）。保存する値（ISO）は変えない
- テスト：`last_seen_at` が UTC で前日 23:30（＝日本の今日 8:30）のとき案内を返さない／UTC で 2 日前のとき返す

### 3. 一部に送れなかったあとの［もう一度］が、届いた人にも送り直す
- 現状：`LineSendDialog.tsx` の `send()` は常に `blocks` 全員分を `POST /api/system/shukkin/line-send` に送る。`state === "failed"` で `result.failed`（送れなかった人の `employeeNumber`・`shift`）があっても絞っていない
- 直し方：`state === "failed"` かつ `result?.failed?.length > 0` のときの送信は、**`result.failed` に含まれる `employeeNumber` だけ**を各まとまりの `employeeNumbers` に入れて送る（該当者がいないまとまりは送らない）。初回送信（`state === "confirm"`）と、API 自体が失敗（`!response.ok`・`result` なし）したあとの［もう一度］は従来どおり全員
- 送れた人の表示（`sent`）は、2 回目の結果で**上書きせず足す**（1 回目に届いた人＋2 回目に届いた人）。`failed` は 2 回目の結果で置き換える
- 文言・ボタン・レイアウトは変えない

## テスト（vitest）
- `members/route.test.ts`：外した人が `active=false` になる／残った人は従来どおり／空配列は 400 のまま
- `webhook/route.test.ts`：上の 2 ケース
- `LineSendDialog`：テストファイルが無ければ `LineSendDialog.test.tsx` を新設（一部失敗→［もう一度］で fetch の body の `employeeNumbers` が失敗者だけ／初回は全員）
- 既存テスト（`src/app/system/forms/shukkin/**`・`src/app/api/system/shukkin/**`・`src/app/api/system/line/**`）は緑のまま。**KpiCard・BackgroundCarousel・AppHeader の 12 本は前から落ちている＝対象外**

## 完了報告（コードブロックで。東海林さんがそのまま読む）
1. 変えたファイル一覧（新規／変更）
2. `npx tsc --noEmit` と `npx vitest run src/app/system/forms/shukkin src/app/api/system/shukkin src/app/api/system/line` の結果（件数）
3. 迷った点・決め打ちした点
