# 設計書：Root の法人情報を会社HP・商品LP に自動反映し、お知らせも自動で出す

- 作成日: 2026-09-26
- 決定者: 東海林さん（2026-09-26「全部OK」＝お知らせは自動公開／反映項目は法人名・代表者・所在地・電話／商品LP のフッターも同じ仕組み）
- 位置づけ: この文書が設計の正。実装は Codex-356（Garden 側）と Codex-357（各サイト側）の 2 本に分ける

---

## 0. 一言でいうと

**Root の法人マスタで法人名・代表者・所在地・電話を直して保存すると、各社の会社HP（と商品LP のフッター）の表示が次にページを開いたときに新しくなり、サイトの「お知らせ」に「本店移転のお知らせ」などが自動で載る。** サイトを作り直す作業も、7 つのリポジトリへの手作業も要らない。

## 1. 仕組みの全体（4 つの部品）

```
 Root 法人マスタ（root_companies）
   │ 保存（Root 画面／将来の Kintone 同期でも同じ）
   ▼
 ① DB のトリガー：変わった項目を見て「お知らせ」を自動で 1 行作る（system_site_news）
   │
   ▼
 ② 公開窓口（Garden の API・読むだけ・公開情報のみ）
     GET https://garden-os.net/api/public/company/<slug>
     → { 法人名, 代表者, 所在地, 電話, 設立日, 更新日, お知らせ[最新 10 件] }
   │  CORS 許可（*）・5 分キャッシュ
   ▼
 ③ 各サイトの差し込み（共通の 1 ファイル garden-company.js を Garden から配信）
     ページを開く → 窓口を読む → 印（data-garden="…"）の箇所だけ書き換え
     お知らせ欄（data-garden-news）に最新を並べる。取れなければ何もしない（今の文字のまま）
   ▲
 ④ Garden のコーポレートサイト画面に「お知らせ」の管理（見る・直す・非公開・手で追加）
```

## 2. 正本と反映項目

- 正本＝**Root の法人マスタ**（`root_companies`）。Kintone 法人名簿 → Root の同期は今は手動（2026-08-28 に 1 回）なので、**法人情報は Root で直す**運用。Kintone を正にしたくなったら同期を毎朝にする（別件）
- 反映する項目（4 つ）と JSON の名前

| Root の列 | 公開名 | サイトの印 | 例（ヒュアラン） |
|---|---|---|---|
| company_name | company_name | `data-garden="company_name"` | 株式会社ヒュアラン |
| representative | representative | `data-garden="representative"` | 後道 翔太 |
| address | address | `data-garden="address"` | 〒541-0054 大阪府大阪市中央区南本町2-6-12　サンマリオンタワー地上2階西号室 |
| phone | phone | `data-garden="phone"` | 06-4400-5414 |
| established_on | established_on | `data-garden="established_on"`（表示だけ・お知らせは作らない） | 2016年4月8日 |

- **注意（表記）**：サイトは Root の値を**そのまま**表示する。今のヒュアラン HP は「サンマリオンタワー 2F」と書いてあるが、反映後は Root の「地上2階西号室」になる。表示を変えたいときは Root の住所を直す（サイト用の別欄は作らない＝二重管理を避ける）
- 公開してよい情報だけを窓口に出す（法人番号・FAX・口座・代表者の住所や生年月日は**出さない**）

## 3. お知らせの自動生成（部品 ①）

- 表 `system_site_news`（新設）

| 列 | 内容 |
|---|---|
| id | uuid |
| company_id | root_companies.company_id（COMP-001 …） |
| published_on | date（既定＝今日・日本時間） |
| title | 題名 |
| body | 本文（改行可） |
| kind | `auto` ／ `manual` |
| source_field | 自動のとき、元になった列（company_name／representative／address） |
| is_published | boolean 既定 true（自動公開） |
| created_by / created_at / updated_at | 記録 |

- **トリガー**（`root_companies` の update 後）：変わった列ごとに 1 行作る。同日に同じ列の変更が複数回あれば、その日の行を**上書き**（連打で何件も出さない）

