# Cross UI-03: 個人カスタマイズ（メニューバー画像・組織既定と個人上書き）

- 対象: Garden シリーズ全モジュール（メニューバー ①② の画像カスタマイズ）
- 優先度: **🔴 高**（ブランド体験の差別化、UX モチベーション向上）
- 見積: **0.7d**
- 担当セッション: a-root（メイン実装）+ a-main
- 作成: 2026-04-25（a-auto 002 / Batch 10 Cross UI #03）
- 前提:
  - UI-01（Header, ThemeContext, CSS variables）
  - UI-02（MenuBar1 / MenuBar2 構造）
  - spec-cross-storage（Batch 7、Supabase Storage bucket 設計パターン）
  - Leaf C-03（Canvas 圧縮・jpg 変換パターン）

---

## 1. 目的とスコープ

### 目的

組織既定の画像を土台に、**個人が自由にメニューバー画像をカスタマイズ**できる仕組みを提供。3 パターン（①だけ / ②だけ / ①+②幅）でバリエーション、組織・個人のハイブリッド運用。

### 含める

- 画像カスタマイズ 3 パターン（①/②/①+②）
- 組織既定 + 個人上書きフラグのデータモデル
- Root マイページ UI（設定画面詳細）
- `ui-personalization` Supabase Storage bucket 設計（RLS 含む）
- 半透明オーバーレイ自動適用（可読性ガード）
- jpg/png/heic/webp の client-side 変換処理（Canvas 圧縮）
- 画像サイズ上限・リサイズ仕様

### 含めない

- 時間帯テーマ画像（04）
- 達成演出アニメ（05）
- 個人の機能メニュー順序カスタマイズ（UI-02 §9 で軽く触れる）

---

## 2. カスタマイズ 3 パターン

### 2.1 パターン A: ① だけ

```
┌─┬───┬──────────────────────┐
│🖼 │   │  Header              │
│ │ ② ├──────────────────────┤
│カ│機 │                      │
│ス│能 │  メインコンテンツ     │
│タ│   │                      │
│ム│   │                      │
└─┴───┴──────────────────────┘
```

- ① 幅 56px に画像
- サイズ: **400×800px（縦長）**
- `object-fit: cover` + center

### 2.2 パターン B: ② だけ

```
┌─┬───┬──────────────────────┐
│ │🖼  │  Header              │
│①│   ├──────────────────────┤
│ア│カ │                      │
│プ│ス │  メインコンテンツ     │
│リ│タ │                      │
│ │ム │                      │
└─┴───┴──────────────────────┘
```

- ② 幅 200px に画像
- サイズ: **400×800px（縦長）**
- `object-fit: cover` + center

### 2.3 パターン C: ①+② 幅

```
┌───────┬──────────────────────┐
│🖼🖼   │  Header              │
│ワイド  ├──────────────────────┤
│ カスタム│                      │
│        │  メインコンテンツ     │
│        │                      │
└───────┴──────────────────────┘
```

- ①+② 合計 256px 幅（56+200）に 1 枚画像
- サイズ: **800×800px（正方形寄り、縦長）**
- `object-fit: cover` + center

---

## 3. 組織既定 + 個人上書き

### 3.1 階層設計

```
Priority（上が優先）:
  1. 個人カスタム画像（個人上書き許可時のみ）
  2. 組織既定画像（admin 設定）
  3. 既定（Garden のデフォルト画像、bonsai モチーフ）
```

### 3.2 設定権限

- **admin**: 組織既定の画像 + 「個人上書きを許可する」フラグを設定
- **一般社員**: 個人画像をアップロード（上書き許可時のみ）
- **Root マイページ**: 個人設定画面（§6）
- **ホーム画面**: クイック設定ショートカット（「背景画像を変える」ボタン）

### 3.3 DB 設計

#### 3.3.1 `root_org_ui_defaults`（組織既定、1 行のみ）

