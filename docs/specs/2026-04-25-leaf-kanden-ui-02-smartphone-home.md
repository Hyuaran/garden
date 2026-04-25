# Leaf 関電 UI #02: スマホ専用ホーム画面（中央円グラフ + 周囲アイコン）

- 対象: スマホサイズ（< 768px）専用のホーム画面（デスクトップ UI と独立）
- 優先度: **🔴 最高**（現場の主な利用デバイスがスマホ）
- 見積: **1.0d 実装** / 0.2d spec
- 担当セッション: a-leaf
- 作成: 2026-04-25（a-auto 002 / Batch 13 Leaf 関電 UI #02）
- 前提:
  - spec-cross-ui-01（Header / ThemeProvider）
  - spec-cross-ui-02（メニューバー、本 spec で**スマホは非使用**）
  - Batch 13 #03 responsive（ブレークポイント 768px 境界）

---

## 1. 目的とスコープ

### 目的

現場担当者がスマホで関電業務を完結できるよう、**中央に進捗円グラフ + 周囲に機能アイコン**配置の専用ホーム画面を新設する。デスクトップ UI のメニューバー構造とは異なる、タッチ操作最適化されたエントリーポイント。

### 含める

- スマホ専用ホーム（`/leaf/kanden`、< 768px のみ）
- 中央円グラフ（本日件数 / 月間件数）
- 周囲機能アイコン配置（メニューバー非使用）
- 上タブ 3 つ（マイページ / 案件一覧 / ホーム）
- タッチターゲット最適化
- スワイプジェスチャー対応

### 含めない

- デスクトップ UI（既存維持）
- レスポンシブ詳細（#03 で別途）
- メニューバー側の修正（spec-cross-ui-02 維持）

---

## 2. デバイス分岐

### 2.1 検出ロジック

```tsx
// src/app/leaf/kanden/page.tsx
'use client';

import { useEffect, useState } from 'react';

export default function KandenHome() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile ? <KandenMobileHome /> : <KandenDesktopHome />;
}
```

### 2.2 SSR との両立

- 初回 SSR は `KandenDesktopHome` でレンダー（デフォルト）
- ハイドレーション時に `useEffect` で切替
- ちらつき防止: `useMediaQuery` フック + `loading` フォールバック

```tsx
const isMobile = useMediaQuery('(max-width: 767px)');
if (isMobile === undefined) return <LoadingShell />;
return isMobile ? <Mobile /> : <Desktop />;
```

---

## 3. スマホホーム画面構成

### 3.1 全体レイアウト

```
┌────────────────────────┐
│ Header（コンパクト）     │
│ ☰  Garden Leaf 関電  👤  │
├────────────────────────┤
│ ┌──────────────────┐    │
│ │ 上タブ            │    │
│ │ [マイページ][案件一覧][🏠 ホーム]│ ← アクティブ強調
│ └──────────────────┘    │
├────────────────────────┤
│                        │
│   ・・・周囲アイコン・・   │
│  📷                  🔍 │
│ 検索        🟢          │
│             ┌──┐         │
│ 🆕         │82│         │ 📋
│ 新規      │件│        一覧
│             └──┘         │
│             月間          │
│                        │
│ 📊                  ⚙️ │
│ KPI                設定 │
│                        │
└────────────────────────┘
```

### 3.2 中央円グラフ（KPI）

#### 表示内容

```
中央円: 月間件数（例: 82 件）
回り: 4 弦に分割
  - 上: 8 段階ステータス別件数
  - 各弦の角度がステータス比率に対応
```

#### 表示パターン切替

```
タブ: [本日][今週][月間（既定）][今期]
```

タップで円グラフが更新（300ms アニメーション）。

#### 数字のサイズ・配色

- 中央: フォント 64px、太字、ブランドカラー（Leaf 緑）
- 「件」: 中央数字の右下、24px
- 補助情報: 「先月比 +12%」を下に

