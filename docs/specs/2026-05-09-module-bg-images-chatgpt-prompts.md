# Garden 未生成モジュール 背景画像 ChatGPT プロンプト集（17 枚一括）

| 項目 | 値 |
|---|---|
| 起票 | 2026-05-09(土) 12:26 a-main-016 |
| 用途 | 未生成 9 モジュールの背景画像（ライト + ダーク）を ChatGPT で先行生成、東海林さんが順次投下 |
| 既配置 | Bloom（light/dark）/ Forest（light/dark）/ Tree（light/dark）/ Bud ライトのみ（`bg-bud-common-20260505.png`）|
| 対象 17 枚 | Bud ダーク 1 + Root/Leaf/Soil/Rill/Seed/Fruit/Sprout/Calendar 各 light + dark = 8×2=16 + 1 = **17 枚** |

---

## 0. 共通仕様（全 17 枚厳守）

### 0-1. 画像仕様

| 項目 | 値 |
|---|---|
| 形式 | PNG |
| 解像度 | 1920 × 1080（16:9 横長） |
| スタイル | **ボタニカル水彩**（透明感、滲み、繊細な筆致）|
| 世界観 | **ピーターラビット絵本世界**（トーンのみ踏襲、絵本的・温かみ）|
| **ウサギ描画** | **❌ 禁止**（5/8 東海林さん全面却下、動物・人物全て描かない）|
| テキスト・ロゴ | ❌ 禁止 |
| 中央主題 | ❌ 禁止（背景なので、UI 要素が上に乗る前提）|
| 端のフェード | ✅ 推奨（中央寄り低彩度、四隅は薄く）|
| 全体の彩度 | 低〜中（UI 文字が読める透明感）|

### 0-2. ライト / ダーク 共通ペア仕様

各モジュール、ライトとダークは **同構図 + トーン違い** で生成:

| 種別 | トーン | 時間帯 | 例（Forest）|
|---|---|---|---|
| ライト | 明るい・温かい・柔らかい | 朝〜昼 | 朝の森、日差し |
| ダーク | 落ち着いた・深い・神秘的 | 夕方〜夜 | 月夜の森、星空 |

### 0-3. ChatGPT への投下フォーマット（共通）

各プロンプトは英語で記述（ChatGPT の画像生成は英語が安定）。ただし、Garden / モジュール名は英語ローマ字 + 説明補足。

```
Generate a botanical watercolor background image for a business OS module.

[個別モジュール仕様...]

Format: 1920x1080 PNG, watercolor style, picture-book feeling.
Style: Peter Rabbit storybook world (DO NOT draw any rabbits, animals, or creatures).
Composition: Background only, no central subject, soft fade at edges.
No text, no logos, no sharp lines.
Allow UI elements to be readable on top — keep low saturation in center.
```

---

## 1. Bud ダーク（追加 1 枚）

**モジュール**: Bud（蕾、経理・振込）
**役割**: 経理の積み重ね、振込、明細管理
**世界観**: 早朝の芽吹き、若い緑芽、露、繊細な蕾

### 1-1. Bud ダーク プロンプト（既存ライト `bg-bud-common-20260505.png` の同構図、夜トーン化）

```
Generate a botanical watercolor background image for the "Bud" module (representing accounting and bookkeeping in a business OS).

Theme: Tender young buds and shoots in moonlight, with morning dew transforming into silver droplets under the moon.

Mood: Quiet, contemplative, the silent patience of accumulating numbers in the still of night.

Composition:
- Soft botanical buds and small shoots scattered subtly across the canvas
- Gentle moonlight (not bright sunshine) — pale silver-blue ambient light
- Dew drops catching faint moonlight, like tiny silver specks
- Edges fade to a deep navy-green darkness

Color palette:
- Primary: Deep navy (#1a2640), soft silver-green (#5a8870), pale moon-cream (#e8e4d8)
- Accent: Pale silver (#c0c8d0), faint mint glow (#88a890)
- Avoid: Bright yellow, vivid colors, harsh contrasts

Format: 1920x1080 PNG, watercolor style, picture-book feeling.
Style: Peter Rabbit storybook world (DO NOT draw any rabbits, animals, or creatures).
Composition: Background only, no central subject, soft fade at edges.
No text, no logos, no sharp lines.
Allow UI elements to be readable on top — keep low saturation in center.

Note: This is a "dark mode" companion to an existing "light mode" version (early morning buds with sunlight). Keep the same compositional structure but shift to a moonlit, peaceful night atmosphere.
```

