# Cross UI-04: 時間帯テーマ（盆栽 / 樹木中心の世界観画像 5+ パターン × 時間帯）

- 対象: Garden シリーズ全モジュール（ヘッダー / ログイン / ホーム盆栽ビュー背景）
- 優先度: **🔴 高**（後道さん UX 採用ゲートの必須要素、盆栽ビューの背景）
- 見積: **0.6d**（盆栽 / 樹木 中心化で +0.2d）
- 担当セッション: a-main（基盤）+ 各モジュール（適用）
- 作成: 2026-04-25（a-auto 002 / Batch 10 Cross UI #04）
- **改訂: 2026-04-27（a-auto / 後道さん採用ゲート反映、盆栽 / 樹木 中心へ再定義）**
- 前提:
  - UI-01（CSS variables 命名規約、Header レイアウト寸法 §3.2.1）
  - UI-03（カスタム画像との優先順位、メニューバー画像のみ）
  - UI-06（ホーム盆栽ビューの背景として時間帯テーマを使用）

---

## 1. 目的とスコープ

### 目的

Garden の画面に**朝・昼・夕・夜 + ランダム（季節バリエーション）**で **盆栽 / 樹木 中心の世界観画像**を背景として表示し、業務中にも**季節感・時間感・物語性**を持たせる UX を実現する。

従来の「抽象風景 15 枚」を廃し、**盆栽 / 樹木 中心の世界観画像 5+ パターン × 時間帯**に再定義する（後道さん UX 採用ゲート対応）。

### 含める

- **盆栽 / 樹木 中心**の画像アセット仕様（5+ パターン）
- 朝/昼/夕/夜 + ランダム（季節バリエーション含む）
- PC 時刻ベースの時間帯判定ロジック（境界定義）
- 日次ランダム発動の実装
- カスタム画像（UI-03）との優先順位
- ダーク時の黒オーバーレイ自動適用
- **背景画像の独立 layer 設計**（差し替え容易性）

### 含めない

- ヘッダーの構造（UI-01）
- ホーム画面のモジュール配置（UI-06）
- メニューバー画像カスタマイズ（UI-03）
- 達成演出（UI-05）

---

## 2. 5+ パターンの盆栽 / 樹木 中心画像

### 2.1 時間帯と境界（既存維持）

| 時間帯 | 時刻（JST）| コンセプト |
|---|---|---|
| 朝 | 05:00 - 09:00 | 朝もやの中の盆栽、優しい光、オレンジピンクの空 |
| 昼 | 09:00 - 16:00 | 明るい日差しの盆栽、活き活きした緑、青空 |
| 夕 | 16:00 - 19:00 | 夕焼けに染まる盆栽、温かいオレンジ、長い影 |
| 夜 | 19:00 - 05:00 | 月明かりの盆栽、静謐な青、星空 |
| **ランダム** | **日次シード**で上 4 種 + 季節バリエーションから選択 | — |

### 2.2 ランダム時の季節バリエーション（新規）

ランダム発動時、季節感を演出するための追加バリエーション：

| 季節 | コンセプト | 想定発動月 |
|---|---|---|
| 春 | 桜の盆栽、ピンクの花弁が舞う | 3-4 月の確率高 |
| 夏 | 濃緑の盆栽、強い日差し、蝉の気配 | 7-8 月の確率高 |
| 秋 | 紅葉の盆栽、赤と金、落ち葉 | 10-11 月の確率高 |
| 冬 | 雪化粧の盆栽、銀世界、息が白い | 12-1 月の確率高 |

ランダム時の選択ロジック：
- 通常 4 種（朝/昼/夕/夜）+ 現在の季節バリエーション 1 種 = **5 種から日次シードで選択**
- 季節は `getMonth()` で判定（JST、12-2: 冬 / 3-5: 春 / 6-8: 夏 / 9-11: 秋）

### 2.3 境界の厳密化（既存維持）

- 開始時刻 <= 現在時刻 < 次の開始時刻
- 例: 09:00 ちょうどは昼（朝ではない）
- 05:00 未満は「夜」扱い（深夜 00:00 - 05:00）

### 2.4 ランダム発動の日次シード（季節対応）

