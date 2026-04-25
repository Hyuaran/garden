# Leaf 関電 UI #03: レスポンシブ対応（スマホ / タブレット / PC 三層）

- 対象: Garden-Leaf 関電業務委託の全画面（既存 + 本 Batch 13 新規）
- 優先度: **🔴 高**（モバイル現場利用が増加、UX 統一）
- 見積: **0.8d 実装** / 0.2d spec
- 担当セッション: a-leaf
- 作成: 2026-04-25（a-auto 002 / Batch 13 Leaf 関電 UI #03）
- 前提:
  - spec-cross-ui-01（CSS variables、Tailwind 戦略）
  - Batch 13 #01 image-search / #02 smartphone-home（本 spec の主要対象）
  - 既存 Leaf 関電画面（C-02 backoffice / C-03 input UI）

---

## 1. 目的とスコープ

### 目的

Leaf 関電のすべての画面を **スマホ / タブレット / PC** の 3 層で快適に使えるよう、ブレークポイント設計と既存コンポーネントの総点検を行う。

### 含める

- ブレークポイント設計（Tailwind 既定踏襲）
- 各画面の 3 層対応マトリクス
- レイアウトパターン 5 種
- 既存コンポーネントの修正方針
- 動作確認端末リスト

### 含めない

- スマホ専用ホーム（#02）
- 画像検索画面（#01、レスポンシブは内包）
- デスクトップ UI の根本変更

---

## 2. ブレークポイント設計

### 2.1 4 段階

| breakpoint | 幅 | 想定端末 |
|---|---|---|
| sm | < 640px | スマホ縦 |
| md | 640-1024px | スマホ横・タブレット縦 |
| lg | 1024-1280px | タブレット横・小型 PC |
| xl | >= 1280px | 通常 PC |

Tailwind の既定値に合わせる。

### 2.2 Leaf 関電での簡略化（3 層）

実装上の負荷軽減のため、3 層で扱う:

| 層 | 対応 breakpoint | UI |
|---|---|---|
| **Mobile** | sm（< 640）+ md 縦（< 768）| スマホ専用 UI |
| **Tablet** | md 横〜lg（768-1280）| デスクトップ UI（簡略化）|
| **Desktop** | xl 以上（>= 1280）| デスクトップ UI（フル）|

### 2.3 検出方法

```ts
// src/components/shared/useDevice.ts
export function useDevice() {
  const [device, setDevice] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 768) setDevice('mobile');
      else if (w < 1280) setDevice('tablet');
      else setDevice('desktop');
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return device;
}
```

---

## 3. 各画面の 3 層対応マトリクス

### 3.1 主要画面リスト

| # | 画面 | パス | Mobile | Tablet | Desktop |
|---|---|---|---|---|---|
| 1 | ホーム | `/leaf/kanden` | スマホ専用 #02 | デスクトップ UI | デスクトップ UI |
| 2 | 画像検索 | `/leaf/kanden/search` | 2 列グリッド | 3 列 | 4-6 列 |
| 3 | 案件一覧 | `/leaf/kanden/list` | 1 列カード | 2 列カード or テーブル | テーブル |
| 4 | 案件詳細 | `/leaf/kanden/[id]` | フルスクリーン | モーダル | モーダル |
| 5 | 新規送信 | `/leaf/kanden/new` | ステップ 1/2/3 縦 | 2 カラム | 2 カラム |
| 6 | マイページ | `/leaf/kanden/my-page` | 1 列カード | 2 列 | 2-3 列 |
| 7 | KPI | `/leaf/kanden/kpi` | 1 列縦 | 2 列 | グリッド |
| 8 | 設定 | `/leaf/kanden/settings` | 1 列フォーム | 1 列 | 1 列 |

### 3.2 共通要素

| 要素 | Mobile | Tablet | Desktop |
|---|---|---|---|
| Header | コンパクト 56px | 64px | 64px |
| メニューバー ① | 非表示 | アイコンバー 56px | アイコンバー 56px |
| メニューバー ② | 非表示 | 折りたたみ 56px | 展開 200px |
| 本文 padding | 16px | 24px | 32px |
| フォントサイズ基準 | 14px | 15px | 16px |

---

## 4. レイアウトパターン 5 種

### 4.1 P1: グリッド（カード一覧）

```
Mobile（1-2 列）   Tablet（3 列）    Desktop（4-6 列）
┌──┬──┐            ┌──┬──┬──┐        ┌──┬──┬──┬──┬──┐
│  │  │            │  │  │  │        │  │  │  │  │  │
└──┴──┘            ├──┼──┼──┤        ├──┼──┼──┼──┼──┤
┌──┬──┐            │  │  │  │        │  │  │  │  │  │
│  │  │            └──┴──┴──┘        └──┴──┴──┴──┴──┘
└──┴──┘
```

Tailwind: `grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6`

### 4.2 P2: テーブル → カードリスト

