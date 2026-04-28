# a-bloom-002 dispatch v2.8a 仕様反映 - HTML/CSS v2.8a → Next.js 完全移植 - 2026-04-28

> 起草: a-main-009
> 用途: 5/5 後道さんデモ前に、Garden 全体ホーム画面 (`/`) を HTML/CSS v2.8a 仕様で全面書き換え
> 前提: ChatGPT Chat と東海林さんが 4/27-4/28 で v2.8a プロトタイプ完成、Next.js 移植引き継ぎ書 + DESIGN_SPEC + TODO_BACKLOG 受領

## 投下短文（東海林さんが a-bloom-002 にコピペ）

```
【a-main-009 から a-bloom-002 へ】v2.8a 仕様 全面書換 dispatch（5/5 デモ前完成目標）

▼ 経緯
- ChatGPT Chat と東海林さんが 4/27-4/28 で HTML/CSS v2.8a プロトタイプ完成
- 引き継ぎ書 README.md / DESIGN_SPEC.md / TODO_BACKLOG.md を受領
- 既存 V7-D 画像 overlay モード → v2.8a 仕様（CSS 変数 + フォント + 動的機能完備）に切替
- 5/5 後道さんデモ前完成目標（4/28-5/3）

▼ 参照ファイル（Google Drive、必読）

G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\015_Gardenシリーズ\000_GardenUI\
├── README.md              # 全体引き継ぎ書（25,762 bytes）
├── DESIGN_SPEC.md         # デザイン仕様正典（19,791 bytes、CSS 変数+フォント+寸法+JS仕様）
├── TODO_BACKLOG.md        # 残作業リスト P0-P3
├── index.html             # v2.8a HTML 完成版
├── css/style.css          # v2.8a CSS 完成版
└── images/                # 画像アセット 全カテゴリ揃い（icons/ menu_icons/ header_icons/ theme_icons/ backgrounds/ decor/ avatar/ logo/）

▼ 実装範囲（5/5 まで）

P0 全部（README.md §1-1〜1-5、TODO_BACKLOG.md §1）:

1. CSS 変数 → app/globals.css 移植（ライト+ダーク両モード）
2. tailwind.config.ts に CSS 変数連携
3. Google Fonts → next/font 設定（EB Garamond / Cormorant Garamond / Shippori Mincho / Noto Serif JP）
4. 画像アセット移植（v2.8a images/ → public/images/）
5. コンポーネント実装:
   - layout/Topbar.tsx（ロゴ+検索+日付+天気+システム正常+音+テーマ+ベル+ユーザー）
   - layout/Sidebar.tsx（7 menu + Help カード）
   - layout/BackgroundLayer.tsx（5 背景フェード切替+クリック検知）
   - home/Greeting.tsx（時刻別挨拶 + 芽アイコン）
   - home/KpiGrid.tsx + KpiCard.tsx（4 type variant）
   - home/OrbGrid.tsx + OrbCard.tsx（12 ガラス玉、ホバー+クリック演出）
   - home/ActivityPanel.tsx（5 mock entry + 通知設定 + 高さ自動調整 JS）
6. JS 機能:
   - lib/theme/（next-themes、ライト/ダーク切替）
   - lib/sound/（Web Audio API、ホバー/クリック「ポン」音）
   - lib/weather/（時刻ベース 6 種切替、setWeather() 関数）
   - lib/background/（5 背景配列+フェード+クリック検知）
   - useActivityHeight フック（top+bottom 両端固定+JS 実測補正）

▼ 既存 V7-D との違い

| 観点 | V7-D 画像 overlay | v2.8a 仕様 |
|---|---|---|
| 実装方式 | v4 画像背景化 + 透明 hit area | HTML 構造 + CSS 変数 + コンポーネント |
| ダーク/ライト | 未対応 | next-themes で完全対応 |
| フォント | デフォルト | EB Garamond / Cormorant / Shippori Mincho 切替 |
| 背景 | v4 画像 1 枚 | 5 ライト + 1 ダーク 動的切替 |
| 動的機能 | hover scale + ring | 音演出 + 天気切替 + Activity 高さ自動 |
| 保守性 | 画像変更で全面差替 | コンポーネント単位で更新可 |

▼ 実装ステップ（推奨順、5 段階）

Step 1: CSS / フォント基盤（0.3d）
- globals.css に CSS 変数フル移植
- tailwind.config.ts 連携
- next/font で Google Fonts 4 種設定

Step 2: 画像アセット移植（0.1d）
- G:\..\000_GardenUI\images\ → public/images/ にコピー
- 全カテゴリ（icons/ menu_icons/ header_icons/ theme_icons/ backgrounds/ decor/ avatar/ logo/）

Step 3: 静的コンポーネント実装（0.5d）
- Topbar / Sidebar / Greeting / KpiCard / OrbCard / ActivityPanel
- v2.8a HTML/CSS をそのまま JSX 化

Step 4: 動的機能 JS 実装（0.5d）
- BackgroundLayer 5 背景切替 + クリック検知
- 音演出 Web Audio API ラッパー
- 天気 時刻ベース 6 種切替
- Activity 高さ自動調整 useEffect

Step 5: ダークモード + 仕上げ（0.2d）
- next-themes 統合
- 全コンポーネントで CSS 変数で自動追従
- localhost:3002 で東海林さん最終確認

合計 1.6d、5/5 まで余裕。

▼ 既存 V7-D の扱い

- src/app/page.tsx を v2.8a 仕様で全面書換
- 旧 ModuleHitAreas（page.tsx 内 inline）は @deprecated コメント追加 → 削除しない（CLAUDE.md ファイル削除厳禁）
- 既存 Sidebar.tsx / AppHeader.tsx / KpiCard.tsx / TodaysActivity.tsx / ModuleGrid.tsx は v2.8a 仕様で**書き換え**（新規ファイルではなく既存上書き）or 旧版を別名保存して新規作成
- 別名保存ルール（CLAUDE.md）: 既存ファイル更新時は `元ファイル名_YYYYMMDDHHMMSS.tsx` で別名保存

▼ 注意事項

- ファイル削除厳禁（CLAUDE.md ルール）
- 修正時は別名保存（YYYYMMDDHHMMSS）
- 専門用語禁止、commit message は中学生でも分かる言葉
- A 案 / B 案で迷ったら東海林さんに確認
- JS 提案時はコメント全削除（v2.8a の JS をそのまま移植時もコメント削除推奨）
- push 禁止（GitHub Team プラン課金 48h block 中、~4/29 夕方解除見込み）
- ローカル commit 単位で SHA 共有

▼ 完了基準

- [ ] localhost:3002 で v2.8a HTML/CSS 完成版と完全同じ見た目
- [ ] ライト/ダーク切替 動作
- [ ] 5 背景切替（クリック）動作
- [ ] 音演出（ホバー/クリック）動作
- [ ] 天気時刻ベース切替 動作
- [ ] Activity 高さ自動調整 動作
- [ ] 全テスト pass + TS / ESLint 0 errors
- [ ] 12 module hit area click で各モジュール遷移（既存 V7-D-fix の遷移ロジック維持）

▼ 完了報告先

各 step 完了で a-main-009 に SHA 共有 + localhost 動作確認結果報告。
```

