# Cross UI-06: アクセス動線（扉くぐりアニメ・権限別自動遷移）

- 対象: Garden シリーズ全モジュール（ログイン〜ホーム〜初回画面の遷移）
- 優先度: **🔴 高**（第一印象の UX 体験）
- 見積: **0.4d**
- 担当セッション: a-main + Root
- 作成: 2026-04-25（a-auto 002 / Batch 10 Cross UI #06）
- 前提:
  - UI-01（ThemeProvider / Header）
  - UI-02（メニューバー ①②）
  - UI-04（時間帯テーマ、ログイン背景）
  - Root 認証（既存 Supabase Auth + root_employees）

---

## 1. 目的とスコープ

### 目的

ログイン後の遷移に**ストーリー性のある演出**を加え、Garden の世界観（庭の扉 → 大きな木）を表現する。同時に、権限別に最適な画面に自動誘導することで**業務までのクリック数を最小化**する。

### 含める

- 権限別自動遷移（toss/closer → Tree）の Netflix/Hulu 風動線
- 2 秒表示 → 自動遷移のタイマー実装
- 扉くぐりアニメーション（3 秒、デフォルト ON、スキップ可）
- ログイン時のシーケンス全体
- デフォルト動作 / 個人設定での挙動差異
- クリック・キー押下によるスキップ

### 含めない

- 認証処理そのもの（Root 既設）
- ログイン画面の UI（UI-01 と既存）
- ホーム画面の 9 アイコン詳細（UI-01）
- 各アプリの内部画面遷移

---

## 2. ログイン後の全体シーケンス

### 2.1 権限別のシーケンス分岐

```
┌── ログイン成功 ──┐
│                 │
└───┬────────────┘
    ↓ 即時
┌─────────────────────────────┐
│ 扉くぐりアニメーション（3s）  │ ← 個人設定 OFF でスキップ
│ 庭の扉が開く → 1 本の木      │
└──┬──────────────────────────┘
   ↓ 3s 後（or スキップ）
┌─────────────────────────────┐
│ ホーム画面（9 アイコン）    │
└──┬──────────────────────────┘
   ↓ 判定
   ├─ toss / closer の場合
   │  ┌─ 2 秒表示（Netflix 風） ─┐
   │  │ ホームから Tree アイコ   │
   │  │ ンにズーム、Tree Dash    │
   │  │ へ自動遷移               │
   │  └─────────────────────────┘
   │         ↓
   │  Tree ダッシュボード
   │
   └─ 他の role（cs / staff / outsource / manager / admin / super_admin）
      ホーム画面のまま、ユーザー操作を待つ
      （outsource は自分担当アプリのみアクセス、槙さん例外あり）
```

### 2.2 個人設定による分岐

| 設定 | 挙動 |
|---|---|
| 扉アニメ ON（既定）| 扉 3s → ホーム → （権限別）|
| 扉アニメ OFF | ログイン → ホーム直接 → （権限別）|
| 自動遷移 OFF（toss/closer でも）| ホームに留まる |

---

## 3. 扉くぐりアニメーション

### 3.1 コンセプト

「庭の扉を開けて、1 本の大きな木が見える」 = Garden の世界観の象徴。

- 最初の画面: 閉じた木の扉（オークリーフ模様）
- 0.5s 経過: 扉が中央から左右に開く
- 1.5s 経過: 扉の向こう、光の中に大きな木のシルエット
- 2.5s 経過: カメラが木に寄る（ズーム）
- 3.0s 経過: フェードアウト → ホーム画面へ

### 3.2 実装案

**案 A: SVG + CSS アニメ**

- 軽量（~20KB）
- カスタマイズ柔軟
- 推奨（Phase 1 はこれ）

```tsx
<svg viewBox="0 0 1920 1080" className="door-anim">
  <g className="door-left"  style={{ animation: 'door-open-left 1s 0.5s ease-out forwards' }}>...</g>
  <g className="door-right" style={{ animation: 'door-open-right 1s 0.5s ease-out forwards' }}>...</g>
  <g className="tree"       style={{ animation: 'tree-reveal 1.5s 1.5s ease-out forwards' }}>...</g>
</svg>
```

**案 B: Lottie アニメーション**