```
Mobile: テーブル → 1 列カードに変換
+----------------------+
| 案件 #001            |
| 顧客: 山田太郎       |
| ステータス: 受付済   |
| [詳細を開く >]      |
+----------------------+

Tablet: 主要列のみ表示
| ID  | 顧客 | ステータス |

Desktop: 全列表示
| ID  | 顧客 | 住所 | ステータス | 担当 | 日付 | 操作 |
```

### 4.3 P3: モーダル → フルスクリーン

```
Mobile（< 768）: フルスクリーン（戻るボタン）
Tablet/Desktop: モーダルダイアログ
```

```tsx
const Component = isMobile
  ? <FullScreenLayer onClose={handleClose}>...</FullScreenLayer>
  : <Modal isOpen={open} onClose={handleClose}>...</Modal>;
```

### 4.4 P4: フォーム縦並び

```
Mobile: 全フィールド縦 1 列
Tablet: 関連性ある 2 フィールドを横並び
Desktop: 3-4 列のグリッド
```

### 4.5 P5: タブナビゲーション

```
Mobile: 上部固定タブバー（スクロール可）
Tablet: 上部タブ
Desktop: サイドメニュー
```

---

## 5. 既存コンポーネントの修正方針

### 5.1 Tailwind utility 改修箇所

既存 Leaf 画面の修正対象:

| コンポーネント | 修正内容 |
|---|---|
| `BackofficeListShell.tsx` | grid を `grid-cols-1 md:grid-cols-2 xl:grid-cols-4` |
| `CaseDetailModal.tsx` | スマホはフルスクリーン化（`useDevice()` 分岐）|
| `InputWizard.tsx` | フォーム 1 列 → 2 列の breakpoint 別レイアウト |
| `KandenStatusBadge.tsx` | テキスト省略表示（`md:text-base text-sm`）|
| `FormField.tsx` | label 上配置 → md 以上で横並び |

### 5.2 共通 hook 追加

```ts
// src/components/shared/hooks/useDevice.ts
export const useDevice = () => { /* §2.3 */ };
export const useIsMobile = () => useDevice() === 'mobile';
export const useIsTablet = () => useDevice() === 'tablet';
export const useIsDesktop = () => useDevice() === 'desktop';
```

### 5.3 既存実装の壊さない移行

- 段階的に画面ごと対応
- 1 PR で 1 画面、最大 200 行程度
- E2E テストで両端検証（375px と 1920px）

---

## 6. タッチ vs マウス UX

### 6.1 タッチ最適化

| UI | Desktop | Mobile |
|---|---|---|
| ボタン | hover 効果あり | hover 効果なし、active 効果のみ |
| ツールチップ | hover で表示 | 長押しで表示 |
| ドラッグ&ドロップ | 標準 | 長押し → ドラッグ |
| 右クリックメニュー | あり | 長押しメニュー |
| double click | あり | double tap（ズーム回避） |

### 6.2 タップターゲット

- **min 44×44px**（WCAG AA）
- 重要操作は 48×48px 以上推奨
- 隣接要素の間隔 8px 以上

### 6.3 fat finger 対策

- フォームの送信ボタンは画面下部固定（誤押下防止）
- 削除等の破壊的操作は確認モーダル必須

---

## 7. テキストサイズ・読みやすさ

### 7.1 サイズスケール

```css
/* Mobile（< 768） */
:root {
  --text-base: 14px;
  --text-lg: 16px;
  --text-xl: 18px;
  --text-2xl: 22px;
}

/* Tablet/Desktop */
@media (min-width: 768px) {
  :root {
    --text-base: 15px;
  }
}

@media (min-width: 1280px) {
  :root {
    --text-base: 16px;
  }
}
```

### 7.2 行間

| 用途 | 行間 |
|---|---|
| 通常本文 | 1.6 |
| ヘッダー | 1.3 |
| 細かい注釈 | 1.5 |

### 7.3 フォントウェイト

- Mobile では `font-normal`（400）
- Desktop で重要箇所のみ `font-semibold`（600）
- スマホで太字使いすぎは可読性低下

---

## 8. 画像・アイコン

### 8.1 サムネサイズ

| Device | サムネ | プレビュー |
|---|---|---|
| Mobile | 200×200 | 800×800 |
| Tablet | 250×250 | 1000×1000 |
| Desktop | 300×300 | 1200×1200 |

最適サイズを `srcSet` で切替:

```tsx
<img
  srcSet={`${url}_sm.jpg 200w, ${url}_md.jpg 800w, ${url}_lg.jpg 1200w`}
  sizes="(max-width: 768px) 200px, (max-width: 1280px) 250px, 300px"
/>
```

### 8.2 アイコンサイズ

- Mobile: 24×24
- Tablet: 24×24
- Desktop: 20×20（密度高）

---

## 9. ナビゲーション

### 9.1 Mobile

