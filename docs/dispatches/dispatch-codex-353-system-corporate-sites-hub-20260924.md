# Codex-353 System：「コーポレートサイト」画面の新設（グループ各社の会社HP・商品ページを 1 画面で俯瞰し、サイトへ飛べる）

作成日: 2026-09-24
作業ツリー: C:\garden\a-bloom-008
起点: main の最新（`git log -1` で確認・完了報告に書く）
**git は触らないこと（commit するな）。本番のデータ・DB に触らないこと。開発サーバ・ブラウザを起動しないこと。migration・API・DB は不要（データは同梱の JSON）。触ってよいのは `src/app/system/sites/` 配下（新設）・`src/app/system/_components/ShachoShell/shacho-shell-config.ts`（メニュー 1 行の追加）・それらのテストだけ。**

必ず先に読むもの：
- 手本 1（一覧＋カード＋表示切替）：`src/app/system/forms/page.tsx`・`FormsHubClient.tsx`・`forms.module.css`・`_lib/forms-registry.ts`
- 手本 2（状態バッジ・カードの中の項目表）：`src/app/system/deliveries/DeliveriesHubClient.tsx`・`deliveries.module.css`（`.statusBadge` `.cardDetails`）
- 手本 3（データを TypeScript／JSON で同梱して画面に出す）：`src/app/system/docs/_data/*.ts`・`_lib/*.server.ts`
- 共通：`src/app/system/_components/SystemBreadcrumb/SystemBreadcrumb.tsx`・`ShachoShell.tsx`（`MenuIcon`）・`src/app/system/_components/ShachoShell/shacho-shell-config.ts`（`SYSTEM_MENU_ITEMS`・`SystemIcon`）
- 元データ（正本・Vault）：C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\100_Projects\130_コーポレートサイトVercel集約\011_各社コーポレートサイト一覧.md の末尾「Garden 用データ（JSON）」。**この JSON をそのまま `src/app/system/sites/_data/corporate-sites.json` にコピーして同梱する**（Claude が事前にコピー済み。Codex は中身を変えない・値を書き足さない）

## 0. 何を作るか（東海林さん 2026-09-24）

ヒュアラングループ各社の「会社HP」「商品ページ（LP）」を 1 画面で俯瞰する。各サイトの 稼働状態／URL／ホスティング／リポジトリ／問い合わせフォームの配線（Kintone アプリ・流入元・Chatwork TO）／メール種別／旧サーバー契約 を一覧でき、稼働サイトは URL を押すと新しいタブでサイトへ飛べる。データは同梱 JSON（Vault の JSON を差し替えて Claude が同じファイルを置き換えれば反映）。

- URL：`/system/sites`（社員以上）。左メニュー「コーポレートサイト」（`shacho-shell-config.ts` の `SYSTEM_MENU_ITEMS` に 1 行。位置＝「契約書管理」の次・`icon: "folder"`・`minRole: "staff"`・description「グループ各社の会社HPと商品ページを一覧し、サイトへ飛べます。」）
- 見出し：「コーポレートサイト」。パンくず System ／ コーポレートサイト。ブラウザのタブ題名「コーポレートサイト | Garden」
- 上部に「更新日：2026/09/24（JSON の `as_of`）」と、共通の仕組み（`common` の 3 行：ホスティング／DNS／問い合わせの流れ）を折りたたみ（既定＝閉）で
- **会社ごとにグループ化**（JSON の `company` の出現順）。会社の枠の中で **会社HP → 商品ページ** の順（`kind` が「会社HP」「会社HP+商品」を先、それ以外を後）
- 状態バッジ（`status`）：`live`＝**稼働**（緑・`.active` と同じ色）／`pending_migration`・`restored_pending_migration`・`pending_migration_and_new`＝**移管待ち**（黄：`color-mix(in srgb, #d9a400 16%, transparent)`・文字 `#8a6a00`。ダークでも読める濃さに）／`planned_new`＝**新規作成待ち**（グレー・`.upcoming` と同じ）。`restored_pending_migration` は「移管待ち（原サーバーで稼働中）」と添える
- 稼働サイト（`url` あり）は URL を `<a target="_blank" rel="noopener noreferrer">` で。`url` が無い行はドメインを文字で（`domain` が null なら「ドメイン未定」）
- 「対象外・解約」（`excluded`）は一番下に小さく 1 行ずつ
- 上部右に「一覧／カード」の表示切替（フォームと同じ・localStorage キー `garden.sites.viewMode`・既定＝一覧）

## 1. 画面（一覧表示）

