# Garden 開発 known-pitfalls（既知の落とし穴）

本ドキュメントは §17 現場フィードバック運用ルールに基づく、Garden 開発で発生・発見された既知のバグ・落とし穴を蓄積するナレッジベース。**新モジュール構築時・類似機能実装時の必読資料**。

- 初版作成: 2026-04-24（a-main セッション）
- 運用: 発見の都度、末尾に追記
- 関連ルール: §16 リリース前バグ確認、§17 現場フィードバック運用

---

## [#1] timestamptz カラムへの空文字 insert によるバグ

### 症状
- Insert / Update 時に `invalid input syntax for type timestamp with time zone: ""` エラー
- Supabase ダッシュボードや Route Handler 経由でレコード作成が失敗する
- クライアント側ではエラーメッセージが不親切でユーザーが原因を特定困難

### 根本原因
- フォームやバックエンドから送られる payload に `created_at: ""` / `updated_at: ""` など**空文字列**が混入
- PostgreSQL の timestamptz 型は空文字を受け付けず、型エラーになる
- DB 側で DEFAULT `now()` が設定されているカラムに、クライアント側が空値を明示送信してしまう

### 発見経緯
- commit `6f07eef` で最初に修正パターンが確立
- sanitize-payload.ts への横展開で複数モジュールにまたがる問題として確定
- 発見セッション: 初期構築フェーズ

### 修正 pattern
```typescript
// _lib/sanitize-payload.ts
export function sanitizePayload<T extends Record<string, unknown>>(
  payload: T,
  excludeKeys: string[] = ['created_at', 'updated_at', 'id']
): Partial<T> {
  const result = { ...payload };
  for (const key of excludeKeys) {
    delete (result as Record<string, unknown>)[key];
  }
  // 空文字列を未設定に正規化
  for (const [key, value] of Object.entries(result)) {
    if (value === '') {
      delete (result as Record<string, unknown>)[key];
    }
  }
  return result;
}
```

### 再発防止チェックリスト
- [ ] Insert payload 構築時、`created_at` / `updated_at` は含めず DB DEFAULT に任せる
- [ ] フォームから受け取った string 値の空文字を sanitize してから DB 投入
- [ ] timestamptz / date / timestamp 型のカラムは null 許容かつ DEFAULT `now()`
- [ ] 新規テーブル作成時、migration SQL で DEFAULT now() を明示
- [ ] Route Handler の payload validation に sanitize-payload を必ず挟む
- [ ] 型定義（TypeScript）で `created_at?: never` のように入力不可を表現

### 関連ファイル / spec
- `src/**/_lib/sanitize-payload.ts`
- commit: `6f07eef`
- 影響モジュール: Forest / Bud / Root（全モジュールで要監査）

---

## [#2] RLS 経由 Route Handler での anon Supabase クライアント流用バグ

### 症状
- **Bloom PDF 404 事件**: Route Handler で Supabase から決算書 PDF を取得しようとすると、RLS に阻まれて 404
- 認証済みユーザーでも取得できないケース発生
- 直感的な原因理解が困難（ブラウザ側と挙動異なる）

### 根本原因
- Route Handler（サーバーサイド）で anon key の Supabase クライアントを流用していた
- anon クライアントには `auth.uid()` が付与されないため、**RLS ポリシーの「自分のデータ」判定が常に false**
- クライアントコンポーネント経由では JWT が自動付与されるが、Route Handler では手動対応必要

### 発見経緯
- PR #17（Bloom PDF エンドポイント実装時）で発覚
- 決算書 PDF 取得エンドポイントで認証ユーザーが 404
- A2案「JWT 転送」パターンで修正確定
- 発見セッション: a-bloom

### 修正 pattern
```typescript
// Route Handler (app/api/xxx/route.ts) の正しいパターン

import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  // NG: anon クライアントをそのまま使用すると RLS で自分のデータも読めない
  // const supabase = createClient(url, anonKey);

  // OK パターン A: JWT 転送（認証ユーザーのコンテキストを引き継ぐ）
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 });
  }
  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  // OK パターン B: service_role key（RLS 迂回、慎重に使用）
  // const supabase = createClient(url, serviceRoleKey);
  // service_role は RLS 無視するので、Route Handler 内で権限チェック必須

  const { data, error } = await supabase.from('xxx').select();
  // ...
}
```

### 再発防止チェックリスト
- [ ] 全 Route Handler で Supabase クライアント生成方式を監査
- [ ] anon + JWT転送 or service_role + 手動権限チェックのいずれか明示
- [ ] RLS が効くテーブルへのアクセスは JWT 転送を第一選択
- [ ] service_role 使用時は必ずロール判定（admin 以上等）をコード内で実施
- [ ] クライアントから `Authorization: Bearer <jwt>` を送る契約を明文化
- [ ] 新規 Route Handler 作成時、本ドキュメント参照を必須化