→ ファイル名: `bg-bud-dark.png`（推奨、Forest/Tree 統一命名）

---

## 2. Root（根、認証・マスタ） ライト + ダーク

**モジュール**: Root（根、認証・マスタ・組織）
**役割**: 認証基盤、従業員マスタ、パートナーマスタ
**世界観**: 土の中の根、しっかりした基盤、深い緑 + 茶

### 2-1. Root ライト プロンプト

```
Generate a botanical watercolor background image for the "Root" module (representing authentication and master data foundation in a business OS).

Theme: Rich earth and gentle root systems beneath fertile soil, illuminated softly from above as if the ground is sun-warmed.

Mood: Grounded, steady, the quiet strength of foundations.

Composition:
- Subtle root patterns spreading horizontally below ground level
- Warm earth tones with hints of moss and fallen leaves at the top
- Soft sunlight filtering through from above
- Edges fade to lighter cream

Color palette:
- Primary: Rich earth brown (#6b4a2e), soft moss green (#7a9b6c), warm cream (#f4ecd8)
- Accent: Honey gold (#c8a368), pale sage (#a8b89a)
- Avoid: Black, harsh dark colors

Format: 1920x1080 PNG, watercolor style, picture-book feeling.
Style: Peter Rabbit storybook world (DO NOT draw any rabbits, animals, or creatures).
Composition: Background only, no central subject, soft fade at edges.
No text, no logos, no sharp lines.
Allow UI elements to be readable on top — keep low saturation in center.
```

→ ファイル名: `bg-root-light.png`

### 2-2. Root ダーク プロンプト

```
Generate a botanical watercolor background image for the "Root" module (representing authentication and master data foundation in a business OS) — DARK MODE companion.

Theme: Same earth and root system as the light version, but seen at twilight or deep night, with a soft moonlit glow seeping from above.

Mood: Mysterious, deep, the silent strength of foundations in stillness.

Composition:
- Same horizontal root pattern as the light version
- Deep earth tones with moonlight catching dewdrops
- Faint phosphorescent moss or mineral hints
- Edges fade to deep brown-black

Color palette:
- Primary: Deep brown (#2a1c12), forest deep (#1a3528), faint moss (#3a5840)
- Accent: Pale gold-glow (#806840), faint mint (#5a7868)
- Avoid: Bright colors, vivid contrasts

Format: 1920x1080 PNG, watercolor style, picture-book feeling.
Style: Peter Rabbit storybook world (DO NOT draw any rabbits, animals, or creatures).
Composition: Background only, no central subject, soft fade at edges.
No text, no logos, no sharp lines.
Allow UI elements to be readable on top — keep low saturation in center.
```

→ ファイル名: `bg-root-dark.png`

---

## 3. Leaf（葉、商材データ） ライト + ダーク

**モジュール**: Leaf（葉、商材×商流ごとの個別アプリ）
**役割**: 商材データ、トスアップ、約 30 テーブル
**世界観**: 葉群れ、商材それぞれの個性、明るい黄緑

### 3-1. Leaf ライト プロンプト

