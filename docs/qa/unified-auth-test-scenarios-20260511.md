# Garden 統一認証 E2E テストシナリオ集（2026-05-11）

| 項目 | 内容 |
|---|---|
| 作成日 | 2026-05-11 |
| 対象 plan | `docs/specs/plans/2026-05-11-garden-unified-auth-plan.md` (Garden-wide unified auth) |
| 対象 Task | 1 (Login 統一) / 2 (Series Home) / 3 (ModuleGate) / 5 (super_admin lockdown) |
| 担当 | a-root-003-subagent-task6 起草 → 東海林さん / a-review が手動実行 |
| 環境 | garden-dev（Supabase）+ ローカル `npm run dev` + Chrome MCP |
| 実行ツール | Chrome MCP (`mcp__Claude_in_Chrome__*`) + Supabase Studio SQL Editor |

本ドキュメントは **Vitest 単体テスト（Step 6-1 / 6-2）では網羅できない実画面の挙動** を、
8 garden_role × 12 module = 96 セル + 異常系 13 シナリオ + Method C クロス検証 (PR #162) で
手動 E2E 検証するためのシナリオ集である。

subagent 環境では Chrome MCP の実行はできないため、本ファイルの完備までが Task 6 の subagent 範囲。
S1〜S13 / 96 マトリクスの ✅/⚠️/❌ 記録は東海林さん復帰後に手動で進める。

---

## §0. 前提条件

### 0.1 テストアカウント事前作成（東海林さんに依頼）

garden-dev に **8 garden_role 各 1 名のテストアカウント** を事前作成する。

| 社員番号 | garden_role | パスワード（例） | メモ |
|---|---|---|---|
| 9001 | super_admin | （Dashboard SQL 経由のみ昇格） | 東海林さん本人と分けて検証専用 |
| 9002 | admin | `Test9002!` | UI 経由作成 |
| 9003 | manager | `Test9003!` | UI 経由作成 |
| 9004 | staff | `Test9004!` | UI 経由作成 |
| 9005 | outsource | `Test9005!` | UI 経由作成、staff と manager の間 |
| 9006 | cs | `Test9006!` | UI 経由作成 |
| 9007 | closer | `Test9007!` | UI 経由作成、強制 `/tree` 検証用 |
| 9008 | toss | `Test9008!` | UI 経由作成、強制 `/tree` 検証用 |
| （任意） 9009 | outsource | `Test9009!` | 強制 `/leaf/kanden` 検証用（plan §IN-3） |

9001 (super_admin) は Supabase Dashboard → SQL Editor で
`UPDATE root_employees SET garden_role='super_admin' WHERE employee_number='9001';`
を **service_role** セッションで実行して昇格する（§S11 で正常昇格を検証）。

### 0.2 ローカル環境準備

```powershell
cd C:\garden\a-main  # or 任意の作業 worktree
git checkout develop
git pull
npm install   # 既存 install 済なら不要
npm run dev   # http://localhost:3000
```

### 0.3 NEXT_PUBLIC_AUTH_DEV_BYPASS の切替手順

`.env.local` の 1 行で切替:

| 値 | 挙動 |
|---|---|
| `NEXT_PUBLIC_AUTH_DEV_BYPASS=1` | ModuleGate が認証スキップ、children 直描画（§S4 検証用） |
| `NEXT_PUBLIC_AUTH_DEV_BYPASS=0` または未設定 | 通常動作（§S1〜S3, S5〜S13 検証用） |

`.env.local` 変更後は **dev server 再起動が必要**（next.config の env 取込は起動時 1 回）。

### 0.4 記録ルール

各シナリオの結果は本ファイル末尾の §5 結果記録欄に **✅ / ⚠️ / ❌** で記入。
不合格は §4 不合格時調査ポイントを参照、追加情報を併記。

---

## §1. ロールマトリクス（8 garden_role × 12 module = 96 セル）

plan §IN-3 確定マトリクスを再掲（**Task 2 / Task 6 共通の唯一の参照源**）。
凡例: ✅ = 表示・到達可、❌ = 非表示・拒否、— = `/home` 不可・該当なし

### 1.1 一覧表（IN-3 確定版、本表が現場合致しなければ失敗）

| role         | Bloom | Tree | Forest | Root | Bud | Leaf | Seed | Soil | Sprout | Fruit | Rill | Calendar | `/home` 到達 |
|--------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| super_admin  | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| admin        | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| manager      | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| staff        | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| outsource    | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| cs           | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| closer       | —  | —  | —  | —  | —  | —  | —  | —  | —  | —  | —  | —  | ❌（強制 `/tree`） |
| toss         | —  | —  | —  | —  | —  | —  | —  | —  | —  | —  | —  | —  | ❌（強制 `/tree`） |
| outsource (※) | —  | —  | —  | —  | —  | —  | —  | —  | —  | —  | —  | —  | （補足：plan §IN-3 では outsource は `/home` 到達可。一部 module 強制リダイレクトは存在しない。但し外注セッションでは Leaf 経路 `/leaf/kanden` を default 推奨。後道さんレビュー後に確定。） |

> 注: plan §IN-3 では `outsource` は `/home` 到達可（staff と manager の間）。
> ただし `getPostLoginRedirect` のロール特例 (`/tree` / `/leaf/kanden`) は別軸で発火する可能性あり。
> S6 / S7 / 96 セルテストで実挙動を検証し、ズレがあれば plan §IN-3 の outsource 行を更新する。

### 1.2 検証手順（各セル）

**Chrome MCP コマンド例（forest セル、role=staff の場合）**:

```javascript
// 1. ログイン
mcp__Claude_in_Chrome__navigate(url="http://localhost:3000/login")
mcp__Claude_in_Chrome__form_input(selector="input[name=empId]", value="9004")
mcp__Claude_in_Chrome__form_input(selector="input[name=password]", value="Test9004!")
mcp__Claude_in_Chrome__find(selector="button[type=submit]", action="click")

// 2. /home（Series Home）の OrbGrid を確認
mcp__Claude_in_Chrome__navigate(url="http://localhost:3000/")
mcp__Claude_in_Chrome__read_page()
// → 期待: staff は 10 module 可視（Soil / Rill 非可視）
// → 期待: Forest orb がクリック可能（minRole=manager のため拒否されるべきだが
//          visibility と min role は別。Forest は staff には visible でも
//          /forest 直アクセスで access-denied になる想定。下記要確認）

// 3. /forest 直アクセス → role 不足で /access-denied?module=forest
mcp__Claude_in_Chrome__navigate(url="http://localhost:3000/forest")
mcp__Claude_in_Chrome__read_page()
// → 期待: URL = /access-denied?module=forest
```

### 1.3 マトリクスのうち重要セルの詳細期待値

| セル | 期待値 |
|---|---|
| staff × Soil | `/soil` 直アクセス → `/access-denied?module=soil`（visibility ❌, minRole=admin） |
| staff × Rill | `/rill` 直アクセス → `/access-denied?module=rill`（visibility ❌, minRole=admin） |
| staff × Forest | visibility と minRole は別問題。`/home` の orb 上で見える / 見えない、`/forest` 直アクセスで通る / 通らない、を両軸で記録 |
| cs × Bud | `/bud` 直アクセス → `/access-denied?module=bud`（visibility ❌, minRole=manager） |
| toss × `/home` | login 直後 `/tree` へ強制 redirect（getPostLoginRedirect） |
| closer × `/home` | login 直後 `/tree` へ強制 redirect |
| outsource × `/home` | plan §IN-3 では `/home` 到達可だが、`getPostLoginRedirect` 実装側の挙動を確認する |

---

## §2. 異常系シナリオ S1-S13

### S1: 未認証で全 module URL 直アクセス → `/login?returnTo=` redirect

**手順**:
1. ブラウザ Cookie / sessionStorage を完全クリア
2. 以下 12 URL を順に直アクセス
   - `/bloom` / `/tree` / `/forest` / `/root` / `/bud` / `/leaf`
   - `/seed` / `/soil` / `/sprout` / `/fruit` / `/rill` / `/calendar`

**期待**:
- 各 URL で 1 hop redirect `/login?returnTo=<encoded original path>` に到達
- `returnTo` の値が encodeURIComponent('/forest/dashboard') 等で正しく付与
- redirect は **1 回のみ**（ループしない）

**Chrome MCP**:
```javascript
for (const path of ['/bloom','/tree','/forest','/root','/bud','/leaf','/seed','/soil','/sprout','/fruit','/rill','/calendar']) {
  mcp__Claude_in_Chrome__navigate(url=`http://localhost:3000${path}`);
  mcp__Claude_in_Chrome__read_page();
  // URL を read_page から抽出し、/login?returnTo=<encoded path> であることを確認
}
```

**不合格時調査**: ModuleGate.tsx の `loginPath` / `returnToParam` props を各 layout が override していないか、`window.location.pathname + search` の取得タイミング（useEffect 内）が正しいか確認。

---

### S2: returnTo クエリで遷移先復元

**手順**:
1. Cookie クリア状態で `/forest/dashboard` 直アクセス
2. `/login?returnTo=%2Fforest%2Fdashboard` に redirect されることを確認
3. 9003 (manager) でログイン
4. ログイン成功後、`/forest/dashboard` に到達することを確認

**期待**:
- step 4 で `/forest/dashboard` に直接遷移（`/home` 経由しない）
- `sanitizeReturnTo` が `//evil.com` / `https://evil.com/...` を reject することを§S2b で別途確認

