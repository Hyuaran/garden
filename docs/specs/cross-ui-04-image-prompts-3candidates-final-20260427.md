# Cross UI 04 - 朝の AI 画像 3 案対比 最終プロンプト集

> **作成**: 2026-04-27 a-auto / Task J（5/5 後道さんデモ向け 3 軸対比戦略 Refinement）
> **用途**: 東海林さんが朝の AI 画像を 3 案で生成試行し、後道さんデモに向けた候補を絞り込む
> **戦略**: memory `user_shoji_design_preferences.md` 確定の 3 軸対比戦略
> **採用ゲート**: memory `project_godo_ux_adoption_gate.md`（後道さん UX 採用ゲート）

## ⚠️ 参照について

本ドキュメントは以下を統合して作成:

- ユーザー指示文（タスク J）の各案方向性 / 独自要素 / リスク
- memory `user_shoji_design_preferences`（東海林さん最推し = 水彩、3 軸対比戦略）
- memory `project_garden_sprout_calendar_roles`（12 モジュール = Sprout/Calendar 追加）
- 既存タスク I `cross-ui-04-image-generation-prompts.md`（朝・写実版ベース）

**注**: 参照指示の `Garden_OS_Design_Concepts_NotebookLM_20260426.pdf` page 5/7/9 は
PDF テキスト抽出環境不在のため直接参照できず、ユーザー指示文 + memory + 既存タスク I を
統合して各案を differentiate する形で起草。NotebookLM 原本との照合は東海林さん側で実施推奨。

---

## 1. 戦略整理（5/5 デモ前）

### 1.1 3 軸対比戦略

| 軸 | 役割 | 案 | 後道さん想定 | 東海林さん好み |
|---|---|---|---|---|
| 🥈 安全策 | 品格・伝統 | **凛とした和モダン** (Wa-Modern Bonsai) | ●●●（高評価想定）| ●●○ |
| 🥉 独自性 | Garden コンセプト最深表現、構造美 | **北欧風テラリウム** (Nordic Terrarium) | ●●○ | ●●○ |
| 🥇 主軸 | 温かみ・癒し、東海林さん最推し | **精緻なボタニカル水彩** (Botanical Watercolor) | ●○○（懸念あり）| **●●●（最推し）** |

### 1.2 デモシナリオ（再掲）

```
1. 3 案 × 朝 を後道さんに提示
2. 反応うかがい
3a. 1 案気に入る → 5 時間帯展開
3b. 2 案で迷う → ハイブリッド検討
3c. 全部 NG → 残り 2 案（切り絵 / 印象派）or 別案
4. 採択案 × 5 時間帯 + 季節 → WebP → BackgroundLayer 組込
```

### 1.3 Garden 12 モジュール 4 カテゴリ（プロンプトに「気配」として織込）

> **注**: 露骨に主張せず、世界観の「気配」として配置（NotebookLM 推奨）。

| カテゴリ | モジュール | 視覚要素の例 |
|---|---|---|
| **環境・基盤** | Soil（土）/ Forest（森）/ Rill（川）/ Calendar（暦）| 土 / 苔 / 周辺の樹木 / 流水 / 季節暗示 |
| **成長** | Root（根）/ Tree（木）/ Sprout（芽）| 根の張り / 幹 / 新芽 |
| **成果** | Leaf（葉）/ Bud（蕾）/ Bloom（花）/ Fruit（実）| 葉色 / 蕾 / 開花 / 実 |
| **横断** | Seed（種）| 種の散らばり / 次世代の予兆 |

---

## 2. 共通仕様（全 3 案）

### 2.1 ファイル仕様

```
Aspect ratio:  16:9
Resolution:    1920 x 1080
Format:        生成 PNG → WebP 変換（< 200 KB / 16:9）
Color profile: sRGB
配置:          Supabase Storage `cross-ui/bonsai/morning_{wa-modern|nordic-terrarium|botanical-watercolor}.webp`
```

### 2.2 構図要件（UI 載せ前提）

```
- 中央 50% 領域は要素を控えめに（UI / モジュール配置の余白）
- 中央上下 ±20% 帯（高さ）も控えめ（テキスト・ヘッダー配置可能）
- 視線誘導: 中央のシンボル（盆栽 / 樹 / ガラス）→ 余白
- コントラスト穏やか（UI 文字の可読性）
- 色域は WebP / sRGB 想定（過彩度回避）
```

