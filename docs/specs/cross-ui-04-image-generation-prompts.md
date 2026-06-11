# Cross UI 04 - 画像生成プロンプト集（盆栽ビュー）

> 作成: 2026-04-27 a-auto / Task I（後道さん UX 採用ゲート反映）
> 用途: cross-ui-04 time-theme + 盆栽中心ビューで時間帯別 / 季節別の背景画像を生成
> 選定者: 東海林さん（後道さんへ提示前）
> 親 spec: `docs/specs/2026-04-25-cross-ui-04-time-theme.md`
> 関連 spec: cross-ui-01 layout-theme, cross-ui-03 personalization
> 配置先（想定）: Supabase Storage `cross-ui/bonsai/{morning|noon|evening|night|spring|summer|autumn|winter}.webp`

---

## 1. 概要

### 1.1 ねらい

Garden の世界観は「**樹木 / 盆栽中心**」。ホーム画面・ログイン画面・ヘッダー背景で**盆栽**を中央に配置し、**業務中にも季節感・時間感**を提供する。

cross-ui-04 で定義済の 4 時間帯（朝・昼・夕・夜）に加え、**4 季節バリエーション**（春・夏・秋・冬）と**画風バリエーション**（写実 / イラスト / 水墨画）を本ドキュメントで網羅。

### 1.2 想定 AI ツール

| ツール | 強み | 弱み | 推奨度 |
|---|---|---|---|
| **Midjourney v6 / v7** | 構図のセンス、写実性、画風指定が安定 | 商用ライセンス確認必須 | ◎ 第一推奨 |
| **DALL-E 3 (ChatGPT)** | プロンプト解釈が賢い、日本語 OK | 構図ランダム性高、16:9 弱め | ○ 第二推奨 |
| **Stable Diffusion XL / FLUX** | 完全ローカル、商用 OK、調整自由 | プロンプトエンジニアリング必須 | ○ 上級者向け |
| **Adobe Firefly** | 商用 100% クリア、Adobe 連携 | 写実 < Midjourney | △ ライセンス特化用途 |

### 1.3 推奨ファイル仕様

```
Aspect ratio:    16:9
Resolution:      1920 x 1080（ヘッダー想定）/ 3840 x 2160（高解像度版）
Format:          WebP（軽量化）/ 元データは PNG で保管
File size:       < 200 KB（読込速度優先）
Color profile:   sRGB
```

### 1.4 構図ガイドライン（全プロンプト共通）

```
- 盆栽（bonsai）を中央〜やや下寄りに配置
- 横長レイアウト（16:9）
- 中央構図 + 周囲に余白（モジュール配置スペース確保）
- 画像中央 ±20% 帯（高さ）は要素を控えめに（テキスト・UI 配置可能空間）
- コントラスト穏やか（UI 要素が読める）
- 視線誘導: 中央の盆栽 → 余白の空間
```

### 1.5 共通ネガティブ要素（避けたい）

```
text, watermark, logo, signature, copyright,
human figure, person, character, face,
modern objects, cars, smartphones, electronics,
neon colors, fluorescent, oversaturated,
blurry, ugly, low quality, deformed, distorted,
extra limbs, multiple bonsai, busy composition
```

### 1.6 著作権配慮

- 既存有名作品の模倣は避ける（特定アーティスト名は参考程度に）
- Midjourney の場合、`--no [artist_name]` でも除外可
- 出力画像は商用利用前にツールごとのライセンス再確認
- Adobe Firefly は商用 100% クリア（保険として併用検討）

---

## 2. 時間帯別プロンプト 4 種

### 2.1 朝（morning_bonsai）

#### A. 日本語コンセプト（東海林さん向け）

朝もやの中、優しい朝日が盆栽を斜め後方から照らし、葉に朝露がきらめく。
背景は薄いオレンジピンクのグラデーション。一日の始まりの清々しさ・希望感。

色調: 柔らかなオレンジ・ピンク・薄黄、コントラスト弱め。

#### B. 英語プロンプト（Midjourney v6 推奨）

