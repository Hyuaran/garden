# a-bloom-002 dispatch v7 - 6 atmospheres カルーセル復活 + ログイン改修 + 離席/休憩中央化 - 2026-04-27

> 起草: a-main-009
> 用途: dispatch v6 完走後の追加要件 3 件（6 atmospheres / ログイン / 離席）
> 前提: dispatch v6 全 7 commits 完走済（最新 SHA `3f8841a`）+ 画像 12 ファイル配置済（`_shared/` + `public/images/`）

## 投下短文（東海林さんが a-bloom-002 にコピペ）

【a-main-009 から a-bloom-002 へ】dispatch v7 - 6 atmospheres + ログイン + 離席/休憩

▼ 経緯
- dispatch v6 完走確認 ✅（東海林さんありがとう報告）
- 東海林さんから追加 3 改修受領
- 画像 12 ファイル a-main-009 経由で配置済（`public/images/atmospheres/01-06.png` + `garden-home-bg-v2.png` + 参考画像群）
- 5/5 後道さんデモ用最終調整、合計工数 0.8d 見込み

▼ 詳細 spec ファイル

`docs/bloom-002-dispatch-v7-login-status-atmospheres-20260427.md` を参照（このファイル）。下部 「## 詳細 spec」 セクション読込。

▼ 大改修 3 ポイント概要

1. **Group A**: 6 atmospheres カルーセル復活 + 拡張子整合（.webp 参照を .png に統一、BackgroundCarousel.tsx の @deprecated 解除）
2. **Group B**: ログイン画面改修（入力枠を「社員番号またはID」+「パスワード」に変更、BG は 6 atmospheres カルーセル、左側ログイン枠維持）
3. **Group C**: 離席中改修（文字を中央配置、休憩中と同じレイアウト + ChatGPT 参考画像反映）

▼ 配置済 画像（即使用可）

| パス | 内容 |
|---|---|
| `public/images/atmospheres/01.png` 〜 `06.png` | 6 atmospheres（東海林さん指定の本物 v2） |
| `public/images/garden-home-bg-v2.png` | atmosphere-01 を仮 v2 BG |
| `public/images/garden-series-logo-v2.png`（要 webp 変換 or 既存維持）| Garden Series ロゴ更新版（任意採用）|
| `_shared/.../login-references/login-main-ref.png` + `login-position-ref.png` | ログイン参考画像 2 枚 |
| `_shared/.../status-screens/away-ref.png` + `break-ref.png` | 離席/休憩参考画像 2 枚 |

▼ 期待アウトプット

- branch: feature/garden-common-ui-and-shoji-status（既存継続）
- commit 群: V7-A / V7-B / V7-C 各 push 単位
- 各 step 完了で a-main-009 に SHA 共有 + Vercel preview URL

▼ 完了基準

- [ ] V7-A: 6 atmospheres カルーセル動作確認（←→/SPACE/1〜6/A）
- [ ] V7-B: ログイン画面で「社員番号またはID」入力可能、6 atmospheres BG 動作
- [ ] V7-C: 離席中が中央レイアウト、参考画像の世界観反映
- [ ] 全テスト pass + TS / ESLint clean

---

## 詳細 spec

### Group A: 6 atmospheres カルーセル復活 + 拡張子整合（0.3d）

**目的**: dispatch v6 で固定背景 1 枚化したが、東海林さん要望は 6 atmospheres カルーセル（candidate 6 v3 設計復活）。

**変更ファイル**:

1. `src/app/_components/BackgroundCarousel.tsx` の `@deprecated` JSDoc 削除、再活用
2. `src/app/page.tsx` の background 部分を `<BackgroundCarousel atmospheres={ATMOSPHERES_V2} />` に置換
3. atmospheres list 更新（`src/app/_lib/atmospheres.ts` or `_constants/atmospheres.ts`）:
   ```
   export const ATMOSPHERES_V2 = [
     { id: 1, src: '/images/atmospheres/01.png', label: 'Vivid Canopy（鮮やかな樹冠）' },
     { id: 2, src: '/images/atmospheres/02.png', label: 'Aqua Stream（水流のテラリウム）' },
     { id: 3, src: '/images/atmospheres/03.png', label: 'Digital Sanctuary（デジタル神聖樹）' },
     { id: 4, src: '/images/atmospheres/04.png', label: 'Crystal Clear（結晶ガラス）' },
     { id: 5, src: '/images/atmospheres/05.png', label: 'Golden Light（光降る朝）' },
     { id: 6, src: '/images/atmospheres/06.png', label: 'Watercolor Serene（静謐水彩）' },
   ];
   ```
4. キーボード操作（既存 candidate 6 v3 ロジック維持）:
   - `←` `→` `Space`: 前後移動
   - `1` 〜 `6`: 直接ジャンプ
   - `A`: auto play toggle（prefers-reduced-motion 配慮で既定 OFF）
   - 背景クリック: 次の atmosphere（candidate 8 で実装済の onClick 維持）
   - `Ctrl+Shift+B`: Easter egg（任意）
5. INPUT/TEXTAREA/SELECT/contenteditable 内では発火しない（fix 4de990f 維持）

**拡張子整合**:
- `garden-home-bg-v2.webp` 参照箇所 → `.png` に修正（私が配置したのは PNG）
- 後日 webp 変換は別 dispatch（5/5 後 post-デモ）

### Group B: ログイン画面改修（0.3d）

**目的**: ログイン画面を 6 atmospheres BG + パートナー配慮の入力枠に変更。

**ChatGPT 参考画像**:
- `_shared/attachments/20260427/ai-images/login-references/login-main-ref.png`（メイン参考）
- `_shared/attachments/20260427/ai-images/login-references/login-position-ref.png`（枠位置参考）