## 詳細 spec（a-bloom-002 が読む本文）

### Step 1: CSS / フォント基盤（0.3d）

#### 1-1. globals.css に CSS 変数フル移植

DESIGN_SPEC.md §1-1（ライト）+ §1-2（ダーク）をそのまま `app/globals.css` に貼付:

```css
/* app/globals.css */
:root,
[data-theme="light"] {
  --bg-paper: #f5f0e1;
  --bg-paper-soft: #faf6ec;
  --bg-card: rgba(255, 253, 245, 0.70);
  /* ... DESIGN_SPEC.md §1-1 全変数 */
}

[data-theme="dark"] {
  --bg-paper: #1f2419;
  /* ... DESIGN_SPEC.md §1-2 全変数 */
}
```

#### 1-2. tailwind.config.ts 連携

```typescript
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        'bg-paper': 'var(--bg-paper)',
        'bg-card': 'var(--bg-card)',
        'text-main': 'var(--text-main)',
        'text-sub': 'var(--text-sub)',
        'accent-green': 'var(--accent-green)',
        'accent-green-d': 'var(--accent-green-d)',
        'accent-gold': 'var(--accent-gold)',
        'accent-blue': 'var(--accent-blue)',
        'accent-pink': 'var(--accent-pink)',
        'text-warning': 'var(--text-warning)',
      },
      borderRadius: {
        'card': '20px',
        'input': '12px',
      },
      fontFamily: {
        'mincho': ['Shippori Mincho', 'Noto Serif JP', 'serif'],
        'serif-jp': ['Noto Serif JP', 'system-ui', 'sans-serif'],
        'serif-en': ['Cormorant Garamond', 'EB Garamond', 'serif'],
        'numeric': ['EB Garamond', 'Cormorant Garamond', 'Noto Serif JP', 'serif'],
      },
    },
  },
};
```

