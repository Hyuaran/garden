# Garden-Tree Phase B-β 仕様書：誕生日同期 / 擬似メール変換 / bare screen

- 起草日: 2026-04-24
- 起草セッション: a-tree（東海林A）
- 対象モジュール: Garden-Tree
- 対象 Phase: **Phase B-β**（初回ログイン誕生日入力 + Auth パスワード MMDD 同期）
- 関連コミット:
  - `a2e925c` feat(tree): Phase B-β 初回ログイン時の誕生日入力画面を追加
  - `9be77d5` feat(tree): Phase B 後半 誕生日登録時に Auth パスワードも MMDD に自動更新
- 位置付け: **既存コードに対する後追い設計文書**（実装は 2026-04-22〜2026-04-23 に完了済）

---

## 1. 目的・背景

### 1.1 目的
Phase B-β で導入された 3 つの仕様（誕生日同期／擬似メール変換／bare screen）について、**実装のみに存在していた暗黙仕様を明文化**し、以下を確立する：

- 認証ポリシー（親CLAUDE.md §4）との対応関係
- 将来の改修・障害対応時の判断基準
- 新規参画メンバーが仕組みを追える状態

### 1.2 背景
Tree は「コールセンターの要」モジュール（§18 最慎重扱い）である一方、認証基盤は Forest とも共有する**全モジュール共通の骨格**。現状 `src/app/tree/_lib/` 以下のコード注釈のみに仕様が散在しており、長期運用・モジュール単体販売（親CLAUDE.md §8 つぎはぎ設計方針）の両面で設計文書化が必須。

### 1.3 参照ドキュメント
- 親CLAUDE.md §4（認証ポリシー）
- 親CLAUDE.md §8（つぎはぎ設計方針）
- MEMORY.md `project_garden_auth_policy`
- MEMORY.md `project_garden_account_flow`
- `docs/tree-review-suggestions-20260424.md`（a-auto 2026-04-24 09:30 生成レビュー）

---

## 2. 誕生日同期（birthday-password sync）

### 2.1 概要
初回ログインユーザーが誕生日を入力した時、**同じ入力値から生成した MMDD 4桁を Supabase Auth のパスワードに自動反映**する。これにより次回以降のログインは「社員番号 + 誕生日 MMDD」という認証ポリシー通りの形になる。

### 2.2 フロー

```
[/tree/login]
  社員番号 + 初期パスワード でログイン
      ↓
  Supabase Auth 認証成功
      ↓
[TreeAuthGate]
  treeUser.birthday === null を検出
      ↓
  /tree/birthday へ自動遷移
      ↓
[/tree/birthday]
  ① 誕生日 (YYYY-MM-DD) 入力
  ② updateBirthday(userId, birthday)
     → anon クライアントから root_employees.birthday を UPDATE（RLS: 本人行）
  ③ updatePasswordFromBirthday(birthday)
     → fetch POST /api/tree/update-password
        Authorization: Bearer {access_token}
        Body: { birthday: "YYYY-MM-DD" }
     → サーバー側で access_token 検証 → userId 特定
     → MMDD 抽出
     → admin.updateUserById(userId, { password: MMDD })
  ④ refreshAuth() で TreeStateContext の treeUser を再取得
  ⑤ /tree/dashboard へ遷移
```

### 2.3 データモデル

| 項目 | 格納先 | 型 | 備考 |
|---|---|---|---|
| 誕生日（生年月日） | `root_employees.birthday` | `date` | YYYY-MM-DD、null 許容 |
| パスワードハッシュ | `auth.users.encrypted_password` | bcrypt | 生文字列は保存しない |
| 社員番号 | `root_employees.employee_number` | `text` | 4 桁ゼロ詰め（内部は任意桁） |

### 2.4 セキュリティ設計

| 観点 | 対策 |
|---|---|
| **他人のパスワード書換え防止** | 更新対象 userId は**必ず `Authorization: Bearer` で渡された access_token を検証して取得**。body からは受け付けない。これにより自分のトークンで自分の userId 以外は更新できない。 |
| **service_role_key の露出防止** | API route (`src/app/api/tree/update-password/route.ts`) 内でのみ読み出し。`NEXT_PUBLIC_` 接頭辞なしで `.env.local` / Vercel 環境変数に格納。クライアント JS にはバンドルされない。 |
| **形式検証** | `^\d{4}-\d{2}-\d{2}$` 正規表現でサーバー側でも二重検証 |
| **RLS 整合** | `root_employees.birthday` 更新は anon キー経由 → `root_employees_update_own`（もしくは `*_own` 系 RLS）で本人行のみ書換可 |

### 2.5 失敗時ハンドリング（現行動作）

