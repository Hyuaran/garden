# Cross UI-02: メニューバー ①② 詳細設計

- 対象: Garden シリーズ全モジュール（各アプリ内の共通ナビゲーション）
- 優先度: **🔴 最高**（業務動線の中核）
- 見積: **0.5d**
- 担当セッション: a-main + 各モジュール（適用は全員）
- 作成: 2026-04-25（a-auto 002 / Batch 10 Cross UI #02）
- 前提:
  - UI-01（Header / CSS variables / 10 ブランドカラー）
  - 既存 Tree `SidebarNav.tsx`（機能メニュー = ②）
  - UI-06（ログイン後のホーム画面 9 アイコン配置）

---

## 1. 目的とスコープ

### 目的

各アプリ画面内で、**アプリ切替（①）**と**機能メニュー（②）**を並列配置し、Garden シリーズのどこからでも別アプリへスムーズに行き来できる UX を提供する。

### 含める

- ① アプリ切替メニュー（左端 56px、10 モジュールアイコン縦並び）
- ② 機能メニュー（その右 200px、現 Tree 左メニュー踏襲）
- レスポンシブ対応（モバイル時はドロワー折りたたみ）
- キーボードアクセス
- アイコンブランドカラー規則（UI-01 §5 参照）
- アクティブ状態表現
- 折りたたみ・展開の切替

### 含めない

- 画像カスタマイズ（03 で別途）
- 時間帯によるメニューバー背景変化（04 で参照）
- ログイン前画面（06 で別途）
- モジュール別機能メニュー詳細（各モジュール spec）

---

## 2. レイアウト（縦 2 列構成）

```
┌─┬───┬──────────────────────────────┐
│ │   │   Header（UI-01）             │
│①│ ② ├──────────────────────────────┤
│ │   │                              │
│A│機 │                              │
│p│能 │   メインコンテンツ             │
│p│メ │                              │
│切│ニ │                              │
│替│ュ │                              │
│ │ー │                              │
│ │   │                              │
└─┴───┴──────────────────────────────┘
 56  200
```

---

## 3. ① アプリ切替メニュー（左端 56px）

### 3.1 構造

- 幅: 56px（折りたたみ時も同じ、常に固定）
- 高さ: `calc(100vh - 64px)`（Header 下から下端まで）
- 背景: ダーク系（`var(--bg-secondary)` 強め、`rgba(25, 30, 40, 0.9)`）
- 縦並び: 9 アプリ（Fruit は概念のみ表示、クリック不可）

### 3.2 アイコン表示

```
┌──┐
│🌱 │ ← Soil（茶色）
│🌿 │ ← Root（濃茶）
│🌲 │ ← Tree（緑）  ← 現在アクティブ
│🍃 │ ← Leaf（薄緑）
│🌸 │ ← Bud（ピンク）
│🌺 │ ← Bloom（マゼンタ）
│🌰 │ ← Seed（ベージュ）
│🌳 │ ← Forest（深緑）
│🌊 │ ← Rill（水色）
│🍎 │ ← Fruit（金、無効）
└──┘
```

- アイコンサイズ: 32×32px
- アイコン間隔: 上下 8px
- **アイコン色はホーム画面と同じブランドカラー**（UI-01 §5）
- アクティブ: 左端に 3px 幅のブランドカラー縦ライン + 背景 tint
- hover: 背景 `rgba(255,255,255,0.08)`、tooltip でアプリ名表示

### 3.3 クリック動作

- 通常クリック → 該当アプリトップ（`/tree/dashboard`, `/leaf` 等）へ遷移
- `Ctrl + クリック` → 新しいタブで開く
- `Ctrl + Alt + 1-9` のキーボードショートカット（1 = Soil, 9 = Rill）

### 3.4 権限制御

- `garden_role` に応じてアクセス権のないアプリはグレーアウト
  - クリックで「このアプリへのアクセス権限がありません」toast
- **権限あり = ブランドカラー、権限なし = グレー**で一目瞭然

Garden 8-role 標準（toss / closer / cs / staff / outsource / manager / admin / super_admin）に基づくグレーアウト方針：

| garden_role | アプリ切替メニューでの可視範囲（既定）|
|---|---|
| toss | Tree のみ（他はグレー）|
| closer | Tree のみ（他はグレー）|
| cs | Tree / Leaf / Bloom（業務範囲のみ）|
| staff | Bud / Root / Bloom 等の事務系（業務範囲のみ）|
| outsource | 自分担当のアプリのみ（既定はホーム留まり）。槙さん例外は `module_owner_flags` で個別開放 |
| manager | 自部署関連の全モジュール（一部 admin 限定除く）|
| admin | 全モジュール |
| super_admin | 全モジュール（権限変更を含む全操作）|

### 3.5 SSR vs CSR

- SSR 時にアクセス権を判定（Server Component で garden_role 取得）
- CSR 遷移時は ThemeContext / AuthContext で再検証

---

## 4. ② 機能メニュー（その右 200px）

### 4.1 構造

