# Garden-Tree Phase B-β B 経路：マイページ誕生日変更モーダル 実装仕様

- 起草日: 2026-04-25
- 起草セッション: a-tree（東海林A）
- 対象モジュール: Garden-Tree
- 対象画面: `/tree/mypage`
- 関連仕様書: `docs/specs/2026-04-24-tree-phase-b-beta-birthday-password.md`（親仕様）§2.1 B 経路・§2.2.2・§2.5.2・§2.5.3
- 位置付け: **実装 spec**（親仕様書で未決とされた B 経路の動作・API・UI・テストを確定させる）
- 見込み時間: **0.5d（UI 0.2d / API 0.2d / test 0.1d）**

---

## §1. 目的

### 1.1 本 spec が解決する問題

親仕様書 §2.1 で確定した「**マイページから誕生日を変更した時、Auth パスワードも新しい MMDD へ同期する**」方針を**実装可能な粒度まで詳細化**する。

### 1.2 確定方針（親仕様書 §5.1 より）

| # | 項目 | 確定内容 |
|---|---|---|
| 1 | マイページ誕生日変更時のパス同期 | **同期する**（§2.1 B 経路）。初回入力ミスの訂正が主用途、同期しないと本人がログイン不能になる。 |

### 1.3 本 spec が確定させる項目（親仕様書 §2.5.3 未決の決着）

親仕様書 §2.5.3 で示された復旧経路 3 案のうち：

> B 経路ではログイン不能に陥るリスクが大きいため、**案 C（一体トランザクション）が推奨方向**。

本 spec はこの推奨方向を採用し、**Server Action 内で `root_employees.birthday` UPDATE と `auth.admin.updateUserById` を一体のトランザクションとして扱う** 設計を採用する。これにより「birthday だけ書き換わってパス未同期」状態（親仕様書 §2.5.1 🔴 相当）を構造的に発生させない。

### 1.4 スコープ外

- A 経路（`/tree/birthday` 初回ログイン）の復旧経路改善 — 別 spec で対応（本 spec は B 経路のみ）
- Root 側パス再発行 UI — a-root 範疇、別 spec で対応
- マイページ全体のリデザイン — 本 spec は「誕生日変更」ボタン追加とモーダルのみ

---

## §2. UI 仕様

### 2.1 マイページ導線追加

**変更前**（現行 `src/app/tree/mypage/page.tsx`）：
```
登録情報セクション
  誕生日: 1990-05-07 （表示のみ、変更不可）
```

**変更後**：
```
登録情報セクション
  誕生日: 1990-05-07
  [誕生日を変更する] ← 追加ボタン（本人のみ表示、即ち常時表示）
```

- ボタンは `treeUser?.birthday !== null` のときのみ活性（誕生日未登録ユーザーは A 経路で入力する）
- ボタン位置は「登録情報」カード下部、右寄せ、secondary スタイル

### 2.2 モーダル構成（ChangeBirthdayModal）

モーダルは 3 ステップ構成ではなく**単一フォーム**で提示する（操作ステップを増やすより、必須項目を1画面で見せる方が誤操作少）。

```
┌─────────────────────────────────────┐
│ 誕生日の変更                      ✕ │
├─────────────────────────────────────┤
│                                     │
│  現在の誕生日                       │
│  1990-05-07（読み取り）             │
│                                     │
│  新しい誕生日（必須）               │
│  [____-__-__]  date picker          │
│                                     │
│  現在のパスワード（必須）           │
│  [****]  text/password              │
│  ※本人確認のため入力してください    │
│                                     │
│  [キャンセル]        [変更する]     │
│                                     │
└─────────────────────────────────────┘
```

#### 2.2.1 フィールド仕様

| フィールド | 種類 | 必須 | バリデーション |
|---|---|:---:|---|
| 現在の誕生日 | 表示のみ | — | `treeUser.birthday` をそのまま表示、ユーザー入力不可 |
| 新しい誕生日 | `<input type="date">` | ✅ | ① 形式 YYYY-MM-DD ② 未来日付禁止（`max={today}`） ③ **現誕生日と同一値禁止**（「変更」になっていないため） |
| 現在のパスワード | `<input type="password">` | ✅ | 4桁以上（一般ユーザーは MMDD = 4桁だが、admin は自由長なので下限のみ） |

#### 2.2.2 ボタン