### 関連ファイル / spec
- PR #17（Bloom PDF エンドポイント）
- `src/app/api/**/route.ts` 全般（要監査）
- `src/lib/supabase/server.ts`（サーバー向けヘルパー、集約推奨）
- §13 禁止事項「Supabase 本番データへの書き込み」に関連
- 関連: `docs/specs/2026-04-24-bloom-workboard-scaffold.md` §8 Auth

### 2.6 UI 行オブジェクトの初期値 `created_at: ""` を upsert に流して Postgres が拒否
- **症状**: 新規作成時に `invalid input syntax for type timestamp with time zone: ""` で upsert 失敗
- **原因**: `emptyX()` ファクトリが型を満たすため `created_at: ""` / `updated_at: ""` を入れ、その値がそのまま payload として Postgres に送られる。`timestamptz NOT NULL DEFAULT now()` 列は空文字を受理できない
- **予防**:
  - Insert/Upsert payload から `created_at` / `updated_at` は**常に除外**し、DB の `DEFAULT now()` と `trg_*_updated_at` トリガに任せる
  - 共通サニタイザ `src/app/root/_lib/sanitize-payload.ts` の `sanitizeUpsertPayload` を各マスタ handleSave で必ず噛ませる
  - nullable date 列（例: `termination_date`, `effective_to`）も `NULLABLE_DATE_KEYS` に登録して空文字 → undefined 変換
  - 新マスタ追加時: `NULLABLE_DATE_KEYS` への追記と handleSave 内の sanitize 適用を PR チェックリストに含める
- **対処**: Root では PR #15 / commit `6f07eef` で KoT 側のみ個別対応、Phase A-3-f で 7 マスタ + KotSyncModal を共通 helper に統合。他モジュールでマスタ追加する場合は同パターンを採用する
- **波及**: 発見は Root Phase A-2 の §16 テストで。Bud / Leaf で同様の「空文字を timestamptz に流す」フォームを書かない

---

## [#3] 空オブジェクト insert バグ（emptyCompany / emptySystem 系）

### 症状
- 新規作成フォームで「空のまま送信」「部分入力で送信」した際、ほぼ空の payload が DB に insert される
- NOT NULL 制約違反、CHECK 制約違反でエラー
- または、**空レコードが入ってしまい、データ汚染**

### 根本原因
- フォームの初期 state が `emptyCompany: {}` / `emptySystem: {}` のような**空オブジェクト**
- ユーザーが何も入力せずに送信ボタンを押すと、空 payload が submit される
- クライアント側 validation が不十分で、空 payload が Route Handler に到達
- DB 側で NOT NULL 制約があれば失敗するが、緩い設計だと空レコード作成の恐れ

### 発見経緯
- Root 7マスタ実装時、法人マスタ新規作成 UI で発覚
- 他のマスタ（銀行口座 / 取引先 / 従業員）でも同パターン検出
- 発見セッション: a-root（Root Phase A 実装時）

### 修正 pattern
```typescript
// _lib/is-empty-payload.ts
export function isEmptyPayload(
  payload: Record<string, unknown>,
  requiredKeys: string[]
): boolean {
  return requiredKeys.some((key) => {
    const value = payload[key];
    return value === null || value === undefined || value === '';
  });
}

// 使用例：法人マスタ新規作成
const REQUIRED_COMPANY_FIELDS = ['company_name', 'company_name_kana', 'representative'];

function handleSubmit(payload: CompanyPayload) {
  if (isEmptyPayload(payload, REQUIRED_COMPANY_FIELDS)) {
    toast.error('必須項目が未入力です: ' + REQUIRED_COMPANY_FIELDS.join(', '));
    return;
  }
  // 実際の insert 処理
}
```

### 再発防止チェックリスト
- [ ] 新規作成 UI には必ず必須フィールド一覧を定義（`REQUIRED_*_FIELDS` 定数）
- [ ] クライアント側で submit 前に `isEmptyPayload` で検証
- [ ] Route Handler でも二重チェック（クライアント検証を信用しない）
- [ ] DB 側に NOT NULL 制約＋CHECK 制約で最終防衛
- [ ] フォーム UI で必須マークを視覚的に明示（※ / 赤枠等）
- [ ] 初期 state 設計時、`null` or 明示的な placeholder を使い、`{}` は避ける

