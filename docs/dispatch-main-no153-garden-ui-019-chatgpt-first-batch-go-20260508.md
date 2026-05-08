# dispatch main- No. 153 — Garden UI 019 へ ChatGPT 背景画像生成 第一弾着手 GO

> 起草: a-main-015
> 用途: 作業日報セッション (Garden UI 019) への ChatGPT 第一弾着手通知（Bud v2 + Forest v1 揃った）
> 番号: main- No. 153
> 起草時刻: 2026-05-08(金) 18:14

---

## 投下用短文（東海林さんが Garden UI 019 にコピペ）

~~~
🟢 main- No. 153
【a-main-015 から 作業日報セッション(Garden UI 019) への dispatch（ChatGPT 背景画像生成 第一弾着手 GO）】
発信日時: 2026-05-08(金) 18:14

# 件名
Forest v1 + Bud v2 参照スクショ揃った 🏆 — ChatGPT 背景画像生成 第一弾着手 GO（report- No. 17 (a) 判断準拠）

# 状況確定: 参照素材 揃いました

| 画像 | 配置先 | 状態 |
|---|---|---|
| Bud v2 損益管理（PL）スクショ | _reference/garden-bud/bud-v2-pl-screenshot.png | ✅ 配置済（5/8 15:25、384.2K、1920x1080）|
| Bud v2 給与管理 | _reference/garden-bud/bud-v2-payroll-screenshot.png | ✅ 配置済（B 系、362.5K）|
| Bud v2 振込明細 | _reference/garden-bud/bud-v2-transfer-screenshot.png | ✅ 配置済（B 系、362.1K）|
| Bud v2 経費入力 | _reference/garden-bud/bud-v2-expense-screenshot.png | ✅ 配置済（B 系、378.4K）|
| **Forest v1 メイン画面** | _reference/garden-forest/forest-v1-screenshot.png | ✅ **配置済（5/8 18:10、360.9K、1920x1080）**|
| **Forest v1 全体俯瞰（fullpage）** | _reference/garden-forest/forest-v1-fullpage-screenshot.png | ✅ **配置済（5/8 18:10、836.7K、1920x3000）**|

# report- No. 17 (a) 判断採用 → 第一弾着手 GO

東海林さん判断 (a) Forest v1 到着待ち = **本タイミングで第一弾着手 GO**。

# 二段階運用 確認

| 段階 | 対象 | 含まれる素材 | タイミング |
|---|---|---|---|
| **第一弾**（本 GO） | **Bud + Forest 統一世界観** | Bud v2 PL / Forest v1 メイン + fullpage（計 6 枚）| 即着手 |
| 第二弾 | Bloom も加えた全モジュール統一世界観 | + Bloom v9 unified ホームページ + Bloom 法人アイコン 6 件 | Bloom 判断確定後（main- No. 150 KK + NN 案完走後）|

# Garden UI 019 がやること

## 第一弾着手（即実施可、東海林さんから ChatGPT への投下用テキスト起草）

1. **`_reference/garden-bud/`** + **`_reference/garden-forest/`** の参照画像を読み込み
2. ChatGPT への投下用プロンプト テキスト起草:
   - 「Garden Series 統一世界観の背景画像生成依頼」スタイル
   - Bud v2 と Forest v1 の **共通要素** を抽出して世界観の核を定義
   - 東海林さんの design preferences 準拠（ボタニカル水彩、温かみ・絵本的、精緻系）
   - 出力フォーマット指定（PNG / SVG / 解像度等）
3. 起草プロンプトを 1 メッセージで a-main-015 経由 / 東海林さん直接 のどちらでも OK
4. 完走報告（report- No. 18）で a-main-015 へ「第一弾プロンプト spec 起草完了」と報告

## 配置先（東海林さんが ChatGPT で生成後 配置 → Garden UI 019 が回収）

```
G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\_reference\
├── garden-bud-forest-unified/  （新規サブフォルダ、第一弾の生成画像）
│   ├── unified-bg-1.png
│   ├── unified-bg-2.png
│   └── ...（複数 variation 想定）
└── README.md（生成プロンプト + 採用方針を 1 段落追記）
```

第二弾では `garden-all-unified/` に Bloom 加えた全体版を配置予定。

# 第二弾の進捗（参考、Bloom 系）

| 案件 | 担当 | 状態 |
|---|---|---|
| Bloom v9 unified スクショ | a-bloom-004 | main- No. 150 NN 案、配置進行中（5/8 中見込）|
| Bloom 法人アイコン spec | a-bloom-004 | main- No. 150 KK 案、ChatGPT 生成プロンプト起草中 |
| Bloom 法人アイコン本体 | 東海林さん（KK プロンプト確定後）| ChatGPT 生成 → a-bloom-004 配置 |

第二弾の着手判断は Bloom 揃った時点で別 dispatch で発信予定。

# Vercel push 停止整合
本タスクは G ドライブの _reference/ 配下への配置 = GitHub repo に影響なし。
push 停止対象外、即実施 OK。

# claude.ai セッション切替時ルール（feedback_chat_session_switch_main_first.md）の適用
仮に Garden UI 019 → 020 切替が発生しても、_reference/ 内の画像と本 dispatch は永続保管 = 新セッションで参照可能。冗長性確保済。

# 期待する応答（report- No. 18）

```
🟢 report- No. 18
【作業日報セッション(Garden UI 019) から a-main-015 への完走報告】
発信日時: HH:MM
件名: ChatGPT 背景画像生成 第一弾プロンプト spec 起草完了
内容: ChatGPT 投下用プロンプト テキスト（Bud + Forest 統一世界観）
判断保留 (任意): プロンプト微調整 / variation 数 / 解像度 等
```

# 緊急度
🟢 通常（5/14-16 後道さんデモ前 重要、5/8 中の起草推奨）
~~~

---

## 詳細（参考）

発信日時: 2026-05-08(金) 18:14
発信元: a-main-015
宛先: 作業日報セッション (Garden UI 019)
緊急度: 🟢 通常