```
A serene Japanese bonsai tree in soft morning mist, gentle golden sunrise light filtering from behind, dewdrops glistening on small green leaves, peaceful zen atmosphere, traditional Japanese aesthetic, photorealistic, soft focus background with pink-orange gradient sky, centered composition with negative space, calming UI-friendly tones, no humans, no text --ar 16:9 --v 6 --style raw --stylize 200
```

#### B'. 英語プロンプト（DALL-E 3 / 自然言語版）

```
Create a 16:9 photorealistic image of a single Japanese bonsai tree centered in soft morning mist. Gentle golden sunrise light comes from behind, with dewdrops on small green leaves. Background: peaceful pink-orange gradient sky with negative space around the tree. Calm, traditional Japanese zen aesthetic. No humans, no text, no logos. Soft, low-contrast tones suitable for use as a UI background.
```

#### C. ネガティブプロンプト

```
text, watermark, logo, signature, human, person, face,
modern objects, neon colors, oversaturated, harsh shadows,
blurry, ugly, low quality, deformed, multiple trees, busy background
```

#### D. パラメータ推奨

- **Midjourney**: `--ar 16:9 --v 6 --style raw --stylize 200 --quality 1`
- **DALL-E 3**: 「natural style, 16:9 aspect ratio, photorealistic, soft morning light」
- **Stable Diffusion XL**: steps 40, CFG 7.5, sampler `DPM++ 2M Karras`, resolution 1344x768 (16:9 SDXL native)

#### E. 想定画風（複数案、§4 で詳細）

- 案 1: 写実的フォトリアル ✅ 推奨（業務 UI と相性良）
- 案 2: イラスト調（柔らかい線、絵本風）
- 案 3: 水墨画風（モノトーン基調）

---

### 2.2 昼（noon_bonsai）

#### A. 日本語コンセプト

真上からの強い陽射し、青空と白雲。盆栽の葉が鮮やかな緑色に映え、影は短く濃い。
活力・前向きな日中の業務時間を象徴。

色調: 青・白・緑が鮮やか、明るくクリア。

#### B. 英語プロンプト（Midjourney v6 推奨）

```
A vibrant Japanese bonsai tree under bright midday sun, clear blue sky with soft white cumulus clouds, vivid green leaves with crisp short shadows, traditional ceramic pot, peaceful zen garden atmosphere, photorealistic, centered composition with breathing space, bright but UI-friendly palette, no humans, no text --ar 16:9 --v 6 --style raw --stylize 200
```

#### B'. 英語プロンプト（DALL-E 3 版）

```
Create a 16:9 photorealistic image of a single vibrant Japanese bonsai tree centered under a bright clear blue sky with soft white clouds. Strong overhead midday sunlight, vivid green leaves, traditional ceramic pot. Background has plenty of negative space. No humans, no text, no logos. Bright but calm tones suitable for a UI background.
```

#### C. ネガティブプロンプト

```
text, watermark, logo, human, person, face, modern objects,
fluorescent neon, oversaturated, blurry, ugly, low quality,
multiple trees, dark mood, gloomy, stormy, rain
```

#### D. パラメータ推奨

- **Midjourney**: `--ar 16:9 --v 6 --style raw --stylize 200`
- **DALL-E 3**: 「natural style, 16:9, photorealistic midday bonsai with blue sky」
- **Stable Diffusion XL**: steps 40, CFG 7, sampler `DPM++ 2M Karras`

#### E. 想定画風

- 案 1: 写実的 ✅ 推奨
- 案 2: イラスト調（明るくポップ）
- 案 3: 水墨画風（控えめな彩色）

---

### 2.3 夕（evening_bonsai）

#### A. 日本語コンセプト

夕焼けの赤紫〜ゴールドに染まる空、盆栽はシルエット気味に。葉や枝の輪郭が暖色光で縁取られる。
一日の業務終わりの達成感・郷愁感。

色調: 赤紫・オレンジ・ゴールド、コントラストやや高め。

#### B. 英語プロンプト（Midjourney v6 推奨）

```
A majestic Japanese bonsai tree at sunset, dramatic warm golden and crimson sky, soft purple gradient at top, branches and leaves rim-lit by setting sun, slight silhouette effect, traditional ceramic pot, serene zen atmosphere, photorealistic cinematic lighting, centered composition with negative space, no humans, no text --ar 16:9 --v 6 --style raw --stylize 250
```