### 関連ファイル / spec
- `src/**/_lib/is-empty-payload.ts`
- Root 関連: `src/app/root/companies/`、`src/app/root/employees/` 等
- 影響モジュール: Root / Bud / Leaf（CRUD UIを持つ全モジュール）

---

## [#4] KoT API IP 制限（事務所 IP のみ許可）

### 症状
- 自宅 / モバイル / Vercel から KoT API を叩くと 403 (HTTP) で `errors[].code = 105`（rate limit と同コードに見えるが原因が違う）

### 根本原因
- KoT API は契約 IP のみ許可。Vercel は動的 IP のため未登録。自宅 IP も登録外。事務所固定 IP のみ許可登録済（Issue #30 参照）

### 発見経緯
- PR #15 マージ後、Vercel preview から /api/root/kot-sync/cron-monthly を curl で叩いて 403 を観測。Issue #30 で対策案 A (Vercel IP 範囲) / B (Fixie 固定 IP プロキシ) / C (Supabase Edge Function) を比較し、案 B（Fixie）採択
- 発見セッション: a-root

### 修正 pattern
```typescript
// src/app/root/_lib/kot-api.ts (Fixie 契約後の予定実装)
import { ProxyAgent } from "undici";
const proxyUrl = process.env.FIXIE_URL;
const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
const res = await fetch(url, { method: "GET", headers, dispatcher } as RequestInit);
```

### 再発防止チェックリスト
- [ ] 開発時は事務所 IP からのみ実機 KoT API を叩く（自宅/モバイル禁止）
- [ ] Vercel デプロイ前に Fixie 固定 IP プロキシ設定を完了させる
- [ ] CRON_SECRET / FIXIE_URL を Vercel 環境変数に登録（KOT_API_TOKEN は別軸）
- [ ] `scripts/probe-kot.mjs` での実機確認は事務所 PC からのみ実行
- [ ] CI / preview 環境の KoT 系 e2e テストはスキップ（mock のみ）

### 関連ファイル / spec
- Issue #30 (KoT API IP 制限調査)
- `src/app/root/_lib/kot-api.ts` (TODO(A-3-c-followup) 参照)
- `scripts/probe-kot.mjs` (実機 probe スクリプト)
- 影響モジュール: Root のみ（KoT 連携は Root 専管）

---

## [#5] Vercel Cron + Fixie 前提（自宅・モバイル開発時の挙動）

### 症状
- ローカル `npm run dev` で /api/root/kot-sync/cron-* を叩くと、自宅 IP では 403 で失敗。CRON_SECRET 未設定時は `lib/cron-auth.ts` の verifyCronRequest が拒否

### 根本原因
- Vercel Cron は本番環境で `vercel.json` の `crons` 配列に登録された path を Vercel インフラ側から自動 POST する仕組み。Cron リクエストの認証は `Authorization: Bearer <CRON_SECRET>` ヘッダで行う
- 開発時は Vercel Cron がトリガしないため、手動 curl でテストするしかない
- 自宅 IP からだと KoT API そのものが叩けないため、Cron route 自体は動いても KoT 呼び出しで 403 になる
- 現状 `vercel.json` では `crons_pending_fixie_root` という未認識キーで保留中（Vercel が無視）。Fixie 契約完了後に `crons` 配列へ移動する

### 発見経緯
- A-3-c 実装時、Phase A-2 KoT API テストの再利用で発覚。事務所 PC から probe-kot.mjs では成功するが、自宅から同じテストが 403 で失敗
- 発見セッション: a-root

### 修正 pattern
```bash
# 事務所 PC（許可 IP）での Cron 動作確認
export CRON_SECRET=$(openssl rand -base64 48)
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/root/kot-sync/cron-daily

# 自宅 PC では mock を使う（KOT_API_TOKEN を未設定 or fake にする）
# fetch を vi.stubGlobal で mock するテスト経路のみ実行
npm run test:run -- src/app/root/_lib/__tests__/kot-api.test.ts
```

### 再発防止チェックリスト
- [ ] Cron route の本番動作確認は Vercel Preview デプロイ + 事務所 IP curl で実施
- [ ] 自宅作業時は実機 KoT 系の e2e は諦め、mock テストで担保
- [ ] `vercel.json` の `crons_pending_fixie_root` を `crons` に移すのは Fixie 契約完了後
- [ ] Cron route 実装時、CRON_SECRET 検証を必ず先頭で実施（verifyCronRequest 共通化）
- [ ] Vercel 環境変数 (CRON_SECRET / FIXIE_URL / KOT_API_TOKEN) のセットを必ず確認

