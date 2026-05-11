# dispatch main- No. 166 — Tree 背景画像 ChatGPT 生成プロンプト（β 案: 樹間の小径、添付画像明示）

> 起草: a-main-015
> 用途: 東海林さんが ChatGPT に投下する Tree 用背景画像生成プロンプト（ライト + ダーク 2 枚、業務集中持続性配慮）
> 番号: main- No. 166
> 起草時刻: 2026-05-09(土) 04:12

---

## 投下用短文（東海林さんが ChatGPT chat にコピペ + 3 枚添付）

### 添付ファイル（必須、3 枚 + 1 任意）

| # | ファイル | パス |
|---|---|---|
| 1 | bg-forest-light.png | `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\_reference\garden-forest\bg-forest-light.png` |
| 2 | bg-forest-dark.png | `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\_reference\garden-forest\bg-forest-dark.png` |
| 3 | bg_bloom_garden_light.png | `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\_reference\garden-bloom\bg_bloom_garden_light.png` |
| 4（任意）| bg_bloom_garden_dark.png | `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\_reference\garden-bloom\bg_bloom_garden_dark.png` |

### プロンプト本文（コピペ用）

~~~
Garden Series Tree モジュール用背景画像を 2 枚生成してください（ライト + ダーク）。

## 添付画像説明

- 添付 #1-2: Garden Forest 用背景（朝の森 + 月夜の森、樹冠俯瞰）= 兄弟モジュール、Tree とは差別化対象
- 添付 #3-4: Garden Bloom 用背景（庭園、ライト + ダーク）= 世界観統一の precedent

→ Tree モジュールも同じ画家・同じ筆致・同じ世界観で連作として描いてください。

## モチーフ（Forest との差別化）

- Tree モジュールはコールセンター架電業務、オペレーターが 8 時間集中して見続ける画面
- Forest（樹冠俯瞰、複数樹木）と差別化: Tree = **地上目線、樹間の小径**（道が遠くまで続く）
- 業務集中持続性最優先 → 派手系・絵本的すぎは避け、控えめ・落ち着いた水彩
- Garden 3 レイヤーモデル: Forest = 樹冠（上から見下ろす）、Tree = 地上（地上目線）

## ライト「樹間の小径」

- 構図: 中央に小径（道）が遠くまで続く、地上目線
- 樹木: 両脇に樹幹（白樺・楢・松等）、葉影
- 雰囲気: 薄霧 + 朝の柔らかな光、控えめな彩度
- 色彩: 白寄りベージュ + 淡緑 + 淡い金光（彩度抑制、業務疲労低減）
- 細部: 苔、小さな野花（少なめ）、控えめな蝶 1 匹（飾り程度、過剰装飾なし）
- ウサギは描画しない（Garden Series 全モジュール共通ルール）

## ダーク「夜の小径」

- 構図: ライト版と同構図（同じ小径）
- 雰囲気: 月光が小径に差し込む、静寂
- 色彩: 深紫紺 + 銀白 + 控えめな深緑
- 細部: 蛍 2-3 匹（控えめ）、月光の reflection
- ウサギは描画しない

## 厳守事項（添付 4 枚との連続性）

- 添付した Bud / Bloom / Forest 既存背景と **完全に同じ画家・同じ筆致・同じ水彩タッチ・同じ世界観**
- ボタニカル水彩 + ピーターラビット世界観（ただしウサギは描画しない、世界観のトーンのみ踏襲）
- サイズ: 1920×1080 px PNG 不透明
- 中央〜下部に呼吸の余白（UI テキスト read 可能なよう、明度抑制エリア）
- **業務集中持続性最優先** = 派手系装飾・絵本的すぎ・色彩過多 を避ける
- Forest 兄弟モジュールとの差別化（Forest=俯瞰 vs Tree=地上目線）

## 出力指示

1 枚目（ライト）→ 確認 → 2 枚目（ダーク、同構図）の順で生成。

ファイル名（チャット内表記）:
- bg-tree-light.png（薄霧の小径）
- bg-tree-dark.png（夜の小径）
~~~

### 操作手順（東海林さん用）