#### B'. 英語プロンプト（DALL-E 3 版）

```
Create a 16:9 photorealistic image of a single Japanese bonsai tree centered against a dramatic sunset sky—warm gold, crimson, and soft purple gradient. Branches and leaves are rim-lit by the setting sun, creating a subtle silhouette effect. Traditional ceramic pot. Cinematic and serene. No humans, no text, no logos.
```

#### C. ネガティブプロンプト

```
text, watermark, logo, human, person, face, modern objects,
neon colors, oversaturated, blurry, ugly, low quality,
multiple trees, midday brightness, snow, fog
```

#### D. パラメータ推奨

- **Midjourney**: `--ar 16:9 --v 6 --style raw --stylize 250`（やや強めのスタイライズで夕焼けの叙情性）
- **DALL-E 3**: 「cinematic sunset, 16:9, photorealistic golden hour bonsai」
- **Stable Diffusion XL**: steps 50, CFG 8, sampler `DPM++ 2M Karras`

#### E. 想定画風

- 案 1: 写実的シネマティック ✅ 推奨
- 案 2: イラスト調（叙情的、絵本風）
- 案 3: 浮世絵風（夕焼け空が映える）

---

### 2.4 夜（night_bonsai）

#### A. 日本語コンセプト

紺〜深い藍色の夜空、星々が静かに瞬く。盆栽は月光に淡く照らされ、輪郭がぼんやり浮かぶ。
静寂・落ち着き・残業時間の集中モード。

色調: 紺・藍・銀、暗いがディテールは見える。

#### B. 英語プロンプト（Midjourney v6 推奨）

```
A peaceful Japanese bonsai tree under deep starry night sky, soft moonlight gently illuminating the leaves, traditional ceramic pot, navy and indigo gradient background with subtle stars, tranquil zen atmosphere, photorealistic with cinematic moonlit ambiance, centered composition with negative space, low-key lighting suitable for dark UI, no humans, no text --ar 16:9 --v 6 --style raw --stylize 200
```

#### B'. 英語プロンプト（DALL-E 3 版）

```
Create a 16:9 photorealistic image of a single Japanese bonsai tree centered under a deep starry night sky. Soft moonlight gently illuminates the leaves and branches. Background: navy-to-indigo gradient with subtle stars. Traditional ceramic pot. Tranquil, low-key cinematic lighting suitable as a dark UI background. No humans, no text, no logos.
```

#### C. ネガティブプロンプト

```
text, watermark, logo, human, person, face, modern objects,
city lights, neon, urban, harsh contrast, oversaturated,
blurry, ugly, low quality, multiple trees, daylight
```

#### D. パラメータ推奨

- **Midjourney**: `--ar 16:9 --v 6 --style raw --stylize 200 --chaos 5`
- **DALL-E 3**: 「peaceful night, 16:9, photorealistic moonlit bonsai with starry sky」
- **Stable Diffusion XL**: steps 50, CFG 7.5, sampler `DPM++ 2M Karras`

#### E. 想定画風

- 案 1: 写実的（月光・星空フォトリアル）✅ 推奨
- 案 2: イラスト調（プラネタリウム風、幻想的）
- 案 3: 水墨画風（夜の静寂を墨の濃淡で）

---

## 3. 季節バリエーション 4 種

> ランダム表示用 / 季節判定（月単位）でも切替可能。
> 親 spec cross-ui-04 §2.3 の日次ランダムシードで季節分岐させる派生案。

### 3.1 春（spring_sakura_bonsai）

#### A. 日本語コンセプト

桜の盆栽（mini cherry blossom）が満開、花びらが舞う。淡いピンクと若緑、薄水色の春霞の空。
新年度・新規プロジェクト・はじまりの季節。

色調: 桜ピンク・若草色・薄水色。

#### B. 英語プロンプト（Midjourney v6 推奨）

```
A delicate Japanese cherry blossom bonsai (sakura) in full bloom, soft pink petals gently falling in the breeze, fresh young green leaves, pale blue spring haze sky background, traditional ceramic pot, ethereal peaceful atmosphere, photorealistic with soft pastel palette, centered composition with breathing space, no humans, no text --ar 16:9 --v 6 --style raw --stylize 250
```

