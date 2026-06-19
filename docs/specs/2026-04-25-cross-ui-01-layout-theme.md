# Cross UI-01: 全体レイアウト・テーマ規約

- 対象: Garden シリーズ全モジュール（9 アプリ + 共通 Shell）
- 優先度: **🔴 最高**（02-06 全スペックの前提）
- 見積: **0.6d**
- 担当セッション: a-main + 各モジュール（適用は全員）
- 作成: 2026-04-25（a-auto 002 / Batch 10 Cross UI #01）
- 前提:
  - 2026-04-25 東海林さん確定仕様 21 項目
  - 既存 `src/app/forest/_constants/theme.ts`（FOREST_THEME、ウォームベージュ系）
  - 既存 `src/app/tree/_constants/theme.ts`（LIGHT_THEME / DARK_THEME プレースホルダ）
  - spec-cross-error-handling（Batch 7、共通 Toast / role="alert"）

---

## 1. 目的とスコープ

### 目的

Garden シリーズ全モジュールで **統一されたレイアウト・テーマ規約**を定義し、ブランドの一貫性と、個別モジュールの独自色（ブランドカラー）の両立を実現する。

### 含める

- 全体レイアウト規約（ログイン / ホーム / 各アプリ内）
- 青空系ヘッダー共通コンポーネント仕様（`src/components/shared/Header.tsx`）
- ダーク/ライトモード切替基盤（Tailwind + CSS variables）
- モジュール別ブランドカラー定義（10 モジュール分）
- shadcn/ui 活用方針（既存の独自コンポーネントとの棲み分け）
- CSS カスタムプロパティの命名規約
- フォント・タイポグラフィ統一

### 含めない

- メニューバー詳細（02 で別途）
- 個人カスタマイズ（03）
- 時間帯テーマ画像（04）
- 達成演出（05）
- ルーティング・遷移演出（06）

---

## 2. レイアウト規約

### 2.1 3 階層のレイアウト

```
┌─────────────────────────────────────────────┐
│  階層 1: ログイン画面                          │
│  ──────                                     │
│  - 現枠維持（既存 UI のコア）                   │
│  - アイコンなし                                │
│  - 写真 / 絵が少し透ける演出（opacity 0.9）     │
│  - 背景は時間帯テーマ（04 参照）                │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  階層 2: ホーム画面（9 アプリアイコン配置）      │
│  ──────                                     │
│  - 3×3 グリッド（Soil/Root/Tree、Leaf/Bud/    │
│    Bloom、Seed/Forest/Rill）                 │
│  - 各アイコン hover で拡大 + 枠線濃化            │
│    → transform: scale(1.08)、border-width 2px│
│  - Fruit は概念のみ表示、非クリック              │
│  - 時間帯テーマ（04）に応じて背景変化            │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  階層 3: 各アプリ内                            │
│  ──────                                     │
│  [①]  [②]  ┌────────────────────────┐       │
│  App  機能  │  青空系ヘッダー          │       │
│  切替 メニュ │  （全アプリ共通）        │       │
│        ー   ├────────────────────────┤       │
│             │                         │       │
│             │   メインコンテンツ領域   │       │
│             │                         │       │
│             └────────────────────────┘       │
└─────────────────────────────────────────────┘
```

### 2.2 各レイアウト要素のサイズ

| 要素 | 幅 / 高さ | 備考 |
|---|---|---|
| メニューバー ①（アプリ切替） | 幅 56px | 縦並び 10 アイコン分 |
| メニューバー ②（機能メニュー） | 幅 200px（折りたたみ時 56px）| 現 Tree UI 踏襲 |
| 青空ヘッダー | 高さ 64px | 全アプリ共通 |
| メインコンテンツ | 可変 | min-width 680px |
| フッター | なし | 仕様上明示的に持たない |

### 2.3 レスポンシブブレークポイント

