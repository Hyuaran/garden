# a-bloom-002 dispatch v7 V7-F - post-5/5 動的データ反映計画 - 2026-04-27

> 起草: a-main-009
> 用途: 5/5 後道さんデモ後の本番化、モック値 → 実 API 連携への切替
> 前提: V7-A〜V7-E 完走、5/5 デモは ChatGPT v4 画像 overlay モードで実施

## V7-F の対象（post-5/5 タスク）

V7-D で v4 画像背景 overlay モード（A 案）に切替後、未対応の動的化要素:

| # | 項目 | 対応内容 | 工数 | 優先度 |
|---|---|---|---|---|
| 1 | **KPI 実 API 連携** | 売上 / 入金予定 / 架電 / 未処理タスク のモック値 → Bud / Tree / Bloom / Forest 実 API | 1d | 🔴 高 |
| 2 | **Today's Activity 実データ** | bloom_notifications テーブルから 5 件取得（Bloom Cron 3 連携）| 0.5d | 🔴 高 |
| 3 | **天気 API 実装** | OpenWeatherMap API（東京）連携、AppHeader 表示 | 0.3d | 🟡 中 |
| 4 | **動的 user 名 / role 表示** | root_employees + Fruit 連携で AppHeader の名前 / 法人 / 役割を動的化 | 0.5d | 🔴 高 |
| 5 | **B 案 個別実装（v4 mode → CSS mode 切替）** | v4 画像背景 overlay → 既配置 12 個別アイコン + CSS で個別実装に置き換え | 0.7d | 🟡 中 |
| 6 | **/home route 整備** | 現在 `/` 利用中、`/home` route に正式移管 | 0.2d | 🟢 低 |
| 7 | **/login/forgot 実装** | パスワード忘れフロー（リンクのみ存在）| 0.5d | 🟡 中 |
| 8 | **partner_code lookup**（outsource role 動的 redirect）| /leaf/{partner_code} 動的解決、現在 hardcode | 0.3d | 🟡 中 |
| 9 | **Coming Soon ページ → 各モジュール実装**（Phase B/C 着手時）| Sprout / Fruit / Calendar (Phase B) → Soil / Seed (Phase C) → Rill (Phase 最後)| 各 1-2d | 後追い |

合計（V7-F 範囲、9 含めず）: **約 4d**（5/5 後 1 週間で完成可能）

## 投下タイミング

- 5/5 後道さんデモ完了 + 採用判定後
- 東海林さんから「post-5/5 開発再開」指示あり
- GitHub Team プラン課金完了 + push 復旧

## 投下短文（東海林さんが a-bloom-002 にコピペ、5/5 後）

```
【a-main-009 から a-bloom-002 へ】dispatch v7 V7-F - post-5/5 動的データ反映

▼ 経緯
5/5 後道さんデモ完了、Garden 採用ゲート通過。次は本番化（モック値 → 実 API）。

▼ 7 タスク（優先度順）

1. KPI 実 API 連携（Bud / Tree / Bloom / Forest 統合、1d）
2. Today's Activity 実データ（bloom_notifications + Cron 3、0.5d）
3. 動的 user 名 / role（root_employees + Fruit 連携、0.5d）
4. 天気 API（OpenWeatherMap、0.3d）
5. /login/forgot 実装（0.5d）
6. partner_code lookup（outsource 動的 redirect、0.3d）
7. /home route 整備（0.2d）

合計約 3.3d、5/5 後 1 週間で完成可能。

▼ 詳細 spec

`docs/bloom-002-dispatch-v7-f-post-5may-plan-20260427.md` 参照。

▼ 期待結果

- 静的 → 動的 (実データ表示)
- 後道さん 1 ヶ月使用後 FB → V7-G 改善 dispatch
- Phase B (Sprout / Fruit / Calendar) 着手前提条件整備
```

## 詳細 spec（a-bloom-002 が読む本文、5/5 後）

### Task 1: KPI 実 API 連携

**変更ファイル**: `src/app/_lib/kpi-fetchers.ts`（新規 or 拡張）

**API 連携先**:

