# Codex-356 Garden 側：法人情報の公開窓口・お知らせの自動生成と管理・サイト差し込み用の共通 JS

作成日: 2026-09-26
作業ツリー: C:\garden\a-bloom-008
起点: main の最新（`git log -1` で確認・完了報告に書く）
**git は触らないこと（commit するな）。本番のデータ・DB に触らないこと（migration はファイルを書くだけ・適用は Claude）。開発サーバ・ブラウザを起動しないこと。触ってよいのは下の「触るファイル」だけ。**

必ず先に読むもの：
- **設計書（正）**：C:\garden\a-bloom-008\docs\superpowers\specs\2026-09-26-corporate-sites-company-sync-design.md（§2〜§6・§8・§9）
- 法人マスタ：`src/app/root/_lib/queries.ts`（`upsertCompany`）・`src/app/root/companies/page.tsx`（保存と `writeAudit`）・`src/app/root/_lib/audit.ts`
- 権限ヘルパ：`src/app/system/mypage/_lib/submission-server.ts`（`requireStaff`／`requireManager`）
- 既存のコーポレートサイト画面：`src/app/system/sites/`（`SitesHubClient.tsx`・`sites.module.css`・`_lib/sites-registry.ts`・`_data/corporate-sites.json`）
- cron 認証ではなく**公開**の API の前例は無い。`src/app/api/system/nhk-visit/route.ts` を Route Handler の書き方の手本に
- migration の書き方：`supabase/migrations/20260924000001_system_nhk_visit_report.sql`（表・RLS・索引）

## 0. 作るもの（4 つ）

### A. migration `supabase/migrations/20260926000001_system_site_news.sql`
1. 表 `public.system_site_news`：`id uuid pk default gen_random_uuid()`／`company_id text not null references public.root_companies(company_id)`（`company_id` が unique でなければ `id uuid` を参照し、コード側で変換する。**どちらにしたかを完了報告に書く**）／`published_on date not null default (now() at time zone 'Asia/Tokyo')::date`／`title text not null`／`body text not null default ''`／`kind text not null check (kind in ('auto','manual'))`／`source_field text`（auto のとき company_name|representative|address）／`is_published boolean not null default true`／`created_by text`／`created_at`／`updated_at`（トリガーで更新）。索引：`(company_id, published_on desc)`
2. RLS：有効。**select／insert／update は service role のみ**（匿名・authenticated には policy を作らない＝API 経由だけ）
3. トリガー `system_site_news_from_company_change`（`after update on public.root_companies` for each row）：
   - `new.address is distinct from old.address` → title「本店移転のお知らせ」・body「このたび、{new.company_name}は下記へ本店を移転いたしました。\n新所在地：{new.address}\n電話番号：{new.phone}\n今後ともよろしくお願い申し上げます。」・source_field `address`
   - `representative` が変わった → 「代表取締役変更のお知らせ」「このたび、{new.company_name}は代表取締役が{new.representative}に就任いたしました。\n今後ともよろしくお願い申し上げます。」
   - `company_name` が変わった → 「社名変更のお知らせ」「このたび、{old.company_name}は{new.company_name}に社名を変更いたしました。\n今後ともよろしくお願い申し上げます。」
   - `phone` だけの変更は何もしない
   - **同日（日本時間）・同じ company_id・同じ source_field・kind='auto' の行が既にあれば update（title／body／updated_at）**、無ければ insert。`created_by='system:root_companies'`
   - 空→値、値→NULL も「変わった」とする（`is distinct from`）

### B. 公開窓口 `src/app/api/public/company/[slug]/route.ts`
- `GET`：`slug` → `_lib/slugs.ts` の表（設計書 §4）で `company_id` に変換。無ければ 404 `{ ok:false, error:"not_found" }`。`root_companies` を service role で読み、`is_active=false` も 404
- 返す JSON は**この 8 キーだけ**：`slug`／`company_name`／`representative`／`address`／`phone`／`established_on`／`updated_at`／`news`（`is_published=true` を `published_on desc, created_at desc` で最大 10 件。各 `{ id, published_on, title, body }`）。**ほかの列は絶対に返さない**（テストでキー集合を固定）
- ヘッダ：`Access-Control-Allow-Origin: *`／`Access-Control-Allow-Methods: GET, OPTIONS`／`Cache-Control: public, s-maxage=300, stale-while-revalidate=600`／`Content-Type: application/json; charset=utf-8`。`OPTIONS` は 204 で同じ CORS ヘッダ。`?nocache=1` のときは `Cache-Control: no-store`
- `export const runtime = "nodejs"; export const dynamic = "force-dynamic";`
- 認証なし（公開情報のみ）。レート制限は付けない（Vercel の CDN キャッシュで受ける）

