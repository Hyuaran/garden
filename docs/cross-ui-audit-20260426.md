# Cross UI 6 spec 整合性監査 - 2026-04-26

> a-auto 013 起草 / a-bloom GW 実装着手前事前監査
> 監査ブランチ: `feature/cross-ui-audit-20260426-auto`（base: origin/develop）
> 監査対象 6 spec の所在: `origin/feature/cross-ui-design-specs-batch10-auto`（develop 未マージ）
> 監査者: a-auto / 監査時刻: 2026-04-26
> spec 編集なし、本ファイルのみ新規作成

---

## 1. エグゼクティブサマリ

| 項目 | 件数 |
|---|---|
| 6 spec 確定度 | A=0 / B=2 / C=4 |
| 重大な矛盾 | 4 件 |
| 用語不統一 | 6 件 |
| 実装ブロッカー（高） | 7 件 |
| 実装ブロッカー（中） | 5 件 |
| 既存実装との衝突 | 5 件 |
| ShojiStatusWidget 接続点不明 | 6 件全て（言及ゼロ） |

→ **a-bloom GW 着手判断: 🟡 一部修正後着手**
- UI-02 / UI-04 / UI-05 のうち**矛盾がない部分**は限定的に着手可能
- ただし **UI-01 / UI-03 / UI-06 は東海林さん判断 + 前提整備（develop マージ・cross-ui specs の develop 反映）後**でないと安全に着手できない
- 詳細は §8「a-bloom 実装着手シナリオ」を参照

---

## 2. spec 別 確定度

| # | spec | 行数 | 確定度 | §判断保留 件数 | 重大な未確定事項 |
|---|---|---|---|---|---|
| 01 | layout-theme | 425 | **C** | 6 | 10 モジュールブランドカラー HEX 未確定 / shadcn/ui 採用が大前提化 / Tailwind v3 想定だが実装は v4 |
| 02 | menu-bars | 400 | **B** | 7 | アイコンセット未確定 / 既存 Tree SidebarNav 1047 行の共通化方法未定 / 7-role 表記（実装は 8-role） |
| 03 | personalization | 576 | **C** | 7 | heic2any 新規 npm 追加要承認 / Storage RLS の `auth_employee_number()` 未実装 / デフォルト bonsai 画像 3 枚調達 |
| 04 | time-theme | 446 | **C** | 7 | 画像 15 枚の調達未着手 / `--header-sky-*` を時間帯で書き換えるが UI-01 §3.3 ヘッダー背景定義と二重管理 |
| 05 | achievement-effects | 443 | **B** | 7 | `achievements` テーブル新設 + RLS / canvas-confetti 新規 npm / Realtime 購読の認証連携未確認 |
| 06 | access-routing | 472 | **C** | 8 | 扉アニメ素材未調達 / `src/app/page.tsx` 全面書き換え（既存 Next.js テンプレート） / 認証情報取得 API 未統一 |

**確定度 A 該当ゼロ**。確定度の根拠：
- A: 全項目確定、即実装着手可
- B: 一部判断保留、実装中盤までは着手可（§7 の最優先合意事項を **GW 中**に並行決定すれば B → A 化）
- C: 構造的判断保留（DB 列追加 / 新 npm / 新規 SQL 関数 / 大規模アセット調達 など）が解消されないと**実装着手すべきでない**

---

## 3. 6 spec 間の矛盾・重複

### 3.1 重大な矛盾（4 件）