```
Generate a botanical watercolor background image for the "Leaf" module (representing individual product/business apps in a business OS).

Theme: A canopy of fresh, varied leaves in sunlight — many shapes and shades coexisting, like different products in one ecosystem.

Mood: Bright, lively, diverse harmony.

Composition:
- Various leaf shapes scattered across canvas (oak, maple, ivy, fern hints)
- Sunlight filtering through, dappled shadows
- Soft green-yellow gradient
- Edges fade to pale cream

Color palette:
- Primary: Spring green (#7ab06a), lemon-leaf yellow (#d8c860), pale cream (#f6f1e7)
- Accent: Warm peach hint (#e8a888), soft jade (#80a890)
- Avoid: Dark muted greens, autumn browns

Format: 1920x1080 PNG, watercolor style, picture-book feeling.
Style: Peter Rabbit storybook world (DO NOT draw any rabbits, animals, or creatures).
Composition: Background only, no central subject, soft fade at edges.
No text, no logos, no sharp lines.
Allow UI elements to be readable on top — keep low saturation in center.
```

→ ファイル名: `bg-leaf-light.png`

### 3-2. Leaf ダーク プロンプト

```
Generate a botanical watercolor background image for the "Leaf" module (representing individual product/business apps in a business OS) — DARK MODE companion.

Theme: The same diverse leaf canopy, now in evening twilight or moonlight, leaves silhouetted softly with hints of dusk color.

Mood: Calm, contemplative diversity at rest.

Composition:
- Same leaf variety as light version
- Twilight or moonlit ambient light
- Soft shadows under leaves, faint blue-purple sky hints
- Edges fade to deep teal-green

Color palette:
- Primary: Deep forest green (#1f3a2a), twilight blue (#2a3a52), pale moonlit jade (#5a7868)
- Accent: Faint silver-leaf glow (#a0b8a8), faint dusk peach (#805868)
- Avoid: Bright daylight colors

Format: 1920x1080 PNG, watercolor style, picture-book feeling.
Style: Peter Rabbit storybook world (DO NOT draw any rabbits, animals, or creatures).
Composition: Background only, no central subject, soft fade at edges.
No text, no logos, no sharp lines.
Allow UI elements to be readable on top — keep low saturation in center.
```

→ ファイル名: `bg-leaf-dark.png`

---

## 4. Soil（土、DB 基盤） ライト + ダーク

**モジュール**: Soil（土、DB 本体・大量データ基盤）
**役割**: リスト 253 万件、コール履歴 335 万件
**世界観**: 黒土 + 落ち葉、データの土壌、深い茶 + 緑

### 4-1. Soil ライト プロンプト

```
Generate a botanical watercolor background image for the "Soil" module (representing the database foundation and large data soil of a business OS).

Theme: Rich, fertile soil seen from a low angle — fallen leaves, small pebbles, hints of seedlings emerging. Warm afternoon light.

Mood: Abundant, foundational, the source of all growth.

Composition:
- Layered earth tones, fallen leaf motifs at top
- Hints of organic textures (moss, pebbles, root tips)
- Warm afternoon sun filtering at angle
- Edges fade to pale cream

Color palette:
- Primary: Warm earth (#7a5a3c), soft moss (#8aa078), cream (#f4ecd8)
- Accent: Honey amber (#c89868), terracotta (#a87858)
- Avoid: Cold colors, vivid greens

Format: 1920x1080 PNG, watercolor style, picture-book feeling.
Style: Peter Rabbit storybook world (DO NOT draw any rabbits, animals, or creatures).
Composition: Background only, no central subject, soft fade at edges.
No text, no logos, no sharp lines.
Allow UI elements to be readable on top — keep low saturation in center.
```

→ ファイル名: `bg-soil-light.png`

### 4-2. Soil ダーク プロンプト

```
Generate a botanical watercolor background image for the "Soil" module (database foundation) — DARK MODE companion.

Theme: The same rich soil seen at deep evening — moonlight catching dew on fallen leaves, mysterious depth.

Mood: Quiet abundance at rest, slumbering potential.

Composition:
- Same earth layers and leaf motifs as light version
- Moonlit silver highlights on dewdrops
- Deep shadow recesses
- Edges fade to deep brown-black

Color palette:
- Primary: Deep brown (#2a1c10), shadow olive (#3a4830), soft cream-glow (#a89880)
- Accent: Faint silver (#a8a0a0), dusk amber (#806040)
- Avoid: Bright saturated colors

Format: 1920x1080 PNG, watercolor style, picture-book feeling.
Style: Peter Rabbit storybook world (DO NOT draw any rabbits, animals, or creatures).
Composition: Background only, no central subject, soft fade at edges.
No text, no logos, no sharp lines.
Allow UI elements to be readable on top — keep low saturation in center.
```