| 変わった列 | 題名 | 本文（定型） |
|---|---|---|
| address | 本店移転のお知らせ | このたび、{法人名}は下記へ本店を移転いたしました。\n新所在地：{新住所}\n電話番号：{電話}\n今後ともよろしくお願い申し上げます。 |
| representative | 代表取締役変更のお知らせ | このたび、{法人名}は代表取締役が{新代表者}に就任いたしました。\n今後ともよろしくお願い申し上げます。 |
| company_name | 社名変更のお知らせ | このたび、{旧社名}は{新社名}に社名を変更いたしました。\n今後ともよろしくお願い申し上げます。 |
| phone | （お知らせは作らない。表示だけ変わる） | |

- 生成した文面は Garden の画面（部品 ④）で直せる。取り下げは `is_published=false`
- RLS：読み＝公開窓口は service role で読む（匿名の直接読みは不可）。書き＝manager 以上（Garden の画面から）

## 4. 公開窓口（部品 ②）

- `GET /api/public/company/[slug]`（Next.js Route Handler・nodejs・`dynamic = "force-dynamic"` だが `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`）
- slug ↔ company_id の対応はコードの表（`src/app/api/public/company/_lib/slugs.ts`）

| slug | company_id | 会社 |
|---|---|---|
| hyuaran | COMP-001 | 株式会社ヒュアラン |
| centerrise | COMP-002 | 株式会社センターライズ |
| link-support | COMP-003 | 株式会社リンクサポート |
| arata | COMP-004 | 株式会社ARATA |
| taiyou | COMP-005 | 株式会社たいよう |
| ichi | COMP-006 | 株式会社壱 |
| stonebase | COMP-007 | 株式会社ストーンベース |

- 返す JSON

```json
{
  "slug": "hyuaran",
  "company_name": "株式会社ヒュアラン",
  "representative": "後道 翔太",
  "address": "〒541-0054 大阪府大阪市中央区南本町2-6-12　サンマリオンタワー地上2階西号室",
  "phone": "06-4400-5414",
  "established_on": "2016-04-08",
  "updated_at": "2026-09-26T01:00:00+09:00",
  "news": [ { "id": "…", "published_on": "2026-09-26", "title": "本店移転のお知らせ", "body": "…" } ]
}
```

- `news` は `is_published=true` を `published_on` の新しい順に最新 10 件
- CORS：`Access-Control-Allow-Origin: *`・`OPTIONS` に対応。認証なし（公開情報のみ）。未知の slug は 404
- 無効化した法人（`is_active=false`）は 404

## 5. サイト側の差し込み（部品 ③）

- Garden が配信する共通ファイル：`https://garden-os.net/garden-company.js`（`public/garden-company.js`・約 3KB・依存なし）
- 各ページの `<head>` 末尾に 1 行：`<script src="https://garden-company.js の URL" data-company="hyuaran" defer></script>`
- 印の付け方
  - 文字の差し替え：`<span data-garden="address">〒541-0054 …（今の文字）</span>`。`established_on` は `data-garden-format="ja"` で「2016年4月8日」に整形
  - お知らせ：`<div data-garden-news data-garden-news-limit="5"><template>…1 件分の雛形（{{published_on}} {{title}} {{body}} を置換）…</template>（今のお知らせ）</div>`。雛形が無ければ既定の `<article>` 3 行（日付・題名・本文）を使う。**ヒュアラン HP のカード式スライダー**は既存のカード 1 枚分を `<template>` に写して、そのデザインのまま並べる
- 振る舞い：取得成功→印の箇所を書き換え、お知らせ欄の中身を入れ替える。失敗（Garden 停止・ネット断）→**何もしない**（今の文字のまま）。同じ内容なら DOM を触らない
- 反映のタイミング：窓口のキャッシュが 5 分なので、Root で保存してから**最長 5 分**で全サイトに反映

## 6. Garden の画面（部品 ④）