```sql
CREATE TABLE root_org_ui_defaults (
  id                       int PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- 1 行のみ保証
  pattern                  text NOT NULL DEFAULT 'A' CHECK (pattern IN ('A', 'B', 'C')),
  menu_bar1_image_key      text,    -- ui-personalization bucket のキー
  menu_bar2_image_key      text,
  menu_bar_wide_image_key  text,
  allow_personal_override  boolean NOT NULL DEFAULT true,
  overlay_opacity          numeric(3,2) DEFAULT 0.30 CHECK (overlay_opacity BETWEEN 0 AND 1),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  updated_by               text REFERENCES root_employees(employee_number)
);

INSERT INTO root_org_ui_defaults (id) VALUES (1);  -- 初期化
```

#### 3.3.2 `root_employees` 追加列

```sql
ALTER TABLE root_employees
  ADD COLUMN IF NOT EXISTS ui_pattern text
    CHECK (ui_pattern IN ('A', 'B', 'C', 'default')),  -- default = 組織既定
  ADD COLUMN IF NOT EXISTS ui_menu_bar1_image_key text,
  ADD COLUMN IF NOT EXISTS ui_menu_bar2_image_key text,
  ADD COLUMN IF NOT EXISTS ui_menu_bar_wide_image_key text,
  ADD COLUMN IF NOT EXISTS ui_dark_mode boolean,  -- NULL = システム設定追従
  ADD COLUMN IF NOT EXISTS ui_enable_door_animation boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ui_overlay_opacity numeric(3,2);
```

### 3.4 読み取り時の解決

```ts
// src/components/shared/_lib/resolveUI.ts
export function resolveUserUI(employee: RootEmployee, orgDefault: OrgUIDefaults) {
  if (!orgDefault.allow_personal_override || employee.ui_pattern === 'default') {
    return {
      pattern: orgDefault.pattern,
      bar1: orgDefault.menu_bar1_image_key,
      bar2: orgDefault.menu_bar2_image_key,
      wide: orgDefault.menu_bar_wide_image_key,
      overlay: orgDefault.overlay_opacity,
    };
  }
  return {
    pattern: employee.ui_pattern ?? orgDefault.pattern,
    bar1: employee.ui_menu_bar1_image_key ?? orgDefault.menu_bar1_image_key,
    bar2: employee.ui_menu_bar2_image_key ?? orgDefault.menu_bar2_image_key,
    wide: employee.ui_menu_bar_wide_image_key ?? orgDefault.menu_bar_wide_image_key,
    overlay: employee.ui_overlay_opacity ?? orgDefault.overlay_opacity,
  };
}
```

---

## 4. Storage 設計（`ui-personalization` bucket）

### 4.1 bucket 作成

```sql
-- Supabase SQL migration
INSERT INTO storage.buckets (id, name, public)
VALUES ('ui-personalization', 'ui-personalization', false)
ON CONFLICT (id) DO NOTHING;
```

### 4.2 path prefix（個人/組織分離）

```
ui-personalization/
├── org/                        ← admin のみ書込可
│   ├── default/                ← Garden デフォルト（読み取り専用）
│   │   ├── bonsai-a.jpg
│   │   ├── bonsai-b.jpg
│   │   └── bonsai-c.jpg
│   └── custom/                 ← admin カスタム
│       ├── 2026-spring-a.jpg
│       └── ...
└── personal/
    ├── {employee_id}/          ← 本人のみ書込可
    │   ├── pattern-a.jpg
    │   ├── pattern-b.jpg
    │   └── pattern-c.jpg
    └── ...
```

### 4.3 RLS ポリシー

```sql
-- 個人 personal/{自分} に限り書き込み可
CREATE POLICY ui_personal_insert_self ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ui-personalization'
    AND (storage.foldername(name))[1] = 'personal'
    AND (storage.foldername(name))[2] = auth_employee_number()
  );

CREATE POLICY ui_personal_update_self ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'ui-personalization'
    AND (storage.foldername(name))[1] = 'personal'
    AND (storage.foldername(name))[2] = auth_employee_number()
  );

-- 読み取りは自分 + 組織既定
CREATE POLICY ui_read_self_or_org ON storage.objects FOR SELECT
  USING (
    bucket_id = 'ui-personalization'
    AND (
      (storage.foldername(name))[1] = 'org'
      OR ((storage.foldername(name))[1] = 'personal' AND (storage.foldername(name))[2] = auth_employee_number())
    )
  );

-- 組織 org/* は admin+ のみ書き込み可
CREATE POLICY ui_org_insert_admin ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ui-personalization'
    AND (storage.foldername(name))[1] = 'org'
    AND has_role_at_least('admin')
  );
```