- 幅: 200px（展開時）/ 56px（折りたたみ時、アイコンのみ表示）
- 高さ: `calc(100vh - 64px)`
- 背景: ライト系（`var(--bg-primary)`）
- モジュール固有の機能リスト

### 4.2 現 Tree UI 踏襲

既存 `src/app/tree/_components/SidebarNav.tsx` を**共通化**：

```
📞 架電（Sprout/Branch）
🎯 Breeze モード
📋 Aporan
⏳ Confirm-wait
📊 ダッシュボード
🔔 通知
💬 Chatwork
⚙️ 設定
```

各モジュール固有の項目リストは各モジュール自身が定義：

```tsx
// src/app/tree/_lib/menu.ts（新設）
export const TREE_MENU: MenuItem[] = [
  { icon: '📞', label: '架電', href: '/tree/call', roles: ['toss', 'closer'] },
  { icon: '🎯', label: 'Breeze', href: '/tree/breeze', roles: ['toss', 'closer'] },
  // ...
];
```

### 4.3 折りたたみ切替

- ② 最下部に「◀」トグルボタン
- 折りたたむとラベル非表示、アイコンのみ（56px 幅）
- 状態は `localStorage` に保存
- トグル時のアニメーション: `transition: width 0.2s ease`

### 4.4 共通コンポーネント

`src/components/shared/MenuBar2.tsx` 新設：

```tsx
type MenuBar2Props = {
  appKey: AppKey;                 // 'tree' | 'leaf' | ...
  items: MenuItem[];              // モジュール固有
  currentPath: string;            // pathname
  collapsed: boolean;
  onToggleCollapse: () => void;
};
```

### 4.5 アクティブ状態

- 現在のパスと一致する項目に背景 tint（ブランドカラー 15%）
- 左端に 3px 幅ブランドカラー縦ライン
- フォント weight: 500 → 600

---

## 5. レスポンシブ対応

### 5.1 ブレークポイント別動作

| breakpoint | ① | ② | 備考 |
|---|---|---|---|
| sm（640px 以下、スマホ）| **ドロワー**（左から）| **ドロワー**（中央から）| ハンバーガー 1 本 |
| md（640-1024）| 常駐 56px | 折りたたみ 56px | ダブルアイコンバー |
| lg（1024-1280）| 常駐 56px | 折りたたみ or 展開 | ユーザー設定 |
| xl（1280 以上）| 常駐 56px | 常駐 展開 200px | 既定 |

### 5.2 モバイルドロワー UX

```
┌──────────────────┐
│ [☰] Tree    👤   │ ← Header（ハンバーガー）
├──────────────────┤
│                  │
│  ① 押下 → 左から  │
│     スライドイン  │
│                  │
│  ② 押下 → 中央モ  │
│     ーダル表示    │
└──────────────────┘
```

- ハンバーガーアイコンは Header 左端
- タップで左右のドロワー表示（Framer Motion or CSS transform）
- 選択後は自動で閉じる
- 背景の cover `onClick` で閉じる

### 5.3 タッチターゲット

- アイコン min 44×44px（WCAG AA）
- スペーシング 8px 以上

---

## 6. キーボードアクセス

### 6.1 Tab 順序

```
Header (app name) → ① (app switcher) → ② (function menu) → main content
```

### 6.2 ショートカット

| ショートカット | 動作 |
|---|---|
| `Ctrl + Alt + 1-9` | アプリ ①-⑨ へ直接遷移 |
| `Ctrl + B` | ② 折りたたみ切替 |
| `Alt + ↑ / ↓` | ② 内項目の前後移動 |
| `Enter` | 選択項目に遷移 |
| `Esc` | モバイルドロワー閉じる |

### 6.3 ARIA 属性

- `<nav aria-label="アプリ切替">` / `<nav aria-label="機能メニュー">`
- アクティブ項目に `aria-current="page"`
- アイコン: `aria-label="架電画面へ"`（label 属性必須）
- 折りたたみボタン: `aria-expanded="true|false"`

### 6.4 フォーカス表示

- `focus-visible` で鮮明な枠線（2px ブランドカラー）
- Tab キー押下時のみ表示（マウス時は非表示）

---

## 7. アイコンライブラリ

### 7.1 採用候補

| ライブラリ | メリット | デメリット |
|---|---|---|
| Lucide React | 軽量、shadcn/ui と相性◎ | モジュールごとの「独自感」が弱い |
| React Icons | 多ライブラリ統合 | バンドルサイズ大 |
| 独自 SVG | ブランド一貫性 | 制作コスト |

### 7.2 推奨方針

- **独自 SVG**を `public/icons/garden/` に配置（9 モジュール + 設定・通知など）
- 汎用アイコン（戻る・検索・閉じる等）は Lucide React
- ブランドアイコンは `next/image` で表示、`aria-hidden="true"` + 別途ラベル

### 7.3 SVG サイズ規約

- アイコンの viewBox: 0 0 24 24（統一）
- stroke-width: 2px（統一）
- stroke: `currentColor`（CSS で色制御可能に）

---

## 8. アクティブ判定ロジック

### 8.1 ① アプリ切替

