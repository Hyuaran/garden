# dispatch main- No. 150 — a-bloom-004 bloom-004- No. 58 受領 + 法人アイコン KK + v2.8a NN 採用

> 起草: a-main-015
> 用途: a-bloom-004 への bloom-004- No. 58 受領 + 判断保留 2 件回答
> 番号: main- No. 150
> 起草時刻: 2026-05-08(金) 15:46

---

## 投下用短文（東海林さんが a-bloom-004 にコピペ）

~~~
🟢 main- No. 150
【a-main-015 から a-bloom-004 への dispatch（bloom-004- No. 58 受領 + 判断 KK + NN 採用）】
発信日時: 2026-05-08(金) 15:46

# 件名
bloom-004- No. 58 受領。判断 2 件 = A-1 法人アイコン → KK 案（ChatGPT 生成）/ A-2 v2.8a → NN 案（v9 unified で代用）

# bloom-004- No. 58 受領内容（要約）
- A-1 法人アイコン: 既存実装に 6 法人すべて不在 → KK/LL/MM 判断仰ぎ
- A-2 v2.8a スクショ: 現状 `/` は v9 unified（5/7 commit fdc6809）→ NN/OO/PP 判断仰ぎ
- 副次発見: public/themes/module-icons/ に 12 モジュールアイコン（webp）あり
- 配置済み 0 件、調査時間 25 分（15:00-15:25）

# 横断調整セッションの判断（2 件確定）

## A-1 法人アイコン: **KK 案採用 = ChatGPT 生成**

理由:
- 東海林さんの design preferences = ボタニカル水彩、温かみ・絵本的、精緻系（memory user_shoji_design_preferences.md）
- ChatGPT で「Garden Series 統一世界観」のスタイルで 6 法人ロゴを統一生成可能
- LL 案（東海林さん提供）: 提供素材が無いため不可
- MM 案（暫定文字ロゴ）: 5/14-16 後道さんデモで世界観統一に支障

## A-2 v2.8a スクショ: **NN 案採用 = v9 unified（現状 /）で代用**

理由:
- 現状 `/` は v9 unified（5/7 commit、これが最新）
- 5/14-16 後道さんデモで表に出るのも v9 unified
- v2.8a は legacy 保持中（page.legacy-v28a-step5-20260507.tsx）= 過去版で参照頻度低
- OO 案（legacy swap + revert）: 0.3d コスト、リスクあり、不要
- PP 案（git checkout 過去復元）: 不可逆操作、避ける

ファイル名は **混乱防止** のため bloom-v9-homepage-screenshot.png に変更（v2.8a と紛らわしい命名は回避）。

## 副次発見の 12 モジュールアイコン
public/themes/module-icons/ の 12 モジュールアイコン（webp）は **配置 OK**:
- 配置先: _reference/garden-bloom/module-icons/（新サブフォルダ）
- ファイル名: 既存ファイル名そのまま（混乱防止のため一括 cp）
- 用途: claude.ai chat 参照画像として、Garden 全体ホーム / dashboard デザインの参考素材

# あなた（a-bloom-004）がやること（4 ステップ）

## ⚠️ 前提: Vercel 100/day push 停止中（main- No. 148 並行受領推奨）

5/8 残り時間 〜 翌朝 9 時 JST 過ぎまで GitHub push 停止。**ローカル作業 + ファイル配置のみ OK、push なし**。

ただし本タスクは G ドライブの _reference/ 配下への配置のため **GitHub repo に影響なし** = 即実施可。

## 1. A-2 NN 案実施: bloom-v9-homepage スクショ取得

```
1. dev server 起動 (npm run dev、または既デプロイ Vercel preview URL 利用)
2. ブラウザで `/` (Bloom v9 unified ホームページ) アクセス
3. Chrome MCP / Snipping Tool で 1920x1080 スクショ取得
4. 配置: G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\_reference\garden-bloom\bloom-v9-homepage-screenshot.png
```

## 2. 副次発見 module-icons 一括配置

```
1. 配置先サブフォルダ作成: _reference/garden-bloom/module-icons/
2. cp public/themes/module-icons/*.webp <配置先>/
3. README に「12 モジュールアイコン素材、Garden 全体ホーム/dashboard デザイン参考」と注記
```

## 3. A-1 KK 案: ChatGPT 生成プロンプト案 起草

a-bloom-004 が **生成プロンプト案を spec として起草**してください（生成自体は東海林さんの操作）。

spec 内容:
- 法人 6 件のロゴデザイン要件
- スタイル指定（ボタニカル水彩 / 温かみ / 絵本的 / 精緻系、memory user_shoji_design_preferences 参照）
- カラー方針（東海林さんが Forest v2 で確定予定）
- 出力 SVG / PNG どちらか
- 6 法人共通の「世界観統一」の核要素

ファイル: docs/specs/2026-05-08-bloom-corporate-icons-chatgpt-prompt.md

完成後、a-main-015 経由で東海林さんに「KK 案の生成プロンプト spec 完成」と完走報告。東海林さんが ChatGPT 生成 → a-bloom-004 が _reference/garden-bloom/bloom-corporate-icons/ に配置。

## 4. 完走報告

```
🟢 bloom-004- No. 59
【a-bloom-004 から a-main-015 への完走報告】
発信日時: HH:MM
件名:
- A-2 NN 案実施: bloom-v9-homepage-screenshot.png 配置完了
- 副次 module-icons: 12 webp 一括配置完了
- A-1 KK 案: ChatGPT 生成プロンプト spec 起草完了
```

# §22-8 引っ越し検討との並行

bloom-004- No. 57 で報告された 60-70% 帯到達。**main- No. 145（HH 案 = 引っ越し承認）が先に到着していれば handoff 整備優先**、本 dispatch は引っ越し後の a-bloom-005 で実施しても OK。

判断は a-bloom-004 セッションで:
- 60-70% 帯維持 = handoff 整備優先（main- No. 145 先実施）→ 本 dispatch は a-bloom-005 で
- 残量に余裕あり = 本 dispatch を先に実施 → handoff は次

# 注意点
- 既存 v1 / v2.7 等のスクショは削除禁止 → _archive_202605/ に退避
- ファイル名 v2.8a → v9 への変更は **私（a-main-015）の判断**、混乱防止のため
- KK 案の ChatGPT 生成プロンプト spec は東海林さんレビュー後に生成実施

# 緊急度
🟢 通常（push 停止中、配置作業は影響なし）
~~~

---

## 詳細（参考）

発信日時: 2026-05-08(金) 15:46
発信元: a-main-015
宛先: a-bloom-004
緊急度: 🟢 通常
