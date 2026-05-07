# dispatch main- No. 79 — a-bloom-003 通知（BloomState dev mock 整備 緊急依頼 / Workboard 等の停滞解消）

> 起草: a-main-013
> 用途: a-bloom-003 へ「BloomState dev mock 整備」緊急依頼（Workboard / Roadmap 等が認証 pending で停滞）
> 番号: main- No. 79
> 起草時刻: 2026-05-07(木) 14:54
> 緊急度: 🔴 高（5/8 後道さんデモ前 必須、5/7 中希望）

---

## 投下用短文（東海林さんが a-bloom-003 にコピペ）

~~~
🔴 main- No. 79
【a-main-013 から a-bloom-003 への dispatch（BloomState dev mock 整備 緊急依頼）】
発信日時: 2026-05-07(木) 14:54

main- No. 77 / No. 78 並行で恐縮ですが、Chrome MCP 視覚確認で /bloom/workboard が
「ユーザー情報を取得しています...」のまま 10 秒以上停滞することが判明しました。

詳細・原因解析・修正方針は以下ファイル参照:
[docs/dispatch-main-no79-bloom-state-dev-mock-20260507.md](docs/dispatch-main-no79-bloom-state-dev-mock-20260507.md)

要点:
- network requests 9 件全て静的アセット = API 呼出 0 件 = BloomState 認証 pending で hooks 停止
- Top / CEO Status / Progress（claude.ai 起草テンプレ）は OK = 別経路で動作
- Workboard / Roadmap / Monthly Digest / Daily Report が BloomState 経由で停滞
- bloom-003- No. 36 の §残課題 5 件 のうち「BloomState dev mock 整備」が未着手 = 根本原因
- memory `project_bloom_auth_independence.md`「dev では BloomGate バイパス必須」と整合

修正方針（推奨）:
- BloomState の dev mode で東海林さんダミーユーザー（authenticated=true、role=admin）を
  即時返却する mock 整備
- これで page.tsx の loading state を抜けて API 呼出 → データ表示

優先度: 5/8 後道さんデモのキー画面の 1 つが Workboard。修正必須。
完了時 bloom-003- No. NN（次番号）で a-main-013 に報告お願いします。
~~~

---

## 1. 状況報告

### 1-1. Chrome MCP で 7 画面 視覚確認 実施結果（2026-05-07 14:50 頃）

| 画面 | URL | 状態 |
|---|---|---|
| Top | /bloom | ✅ 完璧（KPI 4 件 + ナビ + Today's Activity）|
| **Workboard** | /bloom/workboard | 🔴 **「ユーザー情報を取得しています...」のまま 10 秒以上停滞** |
| Roadmap | /bloom/roadmap | ⚠️ UI OK / データ 0%（M1-M8 タイムライン枠のみ）|
| Monthly Digest | /bloom/monthly-digest | ⚠️ 「まだダイジェストがありません」 |
| CEO Status | /bloom/ceo-status | ✅ 表示 OK（東海林さん：対応可能）|
| Daily Report | /bloom/daily-report | ⚠️ 「（未ログイン）」「準備中」 |
| **/bloom/progress** | /bloom/progress | ✅ **完璧**（claude.ai 起草テンプレ + supabase 実データ + 12 モジュール表示）|

### 1-2. Workboard 停滞の調査結果（network / console）

`window.location.reload()` 後の Chrome MCP read_network_requests:

```
1. /bloom/workboard (HTML)              200
2. /_next/static/css/app/layout.css      200
3. /_next/static/chunks/webpack.js       200
4. /_next/static/chunks/main-app.js      200
5. /_next/static/chunks/app-pages-internals.js  200
6. /_next/static/chunks/app/layout.js    200
7. /_next/static/chunks/app/bloom/layout.js     200
8. /_next/static/chunks/app/bloom/workboard/page.js  200
9. /favicon.ico                          200
```

