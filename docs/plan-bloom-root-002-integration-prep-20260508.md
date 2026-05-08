# a-root-002 連携 #1 + #3 統合準備 spec（Bloom 側変更点）

> **起草経緯:** dispatch main- No. 139 EE 案 GO（2026-05-08 14:38）。a-root-002 5/9 朝着手予定の Garden Unified Auth Gate Backend Plan（`docs/superpowers/plans/2026-05-07-garden-unified-auth-gate-root-backend.md` in a-root-002 worktree）に対する Bloom 側必要変更点の事前整理。
>
> **目的:** 5/9 朝 a-root-002 が共通 helper（signInGarden / resolveLandingPath / fetchGardenUser / toSyntheticEmail）を完成 → Bloom 側で即連携できるよう変更点と作業手順を確定させる。
>
> **スコープ:** 連携 #1（signInGarden 切替）+ 連携 #3（src/lib/auth/supabase-client.ts 統合）。実装着手は 5/9 a-root-002 完成通知後（連携依存）。

---

## 1. 現状（5/8 a-bloom-004）

### 1-1. 既存 Bloom 認証 helper（src/app/bloom/_lib/auth.ts）

| 関数 / 定数 | 役割 | 共通化対象 |
|---|---|---|
| `toSyntheticEmail(empId)` | 社員番号 → `emp{NNNN}@garden.internal` | ✅ src/lib/auth/synthetic-email.ts へ |
| `signInBloom(empId, password)` | Supabase auth.signInWithPassword + sessionStorage UNLOCK | ✅ ラッパーに縮退、内部で signInGarden() を呼ぶ |
| `signOutBloom()` | sessionStorage clear + supabase.auth.signOut | △ Bloom 固有挙動（unlock 解除）あり、ラッパー化は時間あれば |
| `isBloomUnlocked()` | sessionStorage UNLOCK 2 時間 TTL チェック | × Bloom 固有（共通化対象外）|
| `touchBloomSession()` | UNLOCK timestamp 更新 | × 同上 |
| `clearBloomUnlock()` | UNLOCK 強制 clear | × 同上 |
| `fetchBloomUser(userId)` | root_employees から GardenRole 取得 | ✅ fetchGardenUser ラッパーに縮退 |
| `BloomUser` type | user_id / employee_id / employee_number / name / garden_role / birthday | ✅ GardenUser 型へ移行 |
| `GardenRole` type | 7 段階（toss/closer/cs/staff/manager/admin/super_admin、outsource なし）| ⚠️ **8 段階へ拡張必須**（outsource 追加）|

### 1-2. roleRank / hasAccess（src/app/bloom/_lib/auth.ts §近傍 + BloomStateContext）

| 関数 | 現状 | 共通化対象 |
|---|---|---|
| `roleRank(role)` | 7 段階の hierarchy | ✅ src/lib/auth/garden-user.ts へ移行（8 段階）|
| `hasAccess(role, min)` | role >= min の判定 | ✅ 同上 |

### 1-3. supabase client（src/app/bloom/_lib/supabase.ts）