| ボタン | 動作 |
|---|---|
| キャンセル | モーダルを閉じる、入力破棄、`treeUser` 無変更 |
| 変更する | `submit` → `changeBirthdayWithPassword` Server Action を呼出 |

- 変更する ボタンは送信中 **`disabled + "変更中..."` 表示** にする（二重送信防止）
- モーダル外クリックでの閉じるは**無効**（誤操作防止）

### 2.3 遷移とセッション維持

- 変更成功時：モーダルが閉じる → マイページの「現在の誕生日」表示が新しい値に更新される → 画面下部に**成功トースト**「誕生日を変更しました。次回ログインからは新しい誕生日のパスワードでログインしてください」を表示（5 秒自動消失）
- **セッションは維持する**（即時ログアウトしない、業務継続可能）
- 失敗時：モーダルは閉じずエラーメッセージをフォーム下部に表示（§5 参照）

### 2.4 レスポンシブ

親CLAUDE.md §7 レスポンシブ対応方針に準拠：
- PC: モーダル幅 480px 中央表示
- スマホ（sm 以下）: フルスクリーンモーダル、フィールド間余白を広めに
- 最低タップ領域 44px 確保

---

## §3. API 仕様

### 3.1 Server Action 新設

**ファイル**: `src/app/tree/_actions/change-birthday-with-password.ts`（新規）

```ts
"use server";

import { createServerActionClient } from "@/lib/supabase/server-action";
import { createAdminClient } from "@/lib/supabase/admin";
// ↑ develop に src/lib/supabase/admin.ts がある場合は流用
// なければ Tree 内で API route 同等のクライアントを生成

export type ChangeBirthdayWithPasswordInput = {
  newBirthday: string;        // YYYY-MM-DD
  currentPassword: string;    // 現在のパスワード（本人確認用）
};

export type ChangeBirthdayWithPasswordResult =
  | { success: true }
  | { success: false; errorCode:
      | "UNAUTHENTICATED"
      | "INVALID_FORMAT"
      | "SAME_AS_CURRENT"
      | "WRONG_PASSWORD"
      | "RATE_LIMITED"
      | "TRANSACTION_FAILED"
      | "UNKNOWN"; errorMessage: string };

export async function changeBirthdayWithPassword(
  input: ChangeBirthdayWithPasswordInput,
): Promise<ChangeBirthdayWithPasswordResult>;
```

### 3.2 サーバー側処理フロー（一体トランザクション設計 = 案 C）

```
1. 認証済セッション取得
     → getServerSession() で user.id / email を取る
     → 取れない → return UNAUTHENTICATED

2. 入力検証
     - newBirthday が /^\d{4}-\d{2}-\d{2}$/ か
     - 未来日付でないか
     → 不一致 → return INVALID_FORMAT

3. 現 birthday 取得
     → root_employees.birthday を anon or service で取得（本人行）
     → newBirthday と同一 → return SAME_AS_CURRENT

4. 現パスワード検証（Supabase Auth 本人確認、§3.4 選択肢 1 採用）
     - 新しい anon クライアントを生成し signInWithPassword({ email, password: currentPassword }) を試行
       （現行セッションへの副作用を避けるため、既存クライアントは流用しない）
     - 失敗 → return WRONG_PASSWORD
     - 成功 → 現パス正、処理継続

5. レート制限チェック
     - root_audit_log（または専用テーブル）で同一 userId の直近 10 分以内の
       password_change 記録を検索
     - 1 件以上存在 → return RATE_LIMITED

6. ★ 一体トランザクション ★
     - newMMDD を抽出
     - ① root_employees.birthday を UPDATE
     - ② auth.admin.updateUserById(user.id, { password: newMMDD })
     - ③ root_audit_log に INSERT（action='password_change', actor=user.id, target=user.id, meta={ via: 'mypage_birthday' }）
     ※ ① と ② は異なるサービス境界のため PostgreSQL トランザクション単独では担保不可
       → §3.3 ロールバック戦略で補償

7. セッション同期（任意）
     - auth.admin.updateUserById 直後、現行セッションは古いパスで発行済 JWT を持つ
     - 有効期限までそのまま使える（Supabase Auth 仕様）
     - UX 的に「次回ログインから新パス必要」と明記すれば追加処理不要

8. return { success: true }
```

### 3.3 ロールバック戦略（クロスサービス整合性）