| breakpoint | px | 対応 |
|---|---|---|
| sm | 640 | スマホ縦（Tree モバイル架電） |
| md | 768 | タブレット |
| lg | 1024 | デスクトップ標準 |
| xl | 1280 | ワイドモニター |
| 2xl | 1536 | 巨大モニター |

**モジュール別の min サポート**:

- Tree / Bud: 全breakpoint（モバイル含む）
- Forest / Bloom: md 以上（タブレット以上）
- Leaf / Root / Seed / Soil / Rill: lg 以上（デスクトップ中心）

---

## 3. 青空系ヘッダー共通コンポーネント

### 3.1 仕様

`src/components/shared/Header.tsx` に新設：

```tsx
type HeaderProps = {
  appName: string;        // 'Leaf' / 'Tree' / ...
  brandColor: string;     // モジュール別ブランドカラー（§5）
  userName?: string;      // 認証ユーザー表示
  userRole?: string;      // garden_role 表示
  achievementSlot?: ReactNode;  // 達成演出（05 で詳細）
  rightActions?: ReactNode;     // モジュール固有ボタン（通知・ログアウト等）
  onLogout?: () => void;
};
```

### 3.2 見た目

- 背景: 時間帯別 background-image（UI-04 §5.3 が正本）。デフォルト時は青空テーマの画像 / グラデーションを使用
- 高さ: 64px（固定）
- 左端: アプリ名ロゴ + ブランドカラー縦ライン（4px 幅）
- 中央: 達成演出スロット（05）
- 右端: ユーザー名 + ロール + アクション（通知・設定・ログアウト）
- 影: `box-shadow: 0 2px 8px rgba(0,0,0,0.08)`

### 3.2.1 Header レイアウト寸法（正本）

ヘッダーの高さ・幅・要素配置は本 spec が**正本**。他 spec（UI-05 等）はここを参照する。

```
┌───────────────────────────────────────────────────────────────┐
│  Header 高: 64px（固定）                                        │
│ ┌──────────┬───────────────────┬──────────────────────────┐ │
│ │ 左端 200px│ 中央 max 400px      │ 右端（残り）              │ │
│ │ ロゴ +    │ 達成演出スロット      │ ユーザー名 + ロール        │ │
│ │ アプリ切替 │ = UI-05 管轄         │ + 通知 + ShojiStatusWidget│ │
│ │ トリガー   │ 上下 8px 余白で      │  compact 配置場所         │ │
│ │           │ 48px 可視領域        │                          │ │
│ └──────────┴───────────────────┴──────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

| 領域 | 幅 | 高さ（可視） | 内容 |
|---|---|---|---|
| 左端 | 200px | 64px | ロゴ + アプリ切替トリガー |
| 中央 | 最大 400px | 48px（上下 8px 余白） | 達成演出スロット（UI-05 管轄） |
| 右端 | 残り | 64px | ユーザー名 + ロール + 通知 + ShojiStatusWidget compact |

### 3.2.2 ナローモニター対応（< 768px）

- 中央 `achievementSlot` は**非表示**
- 右端アイコンは圧縮（ユーザー名省略 → アバターのみ、通知バッジ縮小）
- 左端ロゴはアプリアイコンのみ（テキスト省略）

### 3.3 時間帯テーマとの連動

> **正本は UI-04 §5.3**
> ヘッダー背景は UI-04 §5.3 で時間帯別 background-image として定義（朝焼け / 昼 / 夕焼け / 夜 / ランダム）。
> 本 spec ではヘッダーレイアウト（高さ・幅・要素配置）のみ管轄し、背景色・グラデーション・画像の定義は持たない。
>
> CSS variables（`--header-bg-url` 等）の連動仕様は UI-04 §5.3 を参照。

### 3.4 ダークモード時の自動黒 30% オーバーレイ

- 時間帯画像が明るすぎる場合、ダーク時は `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3))` を重ねる
- カスタム画像にも同様に適用（03 参照）

---

## 4. ダーク/ライトモード切替基盤

### 4.1 方式

**Tailwind CSS の `class` 戦略** を採用：

- `<html>` タグに `dark` クラスを付与/除去
- CSS カスタムプロパティ（`:root` と `.dark`）で色を切替
- Tailwind 側は `dark:` prefix で条件分岐

### 4.2 `globals.css` の骨格

```css
:root {
  --bg-primary: #FAF8F3;           /* ウォームベージュ */
  --bg-secondary: #F0EBE0;
  --text-primary: #2B2B2B;
  --text-secondary: #5C5C5C;
  --panel-bg: rgba(255, 255, 255, 0.75);
  --panel-border: rgba(255, 255, 255, 0.8);
  --overlay-dark: rgba(0, 0, 0, 0);  /* ライト時は透明 */
  /* ヘッダー背景の定義（--header-bg-url 等）は UI-04 §5.3 参照 */
}

