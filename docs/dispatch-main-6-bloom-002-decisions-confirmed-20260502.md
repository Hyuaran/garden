# main-6 dispatch - a-bloom-002 判断 1-3 確定 + 既存実装情報共有 - 2026-05-02

> 起草: a-main-010
> 用途: bloom-002-2 dispatch（判断仰ぎ 3 件）への確定回答
> 番号: main-6
> 起草時刻: 2026-05-02(土) 09:48

---

## 投下用短文（東海林さんが a-bloom-002 にコピペ）

~~~
⭐ main-6
【a-main-010 から a-bloom-002 への dispatch（判断 1-3 確定 + 既存実装情報共有）】
発信日時: 2026-05-02(土) 09:48

bloom-002-2 受領、東海林さん判断確定 + 既存実装の追加情報を共有します。

【統合判断 確定版】

判断 1: 画面 6 (GardenUI Home) → B 案（差分のみ反映）
  → A は不採択。理由: claude.ai 試作版にデザインのこだわり要素あり、それを殺さない
  → C も不採択。理由: 既実装の dark fix（4/28-5/1 の 7 段階 dispatch で解決した
    backdrop-filter 復活）を捨てるリスク + Next.js 化二重作業

判断 2: URL path スキーマ → 提案通り採用、ただし既存実装あり画面は扱い注意

判断 3: 実装ペース → A 案（画面 1 単独先行 → 確認 → 残り 4 画面）

【既存実装情報（a-main-010 が事前確認、重要）】

| claude.ai 試作版 | 既存 Next.js 実装 path | 状態 | 採用方針 |
|---|---|---|---|
| 1. Bloom Top | src/app/bloom/page.tsx | シンプルタイル画面 | 置換 OK |
| 2. Workboard | src/app/bloom/workboard/page.tsx | フル機能実装済（Supabase 連携、複数 component）| **デザイン差分のみ反映、ロジック維持** |
| 3. DailyReport | （未実装）| 新規追加 |
| 4. MonthlyDigest | src/app/bloom/monthly-digest/page.tsx | 既存 | デザイン差分反映 |
| 5. CEOStatus | （未実装）| 新規追加（super_admin 専用）|
| 6. GardenUI Home | src/app/page.tsx | 既実装 v2.8a (commit 9a7f8d5) | **B 案: diff 取り → 差分反映** |

【着手順序（推奨）】

Step 0: 画面 6 GardenUI Home の diff 取り（B 案準備）
  - 015_Gardenシリーズ/000_GardenUI/index.html (試作版 609 行) と
    src/app/page.tsx (既実装 v2.8a) の diff を取る
  - 差分項目をリスト化して a-main-010 に報告
  - 東海林さんが「これは取り込みたい / これは既実装維持」を確定 → 実装

Step 1: 画面 1 (Bloom Top) 単独先行実装（推奨優先順 1）
  - src/app/bloom/page.tsx を chat-ui-bloom-top-20260501 ベースに置換
  - v2.8a 構成流用 + Bloom 固有 OrbGrid 4 枚 + Bloom 専用背景 2 種
  - 見積 2-3h
  - commit + push → 東海林さん視覚確認

Step 2: 画面 1 OK 後、Step 0 報告を受けて画面 6 差分反映実装
  - 東海林さん確定差分を src/app/page.tsx に適用
  - dark fix 維持確認必須
  - commit + push → 東海林さん視覚確認

Step 3: 残り 4 画面を順次実装
  優先順 3: 画面 2 Workboard → デザイン差分のみ反映（既存ロジック維持厳守）
  優先順 4: 画面 4 MonthlyDigest → デザイン差分反映
  優先順 5: 画面 3 DailyReport → 新規実装
  優先順 6: 画面 5 CEOStatus → 新規実装（super_admin 専用、認証連動）

各画面ごとに commit + push + 東海林さん視覚確認

Step 4: Vercel デプロイ環境構築（5 画面完了後）
  - feature/bloom-6screens-vercel-2026-05 ブランチをプレビュー環境に接続
  - 認証: 社内 PC 限定推奨（東海林さんと最終確認）

Step 5: Supabase 連携
  - Bloom 用テーブル設計（既存 Tree 用テーブル群との整合確認）
  - 必要に応じて新規 Bloom テーブル新設
  - migration ファイル作成

【🔴 重要注意 (Workboard)】

src/app/bloom/workboard/page.tsx は既にフル機能実装済：
- WorkerStatusCard / TodayPlanList / WeeklyAchievement / RunningProjectCard / NextMilestoneCard
- daily-log-queries / mutations / status-queries
- Supabase 連携済

→ claude.ai 試作版の HTML/CSS で「上書き」厳禁。
→ デザイン要素（CSS / 配置 / アニメーション）のみ反映、ロジック・component 構造は維持。
→ Workboard 着手前にも diff 取り推奨（差分の妥当性確認）。

【判断保留事項（必要時 a-main-010 経由で東海林さんに仰ぐ）】

- 各画面の Next.js 実装中、既存実装と試作版で衝突発生時の優先判断
- Supabase テーブル設計の正本起草（東海林さん確認必要）
- Vercel プレビュー環境の認証設定詳細

【完了報告期待】

各 Step 完了時に a-main-010 に報告（v3 ヘッダー形式 + 接頭辞 bloom-002）。
Step 0 (画面 6 diff 取り) の結果を最初に共有してください。

【関連 memory】

- project_post_5_5_tasks.md（5/5 後着手タスク一覧、Bloom 系 6 画面 #2 として登録）
- feedback_dispatch_header_format.md（v3 ヘッダー形式）

【dispatch counter】

a-main-010: 次 main-7

ご対応お願いします。
~~~

---

## 配布手順（東海林さん）

| Step | 内容 |
|---|---|
| 1 | 上記 ~~~ 内をコピー |
| 2 | a-bloom-002 / Garden Bloom 002 セッションに貼り付け投下 |

→ 投下完了したら教えてください。

## 改訂履歴

- 2026-05-02 初版（main-6、bloom-002-2 への確定回答 + 既存実装情報共有）