**S2b: open redirect 対策（sanitizeReturnTo 機能テスト）**:

URL を手動編集して以下を順次試行:

| returnTo 値 | 期待挙動 |
|---|---|
| `/forest/dashboard` | OK、step 4 に同じ |
| `//evil.com` | sanitize で null → `/home` または `getPostLoginRedirect` 結果へ |
| `https://evil.com/foo` | sanitize で null → `/home` |
| `javascript:alert(1)` | sanitize で null → `/home` |

**Chrome MCP**:
```javascript
mcp__Claude_in_Chrome__navigate(url="http://localhost:3000/login?returnTo=%2F%2Fevil.com");
// ログイン後、external host に飛ばないことを確認
```

---

### S3: パスワード誤りで audit 記録

**手順**:
1. 9004 (staff) でパスワードを **わざと間違えて** 3 回連続入力
2. UI に "社員番号またはパスワードが正しくありません" が表示されることを確認
3. Supabase Dashboard → Authentication → Users → 該当 user の Sign In Logs で失敗 3 件記録されていることを確認

**期待**:
- UI エラーメッセージは plan §Task 1 §Step 6 のテキスト
- audit ログには `auth.audit_log_entries` に該当 entry がある
- 同一 IP / 同一社員番号で連続失敗時のレート制限（Supabase 既定）を確認