- After Effects で制作、豪華演出可能
- ファイルサイズ大（~200KB）
- Phase 2 で差替検討

**案 C: 動画（mp4）**

- 最も豪華、モバイル負荷大
- 不採用

### 3.3 CSS アニメーション定義

```css
@keyframes door-open-left {
  from { transform: translateX(0); }
  to   { transform: translateX(-100%); }
}
@keyframes door-open-right {
  from { transform: translateX(0); }
  to   { transform: translateX(100%); }
}
@keyframes tree-reveal {
  from { opacity: 0; transform: scale(0.8); }
  to   { opacity: 1; transform: scale(1); }
}
```

### 3.4 スキップ方法

- **クリック**（画面どこでも）→ 即 fade out → ホーム
- **Enter / Space キー** → 同上
- **Esc キー** → 同上

### 3.5 個人設定

```sql
-- UI-03 で追加予定の root_employees.ui_enable_door_animation
-- default true、OFF にすると扉演出スキップ
```

設定画面 UI（Root マイページ）で ON/OFF 切替。

---

## 4. ホーム画面 2 秒表示 → 自動遷移（toss/closer）

### 4.1 Netflix 風のトランジション

```
t=0s   ホーム画面フル表示（9 アイコン）
       Tree アイコンがハイライト（pulse animation）
       テキスト「2 秒後に Tree に移動します（スキップ: クリック）」

t=0-2s 画面の周辺が薄くなり、Tree アイコンだけ残る

t=2s   Tree アイコンが全画面にズーム
       Tree ダッシュボードにフェード

t=2.3s Tree ダッシュボード完全表示
```

### 4.2 実装

```tsx
// src/app/home/page.tsx or src/components/shared/HomeAutoRedirect.tsx
'use client';

export function HomeAutoRedirect({ targetApp }: { targetApp: AppKey }) {
  const router = useRouter();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(elapsed / 2000, 1));
      if (elapsed >= 2000) {
        clearInterval(id);
        router.push(`/${targetApp}`);
      }
    }, 16);  // 60fps

    const cancelOnClick = () => clearInterval(id);
    window.addEventListener('click', cancelOnClick, { once: true });

    return () => {
      clearInterval(id);
      window.removeEventListener('click', cancelOnClick);
    };
  }, [router, targetApp]);

  return (
    <div className="home-redirect-overlay" style={{ opacity: progress }}>
      <p>2 秒後に Tree に移動します（スキップ: クリック）</p>
      <div className="progress-bar" style={{ width: `${progress * 100}%` }} />
    </div>
  );
}
```

### 4.3 権限別ターゲット

Garden 8-role 標準（toss / closer / cs / staff / outsource / manager / admin / super_admin）に基づき、自動遷移先を以下の通り定義する。

| garden_role | 自動遷移先 | 備考 |
|---|---|---|
| toss | `/tree` | アポインター |
| closer | `/tree` | クローザー |
| cs | （なし、ホーム留まる）| |
| staff | （なし）| 事務・バックオフィス |
| outsource | （なし、ホーム留まる）| 業務委託（自分担当のみアクセス）。槙さん例外は `module_owner_flags` で制御し、該当アプリ直行も可 |
| manager | （なし）| ホームから選ぶ |
| admin | （なし）| ホームから選ぶ |
| super_admin | （なし）| ホームから選ぶ |

### 4.4 スキップ動作

- 2 秒経過前に**クリック**（画面どこでも）→ タイマー解除、ホーム留まる
- **Esc キー** → 同上
- 一度スキップすると、同セッション中は自動遷移しない（localStorage）

### 4.5 個人設定

```sql
ALTER TABLE root_employees
  ADD COLUMN IF NOT EXISTS ui_auto_redirect_enabled boolean NOT NULL DEFAULT true;
```

設定画面でこの自動遷移を OFF にできる（toss/closer でも）。

---

## 5. ログイン時のシーケンス全体コード

### 5.1 エントリポイント

`src/app/page.tsx`（既存の Next.js template を書き換え）：

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchCurrentUser } from '@/lib/auth';
import { DoorAnimation } from '@/components/shared/DoorAnimation';
import { HomeScreen } from '@/components/shared/HomeScreen';
import { HomeAutoRedirect } from '@/components/shared/HomeAutoRedirect';