一体トランザクションといっても、**Supabase Auth と PostgreSQL は別サービス境界**のため純粋な ACID トランザクションは張れない。以下の順序と補償処理で一貫性を担保する：

| 実行順 | 対象 | 失敗時のリカバリ |
|:---:|---|---|
| ① | `root_employees.birthday = newBirthday` | ここで失敗 → 何も書き換わっていない、そのまま TRANSACTION_FAILED 返却 |
| ② | `auth.admin.updateUserById({password: newMMDD})` | ここで失敗 → **① を逆方向 UPDATE で元に戻す**（`birthday = oldBirthday`）。補償失敗時はログのみ記録し `TRANSACTION_FAILED`（Supabase Auth 側はロールバック不要、変わっていないため） |
| ③ | `root_audit_log` INSERT | ここで失敗 → **① と ② は成功しているため巻き戻さない**。監査ログ欠損は致命傷ではない、WARN ログに残すに留める（UX 的には success 返却） |

**設計判断**: ③ は best-effort。本体の同期は完了している以上、監査欠損理由で失敗扱いにすると UX が悪化する。代わりに Supabase のサーバーログで検出可能にしておく。

### 3.4 現パスワード検証の実装選択肢

> **注記**: 本節の「選択肢 1/2/3」は §1.3 / §3.3 の「案 A/B/C（復旧経路）」とは**別命名空間**。本節内でのみ有効な番号付け。

**選択肢 1（推奨）**: anon クライアントで `signInWithPassword({ email, password: currentPassword })` を試行
- 成功 → 現パス正、既存セッションは維持
- 失敗 → `WRONG_PASSWORD`
- ただし副作用として Supabase Auth 側の Last sign in タイムスタンプが更新される
  （業務影響なし、むしろ自然）

**選択肢 2**: `admin.auth.admin.getUserById` で取得したユーザーの現 encrypted_password と照合
- Supabase Auth の admin API では password hash を直接比較する手段が標準提供されていない
- bcrypt 比較を自前実装することになり、セキュリティリスク（実装ミス）大
- **却下**

**選択肢 3**: 別 API（`/api/tree/verify-password`）を先行呼出
- HTTP ラウンドトリップが1つ増える、レイテンシ +100ms 程度
- 既存 `update-password` API と責務が分かれて見通しは良いが、本 spec では選択肢 1 で十分

→ **選択肢 1 を採用**。

### 3.5 既存 API route `/api/tree/update-password` との関係

親仕様書 §2.2.1 A 経路で使う API route は**そのまま残す**。

B 経路は **Server Action に一本化**する（フロントからの直接 fetch を増やさない、Next.js 16 App Router ベストプラクティス）。

| 経路 | 呼出方法 | 使う関数 |
|---|---|---|
| A（初回ログイン `/tree/birthday`） | フロント fetch → `/api/tree/update-password` | `updatePasswordFromBirthday` (既存) |
| B（マイページ `/tree/mypage`） | フロント action → `changeBirthdayWithPassword` (新規 Server Action) | `changeBirthdayWithPassword` |

A 経路を Server Action に寄せる大規模リファクタは**本 spec 範囲外**。将来の統一化候補として親仕様書側に注記追加を提案する（ただし現時点では両経路併存で問題なし）。

---

## §4. セキュリティ

### 4.1 必須項目

| 項目 | 実装 |
|---|---|
| **本人確認（現パス再確認）** | §3.2 ステップ 4、§3.4 選択肢 1 採用 |
| **他人の誕生日/パスを変更できないこと** | Server Action 内で `getServerSession()` から取った user.id 以外の行に触らない（body 値で userId を受け付けない） |
| **CSRF 対策** | Next.js Server Action はデフォルトで CSRF トークン検証あり（追加対策不要） |
| **service_role_key の露出防止** | Server Action はサーバー側実行のため、`admin` クライアントを直接 import して OK。レスポンスには生パスを含めない |
| **レート制限** | §3.2 ステップ 5、`root_audit_log` で直近 10 分以内の `password_change` 記録をチェック |
| **入力検証** | §3.2 ステップ 2 + クライアント側 §2.2.1 の二重検証 |
| **監査ログ** | `root_audit_log` に `action='password_change'` で記録（`meta.via='mypage_birthday'`） |

### 4.2 Root A-3-g 連携

