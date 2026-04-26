# Cross UI-06: アクセス動線（盆栽中心ビュー / 扉くぐりアニメ・権限別自動遷移）

- 対象: Garden シリーズ全モジュール（ログイン〜ホーム〜初回画面の遷移）
- 優先度: **🔴 最高**（後道さん UX 採用ゲートの中核、第一印象の UX 体験）
- 見積: **0.7d**（盆栽中心ビュー対応で +0.3d）
- 担当セッション: a-main + Root
- 作成: 2026-04-25（a-auto 002 / Batch 10 Cross UI #06）
- **改訂: 2026-04-27（a-auto / 後道さん採用ゲート反映、盆栽中心ビュー仕様化）**
- 前提:
  - UI-01（ThemeProvider / Header / 世界観演出）
  - UI-02（メニューバー ①②）
  - UI-04（時間帯テーマ、盆栽 / 樹木中心の世界観画像 5+ パターン）
  - Root 認証（既存 Supabase Auth + root_employees）

---

## 1. 目的とスコープ

### 目的

ログイン後の遷移と**ホーム画面そのもの**を、Garden の世界観（盆栽 / 樹木 を中心に 12 モジュールが世界の中で生きている姿）として表現する。
従来の「9 アイコン グリッド」の平面的レイアウトを廃し、**盆栽中心の立体的・物語的レイアウト**に再定義する。
権限別に最適な画面に自動誘導する Netflix/Hulu 風動線は維持し、業務までのクリック数を最小化する。

### 後道さん UX 採用ゲート（最重要制約）

- 後道さん（顧問の経理・税理士パートナー）は **visual モックアップでは判断不可、動く実物のみで評価**
- GW 期間（2026-04-29〜2026-05-05）までに「図 2（盆栽中心ビュー）」に**近い動く UI** が必須
- 後道さんが気に入らないと Garden 全体が採用されない = プロジェクト全体の採用ゲート
- 「東海林何もしてなかった」着地は最悪シナリオ → 動く本物 を最優先

### GW 必須要素

- 盆栽 / 樹木 中心の **立体的・物語的レイアウト**（🔴 必須）
- 朝/昼/夕/夜 + ランダム = **5+ パターンの時間帯変化**（🔴 必須、UI-04 で詳細）
- 全 12 モジュールが世界観の中で配置（孤立した平面アイコンではない、🔴 必須）
- 遊び心（hover アニメーション / 季節演出 等、🟡 高）
- 業務ボタンが世界観の中で見つけられる（🟡 高、業務効率と世界観の両立）

### 含める

- **盆栽中心ビュー**（ホーム画面の新レイアウト、12 モジュール立体配置）
- **背景画像と Layout の完全分離**アーキテクチャ
- 権限別自動遷移（toss/closer → Tree）の Netflix/Hulu 風動線
- 2 秒表示 → 自動遷移のタイマー実装
- 扉くぐりアニメーション（3 秒、デフォルト ON、スキップ可）
- ログイン時のシーケンス全体
- デフォルト動作 / 個人設定での挙動差異
- クリック・キー押下によるスキップ
- 各モジュール固有の hover 演出（葉が揺れる / 月が瞬く / 川が流れる 等）

### 含めない

- 認証処理そのもの（Root 既設）
- ログイン画面の UI 詳細（UI-01）
- 各アプリの内部画面遷移
- 達成演出のスロット詳細（UI-05）
- 時間帯画像の具体仕様（UI-04 が正本）

---

## 2. ホーム画面: 盆栽中心ビュー（最重要セクション）

### 2.1 コンセプト

**「中央に盆栽（または大きな木）、その周りに 12 モジュールが世界観の中で配置される」**

- アイコン グリッドではなく、**世界の中に各モジュールが息づいている**様を表現
- 中央の盆栽は Garden の象徴（プロジェクト名そのもの）
- 各モジュールは盆栽の周辺に**意味のある位置**で配置（後述 §2.4）
- 時間帯テーマ（UI-04）と連動し、朝/昼/夕/夜/季節 で**盆栽と背景が変化**

### 2.2 12 モジュール一覧（漏れなし）