**Chrome MCP**:
```javascript
for (let i = 0; i < 3; i++) {
  mcp__Claude_in_Chrome__navigate(url="http://localhost:3000/login");
  mcp__Claude_in_Chrome__form_input(selector="input[name=empId]", value="9004");
  mcp__Claude_in_Chrome__form_input(selector="input[name=password]", value="wrong");
  mcp__Claude_in_Chrome__find(selector="button[type=submit]", action="click");
}
```

---

### S4: dev バイパス挙動（NEXT_PUBLIC_AUTH_DEV_BYPASS=1）

**手順**:
1. `.env.local` に `NEXT_PUBLIC_AUTH_DEV_BYPASS=1` を追記
2. `npm run dev` を再起動
3. Cookie / sessionStorage を完全クリア
4. `/forest/dashboard` 直アクセス
5. `/login` に redirect されず、`/forest/dashboard` の中身が描画されることを確認
6. 検証完了後、`.env.local` を元に戻す（`=0` または削除）+ dev server 再起動

**期待**:
- `useEffect` 内の `router.replace` が呼ばれない
- children（`/forest/dashboard` のページ本体）がそのまま表示

**注意**: dev バイパスは ModuleGate の `allowDevBypass=true`（既定）でのみ有効。本番 build では `process.env.NEXT_PUBLIC_AUTH_DEV_BYPASS` は build 時に評価され、`!== "1"` であれば常に false になる。