| # | 論点 | 該当 spec / 行 | 内容 | 推奨対応 |
|---|---|---|---|---|
| M-1 | ヘッダー背景の「正本」二重管理 | UI-01 §3.3 / UI-04 §5.3 | UI-01 が `--header-sky-from/to` を時間帯で 4 種定義（§3.3 表）、UI-04 が `--header-bg-url` で別の background-image url を時間帯定義（§5.3）。**ヘッダー背景の決定権がどちらにあるか不明** | UI-01 §3.3 の「ヘッダー背景は時間帯で grad 4 種」を削除、UI-04 に集約する |
| M-2 | カスタム画像の優先範囲が矛盾 | UI-03 §1（メニューバー画像のみ）/ UI-04 §6.1 優先順 1（カスタム画像が時間帯テーマより上位）| UI-03 はメニューバー画像のみカスタム可と明記、UI-04 §6.1 は「カスタム画像 > 時間帯テーマ」とヘッダー/ホーム背景にも適用するような記述。**UI-04 §6.3 で「ヘッダー・ログイン背景・ホーム背景は時間帯テーマのみ」と明記**しており spec 内でも矛盾 | UI-04 §6.1 を「カスタム画像（メニューバーのみ） > 時間帯テーマ（ヘッダー/ログイン/ホーム）」と限定表現に修正 |
| M-3 | ロール体系が現実とズレる（**重大**）| UI-02 §3.4, UI-06 §4.3 / 実装 `src/app/root/_constants/types.ts` L181-189 | 両 spec とも 7-role（toss/closer/cs/staff/manager/admin/super_admin）で記述。**実装は既に 8-role**（`outsource` を staff と manager の間に追加済、PR #75 経由）| UI-02 §3.4 と UI-06 §4.3 表に `outsource` を追加。UI-06 は権限別自動遷移先を outsource はホーム留が妥当 |
| M-4 | Header の `achievementSlot` 配置と他要素の競合 | UI-01 §3.2（中央: 達成演出スロット） / UI-05 §4.1（最大幅 400px、Header 中央）| UI-01 は「中央: 達成演出スロット」と単一スロット、UI-05 は「最大幅 400px」と幅指定。Header 高 64px 中の縦位置（UI-05 §4.1 は 48px 高、上下 8px 余白）と UI-01 §3.2 の左端ロゴ・右端ユーザー領域の幅配分が**未定義**で、ナローモニターでの折返しが規定されていない | Header コンポーネント設計書を **UI-01 内で完結**させるか、UI-05 §4 の幅・高さを UI-01 §3 に取り込む |

### 3.2 用語の不統一（6 件）

| # | 用語 | 出現 spec | バリエーション | 推奨統一 |
|---|---|---|---|---|
| T-1 | テーマ | UI-01 / UI-04 | 「テーマ」「mode」「時間帯テーマ」「ダークモード」が混在 | `theme = ダーク/ライト` / `time-theme = 時間帯` の 2 軸で固定 |
| T-2 | アプリ切替 / モジュール切替 | UI-01 / UI-02 / UI-06 | 「アプリ」「モジュール」「app」が同義で混在（UI-01 §2.1 階層 2「9 アプリ」、UI-02 §3 「アプリ切替」、UI-02 §3.5 SSR で「Server Component」表記、UI-06 §4.2 `targetApp`） | 公開語彙（モジュール 9 + Fruit 概念）vs 実装語彙（appKey）を spec の語彙集に明記。本 spec 内では「モジュール」を採用 |
| T-3 | ロール表記 | UI-02 §3.4 / UI-06 §4.3 / 実装 GardenRole | toss/closer/cs/staff/manager/admin/super_admin（7）vs 実装は outsource を含む 8 | 実装の 8-role に統一、cross-ui 全般で `outsource` を表記 |
| T-4 | ブランドカラー / モジュールカラー | UI-01 §5 / UI-02 §3.2 / UI-03 / UI-06 | 「ブランドカラー」「モジュールカラー」「アクセント」が混在 | `--brand-{module}` を正本、表記は「モジュールブランドカラー」で統一 |
| T-5 | 個人カスタマイズ / personalization | UI-02 §9 / UI-03 全体 / UI-06 §4.5 | 「個人上書き」「個人カスタマイズ」「個人設定」が混在 | UI-03 §3 の階層用語に従い「個人上書き = personal override」で統一 |
| T-6 | スキップ / キャンセル | UI-06 §3.4, §4.4 | 扉アニメは「スキップ」、自動遷移は「キャンセル」と「スキップ」が混在（§4 「スキップ: クリック」「タイマー解除、ホーム留まる」「クリック / Esc」）| 「スキップ」に統一、キャンセルは別概念（実行中フローの中止）に予約 |

### 3.3 データモデル矛盾（2 件）