### 4.4 署名 URL / 直接 URL

- 各モジュールから画像表示する際は **都度 `createSignedUrl(key, 3600)`** で取得
- 直接 URL は発行しない（Leaf Phase C パターン踏襲）
- 有効期限 1 時間、画面内でキャッシュ

---

## 5. 画像アップロード処理（client-side）

### 5.1 入力フォーマット

| フォーマット | 扱い |
|---|---|
| .jpg / .jpeg | そのまま受入、軽量化のみ実施 |
| .png | Canvas で jpg 変換 + 圧縮 |
| .webp | Canvas で jpg 変換 |
| .heic | **.heic は Canvas デコード不可** → `heic2any` ライブラリで jpg 変換 |
| .bmp / .tiff | 未対応（エラー表示）|

### 5.2 Canvas 圧縮パイプライン（Leaf C-03 踏襲）

```ts
// src/components/shared/_lib/compressImage.ts
export async function compressToJpg(file: File, maxSize: { w: number; h: number }): Promise<Blob> {
  const img = await loadImage(file);  // heic は heic2any で事前変換
  const canvas = document.createElement('canvas');
  const ratio = Math.min(maxSize.w / img.width, maxSize.h / img.height, 1);
  canvas.width = img.width * ratio;
  canvas.height = img.height * ratio;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob!),
      'image/jpeg',
      0.85  // quality
    );
  });
}
```

### 5.3 パターン別サイズ上限

| パターン | 最大サイズ | 結果ファイル目安 |
|---|---|---|
| A（①だけ） | 400×800px | 50-150 KB |
| B（②だけ） | 400×800px | 50-150 KB |
| C（①+②幅） | 800×800px | 100-300 KB |

### 5.4 アップロード UX

```
┌──────────────────────────────────┐
│ パターン: ○A ○B ●C                 │
│                                  │
│ [画像を選択] or ドラッグ & ドロップ  │
│                                  │
│ ┌─ プレビュー ─────────────────┐    │
│ │                              │    │
│ │  （選んだ画像をプレビュー）     │    │
│ │                              │    │
│ │ Overlay: ▓▓▓▓▓▓░░ 30%          │    │
│ └──────────────────────────────┘    │
│                                  │
│ ✅ メニューバーでの見え方           │
│ ┌─ Preview ─────────────────┐     │
│ │ [①][②] ← 実寸プレビュー     │     │
│ └───────────────────────────┘     │
│                                  │
│ [保存]  [キャンセル]              │
└──────────────────────────────────┘
```

- パターン変更でプレビューも切替
- Overlay スライダーで可読性調整（0-50%）
- 保存時に `compressToJpg` → `uploadToStorage` → `root_employees` UPDATE

---

## 6. Root マイページ設定画面

### 6.1 画面構成（`/root/my-page`）

```
┌─────────────────────────────────┐
│ マイページ                       │
├─────────────────────────────────┤
│ 個人情報                         │
│   氏名: 山田太郎                 │
│   部署: コールセンター            │
│   役職: closer                  │
│   [パスワード変更]               │
│                                  │
│ 画面のカスタマイズ                │
│   メニューバー画像               │
│     [現在: ●パターン C]          │
│     [変更する]                   │
│   ダーク/ライトモード             │
│     ○ システム ○ ライト ●ダーク    │
│   扉くぐりアニメーション          │
│     ●有効 ○無効                  │
│   画像の上のフィルター            │
│     ▓▓▓▓▓▓░░ 30%                 │
│                                  │
│ [保存]                           │
└─────────────────────────────────┘
```

