# Garden Series — デザイン仕様書

> このドキュメントは Garden Series ホーム画面 v2.8a の**デザインの正典**です。
> Next.js 移植時、Tailwind config やコンポーネント設計の元情報として使用してください。

---

## 1. カラーパレット

### 1-1. 全 CSS 変数（ライトモード）

```css
:root,
[data-theme="light"] {
  /* === 背景 === */
  --bg-paper:        #f5f0e1;             /* 和紙基調・ベース背景 */
  --bg-paper-soft:   #faf6ec;             /* 和紙の柔らかい派生色 */
  --bg-card:         rgba(255, 253, 245, 0.70);   /* カード（半透明） */
  --bg-card-hover:   rgba(255, 253, 245, 0.90);
  --bg-card-solid:   #fdfbf3;             /* カード（不透明） */
  --bg-sidebar:      rgba(250, 246, 236, 0.65);
  --bg-activity:     rgba(255, 253, 245, 0.75);
  --bg-overlay:      rgba(245, 240, 225, 0.18);

  /* === テキスト === */
  --text-main:       #4a4233;             /* 本文・メイン */
  --text-sub:        #8a7f6a;             /* 副次的 */
  --text-muted:      #b3a98f;             /* 控えめ */
  --text-accent:     #7a9968;             /* アクセント（生命感の緑） */
  --text-warning:    #c95a4a;             /* 警告 */
  --text-success:    #7a9968;             /* 成功 */
  --text-info:       #5a8fa8;             /* 情報 */

  /* === 罫線 === */
  --border-soft:     rgba(154, 138, 105, 0.22);
  --border-card:     rgba(154, 138, 105, 0.28);

  /* === アクセントカラー === */
  --accent-green:    #9bb88a;             /* 葉の若緑 */
  --accent-green-d:  #7a9968;             /* 苔緑（深め） */
  --accent-gold:     #d4a541;             /* 実りの金 */
  --accent-blue:     #8ab4cc;             /* 水の青 */
  --accent-pink:     #e8b4b8;             /* 花の桃 */

  /* === 影 === */
  --shadow-soft:      0 4px 20px rgba(120, 100, 70, 0.08);
  --shadow-card:      0 6px 24px rgba(120, 100, 70, 0.10);
  --shadow-hover:     0 16px 44px rgba(120, 100, 70, 0.20);
  --shadow-orb-hover: 0 20px 50px rgba(120, 100, 70, 0.25);
  --shadow-floating:  0 12px 40px rgba(120, 100, 70, 0.18);
}
```

### 1-2. 全 CSS 変数（ダークモード）

```css
[data-theme="dark"] {
  --bg-paper:        #1f2419;             /* 深い苔緑 */
  --bg-paper-soft:   #2a302a;
  --bg-card:         rgba(38, 44, 32, 0.55);
  --bg-card-hover:   rgba(50, 58, 42, 0.85);
  --bg-card-solid:   #2c322a;
  --bg-sidebar:      rgba(30, 36, 24, 0.6);
  --bg-activity:     rgba(38, 44, 32, 0.7);
  --bg-overlay:      rgba(25, 30, 20, 0.25);

  --text-main:       #e0d8c5;
  --text-sub:        #a8a08c;
  --text-muted:      #7a7460;
  --text-accent:     #b8d4a8;
  --text-warning:    #e89888;
  --text-success:    #b8d4a8;
  --text-info:       #98c4dc;

  --border-soft:     rgba(212, 200, 165, 0.15);
  --border-card:     rgba(212, 200, 165, 0.20);

  --accent-green:    #a8c898;
  --accent-green-d:  #b8d4a8;
  --accent-gold:     #e4b551;
  --accent-blue:     #98c4dc;
  --accent-pink:     #d8a4a8;

  --shadow-soft:     0 4px 20px rgba(0, 0, 0, 0.30);
  --shadow-card:     0 6px 24px rgba(0, 0, 0, 0.40);
  --shadow-hover:    0 16px 44px rgba(0, 0, 0, 0.55);
  --shadow-orb-hover: 0 20px 50px rgba(0, 0, 0, 0.65);
  --shadow-floating: 0 12px 40px rgba(0, 0, 0, 0.50);
}
```

### 1-3. カラー設計の意味