#### C. ネガティブプロンプト

```
text, watermark, logo, human, person, modern objects,
neon, oversaturated, blurry, ugly, low quality, snow, autumn leaves,
multiple trees, busy background
```

#### D. パラメータ推奨

- **Midjourney**: `--ar 16:9 --v 6 --style raw --stylize 250`
- **DALL-E 3**: 「spring sakura bonsai in full bloom, 16:9, soft pastel」
- **Stable Diffusion XL**: steps 40, CFG 7.5

#### E. 想定画風

- 案 1: 写実的 ✅ 推奨
- 案 2: イラスト調（絵本風、優しい）
- 案 3: 浮世絵風（桜ならでは）

---

### 3.2 夏（summer_green_bonsai）

#### A. 日本語コンセプト

濃緑の松 / 楓の盆栽、苔（こけ）が瑞々しく生え、水滴が葉先に。深い緑とエメラルド、抜けるような青空。
活気・繁忙期・成長を象徴。

色調: 深緑・エメラルド・空色。

#### B. 英語プロンプト（Midjourney v6 推奨）

```
A lush deep green Japanese pine or maple bonsai in summer, vibrant emerald moss covering the soil base, fresh water droplets on leaf tips, deep blue summer sky with thin cirrus clouds, traditional ceramic pot, vivid yet calming zen atmosphere, photorealistic with rich saturation, centered composition with negative space, no humans, no text --ar 16:9 --v 6 --style raw --stylize 200
```

#### C. ネガティブプロンプト

```
text, watermark, logo, human, person, modern objects,
fluorescent, oversaturated tropical, blurry, ugly, low quality,
multiple trees, sakura, autumn colors, snow
```

#### D. パラメータ推奨

- **Midjourney**: `--ar 16:9 --v 6 --style raw --stylize 200`
- **DALL-E 3**: 「lush green summer bonsai with moss, 16:9, vivid」
- **Stable Diffusion XL**: steps 40, CFG 7

#### E. 想定画風

- 案 1: 写実的 ✅ 推奨
- 案 2: イラスト調（生命力強調）
- 案 3: 水墨画風（緑の濃淡）

---

### 3.3 秋（autumn_momiji_bonsai）

#### A. 日本語コンセプト

紅葉（もみじ）の盆栽、葉が赤・橙・黄の三色に染まる。落葉が地面に少し散る。背景は薄いセピアの空。
収穫・実り・第3四半期決算の象徴。

色調: 赤・橙・黄・茶、暖色系。

#### B. 英語プロンプト（Midjourney v6 推奨）

```
A stunning Japanese maple (momiji) bonsai in autumn, leaves in vibrant red, orange, and golden yellow gradient, a few fallen leaves scattered around the ceramic pot, soft sepia and warm beige sky background, traditional zen aesthetic, photorealistic with rich autumn palette, centered composition with negative space, no humans, no text --ar 16:9 --v 6 --style raw --stylize 250
```

#### C. ネガティブプロンプト

```
text, watermark, logo, human, person, modern objects,
neon, oversaturated, blurry, ugly, low quality, sakura, snow,
green summer, multiple trees, busy
```

#### D. パラメータ推奨

- **Midjourney**: `--ar 16:9 --v 6 --style raw --stylize 250`
- **DALL-E 3**: 「autumn maple bonsai with red orange yellow leaves, 16:9」
- **Stable Diffusion XL**: steps 50, CFG 7.5

#### E. 想定画風

- 案 1: 写実的 ✅ 推奨
- 案 2: イラスト調（暖かみ）
- 案 3: 浮世絵風（紅葉ならでは）

---

### 3.4 冬（winter_snow_bonsai）

#### A. 日本語コンセプト

雪化粧した松（または梅）の盆栽、枝に淡く雪が積もる。背景は灰白の冬空、わずかに雪片が舞う。
静寂・年末年始・節目を象徴。

色調: 白・灰・薄青・常緑色（針葉）。

#### B. 英語プロンプト（Midjourney v6 推奨）

