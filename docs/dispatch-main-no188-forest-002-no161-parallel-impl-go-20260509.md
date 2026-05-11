# dispatch main- No. 188 — a-forest-002 へ No. 161 並列実装 GO（B 案上書き、東海林さん指示）

> 起草: a-main-017
> 用途: 東海林さん「No. 161 は今着手可能なら B（並列実装）」指示で B 案（明日朝着手）→ 並列実装に上書き
> 番号: main- No. 188
> 起草時刻: 2026-05-09(土) 22:00

---

## 投下用短文（東海林さんが a-forest-002 にコピペ）

~~~
🟡 main- No. 188
【a-main-017 から a-forest-002 への dispatch（No. 161 並列実装 GO、main- No. 178 B 案上書き）】
発信日時: 2026-05-09(土) 22:00

# 件名
東海林さん指示で No. 161 を B-min #2 と並列実装に方針変更（main- No. 178 B 案 = 5/10 朝着手 を上書き、即着手 GO）

# 1. 方針変更の経緯

main- No. 178（5/9 20:50）で B 案 GO（5/10 朝着手 / B-min 完走優先）採択していたが:

- 東海林さん指示（5/9 22:00）: 「No. 161 は今着手可能なら B（並列実装、ガンガン本質「全モジュール並列稼働」+ 個別セッション並列）」
- ガンガンモード本質「全モジュール並列稼働」を a-forest-002 内でも適用 = B-min #2 と No. 161 を並列で進行

→ 5/10 朝着手の元計画を上書き、即着手 GO。

# 2. 並列実装の段取り

## 2-1. ブランチ戦略

- B-min #2 ブランチ feature/forest-shiwakechou-phase1-min-202605 = そのまま継続
- No. 161 ブランチ feature/forest-ui-unification-prep-20260509 を develop から新規派生
- 2 ブランチを切り替えながら作業

## 2-2. No. 161 着手手順

1: develop から feature/forest-ui-unification-prep-20260509 派生
2: PNG → WebP 変換（Pillow 利用）
   - 元: bg-forest-light.png（2.7MB） / bg-forest-dark.png（2.9MB）
   - 出力: public/themes/atmospheres/bg-forest-light.webp / bg-forest-dark.webp
3: atmospheres.ts に Forest atmosphere 追加（src/app/_lib/background/atmospheres.ts）
4: BackgroundLayer.tsx 統合確認（既存ロジック踏襲）
5: commit + push（push 解除済、即可）
6: PR 起票（feature/forest-ui-unification-prep-20260509 → develop）

工数: 0.3-0.5d

## 2-3. B-min #2 並行進行

B-min #2 4 月仕訳化 classifier 実装は継続:
- 別ブランチで作業切り替え
- どちらを先に進めるかは a-forest-002 自走判断
- 並行作業の優先度は a-forest-002 の集中状態次第

## 2-4. No. 159（GARDEN_CORPORATIONS 切替）は別途待機

No. 159 は a-bloom-005/006 の develop merge 待ち（main- No. 179 D 案、5/10 朝判断のまま）。
本 dispatch は No. 161 のみ並列実装指示。

# 3. 期待する応答（forest-002-NN）

着手宣言 + B-min #2 と No. 161 のどちらから着手するか短く報告:
- 内容: main- No. 188 受領、No. 161 並列実装着手 GO、B-min #2 進行中で X→Y の順で進める想定。

# 4. 緊急度
🟡 中（ガンガン本質「全モジュール並列稼働」発動、即着手推奨）
~~~

---

## 詳細（参考、投下対象外）

発信日時: 2026-05-09(土) 22:00
発信元: a-main-017
宛先: a-forest-002
緊急度: 🟡 中

## 経緯

- main- No. 161（5/9）= Forest 背景画像 atmospheres
- forest-002-no161-CLARIFY（5/9 12:05）= 判断保留 4 件
- main- No. 178（5/9 20:50）= B 案 GO（5/10 朝着手）
- 東海林さん指示（5/9 22:00）= 「今着手可能なら B（並列実装）」
- main- No. 188（本 dispatch）= 並列実装に上書き

## 関連 dispatch

- main- No. 178（5/9 20:50）= B 案 GO（上書きされる）
- main- No. 188（本 dispatch）= 並列実装 GO

## 改訂履歴

- 2026-05-09 22:00 初版（a-main-017、東海林さん指示、v5.1 ルール準拠）