#### 1-3. next/font 設定

```typescript
// app/layout.tsx
import { Cormorant_Garamond, EB_Garamond, Noto_Serif_JP, Shippori_Mincho } from 'next/font/google';

const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['300', '400', '500', '600'], variable: '--font-cormorant' });
const ebGaramond = EB_Garamond({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-eb-garamond' });
const notoSerifJP = Noto_Serif_JP({ subsets: ['latin'], weight: ['300', '400', '500', '600'], variable: '--font-noto-serif-jp' });
const shippori = Shippori_Mincho({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-shippori' });

// body className に variable を全部追加
```

#### 1-4. 数字専用クラス

```css
.font-numeric {
  font-family: 'EB Garamond', 'Cormorant Garamond', 'Noto Serif JP', serif;
  font-variant-numeric: tabular-nums lining-nums;
  font-feature-settings: 'tnum' 1, 'lnum' 1;
}
```

DESIGN_SPEC.md §2-3 該当 9 クラス（kpi-value / kpi-trend / kpi-sub / activity-time 等）に適用。

### Step 2: 画像アセット移植（0.1d）

```bash
# Bash で実行
SRC="G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/015_Gardenシリーズ/000_GardenUI/images"
DEST="C:/garden/a-bloom-002/public/images"

cp -r "$SRC/icons" "$DEST/"
cp -r "$SRC/menu_icons" "$DEST/"
cp -r "$SRC/header_icons" "$DEST/"
cp -r "$SRC/theme_icons" "$DEST/"
cp -r "$SRC/backgrounds" "$DEST/"
cp -r "$SRC/decor" "$DEST/"
cp -r "$SRC/avatar" "$DEST/"
cp -r "$SRC/logo" "$DEST/"
```

既存 atmospheres/ + module-icons/ + garden-home-bg-v2.png 等は **削除しない**（CLAUDE.md ルール）。新規 v2.8a アセットと並存。

### Step 3: 静的コンポーネント実装（0.5d）

#### 3-1. layout/Topbar.tsx

DESIGN_SPEC.md §4-1 構造:

```tsx
<header className="topbar">
  <div className="topbar-brand">
    <Image src="/images/logo/garden_logo.png" alt="Garden Series" width={48} height={48} />
    <div>
      <h1 className="topbar-brand-name">Garden Series</h1>
      <p className="topbar-brand-tagline">業務を、育てる。/ Grow Your Business.</p>
    </div>
  </div>
  <SearchBox />
  <TopbarInfo>
    <DateInfo />
    <WeatherInfo />
    <SystemStatusInfo />
    <SoundToggle />
    <ThemeToggle />
    <NotificationBell />
    <UserAvatar />
  </TopbarInfo>
</header>
```