| フェーズ | 失敗時の挙動 | 現状の課題 |
|---|---|---|
| ② `updateBirthday` 失敗 | エラー表示、再入力可能（`setSaving(false)`） | 問題なし |
| ③ `updatePasswordFromBirthday` 失敗 | 「誕生日は保存されましたが、パスワードの更新に失敗しました」エラー表示、`setSaving(false)` | **🔴 復旧経路が未実装**。ページリロードすると `treeUser.birthday !== null` のため `TreeAuthGate` が `/tree/birthday` へ戻さず、パスだけ未同期状態でダッシュボードに到達する。次回ログイン時に初期パスで通らない／MMDD で通らない両方の可能性。 |
| ④ `refreshAuth` 失敗 | エラー表示 | 軽微（再ログインで復旧） |

**🔴 対策案（次フェーズで検討）**：
- 案A: ③ 単独のリトライボタンを表示（`updatePasswordFromBirthday` だけ再実行）
- 案B: ②失敗時は ③ 実行前に停止、③失敗時は ② の birthday を巻き戻し（楽観的UI の撤回）
- 案C: API route を「`birthday` の UPDATE と Auth パス更新を一体のトランザクションとして扱う」設計に一本化（②③統合）

※ 本仕様書では判断せず、次フェーズ spec で確定させる。

### 2.6 運用：パスワード忘れ時の管理者再発行

親CLAUDE.md §4 の規定：

1. 管理者が Supabase Dashboard → Authentication → Users → 該当ユーザー → Update password
2. 新パスワードを本人に伝達
3. 本人がログイン後、自分で再変更（セルフサービス）

Phase B-β においても Tree 側UIでの「パス忘れ」再発行機能は**実装しない**。将来的には Root 側（`garden_role = manager` 以上）で再発行UIを提供する設計だが、本仕様書の範囲外。

### 2.7 Vercel 本番環境の設定必須事項

- 環境変数 `SUPABASE_SERVICE_ROLE_KEY`（`NEXT_PUBLIC_` 接頭辞**なし**）が設定済みであること
- 未設定の場合、`/api/tree/update-password` は HTTP 500（`server misconfigured`）を返し、誕生日入力画面で「パスワードの更新に失敗しました」エラーが出続ける

---

## 3. 擬似メール変換

### 3.1 概要
Supabase Auth はメール + パスワード認証が前提だが、Garden では**社員番号 + パスワード**のログインUXを全モジュール統一する（親CLAUDE.md §4）。このギャップを埋めるため、社員番号を内部で擬似メールアドレスに変換して Supabase Auth に投入する。

### 3.2 フォーマット仕様

```
emp{4桁ゼロ詰めの社員番号}@garden.internal
```

例：
| 入力（画面） | 擬似メール |
|---|---|
| `8` | `emp0008@garden.internal` |
| `0008` | `emp0008@garden.internal` |
| `1324` | `emp1324@garden.internal` |
| `0000` | `emp0000@garden.internal`（社長予約） |

### 3.3 変換関数

- 実装: `src/app/tree/_lib/auth.ts` の `toSyntheticEmail(empId: string): string`
- 仕様:
  1. `empId` から非数字を除去（`/\D/g`）
  2. 左 0 埋めで 4 桁化（`padStart(4, "0")`）
  3. `emp{digits}@garden.internal` に整形

```ts
export function toSyntheticEmail(empId: string): string {
  const digits = empId.replace(/\D/g, "").padStart(4, "0");
  return `emp${digits}@garden.internal`;
}
```

### 3.4 衝突回避規則

| ルール | 根拠 |
|---|---|
| 社員番号は KING OF TIME の採番を正とする | 親CLAUDE.md §4 |
| 社員番号 = 一意 → 擬似メール = 一意 | 4桁ゼロ詰めで衝突しない前提 |
| 予約番号：`0000` 社長 / `0008` 東海林 | 親CLAUDE.md §4 |
| 5桁以上の社員番号は現時点では想定外 | KoT 運用上 4桁で足りる。将来 5桁化する場合は擬似メールフォーマットと本仕様書を同時改訂 |

### 3.5 ドメイン `garden.internal`

- 実在しないトップレベルドメイン
- Supabase Auth 内部の一意キーとして機能するだけで、メール送信に使わない
- ドメイン変更の影響範囲: `toSyntheticEmail` 1 箇所のみ。変更時は既存 `auth.users.email` も一括マイグレーション必須

### 3.6 非表示化方針

- ユーザーには**社員番号のみ露出**する
- 擬似メールはログ・エラーメッセージ・画面上に**出さない**（セキュリティの観点より、命名規則を推測されると総当たりログインを試行されやすくなる）
- Supabase Auth Users 画面では擬似メールが見えるが、閲覧権限は全権管理者のみ

---

## 4. bare screen

### 4.1 定義
**サイドバー（SidebarNav）および KPI ヘッダー（KPIHeader）を非表示にし、画面全体を占有表示する画面群**。

目的：
- ログイン前後・初期設定画面など、Tree 本体のナビゲーションが意味をなさない画面でチロメを最小化
- 画面集中度を上げ、初見ユーザーの迷子を防ぐ

