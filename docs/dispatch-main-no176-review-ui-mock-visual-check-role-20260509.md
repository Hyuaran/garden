# dispatch main- No. 176 — a-review に UI mock 視覚評価役割を兼任 + 現状負荷 / ノウハウ移植

> 起草: a-main-017
> 用途: a-review セッションへ UI mock 視覚評価役割追加 + 現状負荷確認 + 視覚評価ノウハウ移植
> 番号: main- No. 176
> 起草時刻: 2026-05-09(土) 19:16

---

## 投下用短文（東海林さんが a-review にコピペ）

~~~
🚨 dispatch 発行 🚨 緊急度: 🟡 中

🟡 main- No. 176
【a-main-017 から a-review への dispatch（UI mock 視覚評価役割兼任 + 現状負荷確認）】
発信日時: 2026-05-09(土) 19:16

# 件名
a-review に UI mock 視覚評価役割を兼任します（016 期 main 視覚確認丸投げ問題対策）。現状負荷確認 + ノウハウ移植 dispatch。

# 0. 経緯（要約）

a-main-016 期に視覚確認を東海林さんに丸投げする違反が頻発。memory `feedback_self_visual_check_with_chrome_mcp` は存在するが、main 自身が視覚確認すると並列司令塔として詰まる問題が発覚。

→ a-review に **コード/PR レビュー（既存）+ UI mock 視覚評価（新規）** の兼任を依頼。

# 1. 確認事項（a-review が応答してください）

## 1-1. 現状負荷
- a-review の現在進行中タスク件数
- 残コードレビュー件数
- 余力（hours/day 想定）

## 1-2. preview tool 環境
- preview_start で http://localhost:8000 起動経験あるか
- python -m http.server 等の static server 起動経験
- Chrome MCP 接続状況

## 1-3. UI mock 視覚評価の経験
- 既存の HTML / mock 視覚評価経験
- mock vs 実装の整合性チェック経験

# 2. 新規追加役割（兼任）

| 項目 | 内容 |
|---|---|
| 対象 | Garden 全モジュール UI mock（HTML / 完成版 React / Bloom 系画面 等）|
| 評価軸 | mock 画像との整合性 / レンダリング / レスポンシブ / 6 法人カラー / アクセシビリティ |
| 起動 | a-main から dispatch 投下 → a-review が preview tool / Chrome MCP で視覚評価 |
| 報告 | review-NN として a-main に応答（dispatch 形式） |

# 3. ノウハウ移植（参考資料）

a-review が UI 視覚評価を実施する際の参考:

| 資料 | パス |
|---|---|
| Forest UI tab-1 完成版 | `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\garden-forest\html_drafts\tab-1-dashboard.html` |
| Forest UI tab-2 完成版 | `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\garden-forest\html_drafts\tab-2-financial-summary.html` |
| Forest mock 画像 | `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\_reference\garden-forest\ui-mocks\` |
| 6 法人アネモネアイコン | `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\_reference\garden-bloom\bloom-corporate-icons\` |
| 視覚評価関連 memory | `feedback_self_visual_check_with_chrome_mcp` / `feedback_file_existence_check_before_ok` |

# 4. 視覚評価標準フロー（提案）

```
1. a-review が a-main から dispatch 受領（mock パス + 完成 HTML パス）
2. python -m http.server 8000 で local server 起動（or Chrome MCP）
3. preview_start http://localhost:8000/path/to/file.html
4. preview_screenshot で実画像取得
5. mock 画像 と diff 評価:
   - 構造 / 配置
   - 6 法人カラー
   - フォント
   - ウサギ等の禁止項目
   - レスポンシブ（preview_resize）
   - ダーク切替（preview_eval でテーマ切替）
6. ls で参照画像 / CSS の物理存在検証
7. 結果を review-NN として a-main に応答（OK / 修正点リスト）
```

# 5. 期待する応答形式（review-NN）

~~~
🟢 review-NN
【a-review から a-main-017 への dispatch（UI mock 視覚評価役割兼任 受領応答）】
発信日時: 2026-05-09(土) HH:MM

# 件名
main- No. 176 受領、UI mock 視覚評価兼任 OK / 要調整

# 1-1. 現状負荷
- 進行中: ...
- 残: ...
- 余力: X h/day

# 1-2. preview tool 環境
- preview_start: 経験あり / なし
- python http.server: 同上
- Chrome MCP: 接続済 / 未接続

# 1-3. UI mock 視覚評価経験
- ... 

# 2. 兼任可否
OK / 要調整（理由: ...）

# 3. 次の作業
...
~~~

# 6. 緊急度
🟡 中（次回 UI mock 起草時に必要、Forest tab-3 起草前推奨）

# 7. self-check（a-review が応答時に確認）
- [ ] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [ ] ~~~ ラップ
- [ ] 自然会話形式禁止
- [ ] 1-1 / 1-2 / 1-3 の 3 項目すべて回答
- [ ] 兼任可否を明確に表明（OK / 要調整 + 理由）
- [ ] preview tool 環境を確認した（経験 + 接続状態）
~~~

---

## 詳細（参考、投下対象外）

発信日時: 2026-05-09(土) 19:16
発信元: a-main-017
宛先: a-review
緊急度: 🟡 中

## 背景

016 期教訓 # 8: 「視覚確認を東海林さんに毎回丸投げ（preview tool で a-main 自身が確認すべき）」

ただし a-main 自身が preview tool で視覚評価すると context 消費 + 並列司令塔として詰まる問題が発覚。

→ 5/9 18:30 議論で a-review 兼任が確定（governance-rules-v1 § 2 セッション役割分担）。

## 関連 memory / docs

- memory `feedback_my_weak_areas` # 2: 視覚評価自己判定甘さ → a-review へ
- memory `feedback_self_visual_check_with_chrome_mcp`: 視覚確認は Claude 自身、ただし main 詰まり回避で a-review 委譲
- `docs/governance-rules-v1-20260509.md` § 2 セッション役割分担

## 改訂履歴

- 2026-05-09 19:16 初版（a-main-017）