### 6.2 ホーム画面のクイック設定

ホーム画面右上に「⚙️」アイコン、クリックで**ミニ設定パネル**表示：

```
┌────────────────────────────┐
│  背景画像を変える            │
│  [A][B][C]                 │
│                            │
│  ダーク / ライト             │
│  [ライト][ダーク]            │
│                            │
│  [詳細設定 → マイページ]     │
└────────────────────────────┘
```

### 6.3 組織管理者画面（admin+ のみ）

`/root/admin/ui-settings` 新設：

```
┌─────────────────────────────────┐
│ 組織既定 UI 設定                 │
├─────────────────────────────────┤
│ 既定パターン: ○A ●B ○C           │
│                                  │
│ ①画像（400x800）                 │
│   [現在: bonsai-b.jpg]           │
│   [変更]                         │
│                                  │
│ ②画像（400x800）                 │
│   [現在: bonsai-b.jpg]           │
│   [変更]                         │
│                                  │
│ ワイド画像（800x800）             │
│   [現在: bonsai-wide.jpg]        │
│   [変更]                         │
│                                  │
│ □ 個人上書きを許可する            │
│                                  │
│ [保存]                           │
└─────────────────────────────────┘
```

---

## 7. 半透明オーバーレイ（可読性ガード）

### 7.1 目的

ユーザーアップロード画像がカラフルすぎて、メニューアイコン（白）や文字が読みにくくなるのを防ぐ。

### 7.2 適用方法

```tsx
<div
  className="menu-bar"
  style={{
    backgroundImage: `url(${imageSignedUrl})`,
    backgroundSize: 'cover',
  }}
>
  <div
    className="overlay"
    style={{
      backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})`,
      position: 'absolute',
      inset: 0,
    }}
  />
  <nav style={{ position: 'relative' }}>
    {/* アイコン */}
  </nav>
</div>
```

### 7.3 オーバーレイ値

| 場面 | 推奨値 |
|---|---|
| ライトモード時 | 0.15 〜 0.30（画像明度に応じて）|
| ダークモード時 | 0.30 〜 0.45（暗め）|
| カスタム画像（初期値） | 0.30 |
| ユーザー調整可 | 0.00 〜 0.50（0.05 刻み）|

### 7.4 自動補正

- アップロード時に画像の平均明度を計算（Canvas で pixel サンプリング）
- 明度 > 200（明るい）: overlay 推奨 0.40
- 明度 100-200: overlay 推奨 0.30
- 明度 < 100（暗い）: overlay 推奨 0.15

---

## 8. Root モジュールへの集約

### 8.1 理由

- 従業員マスタと画像設定が同じ `root_employees` を触る
- UI 設定 = マスタ管理の延長線にある
- admin 権限管理も Root 側

### 8.2 API 配置

```
src/app/root/
├── my-page/
│   └── page.tsx           ← 個人設定画面
├── admin/
│   └── ui-settings/
│       └── page.tsx       ← 組織既定設定
├── _lib/
│   ├── ui-settings.ts     ← resolveUserUI, updateUISettings
│   └── image-compress.ts  ← Canvas 圧縮（再利用可能に）
└── _actions/
    └── uploadUIImage.ts   ← Server Action