develop の Root Phase A-3-g に `is_user_active()` / `garden_role_of()` Postgres 関数が入っている場合、本 Server Action の先頭でこれらを使って追加の健全性チェックを行う（`is_user_active(user.id)` が false なら UNAUTHENTICATED 扱い）。

**実装時の確認事項**: 本 spec 起草時点で develop 側に Root A-3-g が入っているかを実装着手日に再確認し、存在すれば流用、未マージなら素の `root_employees.is_active` カラムで代替判定する。

### 4.3 敵対モデル

| 脅威 | 対策 |
|---|---|
| 他人のブラウザで開きっぱなしの Tree を使われる | 現パス再確認（§4.1）が最後の砦。離席時は `/tree/login` へ戻ることを別途運用で促す |
| access_token 窃取による偽装 | Server Action は session 駆動、token 単独では悪用不可。token の有効期限管理は Supabase Auth に委譲 |
| SQL インジェクション | Supabase JS クライアントのパラメータバインディングで自動エスケープ |
| タイミング攻撃（現パス推測） | `signInWithPassword` の応答時間は Supabase 側で定数時間に近い挙動。追加対策不要 |

---

## §5. エラーハンドリング

### 5.1 エラーコード対応表

| errorCode | 発生条件 | UI 文言 | 推奨アクション |
|---|---|---|---|
| `UNAUTHENTICATED` | セッション切れ / `is_user_active` false | 「認証が切れました。再ログインしてください」 | 5 秒後に自動で `/tree/login` へ遷移 |
| `INVALID_FORMAT` | 新誕生日の形式不正・未来日付 | 「誕生日の形式が正しくありません」 or 「未来の日付は指定できません」 | フォーム保持、再入力促し |
| `SAME_AS_CURRENT` | 新誕生日 = 現誕生日 | 「現在の誕生日と同じ値です。異なる日付を入力してください」 | フォーム保持、日付フィールド focus |
| `WRONG_PASSWORD` | 現パスワード検証失敗 | 「現在のパスワードが違います」 | パスワードフィールド clear + focus |
| `RATE_LIMITED` | 直近 10 分以内に同一ユーザーの `password_change` 記録あり | 「短時間に連続しての変更はできません。10 分以上空けて再度お試しください」 | モーダル閉じずエラー表示、変更する ボタンは disabled |
| `TRANSACTION_FAILED` | §3.3 の ② 失敗 & ① 補償 UPDATE 実行済 or 補償失敗 | 「一時的な障害が発生しました。少し待ってから再度お試しください」 + 補償失敗時は「サポートに連絡してください（障害番号: {tx_id}）」 | モーダル閉じずエラー表示、再試行可能 |
| `UNKNOWN` | 上記以外 | 「不明なエラーが発生しました。時間をおいて再度お試しください」 | Supabase サーバーログに詳細記録 |

### 5.2 クライアント側の対処パターン

```ts
const result = await changeBirthdayWithPassword({ newBirthday, currentPassword });

if (result.success) {
  toast.success("誕生日を変更しました。次回ログインからは新しい誕生日のパスワードでログインしてください");
  await refreshAuth();
  setModalOpen(false);
  return;
}

switch (result.errorCode) {
  case "UNAUTHENTICATED":
    setError(result.errorMessage);
    setTimeout(() => router.push(TREE_PATHS.LOGIN), 5000);
    break;
  case "WRONG_PASSWORD":
    setError(result.errorMessage);
    setCurrentPassword("");
    passwordInputRef.current?.focus();
    break;
  case "SAME_AS_CURRENT":
    setError(result.errorMessage);
    birthdayInputRef.current?.focus();
    break;
  case "RATE_LIMITED":
  case "TRANSACTION_FAILED":
  case "UNKNOWN":
  default:
    setError(result.errorMessage);
    break;
}
```

### 5.3 タイムアウト
- Server Action の既定タイムアウトは Vercel 側で 10 秒（Hobby プラン Pro plan 問わず）
- 本 Server Action は通常 1 秒以内で完了想定（Supabase Auth + PostgreSQL で各 ~200ms）
- 超過時は Vercel が 504 を返す → クライアント側で `UNKNOWN` 扱い

---

## §6. テスト観点

### 6.1 Vitest（Server Action 単体）

ファイル: `src/app/tree/_actions/__tests__/change-birthday-with-password.test.ts`（新規）