→ ファイル名: `bg-soil-dark.png`

---

## 5. Rill（川、チャット） ライト + ダーク

**モジュール**: Rill（川、Chatwork クローン自社開発）
**役割**: チャット、メッセージ
**世界観**: 流れる小川、コミュニケーション、水色 + 緑岸

### 5-1. Rill ライト プロンプト

```
Generate a botanical watercolor background image for the "Rill" module (representing a chat/messaging tool in a business OS).

Theme: A gentle stream winding through grassy banks, with reflections of sky and overhanging willow leaves. Sunny afternoon.

Mood: Flowing, gentle, communicative.

Composition:
- Soft stream/river bands flowing horizontally across mid-canvas
- Grassy banks with willow or fern fronds at edges
- Sky reflections on water — soft blue-white shimmer
- Edges fade to pale sky cream

Color palette:
- Primary: Sky-water blue (#90b8c8), spring grass (#7ab06a), pale cream (#f0f4ec)
- Accent: Cool mint (#a8d0c0), warm sand-tan (#d8c0a0)
- Avoid: Heavy saturation, ocean blues, gray skies

Format: 1920x1080 PNG, watercolor style, picture-book feeling.
Style: Peter Rabbit storybook world (DO NOT draw any rabbits, animals, or creatures).
Composition: Background only, no central subject, soft fade at edges.
No text, no logos, no sharp lines.
Allow UI elements to be readable on top — keep low saturation in center.
```

→ ファイル名: `bg-rill-light.png`

### 5-2. Rill ダーク プロンプト

```
Generate a botanical watercolor background image for the "Rill" module (chat/messaging) — DARK MODE companion.

Theme: The same gentle stream, now under moonlight — water surface catching silver glints, banks in deep shadow.

Mood: Calm, intimate, whispered communication.

Composition:
- Same stream and banks as light version
- Moonlit silver shimmer on water
- Deep shadow on banks, faint indigo sky reflection
- Edges fade to deep teal-night

Color palette:
- Primary: Deep navy (#1a2840), water-silver (#5a7080), shadow green (#2a4030)
- Accent: Pale silver glint (#a8b8c0), faint moon-cream (#806848)
- Avoid: Bright sunlit colors

Format: 1920x1080 PNG, watercolor style, picture-book feeling.
Style: Peter Rabbit storybook world (DO NOT draw any rabbits, animals, or creatures).
Composition: Background only, no central subject, soft fade at edges.
No text, no logos, no sharp lines.
Allow UI elements to be readable on top — keep low saturation in center.
```

→ ファイル名: `bg-rill-dark.png`

---

## 6. Seed（種、新事業枠） ライト + ダーク

**モジュール**: Seed（種、新商材・新事業の拡張枠）
**役割**: 新事業の入り口
**世界観**: 種子の眠り、土に埋もれた粒、芽生え前

### 6-1. Seed ライト プロンプト

```
Generate a botanical watercolor background image for the "Seed" module (representing new business / new product expansion slots in a business OS).

Theme: Various seeds nestled in warm soil, hints of golden husks, with morning dew. Some seeds barely cracking open.

Mood: Potential, anticipation, quiet beginnings.

Composition:
- Scattered seeds (acorn, sunflower, dandelion fluff) softly painted at varied scales
- Warm soil layer at bottom, fading to soft cream sky
- Subtle gold flecks suggesting husks or pollen
- Edges fade to pale cream

Color palette:
- Primary: Warm sand-gold (#c8a868), soft earth (#8a6a48), pale cream (#f4ecd8)
- Accent: Pale rose (#e8c0b0), soft sage (#a8b88c)
- Avoid: Vivid colors, sharp contrasts

Format: 1920x1080 PNG, watercolor style, picture-book feeling.
Style: Peter Rabbit storybook world (DO NOT draw any rabbits, animals, or creatures).
Composition: Background only, no central subject, soft fade at edges.
No text, no logos, no sharp lines.
Allow UI elements to be readable on top — keep low saturation in center.
```