### 関連ファイル / spec
- `vercel.json` (`crons_pending_fixie_root` 配列、Fixie 契約後に `crons` へ移動)
- `src/lib/cron-auth.ts` (verifyCronRequest 共通実装)
- `src/app/api/root/kot-sync/cron-monthly/route.ts`
- `src/app/api/root/kot-sync/cron-daily/route.ts`
- 影響モジュール: Root（Cron 利用は Bloom にもあり、Bloom は別パターン）

---

## [#6] garden_role は PostgreSQL ENUM ではなく CHECK 制約

### 症状
- `garden_role` カラムに新しいロール (例: `outsource`) を追加しようとして `ALTER TYPE ... ADD VALUE` を試みると、そんな型は存在しないと言われる

### 根本原因
- `garden_role` は `text` カラム + `CHECK (garden_role IN ('toss', 'closer', 'cs', 'staff', 'outsource', 'manager', 'admin', 'super_admin'))` で実装されている（ENUM 型ではない）
- 設計初期に ENUM ではなく text + CHECK を選択した理由: ENUM の値追加は `ALTER TYPE ADD VALUE` がトランザクション内で使えない PostgreSQL の制約があり、migration 運用が複雑になる。CHECK ならトランザクション内で `ALTER TABLE DROP CONSTRAINT / ADD CONSTRAINT` で原子的に変更可能
- TypeScript 側は `GardenRole` union 型で同期管理（`src/app/root/_constants/types.ts`）

### 発見経緯
- A-3-g で outsource ロール追加時、最初 ENUM だと思い込んで ALTER TYPE を書いて失敗。実際は CHECK 制約だった。supabase/migrations/20260425000002_root_employees_outsource_extension.sql で `DROP CONSTRAINT root_employees_garden_role_check` → `ADD CONSTRAINT ... CHECK (garden_role IN (...))` のパターンに修正
- 発見セッション: a-root

### 修正 pattern
```sql
-- supabase/migrations/2026MMDD_add_garden_role_NEWROLE.sql
BEGIN;

ALTER TABLE root_employees DROP CONSTRAINT IF EXISTS root_employees_garden_role_check;

ALTER TABLE root_employees
  ADD CONSTRAINT root_employees_garden_role_check
  CHECK (garden_role IN ('toss', 'closer', 'cs', 'staff', 'outsource', 'newrole', 'manager', 'admin', 'super_admin'));

-- garden_role を参照する関数の更新も忘れずに
-- 例: garden_role_of() の戻り値型は text のままでよいが、CASE 文で新ロールを処理する関数は更新

COMMIT;
```
そして TypeScript 側:
```typescript
// src/app/root/_constants/types.ts
export type GardenRole =
  | "toss" | "closer" | "cs" | "staff"
  | "outsource"  // staff と manager の間
  | "newrole"    // ★追加
  | "manager" | "admin" | "super_admin";

export const GARDEN_ROLE_ORDER: GardenRole[] = [
  "toss", "closer", "cs", "staff", "outsource", "newrole", "manager", "admin", "super_admin",
];

export const GARDEN_ROLE_LABELS: Record<GardenRole, string> = {
  // ... 既存 ...
  newrole: "新ロール",
};
```

### 再発防止チェックリスト
- [ ] 新ロール追加時、PostgreSQL 側は CHECK 制約の DROP / ADD で対応（ALTER TYPE は使わない）
- [ ] 同 migration で `GARDEN_ROLE_ORDER` と `GARDEN_ROLE_LABELS` を TypeScript 側で同時更新
- [ ] `ROOT_VIEW_ROLES` / `ROOT_WRITE_ROLES` / `TREE_CONFIRM_VIEW_ROLES` も新ロールの位置によって見直し
- [ ] garden-role.matrix.test.ts の `EXPECTED_HIERARCHY` も更新
- [ ] `is_user_active()` / `garden_role_of()` 関数で新ロールを参照している箇所がないか確認

### 関連ファイル / spec
- `supabase/migrations/20260425000002_root_employees_outsource_extension.sql` (CHECK 制約パターン参考)
- `src/app/root/_constants/types.ts` (GARDEN_ROLE_* 定義)
- `src/app/root/_constants/__tests__/garden-role.matrix.test.ts` (EXPECTED_HIERARCHY)
- 影響モジュール: Root（マスタ）/ Tree / Bud / Leaf（権限参照）

---

## [#7] KoT /monthly-workings の date 形式は YYYY-MM 必須（YYYY-MM-DD は HTTP 400）

### 症状
- `fetch("https://api.kingtime.jp/v1.0/monthly-workings/2026-04-25")` → HTTP 400 + KoT エラーコード 2 (`"date format invalid"` 相当)