- 場所：System ＞ コーポレートサイト（`/system/sites`）に **「お知らせ」タブ**（既存のグリッド／リストの切替とは別の上段タブ）
- 中身：会社を選ぶ → その会社のお知らせ一覧（日付・題名・自動／手動・公開／非公開）→ ［追加］［編集］［非公開にする］。自動生成の行は「自動（住所の変更）」と分かる印
- 権限：見る＝社員以上（コーポレートサイト画面と同じ）、直す・追加・非公開＝**責任者（manager）以上**
- API：`/api/system/sites/news`（GET 一覧／POST 追加／PATCH 編集・公開切替）。書き込みは manager 以上・監査ログ（`writeAudit`）に残す
- 会社ごとのカードに「お知らせ n 件（最新：本店移転のお知らせ 2026-09-26）」を 1 行足す（見る人が気づけるように）

## 7. 反映先のページ（Codex-357 の対象）

| 会社 | ページ | リポジトリ | 会社情報の欄 | お知らせ欄 |
|---|---|---|---|---|
| ヒュアラン | https://hyuaran.com/ | Hyuaran/hyuaran（site/index.html） | あり（co-row） | あり（カード式スライダー） |
| センターライズ | https://centerrise.co.jp/ | Hyuaran/centerise | 確認して印付け | 無ければ簡素な欄を足す |
| ARATA | https://arata123.co.jp/ | Hyuaran/arata | 同上 | 同上 |
| リンクサポート | https://link-support-osaka.com/company/ と /（LP フッター） | Hyuaran/link-support | 同上 | 会社HP 側だけ |
| たいよう | https://sunsun-taiyou.com/company/ と /（LP フッター）、just-hikari.com（フッターに社名・住所があれば） | Hyuaran/sunsun-taiyou・Hyuaran/just-hikari | 同上 | 会社HP 側だけ |
| 壱 | https://ichi-one.com/company と Ichi光ページのフッター | Hyuaran/ichi | 同上 | 会社HP 側だけ |
| ストーンベース | https://stone-base.jp/ | Hyuaran/stonebase | 同上 | 無ければ足す |

- 各サイトは Claude が Chrome で実物を見て「会社情報の欄」と「お知らせ欄」の場所を特定し、印を付けて main へ push（Vercel が自動配備）。1 サイトずつ本番で「Root の値どおりか」「お知らせが出るか」を確認
- 商品LP（denshibreaker・ara-ta・uchinowannyannet）は移管待ちのため対象外。移管したときに同じ印を付ける

## 8. 安全と落とし穴

- 公開窓口は**公開してよい 5 項目＋お知らせだけ**を返す。Root のほかの列（法人番号・口座・代表者の個人情報）は絶対に出さない。テストで「返るキーがこの 6 つだけ」を固定する
- サイトの JS は Garden 停止時に**何もしない**（既存の文字が残る）。エラーを画面に出さない
- お知らせのトリガーは**同日同列は上書き**。Root の「保存」を試し押ししてもお知らせが増えない
- 住所の表記は Root が正（§2）。サイトに合わせて Root を崩さない
- キャッシュ 5 分：確認は 5 分待つか、`?nocache=1` で窓口を直接開いて値を見る
- 監査：お知らせの手動編集は `writeAudit`。自動生成は `system_site_news.kind=auto` で分かる

## 9. テスト

- Garden：トリガー（住所変更→1 行・同日再変更→上書き・電話だけ→0 行）／窓口（キー固定・未知 slug 404・無効法人 404・CORS ヘッダ）／お知らせ API（manager 未満 403・編集で updated_at）／画面（一覧・追加・非公開）
- サイト：`garden-company.js` の単体テスト（印の差し替え・お知らせの雛形置換・失敗時に無変更）
- 本番：Root でヒュアランの電話を一時的に変えて戻す（お知らせは作られない）→ hyuaran.com で表示が変わる／戻る。お知らせは手動で 1 件追加→表示→非公開→消えるを確認（テストの行は削除）

## 10. 進め方

1. **Codex-356（Garden 側）**：migration（表・トリガー）／公開窓口／`public/garden-company.js`／お知らせ API と画面／テスト
2. Claude 検品 → 本番 → 窓口を Chrome で確認
3. **Codex-357（サイト側・1 リポジトリずつ）**：まずヒュアラン HP。Claude が印の場所を指示書に絵で示す → push → 本番確認 → 残り 6 社を同じ手順で
4. 資料 5 点セット（コーポレートサイト）に「お知らせ」と「自動反映」を追記