### 2.3 共通ネガティブプロンプト

```
text, watermark, logo, signature, copyright,
human figure, person, character, face,
modern objects, cars, smartphones, electronics,
neon colors, fluorescent, oversaturated,
blurry, ugly, low quality, deformed, distorted,
extra limbs, multiple bonsai, busy composition,
childish illustration, cartoon, anime, kawaii
```

### 2.4 推奨 AI ツール（朝の試行）

| ツール | 推奨度 | 理由 |
|---|---|---|
| **Midjourney v6** | 🥇 第一推奨 | 構図のセンス、写実性、画風指定の安定 |
| **DALL-E 3** | 🥈 第二推奨 | プロンプト解釈が賢い、日本語 OK、即時生成 |
| Stable Diffusion XL | 🥉 上級者向け | プロンプトエンジニアリング必須 |

各案ごとに **Midjourney 版** と **DALL-E 3 自然言語版** の 2 つを併記。

---

## 3. 案 1: 凛とした和モダン（Wa-Modern Bonsai）— 朝

### 🥈 役割: 安全策（後道さん想定推奨度高、品格・伝統）

### 3.1 日本語コンセプト

朝もやの中、床の間に置かれた盆栽が斜め後方から差し込む朝日に照らされる。
障子越しの柔らかな光、木造空間の落ち着いた木目、周囲には小石と苔が控えめに配置。
**写実・日本伝統の品格** を追求。色調は柔らかなオフホワイト + 薄いオレンジピンク。

#### Garden 12 モジュールの「気配」
- 中央の **盆栽 = Tree（木）+ Root（根）+ Bud（蕾）**
- 周囲の **苔 = Soil（土）**
- 障子越しの **庭の景色 = Forest（森）**
- 床の間の **石組 = 基盤の安定感**
- 朝もやの中の **種 / 新芽の暗示 = Seed / Sprout**（極控えめ）

### 3.2 Midjourney v6 プロンプト

```
A serene Japanese bonsai tree placed in a traditional tokonoma alcove, soft morning light filtering through shoji paper screen from behind, natural wood interior with subtle grain, small stones and moss arranged around the bonsai base, peaceful zen atmosphere, photorealistic, traditional Japanese aesthetic, off-white and soft pink-orange color palette, centered composition with generous negative space in the upper 30% and central 50% for UI elements, calm low-contrast tones, dewdrops on small green leaves, a hint of distant garden landscape outside, no humans, no text --ar 16:9 --v 6 --style raw --stylize 200 --no neon,oversaturated,modern objects,cartoon
```

### 3.3 DALL-E 3 自然言語版

```
Create a 16:9 photorealistic image of a single Japanese bonsai tree placed in a traditional tokonoma alcove. Soft morning sunlight filters through a shoji paper screen from behind, illuminating the bonsai with a gentle warm glow. The interior is a natural wood space with subtle grain. Small stones and moss are arranged around the bonsai base. Background: peaceful, slightly blurred zen atmosphere with off-white and soft pink-orange tones. Composition: centered, with generous negative space in the upper third and central area for future UI elements. Style: traditional Japanese aesthetic, calm and refined. No humans, no text, no logos.
```

### 3.4 パラメータ推奨

```
Midjourney:    --ar 16:9 --v 6 --style raw --stylize 200 --quality 1
DALL-E 3:      "16:9 wide aspect, natural style, photorealistic"
SD XL:         steps 40, CFG 7.5, sampler DPM++ 2M Karras, denoise 0.75
```

### 3.5 リスク・注意点

- **過剰な伝統感** で「重い」「古い」印象になる可能性
- 障子の影が強すぎると UI 文字が読みにくい → ネガティブに `harsh shadows` 追加可
- 床の間が現代住宅でない演出だが、企業 OS としては OK（伝統 = 品格 = 信頼）

---

## 4. 案 2: 北欧風テラリウム（Nordic Terrarium）— 朝

### 🥉 役割: 独自性（Garden コンセプト最深表現、構造美）

### 4.1 日本語コンセプト

朝の柔らかな北欧光が、ガラス容器内に作られた盆栽の小宇宙を照らす。
**ガラス内に Garden の世界観そのもの** が箱庭として表現される:
- 底に **土壌（Soil）と根（Root）**
- 中央に **小さな樹（Tree）**
- 苔・小石・流れ（**Forest / Rill**）が縮小スケールで配置
- ガラス越しの結露・朝露で **時間の経過と生命感**