---

### S5: signOut 後の state clear（全モジュール sessionStorage クリア）

**手順**:
1. 9003 (manager) でログイン
2. `/bloom`, `/forest`, `/bud` を順次訪問（各モジュールで sessionStorage に unlock が set される）
3. DevTools → Application → sessionStorage で `bloom:unlockedAt` / `forest:unlockedAt` / `bud:unlockedAt` が存在することを確認
4. AppHeader の signOut ボタンをクリック（または `signOutUnified()` を console から呼ぶ）
5. sessionStorage の全 `<module>:unlockedAt` キーが消えていることを確認
6. `/forest` 再アクセス → `/login` redirect になることを確認

**期待**:
- signOut で 6 モジュール (bloom / forest / tree / bud / root / leaf) の unlock がすべてクリア
- Supabase の auth session も終了（`supabase.auth.getSession()` が null）
- 再アクセスで未認証扱い

---

### S6: 退職者ログイン block

**手順**:
1. テストアカウントの 1 つ (例: 9006 cs) の `root_employees.is_retired = true` に Supabase Studio で更新
   ```sql
   UPDATE root_employees SET is_retired = true WHERE employee_number = '9006';
   ```
2. 9006 でログイン試行

**期待**:
- ログイン UI レベル または ModuleGate / AuthProvider のレベルで block
- 想定エラー: "退職済社員のためアクセスできません" 相当のメッセージ
- 詳細仕様: plan §Task 1 §Step 6 + a-root の `is_retired` 既存ハンドリング（要確認）

**注**: 本シナリオは Task 1 の signInUnified 内で is_retired ハンドリングが実装されていない場合、現状は UI 経由でログインが成立してしまう。その場合は ❌ で記録、Phase B-1 の追加チェックに繰り越し（plan §残課題）。

---

### S7: 削除済社員ログイン block

**手順**:
1. テストアカウントの 1 つの `root_employees.deleted_at = NOW()` に更新
   ```sql
   UPDATE root_employees SET deleted_at = NOW() WHERE employee_number = '9007';
   ```
2. 9007 でログイン試行

**期待**:
- ログイン block、auth-unified.tsx の fetchRole が null を返し、ModuleGate が role 不足扱いで `/access-denied` redirect
- メモ: 物理削除はしていない（memory `project_delete_pattern_garden_wide.md` 準拠の論理削除）

---

### S8: 同時複数 module タブで signOut

**手順**:
1. ブラウザで 9003 (manager) ログイン
2. タブ A: `/bloom`、タブ B: `/forest`、タブ C: `/bud` を開く
3. タブ A の signOut ボタンクリック
4. タブ B / C をリロードまたはアクション

**期待**:
- 全タブで未認証状態（sessionStorage は全 6 モジュール分クリア）
- タブ B / C のリロード時に `/login?returnTo=...` redirect

**注**: AuthProvider の `onAuthStateChange` 経由で他タブも即時 logout 検知が望ましいが、`storage` イベントは sessionStorage では飛ばない（localStorage のみ）。各タブで independent な supabase session を持っているため、新しい操作のタイミングで getSession() = null になり logout 検出される想定。

---

### S9: super_admin 昇格 UI block（Task 5）★Method C クロス検証

**前提**: PR #162 の `scripts/garden-super-admin-lockdown.sql` が garden-dev に **apply 済**
（5/11 18:00 頃、東海林さん適用、a-main- No. 333 §A # 3 採択）。

**Step 9-A: UI レベル（GARDEN_ROLE_SELECTABLE_OPTIONS）**

1. 9002 (admin) でログイン
2. Root 従業員編集画面（パス例: `/root/employees/<some-uid>/edit`）へ遷移
3. garden_role セレクトボックスを展開
4. オプション一覧を読み取り

**期待**: super_admin が **選択肢に存在しない**（7 件のみ: toss / closer / cs / staff / outsource / manager / admin）

**Chrome MCP**:
```javascript
mcp__Claude_in_Chrome__navigate(url="http://localhost:3000/root/employees/9004/edit");
mcp__Claude_in_Chrome__find(selector="select[name=garden_role]", action="click");
mcp__Claude_in_Chrome__read_page();
// オプション一覧に super_admin が含まれていないことを確認
```

