~~~
🟢 bloom-003- No. 39
発信元: a-bloom-003
発信日時: 2026-05-07(木) 15:08
件名: main- No. 79 完了報告（BloomState dev mock 整備、Workboard 等の loading 滞留解消）

## TL;DR
✅ BloomStateContext に dev mock 注入、loading 滞留解消
✅ /bloom/{workboard,daily-report,roadmap,monthly-digest} 全 200 + 本体描画確認
✅ 既存ロジック完全保護（本番モードでは mock 無効）
🟡 Vercel 本番反映は別判断（dispatch 通り feature push のみ、PR 作成は次依頼で）

## commit / push
- commit: `16f7e42` fix(bloom): BloomState dev mock 整備 (Workboard 等の loading 滞留解消) [dispatch main- No.79]
- push: origin/feature/bloom-6screens-vercel-2026-05 ✅

## 修正方針: 修正 A 採用 (dev mode で初期 state を mock に上書き)

修正対象: `src/app/bloom/_state/BloomStateContext.tsx`

### 採用案
dispatch 推奨案 A の variant: ファイル top に `DEV_MOCK_ENABLED` フラグ + `DEV_MOCK_USER` 定義し、`BloomStateProvider` の **`useState` 初期値** を dev mock 有効時は認証済み相当に設定。`useEffect` の `refreshAuth()` は dev mock 有効時にスキップ（Supabase auth 接続不要）。

### 検出条件
```ts
const DEV_MOCK_ENABLED =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_BLOOM_DEV_MOCK === "1";
```

→ **NODE_ENV = development** または **NEXT_PUBLIC_BLOOM_DEV_MOCK="1"** で発動。BloomGate の dev バイパス（`process.env.NODE_ENV === "development"`）と同一条件、整合維持（memory `project_bloom_auth_independence.md` 一致）。

### Mock 値
```ts
const DEV_MOCK_USER: BloomUser = {
  user_id: "dev-shoji",
  employee_id: "EMP-DEV",
  employee_number: "0001",
  name: "東海林 美琴",
  garden_role: "super_admin",
  birthday: null,
};
const DEV_MOCK_EMAIL = "shoji-dev@hyuaran.com";
```

### Provider 初期値
| state | 本番 | dev mock 有効時 |
|---|---|---|
| loading | true | **false** |
| isAuthenticated | false | **true** |
| hasPermission | false | **true** |
| isUnlocked | false | **true** |
| userEmail | null | **"shoji-dev@hyuaran.com"** |
| bloomUser | null | **DEV_MOCK_USER** |

### useEffect の refreshAuth スキップ
```ts
useEffect(() => {
  if (DEV_MOCK_ENABLED) return; // skip Supabase auth fetch in dev
  (async () => { try { await refreshAuth(); } finally { setLoading(false); } })();
}, [refreshAuth]);
```

## 確認手順 結果（本セッション curl + grep）

| URL | HTTP code | 補足検証 |
|---|---|---|
| /bloom/workboard | **200** ✅ | SSR HTML 内に "ユーザー情報を取得しています" **不在**、`<h2>🧭 Workboard</h2>` 描画 ✅ |
| /bloom/daily-report | **200** ✅ | "**東海林 美琴**" 出現（"未ログイン" 消失）✅ |
| /bloom/roadmap | **200** ✅ | 描画継続 |
| /bloom/monthly-digest | **200** ✅ | 描画継続 |

`tsc --noEmit` BloomStateContext 関連エラー: **0**。

## 5/8 デモ向け影響

| 環境 | Workboard / Daily Report / Roadmap / Monthly Digest |
|---|---|
| localhost (NODE_ENV=development) | **本体描画 ✅**（dev mock 自動発動） |
| Vercel 本番 (NODE_ENV=production) | 従来通り本番認証フロー（BloomGate 通過必要、未認証なら login 誘導） |

## 🟡 Vercel 本番で同等動作させたい場合（任意）

現状、Vercel 本番（garden-chi-ochre.vercel.app）は dev mock 無効のため Workboard 等で認証フロー要求。後道さんデモで Vercel 経由でも見せたい場合は、いずれか:

| # | 方法 | 効果 | 備考 |
|---|---|---|---|
| A | Vercel env に `NEXT_PUBLIC_BLOOM_DEV_MOCK=1` 追加 + redeploy | dev mock を本番でも発動 | 簡単、デモ後削除推奨 |
| B | 本番 Supabase で Bloom 認証 + bloom_users 整備 | 正規ルート | 工数大、5/8 まで間に合わない可能性 |

判断は a-main-013 / 東海林さん に委ねます。dispatch 上は localhost 動作必須のみだったため、本セッションでは A/B 判断 + 適用は実施せず（追加 dispatch を待機）。

## 期待される視覚動作（修正後 / 本番反映なし時）

| 画面 | localhost dev での見込み |
|---|---|
| Top | ✅ 完璧（変化なし）|
| Workboard | ✅ 認証通過 → API 呼出 → カンバン表示 |
| Roadmap | ✅ 認証通過 → データ取得（root_module_progress 接続なら 12 module）|
| Monthly Digest | ✅ 認証通過 → 「まだダイジェストがありません」明示 |
| CEO Status | ✅ 表示 OK（変化なし）|
| Daily Report | ✅ 認証通過 → 「東海林 美琴」表示 + 関連ページ案内 |
| /bloom/progress | ✅ supabase 実データ表示（変化なし）|

## legacy 保持ファイル一覧（削除禁止）
- src/app/bloom/_state/BloomStateContext.legacy-20260507-dev-mock.tsx （新規）

（main- No. 41/42/44/45/48/50/56/58/60/61/77 で作成済 legacy 23 件も継続保持）

## 関連 dispatch
- main- No. 77（500 修正、commit `16fafa5` 完了済）
- main- No. 78（PR マージ + Vercel デプロイ、commit `30aa992` で main 反映済、X-Data-Source: mock 残課題）
- **main- No. 79（本書、BloomState dev mock 整備）** ← 本完了

## 完了時刻
2026-05-07(木) 15:08（受領 14:54 → 完了 15:08、所要 14 分）

a-bloom-003 待機中（次 bloom-003- No. 40、main- No. 80+ 待ち）
~~~