| KPI | データソース | クエリ |
|---|---|---|
| 売上（今月）| Bud bud_statements | SUM(amount) WHERE type='income' AND month=current |
| 入金予定（今月）| Bud bud_transfers | SUM(amount) WHERE status='approved' AND scheduled_month=current |
| 架電状況（今日）| Tree tree_call_records | COUNT(*) / kpi_summary_for_bud view |
| 未処理タスク | Bloom workboard | COUNT(*) WHERE status='open' AND assignee=current_user |

**実装**:

```ts
export async function getKpiData(role: Role, userId: string): Promise<KpiData[]> {
  const supabase = await createServerClient();
  // 並列 fetch
  const [revenue, transfers, calls, tasks] = await Promise.all([
    supabase.from('bud_statements').select(...).gte('date', firstDayOfMonth),
    supabase.from('bud_transfers').select(...),
    supabase.from('tree_call_records').select(...),
    supabase.from('bloom_workboard').select(...),
  ]);
  return [/* マッピング */];
}
```

### Task 2: Today's Activity 実データ

**変更ファイル**: `src/app/_components/TodaysActivity.tsx`

**API 連携**:

```ts
const { data: activities } = await supabase
  .from('bloom_notifications')
  .select('id, occurred_at, title, detail, icon_module')
  .gte('occurred_at', startOfDay)
  .lte('occurred_at', endOfDay)
  .order('occurred_at', { ascending: false })
  .limit(5);
```

**Bloom Cron 3** との連携:
- 既実装の Cron 3（売上更新 / 入金通知 / タスク割当）が bloom_notifications に書き込み
- `/` ホームでリアルタイム取得

### Task 3: 動的 user 名 / role

**変更ファイル**: `src/app/_components/AppHeader.tsx`

**実装**:

```ts
const { data: { user } } = await supabase.auth.getUser();
const { data: employee } = await supabase
  .from('root_employees')
  .select('name, role, fruit:fruit_corporations(name_ja)')
  .eq('auth_user_id', user.id)
  .single();

// 表示
<div>{employee.name}</div>
<div>{employee.fruit.name_ja} / {roleToLabel(employee.role)}</div>
```

### Task 4: 天気 API

**変更ファイル**: `src/app/_components/AppHeader.tsx` + `src/app/api/weather/route.ts`（新規）

**API 連携**: OpenWeatherMap free tier（lat=35.689, lon=139.691 = 東京）

**実装**:

```ts
// /api/weather/route.ts
export async function GET() {
  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?lat=35.689&lon=139.691&appid=${process.env.OPENWEATHER_API_KEY}&units=metric&lang=ja`
  );
  const data = await res.json();
  return Response.json({ temp: data.main.temp, description: data.weather[0].description });
}
```

**環境変数追加**: `OPENWEATHER_API_KEY`（Vercel + .env.local）

### Task 5: /login/forgot 実装

**新規ファイル**: `src/app/login/forgot/page.tsx`

**フロー**:
1. メールアドレス入力（社員番号またはパートナーコード対応）
2. Supabase Auth Reset Password Email 送信
3. メール内リンクで /login/reset-password へ
4. 新パスワード設定 → /login へ redirect

### Task 6: partner_code lookup

**変更ファイル**: `src/app/_lib/auth-redirect.ts`

**実装**:

```ts
case 'outsource': {
  // 静的 hardcode 撤回
  // 旧: return '/leaf/kanden';
  // 新: root_partners から partner_code 解決
  const { data: partner } = await supabase
    .from('root_partners')
    .select('partner_code, leaf_route')
    .eq('auth_user_id', user.id)
    .single();
  return partner?.leaf_route ?? '/leaf/kanden'; // フォールバック
}
```

### Task 7: /home route 整備

**変更ファイル**: `src/app/page.tsx` → `src/app/home/page.tsx` に移管

**変更内容**:
- 現在 `/` でホーム表示 → `/home` に移管
- `/` は `redirect('/home')` のみ
- auth-redirect の home 先を `/home` に統一

### 完了基準（V7-F 全体）

- [ ] 全 7 task 実装完了
- [ ] 全テスト pass + TS / ESLint 0 errors
- [ ] localhost:3002 で東海林さん最終確認
- [ ] Vercel preview で動作確認
- [ ] develop merge → main reflect

## 改訂履歴

- 2026-04-27 初版（a-main-009、post-5/5 動的化計画、5/5 後採用判定後の本番化準備）
