# main- No. 15 dispatch（v2 訂正版） - a-bloom-002 Bloom 専用 Sidebar 新規実装 + 全差分洗い出し - 2026-05-02

> 起草: a-main-010
> 用途: 認識訂正版。Bloom 専用 Sidebar 新規実装（既存 Garden Sidebar とは別物） + 全差分洗い出し
> 番号: main- No. 15
> 起草時刻: 2026-05-02(土) 16:11
> 改訂: v1（16:02）→ v2（16:11、認識訂正後）

---

## 投下用短文（東海林さんが a-bloom-002 にコピペ）

~~~
🔴 main- No. 15 (v2 訂正版)
【a-main-010 から a-bloom-002 への dispatch（Bloom 専用 Sidebar 新規実装 + 全差分洗い出し）】
発信日時: 2026-05-02(土) 16:11

東海林さんから claude.ai 試作版（02_BloomTop/index.html）のスクショ受領、
認識訂正があります。

【認識訂正（重要）】

旧認識（誤）:
  D1「A プロト準拠 = Sidebar 削除」
  → main- No. 14 で <Sidebar /> 撤去 → サイドバー消失

新認識（正、東海林さんスクショで確認）:
  claude.ai 試作版には **Bloom 専用 Sidebar あり**（折り畳み可能）
  - 展開時: Garden Series ロゴ + 各モジュールアイコン + 名前ラベル（Bloom / Forest / Tree / Soil / Leaf / Bud / Root 等）
  - 折り畳み時: モジュールアイコン列のみ（細い縦バー）
  - 切替: 折り畳みボタン（境界に矢印）

→ Bloom 専用 Sidebar = Garden 全モジュール navigation。既存 v2.8a Garden Home Sidebar とは別物。

【依頼 1: Bloom 専用 Sidebar 新規実装】

旧依頼: サイドバー復活（既存 v2.8a Garden Sidebar 復活）← 誤り
新依頼: **claude.ai 試作版の Bloom 専用 Sidebar を新規実装**

実装内容:
- 左側 Sidebar component 新規作成（or BloomLayoutClient 内に組み込み）
- 展開状態: Garden Series ロゴ + モジュールアイコン + ラベル（リスト）
- 折り畳み状態: アイコン列のみ
- 折り畳みボタン（境界の矢印）でトグル
- localStorage で状態永続化（D7 と同パターン）
- prototype: 015_Gardenシリーズ/000_GardenUI_bloom/02_BloomTop/index.html (v1.4) のサイドバー実装を参照

NG 2（Coming Soon Toast）と NG 3（bg-click-zone 非表示）は **そのまま維持**。

commit + push（feature/bloom-6screens-vercel-2026-05 ブランチ）。

【依頼 2: 全差分洗い出し（既存 vs claude.ai 試作）】

実装後（or 並行）に、既存 vs claude.ai 試作の全差分洗い出しをお願いします。

比較対象:
- 既存実装（依頼 1 反映後）: src/app/bloom/page.tsx + 関連 component + globals.css の bloom-page CSS
- claude.ai 試作版: 015_Gardenシリーズ/000_GardenUI_bloom/02_BloomTop/index.html (v1.4) + css + js

東海林さん追加指摘（重要、優先確認）:
- ヘッダーの内容（ロゴ / タイトル / 通知 / Help / Favorite / User dropdown 等）
- アバター押したときの挙動（dropdown 内容）
- Sidebar 折り畳み挙動（依頼 1 で実装済の場合は OK 確認）
- ActivityPanel 折り畳みトグル
- Topbar 温度表示
- その他全要素

成果物（出力先: _chat_workspace\garden-bloom\diff_analysis\）:

1. chat-bloom-top-diff-overview-20260502.md
   - 全差分項目のリスト（D1, D2, D3 ... 形式）
   - 各項目に「既存」「claude.ai 試作」「視覚的差分」を 1 行で

2. chat-bloom-top-diff-screenshots-20260502.md
   - 既存と claude.ai 試作のスクショ並列
   - 各差分項目に注釈（矢印 + コメント）
   - 画面全体スクショ + 部分拡大スクショ

3. chat-bloom-top-diff-recommendation-20260502.md
   - 各差分に a-bloom-002 の推奨（A 取り込み / B 既存維持 / C その他）
   - 推奨理由（業務影響 / デザイン継承 / 実装コスト 等）

【視覚判断材料の提示方法（重要）】

memory feedback_shoji_visual_judgment_required.md 準拠:
- 文字説明だけでは東海林さん判断不能
- スクショ + 注釈 + 並列比較が必須
- 14 件以上の文字差分一覧は禁止

【Turbopack HMR 注意】

memory feedback_turbopack_hmr_globals_css_unreliable.md 参照。
globals.css 大量変更時は HMR 信用せず、dev server 再起動 + .next キャッシュクリア必須。

【完了報告期待】

Step 1（Bloom 専用 Sidebar 新規実装）完了 → 即報告（commit hash + push 状態）
Step 2（全差分洗い出し）完了 → 報告（成果物 path + 主要差分サマリ）

報告は v4 ヘッダー形式（bloom-002- No. NNN）で。

【dispatch counter】

a-main-010: 次 main- No. 16
a-bloom-002: bloom-002- No. 8 で Step 1 報告予定、bloom-002- No. 9 で Step 2 報告予定

ご対応お願いします。
~~~

---

## 配布手順（東海林さん）

| Step | 内容 |
|---|---|
| 1 | 上記 ~~~ 内をコピー |
| 2 | a-bloom-002 / Garden Bloom 002 セッションに貼り付け投下 |

→ a-bloom-002 が即 Bloom 専用 Sidebar 実装 + 全差分洗い出し。

## 改訂履歴

- 2026-05-02 v1 初版（16:02、サイドバー復活と表現）
- 2026-05-02 v2 訂正版（16:11、東海林さんスクショで認識訂正、Bloom 専用 Sidebar 新規実装が正解）
