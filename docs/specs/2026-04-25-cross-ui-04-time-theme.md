# Cross UI-04: 時間帯テーマ（5 パターン、PC 時刻ベース、日次ランダム）

- 対象: Garden シリーズ全モジュール（ヘッダー / ログイン / ホーム画面背景）
- 優先度: **🟡 中**（UX 演出、段階投入可）
- 見積: **0.4d**
- 担当セッション: a-main（基盤）+ 各モジュール（適用）
- 作成: 2026-04-25（a-auto 002 / Batch 10 Cross UI #04）
- 前提:
  - UI-01（CSS variables、`--header-sky-*`）
  - UI-03（カスタム画像との優先順位）

---

## 1. 目的とスコープ

### 目的

Garden の画面に**朝焼け・昼・夕焼け・夜 + ランダム**の 5 パターンで時間帯演出を加え、業務中にも**季節感・時間感**を持たせる UX を実現する。

### 含める

- 5 パターンの画像アセット仕様
- PC 時刻ベースの時間帯判定ロジック（境界定義）
- 日次ランダム発動の実装
- カスタム画像（UI-03）との優先順位
- ダーク時の黒 30% オーバーレイ自動適用

### 含めない

- ヘッダーの構造（UI-01）
- メニューバー画像カスタマイズ（UI-03）
- 達成演出（UI-05）

---

## 2. 5 パターンの時間帯

### 2.1 時間帯と境界

| 時間帯 | 時刻（JST）| 画像方向性 |
|---|---|---|
| 朝焼け | 05:00 - 09:00 | オレンジピンク、柔らかな朝日 |
| 昼かんかん | 09:00 - 16:00 | 青空と白雲、明るい |
| 夕焼け | 16:00 - 19:00 | 赤紫とゴールド、沈む太陽 |
| 夜 | 19:00 - 05:00 | 紺 + 星、静寂 |
| **ランダム** | **日次シード**で上 4 種からランダム選択 | — |

### 2.2 境界の厳密化

- 開始時刻 <= 現在時刻 < 次の開始時刻
- 例: 09:00 ちょうどは昼（朝焼けではない）
- 05:00 未満は「夜」扱い（深夜 00:00 - 05:00）

### 2.3 ランダム発動の日次シード

```ts
// src/components/shared/_lib/dailySeed.ts
export function getDailyRandomTheme(date: Date = new Date()): TimeTheme {
  const dateStr = date.toISOString().slice(0, 10);  // 'YYYY-MM-DD'
  const hash = simpleHash(dateStr);  // 安定ハッシュ
  const options: TimeTheme[] = ['morning', 'noon', 'evening', 'night'];
  return options[hash % 4];
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
```

- 同じ日付 = 必ず同じテーマ（ユーザー間で共有）
- 日付が変わると自動で切替

---

## 3. 画像アセット設計

### 3.1 画像 5 種 × 部位

| 時間帯 | ヘッダー（64px 高）| ログイン背景 | ホーム背景 |
|---|---|---|---|
| 朝焼け | `morning-header.jpg` | `morning-login.jpg` | `morning-home.jpg` |
| 昼 | `noon-header.jpg` | `noon-login.jpg` | `noon-home.jpg` |
| 夕焼け | `evening-header.jpg` | `evening-login.jpg` | `evening-home.jpg` |
| 夜 | `night-header.jpg` | `night-login.jpg` | `night-home.jpg` |
| ランダム | 上 4 種から日次選択 | 同左 | 同左 |

### 3.2 配置パス

```
public/themes/time/
├── morning/
│   ├── header.jpg           (2048×200、軽量)
│   ├── login.jpg             (1920×1080)
│   └── home.jpg              (1920×1080)
├── noon/...
├── evening/...
└── night/...
```

### 3.3 サイズ・品質規定

| 用途 | 解像度 | 品質 | ファイルサイズ目安 |
|---|---|---|---|
| header | 2048×200 | 80 | 40-80 KB |
| login | 1920×1080 | 85 | 200-400 KB |
| home | 1920×1080 | 85 | 200-400 KB |

### 3.4 フォーマット

- **.jpg（JPEG）を基準**、webp/avif は Phase 2 で検討
- プログレッシブ JPEG 推奨（大画面でも段階的表示）

### 3.5 代替テキスト（alt）

- ヘッダー画像は装飾のため `alt=""`
- ログイン背景も装飾（`aria-hidden="true"`）

---

## 4. 時間帯判定ロジック

### 4.1 中心関数

```ts
// src/components/shared/_lib/timeTheme.ts
export type TimeTheme = 'morning' | 'noon' | 'evening' | 'night' | 'random';

export function getCurrentTimeTheme(now: Date = new Date()): Exclude<TimeTheme, 'random'> {
  const hour = now.getHours();  // 0-23（ブラウザローカル時刻）
  if (hour >= 5 && hour < 9) return 'morning';
  if (hour >= 9 && hour < 16) return 'noon';
  if (hour >= 16 && hour < 19) return 'evening';
  return 'night';  // 19-04
}

export function resolveTimeTheme(
  userPref: TimeTheme | null,
  now: Date = new Date()
): Exclude<TimeTheme, 'random'> {
  if (userPref === 'random') return getDailyRandomTheme(now);
  if (userPref && userPref !== 'random') return userPref;
  return getCurrentTimeTheme(now);
}
```

