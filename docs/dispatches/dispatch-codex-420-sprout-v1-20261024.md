# Codex-420：Sprout（採用管理）v1 — 応募者・面接・研修の一覧と［入社予定者へ］（2026-10-24）

## 目的
Garden の採用モジュール Sprout（今は「準備中」の画面だけ）を、使える最初の形にする。
今の採用は Kintone「求人 応募者一覧」（app 44・695 件）と「求人 面接ヒアリングシート」（app 45・425 件）で回っている（バイトル→Kintone の自動登録は宮永さん作・仕様書待ち）。
v1 は **Kintone の 2 アプリを Garden に取り込んで見る**＋**採用した人を［入社予定者へ］で入社の流れ（Codex-418 の `system_hire_candidates`）に渡す**。Kintone へは書き込まない（トークンは閲覧のみ）。
**本番では当面、全権管理者（super_admin）だけが見られる**。

項目一覧（コード・型・選択肢）：`C:\garden\a-bloom-008\docs\dispatches\ref-kintone-recruit-fields-20261024.md`
環境変数：`KINTONE_RECRUIT_APPLICANTS_APP_ID`(44)／`KINTONE_RECRUIT_APPLICANTS_TOKEN`／`KINTONE_RECRUIT_HEARING_APP_ID`(45)／`KINTONE_RECRUIT_HEARING_TOKEN`／`KINTONE_SUBDOMAIN`

## 画面の絵
```
Sprout ／ 採用管理
採用管理                                              Kintone最終取込：2026/10/24(土) 01:30 ↻
[応募者] [面接予定] [研修予定]
 期間［2026年10月 ▼］ 状況［箱＋チェック一覧：①面接未決 … ⑩入社］ 🔍名前・電話で探す
┌───────────────────────────────────────────────────┐
│ 応募日     氏名        年代     応募方法  状況          面接予定日時       研修日      │
│ 2026-10-22 山田 太郎   20～24歳 バイトル  ④▼面接待ち   2026-10-25 14:00   ─          │
└───────────────────────────────────────────────────┘
行を押す → 右（スマホは下）に詳細：基本（氏名・カナ・生年月日・性別・電話・メール・住所）／応募（応募日時・応募方法・理由）／
  希望（勤務可能曜日・働き方・出勤/退勤希望・時給・希望給与・初出勤日希望）／面接（希望日時 1〜3・面接方法・予定日時・Web 面接 URL）／
  研修（研修予定日時・研修日・入社日）／求人の記録（記録の表）／ヒアリングシート（app 45 の同じ人の内容）
  ［入社予定者へ］（状況が ⑧▼研修待ち か ⑩入社 のとき）→ 入社予定者に 姓・名・セイ・メイ・生年月日・性別・入社日（研修日→無ければ入社日）・雇用形態（アルバイト）を入れて作る。
     作ったら「入社予定者に送りました（System ＞ 入社手続き（事務）＞ 入社予定者）」。同じ人を二重に送らない。
［面接予定］タブ：面接予定日時が今日以降の人を日時順。［研修予定］タブ：研修予定日時／研修日が今日以降の人を日時順。
```
- 見た目は社長スタイルの型（`SystemBreadcrumb`・`SystemTabs`・`UpdatedStamp`・`DataTable`・`BoxSelect`・見出し固定）。年度・月の表記は「2026年10月」「2026年度」。Sprout のシェルは Root／Bud の社長スタイルのシェルと同じ作り（左メニュー：採用管理）。

## やること
1. migration `supabase/migrations/20261024000003_sprout_recruit.sql`：
   - `sprout_applicants`（kintone_record_id text 主キー・氏名・カナ・姓名の分割・生年月日・性別・電話・メール・住所・応募日・応募方法・状況・面接予定日時・面接日・研修予定日時・研修日・入社日・年代・その他は `raw jsonb` に丸ごと・kintone_updated_at・imported_at）
   - `sprout_hearing_sheets`（kintone_record_id 主キー・氏名・カナ・電話・raw jsonb・applicant_record_id＝どの応募者か（取り込み時に、app 44 の関連レコード一覧の条件に使われている項目、無ければ氏名＋電話で結ぶ））
   - `sprout_import_runs`（取り込みの記録）
   - RLS：super_admin だけ select。書き込みは管理者側の接続のみ。
2. 取り込み `src/lib/sprout/import.server.ts`：両アプリを全件（500 件ずつ・カーソル API か offset）読み、upsert（部分更新ではなく行ごと置き換えで良い）。Kintone で消えたレコードは Garden でも消す。画面の ↻ で実行（super_admin のみ・二重実行防止）。**cron は足さない**。
3. 画面 `/sprout`（今の ComingSoonPage を置き換え）：上の 3 タブと詳細。super_admin 以外は「準備中です」（今の画面）のまま。
4. ［入社予定者へ］：Codex-418 の `system_hire_candidates` に 1 行作る（status='planned'）。同じ kintone_record_id から作った行があれば作らない（列 `source_applicant_id` を足す migration を同じファイルに入れる）。
5. テスト：取り込みの変換（チェックボックス・日時・サブテーブル）、状況の絞り込み、［入社予定者へ］の二重防止、super_admin 以外は見えない。

## 触らないもの
- `src/app/bud/bank/` 配下。Kintone・本番 DB・Vercel には触らない。**git は触らないでください。コミットは人間側が行います。**

## 確認
`npx tsc --noEmit` と変更範囲の `npx vitest run <対象>`。画面の文言に開発者用語を出さない。

## 完了報告（コードブロックで）
変更・追加ファイル／migration の要点／app 45 と app 44 の結び方／テスト結果／気になった点。