**API 呼び出しが 1 つも走っていない**（/api/* なし）。

console messages: HMR connected と DevTools 案内のみ、エラー / 警告ゼロ。

### 1-3. 解釈

- 例外で停止しているのではなく、**BloomState の認証 pending state で hooks が API 呼出に進めない**
- Top / CEO Status / Progress が OK な理由: BloomState を経由しない実装 or Server Component
- Workboard / Roadmap / Monthly Digest / Daily Report が NG な理由: Client Component で BloomState を購読、loading=true で stuck

---

## 2. 根本原因（推定）

### 2-1. memory + bloom-003- No. 36 報告 との整合

memory `project_bloom_auth_independence.md`:
> Bloom は Forest と独立認証 / dev では BloomGate バイパス必須

bloom-003- No. 36 完了報告 §残課題 5 件:
> Phase A-2 統合 KPI ダッシュボード / Daily Report 本実装 / Bloom 認証 Forest 統合再設計 / **BloomState dev mock 整備** / 設計状況セクション実データ化 計 5 件

**「BloomState dev mock 整備」が未着手**で、認証 pending のまま loading state から抜けない。

### 2-2. 推定の実装パターン

```ts
// 推定: useBloomState() が pending を返す → page.tsx が loading 表示
const { user, loading } = useBloomState();
if (loading || !user) return <p>ユーザー情報を取得しています...</p>;
// 以降の API 呼出に到達しない
```

dev mock が無いと、`user` がいつまでも `null`（or pending）で、loading が解消されない。

---

## 3. 修正方針（推奨）

### 修正 A: BloomState の dev mode mock（最優先 / 15 分）

```ts
// src/app/bloom/_state/use-bloom-state.ts (推定パス)
export function useBloomState() {
  // dev でバイパス
  if (process.env.NODE_ENV === "development") {
    return {
      user: {
        id: "dev-shoji",
        name: "東海林美琴",
        email: "shoji-dev@hyuaran.com",
        role: "admin",
        is_active: true,
      },
      authenticated: true,
      loading: false,
    };
  }

  // 本番ロジック（既存実装）
  const { user, ... } = useSWR(...);
  return { user, authenticated: !!user, loading: !user && !error };
}
```

または、**初期 state を「即 mock 返却」にする** 形で対応。

### 修正 B: 各 page.tsx の loading 表示 改善（補強 / 5 分）

```ts
if (loading) {
  return (
    <div>
      <p>ユーザー情報を取得しています...</p>
      {process.env.NODE_ENV === "development" && (
        <p style={{ color: "red" }}>
          [DEV] BloomState mock 未整備の場合 5 秒以上 loading のまま。
          コンソールでエラーが出ていないか確認してください。
        </p>
      )}
    </div>
  );
}
```

### 修正 C: 環境変数で mock 制御（任意 / 5 分）

```ts
const useDevMock = process.env.NEXT_PUBLIC_BLOOM_DEV_MOCK === "1";
```

`.env.local` に `NEXT_PUBLIC_BLOOM_DEV_MOCK=1` 追加で意図的にバイパス可能に。

---

## 4. 5/8 デモ向け 優先度

| 優先 | 修正 | 所要 | 効果 |
|---|---|---|---|
| 🔴 必須 | A: dev mock 整備 | 15 分 | Workboard / Roadmap / Monthly Digest / Daily Report が動く |
| 🟡 推奨 | C: 環境変数制御 | 5 分 | 切替やすさ |
| 🟢 余裕あれば | B: loading 表示改善 | 5 分 | 停滞時のデバッグ性 |

**5/8 デモまでに最低 A** 適用希望。

---

## 5. 確認手順（修正後）

修正完了後、以下確認を a-bloom-003 で実施:

1. `npm run dev -- --port 3000` 起動
2. 各画面で停滞しないか確認:
   - http://localhost:3000/bloom/workboard
   - http://localhost:3000/bloom/roadmap
   - http://localhost:3000/bloom/monthly-digest
   - http://localhost:3000/bloom/daily-report
3. 「ユーザー情報を取得しています...」が消え、各画面の本体が表示されるか
4. /bloom/daily-report の「（未ログイン）」が「東海林美琴」等になるか
5. ヘッダー右の「東海林ステータス 読込中…」が「対応可能」等になるか

---

## 6. 5/8 デモ運用（修正後の見込み）

| 画面 | 修正後の見込み | デモ可否 |
|---|---|---|
| Top | ✅ 完璧（変化なし）| ◎ |
| Workboard | ✅ 認証通過 → API 呼出 → カンバン表示 | ◎ |
| Roadmap | ✅ 認証通過 → データ取得（テーブル未作成なら 0% 継続）| △ → ○ |
| Monthly Digest | ✅ 認証通過 → 「まだダイジェストがありません」明示 | ○ |
| CEO Status | ✅ 表示 OK（変化なし）| ○ |
| Daily Report | ✅ 認証通過 → 「東海林さん」表示 + 関連ページ案内 | ○ |
| /bloom/progress | ✅ supabase 実データ表示（変化なし）| ◎ |

---

## 7. 関連 dispatch

- main- No. 77（500 修正、a-bloom-003 完了済 commit `16fafa5`）
- main- No. 78（PR マージ + Vercel デプロイ、a-bloom-003 進行中）
- **main- No. 79（本書、BloomState dev mock 整備）** 🆕

3 件並行進行中。完了報告は別々で OK（独立タスク）。

---

## 8. 旧コード保持ルール

CLAUDE.md「コードリプレース時の旧版データ保持」厳守:
- BloomState の修正前コードを `use-bloom-state.legacy-20260507.ts` 等で残す
- legacy ファイル一覧は bloom-003 リポジトリの既存 22 件に追加

---

ご確認・着手お願いします。判断保留事項あれば即停止 → a-main-013 経由で東海林さんに確認依頼。