| # | モジュール | 和名 | 主な役割 |
|---|---|---|---|
| 1 | Soil | 土 | DB 基盤・大量データ |
| 2 | Root | 根 | 組織・従業員・マスタ |
| 3 | Tree | 木 | 架電アプリ |
| 4 | Leaf | 葉 | 商材×商流ごとの個別アプリ |
| 5 | Bud | 蕾 | 経理・収支 |
| 6 | Bloom | 花 | 案件一覧・KPI・ダッシュボード |
| 7 | Seed | 種 | 新商材・新事業の拡張枠 |
| 8 | Forest | 森 | 全法人の決算資料等 |
| 9 | Rill | 川 | チャットワーク連携 |
| 10 | Fruit | 実 | （概念実体化済 2026-04-26）成果物・配信物 |
| 11 | **Sprout** | **芽（仮）** | オンボーディング・新規育成（2026-04-26 Sprout モジュール起草） |
| 12 | **Calendar** | **暦** | 全モジュール横断のスケジュール / 納税カレンダー / 月次マイルストーン |

**Help モジュールはオプションで 12 モジュールには含まれない**（project_garden_help_module 参照）。

### 2.3 配置レイアウト（テキスト図）

```
┌──────────────────────────────────────────────────────────────────┐
│  [背景: 時間帯別 盆栽 / 樹木 中心の世界観画像（独立 layer）]            │
│                                                                  │
│   ┌─ 空 / 月 / 太陽（時間帯演出）────────────────────────────┐    │
│   │                                                       │    │
│   │      Calendar               Forest                     │    │
│   │       (暦)                   (森)                      │    │
│   │     左上 -35%, -30%       右上 +35%, -30%               │    │
│   │                                                       │    │
│   │   Rill           ┌───────────┐         Bud            │    │
│   │   (川)           │           │         (蕾)            │    │
│   │  左 -45%, -5%    │  中央盆栽  │       右 +45%, -5%       │    │
│   │                  │  / 樹木    │                       │    │
│   │   Tree           │           │         Bloom          │    │
│   │   (木)           │           │         (花)            │    │
│   │  左 -25%, +5%    └───────────┘       右 +25%, +5%       │    │
│   │                                                       │    │
│   │      Soil                            Leaf              │    │
│   │      (土)                            (葉)              │    │
│   │   左下 -35%, +25%                  右下 +35%, +25%       │    │
│   │                                                       │    │
│   │      Root         Seed              Sprout             │    │
│   │      (根)         (種)               (芽)              │    │
│   │   左下 -20%, +35% 中下 0%, +40%     右下 +20%, +35%      │    │
│   │                                                       │    │
│   │                  Fruit                                 │    │
│   │                  (実)                                  │    │
│   │              中下 0%, +30%（盆栽の枝先）                │    │
│   │                                                       │    │
│   └───────────────────────────────────────────────────────┘    │
│                                                                  │
│   [ヘッダー: UI-01 §3.2.1 で正本管理（高さ 64px、独立 layer）]      │
└──────────────────────────────────────────────────────────────────┘
```

### 2.4 配置の意味付け（世界観に溶け込む配置）

| モジュール | 配置 | 配置の意味 |
|---|---|---|
| **中央** | 盆栽 / 大きな木 | Garden の象徴、視線が最初に集まる |
| **Soil（土）** | 左下 -35%, +25% | 木の根を支える土 = 大量データ基盤 |
| **Root（根）** | 中央下 -20%, +35% | 土の中、木の根 = 組織・人事の基礎 |
| **Tree（木）** | 中央左 -25%, +5% | 盆栽の幹そのもの = 架電（主業務） |
| **Leaf（葉）** | 中央右下 +35%, +25% | 木の葉 = 商材データ |
| **Bud（蕾）** | 右上 +45%, -5% | 木に咲く蕾 = 経理（次の収穫の準備） |
| **Bloom（花）** | 右中 +25%, +5% | 蕾から咲く花 = 案件成立・KPI |
| **Seed（種）** | 中央下 0%, +40% | 落ちた種 = 新事業の芽吹き準備 |
| **Sprout（芽）** | 右下 +20%, +35% | 土から出た新芽 = オンボーディング・育成 |
| **Fruit（実）** | 中央枝先 0%, +30% | 木に実る果実 = 成果物・配信物 |
| **Forest（森）** | 右上奥 +35%, -30% | 木が集まる森 = 全法人の決算 |
| **Rill（川）** | 左中 -45%, -5% | 庭を流れる川 = メッセージ流通 |
| **Calendar（暦）** | 左上奥 -35%, -30% | 空に浮かぶ暦 / 月や季節 = 時間軸 |