| # | spec | 列 / テーブル | 矛盾内容 | 推奨対応 |
|---|---|---|---|---|
| D-1 | UI-03 §3.3.2 / UI-04 §4.3 / UI-05 §7.2 / UI-06 §3.5, §4.5 | `root_employees` への列追加 | 4 spec で個別に `ALTER TABLE root_employees ADD COLUMN` を実施。**累計 11 列追加**（ui_pattern, ui_menu_bar1_image_key, ui_menu_bar2_image_key, ui_menu_bar_wide_image_key, ui_dark_mode, ui_enable_door_animation, ui_overlay_opacity, ui_time_theme, achievement_enabled, achievement_effects, achievement_auto_dismiss_sec, achievement_intensity, ui_auto_redirect_enabled）= **13 列**。マイグレーション順序・列名衝突回避が未調整 | `ui_*` プレフィックスで統一、1 つの cross-ui migration（`supabase/migrations/2026XXXX_root_employees_ui_extension.sql`）に集約 |
| D-2 | UI-03 §3.3.1 / UI-05 §3.1 | テーブル新設 | UI-03 が `root_org_ui_defaults`、UI-05 が `achievements` を新設。**両者の RLS で `auth_employee_number()` / `has_role_at_least()` 関数を使用するが、これらの SQL 関数は develop に未実装**（spec 内のみ） | cross-RLS-audit spec / Phase A の root-auth 整備で先行実装する依存タスクとして明示 |

---

## 4. 実装ブロッカー

### 4.1 未確定事項一覧（高ブロック度 = 7 件）

| # | spec | 論点 | ブロック度 | 必要な確認先 |
|---|---|---|---|---|
| B-1 | UI-01 §5.1 | 10 モジュールブランドカラー HEX 値の最終確定（現状 spec 内は提案値、判6 で東海林さん最終承認待ち）| **🔴 高**（全 spec の前提） | 東海林さん |
| B-2 | UI-01 §6 | shadcn/ui 採用と Phase 1 5 種導入。**新規 npm 5+** が必要（Radix UI 系、sonner、react-day-picker、lucide-react 等）。既存 package.json には未導入 | **🔴 高**（CLAUDE.md「新規 npm パッケージ追加は事前相談」のため） | 東海林さん |
| B-3 | UI-01 全体 / globals.css | Tailwind v3 想定の記述（§4.1, §6.3）だが実装は **Tailwind v4**（`tailwindcss: "^4"`）。`@theme inline` の v4 構文と spec 記載の v3 設定が乖離 | **🔴 高** | a-main / 東海林さん |
| B-4 | UI-03 §5.1 | heic 変換ライブラリ `heic2any`（npm、+300KB）導入。**新規 npm 追加で承認要** | **🔴 高** | 東海林さん |
| B-5 | UI-03 §3.3.1 / UI-05 §3.1 | RLS 内の `auth_employee_number()` / `has_role_at_least()` SQL 関数 develop 未実装（cross-cutting で別途整備されるはずだが spec 化されていない可能性、`docs/specs/cross-cutting/spec-cross-rls-audit.md` 参照要） | **🔴 高** | a-root / a-main |
| B-6 | UI-04 §3 / §11 | 5 時間帯 × 3 用途 = **15 枚の画像調達**。AI 生成 / 外注いずれも未着手。Phase 1 で AI 生成を推定スタンスとするが東海林さん判断未確定 | **🔴 高** | 東海林さん |
| B-7 | UI-06 §3 | 扉演出 SVG 素材未調達（和風モチーフを想定スタンスとしているが未確定。デザイナー相談前提）| **🔴 高** | 東海林さん / デザイナー |

### 4.2 未確定事項一覧（中ブロック度 = 5 件）

| # | spec | 論点 | ブロック度 |
|---|---|---|---|
| B-8 | UI-02 §7 | アイコンライブラリ（独自 SVG / Lucide / React Icons）。10 モジュール独自 SVG を推定スタンスだが制作コスト | 🟡 中 |
| B-9 | UI-05 §5.3 | canvas-confetti 新規 npm 追加 | 🟡 中 |
| B-10 | UI-05 §2.2 | Realtime 購読時の認証フィルタ（`employee_id=eq.${myEmployeeId}`）が JWT クレームに依存。既存実装での Realtime 購読パターンと整合性未確認 | 🟡 中 |
| B-11 | UI-06 §5.1 | `fetchCurrentUser()` という API（spec L262）の実装場所未指定。既存は `src/app/root/_lib/auth.ts` の RootStateContext 経由 | 🟡 中 |
| B-12 | UI-04 §3.2 | `public/themes/time/{morning,noon,...}/header.jpg` の配置パスは Next.js 16 の静的アセット配信と Cache-Control 戦略（§12.2）が手動 hash 付与前提で、実装上煩雑 | 🟡 中 |