色調は淡い水色・グレー・薄いベージュ + 朝の白光。**構造美と機能美を両立**。

#### Garden 12 モジュールの「気配」
- ガラス容器内に **5 モジュールの箱庭表現**: Soil / Root / Tree / Rill / Forest
- 容器の周囲に Garden の他モジュールを暗示する小オブジェクト
- ガラス自体の **透明な構造** = システムの透明性・観察可能性

### 4.2 Midjourney v6 プロンプト

```
A small Japanese bonsai tree inside a clear glass terrarium, soft Nordic morning light, peaceful and minimalist composition, the terrarium contains a miniature ecosystem: layered soil at the bottom, exposed roots, a single small tree at center, scattered moss, small stones, and a tiny stream of water visible through the glass, condensation droplets on the glass surface catching morning light, surrounded by a clean wooden table, photorealistic with Scandinavian design aesthetic, pale blue-gray and warm beige color palette, generous negative space around the terrarium for UI overlay, low contrast suitable for UI background, no humans, no text --ar 16:9 --v 6 --style raw --stylize 150 --no neon,oversaturated,cluttered,childish
```

### 4.3 DALL-E 3 自然言語版

```
Create a 16:9 photorealistic image of a single small Japanese bonsai tree inside a clear glass terrarium, illuminated by soft Nordic morning light. Inside the terrarium: layered soil at the bottom with exposed roots, a small tree at center, scattered moss patches, small stones, and a thin stream of water visible through the glass. Condensation droplets on the glass surface reflect morning light. The terrarium sits on a clean wooden table. Background: minimalist Scandinavian interior with pale blue-gray and warm beige tones, generous negative space around the terrarium for future UI elements. Style: photorealistic, peaceful, observational. No humans, no text, no logos.
```

### 4.4 パラメータ推奨

```
Midjourney:    --ar 16:9 --v 6 --style raw --stylize 150 --quality 1
DALL-E 3:      "16:9 wide aspect, natural style, photorealistic, Nordic minimalism"
SD XL:         steps 40, CFG 7.0, sampler Euler a, denoise 0.7
```

### 4.5 リスク・注意点

- **構造表現が複雑** で AI が生成失敗する可能性 → シンプル指示重視
- ガラスの反射が UI 視認性を下げる → `subtle reflections, soft glass` で抑制
- 「ジオラマ的」になりすぎると業務 OS として違和感 → `peaceful, observational` で品位確保
- スケール感（ガラス容器のサイズ）に注意 → `small terrarium, hand-sized` 等で調整

---

## 5. 案 3: 精緻なボタニカル水彩（Botanical Watercolor）— 朝 ⭐ 東海林さん最推し

### 🥇 役割: 主軸（東海林さん最推し、温かみ・癒し）

### 5.1 日本語コンセプト

朝もやの中の盆栽を **博物画 / 植物図鑑風の精緻な水彩**で描く。
ピーターラビット系の絵本的可愛らしさは**完全排除**し、
**18-19 世紀ヨーロッパの植物学者の図譜** や **マリア・シビラ・メーリアン** のような
**観察に基づく科学的精度** + **手描きの温かみ**。

中央の盆栽（Tree）の周囲に Bud / Bloom / Fruit / Seed / Sprout が **植物図鑑の付録のように**
**控えめに配置**され、業務 OS の余白（UI 配置可能領域）を**白地キャンバス**として確保。

色調はクリーム色背景 + 薄い緑・茶・桃色。淡い水彩のにじみ + 細密な線画。

### 5.2 ⚠️ リスク緩和の必須要素（東海林さん指示）

| リスク | 緩和策 |
|---|---|
| **可愛らしすぎる** | `botanical illustration` 強調、`childish / cartoon / kawaii` ネガティブ追加 |
| **業務 OS として軽い** | `scientific accuracy, detailed line work, museum quality` |
| **UI 視認性低下** | 中央 50% 領域に **白地キャンバス余白** 強調 |
| **絵本系に流れる** | `Maria Sibylla Merian style, 18th century botanical engraving` |

#### Garden 12 モジュールの「気配」
- 中央の **盆栽 = Tree（木）+ Root（根）**
- 樹の枝に **小さな蕾 = Bud**（控えめ）
- 周辺の **葉のスケッチ = Leaf**
- 余白に散らばる **小さな種・芽 = Seed / Sprout**（図譜の付録のような配置）
- 全体に **博物画的な観察記録の雰囲気**