各モジュールの位置は**「中央盆栽からの相対座標（%）」**で定義し、背景画像 pixel に依存しない。

### 2.5 各モジュール固有の hover 演出

世界観に溶け込ませるため、アイコン的な単純拡大ではなく**自然物のような動き**を採用：

| モジュール | hover 演出 |
|---|---|
| Soil | 土がほんのり盛り上がる / 砂粒がパラパラ落ちる |
| Root | 根が地下で淡く光る（透過表現） |
| Tree | 葉がそよ風で揺れる（数 px 揺動）|
| Leaf | 葉が一枚はらりと舞う |
| Bud | 蕾がほんの少し開きかける |
| Bloom | 花弁が回転する（slow rotation）|
| Seed | 種が殻を破り光が漏れる |
| Sprout | 双葉が伸びる（scale-y 1.0 → 1.15）|
| Fruit | 実が艶めく / hover で淡い光 |
| Forest | 奥の森に霧が流れる（opacity 揺らぎ）|
| Rill | 川面に波紋が広がる |
| Calendar | 月 / 太陽が瞬く（明度の脈動）|

### 2.6 役割を伝える 3 つの手段（世界観 と 業務効率の両立）

世界観に溶け込ませながら、業務ユーザーが**該当モジュールを見つけられる**ことを担保する：

1. **位置記憶**: 各モジュールの配置は固定（一度覚えれば毎回同じ場所）
2. **hover ラベル**: hover 時にモジュール名を tooltip 表示（例: 「Bud（経理）」）
3. **アクセシビリティ**: スクリーンリーダー用 `aria-label`、Tab 順序は左上 → 右下の論理順

---

## 3. 完全分離アーキテクチャ（実装方針）

### 3.1 設計原則

**背景画像と Layout を完全分離して構築する**（東海林さん指示 2026-04-26）

- 配置座標は背景に依存しない**抽象座標**（中央からの % または グリッド）
- 背景画像差し替え時に layout を触らずに済む構造
- 後道さんが背景を気に入らない場合に layout を維持しつつ画像のみ差し替え可能

### 3.2 コンポーネント構造（2 layer）

```tsx
<HomeBonsaiView>
  {/* Layer 1: 背景画像（差し替え可能、UI-04 連動） */}
  <BackgroundLayer
    imagePath={resolvedTimeThemeImage}  // UI-04 から
    overlayDark={isDark ? 0.30 : 0}
  />

  {/* Layer 2: モジュール配置（背景に依存しない抽象座標） */}
  <ModuleLayer>
    <ModulePin module="calendar" position={{ x: -35, y: -30 }} />
    <ModulePin module="forest"   position={{ x: +35, y: -30 }} />
    <ModulePin module="rill"     position={{ x: -45, y: -5 }} />
    <ModulePin module="bud"      position={{ x: +45, y: -5 }} />
    <ModulePin module="tree"     position={{ x: -25, y: +5 }} />
    <ModulePin module="bloom"    position={{ x: +25, y: +5 }} />
    {/* 中央盆栽（Bonsai と同じ抽象座標、背景画像とは独立） */}
    <BonsaiCenter position={{ x: 0, y: 0 }} />
    <ModulePin module="soil"     position={{ x: -35, y: +25 }} />
    <ModulePin module="leaf"     position={{ x: +35, y: +25 }} />
    <ModulePin module="root"     position={{ x: -20, y: +35 }} />
    <ModulePin module="seed"     position={{ x:   0, y: +40 }} />
    <ModulePin module="sprout"   position={{ x: +20, y: +35 }} />
    <ModulePin module="fruit"    position={{ x:   0, y: +30 }} />
  </ModuleLayer>
</HomeBonsaiView>
```

### 3.3 BackgroundLayer の props 仕様

```tsx
type BackgroundLayerProps = {
  imagePath: string;        // UI-04 から渡される（差し替え可能）
  overlayDark?: number;     // ダーク時の overlay 強度
  altText?: string;         // alt（装飾なら空文字、UI-04 §3.5 参照）
  preloadHint?: boolean;    // LCP 候補の場合 preload
};
```