```
 System ／ コーポレートサイト                                   更新日：2026/09/24   [≡][▦]
 コーポレートサイト
 グループ各社の会社HPと商品ページ。稼働中のサイトは URL から開けます。
 ▸ 共通の仕組み（ホスティング・DNS・問い合わせの流れ）                       ← 折りたたみ（既定＝閉）
 ──────────────────────────────────────────────────────────────
 稼働 4 ／ 移管待ち 4 ／ 新規作成待ち 5                                       ← 件数の帯

 ┌ 株式会社ヒュアラン ───────────────────────────────────────────┐
 │ 会社HP     hyuaran.com ↗        ●稼働 2026-09-24〜  M365   Kintone app242 ヒュアラン問い合わせ受付   │
 │            GitHub Hyuaran/hyuaran ／ Vercel hyuaran ／ 流入元 ヒュアラン-HP ／ TO 金亜奈・東海林美琴  │
 │            旧サーバー RS 1713021（年 22,932 円）＝解約予定  ／ 備考：新デザインへ刷新・…          │
 │ 商品ページ SMART BREAKER  denshibreaker.com   ●移管待ち   WordPress  お名前メール（要移行）        │
 │            旧サーバー RS 1877490 ／ 備考：後回し（他デザイン担当者との兼ね合い）                     │
 └───────────────────────────────────────────────────────────────┘
 ┌ 株式会社たいよう ──────────────────────────────────────────────┐
 │ 会社HP     ドメイン未定            ●新規作成待ち   備考：ドメイン要決定                            │
 │ 事業LP     不動産アライアンス  sunsun-taiyou.com ↗  ●稼働 2026-06-03〜  M365  app224 たいよう問い合わせ受付 │
 │ 商品LP     JUST光  just-hikari.com ↗  ●稼働 2026-06-03〜  M365  app225 問い合わせ受付_JUST光（商品）      │
 └───────────────────────────────────────────────────────────────┘
 … ストーンベース／ARATA／株式会社壱／株式会社almalio／リンクサポート／株式会社センターライズ …

 対象外・解約：ms-support-osaka.com（ヒュアラン旧社名・当面残す）／kanden.biz／almalio.net／shopnt.xyz／all-partner.net／arata123.online（失効予定）／internet-hikari.pro（別LP案件）
```

- 1 サイト＝2〜3 行。1 行目＝区分（`kind`・`product` があれば「区分 商品名」）・ドメイン／URL（リンク）・状態バッジ・`live_since`（あれば「YYYY-MM-DD〜」）・メール・Kintone（`kintone_app` があれば「app242 ヒュアラン問い合わせ受付」）
- 2 行目＝GitHub／Vercel／流入元／Chatwork TO（`chatwork_to` を「・」でつなぐ）。無い項目は出さない（「―」で埋めない）
- 3 行目＝旧サーバー（`old_server`：plan・contract・`yen_per_year` があれば「年 n 円」・`action` があれば「＝解約予定」など・`onamae_id` があれば「別ID …」）・備考（`notes` を「・」でつなぐ）
- 会社名は JSON の値をそのまま（「ストーンベース」「ARATA」など株式会社の無いものはそのまま）
- スマホ幅（760px 以下）は 1 行目の項目を縦に積む。文字を横スクロールさせない

## 2. 画面（カード表示）
- 会社ごとの見出しの下に、サイト 1 件＝1 カード（`deliveryCard` と同じ枠）。カードの上段＝区分＋商品名・状態バッジ、中段＝ドメイン（リンク）・稼働日・メール、下段＝`cardDetails` 形式で Kintone／GitHub・Vercel／TO／旧サーバー／備考

## 3. データの形（`_lib/sites-registry.ts`）
- `corporate-sites.json` を import し、型 `CorporateSite`（JSON のキーそのまま。無いキーは optional）と `CorporateSitesData { as_of, common, sites, excluded }` を定義
- `groupSitesByCompany(data)`→ `{ company, sites }[]`（出現順・会社HP 先）／`statusLabel(status)`／`countByStatus(data)`（稼働・移管待ち・新規作成待ち）
- 役職の絞り込みは無し（社員以上は全部見える）

## 4. テスト（vitest・全部緑にしてから完了報告）
- `groupSitesByCompany`：会社 8 つ・出現順・ヒュアランは会社HPが先／たいようは 会社HP → 事業LP → 商品LP
- `statusLabel`：5 種類の status のラベルとバッジの種類
- `countByStatus`：稼働 4・移管待ち 4・新規作成待ち 5
- 画面：会社見出し 8 つ／稼働サイトの URL が `target="_blank"` のリンク／ドメイン未定の行に「ドメイン未定」／「更新日：2026/09/24」／対象外 7 件／表示切替で localStorage に保存
- メニュー：`SYSTEM_MENU_ITEMS` に「コーポレートサイト」（href `/system/sites`・staff）

## 5. 完了報告（コードブロックで・コピーできる形）
- 起点の main のコミット／新規・変更ファイル一覧／テスト本数と結果／tsc・eslint の結果／気づいた点・やり残し
