# Codex-534 NHK訪問業務報告に「再開（解決・収納）」を追加（2026-11-18）

## 背景
営業から依頼：NHK訪問業務報告の「住所変更」の下に「再開」を足したい。中身は 2 つ。

```
5 成約件数
  新規       地上 - 0 +  / 衛星 - 0 +  / 新規 計 n 件
  住所変更   地上 - 0 +  / 衛星 - 0 +  / 住所変更 計 n 件
  再開       解決 - 0 +  / 収納 - 0 +      ← 追加（計の行は出さない：単位が件と口で違う）
  口座・クレ 件数 - 0 +
```

- 解決＝解決件数（単位「件」）、収納＝収納口数（単位「口」）
- **成約の合計（contractTotal・成約_合計）には入れない**。今の合計の計算は変えない
- 過去の報告は 0 として扱う

## やること
1. `src/app/system/forms/nhk-visit/_lib/nhk-visit.ts`
   - `NhkVisitCounts` に `resumeResolved` `resumeCollected` を追加
   - `buildNhkVisitReportMessage`：住所変更の行の下に `　■再開　解決${n}件、収納${n}口` を追加
   - `calculateNhkVisitTotals` の contractTotal は変えない
2. `src/app/system/forms/nhk-visit/NhkVisitClient.tsx`（スマホ `/m/nhk` も同じ部品）
   - 住所変更と口座・クレの間に「再開」のまとまり（既存の countGroup と Stepper）。ラベル「解決」「収納」
   - 直近 1 週間の一覧：`住所n・再開 解決n/収納n・口座n` の形で足す
   - 送信の body に 2 つを含める。画面ごとに css を書かない（既存の部品だけ）
3. `src/app/api/system/nhk-visit/route.ts`
   - countKeys・ValidInput・検証（0 以上の整数）に追加。古い画面から来た送信で値が無い場合は 0 として受ける
   - insert：列 `resume_resolved` `resume_collected`
   - Kintone：項目コード `再開_解決` `再開_収納`（数値）
   - 直近 1 週間を返す select に列を足す
4. `src/app/system/forms/nhk-visit/_lib/nhk-visit-summary.ts`（＋ .server.ts の select）
   - 人ごと・本日の合計・人数 0 件の行に `再開 解決n・収納n` を足す（Chatwork 版・LINE 版の両方）。今月の累計・見立ては今のまま（成約件数のみ）
   - 人ごとの行：成約 0 件でも再開があれば数字を出す
5. migration `supabase/migrations/20261118000534_nhk_visit_resume.sql`
   - `resume_resolved integer not null default 0`, `resume_collected integer not null default 0`、0 以上の check（add column if not exists／制約は drop if exists → add）
   - 本番への適用は Claude がやる。あなたは書くだけ
6. テスト：既存の nhk-visit 関連テスト（`_lib/*.test.ts`・`NhkVisitClient.test.tsx`・`api/system/nhk-visit/**/route.test.ts`・`m/nhk/page.test.tsx`）を新しい形に合わせて直し、再開の追加分のテストを足す。`npx vitest run` で該当を緑に、`npx tsc --noEmit` でエラーなし

## 守ること
- **git 操作禁止（commit・add・push・checkout すべて）**
- **ブラウザ・computer-use・画面操作は禁止**
- **本番 DB・Kintone・Vercel・Chatwork への書き込み禁止**（migration はファイルを書くだけ）
- 改行は LF のまま（CRLF にしない）。関係ないファイルは触らない
- 画面の文字はきちんとした日本語。開発者用語を画面に出さない

## 報告
`docs/dispatches/report-codex-534-nhk-visit-resume-20261118.md` に、変えたファイル・テスト結果・気になった点を書く。