### 根本原因
- `/monthly-workings/{date}` の `{date}` は **`YYYY-MM` (月単位)** を期待する
- 一方 `/daily-workings/{date}` は **`YYYY-MM-DD` (日単位)** を期待する
- `/employees?date={date}` も日単位 `YYYY-MM-DD`
- エンドポイントごとに date 形式が違うため、混同しやすい

### 発見経緯
- Phase A-2 実機テスト時、月次同期で誤って YYYY-MM-DD を渡して 400 で失敗。`fetchKotMonthlyWorkings("2026-04-25")` がエラーを投げる前に KoT 側で受信されてエラーレスポンス
- 発見セッション: a-root

### 修正 pattern
```typescript
// src/app/root/_lib/kot-api.ts
export async function fetchKotMonthlyWorkings(yearMonth: string): Promise<KotMonthlyWorking[]> {
  // ★ クライアント側で先に validation: YYYY-MM のみ受理
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth)) {
    throw new KotApiClientError({
      code: "INVALID_ARG",
      httpStatus: 0,
      message: `yearMonth は YYYY-MM 形式で指定してください（受け取り: "${yearMonth}"）`,
    });
  }
  return kotFetch<KotMonthlyWorking[]>(`/monthly-workings/${yearMonth}`);
}

// fetchKotDailyWorkings は YYYY-MM-DD でバリデーション
export async function fetchKotDailyWorkings(date: string): Promise<KotDailyWorking[]> {
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date)) {
    throw new KotApiClientError({ code: "INVALID_ARG", httpStatus: 0, message: `date は YYYY-MM-DD 形式で指定してください（受け取り: "${date}"）` });
  }
  return kotFetch<KotDailyWorking[]>(`/daily-workings/${date}`);
}
```

### 再発防止チェックリスト
- [ ] KoT エンドポイント実装時、必ず公式 doc で date 形式を確認（月次/日次/従業員で異なる）
- [ ] クライアント関数の引数バリデーションを実装（INVALID_ARG エラーで早期検出）
- [ ] テストで「不正な date 形式 → fetch 呼ばれず INVALID_ARG」を確認（kot-api.test.ts 参照）
- [ ] スクリプト経由の手動 probe 時も、引数の形式を間違えないよう型 / コメントで明示
- [ ] 新 KoT エンドポイント追加時は本ピットフォール参照

### 関連ファイル / spec
- `src/app/root/_lib/kot-api.ts` (fetchKotMonthlyWorkings / fetchKotDailyWorkings / fetchKotEmployees)
- `src/app/root/_lib/__tests__/kot-api.test.ts` (date format validation テスト)
- `scripts/probe-kot.mjs` (手動 probe)
- 影響モジュール: Root のみ

---

## [#8] root_employees.deleted_at は is_active と別軸（中途退職者の年末調整対応）

### 症状
- 中途退職者の年末調整書類を作成する際、is_active=false にすると一覧から消えて参照できない。逆に is_active=true のまま残すと現役と区別がつかない

### 根本原因
- Phase A-3-h で `deleted_at timestamptz` を追加（論理削除フラグ）
- **is_active と deleted_at は別軸**:
  - `is_active = true / false`: 現在アクティブかどうか（業務での参照対象か）
  - `deleted_at = null / timestamptz`: レコード自体が論理削除されたか（DB 上の存在）
- 中途退職者の典型パターン:
  - `is_active = false` (退職済み、現業務では非対象)
  - `deleted_at = null` (年末調整・退職金計算等で参照したい)
  - `termination_date = '2026-MM-DD'` (退職日)
- 完全削除（個人情報の保管期限切れ等）の場合のみ `deleted_at` に値を入れて、業務クエリから完全に外す

### 発見経緯
- A-3-h 仕様策定時、Bud Phase B 給与計算 + 年末調整の要件整理で発覚。Bud から「中途退職者を給与計算対象には入れたくないが年末調整対象には残したい」要望。is_active だけでは表現できないため deleted_at を追加
- 発見セッション: a-root

### 修正 pattern
```sql
-- 現業務クエリ（給与計算等）: is_active = true のみ
SELECT * FROM root_employees
WHERE is_active = true
  AND deleted_at IS NULL;

-- 年末調整対象クエリ: is_active 問わず、deleted_at IS NULL のもの
SELECT * FROM root_employees
WHERE deleted_at IS NULL
  AND (is_active = true OR (termination_date IS NOT NULL AND termination_date >= '2026-01-01'));

-- is_user_active() 関数（Phase A-3-g）も deleted_at を考慮
CREATE OR REPLACE FUNCTION is_user_active() RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM root_employees
    WHERE user_id = auth.uid()
      AND is_active = true
      AND deleted_at IS NULL
      AND (termination_date IS NULL OR termination_date >= CURRENT_DATE)
      AND (contract_end_on IS NULL OR contract_end_on >= CURRENT_DATE)
  )
$$ LANGUAGE sql STABLE;
```