.dark {
  --bg-primary: #0D1B2A;
  --bg-secondary: #1B2838;
  --text-primary: #F0F0F0;
  --text-secondary: #A0A0A0;
  --panel-bg: rgba(30, 30, 40, 0.75);
  --panel-border: rgba(255, 255, 255, 0.1);
  --overlay-dark: rgba(0, 0, 0, 0.3);  /* ダーク時は 30% 黒 */
  /* ヘッダー背景のダーク時定義は UI-04 §5.3 + §7 参照 */
}
```

### 4.3 切替 UI

- **設定画面**（Root マイページ）にトグル
- **ヘッダー右端**にクイック切替アイコン（🌓 / ☀️ / 🌙）
- 初期値: `prefers-color-scheme` → localStorage 上書き
- `ThemeContext` で全モジュール共有（新設 `src/components/shared/ThemeProvider.tsx`）

### 4.4 既存モジュールの移行方針

- Forest の `FOREST_THEME` → 段階的に CSS variables に移植
- Tree の `LIGHT_THEME` / `DARK_THEME` → ThemeContext + CSS variables に統合
- **移行中の併存 OK**（既存インラインスタイルは壊さない）

---

## 5. モジュール別ブランドカラー

### 5.1 10 モジュールのカラーパレット

| モジュール | 和名 | ブランドカラー | HEX | CSS var |
|---|---|---|---|---|
| Soil | 土 | ブラウン | `#8B6F47` | `--brand-soil` |
| Root | 根 | ダークブラウン | `#5C4332` | `--brand-root` |
| Tree | 木 | グリーン | `#3B9B5C` | `--brand-tree` |
| Leaf | 葉 | ライトグリーン | `#7FC66D` | `--brand-leaf` |
| Bud | 蕾 | ピンク | `#E07A9B` | `--brand-bud` |
| Bloom | 花 | マゼンタ | `#C3447A` | `--brand-bloom` |
| Seed | 種 | ベージュ | `#D9BC92` | `--brand-seed` |
| Forest | 森 | ダークグリーン | `#1F5C3A` | `--brand-forest` |
| Fruit | 実 | ゴールド | `#D4A340` | `--brand-fruit`（概念のみ、UI 用）|
| Rill | 川 | スカイブルー | `#4FA8C9` | `--brand-rill` |

### 5.2 カラーの使用ルール

- **メニューバー ① アイコン**: ブランドカラーをアイコン内に使用
- **ヘッダー左端の縦ライン**: ブランドカラー 4px 幅
- **アクティブ状態**: 背景色の tint（`color-mix(in srgb, var(--brand-xxx) 15%, transparent)`）
- **主要ボタン**: 既存モジュール固有の決定を尊重（例: Tree のグリーン / Bud のピンク）

### 5.3 コントラスト検証

各ブランドカラーと白背景 / 黒背景の組み合わせで WCAG AA（4.5:1）以上を保証。

| 色 | 白背景 | 黒背景 |
|---|---|---|
| Tree #3B9B5C | 3.5:1 ⚠️ | 5.8:1 ✅ |
| Bud #E07A9B | 3.2:1 ⚠️ | 6.2:1 ✅ |
| Forest #1F5C3A | 7.3:1 ✅ | 3.0:1 ⚠️ |
| Rill #4FA8C9 | 3.1:1 ⚠️ | 6.5:1 ✅ |