- 背景画像は `<picture>` で WebP / fallback JPEG を提供
- `object-fit: cover`、画像 aspect ratio が変わっても layout 崩れしない
- 後道さんが「この画像変えて」と言ったら `imagePath` だけ差し替えれば layout は不変

### 3.4 ModuleLayer の props 仕様

```tsx
type ModulePinProps = {
  module: ModuleKey;          // 'tree' / 'bud' / ... / 'sprout' / 'calendar'
  position: { x: number; y: number };  // 中央からの % 値
  size?: 'sm' | 'md' | 'lg';  // 重要度別のサイズ調整（Phase 2）
  visible?: boolean;          // 権限制御（§4）
};

// 内部実装:
// transform: translate(calc(-50% + {x}%), calc(-50% + {y}%))
// position: absolute、親は relative
```

**座標系の定義**：
- (0, 0) = 画面中央 = 盆栽の位置
- x: +右 / -左、画面幅の % 換算
- y: +下 / -上、画面高の % 換算
- レスポンシブ時は座標は同じ、container が縮小/拡大

### 3.5 背景差し替えシナリオ

```
シナリオ 1: 後道さんが「もっと和風で」と言った
  → BackgroundLayer の imagePath 差し替えのみ
  → ModuleLayer 不変、位置調整不要

シナリオ 2: 季節演出で桜を追加したい
  → BackgroundLayer の春バリエーション画像差し替え
  → ModuleLayer 不変

シナリオ 3: 配置が窮屈と言われた
  → ModuleLayer の position だけ調整
  → BackgroundLayer 不変
```

---

## 4. 権限別アクセス制御と自動遷移

### 4.1 8-role 別の表示モジュール（既存 §4.3 維持 + outsource 含む）

Garden 8-role 標準（toss / closer / cs / staff / outsource / manager / admin / super_admin）に基づき、ホーム盆栽ビューでの表示を制御する：

| garden_role | 表示されるモジュール | 自動遷移先 |
|---|---|---|
| toss | Tree, Bloom（限定）| `/tree`（2 秒後）|
| closer | Tree, Bloom（限定）| `/tree`（2 秒後）|
| cs | Tree, Bloom, Rill | （なし、ホーム留）|
| staff | Bud（事務範囲）, Leaf（担当範囲）, Rill | （なし、ホーム留）|
| outsource | 担当アプリのみ（Leaf 等、`module_owner_flags` で制御）| 担当が 1 つなら直行可、複数ならホーム留 |
| manager | 全 12 モジュール | （なし、ホームから選択）|
| admin | 全 12 モジュール | （なし、ホームから選択）|
| super_admin | 全 12 モジュール（管理機能含む）| （なし、ホームから選択）|

### 4.2 表示制御の実装

```tsx
// 各 ModulePin の visible 判定
function shouldShowModule(role: GardenRole, module: ModuleKey): boolean {
  if (role === 'manager' || role === 'admin' || role === 'super_admin') return true;

  const visibleByRole: Record<GardenRole, ModuleKey[]> = {
    toss:      ['tree', 'bloom'],
    closer:    ['tree', 'bloom'],
    cs:        ['tree', 'bloom', 'rill'],
    staff:     ['bud', 'leaf', 'rill', 'calendar'],
    outsource: getOutsourceVisibleModules(),  // module_owner_flags 参照
    manager:    [], // 全表示（上で早期 return）
    admin:      [],
    super_admin:[],
  };

  return visibleByRole[role].includes(module);
}
```

非表示モジュールは ModulePin が描画されず、レイアウトに穴が空くが**世界観として自然**（その世界に「自分が触れない領域」がある演出）。

### 4.3 outsource の特例

- 業務委託（outsource）は基本「自分担当のみ」
- 槙さん例外は `module_owner_flags` で制御（既存 Root 仕様）
- 該当アプリが 1 つなら自動遷移可（`getOutsourceTarget(user)` で判定）

---

## 5. 扉くぐりアニメーション

### 5.1 コンセプト（既存維持）

「庭の扉を開けて、1 本の大きな木 / 盆栽 が見える」 = Garden の世界観の象徴。

- 最初の画面: 閉じた木の扉（オークリーフ模様 or 和風モチーフ）
- 0.5s 経過: 扉が中央から左右に開く
- 1.5s 経過: 扉の向こう、光の中に**中央盆栽 / 大きな木のシルエット**
- 2.5s 経過: カメラが盆栽に寄る（ズーム）
- 3.0s 経過: フェードアウト → ホーム盆栽ビューへ（盆栽が中央に固定される連続性）