#### 3-2. layout/Sidebar.tsx

```tsx
<aside className="sidebar">
  <nav>
    <SidebarItem icon="/images/menu_icons/menu_01_home.png" label="ホーム" href="/" active />
    <SidebarItem icon="/images/menu_icons/menu_02_dashboard.png" label="ダッシュボード" href="/dashboard" />
    {/* 7 項目 */}
  </nav>
  <HelpCard />
</aside>
```

#### 3-3. home/Greeting.tsx

```tsx
<section className="greeting">
  <h2 className="greeting-title font-mincho">
    {userName}さん、{timeBasedGreeting()}
    <Image src="/images/decor/greeting_sprout.png" alt="" className="leaf-icon" width={38} height={38} />
  </h2>
  <p className="greeting-sub">今日も素敵な一日を。業務の成長をサポートします。</p>
</section>
```

`timeBasedGreeting()`:
- 5-10 時: おはようございます
- 10-17 時: こんにちは
- 17 時以降: こんばんは

#### 3-4. home/KpiCard.tsx（4 type variant）

DESIGN_SPEC.md §4-4 に基づき、`type: 'sales' | 'income' | 'achievement' | 'warning'` の variant 実装。

#### 3-5. home/OrbCard.tsx（12 ガラス玉）

```tsx
<Link href={module.href} className="orb-card">
  <Image src={`/images/icons/${module.id}.png`} alt={module.nameEn} className="orb-img" width={96} height={96} />
  <div className="orb-text">
    <h3 className="font-serif-en">{module.nameEn}</h3>
    <p>{module.description}</p>
    <div className="orb-status">
      <span className="orb-status-label">{module.statusLabel}</span>
      <span className={`orb-status-value ${module.statusClass}`}>{module.statusValue}</span>
    </div>
  </div>
</Link>
```

CLAUDE.md 1-12 順 + 3 layer 縦階層配置。

#### 3-6. home/ActivityPanel.tsx

5 mock entry（DESIGN_SPEC.md §4-6 構造）+ 通知設定ボタン。

### Step 4: 動的機能 JS 実装（0.5d）

#### 4-1. lib/background/

```typescript
// lib/background/useBackgroundCycle.ts
const lightBackgrounds = [
  '/images/backgrounds/bg_01_morning.png',
  '/images/backgrounds/bg_02_water.png',
  '/images/backgrounds/bg_03_glassdisk.png',
  '/images/backgrounds/bg_04_crystal.png',
  '/images/backgrounds/bg_05_sunlight.png',
];
const darkBackground = '/images/backgrounds/bg_06_night.png';

export function useBackgroundCycle() {
  const { theme } = useTheme();
  const [bgIndex, setBgIndex] = useState(0);
  const [activeLayer, setActiveLayer] = useState<1 | 2>(1);

  const nextBackground = () => {
    if (theme === 'dark') return;
    setBgIndex((i) => (i + 1) % lightBackgrounds.length);
    setActiveLayer((l) => (l === 1 ? 2 : 1));
  };

  const currentBg = theme === 'dark' ? darkBackground : lightBackgrounds[bgIndex];
  return { currentBg, activeLayer, nextBackground };
}
```

#### 4-2. lib/sound/

```typescript
// lib/sound/useSoundFx.ts
export function useSoundFx() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [enabled, setEnabled] = useState(false);

  const playPon = (volume: number) => {
    if (!enabled) return;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  };

  return { enabled, setEnabled, playHover: () => playPon(0.08), playClick: () => playPon(0.13) };
}
```

#### 4-3. lib/weather/