- ⚠️ はテキストとして使う場合に濃いバリアント（`-dark`）を別途定義
- 一覧テキストには必ず `text-white` or `text-gray-900` を明示

---

## 6. shadcn/ui 活用方針

### 6.1 採用の背景

- `Button` / `Dialog` / `Toast` / `Tooltip` / `DropdownMenu` 等、**実装コストが高い汎用パーツは shadcn/ui を採用**
- モジュール固有の独自コンポーネント（`GlassPanel`, `KPIHeader`, `CallTimer` 等）は維持

### 6.2 採用範囲（Phase 1）

| カテゴリ | 採用する | 採用しない（既存維持）|
|---|---|---|
| Button | ✅ | `ActionButton`（Tree 独自） |
| Dialog / Modal | ✅ | なし |
| Dropdown | ✅ | なし |
| Tooltip | ✅ | なし |
| Toast | ✅（sonner 統一、Batch 7 決定）| なし |
| Form / Input | 段階的 | Forest / Tree の既存 Input は当面維持 |
| Table | ❌（Phase 2 検討）| TanStack Table（Bud 採用済み） |
| Calendar / DatePicker | ✅（react-day-picker）| なし |
| Accordion | ✅ | なし |
| Tabs | ✅ | なし |

### 6.3 theme.config.ts

shadcn/ui の設定を CSS variables ベースにして、ダーク/ライト自動切替に統合：

```ts
// tailwind.config.ts
extend: {
  colors: {
    background: "hsl(var(--bg-primary))",
    foreground: "hsl(var(--text-primary))",
    // ...
  },
}
```

### 6.4 導入スケジュール

- Phase 1（2026-05）: Header, Dialog, Dropdown, Toast, Tooltip を shadcn/ui に移行
- Phase 2（2026-07）: Form / Input の整理
- Phase 3（2026-10）: Table 統一（TanStack + shadcn の組み合わせ検討）

---

## 7. フォント・タイポグラフィ

### 7.1 フォントファミリー

既存 `src/app/layout.tsx` の `Geist Sans` / `Geist Mono` を継続：

```css
--font-sans: var(--font-geist-sans);
--font-mono: var(--font-geist-mono);
```

日本語フォント追加検討（`Noto Sans JP` or システムフォント）：

- フォールバック順: `Geist, 'Hiragino Sans', 'Yu Gothic', sans-serif`
- 初期は **システムフォント優先**（読み込み速度を Phase 1 で確保）

### 7.2 サイズスケール

| ロール | サイズ | 行間 |
|---|---|---|
| h1 | 2rem (32px) | 1.25 |
| h2 | 1.5rem (24px) | 1.3 |
| h3 | 1.25rem (20px) | 1.4 |
| body | 1rem (16px) | 1.6 |
| small | 0.875rem (14px) | 1.5 |
| tiny | 0.75rem (12px) | 1.4 |

### 7.3 文字色

- 主テキスト: `var(--text-primary)`
- 補助: `var(--text-secondary)`
- ミュート: `var(--text-muted)` (新設、`#888888`)
- 警告: `#D97706`（ライト）/ `#F59E0B`（ダーク）
- 危険: `#DC2626`（ライト）/ `#F87171`（ダーク）

---

## 8. CSS カスタムプロパティ命名規約

### 8.1 プレフィックスルール

| prefix | 用途 |
|---|---|
| `--bg-*` | 背景色 |
| `--text-*` | テキスト色 |
| `--brand-{module}` | モジュールブランドカラー |
| `--panel-*` | ガラスパネル関連 |
| `--header-*` | ヘッダー関連 |
| `--overlay-*` | オーバーレイ（ダーク時等）|
| `--border-*` | ボーダー色 |
| `--shadow-*` | 影（光源の位置・強度）|
| `--radius-*` | 角丸 |
| `--space-*` | 余白スケール（4px 刻み）|

