# dispatch main- No. 161 — a-forest-002 へ Forest 背景画像配置 + atmospheres 定数追加 + BackgroundLayer 統合指示

> 起草: a-main-015
> 用途: a-forest-002 への Forest 背景画像（ライト + ダーク 2 枚）配置 + UI 統合準備
> 番号: main- No. 161
> 起草時刻: 2026-05-09(土) 01:51

---

## 投下用短文（東海林さんが a-forest-002 にコピペ、5/9 朝以降推奨）

~~~
🟡 main- No. 161
【a-main-015 から a-forest-002 への dispatch（Forest 背景画像配置 + atmospheres 定数追加 + BackgroundLayer 統合）】
発信日時: 2026-05-09(土) 01:51

# 件名
Forest UI 統一作業 第一弾 = 背景画像配置 + atmospheres 定数追加 + BackgroundLayer 統合（main- No. 159 と並行進行 OK）

# 背景
- bloom-005- No. 5（5/9 01:37）で 6 法人アイコン + グループ HD 統合アイコン組込完了
- main- No. 153 / 156（5/8 18:14-18:29）で claude.ai 案 1 + 案 3 採用、ChatGPT 第一弾着手 GO
- 東海林さんが ChatGPT で Forest 背景画像 2 枚（ライト + ダーク）生成完了 + 配置完了（5/9 01:50）
- a-main-015 視覚評価合格 ✅（連作整合性 / 樹冠俯瞰 / Bloom precedent 整合）
- 後続: main- No. NNN（a-main-016 起草予定）で Forest UI 統一全体 spec（ヘッダー / サイドバー / タブ）

# 配置済 Forest 背景画像（_reference 配下）

```
G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\_reference\garden-forest\
├─ bg-forest-light.png（朝の森、樹冠俯瞰 + 多層植物 + 朝霧、UI 用呼吸の余白あり）
└─ bg-forest-dark.png（月夜の森、ライト同構図 + 月光 + 蝶 + 蛍）
```

→ どちらも 1920x1080 PNG、a-main-015 視覚評価 完璧。

# 依頼内容（a-forest-002 で実施、約 0.3d 見込）

## A. WebP 変換（quality 90）

```
cwebp -q 90 bg-forest-light.png -o bg-forest-light.webp
cwebp -q 90 bg-forest-dark.png -o bg-forest-dark.webp
# (cwebp 不在なら Pillow で同 spec、bloom-005- No. 4 / No. 5 precedent 流用)
```

配置先:
```
C:\garden\a-forest-002\public\images\backgrounds\
├─ bg-forest-light.webp（新規）
└─ bg-forest-dark.webp（新規）
```

注: 元 PNG は削除禁止（feedback_no_delete_keep_legacy 準拠）、_reference 配下は永続保管。

## B. atmospheres 定数追加

ファイル: `src/app/_lib/background/atmospheres.ts`（既存、Bud / Bloom 共有）

追加内容:
```typescript
// Forest 専用 atmospheres
export const ATMOSPHERE_FOREST_LIGHT = '/images/backgrounds/bg-forest-light.webp';
export const ATMOSPHERE_FOREST_DARK = '/images/backgrounds/bg-forest-dark.webp';

// Forest atmospheres オブジェクト（BackgroundLayer 用、Bloom precedent 踏襲）
export const ATMOSPHERES_FOREST = {
  light: ATMOSPHERE_FOREST_LIGHT,
  dark: ATMOSPHERE_FOREST_DARK,
} as const;
```

→ Bloom precedent（ATMOSPHERE_BLOOM_LIGHT / ATMOSPHERE_BLOOM_DARK）と同パターンで定数化。

## C. BackgroundLayer 統合（Forest ページ内）

Forest UI 統一実装（後続 main- No. NNN）の前提として、本 dispatch で **atmospheres 定数の準備のみ** 完了させる（BackgroundLayer 統合は Forest UI 統一 spec 確定後）。

将来の使用例（参考、a-main-016 起草の Forest UI 統一 spec 内で具体化）:
```typescript
// src/app/forest/page.tsx 等で
import { useTheme } from '@/_lib/theme/ThemeProvider';
import { ATMOSPHERES_FOREST } from '@/_lib/background/atmospheres';
import BackgroundLayer from '@/_components/layout/BackgroundLayer';

const { theme } = useTheme();
const targetBg = theme === 'dark' ? ATMOSPHERES_FOREST.dark : ATMOSPHERES_FOREST.light;

<BackgroundLayer layer1Src={targetBg} layer2Src={...} activeLayer={...} />
```

## D. 既存 Forest mock 干渉確認（軽量）

既存 Forest 実装（src/app/forest/page.tsx 等）に旧背景画像参照がないか確認:
- 旧 Forest UI（Phase 1 等）が独自 background image を使用していないか
- 干渉あれば atmospheres 定数経由参照に切替

干渉なしなら追加作業不要、本 dispatch は §A + §B のみで完走可。

# Vercel push 停止 整合（5/9 朝以降は解除予定）

- 5/9 09:00 JST 過ぎ a-main-015 が解除 broadcast 発信予定
- 解除後、本タスクの commit は通常 push 可
- push 時の Vercel preview deploy で Forest 背景画像が読み込めるか確認

# 並行 main- No. 159 との関係

main- No. 159 = Forest 6 法人 mock GARDEN_CORPORATIONS 切替（コード変更）
main- No. 161 = Forest 背景画像配置 + atmospheres 定数追加（素材配置）

→ 並行進行可、同 PR で出すか別 PR で出すかは a-forest-002 判断。
推奨: 同 PR `feature/forest-ui-unification-prep-20260509`（前半 = 6 法人 mock、後半 = 背景画像）

# 完走報告フォーマット

```
🟢 forest-002-NN
【a-forest-002 から a-main-015 への完走報告】
発信日時: 2026-05-09(土) HH:MM
件名: Forest 背景画像配置 + atmospheres 定数追加 完了（main- No. 161）

完了内容:
- A: bg-forest-{light,dark}.webp 配置（XX KB / each、圧縮率 -XX.X%）
- B: src/app/_lib/background/atmospheres.ts に Forest 定数追加
- C: BackgroundLayer 統合は Forest UI 統一 spec 確定後（保留、後続 dispatch 待ち）
- D: 既存 Forest mock 干渉確認（あり / なし）

ローカル commit: NN 件
push: 5/9 09:00 JST 過ぎ broadcast 後
```

# 緊急度
🟡 中（5/12 まで着手推奨、5/13 統合テスト前必須、Forest UI 統一全体 spec の前提整備）

# 関連 dispatch / spec / docs

- main- No. 153（5/8 18:14）= ChatGPT 第一弾 GO（Bud + Forest 統一世界観）
- main- No. 156（5/8 18:29）= 案 1 + 案 3 採用（claude.ai HTML read 戦略）
- main- No. 159（5/9 01:31）= Forest 6 法人 mock 切替（並行進行）
- main- No. 161（本 dispatch）= Forest 背景画像配置 + atmospheres
- 後続: main- No. NNN（a-main-016 起草）= Forest UI 統一全体 spec（ヘッダー / サイドバー / タブ / 背景統合）
- docs: `docs/forest-ui-unification-research-20260509.md`（Explore 3 件並列調査結果、Forest UI 統一の前提知識集約）
- 元素材: bg-forest-light.png / bg-forest-dark.png（_reference/garden-forest/、永続保管）
~~~

---

## 詳細（参考）

発信日時: 2026-05-09(土) 01:51
発信元: a-main-015
宛先: a-forest-002
緊急度: 🟡 中（5/9 朝以降投下推奨、5/12 まで着手推奨）