### 4.3 依存先未整備（3 件）

| # | spec | 依存先 | 状態 |
|---|---|---|---|
| D-1 | UI-03 §3.4 | `RootEmployee` 型（実装済）に `ui_*` 列を追加 | TypeScript 型再生成が必要、a-root と協調 |
| D-2 | UI-04 §3.4 / UI-06 §1 | UI-03 / UI-04 / UI-06 が同時に `root_employees` を拡張。**実装順序が未調整** | spec 化されたが migration ファイル未作成 |
| D-3 | UI-05 §2.2 | `logAchievement` API を各モジュールが呼び出す前提だが、**API 設計書未起草**（cross-cutting にも該当 spec なし）| 新規 spec 起草要 |

### 4.4 ライブラリ / 環境変数未確定

| # | 必要なもの | 用途 | 状態 |
|---|---|---|---|
| L-1 | shadcn/ui CLI | UI-01 §6 | 未導入（5 + 個のコンポーネント追加が必要） |
| L-2 | sonner | UI-01 §6.2（Toast 統一） | 未導入 |
| L-3 | react-day-picker | UI-01 §6.2 | 未導入 |
| L-4 | lucide-react | UI-02 §7.1 | 未導入 |
| L-5 | heic2any | UI-03 §5.1 | 未導入 |
| L-6 | canvas-confetti | UI-05 §5.3 | 未導入 |
| L-7 | framer-motion | UI-02 §5.2（モバイルドロワー） | 未導入 |
| L-8 | react-hotkeys-hook | UI-02 §11 Step 6（useHotkeys） | 未導入 |

**累計: 8 種の新規 npm パッケージ要承認**。現 package.json は最小構成（next/react/supabase/chart.js/pdfjs-dist/@react-pdf/renderer のみ）。

---

## 5. 既存実装との整合性

### 5.1 src/app/{bloom,forest,tree,root}/_components 衝突

| # | 既存 | spec | 衝突内容 | 影響度 |
|---|---|---|---|---|
| E-1 | `src/app/forest/_components/ForestShell.tsx` | UI-01 §3, UI-02 §4 | ForestShell が独自に `<header>` + `FOREST_THEME` 経由でヘッダーレイアウトを描画。UI-01 共通 Header.tsx 採用時に**全面書き換え**が必要 | 🔴 高 |
| E-2 | `src/app/tree/_components/SidebarNav.tsx`（**1047 行**） | UI-02 §4.2 | UI-02 が「現 Tree UI 踏襲」「`MenuBar2` に共通化」と記述するが、SidebarNav.tsx はインライン CSS-in-JS で 1047 行、TreeStateContext 依存、`USER`/`ROLES` 等のモジュール定数を多用。**機械的な共通化は困難**。MenuBar2 への移行は**ほぼ書き直し**になる可能性高 | 🔴 高 |
| E-3 | `src/app/bloom/_components/BloomShell.tsx` | UI-01 §3, UI-02 §3 | BloomShell が独自ナビ（`NAV_ITEMS` ハードコード）+ ヘッダー描画。アプリ切替メニュー ① の概念がなく、a-bloom GW 着手時には **MenuBar1 / MenuBar2 への移行か併存判断**が必要 | 🟡 中 |
| E-4 | `src/app/tree/_components/TreeShell.tsx` | UI-01 §3 | `ACTIVE_THEME.background` で背景を直接 inline-style で塗っている。`ThemeProvider` + CSS variables への移行時、`TODO: ダークモード切替時は ACTIVE_THEME を ThemeContext から取得` コメントが既にあり、移行を意識した状態ではある | 🟡 中 |
| E-5 | `src/app/root/_components/RootShell.tsx` | UI-01 / UI-06 | Root マイページ・admin 画面（UI-03 §6.3）が「`/root/admin/ui-settings` 新設」とするが、既存 RootShell の遷移パターンに UI 設定画面が登場しない | 🟡 中 |