export default function RootPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<'loading' | 'door' | 'home' | 'redirect'>('loading');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    (async () => {
      const u = await fetchCurrentUser();
      if (!u) { router.push('/login'); return; }
      setUser(u);
      setPhase(u.ui_enable_door_animation ? 'door' : 'home');
    })();
  }, [router]);

  if (phase === 'loading') return <FullScreenSpinner />;
  if (phase === 'door' && user) {
    return <DoorAnimation onDone={() => setPhase('home')} />;
  }
  if (phase === 'home' && user) {
    const shouldAutoRedirect =
      user.ui_auto_redirect_enabled &&
      (user.garden_role === 'toss' || user.garden_role === 'closer') &&
      !sessionStorage.getItem('skipAutoRedirect');

    return (
      <>
        <HomeScreen user={user} />
        {shouldAutoRedirect && (
          <HomeAutoRedirect
            targetApp="tree"
            onCancel={() => sessionStorage.setItem('skipAutoRedirect', 'true')}
          />
        )}
      </>
    );
  }
}
```

### 5.2 ログイン画面（`/login`）の扉連携

- ログイン成功 → `router.push('/')` でエントリポイントに戻る
- エントリポイントが扉演出 → ホーム → 権限別誘導

### 5.3 ログアウト時

- `/logout` → Supabase `signOut()` → `/login` に戻る（扉・ホームを経由しない）

---

## 6. アニメーション性能

### 6.1 目標

| 項目 | 目標 |
|---|---|
| 扉アニメーション FPS | 60 維持 |
| 扉アニメーション所要 | 3000ms ± 50ms |
| 自動遷移のプログレス | 16ms 毎更新（60fps）|
| スキップ反応 | < 100ms |

### 6.2 ベストプラクティス

- `will-change: transform, opacity` で GPU 加速
- 複雑な SVG は `<defs>` で事前定義、インスタンス化
- 遷移フェードは CSS `transition`（JS で操作しない）

### 6.3 低スペック端末での fallback

- `navigator.hardwareConcurrency <= 2` or `navigator.deviceMemory < 4` で**簡素版扉アニメ**
- 簡素版: クロスフェードのみ（扉開閉なし）

---

## 7. アクセシビリティ

### 7.1 prefers-reduced-motion

- OS 設定で「アニメーション削減」ON の場合
  - 扉演出: 単純 fade 500ms に短縮
  - 自動遷移: 即時遷移（2 秒待たない）
  - ズーム: なし

### 7.2 スクリーンリーダー

- 扉演出中は `aria-live="polite"` で「Garden にようこそ、まもなくホーム画面です」読み上げ
- 自動遷移中は「2 秒後に Tree ダッシュボードに移動します。中断するにはクリックしてください」

### 7.3 キーボード操作のみのユーザー

- 扉演出: Enter / Space / Esc でスキップ可
- 自動遷移: Esc でキャンセル、ホームの Tab 順序に即座に入る

---

## 8. 実装ステップ

1. **Step 1**: `src/components/shared/DoorAnimation.tsx` SVG + CSS 実装（2h）
2. **Step 2**: `src/components/shared/HomeScreen.tsx` 9 アイコン + 権限別グレーアウト（1.5h）
3. **Step 3**: `src/components/shared/HomeAutoRedirect.tsx` 2 秒タイマー + スキップ（1h）
4. **Step 4**: `src/app/page.tsx` エントリポイント書き換え（0.5h）
5. **Step 5**: 個人設定 UI（Root マイページ、UI-03 と統合）（0.5h）
6. **Step 6**: `root_employees.ui_enable_door_animation` / `ui_auto_redirect_enabled` 列追加（0.5h）
7. **Step 7**: 結合テスト・バグ修正（0.5h）

**合計**: 約 **0.4d**（約 6.5h）

---

## 9. 他 spec との接続点

| 関連 spec | 接続 |
|---|---|
| UI-01 layout-theme | ホーム画面の 9 アイコンレイアウト |
| UI-02 menu-bars | Tree 遷移後のメニューバー表示 |
| UI-03 personalization | 扉アニメ ON/OFF / 自動遷移 ON/OFF の個人設定 |
| UI-04 time-theme | ホーム画面背景は時間帯テーマ |
| UI-05 achievement | 遷移後のヘッダーに達成スロット |

---

## 10. テスト観点

- 扉アニメ 3s の精度（ブラウザで要検証）
- 扉スキップ（クリック / Enter / Esc）の即座反応
- 自動遷移 2s + スキップ
- 権限別の遷移先（toss/closer → Tree、他 → ホーム留）
- 個人設定 OFF 時の挙動
- sessionStorage の `skipAutoRedirect` が再ログインで無効化
- prefers-reduced-motion 時の簡素化
- 低スペック端末（deviceMemory < 4）での fallback
- ログアウト直後の再ログインで扉演出が再発火

---

## 11. 判断保留事項

- **判1: 扉アニメの長さ**
  - 2s / 3s / 4s / 5s
  - **推定スタンス**: 3s（東海林さん確定仕様）、ただし長すぎ感あれば 2s に短縮検討
- **判2: 自動遷移の秒数**
  - 2s / 3s / 5s
  - **推定スタンス**: 2s（東海林さん確定仕様）
- **判3: toss/closer 以外の自動遷移**
  - admin は Forest / Bud 等
  - **推定スタンス**: Phase 1 は toss/closer のみ、他 role は手動選択
- **判4: sessionStorage vs localStorage**
  - 「スキップ設定」の保持期間
  - **推定スタンス**: sessionStorage（タブ閉じるまで、次回は自動遷移復活）
- **判5: 扉の色・デザイン**
  - オークリーフ模様 / 和風 / 西洋風 / シンプル線画
  - **推定スタンス**: 和風モチーフ（Garden = 庭のニュアンス）、デザイナー相談
- **判6: アニメーション内のロゴ表示**
  - 扉が開いた先に「Garden」ロゴ / テキスト / なし
  - **推定スタンス**: なし（木のシルエットで十分、ロゴ押し付けない）
- **判7: 初回ログイン時のチュートリアル**
  - 扉演出後に「Garden へようこそ」の説明
  - **推定スタンス**: Phase 1 は無し、Phase 2 で初回のみ追加
- **判8: ページロード時のスピナー**
  - 認証情報取得中の見せ方
  - **推定スタンス**: 全画面に bonsai アイコン + 「Loading...」、Phase 2 で木が育つアニメ

---

## 12. パフォーマンス測定項目

### 12.1 Core Web Vitals

| 指標 | 目標 | 計測方法 |
|---|---|---|
| LCP（ログイン画面）| < 2.5s | Lighthouse |
| LCP（ホーム画面）| < 2.0s | Lighthouse |
| CLS（扉演出中）| < 0.1 | Lighthouse |
| FID / INP（スキップ）| < 100ms | 実機 |

### 12.2 バンドルサイズ

- DoorAnimation SVG: < 25KB
- HomeScreen: < 30KB
- エントリポイント合計: < 60KB（gzipped）

---

## 13. 実装見込み時間の内訳

| 作業 | 見込 |
|---|---|
| DoorAnimation 実装（SVG + CSS）| 2.0h |
| HomeScreen 9 アイコン + 権限制御 | 1.5h |
| HomeAutoRedirect タイマー | 1.0h |
| エントリポイント書き換え | 0.5h |
| 個人設定 UI（UI-03 と統合）| 0.5h |
| DB migration（2 列追加）| 0.5h |
| 結合テスト | 0.5h |
| **合計** | **0.4d**（約 6.5h）|

---

## 14. まとめ: Batch 10 累計工数

| spec | 実装見込 |
|---|---|
| UI-01 layout-theme | 0.6d |
| UI-02 menu-bars | 0.5d |
| UI-03 personalization | 0.7d |
| UI-04 time-theme | 0.4d |
| UI-05 achievement-effects | 0.5d |
| **UI-06 access-routing** | **0.4d** |
| **合計** | **約 3.1d** |

- Batch 10 起草時見込 2.0-2.5d → 実見積 3.1d（+0.6〜1.1d）
- 個人カスタマイズ（UI-03）が想定より厚く、+0.3d
- shadcn/ui 導入 + 既存移行コスト +0.3d
- 別途: 時間帯テーマ画像調達（AI 生成 15 枚、~2h）は含まず

---

— spec-cross-ui-06 end —