**変更ファイル**: `src/app/login/page.tsx`

**改修ポイント**:

1. **背景**: 6 atmospheres カルーセル（home と同じ `<BackgroundCarousel atmospheres={ATMOSPHERES_V2} />`）
2. **ログイン枠**: 左側固定（既存維持）、半透明白カード `bg-white/85 backdrop-blur-md rounded-2xl shadow-lg max-w-md p-8`
3. **入力枠 1**: 
   - label: 「社員番号またはID」
   - placeholder: 「例) E-12345 または P-001」
   - microcopy（任意）: 「ID とはパートナーコードのことです」（小さい説明文 or tooltip）
   - input type: text
4. **入力枠 2**:
   - label: 「パスワード」（変更なし）
   - placeholder: 「●●●●●●●●●●●●●」
   - input type: password、目アイコンで表示切替
5. **チェックボックス**: 「ログイン状態を保持」（既存維持）
6. **ボタン**: 「ログイン」（既存維持、緑系グラデ）
7. **下部**: 「パスワードをお忘れですか？」（既存維持）+ 「Secure workspace for finance, operations, and customer support.」microcopy
8. **header**: Garden Series logo + 業務を、育てる。/ Grow Your Business.（既存維持）+ 右上にヘルプ / 言語切替 / ライト/ダーク

**API 連携（既存維持）**:
- 既存の auth-redirect ロジック（candidate 8 実装済）流用
- 入力名が email → ID に変わるので、type/name 属性も変更:
  - `<input type="text" name="employeeIdOrPartnerCode">` （旧: `name="email"`）
- バックエンド側は post-5/5 で社員番号またはパートナーコード受付に変更（5/5 まではログインモック動作で OK、ID = email として扱う暫定回避もあり）

**社員番号 vs パートナーコード判定**:
- 入力値が `E-` で始まる → 社員番号（root_employees 検索）
- 入力値が `P-` で始まる → パートナーコード（root_partners 検索）
- それ以外は両方検索 or エラー
- 5/5 までは判定ロジックのみ実装、実 DB 連携は post-5/5

### Group C: 離席中改修（0.2d）

**目的**: 離席中画面の文字を中央配置に変更（休憩中と同じレイアウト）+ ChatGPT 参考画像の世界観反映。

**ChatGPT 参考画像**:
- `_shared/attachments/20260427/ai-images/status-screens/away-ref.png`（離席中、Green Screen + 中央レイアウト）
- `_shared/attachments/20260427/ai-images/status-screens/break-ref.png`（休憩中、Take a gentle break + 中央レイアウト）

**変更ファイル**: `src/app/tree/away/*` または `src/app/away/*`（既存実装の場所を確認）

**現状**: 既存実装は文字が左寄り（東海林さんから「中央修正必要」のフィードバック、memory `project_godo_ux_adoption_gate.md` 参考）

**改修ポイント**:

1. **レイアウト**: flex column 中央配置（休憩中と同じ）
   - 上部: ステータスアイコン（Green Screen ロゴ風、円形ガラス + 葉モチーフ）
   - 中央: 「離席中」（大文字、`text-6xl font-bold tracking-widest`）
   - 中央下: 「Green Screen」label
   - 説明文: 「ただいま席を外しています。しばらくお待ちください。」「業務は Garden Series が静かに見守っています。」（中央揃え）
   - ステータスバッジ: 「ステータス：一時離席」（緑系、丸 pill）
   - 更新時刻表示: 「更新時刻 10:42」
   - 戻るボタン: 「ホームへ戻る」（中央配置、緑系 outline）

2. **背景**: 緑系グラデ + 光の粒子（参考画像準拠）、霧的なテクスチャ

3. **休憩中画面**（`src/app/tree/break/*`）も合わせて参考画像準拠に磨き込み:
   - 上部: お茶イラスト（Take a gentle break）
   - 中央: 「休憩中」大文字
   - 説明文 + ステータス：休憩 + 再開予定 13:30 + ホームへ戻る
   - 背景: 暖色系（朝の優しい光）

**注意**:
- 既存の場所（`src/app/tree/away/*` or 別 location）を Glob で確認してから着手
- candidate 6 / 7 / 8 の他コンポーネントとの整合（AppHeader 含むか含まないか等）

### 実装順序提案

| 順 | Group | 工数 | 理由 |
|---|---|---|---|
| 1 | Group A | 0.3d | dispatch v6 既存 BG が破綻、最優先で復活 |
| 2 | Group B | 0.3d | 5/5 デモで使用される（ログイン → home flow）|
| 3 | Group C | 0.2d | 離席/休憩は 5/5 デモで使う可能性低（後道さん見せる優先度低）|

合計 **0.8d**、5/5 デモまで余裕あり。

### 実装上の注意

- 既存テスト 727+ 全 pass 維持
- 新規追加: BackgroundCarousel 復活テスト + login page input name 変更テスト + away/break 中央レイアウトテスト
- 8-role 連動（known-pitfalls #6）すべてのコンポーネントで維持
- TypeScript / ESLint 0 errors
- commit メッセージ: `feat(home): dispatch v7 group X - <内容>` 形式
- push 単位: 各 group 完了で push、Vercel preview で東海林さん確認

### 完了報告先

各 group 完了で a-main-009 に SHA + Vercel preview URL 共有。最終 group 完了で「dispatch v7 完走、5/5 デモ準備最終調整完了」報告。

## 改訂履歴

- 2026-04-27 初版（a-main-009、dispatch v6 完走後の追加 3 改修要件、画像配置済前提）