### 5.2 既存 Tailwind / CSS 設定との互換

| # | 観点 | 状態 |
|---|---|---|
| C-1 | **Tailwind v4** vs spec 記述の v3 構文 | `package.json: "tailwindcss": "^4"` / `globals.css` は v4 の `@theme inline` 構文。UI-01 §6.3 の `tailwind.config.ts` ベース設定は v3 想定で記述されており、**そのままコピペ不可** |
| C-2 | `globals.css` の `:root` / `.dark` | 現状 `@media (prefers-color-scheme: dark)` で 1 度切替するのみ。UI-01 §4.2 の `.dark` クラス戦略への切替で**既存挙動が変わる**（OS 設定追従 → クラス制御） |
| C-3 | inline-style vs Tailwind class | Forest/Tree/Bloom Shell は inline-style。UI-01 §6 の Tailwind class + CSS variables 戦略と **二重管理**になる移行期 |
| C-4 | Geist フォント | `layout.tsx` で `Geist` / `Geist_Mono` を Next.js Font として読込済（CSS variable `--font-geist-sans`）。UI-01 §7.1 の「Phase 1 はシステムフォント優先」とは**現状不整合**（Forest/Bloom Shell はインラインで `'Noto Sans JP'` 指定済） |
| C-5 | Next.js 16（App Router） | spec 内コードサンプル（特に UI-06 §5.1 の `'use client'` トップ層）は Next 14/15 想定の書きぶり。Next 16 + AGENTS.md「This is NOT the Next.js you know」前提で**API 差異の確認**が必要 |

### 5.3 Storybook / 既存テストとの整合

- Storybook は未導入（package.json 未設定）。UI-01 §11 の「Storybook + Chromatic 導入検討」は**新規導入の判断事項**
- vitest 既存（`@vitejs/plugin-react` 等）。UI-01〜06 のテスト観点を vitest + React Testing Library で書く方針は既存パターンと整合

---

## 6. ShojiStatusWidget 接続点

### 6.1 言及状況

**6 spec すべてで ShojiStatusWidget の言及はゼロ**（grep で確認、`/tmp/cross-ui-specs/*.md` への検索結果 0 件）。

| spec | 言及 | 接続点想定 | 不明点 |
|---|---|---|---|
| 01 layout-theme | ❌ 言及なし | Header の `rightActions` slot（§3.1）に同居? それとも別 slot? | Header 右端領域で「ユーザー名 + ロール + アクション」と並ぶ設計だが、東海林さん専用 widget はどこに置くか未定義 |
| 02 menu-bars | ❌ 言及なし | メニューバー ② 最下部 / ① 最下部にステータスインジケータ? | MenuBar2 共通コンポの props には ShojiStatusWidget 想定 slot なし |
| 03 personalization | ❌ 言及なし | 個人設定では非対象（東海林さん専用なら spec 化不要、admin/super_admin 限定の可能性）| データソース未定義 |
| 04 time-theme | ❌ 言及なし | 接続点なし（時間帯テーマは全員適用） | — |
| 05 achievement-effects | ❌ 言及なし | 達成演出は他ユーザーにも発火、東海林さんステータスは別系統と想定 | ShojiStatusWidget が「東海林さん本人の状態 / 不在通知」なのか「他者から見た東海林さんの状態」なのか不明 |
| 06 access-routing | ❌ 言及なし | ホーム画面 9 アイコン上 / Header 上に常駐? | 配置・読み込みタイミング未定義 |

### 6.2 推奨アクション

ShojiStatusWidget の仕様が**spec 化されていない**ため、a-bloom GW 着手前に以下を確定：

1. ShojiStatusWidget は何を表示するか（在席 / 集中作業中 / 自律実行中 / 復帰予定）
2. 表示対象ユーザー（super_admin のみ / admin+ / 全員）
3. データソース（root_employees の状態列? 専用テーブル?）
4. 配置（Header 右端 / 各画面常駐 / フローティング）
5. 読込タイミング（SSR / Realtime / polling）

