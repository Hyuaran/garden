# ChatGPT-4 image generation prompt - Garden Home v2 - 2026-04-27

> 起草: a-main-009
> 用途: ホーム画面背景の v2/v3 生成、5/5 後道さんデモ用 採用画像候補
> 前提: v1 (home-design-reference-v1.png) からの改善版、ChatGPT-4 / DALL-E 3 / Midjourney v6 等で生成

## 改善ポイント（v1 → v2）

| 項目 | v1 評価 | v2 改善 |
|---|---|---|
| 大樹のスケール | やや小さめ・右寄り | 画面中央 70% 占有、迫力 |
| 12 アイコン | 浮遊感バラバラ | 円弧 / 螺旋配置、大樹に絡む |
| 透明感 / 霧 | 薄い | ガラス質テラリウム断面図、霧・光の粒子強化 |
| 全体スタイル | やや CSS グリッド感 | ボタニカル水彩、絵本タッチ、温かみ |
| 12 アイコンの位置 | 不定 | SVG 座標で出力可能（仕様化） |

## 投下プロンプト（ChatGPT-4 にコピペ）

---

A botanical watercolor illustration of a "Garden Series" web app home background, picture-book aesthetic, warm morning light.

**Main composition:**
- Center: A majestic old tree (occupying 70% of canvas), highly detailed roots spreading into a glass terrarium cross-section at the bottom (showing soil layers, water streams, mineral crystals)
- The tree has a lush canopy with soft dappled sunlight, semi-transparent watercolor leaves
- Atmospheric mist and floating golden light particles surround the tree, dreamy and ethereal
- Background: Soft cream-watercolor wash with subtle botanical patterns (ferns, vines, dewdrops)

**12 floating module icons (transparent glass orbs with botanical motifs inside, ~80px diameter each), arranged in 3 vertical layers:**

Top canopy layer (4 icons, ~y=15%): 
- Bloom (pink flower), Fruit (red berry cluster), Seed (golden seed), Forest (small forest silhouette)

Middle ground layer (3 icons, ~y=45%): 
- Bud (green sprout bud), Leaf (single emerald leaf), Tree (bonsai tree)

Underground layer (3 icons, ~y=80%): 
- Soil (brown earth layers), Root (root network), Rill (water stream)

Floating side icons (2 icons, ~y=30% left/right): 
- Sprout (新芽 fresh sprout), Calendar (vintage paper calendar with floral border)

**Style requirements:**
- Botanical watercolor, soft edges, picture-book feel (think Studio Ghibli + Beatrix Potter)
- Warm color palette: cream, sage green, soft amber, dewy emerald, dusty pink
- High detail on tree bark texture, root system, and leaf veins
- Glass terrarium cross-section: clear with subtle reflections, layered earth visible
- Aspect ratio: 16:9 (1920x1080)
- No text, no UI elements, no buttons (this is purely background art)

**Output requirements:**
After generating the image, please provide:
1. The image (1920x1080 PNG)
2. Approximate SVG coordinates for each of the 12 module icon centers (as percentage of canvas, e.g., Bloom: x=45%, y=15%)
3. Brief description of the icon design for each module (so we can match botanical motifs in CSS)

Generate 3 variations with subtle differences in:
- Variation A: Morning golden hour
- Variation B: Misty dawn (cooler, more ethereal)
- Variation C: Soft afternoon (warmer, more saturated)

---

## 投下後の進行

| Step | 内容 | 担当 |
|---|---|---|
| 1 | 東海林さんが ChatGPT-4 に上記プロンプト投下 | 東海林さん |
| 2 | 3 variation 生成 → ベスト 1 選定 | 東海林さん |
| 3 | 採用画像を `C:\garden\_shared\attachments\20260427\ai-images\design-references\home-design-reference-v2.png` に保存 | 東海林さん |
| 4 | SVG 座標 + アイコン description を a-main-009 に共有（chat or file） | 東海林さん |
| 5 | a-main-009 が a-bloom-002 dispatch 起草（背景画像差し替え + 12 アイコン絶対座標配置）| a-main-009 |
| 6 | a-bloom-002 が実装 → push → Vercel preview で確認 | a-bloom-002 |

## 補足: ChatGPT 出力イメージ

ChatGPT-4 は以下のような出力を返す想定:

```
[Image: 1920x1080 botanical watercolor]

12 module icon SVG coordinates (% of canvas):
- Bloom: x=45%, y=15%
- Fruit: x=58%, y=18%
- Seed: x=72%, y=14%
- Forest: x=85%, y=20%
- Bud: x=40%, y=42%
- Leaf: x=55%, y=48%
- Tree: x=68%, y=44%
- Soil: x=35%, y=78%
- Root: x=52%, y=82%
- Rill: x=70%, y=80%
- Sprout: x=15%, y=32%
- Calendar: x=88%, y=35%

Icon descriptions:
- Bloom: Pink cherry blossom with 5 petals, semi-transparent glass orb
- ...
```

これを a-bloom-002 が CSS `position: absolute` + `left: 45%; top: 15%;` で配置すれば ChatGPT 設計と一致。

## 改訂履歴

- 2026-04-27 初版（a-main-009、ホーム v1 → v2 品質向上、ChatGPT-4 用プロンプト + SVG 座標出力指示）