### 3.3 周囲機能アイコン（5-6 個配置）

| 位置 | アイコン | ラベル | リンク先 |
|---|---|---|---|
| 左上 | 📷 | 撮影 | `/leaf/kanden/upload`（カメラ起動）|
| 右上 | 🔍 | 検索 | `/leaf/kanden/search`（#01）|
| 左中 | 🆕 | 新規 | `/leaf/kanden/new`（既存 input UI）|
| 右中 | 📋 | 一覧 | `/leaf/kanden/list`（既存 backoffice UI）|
| 左下 | 📊 | KPI | `/leaf/kanden/kpi` |
| 右下 | ⚙️ | 設定 | `/leaf/kanden/my-page`（マイページ #06）|

### 3.4 タッチターゲット

- アイコン min 64×64px（推奨 88×88px）
- アイコン間隔: 32px 以上
- タップで触覚フィードバック（`navigator.vibrate(10)` 対応端末のみ）

---

## 4. 上タブ 3 つの仕様

### 4.1 タブ構成

```
[ マイページ ]  [ 案件一覧 ]  [ ホーム 🏠 ]
```

- ホームがデフォルト（中央配置）
- スワイプ左/右で切替
- アクティブタブはブランドカラー下線 3px

### 4.2 タブ別画面

#### マイページタブ
- ユーザー情報・各種設定（#06 マイページ拡張参照）

#### 案件一覧タブ
- 既存 backoffice UI のスマホ対応版
- 1 列グリッド、スワイプで操作

#### ホームタブ
- 本 spec の中央円グラフ画面

### 4.3 状態保持

- タブ選択は sessionStorage に保存
- 別画面遷移後の戻り時に同タブを復元

---

## 5. アクセシビリティ

### 5.1 タッチ操作

- ダブルタップでズーム（OS 既定）
- 長押しでツールチップ（`title` 属性）
- ピンチイン/アウトはコンテンツ内のみ（ヘッダー固定）

### 5.2 スクリーンリーダー

- 円グラフに `aria-label="月間 82 件、ステータス別の内訳がチャート表示中"`
- 各アイコンに `aria-label="案件一覧を開く"` 等
- スワイプ操作の代替: 上タブを直接タップで切替

### 5.3 prefers-reduced-motion

- 円グラフのアニメーション削減（瞬間切替に変更）

---

## 6. パフォーマンス

### 6.1 目標

| 指標 | 目標 |
|---|---|
| 初回表示 LCP | < 2s |
| 円グラフ描画 | < 500ms |
| タブ切替 | < 200ms |
| アイコンタップ反応 | < 100ms |

### 6.2 最適化

- 円グラフは Recharts（既存採用）+ `React.memo` でメモ化
- KPI データは 30 秒キャッシュ（連続タブ切替で再取得しない）
- 画像アイコンは SVG（軽量、ベクター）

### 6.3 オフライン対応

- 直近の KPI 値を localStorage キャッシュ
- ネット断時はキャッシュ表示 + 「オフライン中」バナー

---

## 7. KPI データ取得

### 7.1 集計クエリ

```sql
-- 月間件数 + ステータス別内訳
SELECT
  count(*) AS total_count,
  count(*) FILTER (WHERE status = 'ordered') AS ordered_count,
  count(*) FILTER (WHERE status = 'awaiting_entry') AS awaiting_entry_count,
  count(*) FILTER (WHERE status = 'completed') AS completed_count,
  -- ... 8 段階分
FROM soil_kanden_cases
WHERE leaf_user_in_business('kanden')
  AND ordered_at >= date_trunc('month', now())
  AND deleted_at IS NULL;
```

### 7.2 RLS

- `leaf_user_in_business('kanden')` 全員可
- 全件集計、自分の案件のみではない

### 7.3 集計頻度

- API GET 時に都度計算
- `EXPLAIN ANALYZE` で 100ms 以下確認
- 件数増加時は materialized view 検討（Phase 2）