→ **新規 spec 化を推奨**: `docs/specs/2026-04-XX-cross-ui-07-shoji-status-widget.md`

---

## 7. 推奨アクション（a-main 経由で東海林さんに確認）

### 7.1 GW 着手前に必ず確定すべき事項（最優先）

1. **10 モジュールブランドカラー HEX**（UI-01 §5.1、判6）→ B-1
2. **8 種の新規 npm パッケージ承認**（shadcn/ui, sonner, react-day-picker, lucide-react, heic2any, canvas-confetti, framer-motion, react-hotkeys-hook）→ B-2/B-4/B-9 + L-1〜L-8 一括承認
3. **Tailwind v4 前提への spec 修正**または **v3 ダウングレードの是非**（UI-01 §6.3）→ B-3
4. **ShojiStatusWidget 仕様確定 / spec 化**（§6.2）
5. **8-role（outsource 追加済）への spec 表記更新**（UI-02 §3.4 / UI-06 §4.3）→ M-3 / T-3
6. **`auth_employee_number()` / `has_role_at_least()` SQL 関数の develop への先行実装**（cross-cutting RLS audit と協調）→ B-5
7. **`root_employees` 拡張列の 1 本化 migration**（13 列 / D-1）

### 7.2 GW 中に並行で確定（実装と同時並行可）

8. アイコンセット選定（独自 SVG / Lucide）→ B-8
9. 扉演出デザインモチーフ → B-7
10. 時間帯テーマ画像調達方法（AI 生成 / ストック / 外注）→ B-6
11. デフォルト bonsai 画像 3 枚 → 同上
12. `logAchievement` API の cross-cutting spec 起草 → D-3
13. 既存 Tree SidebarNav 1047 行 → MenuBar2 移行戦略（書き直し / 段階移行）→ E-2

### 7.3 spec 修正提案（a-main / a-bloom が編集）

- **M-1**: UI-01 §3.3 のヘッダー時間帯背景を削除、UI-04 §5.3 に集約
- **M-2**: UI-04 §6.1 を「カスタム画像（メニューバーのみ）」と限定表現に修正
- **M-3**: UI-02 §3.4 / UI-06 §4.3 表に `outsource` 行追加
- **M-4**: UI-01 §3 の Header コンポ仕様に幅・高さ実数を取り込み

---

## 8. a-bloom 実装着手シナリオ

### シナリオ A: 全 spec 即着手 → 🔴 リスク高

- 6 spec すべてを GW 中に並行実装
- **却下推奨**：B-1 〜 B-7 が解消されないと、後戻り改修コストが大きい
- 特に Tailwind v4 / 新規 npm 8 種 / SQL 関数未実装は致命的

### シナリオ B: 確定度 B の spec から先行着手 → 🟢 推奨

GW 期間中、以下の順で進める：

**フェーズ 1（GW 前半、〜5/3）: 前提整備**
- a-main + 東海林さんで §7.1 の 7 項目を即決
- a-root が `auth_employee_number()` / `has_role_at_least()` を develop に先行実装
- a-bloom は **既存 BloomShell の改修準備**（PR は出さず）

**フェーズ 2（GW 後半、5/4〜5/6）: B 級 spec 着手**
- UI-02 menu-bars: アプリ切替 ① の MenuBar1.tsx 新規作成（独自実装、Lucide 不要）
- UI-05 achievement-effects: `achievements` テーブル + Realtime + シャボン玉 1 種のみ（花火 / 紙吹雪 / 流れ星は Phase 2）
- UI-01 layout-theme: Tailwind v4 の `@theme inline` で CSS variables を整備、Header.tsx 骨格

**フェーズ 3（GW 明け、5/7〜）: C 級 spec 整備後着手**
- UI-03 / UI-04 / UI-06 は前提決着後に再起動

### シナリオ C: 全 spec 議論後に再起動 → 🟡 慎重

- GW 中はスペック修正のみ、実装は GW 明けに集中
- a-bloom GW 期間が**設計議論のみ**になり、実装ボリュームが圧縮される
- 6 spec の確定度を A/B に押し上げ後、Phase 1a 再着手

