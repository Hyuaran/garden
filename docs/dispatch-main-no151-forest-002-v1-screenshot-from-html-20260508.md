# dispatch main- No. 151 — a-forest-002 へ Forest v1 スクショ取得依頼（HTML 経由再生成）

> 起草: a-main-015
> 用途: a-forest-002 への Forest v1 スクショ取得 + _reference/garden-forest/ 配置依頼（report- No. 16 案 B）
> 番号: main- No. 151
> 起草時刻: 2026-05-08(金) 17:50

---

## 投下用短文（東海林さんが a-forest-002 にコピペ）

~~~
🟡 main- No. 151
【a-main-015 から a-forest-002 への dispatch（Forest v1 スクショ取得 + _reference 配置依頼）】
発信日時: 2026-05-08(金) 17:50

# 件名
garden-forest_v9.html から Forest v1 スクショを生成し _reference/garden-forest/ に配置

# 背景
- 作業日報セッション (Garden UI 018 → 019) で context 引き継ぎ失敗
- Forest v1 既取得スクショは Garden UI 018 と一緒に消失
- report- No. 16 で「Claude Code 経由で永続 HTML から再生成」案 B が a-main-015 で採用
- claude.ai セッション切替に対する冗長性確保のため、Claude Code セッション (a-forest-002) で実施

# 依頼内容
garden-forest_v9.html を Chrome headless でレンダリング → スクショ取得 → _reference/garden-forest/ に配置

## ソース HTML 所在
G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\015_Gardenシリーズ\08_Garden-Forest\garden-forest_v9.html (81.3K)

(参考: 003_GardenForest_使用不可/garden-forest_v9.html もあるが、こちらは旧版 archive。正本は 015_Gardenシリーズ 配下)

## 配置先
G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\_reference\garden-forest\
├── forest-v1-screenshot.png （メイン画面、必須）
├── forest-v1-<screen>-screenshot.png （詳細別画面、もしあれば）
└── (将来: forest-v2-summary-screenshot.png、進行中なので不要)

## 取得手順（推奨、a-bud-002 の bud-002- No. 23 precedent 流用）

1. **Python http.server を 01_東海林美琴/ 直下で起動**
   - 静的 HTML が CSS / 画像を相対パス参照する可能性があるため、上位ディレクトリで serve が必要
   ```
   cd "G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴"
   python -m http.server 8080
   ```

2. **Chrome headless で撮影**（1920x1080 推奨）
   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" \
     --headless=new \
     --window-size=1920,1080 \
     --screenshot=C:\temp\forest-v1-screenshot.png \
     "http://localhost:8080/015_Gardenシリーズ/08_Garden-Forest/garden-forest_v9.html"
   ```
   または Chrome MCP を使った同等の操作

3. **temp 経由で配置先にコピー**
   ```
   cp C:\temp\forest-v1-screenshot.png "G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\_reference\garden-forest\forest-v1-screenshot.png"
   ```

4. **Chrome MCP（実体）で目視確認**（撮影前後）
   - 全体レイアウトが styled で表示されているか
   - 文字化け（Shift_JIS 系）がないか
   - 画像参照（PNG/SVG）が解決されているか

5. **python http.server 停止**（cleanup）

## 詳細画面（v9.html 内に複数 view あれば）

garden-forest_v9.html が SPA / 複数画面構成なら、各画面に遷移してスクショ取得:
- 法人選択画面
- 損益サマリ画面
- 決算書一覧画面
- 月次キャッシュフロー画面
- 等（HTML 内容次第、判断は a-forest-002 で）

→ 必須は **メイン画面 1 枚**（forest-v1-screenshot.png）。追加は時間あれば。

## 既存ファイル / archive 配慮
- _reference/garden-forest/ 配下に既存スクショなし（先ほど a-main-015 で確認）= _archive 不要
- 003_GardenForest_使用不可/garden-forest_v9.html（archive 版）は無視で OK、正本は 015 配下

## 命名規則 / 書き込み権限 遵守
- ✅ <module>-<version>-<screen>-screenshot.<ext> 形式準拠（_reference/README.md §命名規則）
- ✅ a-forest-002 = モジュールセッション → 自モジュール (garden-forest/) 配下のみ書き込み
- ✅ 既存 v1 削除なし（feedback_no_delete_keep_legacy 準拠、対象既存ファイルなし）

# Vercel push 停止中（main- No. 148）の整合
本タスクは G ドライブの _reference/ 配下への配置のため **GitHub repo に影響なし** = 即実施可。
push 停止対象外（git push を伴わない）。

# B-min #2-#5 進行との整合
本タスクは push 不要 + 30 分以内見込みのため、B-min #2 4 月仕訳化 classifier 実装の合間に実施可能。
B-min を中断せず、ブレイクタイムに撮影実施で OK。

# 完走報告フォーマット
🟢 forest-002-NN
【a-forest-002 から a-main-015 への完走報告】
発信日時: 2026-05-08(金) HH:MM
件名: Forest v1 スクショ _reference/garden-forest/ 配置完了
配置内容:
- forest-v1-screenshot.png (Mxxx KB)
- (追加で取得した詳細画面があれば列挙)
取得方法: garden-forest_v9.html → Python http.server + Chrome headless

# 緊急度
🟡 中（claude.ai セッション再開時に即参照したいため、5/8 中の配置推奨。ただし B-min 優先継続も OK）

# 期待効果
- 永続冗長性: garden-forest_v9.html が存続する限り、いつでも再生成可能
- claude.ai セッション切替への保険: report- No. 16 で論点 2 採用「セッション切替時 main 判断仰ぎ」ルールの実装事例
- 後道さんデモ (5/14-16) 向け Garden Series 統一世界観の参考素材として活用
~~~

---

## 詳細（参考）

発信日時: 2026-05-08(金) 17:50
発信元: a-main-015
宛先: a-forest-002
緊急度: 🟡 中（push 不要、ローカル完結タスク、5/8 中推奨）