**改訂点**: 扉の先に見える木 = ホーム画面中央の盆栽 と**視覚的連続性**を持たせる。

### 5.2 実装案（既存維持）

**案 A: SVG + CSS アニメ**（Phase 1 推奨）

```tsx
<svg viewBox="0 0 1920 1080" className="door-anim">
  <g className="door-left"  style={{ animation: 'door-open-left 1s 0.5s ease-out forwards' }}>...</g>
  <g className="door-right" style={{ animation: 'door-open-right 1s 0.5s ease-out forwards' }}>...</g>
  <g className="bonsai"     style={{ animation: 'bonsai-reveal 1.5s 1.5s ease-out forwards' }}>...</g>
</svg>
```

### 5.3 CSS アニメーション定義

```css
@keyframes door-open-left {
  from { transform: translateX(0); }
  to   { transform: translateX(-100%); }
}
@keyframes door-open-right {
  from { transform: translateX(0); }
  to   { transform: translateX(100%); }
}
@keyframes bonsai-reveal {
  from { opacity: 0; transform: scale(0.8); }
  to   { opacity: 1; transform: scale(1); }
}
```

### 5.4 スキップ方法（既存維持）

- **クリック**（画面どこでも）→ 即 fade out → ホーム
- **Enter / Space キー** → 同上
- **Esc キー** → 同上

### 5.5 個人設定（既存維持）

```sql
-- UI-03 で追加予定の root_employees.ui_enable_door_animation
-- default true、OFF にすると扉演出スキップ
```

---

## 6. ホーム画面 2 秒表示 → 自動遷移（toss/closer）

### 6.1 Netflix 風のトランジション（盆栽ビュー対応）

```
t=0s   ホーム盆栽ビュー フル表示（中央盆栽 + 各モジュール配置）
       Tree モジュール（盆栽の幹位置）がハイライト（pulse animation）
       テキスト「2 秒後に Tree に移動します（スキップ: クリック）」

t=0-2s 周辺モジュールが薄くなり、Tree（盆栽の幹）だけが残る

t=2s   Tree が全画面にズーム（盆栽の幹に飛び込む演出）
       Tree ダッシュボードにフェード

t=2.3s Tree ダッシュボード完全表示
```

### 6.2 実装

```tsx
// src/components/shared/HomeAutoRedirect.tsx
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

### 6.3 スキップ動作

- 2 秒経過前に**クリック**（画面どこでも）→ タイマー解除、ホーム留まる
- **Esc キー** → 同上
- 一度スキップすると、同セッション中は自動遷移しない（sessionStorage）

### 6.4 個人設定

```sql
ALTER TABLE root_employees
  ADD COLUMN IF NOT EXISTS ui_auto_redirect_enabled boolean NOT NULL DEFAULT true;
