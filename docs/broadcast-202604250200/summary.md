# Batch 10 Garden シリーズ横断 UI 設計書 全体サマリ

- 発動: 2026-04-25 01:10 頃 / a-auto 002 セッション就寝前モード継続
- 完了: 2026-04-25 約 02:00
- ブランチ: `feature/cross-ui-design-specs-batch10-auto`（develop 派生、`8331585` 基点）
- 対象: Garden 全 9 アプリ横断の UI 規約（レイアウト・テーマ・メニュー・カスタマイズ・時間帯・達成演出・動線）

---

## 🎯 成果物

| 優先度 | # | ファイル | 行 | 見積 |
|---|---|---|---|---|
| 🔴 最高 | 1 | [UI-01 layout-theme](../specs/2026-04-25-cross-ui-01-layout-theme.md) | 425 | 0.6d |
| 🔴 最高 | 2 | [UI-02 menu-bars](../specs/2026-04-25-cross-ui-02-menu-bars.md) | 400 | 0.5d |
| 🔴 高 | 3 | [UI-03 personalization](../specs/2026-04-25-cross-ui-03-personalization.md) | 576 | 0.7d |
| 🟡 中 | 4 | [UI-04 time-theme](../specs/2026-04-25-cross-ui-04-time-theme.md) | 445 | 0.4d |
| 🟡 中 | 5 | [UI-05 achievement-effects](../specs/2026-04-25-cross-ui-05-achievement-effects.md) | 442 | 0.5d |
| 🔴 高 | 6 | [UI-06 access-routing](../specs/2026-04-25-cross-ui-06-access-routing.md) | 472 | 0.4d |

**合計**: **2,760 行**、実装見積 **3.1d**（画像調達除く）

> Batch 10 起草時見込 2.0-2.5d → 実見積 3.1d（+0.6〜1.1d）。個人カスタマイズ（UI-03）が想定より厚く、shadcn/ui 導入コストも反映。

---

## 🔑 各 spec の核心

### UI-01 Layout & Theme 🔴
- 3 階層レイアウト（ログイン / ホーム 9 アイコン / 各アプリ内）
- 青空系ヘッダー共通コンポーネント（`src/components/shared/Header.tsx`）
- **Tailwind + CSS variables** でダーク/ライトモード切替基盤
- **モジュール別ブランドカラー 10 色**（Soil/Root/Tree/Leaf/Bud/Bloom/Seed/Forest/Fruit/Rill）
- **shadcn/ui 採用方針**: Button/Dialog/Dropdown/Toast/Tooltip 等の汎用パーツ
- 既存 FOREST_THEME / LIGHT_THEME の段階移行

### UI-02 Menu Bars 🔴
- ① アプリ切替（56px 縦並び、10 モジュールアイコン）
- ② 機能メニュー（200px、現 Tree 踏襲、折りたたみ可）
- 権限別ブランドカラー / グレーアウト表示
- モバイルドロワー（左 ① / 中央 ② 分離）
- キーボード: `Ctrl + Alt + 1-9` で直接遷移

### UI-03 Personalization 🔴
- 画像カスタマイズ 3 パターン（①だけ 400×800 / ②だけ 400×800 / ①+② 幅 800×800）
- **組織既定 + 個人上書き**のハイブリッド設計
- `root_org_ui_defaults` テーブル + `root_employees` 拡張列
- `ui-personalization` bucket + RLS ポリシー（`org/` admin+、`personal/{id}/` 本人のみ）
- jpg/png/heic/webp → client-side jpg 変換（Canvas 圧縮、Leaf C-03 踏襲）
- 半透明オーバーレイ自動適用（0-50% 調整、可読性ガード）
- Root マイページ + ホーム画面クイック設定

### UI-04 Time Theme 🟡
- 5 パターン: 朝焼け（5-9）/ 昼（9-16）/ 夕焼け（16-19）/ 夜（19-5）/ ランダム
- **PC 時刻ベース** + `visibilitychange` 検知
- 日次ランダムは**日付ハッシュ**で再現性確保
- カスタム画像（UI-03）優先、時間帯テーマはフォールバック
- **ダーク時の黒オーバーレイ自動**（昼 0.4、夜 0.15）
- prefers-reduced-motion 対応、色覚対応（時間帯アイコン併用）

### UI-05 Achievement Effects 🟡
- 4 種: 花火（月次達成）/ シャボン玉（日次）/ 紙吹雪（節目）/ 流れ星（レア記録）
- `achievements` テーブル + Supabase Realtime 即座発火
- ログイン時の未確認フォロー（`acknowledged_at IS NULL` 順次表示）
- **ヘッダー中央スロット**（UI-01 `achievementSlot`）でアプリ横断持続
- キュー制御（5 件超でまとめ表示）
- 秒数制御の将来拡張インターフェース準備

### UI-06 Access Routing 🔴
- **扉くぐりアニメーション 3 秒**（SVG + CSS、個人 ON/OFF）
- Netflix/Hulu 風 2 秒自動遷移（toss/closer → Tree）
- クリック / Enter / Esc でスキップ可
- `root_employees.ui_enable_door_animation` / `ui_auto_redirect_enabled`
- prefers-reduced-motion / 低スペック端末の fallback

---

## 🔗 spec 間の依存関係

```
UI-01 layout-theme（基盤）
  ├─→ UI-02 menu-bars（左端 ①② 位置）
  ├─→ UI-03 personalization（CSS vars 上書き）
  ├─→ UI-04 time-theme（--header-sky-* 動的変更）
  ├─→ UI-05 achievement（Header achievementSlot）
  └─→ UI-06 access-routing（ホーム 9 アイコン、扉演出）

UI-02 → UI-03（メニューバー画像の適用先）
UI-03 → UI-04（カスタム優先 > 時間帯）
UI-05 → 各モジュール（達成発火トリガー）
UI-06 → UI-04（ログイン背景は時間帯）
```