### 再発防止チェックリスト
- [ ] 従業員クエリを書く時、`is_active` と `deleted_at` の両方を意識する
- [ ] 給与計算 / 業務一覧: `is_active = true AND deleted_at IS NULL`
- [ ] 年末調整 / 履歴参照: `deleted_at IS NULL`（is_active 問わず）
- [ ] 完全削除（個人情報保管期限切れ等）のみ `deleted_at` に値を設定
- [ ] Bud 給与モジュール / 年末調整モジュールで本パターンを必ず採用
- [ ] RLS ポリシーも `deleted_at IS NULL` を考慮（特に SELECT で論理削除済みを除外）

### 関連ファイル / spec
- `supabase/migrations/20260425000004_root_employees_payroll_extension.sql` (deleted_at 追加)
- `src/app/root/_lib/sanitize-payload.ts` の `NULLABLE_DATE_KEYS.employees` に `deleted_at` 含む
- 影響モジュール: Root（マスタ）/ Bud（給与・年末調整）

---

## [#9] SECURITY DEFINER 関数で SET search_path = '' 必須（schema poisoning 対策）

### 症状
- SECURITY DEFINER 関数を `SET search_path = ''` なしで定義すると、攻撃者が public schema を汚染した場合に関数の動作を乗っ取られる
- a-review がレビューで重大セキュリティ脆弱性として指摘
- 実例: Leaf A-1c PR #65 の 4 関数（`leaf_user_in_business` / `leaf_kanden_attachments_history_trigger` / `verify_image_download_password` / `set_image_download_password`）

### 根本原因
- PostgreSQL の SECURITY DEFINER 関数は **関数所有者（通常は postgres）の権限で実行される**
- search_path 未指定だと、呼出時の search_path（攻撃者制御可能）で名前解決される
- 攻撃者が public schema に同名の悪意ある関数 / テーブルを作成すると、SECURITY DEFINER 関数の中でそれが呼ばれてしまう
- 結果: 関数所有者の権限で攻撃者が任意コード実行 / データ書込 / 認証回避が可能

### 発見経緯
- 2026-04-26、a-review が Leaf PR #65（Task D.1 migration SQL）レビューで重大指摘
- commit `4247005` で 4 関数すべてに `SET search_path = ''` 追加 + public schema 明示修飾で修正
- 発見セッション: a-review、修正セッション: a-leaf

### 修正 pattern

```sql
-- ❌ NG（schema poisoning 脆弱）
CREATE OR REPLACE FUNCTION leaf_user_in_business(biz_id text)
RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM leaf_user_businesses WHERE user_id = auth.uid() AND business_id = biz_id);
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ✅ OK（v3.2 修正版）
CREATE OR REPLACE FUNCTION public.leaf_user_in_business(biz_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''                  -- 必須: 空 search_path で schema poisoning 防止
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leaf_user_businesses          -- public schema 明示修飾
    WHERE user_id = (SELECT auth.uid())                -- auth.uid() を SELECT で囲む
      AND business_id = biz_id
  );
$$;
```

### 修正のチェックポイント
- [ ] 全 SECURITY DEFINER 関数に `SET search_path = ''` を追加
- [ ] 参照する全テーブル / 関数を schema 明示（`public.X` / `extensions.crypt()` 等）
- [ ] `auth.uid()` は `(SELECT auth.uid())` で囲む（プランナの最適化のため）
- [ ] pgcrypto 関数は `extensions.crypt()` / `extensions.gen_salt()` と明示
- [ ] CREATE EXTENSION も `SCHEMA extensions` 明示推奨（Supabase 標準の配置先）

### 再発防止チェックリスト
- [ ] 新規 migration で SECURITY DEFINER 関数を作成する際、search_path = '' をテンプレに含める
- [ ] レビュー時、SECURITY DEFINER + search_path 未指定の組合せを必ずチェック
- [ ] 既存モジュール（Forest / Bud / Root / Soil 等）の SECURITY DEFINER 関数の監査