```ts
// src/components/shared/_lib/dailySeed.ts
export function getDailyRandomTheme(date: Date = new Date()): TimeTheme {
  const dateStr = date.toISOString().slice(0, 10);  // 'YYYY-MM-DD'
  const hash = simpleHash(dateStr);
  const season = getSeason(date);  // 'spring' | 'summer' | 'autumn' | 'winter'
  // 4 時間帯 + 季節バリエーション 1 種 = 5 種から選択
  const options: TimeTheme[] = [
    'morning', 'noon', 'evening', 'night',
    `season-${season}` as TimeTheme,
  ];
  return options[hash % options.length];
}

function getSeason(date: Date): 'spring' | 'summer' | 'autumn' | 'winter' {
  const m = date.getMonth() + 1;  // 1-12
  if (m >= 3 && m <= 5) return 'spring';
  if (m >= 6 && m <= 8) return 'summer';
  if (m >= 9 && m <= 11) return 'autumn';
  return 'winter';
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
```

---

## 3. 画像アセット設計（盆栽 / 樹木 中心）

### 3.1 画像種類 × 用途

| 時間帯 / 季節 | ホーム盆栽ビュー背景 | ログイン背景 | ヘッダー背景 |
|---|---|---|---|
| 朝 | `morning-home.webp` | `morning-login.webp` | `morning-header.webp` |
| 昼 | `noon-home.webp` | `noon-login.webp` | `noon-header.webp` |
| 夕 | `evening-home.webp` | `evening-login.webp` | `evening-header.webp` |
| 夜 | `night-home.webp` | `night-login.webp` | `night-header.webp` |
| 春（季節）| `season-spring-home.webp` | `season-spring-login.webp` | `season-spring-header.webp` |
| 夏（季節）| `season-summer-home.webp` | `season-summer-login.webp` | `season-summer-header.webp` |
| 秋（季節）| `season-autumn-home.webp` | `season-autumn-login.webp` | `season-autumn-header.webp` |
| 冬（季節）| `season-winter-home.webp` | `season-winter-login.webp` | `season-winter-header.webp` |

合計: **8 パターン × 3 用途 = 24 画像**（Phase 1）

GW 期間に間に合わせる場合の最小セット：
- **MVP（4 + 1 季節）= 5 パターン × 3 用途 = 15 画像**
- 残り 3 季節は Phase 2 で順次追加

### 3.2 画像仕様（盆栽 / 樹木 中心）

| 用途 | 推奨アスペクト比 | 解像度 | 形式 | 品質 | サイズ目安 |
|---|---|---|---|---|---|
| ホーム盆栽ビュー背景 | 16:9 | 1920×1080 | WebP（fallback JPEG）| 85 | 200-400 KB |
| ログイン背景 | 16:9 | 1920×1080 | WebP（fallback JPEG）| 85 | 200-400 KB |
| ヘッダー背景 | 約 30:1（横長）| 2048×200 | WebP（fallback JPEG）| 80 | 40-80 KB |

### 3.3 画像コンセプト（共通方針）

**全画像で「盆栽 / 樹木」が中央〜中央付近に配置**：

- ホーム盆栽ビュー背景: 中央付近に盆栽 / 大きな木、周囲は時間帯 / 季節の世界観
- ログイン背景: 同様（盆栽がやや小さくても OK、ログインフォームが中央配置のため）
- ヘッダー背景: 細長い画像のため、盆栽の枝先や葉の一部 / 時間帯の空 が見える程度

**重要: 中央盆栽の位置は UI-06 の ModuleLayer の (0,0) と一致**：
- 背景画像の中央盆栽 = ホーム画面で配置される ModulePin の中心
- ただし座標は ModuleLayer 側が抽象座標で持つため、画像が多少ズレても layout は壊れない

### 3.4 配置パス

```
public/themes/time/
├── morning/
│   ├── home.webp           (1920×1080)
│   ├── home.jpg            (fallback)
│   ├── login.webp
│   ├── login.jpg
│   ├── header.webp         (2048×200)
│   └── header.jpg
├── noon/...
├── evening/...
├── night/...
├── season-spring/...
├── season-summer/...
├── season-autumn/...
└── season-winter/...
```

### 3.5 フォーマット

- **WebP を基準**（JPEG より 25-35% 軽量、ブラウザ対応広い）
- フォールバック JPEG を `<picture>` で提供（古いブラウザ対応）
- プログレッシブ JPEG 推奨（大画面でも段階的表示）