→ ファイル名: `bg-seed-light.png`

### 6-2. Seed ダーク プロンプト

```
Generate a botanical watercolor background image for the "Seed" module (new business expansion) — DARK MODE companion.

Theme: Same seeds in soil, but viewed at deep night with moonlight — golden husks faintly catching silver, suggesting dormant potential.

Mood: Patient stillness, hidden promise.

Composition:
- Same scattered seeds as light version
- Moonlit silver highlights on golden husks
- Deep soil shadow below
- Edges fade to deep umber-night

Color palette:
- Primary: Deep amber-brown (#3a2a18), shadow gold (#806040), faint cream-glow (#a89878)
- Accent: Pale silver (#a0a8a0), deep rose-shadow (#604848)
- Avoid: Bright daytime colors

Format: 1920x1080 PNG, watercolor style, picture-book feeling.
Style: Peter Rabbit storybook world (DO NOT draw any rabbits, animals, or creatures).
Composition: Background only, no central subject, soft fade at edges.
No text, no logos, no sharp lines.
Allow UI elements to be readable on top — keep low saturation in center.
```

→ ファイル名: `bg-seed-dark.png`

---

## 7. Fruit（実、法人法的実体情報） ライト + ダーク

**モジュール**: Fruit（実、法人法的実体情報モジュール）
**役割**: 6 法人の法的実体情報、株式・登記等
**世界観**: 熟した果実、結実、深紅 + 緑葉

### 7-1. Fruit ライト プロンプト

```
Generate a botanical watercolor background image for the "Fruit" module (representing legal entity / corporate identity records in a business OS).

Theme: Soft hints of ripening fruits among leafy branches — apples, plums, soft round fruits — in afternoon sun. Nothing dominates; suggestions only.

Mood: Mature, established, quietly accomplished.

Composition:
- Subtle round fruit hints scattered among leafy boughs
- Warm afternoon light
- Soft red-pink-amber tones blended with leaf greens
- Edges fade to pale cream

Color palette:
- Primary: Soft apple red (#c08070), leaf green (#7a9868), warm cream (#f4ece0)
- Accent: Plum-rose (#a06078), honey-yellow (#d8b878)
- Avoid: Vivid red, harsh bright colors

Format: 1920x1080 PNG, watercolor style, picture-book feeling.
Style: Peter Rabbit storybook world (DO NOT draw any rabbits, animals, or creatures).
Composition: Background only, no central subject, soft fade at edges.
No text, no logos, no sharp lines.
Allow UI elements to be readable on top — keep low saturation in center.
```

→ ファイル名: `bg-fruit-light.png`

### 7-2. Fruit ダーク プロンプト

```
Generate a botanical watercolor background image for the "Fruit" module (legal entity records) — DARK MODE companion.

Theme: Same orchard fruits, now in evening light, fruits catching the last warm glow with deep shadows.

Mood: Mature ripeness at rest, dignity in stillness.

Composition:
- Same fruit-and-leaf composition as light version
- Deep evening shadow tones
- Hints of warm sunset glow on fruit edges
- Edges fade to deep wine-shadow

Color palette:
- Primary: Deep wine (#3a1f24), shadow leaf (#1f3a2a), dusk amber (#604030)
- Accent: Faint plum-glow (#705060), soft moon-cream (#a08878)
- Avoid: Bright saturated colors

Format: 1920x1080 PNG, watercolor style, picture-book feeling.
Style: Peter Rabbit storybook world (DO NOT draw any rabbits, animals, or creatures).
Composition: Background only, no central subject, soft fade at edges.
No text, no logos, no sharp lines.
Allow UI elements to be readable on top — keep low saturation in center.
```

→ ファイル名: `bg-fruit-dark.png`

---