### 関連ファイル / spec
- Leaf: `scripts/leaf-schema-patch-a1c.sql`（commit `4247005`）
- spec: `docs/superpowers/specs/2026-04-23-leaf-a1c-attachment-design.md` v3.2（PR #130）
- 影響モジュール: 全モジュール（特に Forest / Soil の SECURITY DEFINER 関数を要監査）
- 参考: PostgreSQL 公式 - [Writing SECURITY DEFINER Functions Safely](https://www.postgresql.org/docs/current/sql-createfunction.html)

---

## [#10] クライアント側 hash 化は脆弱性、サーバ側 hash 化推奨

### 症状
- パスワード設定 UI で client が bcryptjs などで hash 化してサーバに送信する設計
- → 攻撃者が任意の hash を直接 RPC に送信して認証回避可能
- 実例: Leaf A-1c v3 の `set_image_download_password({ new_hash })` 設計

### 根本原因
- bcryptjs（client）→ hash 化 → サーバ送信 → DB 保存 のフロー
- サーバは送信された hash を「正しく hash 化されたもの」として信頼してしまう
- 攻撃者が任意のテキストを bcrypt 形式に偽装して送信すれば、認証時に偽装 hash が compare 対象になる
- 結果: 認証回避（事前に偽装 hash を仕込んでおいて compare で TRUE になる入力で通す）

### 発見経緯
- 2026-04-26、a-review が Leaf PR #65 レビューで重大指摘（#9 と同時）
- commit `4247005` で `set_image_download_password` 引数を `new_hash text` → `new_password text` に変更、サーバ側で hash 化に修正
- 発見セッション: a-review、修正セッション: a-leaf
- spec / plan v3.2 改訂で文書同期（PR #130）

### 修正 pattern

```typescript
// ❌ NG（クライアント側 hash 化、任意 hash 送信ルート）
import bcrypt from 'bcryptjs';
const hash = bcrypt.hashSync(newPassword, 12);
await supabase.rpc('set_password', { new_hash: hash });

// ✅ OK（サーバ側 hash 化）
// bcryptjs import 不要、平文を直送
await supabase.rpc('set_password', { new_password: newPassword });
```

```sql
-- ✅ サーバ側 RPC（v3.2 修正版）
CREATE OR REPLACE FUNCTION public.set_image_download_password(new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''                  -- #9 の修正もセット
AS $$
DECLARE
  new_hash text;
BEGIN
  IF public.garden_role_of((SELECT auth.uid())) != 'super_admin' THEN
    RAISE EXCEPTION 'Forbidden: super_admin only';
  END IF;
  -- サーバ側で bcrypt hash 化（任意 hash 送信ルート封殺）
  new_hash := extensions.crypt(new_password, extensions.gen_salt('bf', 12));
  INSERT INTO public.root_settings (key, value)
  VALUES ('xxx.password_hash', jsonb_build_object('hash', new_hash, ...))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END;
$$;
```

### 設計の注意点
- 平文を HTTPS で送信することは問題ない（HTTPS 経路保護で十分、bcrypt は経路保護とは別目的）
- bcrypt の本来の目的は「DB 漏洩時の rainbow table 攻撃防止」
- サーバ側で hash 化することで、任意 hash 送信攻撃を完全封殺

### 再発防止チェックリスト
- [ ] 新規パスワード設定 UI で **client が hash 化する設計を最初から避ける**
- [ ] RPC 引数は `new_password` / `password` のように平文受取で命名
- [ ] サーバ側 RPC 内で `extensions.crypt(pw, extensions.gen_salt('bf', 12))` で hash 化
- [ ] verify 系 RPC は `input_password` 平文受取で `crypt(input, stored_hash)` 比較（これは元々正しい設計）
- [ ] 既存モジュール（Root の通常パスワード等）の同様パターン監査

### 関連ファイル / spec
- Leaf: `scripts/leaf-schema-patch-a1c.sql`（commit `4247005`）
- spec: PR #130 §3.5.5 / §4.2 / §5 / Task A.7
- 影響モジュール: 全モジュール（パスワード機能を持つ全機能）

---

## [#11] GitHub GraphQL の ghost PR 衝突（`-pr` サフィックス迂回）

### 症状
- 過去に発行されて削除（or merge）された PR の branch 名で `gh pr create` すると `GraphQL: A pull request already exists for Hyuaran:<branch>` エラー
- 一方、`gh pr list --search`、`gh api repos/.../pulls` では該当 PR が見つからない
- 実例: Leaf `feature/leaf-future-extensions-spec` ブランチで PR 発行不可

### 根本原因
- GitHub GraphQL の内部状態で、過去に発行された PR の branch 名がキャッシュ / メタデータとして残っている可能性
- `git fetch --prune` でローカル ref を更新しても解消しない
- REST API レベルでは見つからないため、UI / API ベースのデバッグが困難

### 発見経緯
- 2026-05-07、Leaf future-extensions-spec の PR 発行で衝突
- 過去の同名 branch との関連性は推定段階（明確な再現手順は未確定）
- 発見セッション: a-leaf-002

### 修正 pattern（迂回策）

```bash
# 元 branch から同一 commit を新 branch 名で push（-pr サフィックス追加）
git push origin feature/<old-branch>:feature/<old-branch>-pr

# 新 branch から PR 発行
gh pr create --base develop --head feature/<old-branch>-pr ...
```

PR タイトル / body には「ghost PR 衝突回避のため `-pr` サフィックス追加、内容は元 branch と同一の commit」と注記推奨。

### 既存事例
- Leaf 内部で同パターン採用済（handoff より）:
  - `feature/leaf-a1c-task-d1-pr`（旧 `feature/leaf-a1c-task-d1-migration` の `git push -f` 不可回避）
  - `feature/leaf-a1c-task-d2-pr`（旧 `feature/leaf-a1c-task-d2-supabase-client`）
  - `feature/leaf-a1c-task-d4-pr`（旧 `feature/leaf-a1c-task-d4-storage-paths`）
  - `feature/leaf-future-extensions-spec-pr`（2026-05-07 新規、本 pitfall の事例）

### 再発防止チェックリスト
- [ ] 同一目的で複数 branch を push する場合、最初から `-pr` サフィックス採用 or `feature/<task>-v2` のような version 命名
- [ ] PR 発行で「PR exists」エラー時、即 GitHub UI / API で確認 → 不一致なら ghost PR と判定 → `-pr` 迂回採用
- [ ] commit 内容は元 branch と同一であることを PR 説明文で明示

### 関連ファイル / spec
- Leaf: `feature/leaf-future-extensions-spec-pr`（PR #131）
- 影響: 全モジュール（特に `git push -f` deny 回避で複数 branch を使うパターン）
- 参考: `.claude/settings.json` の `git push -f` deny rule（§13 自律実行モード制約）

---

## 今後の追加ルール

### 新しい pitfall 発見時の追記手順

1. **発見タイミング**：
   - 実装時のバグ遭遇
   - レビューで指摘された設計不備
   - 現場テストで発生した業務停止級の問題（§17 重大）
   - Chatwork フィードバック（§17 現場フィードバック運用）

2. **追記のフロー**：
   - 本ファイル末尾に新規 `[#N]` セクション追加（番号は連番）
   - テンプレート構造（症状 / 根本原因 / 発見経緯 / 修正 pattern / 再発防止 / 関連）を厳守
   - commit メッセージ: `docs: known-pitfalls.md に #N XXX を追加`
   - 該当 PR / commit hash を引用

3. **モジュール新規構築時の必読指示**：
   - **各モジュールの CLAUDE.md で本ファイルを "必読資料" として参照明記**
   - 新規モジュール着手前、a-main から本ファイル精読の指示を配布
   - 実装時、該当する pitfall がないか事前確認（例：timestamptz カラム扱う際は #1 を確認）

### 活用される場面

- **§16 リリース前バグ確認**：本ファイルに基づく最低限のテストケース作成
- **§17 現場フィードバック運用**：現場発生バグを本ファイルに蓄積して予防
- **新規モジュール実装**：類似パターンを事前回避（特に Soil / Bloom / Rill 着手時）
- **コードレビュー**：レビュアーが本ファイルのチェックリストを参照

### 関連ドキュメント

- §16 リリース前バグ確認ルール（親CLAUDE.md §16）
- §17 現場フィードバック運用ルール（親CLAUDE.md §17）
- 既存のモジュール別レビュー：
  - `C:\garden\a-tree\docs\tree-review-suggestions-20260424.md`
  - `C:\garden\a-bud\docs\bud-review-suggestions-20260424.md`
  - `C:\garden\a-forest\docs\forest-review-suggestions-20260423.md`

---

## 変更履歴

| 日付 | 変更者 | 内容 |
|---|---|---|
| 2026-04-24 | a-main | 初版作成。#1 timestamptz 空文字、#2 RLS anon 流用、#3 空オブジェクト insert の3件を収録 |
| 2026-04-25 | a-root | #4 KoT IP制限 / #5 Vercel Cron+Fixie / #6 garden_role CHECK / #7 KoT date形式 / #8 deleted_at vs is_active の Root 知見 5 件追加 |
| 2026-05-07 | a-leaf-002 | #9 SECURITY DEFINER search_path / #10 クライアント側 hash 化脆弱性 / #11 GitHub ghost PR 衝突 の Leaf 知見 3 件追加（a-review #65 + a-main-013 全前倒し dispatch 由来）|