### 8.2 個別モジュールが独自追加してよい範囲

- `--{module}-*`（例: `--tree-kpi-accent`, `--bud-status-danger`）
- ただし global の `--bg-*` / `--text-*` 等は**上書き禁止**

---

## 9. 実装ステップ

1. **Step 1**: `src/components/shared/` 新設、`ThemeProvider.tsx` / `Header.tsx` 骨格（1.5h）
2. **Step 2**: `globals.css` に CSS variables 追加（ライト/ダーク、10 ブランドカラー）（1h）
3. **Step 3**: `src/app/layout.tsx` 更新（ThemeProvider で全ラップ）（0.5h）
4. **Step 4**: `src/app/page.tsx` を 9 アイコンホーム画面に書き換え（1h）
5. **Step 5**: shadcn/ui 基本コンポーネント導入（Dialog/Dropdown/Tooltip）（1h）
6. **Step 6**: Forest / Tree の既存 theme.ts を CSS variables に移植（段階的）（1h）

**合計**: 約 **0.6d**（約 6h、Phase 1 基盤のみ、既存移行は段階的）

---

## 10. 他 spec との接続点

| 関連 spec | 接続 |
|---|---|
| UI-02 menu-bars | Header の左端 ①② メニューバー位置決定 |
| UI-03 personalization | Header 背景の時間帯/カスタム画像差替 |
| UI-04 time-theme | ヘッダー背景の時間帯テーマ正本（UI-04 §5.3） |
| UI-05 achievement | Header 中央の `achievementSlot` に注入 |
| UI-06 access-routing | ログイン画面 / ホーム画面の透け演出・遷移アニメ |

---

## 11. テスト観点

- Visual Regression（Storybook + Chromatic 導入検討）
- ダーク/ライト切替時のちらつき検証
- ブランドカラーの WCAG AA 準拠検証（axe-core）
- ヘッダーの achievementSlot が空 / あり 両方で正しくレイアウト
- 全モジュール（9 画面）でヘッダー統一感確認（Storybook screenshot）

---

## 12. 判断保留事項

- **判1: 日本語フォント**
  - Noto Sans JP（ネット配信）/ システムフォント / 自己ホスト
  - **推定スタンス**: Phase 1 はシステムフォント、Phase 2 で Noto Sans JP CDN
- **判2: Fruit（実）の UI 表現**
  - 概念のみ、UI なし → ホーム画面に表示しない / 薄く表示 / ホバーで説明
  - **推定スタンス**: 薄く表示（opacity 0.4）、クリック無効、tooltip で「Fruit は概念モジュールです」
- **判3: 既存 theme.ts の廃止タイミング**
  - CSS variables 移行完了後、`FOREST_THEME` / `LIGHT_THEME` を削除するか維持するか
  - **推定スタンス**: Phase 3（2026-10）まで maintain、それ以降削除
- **判4: shadcn/ui の Dialog 実装方式**
  - Radix UI ベース（Accessibility 強い）/ 独自実装
  - **推定スタンス**: Radix UI 採用（shadcn/ui の推奨）
- **判5: Tailwind CSS のバージョン**
  - v3 / v4（beta）
  - **推定スタンス**: v3 維持（stable）、v4 は 2026-10 以降再検討
- **判6: モジュールブランドカラー 10 色の確定**
  - HEX 値の最終合意（§5.1）
  - **推定スタンス**: 東海林さん確認後、確定

---

## 13. 実装見込み時間の内訳

| 作業 | 見込 |
|---|---|
| ThemeProvider / Header 骨格 | 1.5h |
| globals.css CSS variables 定義 | 1.0h |
| ホーム画面 9 アイコン実装 | 1.5h |
| shadcn/ui 基本 5 種導入 | 1.0h |
| 既存 theme.ts 段階移行の PoC | 1.0h |
| **合計** | **0.6d**（約 6h）|

---

— spec-cross-ui-01 end —