```
A serene Japanese pine or plum bonsai dusted with fresh snow, delicate white snow gently resting on branches, a few snowflakes drifting in the air, soft pale gray-blue winter sky background, traditional ceramic pot, tranquil zen atmosphere, photorealistic with cool muted palette, centered composition with negative space, no humans, no text --ar 16:9 --v 6 --style raw --stylize 200
```

#### C. ネガティブプロンプト

```
text, watermark, logo, human, person, modern objects,
neon, oversaturated, blurry, ugly, low quality, sakura, autumn,
green summer, harsh blizzard, multiple trees
```

#### D. パラメータ推奨

- **Midjourney**: `--ar 16:9 --v 6 --style raw --stylize 200`
- **DALL-E 3**: 「winter snow-covered pine bonsai, 16:9, cool muted」
- **Stable Diffusion XL**: steps 40, CFG 7.5

#### E. 想定画風

- 案 1: 写実的 ✅ 推奨
- 案 2: イラスト調（クリスマスムード非依存）
- 案 3: 水墨画風（冬景色の極み）

---

## 4. 画風バリエーション例（同一コンセプトで画風違い）

東海林さんの選択材料として、**朝の盆栽（morning_bonsai）**を例に、画風違い 3 案を提示。
気に入った画風が決まれば、他の時間帯・季節も同じ画風で揃える。

### 4.1 案 1: 写実的フォトリアル（photorealistic）

#### コンセプト
本物の盆栽を撮影したような、シネマチックな写真。Garden の業務 UI と最も相性が良い。

#### 英語プロンプト
```
A serene Japanese bonsai tree in soft morning mist, gentle golden sunrise light, dewdrops on small green leaves, peaceful zen atmosphere, photorealistic photography, sharp focus on bonsai with soft bokeh background, shot on Sony A7R IV, 85mm lens, golden hour, pink-orange gradient sky, centered composition, no humans, no text --ar 16:9 --v 6 --style raw --stylize 150
```

#### 推奨度
✅ **第一推奨**（業務 UI と相性最良、ブレが少ない）

---

### 4.2 案 2: イラスト調（illustration / soft anime style）

#### コンセプト
柔らかい線と淡い彩色の絵本・アニメ風。新海誠系の朝の光の美しさを意識。

#### 英語プロンプト
```
A serene Japanese bonsai tree in soft morning mist, gentle golden sunrise light, dewdrops on small green leaves, peaceful zen atmosphere, soft anime illustration style, in the style of Makoto Shinkai inspired lighting, watercolor-like soft edges, pastel pink-orange sky, centered composition, no humans, no text --ar 16:9 --v 6 --stylize 400
```

#### 推奨度
○ **第二推奨**（柔らかい印象、ホーム画面向け、業務密度高い画面では浮く可能性）

---

### 4.3 案 3: 水墨画風（sumi-e / ink wash style）

#### コンセプト
墨の濃淡だけで表現する伝統的日本画。ダークモード時に特に映える。

#### 英語プロンプト
```
A minimalist Japanese bonsai tree, traditional sumi-e ink wash painting style, monochromatic black ink with subtle gray gradients, soft morning mist suggested by negative space, zen calligraphy aesthetic, on aged rice paper texture background, centered composition, no humans, no text, no color --ar 16:9 --v 6 --stylize 300
```

#### 推奨度
○ **特殊用途**（ダークモード / 高級感を出したい画面、明るいモードではコントラスト不足の可能性）

---

### 4.4 画風選定のガイド

| 画風 | 業務 UI との相性 | ダーク対応 | 制作難易度 |
|---|---|---|---|
| 写実的 | ◎ 自然に馴染む | ○ 黒30%オーバーレイで対応 | ◎ 安定 |
| イラスト | ○ 印象的だが好み分かれる | △ 元から淡い場合追加調整必要 | ○ 比較的安定 |
| 水墨画 | △ 業務密度高画面では浮く | ◎ ダーク時の高級感 | △ 良作引きに運要素 |

**推奨運用**: ホーム画面・ログイン画面 → **写実的**で揃える。盆栽詳細・観賞用ページ → 水墨画風を別途用意するハイブリッド。

---

## 5. 後道さんへの提示時の注意

### 5.1 提示パッケージ

東海林さんが後道さんに見せる際の推奨セット：