Supabase クライアントをモックし、以下を検証：

| # | 観点 | テストケース |
|---|---|---|
| 1 | トランザクション原子性 | ② 失敗時に ① が巻き戻ること、補償 UPDATE が現誕生日値で呼ばれること |
| 2 | バリデーション | 形式不正 / 未来日付 / 現誕生日同一 がそれぞれ `INVALID_FORMAT` / `SAME_AS_CURRENT` を返すこと |
| 3 | 現パス検証 | `signInWithPassword` モック返却値に応じて `WRONG_PASSWORD` を返すこと |
| 4 | 未認証 | セッション取得失敗時に `UNAUTHENTICATED` を返すこと、DB/Auth は呼ばれないこと |
| 5 | レート制限 | `root_audit_log` に直近 10 分以内レコードがある時 `RATE_LIMITED` を返すこと |
| 6 | 監査ログ失敗耐性 | ③ 監査ログ INSERT 失敗時も success を返すこと（WARN ログを吐くことは副作用として検証） |
| 7 | エラーコード型網羅 | `ChangeBirthdayWithPasswordResult` の errorCode が exhaustive（TypeScript で `never` チェック） |

### 6.2 React Testing Library（モーダル UI）

ファイル: `src/app/tree/mypage/_components/__tests__/ChangeBirthdayModal.test.tsx`（新規）

| # | 観点 | テストケース |
|---|---|---|
| 1 | 開閉 | ボタンクリックでモーダル表示、✕/キャンセルで閉じる、モーダル外クリックでは閉じないこと |
| 2 | 入力 | 現誕生日は読み取り専用、新誕生日と現パスが入力できる |
| 3 | submit | 必須項目欠けたら submit disabled、両方埋まると submit 活性化 |
| 4 | 成功 | mock action が `success: true` を返すと、成功トーストが出て、モーダルが閉じて、`refreshAuth` が呼ばれること |
| 5 | エラー表示 | エラーコード別の文言がフォーム下部に出ること、WRONG_PASSWORD 時は現パスフィールドが focus されること |
| 6 | ローディング | action 実行中は 変更する ボタンが disabled + "変更中..." 表示になること |

### 6.3 手動テスト（実機）

- **前提**: PR #45 がマージ済、本 spec 実装後に develop または作業ブランチで `npm run dev` 起動
- 三好 理央（1324）or テスト用ユーザーで通常ログイン（MMDD パス）
- マイページ → 誕生日を変更する ボタン → モーダル表示
- 正常系: 現パス正 + 新誕生日入力 → 変更する → 成功トースト + セッション維持
- ログアウト → 社員番号 + 新 MMDD で再ログイン → 成功
- 旧 MMDD では入れないことも確認
- 異常系: 現パス誤入力 / 同日 / レート制限（10 分以内に 2 回試行）を一通り流して文言確認

詳細手順は `docs/phase-b-beta-e2e-checklist.md` §B 経路 STEP 12-15 を本 spec 実装後に有効化する。

---

## §7. 実装ステップ

### 7.1 マイグレーション

**不要**。既存テーブル `root_employees` と `root_audit_log` のみ使用。`root_audit_log` が未作成の環境では Root 側のマイグレーション到着待ち（a-root に依頼）。

### 7.2 新規ファイル

| パス | 目的 |
|---|---|
| `src/app/tree/_actions/change-birthday-with-password.ts` | Server Action 本体 |
| `src/app/tree/_actions/__tests__/change-birthday-with-password.test.ts` | Vitest |
| `src/app/tree/mypage/_components/ChangeBirthdayModal.tsx` | モーダル UI |
| `src/app/tree/mypage/_components/__tests__/ChangeBirthdayModal.test.tsx` | RTL |

### 7.3 既存ファイル変更

| パス | 変更内容 |
|---|---|
| `src/app/tree/mypage/page.tsx` | 登録情報セクションに 誕生日を変更する ボタンと ChangeBirthdayModal を追加、成功時の `refreshAuth` + トースト表示 |
| `docs/phase-b-beta-e2e-checklist.md` | §B 経路 STEP 12-15 の「次フェーズ実装後に有効化」前置きを削除、実機テスト手順として有効化 |

### 7.4 実装順序