```ts
const currentApp = pathname.split('/')[1];  // 'tree' / 'leaf' / ...
const isActive = (appKey: string) => appKey === currentApp;
```

### 8.2 ② 機能メニュー

```ts
// 完全一致 or 前方一致
const isActive = (item: MenuItem) => {
  if (item.exact) return pathname === item.href;
  return pathname.startsWith(item.href);
};
```

- `exact: true` は「ダッシュボード」等、サブパス含むパス（`/tree/dashboard/settings` など）で誤判定しないため

---

## 9. 設定権限

### 9.1 組織既定 vs 個人上書き

- ② の項目順・表示/非表示は組織既定（admin+ が決定）
- 個人は「お気に入り」の表示・順序を上書き可能
- admin が「個人上書きを許可」フラグ（root_employees 列 追加、UI-03 参照）

### 9.2 UI-03 との連携

- メニューバー画像カスタマイズ（①/②/①+②）は UI-03 で詳細
- 本 spec はメニュー項目そのものの設定のみ扱う

---

## 10. パフォーマンス

### 10.1 目標

- ① からの遷移: < 300ms（SSR render + client hydration）
- ② 展開切替: < 200ms（CSS transition）
- ドロワー開閉（モバイル）: < 250ms（Framer Motion）

### 10.2 実装ポイント

- ① の 10 アイコンはバンドル済 SVG
- ② の項目は lazy import 不要（数個程度）
- prefetch: hover 時に Next.js の `router.prefetch(href)` を実行

---

## 11. 実装ステップ

1. **Step 1**: `src/components/shared/MenuBar1.tsx` / `MenuBar2.tsx` 骨格（1.5h）
2. **Step 2**: 10 モジュールアイコン SVG の `public/icons/garden/` 配置（1h）
3. **Step 3**: アクティブ判定ロジックの共通化（0.5h）
4. **Step 4**: 折りたたみ / 展開の localStorage 永続化（0.5h）
5. **Step 5**: モバイルドロワー実装（Framer Motion）（1h）
6. **Step 6**: キーボードショートカット（useHotkeys）（0.5h）
7. **Step 7**: 既存 Tree `SidebarNav` の `MenuBar2` への段階移行（0.5h）

**合計**: 約 **0.5d**（約 5h）

---

## 12. 他 spec との接続点

| 関連 spec | 接続 |
|---|---|
| UI-01 layout-theme | ヘッダー左端のブランドカラー縦ラインと同期 |
| UI-03 personalization | メニューバー 3 パターン画像カスタマイズ |
| UI-06 access-routing | 権限別のアプリアクセス可否ハイライト |
| 各モジュール spec | ② の項目リスト定義（`_lib/menu.ts`） |

---

## 13. テスト観点

- ブレークポイント別レイアウト（sm/md/lg/xl の 4 種）
- アクティブ判定の境界（完全一致 vs 前方一致）
- 権限なしアプリのグレーアウト + toast
- ドロワー開閉（モバイル）
- Tab 順序・キーボードショートカット 5 種
- 10 モジュールアイコンの色整合性

---

## 14. 判断保留事項

- **判1: モバイル時の ①② 統合**
  - ハンバーガー 1 本で ① + ② を tabs で切替 / ① はドロワー左 + ② はドロワー中央
  - **推定スタンス**: ドロワー左 + 中央の分離案（触覚的に分かりやすい）
- **判2: アプリアイコンの hover tooltip**
  - 即時表示 / 500ms 遅延
  - **推定スタンス**: 500ms 遅延（誤 hover 抑制）
- **判3: ② の項目数上限**
  - 10 項目 / 20 項目 / 無制限
  - **推定スタンス**: 表示上限 15 項目、超過は「その他」メニュー
- **判4: ① の順序**
  - アルファベット順 / ホーム画面と同一 / カテゴリ順
  - **推定スタンス**: ホーム画面と同一順（9 アプリ + Fruit）
- **判5: ショートカット `Ctrl + Alt + 1-9` の衝突**
  - ブラウザ / OS のタブ切替と衝突しないか
  - **推定スタンス**: `Ctrl + Alt` は衝突少（OS/ブラウザは `Ctrl + Tab` / `Alt + Tab`）
- **判6: アイコンセット**
  - 独自 SVG 制作 / Lucide に合わせた線画統一
  - **推定スタンス**: 独自 SVG（ブランド一貫性、制作コストは 1 回払い）
- **判7: 折りたたみの既定値**
  - デスクトップで初期展開 / 折りたたみ
  - **推定スタンス**: 初期展開（業務画面としての一覧性重視）

---

## 15. 実装見込み時間の内訳

| 作業 | 見込 |
|---|---|
| MenuBar1 / MenuBar2 共通コンポーネント | 1.5h |
| 10 アイコン SVG 制作・配置 | 1.0h |
| アクティブ判定・折りたたみ state | 1.0h |
| モバイルドロワー（Framer Motion）| 1.0h |
| キーボードショートカット | 0.5h |
| 既存 Tree SidebarNav の移行 | 0.5h |
| **合計** | **0.5d**（約 5.5h）|

---

— spec-cross-ui-02 end —