**Step 9-B: DB レベル（authenticated session で UPDATE 試行）**

Supabase Studio → SQL Editor で以下を実行（**authenticated session**）:

```sql
SET ROLE authenticated;
SET request.jwt.claims = '{"role": "authenticated"}';
UPDATE root_employees SET garden_role = 'super_admin' WHERE employee_number = '9004';
-- 期待: ERROR: 42501 — super_admin の UI 経由昇格は不可
```

**期待**: SQLSTATE = `42501` で reject、message に "UI 経由昇格は不可" が含まれる。

**Step 9-C: Vitest による Task 5 補強（既存）**

`src/app/root/_constants/__tests__/super-admin-lockdown.test.ts` が
GARDEN_ROLE_SELECTABLE_OPTIONS から super_admin が除外されていることを単体テストで確認済（Task 5 で 3 件）。
Step 6-4 の Vitest 全件実行でも緑であることを確認。

---

### S10: super_admin 降格 UI block（Task 5）★Method C クロス検証

**前提**: S9 と同じ（lockdown.sql apply 済）。

**Step 10-A: DB レベル（既存 super_admin の降格試行）**

Supabase Studio で **authenticated session** から以下:

```sql
SET ROLE authenticated;
SET request.jwt.claims = '{"role": "authenticated"}';
-- 既存 super_admin (例: 9001 または東海林さん本人) を降格しようとする
UPDATE root_employees SET garden_role = 'admin' WHERE employee_number = '9001';
-- 期待: ERROR: 42501 — super_admin の降格もアプリ UI から不可
```

**期待**: SQLSTATE = `42501` で reject、message に "降格もアプリ UI から不可" が含まれる。

**Step 10-B: UI レベル**

1. 9002 (admin) でログイン
2. 9001 (super_admin) の従業員編集画面へ遷移
3. garden_role セレクトを開く
4. super_admin が選択肢にないこと（S9-A と同じ）+ そもそも別のロール（admin 等）に変更しようとして submit すると、DB 側 trigger で reject されることを確認

**期待**:
- UI 側で **そもそも super_admin 自体が選べない**（GARDEN_ROLE_SELECTABLE_OPTIONS 除外、Task 5）
- 仮に他経路（curl 等）で UPDATE しても DB trigger が 42501 で reject

---

### S11: service_role バイパス成功（Task 5）★Method C クロス検証

**前提**: S9 / S10 と同じ。

**Step 11-A: Supabase Dashboard SQL Editor は既定 service_role で実行**

1. Supabase Dashboard → SQL Editor を開く（service_role セッション）
2. 以下を実行:
   ```sql
   -- 9001 を super_admin に昇格（既に super_admin なら別の検証用社員番号で）
   UPDATE root_employees SET garden_role = 'super_admin' WHERE employee_number = '9001';
   -- 期待: UPDATE 1 — 成功
   ```
3. SELECT で確認:
   ```sql
   SELECT employee_number, garden_role FROM root_employees WHERE employee_number = '9001';
   -- 期待: garden_role = 'super_admin'
   ```

**Step 11-B: service_role で INSERT 経路もバイパス確認**

```sql
-- 一時的にテスト用 super_admin INSERT を試行（実 schema を壊さないよう注意。
-- user_id は適当な auth.users.id を流用）
INSERT INTO root_employees (employee_number, garden_role, user_id, full_name)
VALUES ('9999_test', 'super_admin', '<existing user id>', 'TEST');
-- 期待: INSERT 1 — service_role なら成功

-- 検証後は必ず削除（または論理削除）して env をクリーンに戻す
DELETE FROM root_employees WHERE employee_number = '9999_test';
-- ※ DELETE 実行は東海林さんの判断で。論理削除 (deleted_at) でも可。
```

**Step 11-C: Method C クロス検証総括**