### 5.3 Midjourney v6 プロンプト

```
A precise botanical watercolor illustration of a Japanese bonsai tree in soft morning light, painted in the style of 18th-19th century European botanical engravings, Maria Sibylla Merian inspired, scientific botanical accuracy with detailed line work, fine brushwork, the bonsai is centered with surrounding scientific botanical sketches of buds, leaves, seeds, and small sprouts arranged like an illustrated plant encyclopedia, cream-white parchment background with generous central negative space resembling an empty canvas for UI overlay, soft watercolor washes in muted greens, browns, and soft pink, gentle morning light, museum-quality detailed illustration, refined and mature aesthetic suitable for a professional business OS, no humans, no text --ar 16:9 --v 6 --style raw --stylize 250 --no childish,cartoon,kawaii,storybook,disney,peter rabbit,oversaturated,neon
```

### 5.4 DALL-E 3 自然言語版

```
Create a 16:9 botanical watercolor illustration in the style of 18th-19th century European botanical encyclopedias, inspired by Maria Sibylla Merian. The main subject is a Japanese bonsai tree centered in soft morning light. Around the bonsai, scientifically accurate botanical sketches of buds, leaves, seeds, and small sprouts are arranged like an illustrated plant catalog. Background: cream-white parchment with generous central negative space serving as an empty canvas for future UI elements. Style: detailed line work, fine brushwork, soft watercolor washes in muted greens, browns, and soft pink. Mood: refined, mature, scholarly — NOT childish or storybook style. Quality: museum-grade botanical illustration suitable for a professional business interface. No humans, no text, no logos, no Peter Rabbit / Disney style.
```

### 5.5 パラメータ推奨

```
Midjourney:    --ar 16:9 --v 6 --style raw --stylize 250 --quality 1 --weird 0
DALL-E 3:      "16:9 wide aspect, vivid style → request natural style, scholarly tone"
SD XL:         steps 50, CFG 8.0, sampler DPM++ SDE Karras, LoRA 'botanical_engraving' 推奨
```

### 5.6 リスク・注意点（最重要）

#### 「可愛らしすぎる」リスクの徹底排除

- ✅ ネガティブに `childish, cartoon, kawaii, storybook, disney, peter rabbit` を**必ず**含める
- ✅ プロンプトに **`Maria Sibylla Merian inspired`** または **`18th century botanical engraving`** を明記
- ✅ `museum-quality, scholarly, scientific accuracy` で品格確保
- ❌ `cute, sweet, soft, gentle` 等の単語は使わない（可愛さを助長）

#### 業務 OS UI との両立

- ✅ 中央 50% を **白地キャンバス** として確保（プロンプト明示）
- ✅ `parchment background` で UI 文字読みやすさ確保
- ✅ `low contrast` 系の表現を入れる
- ✅ ファイル化後に Cloud Storage で WebP 圧縮 → 200 KB 未満

#### 後道さん提示時の補足

> 「東海林さん個人としてはこれが最推しですが、業務 OS としては可愛らしさが懸念です。
> リスク緩和として **博物画 / 植物図鑑風の精緻さ** を強調しています。後道さんの感性で判断ください」

---

## 6. 生成試行手順（東海林さん向け）

### 6.1 Midjourney での生成（推奨）

```
1. Discord で Midjourney bot にアクセス
2. /imagine を使い、各案のプロンプトをコピペ
3. 4 枚の variation が生成される
4. 良いものを Upscale（U1-U4 ボタン）
5. 各案 1-2 枚ずつ手元に保存（最大 6 枚 = 3 案 × 2 候補）
```

### 6.2 DALL-E 3 (ChatGPT) での生成（補助）

```
1. ChatGPT (Plus 以上) で DALL-E 3 にアクセス
2. 自然言語版プロンプトをコピペ
3. 1 枚生成 → 不満なら「もう少し品格を強めて」等で調整
4. 各案 1 枚ずつ生成（合計 3 枚）
```

### 6.3 比較・選定（東海林さん）

```
1. 6 枚（Midjourney 6 + DALL-E 3 3 = 計 9 枚 max）を並べる
2. 自分の好みで 3 案 × 1-2 枚に絞る
3. 5/5 後道さんデモに 3-6 枚を持参
```