| 色 | 意味 | 使われる場面 |
|---|---|---|
| 和紙色（#f5f0e1） | 「業務の始まりの白紙」 | 全体背景 |
| 苔緑（#7a9968） | 「生命・成長」 | 緑系アクセント、ポジティブ指標 |
| 実りの金（#d4a541） | 「成果・成功」 | 達成率、お知らせアイコン |
| 水の青（#8ab4cc） | 「流れ・データ」 | グラフ、情報系 |
| 花の桃（#e8b4b8） | 「華やぎ・新鮮さ」 | 通知バッジ等 |
| 警告の赤（#c95a4a） | 「注意・期限」 | エラー・警告 |

---

## 2. フォントシステム

### 2-1. 読込（Google Fonts CDN）

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400;1,500&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Noto+Serif+JP:wght@300;400;500;600&family=Shippori+Mincho:wght@400;500;600&display=swap" rel="stylesheet">
```

### 2-2. 用途別フォント割り当て

| 用途 | 第1選択 | 第2選択 | フォールバック |
|---|---|---|---|
| 大見出し（挨拶等） | Shippori Mincho | Noto Serif JP | serif |
| 中見出し（モジュール名等） | Cormorant Garamond | EB Garamond | serif |
| 日本語本文 | Noto Serif JP | system-ui | sans-serif |
| **数字（KPI等）** | **EB Garamond** | Cormorant Garamond | serif |
| **数字混在の本文** | **EB Garamond** | Noto Serif JP | serif |
| ブランド名（Garden Series） | Cormorant Garamond | - | serif |
| 英字（Bloom, Forest等） | Cormorant Garamond | - | serif |

### 2-3. 数字専用フォントスタック（重要）

v2.8で確立した、**数字を含む全ての要素**に適用する原則：

```css
font-family: 'EB Garamond', 'Cormorant Garamond', 'Noto Serif JP', serif;
font-variant-numeric: tabular-nums lining-nums;
font-feature-settings: 'tnum' 1, 'lnum' 1;
```

> **理由**：Cormorant Garamond はオールドスタイル数字（高さがバラつく）がデフォルトで、`lnum` フィーチャーを公式サポートしない。EB Garamond は `tnum`（等幅）と `lnum`（高さ揃え）を公式サポートしているため、業務システムの数字表示に最適。

---

## 3. レイアウト寸法（1920×1080想定）

### 3-1. 全体レイアウト

```
┌──────────────────────────────────────────────────┐
│ Topbar (height: 80px)                            │
├──────────┬───────────────────────┬────────────────┤
│          │                       │                │
│ Sidebar  │  Main Content         │  Activity      │
│ (210px)  │  (padding: 32px)      │  Panel (340px) │
│          │                       │  fixed         │
│          │                       │                │
└──────────┴───────────────────────┴────────────────┘
```

### 3-2. CSS 変数（レイアウト用）

```css
:root {
  --radius-card:     20px;
  --radius-input:    12px;
  --radius-pill:     999px;
  --sidebar-w:       210px;
  --topbar-h:        80px;

  /* === レイアウト寸法変数（v2.8a） === */
  --kpi-card-h:      144px;        /* KPIカード参考値（実際は内容で伸びる） */
  --kpi-grid-mb:     18px;
  --orb-card-h:      140px;        /* ガラス玉カード固定高 */
  --orb-grid-rows:   3;
  --orb-grid-gap:    14px;
}
```

### 3-3. メインエリア

| 項目 | 値 |
|---|---|
| margin-left | `var(--sidebar-w)` (210px) |
| padding | `calc(var(--topbar-h) + 24px) 32px 32px` |

### 3-4. KPI カードグリッド

| 項目 | 値 |
|---|---|
| display | grid |
| grid-template-columns | `repeat(4, 1fr)` |
| gap | 14px |
| margin-bottom | 18px |

### 3-5. ガラス玉カードグリッド

| 項目 | 値 |
|---|---|
| display | grid |
| grid-template-columns | `repeat(4, 1fr)` |
| gap | 14px |
| 1カードの height | 140px |
| 1カードの padding | 16px 18px |
| 1カード内 grid | `grid-template-columns: 96px 1fr` |

### 3-6. Activity Panel

| 項目 | 値 |
|---|---|
| position | fixed |
| top | 194px |
| right | 32px |
| bottom | 32px (JSで実測補正) |
| width | 340px |
| padding | 20px 22px 16px |
| display | flex / column |

### 3-7. ブレイクポイント

| ブレイクポイント | レイアウト |
|---|---|
| min-width: 1400px | 通常（4列・Activity右fixed） |
| max-width: 1399px | 縮小（2列・Activity下に縦積み） |

---

## 4. コンポーネント一覧

### 4-1. Topbar（上部バー）

**構造**：
```
[ロゴ + ブランド名]  [検索ボックス]  [日付][天気][ステータス][音][テーマ]
```

**主要クラス**：
- `.topbar` — コンテナ
- `.topbar-brand-logo` — ロゴ画像（48×48）
- `.topbar-brand-name` — "Garden Series"（Cormorant）
- `.topbar-brand-tagline` — "業務を、育てる。"
- `.search-box` — 検索ボックス（角丸 12px）
- `.topbar-info` — 右側の情報群
- `.info-item` — 個別情報（カレンダー、天気等）
- `.sound-toggle`, `.theme-toggle` — 切替ボタン

### 4-2. Sidebar（左サイドバー）

**構造**：
```
[ナビゲーション7項目]
[Help & Tips カード]
```

**主要クラス**：
- `.sidebar` — コンテナ
- `.nav-item` — ナビ項目
- `.nav-icon` — アイコン画像
- `.nav-label` — テキストラベル
- `.help-card` — 下部のHelpカード

**メニュー項目**（順番）：
1. ホーム（`menu_01_home.png`）
2. ダッシュボード（`menu_02_dashboard.png`）
3. 取引（`menu_03_transactions.png`）
4. 顧客（`menu_04_customers.png`）
5. ワークフロー（`menu_05_workflow.png`）
6. レポート（`menu_06_reports.png`）
7. 設定（`menu_07_settings.png`）

### 4-3. Greeting（挨拶セクション）

**構造**：
```
東海林さん、おはようございます 🌱
今日も素敵な一日を。業務の成長をサポートします。
```

**主要クラス**：
- `.greeting` — コンテナ（margin-bottom: 20px）
- `.greeting-title` — メインタイトル（Shippori Mincho, 1.85rem）
- `.leaf-icon` — 横の芽アイコン（38×38、画像）
- `.greeting-sub` — サブテキスト

**動的化方針**：
- 時刻に応じて挨拶を変える（おはよう/こんにちは/こんばんは）
- ユーザー名は Supabase の認証情報から動的取得

### 4-4. KPIカード

**構造**（4種類）：

#### Type A: 売上系（KPI値 + トレンド + チャート）
```
[ラベル]
[¥12,680,000]
[前月比 ↑ 12.5%]
[折れ線グラフ]
```

#### Type B: 入金予定系（KPI値 + トレンド + 棒グラフ）
```
[ラベル]
[¥8,450,000]
[前月比 ↑ 8.3%]
[棒グラフ12本]
```

#### Type C: 達成率系（KPI値 + リング + サブ）
```
[ラベル]            [リング進捗]
[68%]
[完了 34 / 50 件]
```

#### Type D: 警告系（KPI値 + 警告 + プログレス）
```
[ラベル]
[24件]
[期限超過 5 件]
[プログレスバー 82%]
```

**主要クラス**：
- `.kpi-card` — 個別カード
- `.kpi-label` — タイトル
- `.kpi-value` — メインの数字
- `.kpi-trend.up` / `.kpi-trend.down` — トレンド表示
- `.kpi-chart` — 折れ線SVG
- `.kpi-bars` — 棒グラフコンテナ
- `.ring-progress` — リング進捗SVG
- `.kpi-warning` — 警告表示
- `.kpi-progress` — プログレスバー

### 4-5. ガラス玉カード（Orb Card）

**構造**：
```
[ガラス玉画像]  [モジュール名]
                [説明]
                ─────────────
                [ステータスラベル][値]