```

### 8.3 共通化

`src/app/root/_lib/image-compress.ts` を `src/components/shared/_lib/compressImage.ts` に移動し、他モジュール（Leaf, Bud 等）も使えるようにする。

---

## 9. 実装ステップ

1. **Step 1**: DB migration（`root_org_ui_defaults` 新設、`root_employees` 列追加）（1h）
2. **Step 2**: `ui-personalization` bucket + RLS ポリシー（0.5h）
3. **Step 3**: 共通 `compressImage.ts` + `heic2any` 導入検討（1h）
4. **Step 4**: Root マイページ UI（設定画面）（2h）
5. **Step 5**: admin 画面（組織既定設定）（1.5h）
6. **Step 6**: メニューバー側の画像表示ロジック（MenuBar1/2 から resolveUserUI）（1h）
7. **Step 7**: ホーム画面クイック設定（1h）
8. **Step 8**: 結合テスト・バグ修正（0.5h）

**合計**: 約 **0.7d**（約 8.5h）

---

## 10. セキュリティ

### 10.1 アップロードサイズ制限

- クライアント: 10 MB（圧縮前）
- サーバー: Supabase Storage bucket の policy で 5 MB 上限
- ファイルタイプ: `image/jpeg` / `image/png` / `image/webp` / `image/heic` 以外拒否

### 10.2 ファイル名サニタイズ

- ユーザー入力のファイル名は使わず、`{timestamp}-{random}.jpg` で上書き保存
- 例: `personal/0123/pattern-a-20260425103000-abc123.jpg`

### 10.3 画像内容の検査

- **Phase 1 はスキップ**（社内システム、信頼ベース）
- Phase 2 以降、不適切画像検知 API 検討（§判断保留）

---

## 11. 他 spec との接続点

| 関連 spec | 接続 |
|---|---|
| UI-01 layout-theme | CSS variables でダーク時 overlay 強化 |
| UI-02 menu-bars | MenuBar1/2 が resolveUserUI で画像を取得・適用 |
| UI-04 time-theme | カスタム画像が時間帯テーマより優先 |
| Leaf C-03 | 画像 Canvas 圧縮パターン踏襲 |
| spec-cross-storage | bucket / RLS パターン踏襲 |

---

## 12. テスト観点

- 3 パターン A/B/C のレイアウト
- heic → jpg 変換（iPhone 撮影画像）
- 大容量画像（10 MB）の client-side 圧縮
- RLS: 他人の personal/{id}/ にアップロードできないこと
- admin のみ org/* に書き込めること
- overlay_opacity の境界（0 / 0.5）
- 組織既定のみ使用時（個人未設定）の表示
- 個人上書き許可 OFF 時の UI（個人設定が読み取り専用になる）

---

## 13. 判断保留事項

- **判1: heic 変換ライブラリ**
  - `heic2any`（bundle size +300KB）/ サーバーサイド変換
  - **推定スタンス**: `heic2any` 採用（iPhone ユーザーが多数）、必要時ロード
- **判2: 画像内容の検知**
  - 社内のみ運用、不適切画像対策をどこまでやるか
  - **推定スタンス**: Phase 1 はスキップ、Phase 2 で Cloud Vision Moderation 検討
- **判3: 画像の有効期限**
  - 退職者の画像を自動削除するか
  - **推定スタンス**: `root_employees.deleted_at` 設定時にバッチ削除（日次 Cron）
- **判4: Overlay 調整の段階数**
  - 連続 / 11 段階（0, 5, 10, ... 50）/ 5 段階
  - **推定スタンス**: 11 段階（0, 5, 10, ..., 50%、5% 刻み）
- **判5: パターン A/B/C 切替時のアニメーション**
  - 瞬間切替 / フェード 300ms / スライド
  - **推定スタンス**: フェード 300ms（違和感少）
- **判6: デフォルト画像（bonsai 3 種）の調達**
  - Garden 用にイラスト制作 / フリー素材 / AI 生成
  - **推定スタンス**: AI 生成 or 外注、東海林さん最終判断
- **判7: 組織既定と個人上書きの競合時の挙動**
  - 例: admin が既定を変更 → 個人の既存画像はどうなる
  - **推定スタンス**: 既存個人画像は残る、新規ユーザーのみ新既定が適用

---

## 14. 実装見込み時間の内訳

| 作業 | 見込 |
|---|---|
| DB migration + Storage bucket / RLS | 1.5h |
| Image compression 共通化 + heic 対応 | 1.0h |
| Root マイページ（個人設定）| 2.0h |
| Root admin 画面（組織既定）| 1.5h |
| MenuBar1/2 への画像適用ロジック | 1.0h |
| ホーム画面クイック設定 | 1.0h |
| 結合テスト | 0.5h |
| **合計** | **0.7d**（約 8.5h）|

---

— spec-cross-ui-03 end —