```

---

## 7. ログイン時のシーケンス全体コード

### 7.1 エントリポイント

`src/app/page.tsx`：

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchCurrentUser } from '@/lib/auth';
import { DoorAnimation } from '@/components/shared/DoorAnimation';
import { HomeBonsaiView } from '@/components/shared/HomeBonsaiView';
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
        <HomeBonsaiView user={user} />
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

### 7.2 ログイン画面 → 扉 → 盆栽ビュー の連続性

- ログイン背景（UI-04）も盆栽 / 樹木 中心の世界観画像
- 扉演出の最後に見える木 = ホーム中央の盆栽
- ホーム盆栽ビュー初期表示時、中央盆栽が一瞬だけ強調 → 周辺モジュールがフェードイン（0.5s）
- 全シーケンスが**連続したストーリー**として体験される

---

## 8. アニメーション性能

### 8.1 目標

| 項目 | 目標 |
|---|---|
| 扉アニメーション FPS | 60 維持 |
| 扉アニメーション所要 | 3000ms ± 50ms |
| 自動遷移のプログレス | 16ms 毎更新（60fps）|
| スキップ反応 | < 100ms |
| 盆栽ビュー初期表示 | < 1500ms（モジュールフェードイン込み）|
| hover 演出（各モジュール）| 60fps、CPU 使用率 < 20% |

### 8.2 ベストプラクティス

- `will-change: transform, opacity` で GPU 加速
- ModulePin の hover 演出は CSS animation（JS 不要）
- 複雑な SVG は `<defs>` で事前定義、インスタンス化
- 遷移フェードは CSS `transition`

### 8.3 低スペック端末での fallback

- `navigator.hardwareConcurrency <= 2` or `navigator.deviceMemory < 4` で**簡素版**
  - 扉アニメ: クロスフェードのみ
  - hover 演出: 単純 scale のみ
  - 背景画像: 軽量版（Phase 2 で 1024×576 提供）

---

## 9. アクセシビリティ

### 9.1 prefers-reduced-motion

- OS 設定で「アニメーション削減」ON の場合
  - 扉演出: 単純 fade 500ms
  - 自動遷移: 即時（2 秒待たない）
  - hover 演出: 全停止（scale も 1.0 固定）
  - ズーム: なし

### 9.2 スクリーンリーダー

- 扉演出中: `aria-live="polite"` で「Garden にようこそ、まもなくホーム画面です」
- ホーム盆栽ビュー: 各 ModulePin に `aria-label="Tree（架電アプリ）"` 等
- 中央盆栽は `role="img" aria-label="Garden の象徴"`
- Tab 順序: 左上 → 右上 → 中央 → 左下 → 右下（論理順）

### 9.3 キーボード操作のみのユーザー

- 扉演出: Enter / Space / Esc でスキップ
- 自動遷移: Esc でキャンセル
- ModulePin: Tab で順番にフォーカス、Enter で遷移
- focus 時は hover と同等の visual feedback を提供

---

## 10. 実装ステップ

1. **Step 1**: `src/components/shared/HomeBonsaiView.tsx`（背景 + ModuleLayer 構造）（2.5h）
2. **Step 2**: `src/components/shared/BackgroundLayer.tsx`（差し替え可能 layer）（1h）
3. **Step 3**: `src/components/shared/ModuleLayer.tsx` + `ModulePin.tsx`（抽象座標配置）（2h）
4. **Step 4**: 12 モジュール固有の hover 演出（CSS animations）（2h）
5. **Step 5**: `src/components/shared/DoorAnimation.tsx`（盆栽連続性込み）（2h）
6. **Step 6**: `src/components/shared/HomeAutoRedirect.tsx` 2 秒タイマー + スキップ（1h）
7. **Step 7**: `src/app/page.tsx` エントリポイント書き換え（0.5h）
8. **Step 8**: 個人設定 UI（Root マイページ、UI-03 と統合）（0.5h）
9. **Step 9**: `root_employees.ui_enable_door_animation` / `ui_auto_redirect_enabled` 列追加（0.5h）
10. **Step 10**: 結合テスト・バグ修正・後道さん向け α 確認（1h）

**合計**: 約 **0.7d**（約 13h、盆栽ビュー対応で +0.3d）

---

## 11. 他 spec との接続点

| 関連 spec | 接続 |
|---|---|
| UI-01 layout-theme | Header レイアウト（§3.2.1）、ホーム画面の世界観演出基盤、ShojiStatusWidget 配置 |
| UI-02 menu-bars | Tree 等遷移後のメニューバー表示 |
| UI-03 personalization | 扉アニメ ON/OFF / 自動遷移 ON/OFF の個人設定 |
| UI-04 time-theme | ホーム盆栽ビュー背景は時間帯別 5+ パターン画像（盆栽中心） |
| UI-05 achievement | 遷移後のヘッダーに達成スロット |

---

## 12. テスト観点

- 扉アニメ 3s の精度
- 扉スキップ（クリック / Enter / Esc）の即座反応
- 自動遷移 2s + スキップ
- 権限別の表示モジュール（8-role × 12 モジュール = 96 組合せ）
- 権限別の自動遷移先（toss/closer → Tree、他 → ホーム留）
- 個人設定 OFF 時の挙動
- 盆栽ビュー初期表示の連続性（扉 → 盆栽の視覚連続）
- 各モジュール固有 hover 演出の動作
- 背景画像差し替え時に layout 不変であること（Visual Regression）
- prefers-reduced-motion 時の簡素化
- 低スペック端末（deviceMemory < 4）での fallback
- レスポンシブ時のモジュール座標維持（lg/xl/2xl）

---

## 13. 判断保留事項

- **判1: 扉アニメの長さ**
  - 2s / 3s / 4s / 5s
  - **推定スタンス**: 3s（既存確定）、長すぎ感あれば 2s 短縮検討
- **判2: 自動遷移の秒数**
  - 2s / 3s / 5s
  - **推定スタンス**: 2s（既存確定）
- **判3: 中央のモチーフ**
  - 盆栽 / 大きな木 / 木 + 庭 全体
  - **推定スタンス**: 盆栽中心（東海林さん指示「図 2」基準）、樹木バリエーションは後道さん意見次第
- **判4: モジュール座標の最終調整**
  - §2.4 のテキスト図の % は仮置き
  - **推定スタンス**: 実装後 α 確認で東海林さん調整、本 spec はガイド
- **判5: hover 演出の数**
  - 全 12 モジュール × 個別演出 / 共通演出 + 軽い差別化
  - **推定スタンス**: 全 12 個別（世界観強化、§2.5 仕様）、Phase 2 でブラッシュアップ
- **判6: 扉の色・デザイン**
  - オークリーフ模様 / 和風 / 西洋風 / シンプル線画
  - **推定スタンス**: 和風モチーフ（盆栽との連続性）、デザイナー相談
- **判7: 後道さん採用ゲートでの後退戦略**
  - 後道さんが盆栽中心ビューを否定した場合
  - **推定スタンス**: BackgroundLayer の画像差し替えで微調整、layout（ModuleLayer）は維持
- **判8: 季節演出の追加**
  - 春の桜 / 夏の濃緑 / 秋の紅葉 / 冬の雪
  - **推定スタンス**: UI-04 で時間帯ランダムに季節バリエーションを混ぜる、Phase 1 から含む
- **判9: ページロード時のスピナー**
  - 認証情報取得中の見せ方
  - **推定スタンス**: 全画面に bonsai アイコン + 「Loading...」、Phase 2 で木が育つアニメ

---

## 14. パフォーマンス測定項目

### 14.1 Core Web Vitals

| 指標 | 目標 | 計測方法 |
|---|---|---|
| LCP（ログイン画面）| < 2.5s | Lighthouse |
| LCP（ホーム盆栽ビュー）| < 2.5s | Lighthouse（背景画像が LCP 候補）|
| CLS（扉演出中）| < 0.1 | Lighthouse |
| CLS（盆栽ビュー）| < 0.1 | Lighthouse |
| FID / INP（スキップ）| < 100ms | 実機 |

### 14.2 バンドルサイズ

- DoorAnimation SVG: < 25KB
- HomeBonsaiView + ModuleLayer: < 50KB
- 12 ModulePin（CSS animations 含む）: < 30KB
- エントリポイント合計: < 110KB（gzipped）

---

## 15. 実装見込み時間の内訳

| 作業 | 見込 |
|---|---|
| HomeBonsaiView（背景 + ModuleLayer 構造）| 2.5h |
| BackgroundLayer（差し替え可能 layer）| 1.0h |
| ModuleLayer + ModulePin（抽象座標）| 2.0h |
| 12 モジュール固有 hover 演出 | 2.0h |
| DoorAnimation（盆栽連続性込み）| 2.0h |
| HomeAutoRedirect タイマー | 1.0h |
| エントリポイント書き換え | 0.5h |
| 個人設定 UI（UI-03 と統合）| 0.5h |
| DB migration（2 列追加）| 0.5h |
| 結合テスト + 後道さん向け α 確認 | 1.0h |
| **合計** | **0.7d**（約 13h）|

---

## 16. まとめ: Batch 10 + 盆栽ビュー対応 累計工数

| spec | 実装見込 |
|---|---|
| UI-01 layout-theme（世界観演出含む）| 0.7d |
| UI-02 menu-bars | 0.5d |
| UI-03 personalization | 0.7d |
| UI-04 time-theme（盆栽 5+ パターン）| 0.6d |
| UI-05 achievement-effects | 0.5d |
| **UI-06 access-routing（盆栽中心ビュー）** | **0.7d** |
| **合計** | **約 3.7d** |

- Batch 10 起草時見込 2.0-2.5d → 当初 3.1d → 盆栽ビュー対応で 3.7d（+0.6d）
- 後道さん採用ゲート確保のため、UI-04 / UI-06 の追加投資は必須投資扱い

---

— spec-cross-ui-06 end —