### 4.2 ユーザー設定（3 種）

| 設定値 | 挙動 |
|---|---|
| `null` または `'auto'` | PC 時刻に基づく自動切替（既定） |
| `'random'` | 日次ランダム |
| `'morning'` / `'noon'` / `'evening'` / `'night'` | 固定 |

### 4.3 `root_employees` 列追加

```sql
ALTER TABLE root_employees
  ADD COLUMN IF NOT EXISTS ui_time_theme text
    CHECK (ui_time_theme IN ('auto', 'random', 'morning', 'noon', 'evening', 'night'))
    DEFAULT 'auto';
```

---

## 5. 時刻変化の検知と切替

### 5.1 切替タイミング

- ページ読込時: 即座に判定
- SPA 内遷移: Context で共有、毎回再判定
- **1 時間毎の `setInterval`**: 時間帯境界通過時に自動切替
- タブが非アクティブ時: `visibilitychange` で再判定（サスペンド復帰時）

### 5.2 Context 設計

```tsx
// src/components/shared/TimeThemeProvider.tsx
export function TimeThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<TimeTheme>(() => resolveTimeTheme(null));

  useEffect(() => {
    const id = setInterval(() => {
      const next = resolveTimeTheme(getUserPref());
      if (next !== theme) setTheme(next);
    }, 60 * 1000);  // 1 分毎チェック（境界ずれ防止）

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
  --header-bg-url: url('/themes/time/morning/header.jpg');
  --login-bg-url: url('/themes/time/morning/login.jpg');
}
[data-time-theme="noon"] {
  --header-bg-url: url('/themes/time/noon/header.jpg');
  /* ... */
}
/* ... */
```

### 5.4 切替アニメーション

- 時間帯切替時は **500ms fade**（`transition: background-image 0.5s ease-in-out`）
- ただし `background-image` は単純 transition 不可 → 2 層重ねて opacity で fade

```tsx
<div className="time-theme-stack">
  <div style={{ backgroundImage: `url(${prevImage})`, opacity: fading ? 0 : 1 }} />
  <div style={{ backgroundImage: `url(${currentImage})`, opacity: fading ? 1 : 0 }} />
</div>
```

---

## 6. カスタム画像との優先順位

### 6.1 優先度（高い順）

```
1. カスタム画像（UI-03 でユーザー設定）
2. 時間帯テーマ（本 spec）
3. デフォルト画像（ライト/ダークモード既定）
```

### 6.2 カスタム画像の検知

- メニューバー ①② の画像は `root_employees.ui_menu_bar*_image_key` を確認
- 画像キー有 → カスタム画像を優先
- 画像キー無 → 時間帯テーマにフォールバック

### 6.3 ヘッダー / ログイン背景の扱い

- カスタム画像はメニューバーのみ
- ヘッダー・ログイン背景・ホーム背景は**時間帯テーマのみ**
- ユーザーカスタムを将来拡張可能性残す（`ui_header_image_key` 等）

---

## 7. ダーク時の黒オーバーレイ自動適用

### 7.1 適用パターン

| テーマ | 通常 overlay | ダーク時 overlay |
|---|---|---|
| 朝焼け（明るい） | 0.00 | 0.30 |
| 昼（一番明るい） | 0.00 | 0.40（強め）|
| 夕焼け（中間） | 0.00 | 0.30 |
| 夜（暗い） | 0.00 | 0.15（弱め）|