### 3.6 代替テキスト（alt）

- ヘッダー画像は装飾のため `alt=""`
- ログイン背景・ホーム背景も装飾（`aria-hidden="true"`）
- スクリーンリーダーは UI-06 §9.2 で別途案内

---

## 4. 時間帯判定ロジック

### 4.1 中心関数

```ts
// src/components/shared/_lib/timeTheme.ts
export type TimeTheme =
  | 'morning' | 'noon' | 'evening' | 'night'
  | 'season-spring' | 'season-summer' | 'season-autumn' | 'season-winter'
  | 'random' | 'auto';

export function getCurrentTimeTheme(now: Date = new Date()): Exclude<TimeTheme, 'random' | 'auto'> {
  const hour = now.getHours();  // 0-23（ブラウザローカル時刻）
  if (hour >= 5 && hour < 9) return 'morning';
  if (hour >= 9 && hour < 16) return 'noon';
  if (hour >= 16 && hour < 19) return 'evening';
  return 'night';  // 19-04
}

export function resolveTimeTheme(
  userPref: TimeTheme | null,
  now: Date = new Date()
): Exclude<TimeTheme, 'random' | 'auto'> {
  if (userPref === 'random') return getDailyRandomTheme(now);
  if (userPref && userPref !== 'auto' && userPref !== 'random') return userPref;
  return getCurrentTimeTheme(now);
}
```

### 4.2 ユーザー設定

| 設定値 | 挙動 |
|---|---|
| `null` または `'auto'` | PC 時刻に基づく自動切替（既定） |
| `'random'` | 日次ランダム（4 時間帯 + 現在季節 = 5 種）|
| `'morning'` / `'noon'` / `'evening'` / `'night'` | 時間帯固定 |
| `'season-spring'` 〜 `'season-winter'` | 季節固定（隠しテーマ）|

### 4.3 `root_employees` 列追加

```sql
ALTER TABLE root_employees
  ADD COLUMN IF NOT EXISTS ui_time_theme text
    CHECK (ui_time_theme IN (
      'auto', 'random',
      'morning', 'noon', 'evening', 'night',
      'season-spring', 'season-summer', 'season-autumn', 'season-winter'
    ))
    DEFAULT 'auto';
```

---

## 5. 時刻変化の検知と切替

### 5.1 切替タイミング（既存維持）

- ページ読込時: 即座に判定
- SPA 内遷移: Context で共有、毎回再判定
- **1 分毎の `setInterval`**: 時間帯境界通過時に自動切替
- タブが非アクティブ時: `visibilitychange` で再判定

### 5.2 Context 設計

```tsx
// src/components/shared/TimeThemeProvider.tsx
export function TimeThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Exclude<TimeTheme, 'random' | 'auto'>>(
    () => resolveTimeTheme(null)
  );

  useEffect(() => {
    const id = setInterval(() => {
      const next = resolveTimeTheme(getUserPref());
      if (next !== theme) setTheme(next);
    }, 60 * 1000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setTheme(resolveTimeTheme(getUserPref()));
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [theme]);

  return (
    <TimeThemeContext.Provider value={theme}>
      <div data-time-theme={theme}>{children}</div>
    </TimeThemeContext.Provider>
  );
}
```

### 5.3 CSS 側の連動

```css
[data-time-theme="morning"] {
  --header-bg-url: url('/themes/time/morning/header.webp');
  --login-bg-url:  url('/themes/time/morning/login.webp');
  --home-bg-url:   url('/themes/time/morning/home.webp');
}
[data-time-theme="noon"] {
  --header-bg-url: url('/themes/time/noon/header.webp');
  --login-bg-url:  url('/themes/time/noon/login.webp');
  --home-bg-url:   url('/themes/time/noon/home.webp');
}
[data-time-theme="evening"] { /* ... */ }
[data-time-theme="night"]   { /* ... */ }
[data-time-theme="season-spring"]  { /* ... */ }
[data-time-theme="season-summer"]  { /* ... */ }
[data-time-theme="season-autumn"]  { /* ... */ }
[data-time-theme="season-winter"]  { /* ... */ }
```

### 5.4 切替アニメーション