## 8. Sprout（新芽、オンボーディング） ライト + ダーク

**モジュール**: Sprout（新芽、オンボーディング）
**役割**: 新人育成、初期セットアップガイド
**世界観**: 芽生え、双葉、新人育成

### 8-1. Sprout ライト プロンプト

```
Generate a botanical watercolor background image for the "Sprout" module (representing onboarding / new user guidance in a business OS).

Theme: Tiny young sprouts and double-leaved seedlings emerging from soft soil, in the gentle light of dawn. New beginnings.

Mood: Fresh, hopeful, encouraging start.

Composition:
- Small sprouts/double-leaves scattered emerging from soil base
- Pale dawn sky tones above
- Soft golden-pink dawn light
- Edges fade to pale cream

Color palette:
- Primary: Tender spring green (#9ac890), soft dawn pink (#e8c8c0), pale cream (#f6f1e7)
- Accent: Faint gold dawn (#e8d8a8), young sage (#a8c098)
- Avoid: Mature dark greens, heavy contrasts

Format: 1920x1080 PNG, watercolor style, picture-book feeling.
Style: Peter Rabbit storybook world (DO NOT draw any rabbits, animals, or creatures).
Composition: Background only, no central subject, soft fade at edges.
No text, no logos, no sharp lines.
Allow UI elements to be readable on top — keep low saturation in center.
```

→ ファイル名: `bg-sprout-light.png`

### 8-2. Sprout ダーク プロンプト

```
Generate a botanical watercolor background image for the "Sprout" module (onboarding) — DARK MODE companion.

Theme: Same young sprouts in soil, now at deep night with moonlight — small leaves catching silver light, suggesting growth even in stillness.

Mood: Quiet promise, patience for the new.

Composition:
- Same sprouts and seedlings as light version
- Moonlit silver edges on young leaves
- Deep night soil tones
- Edges fade to deep teal-night

Color palette:
- Primary: Deep teal-green (#1a3030), shadow earth (#2a1f18), pale moon-glow (#a0c0a8)
- Accent: Faint dawn-rose (#604850), soft silver (#a0a8a0)
- Avoid: Bright morning colors

Format: 1920x1080 PNG, watercolor style, picture-book feeling.
Style: Peter Rabbit storybook world (DO NOT draw any rabbits, animals, or creatures).
Composition: Background only, no central subject, soft fade at edges.
No text, no logos, no sharp lines.
Allow UI elements to be readable on top — keep low saturation in center.
```

→ ファイル名: `bg-sprout-dark.png`

---

## 9. Calendar（暦、横断） ライト + ダーク

**モジュール**: Calendar（暦、横断的な時間管理）
**役割**: スケジュール、納税カレンダー、横断的な暦
**世界観**: 四季の移ろい、月暦、淡色グラデーション

### 9-1. Calendar ライト プロンプト

```
Generate a botanical watercolor background image for the "Calendar" module (representing time / schedule / seasonal cycles in a business OS).

Theme: A subtle horizontal flow of the four seasons — spring blossoms on left, summer leaves, autumn warm tones, winter pale — gently blended like a watercolor wash.

Mood: Cyclical, flowing, the rhythm of time.

Composition:
- Horizontal gradient suggesting season transitions left-to-right
- Subtle floral hints (cherry blossom, leaf, autumn maple, winter pine) at varied positions
- Soft daytime light, balanced
- Edges fade to pale cream

Color palette:
- Primary: Spring pink (#f0c8d0), summer green (#90b878), autumn amber (#d8a868), winter cream-blue (#d0d8e0)
- Accent: Soft cream (#f4ecd8), pale gold (#d8c498)
- Avoid: Heavy saturation in any single season

Format: 1920x1080 PNG, watercolor style, picture-book feeling.
Style: Peter Rabbit storybook world (DO NOT draw any rabbits, animals, or creatures).
Composition: Background only, no central subject, soft fade at edges.
No text, no logos, no sharp lines.
Allow UI elements to be readable on top — keep low saturation in center.
```