### 4.2 現行対象（2026-04-24 時点）

| パス | TREE_PATHS キー | 用途 | bare 化の理由 |
|---|---|---|---|
| `/tree/login` | `LOGIN` | ログイン画面 | 未認証状態ではサイドバー項目が機能しない |
| `/tree/birthday` | `BIRTHDAY` | 初回ログイン誕生日入力 | 認証済だがプロファイル未完成、本体機能には進ませない |

### 4.3 判定ロジック

実装箇所: `src/app/tree/_components/TreeShell.tsx`

```ts
const pathname = usePathname() || "";
const isBareScreen =
  pathname === TREE_PATHS.LOGIN || pathname === TREE_PATHS.BIRTHDAY;

if (isBareScreen) {
  return <>{children}</>;
}

// それ以外は SidebarNav + KPIHeader + main コンテナで包む
```

**特性**：
- `pathname` の**完全一致**で判定（子パスは含まない）
- サーバーコンポーネント不可（`usePathname` は client-only）
- 判定が増えるほど if 条件が肥大化する問題あり（§4.4 で対処）

### 4.4 bare screen 追加時のルール

新しい bare screen ページを追加する際の手順：

1. `src/app/tree/_constants/screens.ts` の `TREE_PATHS` に新パス定数を追加
2. 該当パスの `page.tsx` を作成
3. `TreeShell.tsx` の `isBareScreen` 条件に `|| pathname === TREE_PATHS.XXX` を追加
4. 本仕様書 §4.2 の表に行追加
5. 必要なら `TreeAuthGate.tsx` 側でも特別扱いを追加（例：未認証でも見せる・認証必須だがゲート条件を緩める等）

**将来的なリファクタ案**（実装は行わない、参考として記載）：
- `TREE_PATHS` 定義に `bare: true` フラグを持たせ、`TreeShell.tsx` 側は「フラグ付きパスなら bare」と判定する仕組みに変更すると、判定ロジックが肥大化しない

---

## 5. 未決事項・仮スタンス

本仕様書では以下を仮スタンスとして明示し、a-main からの正式判断待ちとする。

| # | 未決項目 | 仮スタンス | 決定権者 |
|---|---|---|---|
| 1 | マイページ（`/tree/mypage`）からの誕生日変更時、パスも同期更新するか | **同期しない**（現状維持）。マイページ編集経路は未実装のため、実装時に再判断。 | 東海林さん（a-main） |
| 2 | 「パスワードを忘れた」時の Root 側再発行UI の範囲 | **Root モジュール側で対応**（別セッション a-root の範疇）。Tree 側は Supabase Dashboard 運用を継続。 | 東海林さん（a-main） |
| 3 | 誕生日同期の部分成功復帰フロー（§2.5 🔴） | **次フェーズ spec で確定**。現状は「部分成功時はエラー表示のみ、復旧経路なし」の既知課題として本仕様書に明記。 | 東海林さん（a-main） |
| 4 | 5桁以上の社員番号の扱い | **想定外**。発生時は擬似メールフォーマット改訂を伴う全社展開相当の対応として別途検討。 | 東海林さん（a-main） |

---

## 6. 変更履歴

| 日付 | 版 | 改訂内容 | 担当セッション |
|---|---|---|---|
| 2026-04-24 | 1.0（初版） | 起草。Phase B-β（`a2e925c` + `9be77d5`）の後追い設計文書として3仕様を整理。§2.5 と §5 に🔴2 件の未決事項を明記。 | a-tree |

---

## 付録A: 関連ファイル一覧

### コード
- `src/app/api/tree/update-password/route.ts` — 誕生日同期の API route
- `src/app/tree/_lib/queries.ts` — `updateBirthday` / `updatePasswordFromBirthday`
- `src/app/tree/_lib/auth.ts` — `toSyntheticEmail` / `signInTree`
- `src/app/tree/_lib/supabase.ts` — クライアント（anon キー）
- `src/app/tree/birthday/page.tsx` — 誕生日入力 UI
- `src/app/tree/login/page.tsx` — ログイン UI
- `src/app/tree/_components/TreeShell.tsx` — bare screen 判定
- `src/app/tree/_components/TreeAuthGate.tsx` — 誕生日 null ガード
- `src/app/tree/_constants/screens.ts` — TREE_PATHS 定義

### ドキュメント
- 親CLAUDE.md §4 認証ポリシー
- 親CLAUDE.md §8 つぎはぎ設計方針
- `docs/handoff-20260422.md` / `docs/handoff-20260423.md`
- `docs/tree-review-suggestions-20260424.md`（a-auto レビュー提案）
- `docs/effort-tracking.md`

### 環境変数
- `.env.local` / Vercel
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`（`NEXT_PUBLIC_` 接頭辞なし、サーバー専用）

— end of spec —