```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

→ ブラウザ用 anon client。a-root-002 plan の **`src/lib/auth/supabase-client.ts` 新規作成**で共通化対象。memory `project_rls_server_client_audit.md` に「Route Handler でブラウザ用 anon supabase 流用すると RLS 100% ブロック」記載 = server / client 分離が重要。

---

## 2. a-root-002 plan §「Bloom 側で必要な変更」

a-root-002 plan §「Scope (本 plan で含まないもの)」に以下が記載:
- ForestGate / BloomGate / TreeAuthGate の redirect 変更 → **a-bloom-004 既完了**（commit `265bb9c`）
- /forest/login / /bloom/login / /tree/login 削除 → **a-bloom-004 では /bloom/login は legacy 保持済み**
- signInForest / signInBloom / signInTree の共通 helper 利用への切替 → **a-bloom-004 が 5/9 朝以降に対応**（本 spec の対象）

a-root-002 plan §「Task 7-9 if time allows」:
- Task 7: signInForest を signInGarden ラッパー化
- Task 8: signInBloom を signInGarden ラッパー化 + GardenRole 7 → 8 段階同期 + roleRank 共通化
- Task 9: signInTree を signInGarden ラッパー化

→ a-root-002 が Task 7-9 を完成しない場合、a-bloom-004 が **Task 8 相当を独自実装**する必要。

---

## 3. Bloom 側 5/9 朝以降の作業（連携 #1 + #3）

### 3-1. 連携 #1: signInGarden 切替（src/app/login/page.tsx）

**現状**:
```typescript
import { signInBloom, fetchBloomUser } from "../bloom/_lib/auth";
// ...
const result = await signInBloom(trimmed, password);
const bloomUser = result.userId ? await fetchBloomUser(result.userId) : null;
const target = getPostLoginRedirect(bloomUser?.garden_role);
```

**5/9 後**:
```typescript
import { signInGarden } from "@/lib/auth/sign-in";
import { fetchGardenUser } from "@/lib/auth/garden-user";
import { resolveLandingPath } from "@/lib/auth/landing-paths";
// ...
const result = await signInGarden(trimmed, password);
const user = result.userId ? await fetchGardenUser(result.userId) : null;
const target = resolveLandingPath(user?.garden_role);
```

**変更ポイント**:
- `signInBloom` → `signInGarden`（直接呼び）
- `fetchBloomUser` → `fetchGardenUser`
- `getPostLoginRedirect` → `resolveLandingPath`（a-root-002 plan の ROLE_LANDING_MAP に従う）
- BloomState の sessionStorage UNLOCK 機能維持（signInBloom ラッパー内で呼ばれる、または /login で別途実装）

**互換性ポイント**:
- 既存 `getPostLoginRedirect` と `resolveLandingPath` の差異（staff → / vs /tree、cs → / vs /tree、manager → / vs /root）は a-root-002 plan §ROLE_LANDING_MAP に従う = a-bloom-004 で 5/7 既に実装済み（src/app/_components/GardenHomeGate.tsx + src/app/_lib/auth-redirect.ts に ROLE_LANDING_MAP 追加済 commit `e740063`）

### 3-2. 連携 #3: supabase-client.ts 統合

**a-root-002 plan §新規作成**:
```
src/lib/auth/
├── supabase-client.ts   # ブラウザ用 anon client + service role client（環境別）
```

**Bloom 側変更**:
- `src/app/bloom/_lib/supabase.ts` を `src/lib/auth/supabase-client.ts` の re-export に縮退
- 各 import 箇所（`./_lib/supabase` → `@/lib/auth/supabase-client`）を grep + Edit
- legacy 保持: `src/app/bloom/_lib/supabase.legacy-pre-unified-20260509.ts`

**影響範囲（推定）**:
- src/app/bloom/_lib/auth.ts
- src/app/bloom/_state/BloomStateContext.tsx
- src/app/bloom/kpi/_lib/forest-fetcher.ts
- src/app/api/bloom/daily-report/route.ts（server 側 createClient 使用、別経路）
- src/app/api/bloom/progress-html/route.ts（service role key 使用、別経路）
- src/app/_components/GardenHomeGate.tsx

→ grep で `from ".*bloom/_lib/supabase"` を全件抽出して順次 import path 切替。

### 3-3. GardenRole 7 → 8 段階同期

**現状**: BloomUser.garden_role = 7 段階（outsource なし）

**5/9 後**: GardenRole = 8 段階（toss/closer/cs/staff/outsource/manager/admin/super_admin）
- `outsource` は manager 未満 / staff 以上 = staff < outsource < manager
- a-root-002 plan §「Bloom 側 roleRank() / hasAccess() は 7 段階のまま（outsource 未反映）→ Task 8 で同期」

**変更ポイント**:
- type 定義: `GardenRole` を 8 段階に拡張
- roleRank / hasAccess の hierarchy 反映
- 既存テストケースで outsource を考慮

---

## 4. 5/9 朝の作業手順

a-root-002 plan の Task 7-9 完成通知後、即実行:

| # | 作業 | 依存 | 工数 |
|---|---|---|---|
| 1 | a-root-002 dispatch 内容把握（Task 7-9 が完成しているか確認）| a-root-002 | 0.05d |
| 2 | （a-root-002 が Task 8 完成しているなら）signInBloom = signInGarden ラッパー切替 | Task 8 | 0.1d |
| 3 | （Task 8 未完成なら）a-bloom-004 で独自 helper を src/lib/auth/ 配下に実装 | なし | 0.3d |
| 4 | /login/page.tsx で signInGarden 直接呼び | #2 or #3 | 0.05d |
| 5 | supabase-client 統合（grep + Edit、legacy 保持）| なし | 0.1d |
| 6 | GardenRole 8 段階同期（type 拡張、roleRank 更新）| なし | 0.1d |
| 7 | Vitest 全 tests PASS 確認 + Chrome MCP 視覚確認 | #2-6 | 0.1d |
| 8 | commit + push + bloom-004- N で完成報告 | #7 | 0.05d |
| **計** | | | **約 0.5-0.7d** |

→ 5/9 朝 9:00 着手 → 14:00 完成想定（a-root-002 着手 5/9 朝同期前提）。

---

## 5. 判断保留事項

| # | 論点 | 推奨 | 確定タイミング |
|---|---|---|---|
| 1 | a-root-002 plan §Task 7-9 が完成しているか | a-root-002 dispatch で確認 | 5/9 朝 |
| 2 | signInBloom の sessionStorage UNLOCK 機能の扱い | signInGarden ラッパー内で維持 or /login で別実装 | 5/9 朝 |
| 3 | `getPostLoginRedirect` 削除タイミング | 全 import 箇所 resolveLandingPath 切替後に legacy 保持で削除 | 5/9 朝 |
| 4 | BloomState の auth helper 依存度 | 大規模、要 grep で全 import path 整理 | 5/9 朝 |
| 5 | 既存 BloomUser 型 vs GardenUser 型の併存 | BloomUser を deprecated、GardenUser 移行 | 5/9 朝 |

---

## 6. 制約遵守

dispatch main- No. 139 §「制約遵守」整合:
- ✅ 動作変更なし（spec のみ、実装は 5/9 後）
- ✅ 新規 npm install 禁止（既存 supabase / vitest 流用）
- ✅ Bloom 独自認証独立性維持（Bloom ロック機能は維持）
- ✅ 設計判断・仕様変更なし（a-root-002 plan に従う）
- ✅ main / develop 直 push なし

---

## 7. 関連 dispatch / commit

- main- No. 83 / 84（5/7）Garden 統一認証ゲート 着手
- main- No. 87 E 案完走（5/7）Phase 1+3+2A+2B+GardenHomeGate
- main- No. 139（5/8）DD + EE + FF 並列 GO
- a-bloom-004 commit `265bb9c`（BloomGate redirect /forest/login → /login）
- a-bloom-004 commit `e740063`（GardenHomeGate + ROLE_LANDING_MAP 追加）
- a-root-002 plan `2026-05-07-garden-unified-auth-gate-root-backend.md`（5/9 朝着手予定）