```

**主要クラス**：
- `.orb-grid` — グリッドコンテナ（4列×3段）
- `.orb-card` — 個別カード（140px固定）
- `.orb-img` — ガラス玉画像（96×96）
- `.orb-text` — 右側テキスト
- `.orb-text h3` — モジュール名（Cormorant Garamond）
- `.orb-text p` — 説明
- `.orb-status` — ステータス行
- `.orb-status-value.alert` — 警告色
- `.orb-status-value.warn` — 注意色

**ホバー演出**：
- `transform: translateY(-6px) scale(1.025)`
- `box-shadow: var(--shadow-orb-hover)`
- 上面の光沢グラデーションが`opacity: 1`に

### 4-6. Activity Panel（浮島カード）

**構造**：
```
[Today's Activity]      [すべて表示]
─────────────────────────────────────
[時刻][アイコン][本文と詳細]
[時刻][アイコン][本文と詳細]
...（5件）
─────────────────────────────────────
[⚙ 通知設定をカスタマイズ        >]
```

**主要クラス**：
- `.activity-panel` — 浮島カード本体
- `.activity-header` — 上部
- `.activity-title` — 左タイトル群
- `.activity-all` — 「すべて表示」ボタン
- `.activity-list` — リストコンテナ（flex:1, overflow-y:auto）
- `.activity-item` — 個別アクティビティ
- `.activity-time` — 時刻（EB Garamond）
- `.activity-icon` — 左アイコン（32×32）
- `.activity-icon-check` — ✓マーク
- `.activity-body` — 右本文
- `.notify-btn` — 下部の通知設定ボタン

### 4-7. Background Layer（背景レイヤー）

**構造**：
```
<div class="bg-layer" id="bgLayer1">  ← フェード切替用
<div class="bg-layer" id="bgLayer2">
<div class="bg-layer-overlay">         ← 全体の薄被せ
<div class="bg-click-zone">            ← クリック検知ゾーン
```

**動作**：
- ライトモード：5枚を順次フェード切替
- ダークモード：1枚固定
- 切替はクリックで発火

---

## 5. アイコン一覧

### 5-1. ガラス玉アイコン（12種）`images/icons/`

| ファイル名 | モジュール | 説明 |
|---|---|---|
| bloom.png | Bloom | 花のガラス玉 |
| bud.png | Bud | 蕾のガラス玉 |
| calendar.png | Calendar | 暦のガラス玉 |
| forest.png | Forest | 森のガラス玉 |
| fruit.png | Fruit | 実のガラス玉 |
| leaf.png | Leaf | 葉のガラス玉 |
| rill.png | Rill | 川のガラス玉 |
| root.png | Root | 根のガラス玉 |
| seed.png | Seed | 種のガラス玉 |
| soil.png | Soil | 土のガラス玉 |
| sprout.png | Sprout | 芽のガラス玉 |
| tree.png | Tree | 木のガラス玉 |

### 5-2. メニューアイコン（7種）`images/menu_icons/`

| ファイル名 | 用途 |
|---|---|
| menu_01_home.png | ホーム |
| menu_02_dashboard.png | ダッシュボード |
| menu_03_transactions.png | 取引 |
| menu_04_customers.png | 顧客 |
| menu_05_workflow.png | ワークフロー |
| menu_06_reports.png | レポート |
| menu_07_settings.png | 設定 |

### 5-3. ヘッダーアイコン（4種）`images/header_icons/`

| ファイル名 | 用途 |
|---|---|
| header_search.png | 検索ボックスのアイコン |
| header_calendar.png | 日付横のアイコン |
| header_bell.png | 通知ベル |
| header_sound.png | 音ON/OFF |

### 5-4. 天気アイコン（6種）`images/header_icons/`

| ファイル名 | 天気 | 切替キー |
|---|---|---|
| weather_01_sunny.png | 晴れ | `sunny` |
| weather_02_partly_cloudy.png | 晴れ時々曇り | `partly_cloudy` |
| weather_03_cloudy.png | 曇り | `cloudy` |
| weather_04_rain.png | 雨 | `rain` |
| weather_05_snow.png | 雪 | `snow` |
| weather_06_thunder.png | 雷 | `thunder` |

> 補足：当初設計では「霧/もや」も含めた7種類でしたが、v2.8で**設計から除外**されました。

### 5-5. テーマ切替アイコン（2種）`images/theme_icons/`

| ファイル名 | 用途 |
|---|---|
| theme_sun.png | ライトモード時表示 |
| theme_moon.png | ダークモード時表示 |

### 5-6. 背景画像（6種）`images/backgrounds/`

| ファイル名 | 用途 |
|---|---|
| bg_01_morning.png | ライト：朝 |
| bg_02_water.png | ライト：水 |
| bg_03_glassdisk.png | ライト：ガラス玉 |
| bg_04_crystal.png | ライト：クリスタル |
| bg_05_sunlight.png | ライト：陽光 |
| bg_06_night.png | ダーク：夜 |

### 5-7. その他

| カテゴリ | ファイル |
|---|---|
| 装飾 | `images/decor/greeting_sprout.png` |
| アバター | `images/avatar/avatar_shoji.png` |
| ロゴ | `images/logo/garden_logo.png` |

---

## 6. アニメーション

### 6-1. ロード時フェードアップ（fadeUp）

```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

**適用対象と遅延**：
- KPIカード×4：0.10s, 0.18s, 0.26s, 0.34s
- ガラス玉×12：0.40s, 0.45s, 0.50s, 0.55s, 0.58s, 0.61s, 0.64s, 0.67s, 0.70s, 0.73s, 0.76s, 0.79s
- Activity Panel：0.5s

### 6-2. ホバー演出（カード共通）

```css
.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-card);
}

.orb-card:hover {
  transform: translateY(-6px) scale(1.025);
  box-shadow: var(--shadow-orb-hover);
}
```

### 6-3. テーマ切替時のトランジション

すべてのカード・テキスト系要素に：
```css
transition: background 0.6s ease, color 0.6s ease, border-color 0.6s ease;
```

これにより、ライト⇔ダーク切替時に**0.6秒かけて滑らかに**色が変化します。

---

## 7. レスポンシブ対応の現状と方針

### 7-1. 現状（v2.8a）

| 画面幅 | レイアウト |
|---|---|
| 1400px以上 | 通常（4列横並び・Activity右fixed） |
| 1399px以下 | 2列・Activity下に縦積み |

### 7-2. Next.js 移植時の推奨方針

Tailwind の標準ブレイクポイント（`md`, `lg`, `xl`, `2xl`）を活用：

| Tailwind | 画面幅 | 推奨レイアウト |
|---|---|---|
| ~md (~768px) | スマホ | 1列・Activity非表示orモーダル |
| md (768~) | タブレット | 2列・Activityを下に |
| lg (1024~) | 小型PC | 3列・Activityを下に |
| xl (1280~) | PC | 4列・Activityを下or右fixed |
| 2xl (1536~) | デスクトップ | 4列・Activity右fixed（現状の通常レイアウト） |

---

## 8. JavaScript ロジックの仕様（移植必須）

### 8-1. 背景画像切替

- `lightBackgrounds`: 配列（5枚のパス）
- `currentBgIndex`: 現在のインデックス
- `applyBackground(url)`: 2層レイヤーのフェード切替
- クリック検知は `.bg-click-zone` のみ（カード等は除外）

### 8-2. テーマ切替

- `setTheme(theme)`: `<html data-theme="...">` 切替
- `localStorage.garden_theme` に保存
- ダーク時は背景を `bg_06_night.png` に固定

### 8-3. 音演出

- Web Audio API で「ポン」音をリアルタイム生成
- ガラス玉ホバー時：volume 0.08
- ガラス玉クリック時：volume 0.13
- テーマ切替時：volume 0.08

### 8-4. 天気切替（v2.8新規）

- `weatherMap`: 6種類のアイコン+ラベル
- `setWeather(key)`: アイコンとラベルを更新
- `autoWeatherByHour()`: 時刻ベース自動切替
- `window.setWeather` でグローバル公開（手動テスト用）

### 8-5. Activity高さ調整（v2.8a新規）

- `adjustActivityHeight()`: ガラス玉グリッド下端を実測してActivity下端を合わせる
- `load`, `resize` イベントで再計算
- `window.innerWidth < 1400` の場合はスキップ

---

## 9. 過去バージョンの参照

すべての過去バージョンは `css/style_v*.css` および `index_v*.html` にバックアップされています。

| バージョン | 主な特徴 |
|---|---|
| v1.0 | 初版 |
| v2.0 | 6背景+ナイトモード+音 |
| v2.3 | ガラス玉大判化+Activity浮島化 |
| v2.4 | メニューアイコン水彩化 |
| v2.6 | 1920×1080ワンビュー化 |
| v2.7 | ヘッダーアイコン8種追加 |
| v2.8 | 天気6種+EB Garamond+天気切替 |
| **v2.8a** | **Activity高さ自動調整+🌿削除（最終版）** |

---

> 🌱 このデザイン仕様書は、Garden Series の世界観を守りながら、
> Next.js + Supabase の本格実装で迷わないための「設計の正典」です。