- 時間帯切替時は **500ms fade**
- `background-image` は単純 transition 不可 → 2 層重ねて opacity で fade

```tsx
<div className="time-theme-stack">
  <div style={{ backgroundImage: `url(${prevImage})`, opacity: fading ? 0 : 1 }} />
  <div style={{ backgroundImage: `url(${currentImage})`, opacity: fading ? 1 : 0 }} />
</div>
```

---

## 6. 背景画像の独立 layer 設計（重要）

### 6.1 設計原則（東海林さん指示 2026-04-26）

**背景画像と Layout を完全分離して構築する**：

- 背景画像は独立した `<BackgroundLayer>` コンポーネント（UI-06 §3.2 参照）
- 後道さんの好みで変更される可能性大 → 差し替え容易な構造
- props で imagePath を受け取り、layout は影響受けない

### 6.2 BackgroundLayer の責務（UI-06 §3.3 と整合）

```tsx
// src/components/shared/BackgroundLayer.tsx
type BackgroundLayerProps = {
  imagePath: string;        // 例: '/themes/time/morning/home.webp'
  fallbackPath?: string;    // 例: '/themes/time/morning/home.jpg'
  overlayDark?: number;     // ダーク時 overlay 強度（0-1）
  altText?: string;         // 装飾なら ''
  preloadHint?: boolean;    // LCP 候補時 true
};

export function BackgroundLayer({
  imagePath, fallbackPath, overlayDark = 0, altText = '', preloadHint = false,
}: BackgroundLayerProps) {
  return (
    <div className="background-layer" aria-hidden={altText === ''}>
      <picture>
        <source srcSet={imagePath} type="image/webp" />
        {fallbackPath && <source srcSet={fallbackPath} type="image/jpeg" />}
        <img src={fallbackPath ?? imagePath} alt={altText} loading={preloadHint ? 'eager' : 'lazy'} />
      </picture>
      {overlayDark > 0 && (
        <div className="overlay-dark" style={{ background: `rgba(0,0,0,${overlayDark})` }} />
      )}
    </div>
  );
}
```

### 6.3 差し替えシナリオ

```
シナリオ 1: 後道さんが「もっと和風で」と言った
  → imagePath を新画像に差し替え
  → ModuleLayer / 他コンポーネント不変

シナリオ 2: 季節バリエーション追加
  → 新しい時間帯テーマ key を追加（例: 'season-cherry'）
  → CSS variables 拡張、画像アセット追加のみ

シナリオ 3: 後道さんが「画像を完全に変えてほしい」
  → 新画像セット（24 枚）を public/themes/time/ に配置
  → CSS variables の URL 差し替えのみ
  → layout コード は一行も変えない
```

---

## 7. カスタム画像との優先順位

### 7.1 優先度（高い順）

カスタム画像の適用範囲を明示：

```
■ メニューバー（① / ②）の背景:
  1. カスタム画像（UI-03、ユーザー設定の `ui_menu_bar*_image_key`）
  2. 時間帯テーマ（本 spec、フォールバック）
  3. デフォルト画像（ライト/ダークモード既定）

■ ヘッダー / ログイン背景 / ホーム盆栽ビュー背景:
  1. 時間帯テーマ（本 spec、正本）
  2. デフォルト画像（ライト/ダークモード既定）
  ※ カスタム画像による上書きは Phase 1 では対象外
```

つまり、**カスタム画像（メニューバー画像のみ）> 時間帯テーマ（ヘッダー / ログイン / ホーム背景）** の関係。
カスタム画像が時間帯テーマを上書きできるのはメニューバー部位に限定される。

### 7.2 カスタム画像の検知

- メニューバー ①② の画像は `root_employees.ui_menu_bar*_image_key` を確認
- 画像キー有 → メニューバー部位のみカスタム画像を優先
- 画像キー無 → 時間帯テーマにフォールバック
- ヘッダー / ログイン / ホーム盆栽ビュー背景は `ui_menu_bar*_image_key` を参照しない（適用範囲外）

### 7.3 ヘッダー / ログイン背景 / ホーム背景 の扱い

