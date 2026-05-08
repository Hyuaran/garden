# main- No. 43 dispatch - a-bloom-003 /bloom サブナビ 404 + garden-home アイコン 4 枚 broken 修正 - 2026-05-05

> 起草: a-main-012
> 用途: 5/8 デモ向け 6 画面レビューで 🔴 優先 2 項目検出 → 修正依頼
> 番号: main- No. 43
> 起草時刻: 2026-05-05(火) 16:53
> 緊急度: 🔴 5/8 デモ向け（3 日前、Bloom 中心デモのため最優先）

---

## 投下用短文（東海林さんが a-bloom-003 にコピペ）

~~~
🔴 main- No. 43
【a-main-012 から a-bloom-003 への dispatch（/bloom サブナビ 404 + garden-home アイコン 4 枚 broken 修正）】
発信日時: 2026-05-05(火) 16:53

a-main-012 が 5/8 デモ向け 6 画面レビューを実施。🔴 優先 2 項目修正依頼。

【検出した問題】

# 1: /bloom React のサブナビ 2 件が 404（🔴 最優先、Bloom 中心デモのため）

| URL | HTTP code |
|---|---|
| /bloom/workboard | 200 ✅ |
| /bloom/daily-report | **404** ❌ |
| /bloom/monthly-digest | 200 ✅ |
| /bloom/ceo-status | **404** ❌ |

→ /bloom React 本番のサイドバーに 4 つのサブメニュー link があるが、daily-report と ceo-status の Next.js page が不在 or routing 設定不備。

# 2: /_proto/garden-home の Bloom 配下アイコン 4 枚 broken（🔴 見た目悪化）

| 画像 path | 状態 |
|---|---|
| public/_proto/garden-home/images/icons_bloom/bloom_workboard.png | 404 ❌ |
| public/_proto/garden-home/images/icons_bloom/bloom_ceostatus.png | 404 ❌ |
| public/_proto/garden-home/images/icons_bloom/bloom_dailyreport.png | 404 ❌ |
| public/_proto/garden-home/images/icons_bloom/bloom_monthlydigest.png | 404 ❌ |

→ garden-home の Bloom orb 内 or 近傍に 4 枚アイコン参照、画像不在。Chrome MCP で `naturalWidth === 0` で確認済。

【修正依頼】

### # 1 対応

a-bloom-003 で /bloom サブナビの実装状況を確認:

1. `src/app/bloom/daily-report/page.tsx` 存在確認、無ければ作成
2. `src/app/bloom/ceo-status/page.tsx` 存在確認、無ければ作成
3. それぞれ既存の workboard / monthly-digest と同等の最低限実装（プレースホルダーでも可、デモで遷移するだけ）
4. proto に `_proto/dailyreport/` `_proto/ceostatus/` 等が既存ならば、React 版で iframe 埋め込み or リダイレクトでも可

判断基準: デモ中に後道さんがサイドバーから「日報」「経営状況」をクリックして 404 にしないこと。

### # 2 対応

a-bloom-003 で:

1. `public/_proto/garden-home/index.html` 内の broken 画像参照箇所を確認（`images/icons_bloom/bloom_*.png`）
2. 既存の `public/_proto/bloom-top/images/` 等から流用可能な画像があれば copy or symlink
3. 流用画像なし → 暫定的にテキスト表示 + コメント残す or 既存の他アイコン流用
4. 画像不要なら参照削除（CSS / HTML）

判断基準: garden-home を開いた時に broken 画像のアイコンが表示されないこと（壊れた画像アイコンが見えない）。

【検証フロー（a-main-012 が再実施）】

修正後 push 受領 → Chrome MCP で:
1. /bloom/daily-report HTTP 200 + ページ表示
2. /bloom/ceo-status HTTP 200 + ページ表示
3. /_proto/garden-home/ 開いて画像 broken 0 確認

【削除禁止ルール】

新規 page.tsx 追加 + garden-home 修正それぞれ legacy 保持:
- src/app/bloom/daily-report/page.tsx は新規ファイルなので legacy 不要
- src/app/bloom/ceo-status/page.tsx も同上
- public/_proto/garden-home/index.legacy-icon-broken-fix-20260505.html

【完了報告フォーマット】

bloom-003- No. 27 で:
- commit hash + push 状態
- # 1 の解決方針（新規 page 作成 / 既存からの copy / iframe / 等）+ 各ファイル
- # 2 の解決方針 + 修正対象画像 path
- 検証 HTTP code（/bloom/daily-report, /bloom/ceo-status）+ broken 画像数
- legacy 保持ファイル一覧
- 完了時刻

【dispatch counter】

a-main-012: 次 main- No. 44
a-bloom-003: bloom-003- No. 27 で完了報告予定

工数見込み: 30〜45 分（page 2 件 新規 + garden-home 画像参照修正）

ご対応お願いします。
~~~

---

## 5/8 デモ向け 6 画面レビュー全体メモ（後続課題）

| # | 優先度 | 内容 | 対応 |
|---|---|---|---|
| 1 | 🔴 | /bloom/daily-report 404, /bloom/ceo-status 404 | **本 dispatch # 1** |
| 2 | 🔴 | garden-home Bloom アイコン 4 枚 broken | **本 dispatch # 2** |
| 3 | 🟡 | garden-home orb 11 個 dead `href="#"` | デモ運用回避 or post-デモ |
| 4 | 🟡 | spin bubble 12 個中 Bloom 以外 dead | デモ運用回避 or post-デモ |
| 5 | 🟡 | /bloom (React) /leaf 404 | post-デモ |
| 6 | 🟡 | /_proto/bloom-top サブナビ壊れた相対 path（4 件）| post-デモ |
| 7 | 🟢 | /bloom (React) 2 回目以降 renderer freeze 傾向 | デモは新規タブ運用で回避 |

## 改訂履歴

- 2026-05-05 16:53 初版（a-main-012、5/8 デモ向け 6 画面レビュー後の 🔴 優先 2 項目）