| Step | 操作 |
|---|---|
| 1 | ChatGPT 新規セッション or Forest 6 法人 / 背景 同セッション続投どちらでも OK |
| 2 | 上記 4 枚（必須 3 + 任意 1）を添付 |
| 3 | プロンプト本文 ~~~ 内をコピペ投下 |
| 4 | 1 枚目（bg-tree-light.png）生成 → 確認 |
| 5 | 必要なら追加調整指示（「もっと薄く」「もっと静かに」等）|
| 6 | 2 枚目（bg-tree-dark.png）生成 |
| 7 | 配置: `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\_reference\garden-tree\bg-tree-{light,dark}.png` |
| 8 | a-main-015 に「bg-tree-light/dark 配置完了」と一言 |
| 9 | 私が Read で視覚評価 → OK / NG → OK なら a-tree-002 へ実装指示（atmospheres 定数追加 + BackgroundLayer 統合 + ヘッダー / サイドバー Bud/Bloom 流用）|

### 私の評価軸（受領後）

| 軸 | OK 条件 |
|---|---|
| Forest との差別化 | 地上目線 vs 俯瞰 で明確に違う |
| Bud / Bloom / Forest との世界観統一 | 同じ画家・同じ筆致・同じ水彩 |
| 業務集中持続性 | 派手系装飾なし、彩度抑制、目疲れない |
| ライト・ダーク同構図 | 時間帯のみ違い、構図は完全一致 |
| ウサギ描画なし | 厳守 |
| UI 適合 | 中央〜下部に呼吸の余白、テキスト読みやすい |

OK 判定 → main- No. NNN で a-tree-002 へ実装指示
NG 判定 → 修正方向プロンプト発行

---

## 詳細（参考）

発信日時: 2026-05-09(土) 04:12
発信元: a-main-015
宛先: 東海林さん（ChatGPT 投下）
緊急度: 🟢 通常（5/14-16 デモまでに完成、Tree UI 統一実装の前提素材）

## β 案採用の経緯（東海林さん指示の整理）

| 時刻 | やり取り |
|---|---|
| 5/9 03:55 | 東海林さん「Garden Tree もコールセンター業務でずっと見るので派手ではない方がいい」「ヘッダー、左右サイドバー、背景は引き継ぎで、それ以外はできるだけそのままに世界観のみ合わせる」|
| 5/9 03:56 | a-main-015 「軽量パターン提案: claude.ai HTML mock 不要、メインエリア既存維持、背景画像のみ ChatGPT 生成」 |
| 5/9 03:57 | 東海林さん「Tree と Forest は同じ木なので違いが出るように背景画像は生成必要」 |
| 5/9 03:58 | a-main-015 「4 案提示 (α/β/γ/δ)、推奨 = β（樹間の小径、地上目線）」 |
| 5/9 04:09 | 東海林さん指摘「Tree の背景の話どこいった？添付画像は何か書いてた？」（保留中だったタスクを促す + 添付画像漏れ指摘）|
| 5/9 04:12 | 本 dispatch（main- No. 166）= β 案で正式起票、添付画像 4 枚明示 |

## Tree UI 統一の全体フロー（背景画像完成後）

| Step | 内容 | 担当 |
|---|---|---|
| 1 | Tree 背景画像 2 枚生成 + 配置（本 dispatch）| 東海林さん（ChatGPT）|
| 2 | a-main-015 視覚評価 | 私 |
| 3 | a-tree-002 へ実装指示 dispatch（atmospheres 定数追加 + BackgroundLayer 統合 + ヘッダー / サイドバー Bud/Bloom 流用）| 私 |
| 4 | a-tree-002 で実装（既存メインエリアはそのまま、表面のみ統一）| a-tree-002 |
| 5 | 5/13 統合テスト + 5/14-16 後道さんデモ | 全モジュール |

## 関連 dispatch / spec / docs

- main- No. 161（5/9 01:51）= Forest 背景画像配置 + atmospheres
- main- No. 165（5/9 03:58、修正版 04:08）= claude.ai 形式厳守 + 配置代行
- main- No. 166（本 dispatch）= Tree 背景画像 ChatGPT プロンプト
- spec: `docs/specs/2026-05-09-forest-ui-claude-ai-html-prompt.md`（Forest 用、参考）
- docs: `docs/forest-ui-unification-research-20260509.md`（Forest 同パターン Tree にも応用可）