```
① Server Action 雛形作成（型定義 + スケルトン、エラーコード enum）
  ↓
② Vitest 書き出し（TDD、まず 7 ケース分の失敗テストを書く）
  ↓
③ Server Action 本実装（§3.2 フロー通り、Vitest を通過させる）
  ↓
④ ChangeBirthdayModal 実装（UI 骨格のみ、action は mock 差し替え可能に）
  ↓
⑤ RTL 書き出し（モーダル開閉 / 入力 / submit / エラー表示 / ローディング）
  ↓
⑥ mypage 統合（ボタン追加、モーダル配置、トースト連携）
  ↓
⑦ E2E チェックリスト更新、実機テスト（三好アカウント）
  ↓
⑧ commit 分割（action / RTL / mypage 統合 の 3 コミット推奨）
```

### 7.5 干渉回避（他セッションとの競合点）

| 触るファイル | 他セッション競合の可能性 |
|---|---|
| `src/app/tree/_actions/*`（新規） | Tree 単独、なし |
| `src/app/tree/mypage/*` | Tree 単独、なし |
| `src/lib/supabase/admin.ts` | **Leaf が先行作業中**、触らず import のみ。未マージなら Tree 内でラッパーを一時作成 |
| `src/app/root/*` | a-root の担当、触らない |
| `supabase/migrations/*` | マイグレーション不要のため無接触 |

---

## §8. 見込み時間

### 8.1 合計: 0.5d (4h)

| 項目 | 見込み | 内訳 |
|---|---:|---|
| UI（ChangeBirthdayModal + mypage 統合） | 0.2d (1.6h) | モーダル骨格 0.8h + mypage 統合 0.4h + スタイル調整 0.4h |
| API（Server Action + ロールバック戦略） | 0.2d (1.6h) | 雛形 0.3h + 現パス検証 0.3h + 一体トランザクション + 補償 0.6h + 監査ログ 0.2h + レート制限 0.2h |
| Test（Vitest + RTL） | 0.1d (0.8h) | Vitest 7 ケース 0.5h + RTL 6 ケース 0.3h |

### 8.2 見込み幅を超える要因（リスク）

- Root A-3-g の `is_user_active` 流用可否によって +0.05d（フォールバック実装の要/不要で変動）
- Supabase Auth `signInWithPassword` のダミー実行が既存セッションに与える副作用の検証で +0.05d の可能性
- ロールバック戦略の PoC（② 失敗シナリオの人工的再現）で +0.1d の可能性

### 8.3 見込み下回る要因

- UI モーダルは既存 `GlassPanel` / `ActionButton` / `WireframeLabel` の再利用で -0.05d
- Vitest は Bud Phase 1a / Tree Phase B Step 4-6 で確立済みの Supabase mock パターンを流用可能で -0.05d

---

## 付録A: 親仕様書との対応表

| 親 §番号 | 本 spec での扱い |
|---|---|
| §2.1 | 本 spec の §1 で方針確認 |
| §2.2.2 | 本 spec の §2.2 / §3.2 で詳細化 |
| §2.4 末行（B 経路の追加認証） | 本 spec の §3.2 ステップ 4 + §4.1 で実装詳細 |
| §2.5.2 | 本 spec の §5 で errorCode 別に細分化 |
| §2.5.3 🔴 復旧経路（案 A/B/C） | 本 spec で **案 C 採用確定**（§1.3 / §3.3） |
| §2.6 パス再発行（Root 範疇） | 本 spec では触れない（a-root 範疇） |
| §5.1 確定事項 #1 | 本 spec が実装 spec として確定 |

## 付録B: 次段階で確定させる事項（本 spec の範囲外）

- 成功トーストのデザイン（Tree 全体で統一したトースト基盤がまだない場合、本 spec 実装時に暫定実装） → **Tree UI 共通化タスクで後日整理**
- A 経路の Server Action 移行（現 API route と Server Action の責務分離）→ **Tree リファクタタスクで後日検討**
- パス再発行の Root UI 連携（本 spec では触れない）→ **a-root 側 spec 起草待ち**

---

## 変更履歴

| 日付 | 版 | 改訂内容 | 担当セッション |
|---|---|---|---|
| 2026-04-25 | 1.0（初版） | 起草。親仕様書 §2.1 B 経路・§2.5.3 推奨方向（案 C）を実装可能粒度に落とし込み。Vitest/RTL 観点・エラーコード網羅・ロールバック戦略・干渉回避まで明記。 | a-tree |

— end of spec —