---

## 📊 判断保留（計 41 件）

| # | spec | 件数 | 主要論点 |
|---|---|---|---|
| 1 | UI-01 | 6 | 日本語フォント / Fruit UI 表現 / Tailwind バージョン |
| 2 | UI-02 | 7 | モバイル統合 / アイコンセット / 折りたたみ既定 |
| 3 | UI-03 | 7 | heic ライブラリ / 画像検知 / overlay 段階数 |
| 4 | UI-04 | 7 | 画像調達 / 時間帯境界 / 季節感追加 |
| 5 | UI-05 | 7 | 花火負荷 / 音実装時期 / 履歴保持期間 |
| 6 | UI-06 | 8 | 扉長さ / 扉デザイン / 初回チュートリアル |

**最優先合意事項 6 件**（a-main 経由で東海林さん判断）:

1. UI-01 判2: Fruit（実）のホーム画面表示方式（概念のみ・クリック不可）
2. UI-02 判6: アプリアイコンセット（独自 SVG 制作 or Lucide ベース）
3. UI-03 判1: heic 変換ライブラリ（heic2any / サーバーサイド変換）
4. UI-04 判1: 時間帯画像 15 枚の調達（AI 生成 / 外注）
5. UI-05 判1: 花火演出の低スペック端末負荷（SVG アニメに降格要否）
6. UI-06 判5: 扉の色・デザイン（和風 / 西洋風 / シンプル）

---

## 🚀 推奨実装順序

```
M2 前半（2026-06 頃）: UI-01 + UI-02 = 1.1d
├─ UI-01 レイアウト・テーマ基盤（0.6d）
│   - CSS variables, ThemeProvider, Header
│   - shadcn/ui 基本 5 種導入
└─ UI-02 メニューバー ①② 実装（0.5d）
    - MenuBar1 / MenuBar2 共通コンポーネント
    - 10 アプリアイコン SVG 配置

M2 後半: UI-06 + UI-04 = 0.8d
├─ UI-06 扉くぐり + 自動遷移（0.4d）
└─ UI-04 時間帯テーマ（0.4d）
    ※ 画像調達は別タスク

M3 前半: UI-03 個人カスタマイズ（0.7d）
└─ 画像アップロード、組織既定管理

M3 後半: UI-05 達成演出（0.5d）
└─ 4 種アニメ + Realtime

**合計: 3.1d**（画像調達・デザイナー調整 除く）
```

### 段階投入

| 段階 | 投入内容 |
|---|---|
| Phase 1a | UI-01 + UI-02（レイアウト基盤のみ） |
| Phase 1b | UI-06（扉 + 自動遷移）追加 |
| Phase 1c | UI-04（時間帯）追加、画像 AI 生成 |
| Phase 1d | UI-03（カスタマイズ）追加 |
| Phase 2 | UI-05（達成演出）追加、Phase 1 全体の UX 改善 |

---

## 🚨 重要リスクと対策

### R1: 既存モジュールとの互換性
- 既存の FOREST_THEME / LIGHT_THEME / インラインスタイルとの共存
- **対策**: 段階的移行（新コンポーネントは CSS variables、既存は当面 maintain、Phase 3 で統一）
- **判定**: 移行期間中の UI 崩れ 0 件

### R2: モジュールブランドカラーの WCAG AA 未達
- Tree 緑 / Bud ピンク / Rill 水色は白背景で 4.5:1 未達
- **対策**: `-dark` バリアント追加、テキスト色は必ず明示
- **判定**: axe-core 全画面 violations 0

### R3: 時間帯画像の調達遅延
- 15 枚の画像制作・調達が全体進行を止める
- **対策**: Phase 1a は既定グラデーションのみで動作、画像は Phase 1c で追加
- **判定**: 画像なし状態でも機能的には破綻しない

### R4: 達成演出の低スペック PC 負荷
- 花火 Canvas パーティクルが FPS 落ち
- **対策**: `navigator.hardwareConcurrency` で SVG fallback、低性能環境では簡素版
- **判定**: 中位 PC で 60fps 維持

---

## 📥 次アクション（a-auto 停止後）

1. **a-main**: 本サマリを確認 → 判断保留 6 件を東海林さんに提示
2. **配布用短文を生成**:
   ```
   【a-auto から周知】
   docs/broadcast-202604250200/to-a-main.md を読んで、指定された手順で続きの作業を整えてください。
   ```
3. **Root セッション（a-root）**: UI-03 Personalization の実装担当、UI 設定 DB 追加列に着手
4. **各モジュールセッション**: UI-01 基盤完成後、既存 theme.ts の段階移行

---

## 🗂 累計（Batch 1-10）

| カテゴリ | spec 数 | 工数 |
|---|---|---|
| 設計・基盤（B1）| 6 | — |
| Forest Phase A（B2-4）| 16 | 8.7d |
| Bud Phase A-1（B5）| 6 | 3.0d |
| Bud Phase B 給与（B6）| 6 | 3.0d |
| Garden 横断 基盤（B7）| 6 | 4.75d |
| Leaf 関電 C（B8）| 6 | 4.5d |
| Tree Phase D（B9）| 6 | 5.1d |
| **Garden 横断 UI（B10）** | **6** | **3.1d** |
| **合計** | **58 spec** | **約 32.15d** |

Phase A-D の業務ロジック + 横断 UI 基盤がコンプリート。残るは Bud Phase C（年末調整）/ Soil・Rill・Seed 基盤 / Leaf 他商材。

---

— Batch 10 Garden 横断 UI 設計書 summary end —
