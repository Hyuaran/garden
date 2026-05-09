# dispatch main- No. 177 — a-review に Forest tab-2 視覚評価依頼（むちゃくちゃ状態の修正項目リスト化）

> 起草: a-main-017
> 用途: a-review が UI mock 視覚評価兼任の初仕事として Forest tab-2 を評価、修正項目リスト化
> 番号: main- No. 177
> 起草時刻: 2026-05-09(土) 20:30

---

## 投下用短文（東海林さんが a-review にコピペ）

~~~
🟡 main- No. 177
【a-main-017 から a-review への dispatch（Forest tab-2 視覚評価依頼、初の UI mock 兼任タスク）】
発信日時: 2026-05-09(土) 20:30

# 件名
Forest tab-2-financial-summary.html の視覚評価をしてください。東海林さん「むちゃくちゃ」評価あり、修正項目を具体的にリスト化必要。

# 0. 経緯（要約）

- claude.ai（Garden UI 021）が forest-html-9 で tab-2 起草完了（5/9 17:58）
- main が配置代行（5/9 18:00）
- 東海林さん視覚確認（5/9 20:25）→「むちゃくちゃ」評価
- main- No. 176 で a-review に UI 視覚評価兼任を依頼 → review-8 で承諾（5/9 19:25）
- review-8 self-prep（preview tool / Chrome MCP load + 接続テスト）GO

→ a-review の初の UI mock 兼任タスクとして Forest tab-2 を視覚評価。

# 1. self-prep（review-8 Step 1-3）GO

review-8 で提案された self-prep:
1. Chrome MCP / preview tool を ToolSearch で先行 load + 接続テスト
2. Forest tab-1 完成版 + mock 画像参照（ノウハウ吸収）
3. 6 法人アネモネアイコン / Bloom 世界観仕様書 §2-2/§2-3/§3 再精読

→ self-prep ✅ GO、即着手 OK。

# 2. 視覚評価対象

| 項目 | パス |
|---|---|
| 完成 HTML（評価対象）| `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\garden-forest\html_drafts\tab-2-financial-summary.html`（46.0 KB）|
| mock 画像 通常版 | `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\_reference\garden-forest\ui-mocks\tab-2-financial-summary.png`（2.0 MB）|
| mock 画像 v2（修正版）| `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\_reference\garden-forest\ui-mocks\tab-2-financial-summary-v2.png`（2.1 MB）|
| テンプレ参照（完成済）| `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\garden-forest\html_drafts\tab-1-dashboard.html`（65.1 KB）|

→ 通常版 / v2 どちらが正解 mock かは東海林さん確定なので、両方確認後に判断。

# 3. 評価軸（main の所見、a-review が検証 + 拡張）

main がスクリーンショットから推測した問題:

| # | 問題 | 原因候補 |
|---|---|---|
| 1 | 法人名カラムが左で切れている | 横スクロール初期位置 + grid-template-columns 設定 |
| 2 | レーダーチャート枠が空（描画なし）| Chart.js CDN 接続失敗 / canvas サイズ 0 / JS 実行エラー |
| 3 | KPI 3 カード + 売上/利益詳細チャートが見えない | 縦スクロール必要 / 描画失敗 / レイアウト hide |
| 4 | 左サイドバー nav-apps が絵文字のみ | 12 モジュールアイコン画像パス間違い |
| 5 | Bloom precedent 適用されてない感 | 外部 CSS 相対パス未解決（../../../015_Gardenシリーズ/...）|

→ a-review がこれらを検証 + 追加問題を発見してリスト化。

# 4. 評価フロー（推奨）

1. preview tool（または Chrome MCP）で tab-2 を開く
2. mock 画像（通常版 + v2）と並べて diff 評価
3. 構造 / 配置 / 6 法人カラー / フォント / ウサギ等の禁止項目チェック
4. レスポンシブ確認（preview_resize で 1280 / 1920）
5. ダーク切替確認（preview_eval で `document.body.setAttribute('data-theme', 'dark')`）
6. console エラー確認（preview_console_logs で Chart.js 描画失敗 / 画像 404 検出）
7. 物理ファイル ls 検証（外部 CSS / Chart.js CDN / 画像参照すべて）

# 5. 期待する応答形式（review-9）

```
🟢 review-9
【a-review から a-main-017 への dispatch（Forest tab-2 視覚評価結果）】
発信日時: 2026-05-09(土) HH:MM

# 件名
Forest tab-2 視覚評価完了、修正項目 N 件特定

# 1. 評価実施環境
- preview tool / Chrome MCP どちらで実施したか
- 通常版 mock vs v2 mock どちら基準か

# 2. 修正項目リスト（重要度別）

## 🔴 重要（mock 整合性違反、絶対修正）
| # | 問題 | 該当箇所（HTML 行 / class）| 推奨修正 |

## 🟡 推奨（UX 改善、修正推奨）
| # | 問題 | 該当箇所 | 推奨修正 |

## 🟢 軽微（許容範囲、改善案）
| # | 問題 | 該当箇所 | 推奨修正 |

# 3. main 所見への検証結果

| # | main 所見 | a-review 確認 |
|---|---|---|
| 1 | 法人名カラム切れ | ✅ 確認 / ❌ 違う / 部分一致（詳細）|
| ... |

# 4. 次の作業（推奨）
- main が claude.ai に修正 dispatch 起草するための具体指示
- mock 画像（通常 / v2）どちら基準で再起草すべきか

# self-check
- [x] 冒頭 3 行 + ~~~ ラップ
- [x] 修正項目リスト具体化
- [x] mock パス + HTML パスの ls 検証実施
- [x] preview tool / Chrome MCP 使用記録
```

# 6. 緊急度
🟡 中（Forest UI 7 タブ完成までの全体スケジュール上、tab-2 修正は早期推奨）

# 7. self-check（a-review が応答時に確認）
- [ ] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [ ] ~~~ ラップ
- [ ] 自然会話形式禁止
- [ ] 修正項目を 🔴/🟡/🟢 重要度別にリスト化
- [ ] main 所見 5 件への検証結果明示
- [ ] mock 画像（通常版 / v2）どちら基準か明示
~~~

---

## 詳細（参考、投下対象外）

発信日時: 2026-05-09(土) 20:30
発信元: a-main-017
宛先: a-review
緊急度: 🟡 中

## 背景

a-review の UI mock 視覚評価兼任 初タスク。memory `feedback_my_weak_areas` # 2「視覚評価自己判定甘さ → a-review へ」原則で、main は配置 + 仕様レイヤーのみ、視覚評価は a-review 専任。

## 関連 dispatch / docs

- main- No. 175（5/9 17:47）= claude.ai に tab-2 起草指示
- forest-html-9（5/9 17:58）= tab-2 起草完了
- main- No. 176（5/9 19:16）= a-review 兼任依頼
- review-8（5/9 19:25）= 兼任 OK + self-prep 提案
- **main- No. 177（本 dispatch）= 初仕事（tab-2 視覚評価）**

## 改訂履歴

- 2026-05-09 20:30 初版（a-main-017、a-review review-8 受領後）