### C. サイト差し込み用の共通 JS `public/garden-company.js`（依存なし・ES2017・3KB 程度・`"use strict"`）
- 読み込み：`<script src="https://garden-os.net/garden-company.js" data-company="hyuaran" defer></script>`。自分の `<script>` 要素の `data-company` を読む（`document.currentScript` が無ければ `script[data-company]` を探す）。`data-endpoint` があればそれを窓口 URL の元にする（既定 `https://garden-os.net/api/public/company/`）
- `DOMContentLoaded` 後に `fetch(endpoint + slug, { mode: "cors", credentials: "omit" })`。失敗・非 200・JSON でない → **何もしない**（console.warn 1 行だけ）
- 文字の差し替え：`[data-garden]` の要素ごとに、`data-garden` の値（company_name／representative／address／phone／established_on）のキーが JSON にあり、文字列が今の `textContent` と違えば `textContent` を置き換える。`established_on` は `data-garden-format="ja"` なら「2016年4月8日」に整形（それ以外は YYYY-MM-DD のまま）。`phone` の要素が `<a href="tel:…">` なら `href` も直す
- お知らせ：`[data-garden-news]` の要素ごとに、`data-garden-news-limit`（既定 5）件を `news` から取る。要素の中に `<template>` があれば、その中身の `{{published_on}}`／`{{published_on_ja}}`（2026年9月26日）／`{{title}}`／`{{body}}`（改行は `<br>`）を置換した HTML を件数分つなげ、`<template>` 以外の子要素を消してから差し込む。`<template>` が無ければ `<article class="garden-news-item"><time>YYYY.MM.DD</time><h3>title</h3><p>body</p></article>` を使う。`news` が 0 件なら**何もしない**（既存の表示を残す）。**置換は textContent／`<br>` だけ＝HTML を差し込まない**（XSS を作らない）
- 同じ JSON を 1 回だけ取る（印が複数あっても fetch は 1 回）。`window.GardenCompany = { refresh() }` を公開（デバッグ用）
- 単体テスト：`src/app/api/public/company/_lib/garden-company.test.ts` から `public/garden-company.js` を jsdom で読み込んで動かす（印の差し替え／テンプレ置換／失敗時に無変更／established_on の整形）。jsdom は既存のテスト環境のものを使う

### D. お知らせの管理（API と画面）
- API `src/app/api/system/sites/news/route.ts`：`GET ?company_id=`（社員以上・公開／非公開とも一覧）／`POST`（manager 以上・`{ company_id, published_on, title, body }`・kind=manual・`created_by`=氏名）。`src/app/api/system/sites/news/[id]/route.ts`：`PATCH`（manager 以上・`title`／`body`／`published_on`／`is_published` の部分更新・`update().eq()` を使う（upsert は使わない））。書き込みは `writeAudit`（action `site_news_update`・targetType `system_site_news`）
- 画面：`/system/sites` に上段タブ「サイト一覧｜お知らせ」を足す（既存のグリッド／リスト切替は「サイト一覧」タブの中に残す。URL `?tab=news`）。お知らせタブ＝会社の選択（設立順・株式会社付き・`corporate-sites.json` の会社順と同じ）→ 表（日付｜題名｜種別（自動／手動）｜公開｜［編集］）→ ［追加］。編集・追加はフォーム画面と同じ枠のモーダル（題名・日付・本文（複数行）・公開チェック）。manager 未満はボタンを出さない（見るだけ）
- サイト一覧タブの各会社の小見出しの右に「お知らせ n 件（最新：題名 YYYY-MM-DD）」を薄い文字で（`GET` の結果から。0 件は「お知らせ なし」）
- 見た目は社長スタイル（既存の `sites.module.css`・`forms.module.css` の部品）。絵文字は使わない

```
 System ／ コーポレートサイト
 コーポレートサイト
 [ サイト一覧 ] [ お知らせ ]                                           ← 上段タブ
 ──────────────────────────────────────────────
 会社 [株式会社ヒュアラン ▼]                                   [＋ 追加]
 ┌ 日付        │ 題名                     │ 種別 │ 公開 │        ┐
 │ 2026-09-26  │ 本店移転のお知らせ        │ 自動 │ ●   │ [編集] │
 │ 2026-09-10  │ 夏季休業のお知らせ        │ 手動 │ ●   │ [編集] │
 │ 2026-08-01  │ （非公開）採用情報を更新   │ 手動 │ ○   │ [編集] │
 └──────────────────────────────────────────────┘
```

## 1. 触るファイル
- `supabase/migrations/20260926000001_system_site_news.sql`（新規）
- `src/app/api/public/company/[slug]/route.ts`・`src/app/api/public/company/_lib/slugs.ts`・`…/_lib/public-company.ts`（読み出し・整形）＋テスト
- `public/garden-company.js`（新規）＋ `src/app/api/public/company/_lib/garden-company.test.ts`
- `src/app/api/system/sites/news/route.ts`・`[id]/route.ts` ＋テスト
- `src/app/system/sites/SitesHubClient.tsx`・`sites.module.css`・`_lib/sites-registry.ts`（slug を `corporate-sites.json` から引けるように `public_slug` を型に足す。JSON 自体は Claude が `public_slug` を追記済み）・新規 `_components/SiteNewsPanel.tsx`（お知らせタブ）＋テスト
- `src/app/system/sites/page.tsx`（お知らせタブ用に role を渡す）

## 2. テスト（vitest・全部緑にしてから完了報告）
- 窓口：既知 slug → 8 キーだけ（`Object.keys` を固定）／未知 slug 404／`is_active=false` 404／CORS ヘッダ／`OPTIONS` 204／news は公開分だけ・10 件まで・新しい順
- お知らせ API：staff の POST は 403／manager の POST で kind=manual／PATCH は部分更新（渡さない列が消えない）／writeAudit が呼ばれる
- garden-company.js：上記 C の 4 項目
- 画面：タブ切替／会社選択で一覧／manager 未満にボタン無し／サイト一覧の会社見出し右に「お知らせ n 件」
- migration は SQL の文法チェックまで（`supabase` CLI は無いので、`;` の区切りと `$$` の対応を目視）。トリガーの動作は Claude が本番適用後に確認

## 3. 完了報告（コードブロックで・コピーできる形）
- 起点の main のコミット／新規・変更ファイル／テスト本数と結果／tsc・eslint の結果
- `system_site_news.company_id` を text（company_id）と uuid（id）のどちらで参照したか
- 気づいた点・やり残し
