# main-7 dispatch - a-bloom-002 ワークフロー修正（Step 1 先行 + Step 0 保留）- 2026-05-02

> 起草: a-main-010
> 用途: bloom-002-3 dispatch（差分 14 件報告）への確定回答（修正版）
> 番号: main-7
> 起草時刻: 2026-05-02(土) 10:04

---

## 修正経緯

a-bloom-002 から bloom-002-3 で 14 件差分項目を文字ベース報告 → a-main-010 が東海林さんに文字判断仰ぐ → 東海林さん率直 FB「**実際の画面みてみないと何言ってるか不明だわ**」→ ワークフロー修正。

## 投下用短文（東海林さんが a-bloom-002 にコピペ）

~~~
⭐ main-7
【a-main-010 から a-bloom-002 への dispatch（ワークフロー修正：Step 1 先行 + Step 0 保留）】
発信日時: 2026-05-02(土) 10:04

bloom-002-3 受領、ただし **ワークフロー修正** あり。

【東海林さん率直 FB】
「実際の画面みてみないと何言ってるか不明だわ」

文字 14 件差分判断は不可。実物見ないと判断できないとのこと。

【修正フロー（推奨案 1 採用、東海林さん承認済 2026-05-02 10:04）】

Before: Step 0（差分判断）→ Step 1（画面 1 実装）→ Step 2（画面 6 反映）
After:  **Step 1（画面 1 実装）→ 視覚確認 → Step 0（差分判断、実物見ながら）→ Step 2（画面 6 反映）**

【新 Step 1: 画面 1 (Bloom Top) 単独先行実装 即着手 OK】

1. 015_Gardenシリーズ/000_GardenUI_bloom/02_BloomTop/index.html (480 行) を参照
2. src/app/bloom/page.tsx を chat-ui-bloom-top ベースに置換
3. v2.8a 構成流用 + Bloom 固有 OrbGrid 4 枚 + Bloom 専用背景 2 種
4. 既存 Bloom Top（シンプルタイル画面）は別名退避（src/app/bloom/page-old-tile-20260502103000.tsx 等で）→ ファイル削除厳禁
5. commit + push（feature/bloom-6screens-vercel-2026-05 ブランチ）
6. a-main-010 に完了報告（v3 ヘッダー形式）

【新 Step 0: 画面 1 完了後の画面 6 差分判断準備】

画面 1 完了 + 東海林さん視覚確認 OK 後：

1. プロト HTML を Chrome で開く方法を東海林さんに案内
   例: file:///G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/015_Gardenシリーズ/000_GardenUI/index.html
   または: エクスプローラーで右クリック → プログラムから開く → Chrome

2. 既実装 localhost:3000 を別タブで開く（dev server 稼働中、PID 15668）

3. 14 件の差分項目を **画面の該当箇所スクショ + 注釈** で a-main-010 経由で東海林さんに提示
   - 大差項目 D1-D9: スクショ + 「ここがプロト / ここが既実装」注釈
   - 中差項目 D10-D14: スクショ + 簡潔注釈
   - 各項目に「ここをプロト採用 / ここは既実装維持」の選択ボタン的な提示

4. 東海林さんが視覚判断 → 確定差分を a-bloom-002 に伝達 → 実装

【🔴 重要 注意事項】

注意 1: ファイル削除厳禁
  - bloom-002-3 で「個別 Coming Soon ページ 11 削除可」とありますが、
    Garden ルール「ファイル削除厳禁」に抵触します。
  - 必ず「別名退避」（_YYYYMMDDHHMMSS バックアップ）してください。

注意 2: Workboard デザイン差分反映時も同様
  - src/app/bloom/workboard/page.tsx は既存フル機能（Supabase 連携、複数 component）
  - 上書き厳禁、デザイン CSS のみ反映、ロジック・component 構造維持

注意 3: 文字判断 NG ルール（恒久ルール化）
  - memory feedback_shoji_visual_judgment_required.md 参照
  - 今後の UI / デザイン判断は実物提示が必須
  - 14 件差分文字一覧等は禁止

【次のアクション順】

1. Step 1: 画面 1 (Bloom Top) 実装 開始（即着手 OK、東海林さん視覚確認待ち）
2. Step 0: 画面 1 完了後、画面 6 差分判断材料準備（スクショ + 注釈方式）
3. Step 2: 画面 6 (GardenUI Home) 差分反映実装
4. Step 3: 残り 4 画面（Workboard デザイン差分 → MonthlyDigest デザイン差分 → DailyReport 新規 → CEOStatus 新規）

【完了報告期待】

Step 1 (画面 1 実装) 完了時に a-main-010 に報告（v3 ヘッダー形式 + 接頭辞 bloom-002）。
東海林さんに localhost:3000/bloom 視覚確認の依頼を併記してください。

【関連 memory】

- feedback_shoji_visual_judgment_required.md（本日新規追加、実物判断必須）
- feedback_dispatch_header_format.md（v3 ヘッダー形式）
- project_post_5_5_tasks.md（Bloom 6 画面 Next.js 化 #2）

【dispatch counter】

a-main-010: 次 main-8

ご対応お願いします。
~~~

---

## 配布手順（東海林さん）

| Step | 内容 |
|---|---|
| 1 | 上記 ~~~ 内をコピー |
| 2 | a-bloom-002 / Garden Bloom 002 セッションに貼り付け投下 |

## 改訂履歴

- 2026-05-02 初版（main-7、bloom-002-3 への確定回答 修正版）