- **カスタム画像の適用はメニューバーのみ**（§7.1 と整合）
- ヘッダー・ログイン背景・ホーム盆栽ビュー背景は**時間帯テーマのみ**で制御
- 将来拡張のため `ui_header_image_key` 等のスキーマ拡張余地は残すが、Phase 1 ではメニューバー以外のカスタム上書きは導入しない

---

## 8. ダーク時の黒オーバーレイ自動適用

### 8.1 適用パターン

| テーマ | 通常 overlay | ダーク時 overlay |
|---|---|---|
| 朝（明るい）| 0.00 | 0.30 |
| 昼（一番明るい）| 0.00 | 0.40（強め）|
| 夕（中間）| 0.00 | 0.30 |
| 夜（暗い）| 0.00 | 0.15（弱め）|
| 春（明るめ）| 0.00 | 0.30 |
| 夏（明るめ）| 0.00 | 0.35 |
| 秋（中間）| 0.00 | 0.25 |
| 冬（明るめ・雪反射）| 0.00 | 0.30 |

### 8.2 CSS 実装

```css
.time-theme-bg {
  position: relative;
}

.time-theme-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, var(--overlay-dark));
  pointer-events: none;
  transition: background 0.3s;
}

/* ダークモード時のみ overlay 適用 */
.dark .time-theme-bg {
  --overlay-dark: 0.30;
}

/* 時間帯別の上書き（ダーク時のみ） */
.dark [data-time-theme="noon"] .time-theme-bg { --overlay-dark: 0.40; }
.dark [data-time-theme="night"] .time-theme-bg { --overlay-dark: 0.15; }
.dark [data-time-theme="season-summer"] .time-theme-bg { --overlay-dark: 0.35; }
.dark [data-time-theme="season-autumn"] .time-theme-bg { --overlay-dark: 0.25; }
```

### 8.3 カスタム画像時の overlay

- UI-03 で個別に overlay_opacity を指定可
- ダーク時は `max(user_overlay, 0.20)` で最低保証

---

## 9. 実装ステップ

1. **Step 1**: 5+ パターン × 3 用途の画像準備（GW MVP は 5×3=15 枚、§13 判断保留）（別タスク、AI 生成）
2. **Step 2**: `src/components/shared/TimeThemeProvider.tsx` 実装（季節対応）（1.5h）
3. **Step 3**: `getCurrentTimeTheme` / `resolveTimeTheme` / `getDailyRandomTheme` テスト付き実装（1h）
4. **Step 4**: `src/components/shared/BackgroundLayer.tsx` 実装（独立 layer、UI-06 §3.2 と整合）（1h）
5. **Step 5**: CSS variables 連動（`data-time-theme`、8 パターン分）（0.5h）
6. **Step 6**: Header / Login / Home（盆栽ビュー）への適用（1h）
7. **Step 7**: ダーク時 overlay 自動適用（0.5h）
8. **Step 8**: ユーザー設定 UI（Root マイページ内、UI-03 と統合）（0.5h）
9. **Step 9**: 結合テスト（時間帯境界、季節再現性、ランダム）（0.5h）

**合計**: 約 **0.6d**（約 6.5h、画像用意を除く / GW MVP 5 パターン基準）

---

## 10. キャッシュ戦略

### 10.1 ブラウザキャッシュ

- `Cache-Control: public, max-age=86400`（**1 日**、後道さんフィードバック後の差し替え可能性考慮）
- 差し替え時は filename に hash 付与（例: `morning-home-v2.webp`）で cache-bust
- Phase 2 で安定したら `max-age=31536000` に拡大

### 10.2 画像の lazy load

- Login 画像: 初回ログイン画面表示時にロード（LCP 候補、preload）
- Home 盆栽ビュー画像: ログイン後にロード（preload で先読み）
- Header 画像: Login 後に preload

### 10.3 モバイルの帯域配慮

- Phase 2 で 1024×576 軽量版を `<picture>` の srcset で提供
- モバイル時は media query で軽量版選択

---

## 11. 他 spec との接続点

| 関連 spec | 接続 |
|---|---|
| UI-01 layout-theme | Header レイアウト寸法（§3.2.1）参照、本 spec が背景画像の正本 |
| UI-03 personalization | カスタム画像が時間帯テーマを上書き（メニューバーのみ） |
| UI-06 access-routing | ホーム盆栽ビューの背景に時間帯テーマ適用、BackgroundLayer 経由 |