### 6.4 デモ前最終調整

採用候補が決まったら:
- WebP 変換（< 200 KB）
- ファイル名: `morning_{wa-modern|nordic-terrarium|botanical-watercolor}_v1.webp`
- Supabase Storage `cross-ui/bonsai/` に upload
- 動く実物（Bloom-002 実装）に差し込んで動作確認

---

## 7. 後道さんデモでの提示注意点

### 7.1 提示順序の推奨

```
1. 北欧テラリウム（独自性、初見インパクト）
   ↓ 反応観察
2. 凛とした和モダン（安全策、伝統感で安心）
   ↓ 反応観察
3. 精緻なボタニカル水彩（東海林さん最推し、温かみ）
   ↓ 反応観察
```

### 7.2 後道さんへの言葉（NG / OK 例）

#### NG 例
- ❌ 「私はこれが好きです」（東海林さんの好みで誘導）
- ❌ 「業務 OS として水彩は可愛すぎるかも」（誘導的に見える）
- ❌ 「全部好きですか？」（曖昧で答えにくい）

#### OK 例
- ✅ 「3 案を見比べていただけますか」
- ✅ 「業務で毎日使う背景として、どの雰囲気が合いそうですか」
- ✅ 「気に入らない案があれば、その理由も伺えますか」
- ✅ 「全部 NG でも問題ありません、別案も準備可能です」

### 7.3 後道さん反応別の対応

| 反応 | 対応 |
|---|---|
| 1 案明確に推し | その案で時間帯 5 + 季節 4 = 9 パターン展開 |
| 2 案で迷う | ハイブリッド案を試作（例: 和モダン × 水彩細部） |
| 全部 NG | 別案の生成試行（NotebookLM 残り 2 案 = 切り絵 / 印象派） |
| 「どれでもいい」 | 東海林さん主軸で水彩を採用、後道さんへ「これで進めます」確認 |

---

## 8. ファイル管理

### 8.1 命名規則

```
morning_{candidate}_v{version}.{format}

例:
morning_wa-modern_v1.png
morning_nordic-terrarium_v1.png
morning_botanical-watercolor_v1.png
（採用後）
morning_botanical-watercolor_v2.webp  ← 微調整版
morning_botanical-watercolor_final.webp  ← 採択 + WebP 化
```

### 8.2 Storage 配置

```
Supabase Storage: cross-ui/bonsai/
├─ candidates/         (デモ前候補保管)
│  ├─ morning_wa-modern_v1.webp
│  ├─ morning_nordic-terrarium_v1.webp
│  └─ morning_botanical-watercolor_v1.webp
└─ adopted/            (採択後)
   └─ morning_botanical-watercolor_final.webp
```

### 8.3 Git 管理方針

- **生成画像本体** は Git 管理しない（Supabase Storage のみ）
- **プロンプト本ドキュメント** は Git 管理（再現性確保）
- 採用後に `cross-ui/bonsai/adopted/` の path を spec に明記

---

## 9. 関連ドキュメント

- `docs/specs/cross-ui-04-image-generation-prompts.md`（タスク I、11 パターン基本版）
- `docs/specs/2026-04-25-cross-ui-04-time-theme.md`（time-theme spec、タスク H 改訂版）
- `docs/specs/2026-04-25-cross-ui-06-access-routing.md`（盆栽中心ビュー、タスク H 改訂版）
- memory `user_shoji_design_preferences`（東海林さん 3 軸対比戦略）
- memory `project_godo_ux_adoption_gate`（後道さん採用ゲート）
- memory `project_garden_sprout_calendar_roles`（12 モジュール構成）

---

## 10. 完走チェックリスト（東海林さん向け）

- [ ] 朝の 3 案を Midjourney で生成試行（各 1-2 枚）
- [ ] DALL-E 3 で補完生成（各 1 枚）
- [ ] 6-9 枚の中から 3 案 × 1 枚ずつ選定
- [ ] WebP 化（< 200 KB / 16:9）
- [ ] Supabase Storage `cross-ui/bonsai/candidates/` に upload
- [ ] Bloom-002 実装に差し込んで動作確認（BackgroundLayer 経由）
- [ ] 5/5 後道さんデモへ持参
- [ ] §7.2 の OK 例に沿って反応うかがい
- [ ] §7.3 の対応シナリオに沿って次ステップ判断

---

— end of 3-candidate morning prompts final v1 —