- ハンバーガー: なし（スマホ専用 UI #02 で上タブ採用）
- 戻る: ヘッダー左上「<」ボタン
- 主要操作: フッターナビゲーション（Phase 2 検討）

### 9.2 Tablet

- メニューバー ②（折りたたみ 56px）
- ハンバーガーで展開可能

### 9.3 Desktop

- メニューバー ① + ② フル展開（cross-ui-02 準拠）

---

## 10. パフォーマンス

### 10.1 目標（端末別）

| 端末 | LCP | FID |
|---|---|---|
| iPhone 12（mid-range）| < 3.0s | < 100ms |
| Galaxy A54 | < 3.5s | < 100ms |
| iPad Air | < 2.5s | < 50ms |
| Desktop（一般 PC）| < 2.0s | < 50ms |

### 10.2 最適化方針

- 画像 lazy load（`loading="lazy"`）
- フォント preload
- Mobile: バンドル分割（不要な Desktop UI コードは送らない）
- service worker でキャッシュ（Phase 2）

---

## 11. 実装ステップ

1. **Step 1**: `useDevice` / `useMediaQuery` フック実装（0.5h）
2. **Step 2**: 既存 Leaf 関電 8 画面のレスポンシブ点検（2h、画面ごと 15min）
3. **Step 3**: 主要 5 レイアウトパターンの共通コンポーネント化（1.5h）
4. **Step 4**: タッチ vs マウス分岐（hover 切替等）（1h）
5. **Step 5**: 画像 srcSet + lazy load 適用（1h）
6. **Step 6**: 実機テスト（iPhone / Android / iPad）（1h）
7. **Step 7**: ブレイクポイント境界の動作確認（リサイズ）（0.5h）
8. **Step 8**: バグ修正（0.5h）

**合計**: 約 **0.8d**（約 8h）

---

## 12. 動作確認端末リスト

### 12.1 必須

- iPhone 12 / 13 / 15（iOS Safari）
- Galaxy A54 / S23（Android Chrome）
- iPad Air（iPadOS Safari）
- Surface Pro（Windows Chrome）
- 一般 PC（Windows / Mac、Chrome / Safari / Edge）

### 12.2 推奨

- iPhone SE（小型）
- Pixel 7
- Galaxy Z Flip（折りたたみ、画面切替で動作確認）

### 12.3 ブラウザ

- Chrome（Desktop / Mobile）
- Safari（Desktop / Mobile）
- Edge（Desktop）
- Firefox（Desktop）

Samsung Internet / Brave 等は best-effort。

---

## 13. テスト観点

- < 640 / 640-768 / 768-1024 / 1024-1280 / 1280+ の 5 境界
- 縦画面 / 横画面の切替時のレイアウト
- 画像 srcSet が正しい画像を読み込むか
- タッチ操作のターゲットサイズ（axe-core）
- フォント・スペーシングのデバイス別差
- スクロール時の固定要素（ヘッダー）の挙動
- ダーク/ライトモード × デバイス
- 折りたたみ端末（Z Flip 等）の境界

---

## 14. 判断保留事項

- **判1: タブレットの扱い**
  - 768-1024 を Mobile / Desktop どちらに寄せるか
  - **推定スタンス**: Desktop 寄り（メニューバー表示、簡略 UI）
- **判2: 折りたたみ端末対応**
  - Phase 1 / Phase 2
  - **推定スタンス**: Phase 1 は閉じた状態のみ最適化、開いた状態は Phase 2
- **判3: フォントサイズの調整可否**
  - 固定 / ユーザー設定可
  - **推定スタンス**: 固定（OS 設定で調整可能、独自 UI 不要）
- **判4: 横画面 Mobile 時のメニューバー表示**
  - 表示 / 非表示
  - **推定スタンス**: 横 Mobile（< 768）は非表示維持（縦と統一）
- **判5: 画像配信の最適化**
  - srcSet / Next.js Image / Cloudflare 画像
  - **推定スタンス**: srcSet（Phase 1）、Next.js Image は将来的に検討
- **判6: タッチデバイスの判定**
  - `window.matchMedia('(pointer: coarse)')` / userAgent
  - **推定スタンス**: matchMedia（標準的、UA 偽装に強い）
- **判7: PC ブラウザのレスポンシブ DevTools 偽装時**
  - userAgent で実機判定 / viewport のみ判定
  - **推定スタンス**: viewport のみ（DevTools 開発時に正しく動作）

---

## 15. 実装見込み時間の内訳

| 作業 | 見込 |
|---|---|
| useDevice フック | 0.5h |
| 8 画面のレスポンシブ点検 | 2.0h |
| 共通レイアウトパターン化 | 1.5h |
| タッチ / マウス分岐 | 1.0h |
| 画像最適化 | 1.0h |
| 実機テスト（5 端末）| 1.0h |
| バグ修正 | 0.5h |
| **合計** | **0.8d**（約 7.5h）|

---

— spec-leaf-kanden-ui-03 end —