---

## 12. テスト観点

- 境界時刻（04:59 / 05:00 / 08:59 / 09:00 等）の判定
- PC 時刻改ざん時の挙動
- 日次ランダムの再現性（同一日付 = 同一テーマ）
- ランダム時の季節バリエーション選択（月別）
- タブ非アクティブ → アクティブ復帰時の再判定
- カスタム画像あり / 時間帯切替の優先順位
- ダーク/ライト切替時の overlay_dark 値の追従
- 画像未ロード時のフォールバック（default-gradient）
- WebP 非対応ブラウザでの JPEG fallback
- BackgroundLayer の imagePath 差し替え時に layout 不変であること（Visual Regression）

---

## 13. 判断保留事項

- **判1: 画像調達方法**
  - AI 生成 / ストックフォト / 外注
  - **推定スタンス**: Phase 1 は AI 生成（GW MVP 5 パターン × 3 用途 = 15 枚）、後道さん採用後に外注で高品質版へ差替検討
- **判2: 時間帯境界の調整**
  - 朝 05-09 / 06-08 / 5-7 どれか
  - **推定スタンス**: 5-9（朝活含む、広め）、実運用後に調整
- **判3: ランダム発動の周期**
  - 日次 / 週次 / 毎ログイン
  - **推定スタンス**: 日次（ユーザー期待値合致）
- **判4: 季節バリエーションのフル展開**
  - GW MVP は現季節のみ / 4 季節すべて事前用意
  - **推定スタンス**: GW MVP は **現季節 1 種**（春なら桜のみ 3 用途分）、Phase 2 で残り 3 季節追加
- **判5: 天気連動**
  - 雨の日 / 晴れの日 で画像差替
  - **推定スタンス**: 未実装、Phase 3 以降
- **判6: 画像の差替頻度**
  - 各テーマ 1 枚固定 / 複数候補からランダム
  - **推定スタンス**: Phase 1 は 1 枚固定、Phase 2 で複数展開
- **判7: ヘッダー画像のサイズ**
  - 2048×200 / 1920×64 / 非表示（グラデーションのみ）
  - **推定スタンス**: 2048×200（大画面対応）、グラデのみ選択肢も UI-03 で提供
- **判8: 中央盆栽の配置（画像内位置）**
  - 完全中央 / やや右 / やや左
  - **推定スタンス**: 完全中央（UI-06 ModuleLayer の (0,0) と整合）、ただし ModuleLayer 抽象座標なので画像が多少ズレても layout 壊れない
- **判9: 後道さん採用ゲート対応の画像版違い**
  - 採用前にバリエーション複数準備すべきか
  - **推定スタンス**: GW までに 1 セット（5 パターン × 3 用途）。気に入らなければ画像差し替えのみで対応可能（独立 layer）

---

## 14. アクセシビリティ

### 14.1 prefers-reduced-motion

- ユーザーが OS 設定で「アニメーション削減」ON の場合
- 時間帯切替時の fade を無効化
- CSS で `@media (prefers-reduced-motion: reduce)` で `transition: none`

### 14.2 色覚対応

- 夕焼けの赤紫は色覚異常で識別困難
- **時間帯を表すインジケーター**（画面隅の小さな太陽/月アイコン）を併用
- アイコン: ☀️（昼）/ 🌅（朝/夕）/ 🌙（夜）

### 14.3 ダーク時の視認性

- ダーク mode 時、明るい時間帯画像（昼・夏など）は overlay 0.40 まで強める
- テキストコントラスト維持（WCAG AA 4.5:1 以上）

---

## 15. 実装見込み時間の内訳

| 作業 | 見込 |
|---|---|
| TimeThemeProvider + ロジック（季節対応）| 2.5h |
| BackgroundLayer 実装（独立 layer）| 1.0h |
| CSS variables 連動 + overlay（8 パターン）| 1.0h |
| Header / Login / Home 盆栽ビューへの適用 | 1.0h |
| ユーザー設定 UI（UI-03 統合）| 0.5h |
| 結合テスト | 0.5h |
| **合計** | **0.6d**（約 6.5h）|

別途: 画像調達（AI 生成、GW MVP 15 枚）約 3-4 時間、東海林さん or デザイナー実施

---

— spec-cross-ui-04 end —