| 経路 | INSERT super_admin | UPDATE → super_admin | UPDATE super_admin → 他 |
|---|:---:|:---:|:---:|
| UI (GARDEN_ROLE_SELECTABLE_OPTIONS 経由) | ❌ option 除外 | ❌ option 除外 | ❌ option 除外 |
| authenticated SQL | ❌ 42501 | ❌ 42501 | ❌ 42501 |
| service_role SQL (Dashboard) | ✅ 成功 | ✅ 成功 | ✅ 成功 |

すべて期待通りなら S9-S11 PASS。1 つでも食い違えば PR #162 の trigger 動作不良として ❌ で記録、原因調査。

---

### S12: TreeAuthGate の誕生日未登録 2 段判定（Task 3 + Tree Phase B-α）

**手順**:
1. 9008 (toss) のテストアカウントで `root_employees.date_of_birth IS NULL` 状態にする
   ```sql
   UPDATE root_employees SET date_of_birth = NULL WHERE employee_number = '9008';
   ```
2. 9008 でログイン → `getPostLoginRedirect` で `/tree` へ強制 redirect
3. `/tree` 到達後の挙動を観察

**期待**:
- TreeAuthGate（Tree Phase B-α の追加 Gate、ModuleGate のラッパー側で実装）が
  「誕生日未登録のため設定画面へ」のような追加 redirect を発火
- 想定 redirect 先: `/tree/profile/birthday` 等（Tree Phase B-β B 経路）
- ModuleGate（minRole=toss 通過）の **その先** で TreeAuthGate が追加チェック
  → 2 段判定が正しく動作

**注**: 本シナリオは Tree Phase B 統合のため、Task 6 の本ファイルでは挙動観察のみ記録。Tree 側の責務で動作不良なら別 task で対応（plan §IN-2 関連）。

---

### S13: BloomGate の forest-login workaround（既存挙動）

**手順**:
1. Cookie / sessionStorage クリア
2. `/bloom` 直アクセス
3. redirect 先を観察

**期待（Task 1 後の挙動）**:
- `/bloom` → ModuleGate redirect で `/login?returnTo=/bloom` へ（**`/forest/login` 経由ではない**）
- これは Task 1 §Step 3 + 3-b で `GARDEN_LOGIN = "/login"` に統一済の効果

**workaround 残置確認**:
- `src/app/bloom/_constants/routes.ts` で `FOREST_LOGIN` 定数は互換維持で残置されているはず
- BloomGate（Task 3 で ModuleGate ラッパー化済）が新パス `/login` を参照していることを grep / Read で確認可

---

## §3. パフォーマンス目標

| 項目 | 目標 | 計測手段 |
|---|---|---|
| ModuleGate render → redirect 完了 | < 200ms | Chrome DevTools Performance → Frame timeline、`router.replace` 呼び出しから URL 変化までの ms |
| `/access-denied?module=xxx` 表示 | < 100ms | Network → DOMContentLoaded、または `read_page` 完了までの ms |
| Series Home `/` 描画（8 role 平均） | < 500ms | First Contentful Paint |
| `/login` 描画（cold） | < 800ms | Lighthouse |

不合格時の調査は §4 を参照。

---

## §4. 不合格時調査ポイント

### 4.1 redirect ループ（無限 redirect）

- ModuleGate.tsx の `useEffect` 依存配列に `module` / `loginPath` 等が含まれているか
- AuthProvider の `setLoading(false)` が確実に呼ばれているか（fetchRole 内 throw で stuck）
- `sanitizeReturnTo` が returnTo の値を破壊していないか（`/login` 自身を returnTo にして自己 redirect）

### 4.2 role 取得失敗

- `root_employees` テーブルに該当 user_id の行があるか
- RLS ポリシーが authenticated session で SELECT を許可しているか
- `garden_role` 列が enum 制約に違反していないか

### 4.3 dev バイパスが効かない

- `.env.local` の値が `1` か（数字、文字列 "1"、boolean true は別物）
- dev server 再起動済か（Next.js は env 変更を hot reload しない）
- ModuleGate.tsx の `allowDevBypass` 引数が overrride されていないか

### 4.4 super_admin lockdown が動かない（S9-S11）