→ **推奨: シナリオ B**（GW 中に B 級 spec の限定範囲を着手、C 級は前提決着まで保留）

---

## 9. 関連ドキュメント

### 9.1 監査対象 6 spec（origin/feature/cross-ui-design-specs-batch10-auto）

- `docs/specs/2026-04-25-cross-ui-01-layout-theme.md`（425 行）
- `docs/specs/2026-04-25-cross-ui-02-menu-bars.md`（400 行）
- `docs/specs/2026-04-25-cross-ui-03-personalization.md`（576 行）
- `docs/specs/2026-04-25-cross-ui-04-time-theme.md`（446 行）
- `docs/specs/2026-04-25-cross-ui-05-achievement-effects.md`（443 行）
- `docs/specs/2026-04-25-cross-ui-06-access-routing.md`（472 行）

### 9.2 関連 cross-cutting spec（develop 既存）

- `docs/specs/cross-cutting/spec-cross-error-handling.md`（UI-01 §6.2 sonner Toast の根拠）
- `docs/specs/cross-cutting/spec-cross-storage.md`（UI-03 §4 `ui-personalization` bucket の前例）
- `docs/specs/cross-cutting/spec-cross-rls-audit.md`（UI-03 / UI-05 の RLS 関数の前提）
- `docs/specs/cross-cutting/spec-cross-audit-log.md`
- `docs/specs/cross-cutting/spec-cross-chatwork.md`
- `docs/specs/cross-cutting/spec-cross-test-strategy.md`

### 9.3 既存実装で本 audit が参照したファイル

- `src/app/page.tsx`（Next.js デフォルトテンプレート、UI-06 §5.1 で全面書き換え対象）
- `src/app/layout.tsx`（Geist フォント設定）
- `src/app/globals.css`（Tailwind v4、`@theme inline`、`prefers-color-scheme: dark`）
- `src/app/forest/_components/ForestShell.tsx`（独自 header + FOREST_THEME）
- `src/app/forest/_constants/theme.ts`（`FOREST_THEME` 定義）
- `src/app/tree/_components/TreeShell.tsx`（`ACTIVE_THEME` + ThemeContext 移行 TODO 既存）
- `src/app/tree/_components/SidebarNav.tsx`（**1047 行**、UI-02 共通化対象）
- `src/app/tree/_constants/theme.ts`（`LIGHT_THEME` / `DARK_THEME` プレースホルダ）
- `src/app/bloom/_components/BloomShell.tsx`（独自 nav + 緑グラデ Header）
- `src/app/root/_constants/types.ts`（`GardenRole` 8 値、`outsource` 追加済 L181-189）
- `src/app/root/_state/RootStateContext.tsx`（認証 / `garden_role` 取得実装）
- `package.json`（Tailwind v4, Next 16, React 19、shadcn 系 npm 全て未導入）
- `supabase/migrations/`（`auth_employee_number()` / `has_role_at_least()` 関数 SQL 未確認）

### 9.4 起草元の自律レポート

- `docs/autonomous-report-202604250200-a-auto-cross-ui.md`（cross-ui specs 6 件起草時の判断保留サマリ）

---

## 10. 補遺: 監査の制約と前提

### 10.1 spec 編集禁止の遵守

本 audit では **6 spec のいずれも編集していない**。`docs/cross-ui-audit-20260426.md`（本ファイル）のみ新規作成。

### 10.2 既存実装の確認範囲

`src/app/` 配下を Glob / Grep で確認、書き込み一切なし。Storybook / 既存テストは package.json で未導入を確認（vitest のみ）。

### 10.3 推測と事実の区別

- **事実**: 行番号引用、ファイルパス、git ls-tree / grep 結果に基づくもの
- **推定**: ShojiStatusWidget の役割、東海林さん最終判断を要する項目

### 10.4 push 状態

- 監査ブランチ: `feature/cross-ui-audit-20260426-auto`（base: origin/develop）
- ローカル commit: 完了（hash は git log 参照）
- **push 試行**: GitHub アカウント suspend（403）でスキップ予定（手順は CLAUDE.md §13 / MEMORY 参照）

---

— cross-ui-audit-20260426 end —