→ ファイル名: `bg-calendar-light.png`

### 9-2. Calendar ダーク プロンプト

```
Generate a botanical watercolor background image for the "Calendar" module (time / seasonal cycles) — DARK MODE companion.

Theme: Same four-season flow, now seen at twilight or evening, with deep tones of each season — spring deep rose, summer deep emerald, autumn deep umber, winter deep navy.

Mood: Reflective, the slow turning of time.

Composition:
- Same horizontal gradient suggesting seasons
- Deep twilight tones for each phase
- Faint moonlit highlights
- Edges fade to deep night

Color palette:
- Primary: Deep rose-night (#3a2030), deep emerald (#1a3a2a), deep umber (#3a2a1a), deep navy (#1a2840)
- Accent: Pale moon-cream (#605040), faint silver (#a0a0a8)
- Avoid: Bright daytime colors

Format: 1920x1080 PNG, watercolor style, picture-book feeling.
Style: Peter Rabbit storybook world (DO NOT draw any rabbits, animals, or creatures).
Composition: Background only, no central subject, soft fade at edges.
No text, no logos, no sharp lines.
Allow UI elements to be readable on top — keep low saturation in center.
```

→ ファイル名: `bg-calendar-dark.png`

---

## 10. 投下手順（東海林さん用、ChatGPT 順次生成）

| Step | 操作 |
|---|---|
| 1 | ChatGPT 開く（画像生成可能なモデル選択）|
| 2 | §1〜§9 の各プロンプトを **1 枚ずつ** 投下（17 回）|
| 3 | 生成画像を保存: `bg-{module}-{light,dark}.png` の命名で |
| 4 | 配置先: `_chat_workspace/_reference/garden-{module}/`（Bud は既存ライト保持、ダーク追加）|
| 5 | a-main-016 に「N 枚目生成完了、配置完了」と一言報告 → 私が必要時 Read で視覚評価 |

## 11. 配置場所まとめ

| モジュール | フォルダ | 既存 | 追加 |
|---|---|---|---|
| Bud | `_reference/garden-bud/` | bg-bud-common-20260505.png（ライト） | bg-bud-dark.png |
| Root | `_reference/garden-root/`（新規作成）| なし | bg-root-light.png + bg-root-dark.png |
| Leaf | `_reference/garden-leaf/`（新規作成）| なし | bg-leaf-light.png + bg-leaf-dark.png |
| Soil | `_reference/garden-soil/`（新規作成）| なし | bg-soil-light.png + bg-soil-dark.png |
| Rill | `_reference/garden-rill/`（新規作成）| なし | bg-rill-light.png + bg-rill-dark.png |
| Seed | `_reference/garden-seed/`（新規作成）| なし | bg-seed-light.png + bg-seed-dark.png |
| Fruit | `_reference/garden-fruit/`（新規作成）| なし | bg-fruit-light.png + bg-fruit-dark.png |
| Sprout | `_reference/garden-sprout/`（新規作成）| なし | bg-sprout-light.png + bg-sprout-dark.png |
| Calendar | `_reference/garden-calendar/`（新規作成）| なし | bg-calendar-light.png + bg-calendar-dark.png |

→ a-main-016 が必要時に各フォルダを mkdir して受領。

## 12. 関連 dispatch / spec / docs

- main- No. 161（5/9 01:51）= Forest 背景画像配置依頼（a-forest-002）
- 既配置例: bg-forest-light.png / bg-forest-dark.png / bg-tree-light.png / bg-tree-dark.png / bg_bloom_garden_light.png / bg_bloom_garden_dark.png / bg-bud-common-20260505.png
- memory: feedback_chatgpt_image_workflow（ChatGPT 画像 → Garden UI workflow）
- memory: user_shoji_design_preferences（ボタニカル水彩、温かみ・絵本的・精緻系）
- 5/8 全面却下: ウサギ描画（全画像で禁止）

## 13. 改訂履歴

- 2026-05-09 12:26 初版（a-main-016、東海林さん「未生成モジュール背景先行生成」要請受領）