- garden-dev に `scripts/garden-super-admin-lockdown.sql` 適用済か
- `pg_trigger` で `trg_prevent_super_admin_role_change` / `trg_prevent_super_admin_insert` 2 件存在するか
- 適用時刻と適用者を `docs/dispatch-counter.txt` または PR コメントで確認

### 4.5 パフォーマンス目標未達

- React Strict Mode の二重 render 影響を除外（Production build で再計測）
- Supabase の getSession() が cold start で遅い場合は session cache 設計（v2 検討）
- /access-denied ページの初期 bundle size 確認（Lighthouse → Performance）

---

## §5. 結果記録欄（手動実行時に追記）

各シナリオを実行したら以下を埋める。

### 5.1 §1 マトリクス検証結果

| role | 結果 | 備考 |
|---|---|---|
| super_admin | ⬜ 未実施 | |
| admin | ⬜ 未実施 | |
| manager | ⬜ 未実施 | |
| staff | ⬜ 未実施 | |
| outsource | ⬜ 未実施 | |
| cs | ⬜ 未実施 | |
| closer | ⬜ 未実施 | |
| toss | ⬜ 未実施 | |

### 5.2 §2 シナリオ S1-S13 結果

| Sn | 結果 | 実施日時 | 不合格詳細 / 補足 |
|---|---|---|---|
| S1 | ⬜ 未実施 | | |
| S2 | ⬜ 未実施 | | |
| S2b (open redirect) | ⬜ 未実施 | | |
| S3 | ⬜ 未実施 | | |
| S4 | ⬜ 未実施 | | |
| S5 | ⬜ 未実施 | | |
| S6 | ⬜ 未実施 | | |
| S7 | ⬜ 未実施 | | |
| S8 | ⬜ 未実施 | | |
| S9 (Method C 9-A UI) | ⬜ 未実施 | | |
| S9 (Method C 9-B DB) | ⬜ 未実施 | | |
| S9 (Method C 9-C Vitest) | ⬜ 未実施 | | |
| S10 (Method C 10-A DB) | ⬜ 未実施 | | |
| S10 (Method C 10-B UI) | ⬜ 未実施 | | |
| S11 (Method C 11-A SR) | ⬜ 未実施 | | |
| S11 (Method C 11-B INSERT) | ⬜ 未実施 | | |
| S11 (Method C 11-C 総括) | ⬜ 未実施 | | |
| S12 | ⬜ 未実施 | | |
| S13 | ⬜ 未実施 | | |

### 5.3 §3 パフォーマンス計測結果

| 項目 | 目標 | 実測 | 結果 |
|---|---|---|---|
| ModuleGate redirect 時間 | < 200ms | — | ⬜ |
| /access-denied 表示 | < 100ms | — | ⬜ |
| Series Home `/` 描画 | < 500ms | — | ⬜ |
| /login 描画（cold） | < 800ms | — | ⬜ |

---

## §6. 関連ドキュメント

- 仕様: `docs/specs/plans/2026-05-11-garden-unified-auth-plan.md`
- Task 1 (Login 統一): plan §Task 1
- Task 2 (Series Home): plan §Task 2 + `src/app/_lib/__tests__/module-visibility.test.ts`
- Task 3 (ModuleGate): plan §Task 3 + `src/app/_components/ModuleGate.tsx`
- Task 4 (RLS テンプレート): plan §Task 4 + `docs/specs/2026-05-11-rls-design-guide.md`
- Task 5 (super_admin lockdown): plan §Task 5 + `scripts/garden-super-admin-lockdown.sql` + `src/app/root/_constants/__tests__/super-admin-lockdown.test.ts`
- memory `project_super_admin_operation.md` — super_admin = 東海林さん専任
- memory `project_configurable_permission_policies.md` — 権限閾値ハードコード禁止
- memory `feedback_migration_apply_verification.md` — PR merge ≠ Supabase apply 完了
- memory `feedback_self_visual_check_with_chrome_mcp.md` — Chrome MCP 自走原則

---

## §7. 変更履歴

| 日時 | 担当 | 内容 |
|---|---|---|
| 2026-05-11 21:0X | a-root-003-subagent-task6 | 初版起草（S1-S13、96 マトリクス、Method C クロス検証含む） |