### 7.2 CSS 実装

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
```

### 7.3 カスタム画像時の overlay

- UI-03 で個別に overlay_opacity を指定可
- ダーク時は `max(user_overlay, 0.20)` で最低保証

---

## 8. 実装ステップ

1. **Step 1**: 5 パターン × 3 用途 = **15 画像の用意**（外部調達 or AI 生成、§判断保留）（別タスク）
2. **Step 2**: `src/components/shared/TimeThemeProvider.tsx` 実装（1h）
3. **Step 3**: `getCurrentTimeTheme` / `resolveTimeTheme` / `getDailyRandomTheme` テスト付き実装（1h）
4. **Step 4**: CSS variables 連動（`data-time-theme`）（0.5h）
5. **Step 5**: Header / Login / Home への適用（1h）
6. **Step 6**: ダーク時 overlay 自動適用（0.5h）
7. **Step 7**: ユーザー設定 UI（Root マイページ内、UI-03 と統合）（0.5h）
8. **Step 8**: 結合テスト（時間帯境界、ランダム再現性）（0.5h）

**合計**: 約 **0.4d**（約 5h、画像用意を除く）

---

## 9. 他 spec との接続点

| 関連 spec | 接続 |
|---|---|
| UI-01 layout-theme | `--header-sky-*` CSS variables で時間帯色を適用 |
| UI-03 personalization | カスタム画像が時間帯テーマを上書き |
| UI-06 access-routing | ログイン画面の背景に時間帯テーマ適用 |

---

## 10. テスト観点

- 境界時刻（04:59 / 05:00 / 08:59 / 09:00 等）の判定
- PC 時刻改ざん時の挙動（ブラウザ dev tools で時計進める）
- 日次ランダムの再現性（同一日付 = 同一テーマ）
- タブ非アクティブ → アクティブ復帰時の再判定
- カスタム画像あり / 時間帯切替の優先順位
- ダーク/ライト切替時の overlay_dark 値の追従
- 画像未ロード時のフォールバック（default-gradient）

---

## 11. 画像調達（§判断保留）

### 11.1 候補

| 方法 | メリット | デメリット |
|---|---|---|
| AI 生成（DALL-E / Midjourney） | 独自性、低コスト | プロンプト制作、著作権グレー |
| ストックフォト（Unsplash 等）| 高品質、即時調達 | ライセンス確認必要、独自性なし |
| 外注 | 完全カスタム | 費用・納期 |

### 11.2 推奨

- Phase 1: **AI 生成**で 5 パターン × 3 用途 = 15 枚（コスト低、速い）
- Phase 2: 好評なら外注で高品質版に差替

### 11.3 プロンプト例

```
Theme: morning
Prompt: Soft sunrise over a Japanese garden, bonsai tree silhouette,
        pastel pink and orange sky, peaceful, 16:9 landscape,
        photo-realistic, calm mood
```

---

## 12. パフォーマンス

### 12.1 画像の lazy load

- Login 画像: 初回ログイン画面表示時にロード（LCP 候補）
- Home 画像: ログイン後にロード（preload で先読み）
- Header 画像: Login 後に preload

### 12.2 キャッシュ戦略

- `Cache-Control: public, max-age=31536000, immutable`（年単位）
- 変更時はファイル名に hash 付与（Next.js の public フォルダでは手動）

### 12.3 モバイルの帯域配慮

- `<picture>` で WebP フォールバック版も提供（Phase 2）
- モバイル時は 1024×576 の軽量版を配信（Phase 2）

---

## 13. 判断保留事項

- **判1: 画像調達方法**
  - AI 生成 / ストックフォト / 外注
  - **推定スタンス**: Phase 1 は AI 生成（15 枚、コスト抑制）
- **判2: 時間帯境界の調整**
  - 朝焼け 05-09 / 06-08 / 5-7 どれか
  - **推定スタンス**: 5-9（朝活含む、広め）、実運用後に調整
- **判3: ランダム発動の周期**
  - 日次 / 週次 / 毎ログイン
  - **推定スタンス**: 日次（ユーザー期待値合致）
- **判4: 季節感の追加**
  - 春夏秋冬で 5 パターン × 4 季節 = 20 枚？
  - **推定スタンス**: Phase 1 は季節なし、Phase 2 以降で検討
- **判5: 天気連動**
  - 雨の日 / 晴れの日 で画像差替
  - **推定スタンス**: 未実装、Phase 3 以降の検討
- **判6: 画像の差替頻度**
  - 各テーマ 1 枚固定 / 複数候補からランダム
  - **推定スタンス**: Phase 1 は 1 枚固定、Phase 2 で複数展開
- **判7: Header 画像のサイズ**
  - 2048×200 / 1920×64 / 非表示（グラデーションのみ）
  - **推定スタンス**: 2048×200（大画面対応）、グラデのみ選択肢も UI-03 で提供

---

## 14. アクセシビリティ

### 14.1 prefers-reduced-motion

- ユーザーが OS 設定で「アニメーション削減」ON の場合、時間帯切替時の fade を無効化
- CSS で `@media (prefers-reduced-motion: reduce)` で `transition: none`

### 14.2 色覚対応

- 夕焼けの赤紫は色覚異常（赤緑色盲）で識別困難
- **時間帯を表すインジケーター**（画面隅の小さな太陽/月アイコン）を併用
- アイコン: ☀️（昼）/ 🌅（朝焼け/夕焼け）/ 🌙（夜）

---

## 15. 実装見込み時間の内訳

| 作業 | 見込 |
|---|---|
| TimeThemeProvider + ロジック | 2.0h |
| CSS variables 連動 + overlay | 1.0h |
| Header / Login / Home への適用 | 1.0h |
| ユーザー設定 UI（UI-03 統合）| 0.5h |
| 結合テスト | 0.5h |
| **合計** | **0.4d**（約 5h）|

別途: 画像調達（AI 生成 15 枚）約 2-3 時間、東海林さん or デザイナー実施

---

— spec-cross-ui-04 end —