```typescript
// lib/weather/getWeatherByHour.ts
export function getWeatherByHour(hour: number = new Date().getHours()): WeatherKey {
  if (hour >= 5 && hour < 9) return 'sunny';
  if (hour >= 9 && hour < 13) return 'partly_cloudy';
  if (hour >= 13 && hour < 16) return 'cloudy';
  if (hour >= 16 && hour < 19) return 'partly_cloudy';
  if (hour >= 19 && hour < 22) return 'cloudy';
  return 'rain';
}

const weatherMap: Record<WeatherKey, { icon: string; label: string }> = {
  sunny: { icon: '/images/header_icons/weather_01_sunny.png', label: '晴れ' },
  partly_cloudy: { icon: '/images/header_icons/weather_02_partly_cloudy.png', label: '晴れ時々曇り' },
  cloudy: { icon: '/images/header_icons/weather_03_cloudy.png', label: '曇り' },
  rain: { icon: '/images/header_icons/weather_04_rain.png', label: '雨' },
  snow: { icon: '/images/header_icons/weather_05_snow.png', label: '雪' },
  thunder: { icon: '/images/header_icons/weather_06_thunder.png', label: '雷' },
};
```

#### 4-4. useActivityHeight フック

```typescript
// app/_hooks/useActivityHeight.ts
export function useActivityHeight() {
  useEffect(() => {
    const adjust = () => {
      if (window.innerWidth < 1400) return;
      const orbGrid = document.querySelector('.orb-grid');
      const activityPanel = document.querySelector('.activity-panel') as HTMLElement;
      if (!orbGrid || !activityPanel) return;
      const rect = orbGrid.getBoundingClientRect();
      const gridBottom = rect.bottom;
      const viewportBottom = window.innerHeight;
      activityPanel.style.bottom = `${viewportBottom - gridBottom}px`;
    };
    adjust();
    window.addEventListener('resize', adjust);
    return () => window.removeEventListener('resize', adjust);
  }, []);
}
```

### Step 5: ダークモード + 仕上げ（0.2d）

#### 5-1. next-themes 統合

```bash
npm install next-themes
```

```tsx
// app/layout.tsx
import { ThemeProvider } from 'next-themes';

<ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false}>
  {children}
</ThemeProvider>
```

#### 5-2. ThemeToggle

```tsx
// components/layout/ThemeToggle.tsx
'use client';
import { useTheme } from 'next-themes';
import Image from 'next/image';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      <Image
        src={theme === 'dark' ? '/images/theme_icons/theme_moon.png' : '/images/theme_icons/theme_sun.png'}
        alt="theme toggle"
        width={32}
        height={32}
      />
    </button>
  );
}
```

#### 5-3. localhost:3002 動作確認

東海林さんが Ctrl+Shift+R で確認、v2.8a HTML/CSS 完成版と同じ見た目に到達。

### 期待 commit 順（推奨）

1. feat(home): v2.8a Step 1 - CSS 変数 + Tailwind config + next/font 設定
2. feat(home): v2.8a Step 2 - 画像アセット移植
3. feat(home): v2.8a Step 3 - 静的コンポーネント実装（Topbar/Sidebar/Greeting/KPI/Orb/Activity）
4. feat(home): v2.8a Step 4 - 動的機能（背景切替 + 音 + 天気 + Activity 高さ）
5. feat(home): v2.8a Step 5 - next-themes ダークモード対応 + 最終調整

合計 5 commits、ローカルのみ（push は GitHub Team プラン解除後）。

## post-5/5 後の追加対応

V7-F（実 API 連携）を v2.8a 仕様の上で実装:
- KPI 実 API 連携（モック値 → Bud / Tree / Bloom / Forest）
- Today's Activity 実データ（bloom_notifications）
- 天気 API（OpenWeatherMap、`/api/weather`）
- 動的 user 名 / role（root_employees + Fruit）
- /home route 整備
- /login/forgot 実装

## 改訂履歴

- 2026-04-28 初版（a-main-009、v2.8a HTML/CSS → Next.js 完全移植 dispatch、5/5 デモ前完成目標）
