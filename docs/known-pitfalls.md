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