1. **画風 3 案**（朝コンセプトで写実 / イラスト / 水墨画）→ まず画風決定
2. **画風決定後の時間帯 4 種**（朝・昼・夕・夜）→ 完全セット感を確認
3. **画風決定後の季節 4 種**（春・夏・秋・冬）→ ランダム拡張版

### 5.2 提示時のメッセージ例

```
Garden の盆栽中心ビュー、画像案できました。

まず画風を 3 つ用意しました（朝の盆栽で比較）：
- 案 A: 写実的（写真風）
- 案 B: イラスト調（絵本風）
- 案 C: 水墨画風（モノトーン）

気に入った画風があれば、その画風で時間帯 4 種・季節 4 種を揃えます。
全部却下でも OK、別の方向性で再生成します。
```

### 5.3 NG パターンの明示

- 「気に入らなければ別バリエーション可」と必ず添える
- 5+ パターン並べて選定 → 1 つ選ぶか、ハイブリッドで構わない
- 全部却下も OK、その場合は再生成（コンセプトから見直し）
- 後道さん UX 採用ゲートなので、**設計者の好み優先**で問題なし

---

## 6. ファイル運用

### 6.1 命名規則

```
cross-ui/bonsai/{slot}.webp

slot:
- 時間帯: morning / noon / evening / night
- 季節:   spring / summer / autumn / winter
- 拡張:   random_a / random_b ...（複数案併用時）
```

例:
- `cross-ui/bonsai/morning.webp`
- `cross-ui/bonsai/spring_sakura.webp`

### 6.2 Storage 配置（想定）

```
Supabase Storage:
  bucket: cross-ui (public read)
  path:   bonsai/{slot}.webp
  CDN:    Vercel エッジキャッシュで配信
```

### 6.3 Git 管理方針

- 画像本体は **Git に入れない**（リポジトリ肥大化回避）
- `docs/specs/cross-ui-04-image-generation-prompts.md`（本ファイル）と `docs/specs/2026-04-25-cross-ui-04-time-theme.md` のみ Git 管理
- 生成画像は `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\Garden\cross-ui-assets\` 等の Drive に原本保存
- WebP 化＋ Supabase Storage アップロードは別タスクで実施

### 6.4 将来の拡張余地

- ユーザーごとのカスタム画像登録（cross-ui-03 で対応）
- 同時間帯の複数案ランダム（朝 A / 朝 B / 朝 C を日次切替）
- 動画化（CSS animation / Lottie）→ ただし業務 UI では避ける方針

---

## 7. 完成後の検証チェックリスト

生成画像を採用前に以下を確認：

- [ ] 16:9 アスペクト比（1920x1080 以上）
- [ ] 中央に盆栽 1 本のみ
- [ ] 中央 ±20% 帯はテキスト配置可能な低密度
- [ ] WebP < 200 KB
- [ ] 文字・透かし・人物が映り込んでいない
- [ ] 同シリーズ（時間帯 / 季節）で**画風統一**されている
- [ ] ダークモード時に黒 30% オーバーレイで読みやすい
- [ ] 著作権上問題なし（特定アーティスト風が強すぎない）
- [ ] 後道さん 1 次レビュー OK
- [ ] 東海林さん最終承認

---

## 8. 参考リンク（社内 Drive）

- 親 spec: `docs/specs/2026-04-25-cross-ui-04-time-theme.md`
- 関連: `docs/specs/2026-04-25-cross-ui-01-layout-theme.md`（CSS 変数定義）
- 関連: `docs/specs/2026-04-25-cross-ui-03-personalization.md`（カスタム画像優先順）
- Midjourney v6 公式 docs（パラメータ詳細）
- Stable Diffusion XL native resolution table
- WebP 変換: `cwebp -q 85 input.png -o output.webp`

---

> 本ドキュメントは **a-auto / Task I**（後道さん UX 採用ゲート反映、GW 中の盆栽中心ビュー実装準備）として作成。
> 画像生成自体は東海林さん作業 / 選定責任者は東海林さん（後道さんへの提示前）。
> プロンプトの追記・改訂歓迎、ただし採用画風が決まったら他のすべてを同画風で揃える運用を推奨。