---

## 8. 撮影機能（左上アイコン）

### 8.1 起動

- `<input type="file" accept="image/*" capture="environment">` でカメラ直接起動
- iOS Safari / Android Chrome 対応

### 8.2 撮影後の処理

1. Canvas で圧縮（UI-03 パターン）
2. 案件選択モーダル（既存案件に追加 / 新規案件作成）
3. アップロード進捗バー
4. 完了 toast

### 8.3 オフライン撮影

- ネット断時も撮影可能
- localStorage キューに保存、復帰時自動アップロード

---

## 9. 実装ステップ

1. **Step 1**: `useMediaQuery` フック実装（0.5h）
2. **Step 2**: `KandenMobileHome.tsx` 骨格 + 上タブ 3 つ（1.5h）
3. **Step 3**: 中央円グラフ（Recharts）+ 期間切替（2h）
4. **Step 4**: 周囲アイコン配置 + リンク（1.5h）
5. **Step 5**: 撮影機能（カメラ起動 + 圧縮 + アップロード）（2h）
6. **Step 6**: タブ間スワイプジェスチャー（Framer Motion）（1h）
7. **Step 7**: オフライン対応（localStorage キャッシュ）（0.5h）
8. **Step 8**: 結合テスト・実機検証（iPhone / Android）（0.5h）

**合計**: 約 **1.0d**（約 9h）

---

## 10. テスト観点

- < 768px / >= 768px の境界切替
- iPhone Safari / Android Chrome / Samsung Internet
- 横画面 / 縦画面の自動切替
- スワイプジェスチャー（左右 / 上下）
- カメラ起動（権限なし時のフォールバック）
- オフライン → オンライン復帰時の処理
- 円グラフのデータ更新（30 秒キャッシュ）
- タッチターゲットサイズ（axe-core）
- ダーク / ライトモード切替

---

## 11. 判断保留事項

- **判1: ホーム画面の表示密度**
  - 6 アイコン / 9 アイコン / ユーザーカスタム
  - **推定スタンス**: 6 アイコン（既定）、ユーザーカスタムは Phase 2
- **判2: 円グラフのデフォルト期間**
  - 本日 / 月間 / 今期
  - **推定スタンス**: 月間（業務感覚に合致）
- **判3: スワイプジェスチャー**
  - Framer Motion / 独自実装 / なし
  - **推定スタンス**: Framer Motion（既存採用、再利用可）
- **判4: タブレット時の扱い**
  - スマホ UI / デスクトップ UI / タブレット専用
  - **推定スタンス**: 768-1024px はデスクトップ UI（メニューバー表示）、< 768 のみ本スマホ UI
- **判5: 撮影アイコンの配置**
  - 左上 / 右上 / 中央下
  - **推定スタンス**: 左上（最頻使用、親指届きやすい右利き想定）
- **判6: アイコン追加要望時の拡張**
  - 既定 6 個固定 / 業務責任者が編集可
  - **推定スタンス**: Phase 1 固定、Phase 2 で admin 編集 UI
- **判7: ホーム画面のリフレッシュ**
  - プル to リフレッシュ / 自動 30s polling / 手動ボタン
  - **推定スタンス**: プル to リフレッシュ（モバイル UX 標準）+ 自動 30s

---

## 12. 実装見込み時間の内訳

| 作業 | 見込 |
|---|---|
| useMediaQuery + 分岐 | 0.5h |
| ホーム骨格 + 上タブ | 1.5h |
| 中央円グラフ | 2.0h |
| 周囲アイコン配置 | 1.5h |
| 撮影機能 | 2.0h |
| スワイプジェスチャー | 1.0h |
| オフライン対応 | 0.5h |
| 結合テスト + 実機検証 | 0.5h |
| **合計** | **1.0d**（約 9.5h）|

---

— spec-leaf-kanden-ui-02 end —
