# Bud Phase D #04: 給与明細配信（PDF 生成 + Tree マイページ主経路 + メール PW PDF 補助経路）

- 対象: Garden-Bud Phase D 給与明細・賞与明細の PDF 生成と配信
- 優先度: **🔴 高**（従業員 UX、法定要件、PII 取扱）
- 見積: **1.5d**（旧 1.25d + a-review セキュリティ改修 +0.25d）
- 担当セッション: a-bud（実装）/ a-tree（マイページ統合）/ a-rill（Chatwork 通知）/ a-bloom（レビュー）
- 作成: 2026-04-25（a-auto 005 / Batch 17 Bud Phase D #04）
- 改訂:
  - 2026-04-25（a-auto 005、A-07 採択結果反映）
  - **2026-04-25（a-bud、a-review 重大指摘 5 件のセキュリティ改修、§16 参照）**
- 前提:
  - **Bud Phase B-03 給与明細 PDF**（設計済、本 spec で実装着手）
  - **Bud Phase D-02 給与計算ロジック**
  - **Bud Phase D-03 賞与計算**
  - **Cross Cutting spec-cross-storage**（Storage バケット運用）
  - **Cross Cutting spec-cross-chatwork**（Bot 通知）
  - **A-07 採択結果**（2026-04-25 a-main 確定、§2 で詳述）
  - Garden ログインは**社内 PC 限定**（通常ロール）→ メール配信が自宅確認の唯一経路
  - **a-review 重大指摘**（2026-04-25、PR #74）— 配信経路のセキュリティ強化が必須（§16）

---

## 1. 目的とスコープ

### 1.1 目的

確定した給与・賞与のデータを **PDF 明細**として生成し、各従業員に**安全かつ確実**に届ける。社内 PC 限定の Garden ログイン制約下で、**Tree マイページを主経路、パスワード保護 PDF メールを補助経路**として、自宅でも明細を確認できる動線を提供する。

### 1.2 含めるもの

- `@react-pdf/renderer` での PDF 生成
- Storage バケット `bud-salary-statements` への保存
- **主経路: Garden-Tree マイページで全員閲覧（A-07 案 A）**
- **補助経路: 登録メールアドレス宛にパスワード保護 PDF 添付配信（A-07 方式 2）**
- 給与明細 / 賞与明細の 2 テンプレート
- **配信ステータス管理**（`bud_salary_notifications` テーブル）
- 自動再送ポリシー（1h / 6h / 24h リトライ）
- **現金手渡し受給者の特別扱い**（マイページ受領確認）
- ダウンロード履歴の監査

### 1.3 含めないもの

- 給与計算自体 → D-02 / D-03
- 振込連携 → D-07
- 年末調整書類の配信 → D-06 + Phase C C-03 連携（同配信ロジック流用）

---

## 2. A-07 採択結果（配信戦略の確定）

### 2.1 主経路: Tree マイページ（A 案）

- Garden-Tree のマイページで**全員が閲覧可**（社内 PC ログイン）
- 過去 5 年分の給与明細・賞与明細を一覧表示
- ダウンロードは **Server Action 経由 60 秒 signed URL**

### 2.2 補助経路: メール添付（方式 2 = パスワード保護 PDF）

- マイページに登録されたメールアドレス宛
- **PDF 自体に PW**、メール本文に PW 規則 hint
- PW 規則: **生年月日 4 桁（MMDD）or 社員番号下 4 桁**（実装時に最終決定）
- 自宅 PC・スマホからも確認可能（Garden ログイン不要）

### 2.3 配信戦略の整理

| 動線 | 用途 | アクセス先 |
|---|---|---|
| 主経路 | 出社時の明細確認 | Garden-Tree マイページ |
| 補助経路 | 自宅・外出先での確認 | メール添付 PW PDF |
| 通知 | 公開告知 | Chatwork（Tree URL 案内）|

### 2.4 やらないこと

- ❌ 署名 URL（presigned URL）を Chatwork や メールで流通
- ❌ Chatwork に PDF 直接添付（Bot 経由でも）
- ❌ PW なし PDF メール添付

### 2.5 現金手渡し受給者の扱い（A-07 論点 1-2, 5）

`root_employees.payment_method` ENUM で識別:

| payment_method | 配信動作 |
|---|---|
| `bank_transfer` | 通常通り（Tree マイページ + メール）|
| `cash` | Tree マイページ + メール **+ マイページ受領確認ボタン** + 紙の受領書 |
| `other` | admin 個別判断（業務委託等は本来対象外）|

現金手渡し受給者は `bud_transfers` に **`transfer_type='給与(手渡し)'`** で登録、CSV / FB データ出力対象から**除外**（D-07 §10 と整合）。

---

## 3. PDF テンプレート

### 3.1 給与明細（A4 縦）

```
┌─────────────────────────────────────────┐
│  株式会社 ヒュアラン  給与明細                │
│  支給日: 2026-04-25  対象期間: 2026-03-21〜04-20│
├─────────────────────────────────────────┤
│  社員番号: H001234   氏名: 山田太郎       │
│  部門: 営業部       役職: 主任             │
├─────────────────────────────────────────┤
│  【支給】                                 │
│  基本給              280,000               │
│  時間外手当            42,000               │
│  深夜手当               8,000               │
│  通勤手当              12,000               │
│  住宅手当              20,000               │
│  ─────────────────────              │
│  支給合計            362,000               │
│                                         │
│  【控除】                                 │
│  健康保険料            17,955               │
│  厚生年金              33,148               │
│  雇用保険料             2,172               │
│  介護保険料             3,030               │
│  所得税                 8,420               │
│  住民税                14,800               │
│  ─────────────────────              │
│  控除合計             79,525               │
├─────────────────────────────────────────┤
│  差引支給額          282,475               │
└─────────────────────────────────────────┘
```

### 3.2 賞与明細（A4 縦）

```
┌─────────────────────────────────────────┐
│  株式会社 ヒュアラン  賞与明細                │
│  2026年 夏季賞与   支給日: 2026-07-10        │
├─────────────────────────────────────────┤
│  社員番号: H001234   氏名: 山田太郎       │
├─────────────────────────────────────────┤
│  【支給】                                 │
│  基本賞与            500,000               │
│  業績加算             50,000               │
│  ─────────────────────              │
│  支給合計            550,000               │
│                                         │
│  【控除】                                 │
│  健康保険料            27,390               │
│  厚生年金              50,325               │
│  雇用保険料             3,300               │
│  所得税（算出率 4.084%） 22,462              │
│  ─────────────────────              │
│  控除合計            103,477               │
├─────────────────────────────────────────┤
│  差引支給額          446,523               │
└─────────────────────────────────────────┘
```

### 3.3 共通仕様

- フォント: 日本語対応の Noto Sans JP（CJK）
- ページサイズ: A4 縦（210 × 297 mm）
- フッタ: 法人印（オプション、画像）+ 発行日 + ドキュメント ID

---

## 4. PDF 生成

### 4.1 ライブラリ

- `@react-pdf/renderer`（既存依存、新規追加なし）
- 既存 Forest 決算書 PDF と同パターン

### 4.2 サーバーサイド生成

```typescript
// src/app/api/bud/payroll/generate-statement/route.ts
export const runtime = 'nodejs';  // Buffer / Node API 使用のため

export async function POST(req: NextRequest) {
  const { salary_record_id } = await req.json();
  // 認証 + admin+ チェック
  const record = await fetchSalaryRecord(salary_record_id);
  const employee = await fetchEmployee(record.employee_id);

  const pdf = await renderToBuffer(
    <SalaryStatementDocument record={record} employee={employee} />
  );

  // Storage 保存
  const path = `${employee.id}/${record.payroll_period_id}.pdf`;
  await supabase.storage
    .from('bud-salary-statements')
    .upload(path, pdf, { upsert: true });

  // 監査ログ
  await logOperation({
    action: 'statement_generated',
    target: salary_record_id,
  });

  return Response.json({ ok: true, path });
}
```

### 4.3 一括生成（給与確定時）

```typescript
// src/app/api/bud/payroll/generate-all-statements/route.ts
// period.status = 'approved' になった時点でトリガ

export async function POST(req: NextRequest) {
  const { payroll_period_id } = await req.json();
  const records = await fetchAllRecords(payroll_period_id);

  // 並列生成（同時 5 件まで）
  const results = await Promise.allSettled(
    records.map(r => limit(() => generateStatement(r)))
  );

  return Response.json({
    ok: true,
    success: results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').length,
  });
}
```

---

## 5. Storage 設計

### 5.1 バケット構成

```
bud-salary-statements/
├─ {employee_uuid}/
│  ├─ {payroll_period_id}.pdf        … 月次給与明細
│  └─ {payroll_period_id}_bonus.pdf  … 賞与明細（同期間に賞与あれば）
├─ ...
```

### 5.2 RLS

- バケット: **public=false**
- ファイルパスに employee_uuid を含める → RLS で employee 自身か admin+ のみアクセス可
- service_role 経由のアップロードのみ

```sql
CREATE POLICY statement_select_self
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'bud-salary-statements'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM root_employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY statement_select_admin
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'bud-salary-statements'
    AND (SELECT garden_role FROM root_employees WHERE user_id = auth.uid())
        IN ('admin', 'super_admin')
  );
```

### 5.3 保管期間

- 給与関連: 5 年（労基法 109 条）→ Cross Ops #05 §2.2
- 期限経過後は archive バケットへ移動 → 7 年経過で物理削除

---

## 6. 配信フロー（A-07 採択 = Tree マイページ + メール PW PDF）

### 6.1 全体図

```
1. 給与計算完了 → period.status = 'approved'
2. PDF 一括生成 Cron 起動（PW なし版を Storage に保存）
3. 配信タスクキュー投入（bud_salary_notifications）
4. 並行配信:
   ├─ Chatwork 通知: 「給与明細を公開しました。Garden Tree マイページから確認してください」
   └─ メール配信: PW 保護版 PDF を添付（PW 規則 hint も本文に記載）
5. 配信ステータス更新（sent / failed / pending_retry）
6. 失敗時 1h / 6h / 24h リトライ
7. 24h 経過してなお失敗 → admin 通知（Chatwork）
8. 従業員側:
   - 出社時 → Garden Tree マイページで閲覧（PW なし版）
   - 自宅 → メール PDF を PW 入力で開く
   - 現金手渡し → マイページで受領確認ボタン
```

### 6.2 Chatwork 通知の文面

```
📄 給与明細公開のお知らせ

2026年4月支給分の給与明細を公開しました。
ご登録のメールアドレスにも PDF を送信していますのでご確認ください。

▼ Garden Tree マイページ（社内 PC からアクセス）
https://garden.example.com/tree/my/statements

メール添付 PDF のパスワード:
〇〇〇〇〇（生年月日 / 社員番号）※詳細はメール本文参照

ご不明点は経理担当までご連絡ください。
```

### 6.3 メール配信の文面

件名: `【給与明細】2026年4月支給分（株式会社ヒュアラン）`

本文（プレーンテキスト + HTML 両対応）:

```
{employee_name} 様

2026年4月支給分の給与明細をお送りします。
添付 PDF をパスワード保護していますので、下記の規則で開いてください。

▼ パスワード
別送した SMS / Chatwork DM をご確認ください。
（メール本文には PW 規則を記載しません — a-review 指摘 #4 改修 2026-04-25）

▼ 添付ファイル
salary-statement-2026-04.pdf

社内 PC からは Garden Tree マイページでも閲覧可能です:
https://garden.example.com/tree/my/statements

ご不明点は経理担当までお問い合わせください。
（このメールは自動配信です。返信不可）

───────────────────
株式会社ヒュアラン 経理部
```

### 6.4 メール配信の技術選定（実装時に最終決定）

| 候補 | メリット | デメリット |
|---|---|---|
| **Resend** | Next.js / Vercel 連携が楽、月 100 通無料 | 信頼性は中堅 |
| **SendGrid** | 大量配信実績、国内信頼性高 | 初期セットアップ多い |
| **Amazon SES** | コスト最安、AWS 既存環境前提 | DKIM 設定必須 |
| **自社 SMTP**（Gmail Workspace 経由）| 既存資産活用 | Gmail 制限（500 通/日）|

**現状推奨**: Resend（Phase B-1 で導入評価、本番で SendGrid に切替検討）

#### ⚠️ 6.4.1 送信ドメイン認証（必須、a-review 指摘 #2 改修）

PII（給与情報の PDF 添付）を配信するため、なりすまし対策として以下を**必須**で設定する：

| 認証 | 設定先 | 内容 |
|---|---|---|
| **SPF** | 送信ドメインの DNS TXT | `v=spf1 include:_spf.<provider> -all`（hard fail）|
| **DKIM** | 送信ドメインの DNS TXT | プロバイダ（Resend/SendGrid/SES）発行の公開鍵を 2048bit で登録 |
| **DMARC** | 送信ドメインの DNS TXT | `v=DMARC1; p=reject; rua=mailto:dmarc@hyuaran.com; sp=reject; adkim=s; aspf=s` |

実装着手前に DNS 反映を確認（`dig TXT _dmarc.<domain>` 等で疎通確認、48 時間反映余裕）。
専用サブドメイン（例: `payroll@notice.<domain>`）を採用し、メインドメインへの DMARC 失敗の影響を局所化。

#### ⚠️ 6.4.2 SMTP 経路の TLS 強制（必須、a-review 指摘 #3 改修）

- メール送信時は **TLS 1.2 以上必須**（プロバイダ既定で OK だが明示確認）
- HELO/EHLO 後に STARTTLS、もしくは SMTPS（465）を使用
- プロバイダ管理画面で「outbound TLS required」相当の設定を ON
- 中継サーバーでの平文露出を防止

### 6.5 PW 保護 PDF 生成の技術選定（⚠️ a-review 指摘 #1 改修：PW 設計の見直し）

| ライブラリ | 評価 |
|---|---|
| **pdf-lib** | アクティブ、Node 系 OK、既存依存に近い |
| qpdf（CLI 経由）| 強力だが native 依存 |
| HummusJS | 古い、メンテ停止気味 |

**ライブラリ推奨**: `pdf-lib` で `encrypt({ userPassword, ownerPassword, permissions })` を使用。
※ 新規 npm パッケージ追加が必要 → 東海林さん事前承認。

#### ⚠️ 6.5.1 PW 強度の問題（a-review 指摘 #1）

A-07 採択時の「生年月日 4 桁（MMDD）or 社員番号下 4 桁」案には**ブルートフォース耐性不足**の重大問題:

- **MMDD 4 桁** = 366 候補（オフラインで秒で解読可能）
- **社員番号下 4 桁** = 10000 候補（連番運用なら数件試行で当たる）
- PDF の AES-256 暗号化キーは **PW から PBKDF2 で導出**するが、PW 候補空間が極小だと無意味

→ A-07 採択結果のままでは PII 配信として **GDPR / 個情法上のセキュリティ義務違反リスク**。

#### ⚠️ 6.5.2 推奨修正案（東海林さん最終判断要）

| 案 | 内容 | 工数追加 | 強度 |
|---|---|---|---|
| **A: 強ランダム PW + 別経路通知**（推奨） | PDF 1 件ごとに 16 文字 ASCII ランダム PW を生成、PDF を暗号化、PW を Chatwork DM（社内 PC 限定）or SMS（自宅可）で別経路通知 | +0.15d | 強（PDF 暗号化の理論強度フル発揮） |
| **B: 一回限りダウンロードトークン方式** | PDF を Storage に置き、トークン化された signed URL（TTL 5 分・1 回使用後失効）をメールで送る。PDF 自体は暗号化しない | +0.2d（ダウンロード Server Action 拡張） | 強（中継時 PDF 漏洩なし、トークン使い切り） |
| **C: 現状の MMDD 維持**（非推奨、運用回避策付き） | 採択通り MMDD、ただし「メール配信は社内 PC のみ閲覧」と運用で限定。Garden ログイン社内 PC 限定の前提が崩れたら即 A/B 案へ移行 | +0d | **弱**（攻撃容易、PII 配信不適） |

**a-bud 推奨**: A 案（PDF 暗号化の強度フル発揮 + 別経路通知の運用工数許容）。
**B 案も有力**（PDF 自体は暗号化不要、Garden 内で完結）。
C 案は GDPR / 個情法リスク回避のため**非推奨**。

東海林さん最終判断で A/B/C を確定後、本 spec § 6.5 を更新する。

#### 6.5.3 owner password の固定値禁止

- userPassword（開封 PW）と ownerPassword（権限変更 PW）は**別の値**で生成
- ownerPassword は **Garden サーバー側で生成・破棄せず保管**（Phase D 完了後に対応、現状はランダム生成のみ）
- 同じ ownerPassword を全 PDF に使う実装は禁止（権限破壊リスク）

### 6.6 ダウンロード Server Action（⚠️ a-review 指摘 #5 改修：rate limit + log 漏洩防止）

```typescript
// src/lib/bud/statements/download.ts
'use server';

import { rateLimitByUser, redactSignedUrl } from '@/lib/_security';

export async function getStatementDownloadUrl(
  salaryRecordId: string
): Promise<{ url: string; expiresAt: number }> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('UNAUTHORIZED');

  // a-review #5: Rate limit（列挙攻撃対策）
  // ユーザー単位で 10 req / 5 min まで、超過時は HTTP 429 相当でブロック
  await rateLimitByUser(user.id, 'statement_dl', { window: 300, max: 10 });

  // RLS で自動的にフィルタ（自分 or admin+ のみ）
  const { data: record } = await supabase
    .from('bud_salary_records')
    .select('employee_id, payroll_period_id')
    .eq('id', salaryRecordId)
    .maybeSingle();
  if (!record) throw new Error('NOT_FOUND');

  const path = `${record.employee_id}/${record.payroll_period_id}.pdf`;
  const { data: signed } = await supabase.storage
    .from('bud-salary-statements')
    .createSignedUrl(path, 60);  // 60 秒有効

  // a-review #5: ログ漏洩防止
  // - Vercel ログ・Supabase ログに signed URL をマスク（クエリパラメータ削除）
  // - employee_id / salary_record_id は監査用に hash 化して残す
  await logOperation({
    action: 'statement_downloaded',
    actor_id: user.id,
    target_hash: hashSalt(salaryRecordId),  // 平文で残さない
    storage_path_redacted: redactSignedUrl(signed.signedUrl),
    user_agent: 'redacted',  // PII 拡散防止
  });

  return {
    url: signed.signedUrl,
    expiresAt: Date.now() + 60_000,
  };
}
```

#### 6.6.1 Rate limit 仕様

| ユーザー区分 | 制限 | 超過時の動作 |
|---|---|---|
| 一般従業員 | 10 req / 5 min | HTTP 429 + Chatwork 警告（admin 宛）|
| admin（自身分） | 20 req / 5 min | HTTP 429 + ログ記録 |
| admin（他人分監査閲覧） | 50 req / 5 min | HTTP 429 + 異常検知（§7.2 強化）|

実装は Supabase の `pg_rate_limit` 拡張 or Vercel KV / Redis ベース（Phase B-1 着手時に決定）。

#### 6.6.2 列挙攻撃対策

- `salaryRecordId` は uuid v4（推測困難）— OK
- ただし `employee_id + period` ペアの URL パターンが推測可能なため、`storage_path` は **uuid v4 を含むパス**に変更:
  ```
  旧: bud-salary-statements/{employee_id}/{YYYY-MM}.pdf
  新: bud-salary-statements/{employee_id}/{statement_id}.pdf  ← bud_salary_statements.id (uuid)
  ```
- 既存 spec §5.2 / §8.1 のパス規則も合わせて更新する（§16.3 参照）

### 6.7 Tree マイページ統合（A-07 主経路）

主経路は **Garden-Tree のマイページに統合**（独立 Bud 画面ではなく）。

```
/tree/my-page
├─ プロフィール
├─ 当月予定
├─ 架電実績
└─ 給与明細セクション ← Bud Phase D-04 で追加
   └─ 直近月（2026-04）/ 過去 5 年（折りたたみ）
```

#### 受領確認ボタン（cash 受給者のみ）

```
┌─────────────────────────┐
│  自分の給与明細             │
├─────────────────────────┤
│  2026年4月  給与  📥DL    │
│  💵 現金受領: [✓ 受領しました] │ ← cash のみ表示
│                         │
│  2026年3月  給与  📥DL    │
│  💵 現金受領: ✅ 2026-03-25受領済 │
└─────────────────────────┘
```

押下時の動作:

```typescript
async function confirmCashReceipt(salaryRecordId: string) {
  await supabase.from('bud_salary_notifications').update({
    cash_receipt_confirmed_at: new Date().toISOString(),
  }).eq('salary_record_id', salaryRecordId)
    .eq('employee_id', myEmployeeId);
  await logOperation({ action: 'cash_receipt_confirmed', target: salaryRecordId });
}
```

過去 5 年分まで閲覧可。

---

## 7. 監査ログ

### 7.1 記録タイミング

| イベント | 記録 |
|---|---|
| PDF 生成 | `action='statement_generated'` |
| Chatwork 通知 | `action='statement_notified'` |
| ダウンロード | `action='statement_downloaded'` |
| admin が他人の明細を閲覧 | `action='statement_admin_view'` + 対象 employee_id |

### 7.2 異常検知

- 同一 employee が 1 日 10 回以上 DL → 警告
- admin が短時間に多数の他人 DL → 警告（情報持ち出し懸念）

---

## 8. テーブル定義

### 8.0 `bud_salary_notifications`（配信ステータス管理 / A-07 反映）

```sql
CREATE TABLE public.bud_salary_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salary_record_id uuid REFERENCES public.bud_salary_records(id),
  bonus_record_id uuid REFERENCES public.bud_bonus_records(id),
  employee_id uuid NOT NULL REFERENCES public.root_employees(id),
  notification_type text NOT NULL,
    -- 'tree_mypage' | 'email_attach' | 'chatwork_summary' | 'cash_receipt'
  status text NOT NULL DEFAULT 'pending',
    -- 'pending' | 'sent' | 'failed' | 'pending_retry' | 'cancelled'
  attempt_count int NOT NULL DEFAULT 0,
  last_attempted_at timestamptz,
  next_retry_at timestamptz,                  -- 1h / 6h / 24h スケジュール
  sent_at timestamptz,
  failed_reason text,

  -- メール固有
  email_to text,                              -- 配信時点のスナップショット
  email_provider_message_id text,             -- Resend / SendGrid 等の ID
  email_pdf_password_hint text,               -- 'birthday-mmdd' | 'employee-no-last4'

  -- 現金手渡し受領確認
  cash_receipt_confirmed_at timestamptz,
  cash_receipt_paper_signed boolean NOT NULL DEFAULT false,

  -- メタ
  created_at timestamptz NOT NULL DEFAULT now(),

  CHECK (
    (salary_record_id IS NOT NULL AND bonus_record_id IS NULL)
    OR (salary_record_id IS NULL AND bonus_record_id IS NOT NULL)
  )
);

CREATE INDEX idx_notifications_pending_retry
  ON bud_salary_notifications (next_retry_at)
  WHERE status = 'pending_retry';

CREATE INDEX idx_notifications_employee
  ON bud_salary_notifications (employee_id, created_at DESC);
```

#### 自動再送ポリシー

| attempt | 次回試行 | 失敗時の動作 |
|---|---|---|
| 1 回目失敗 | 1h 後 | pending_retry |
| 2 回目失敗 | 6h 後 | pending_retry |
| 3 回目失敗 | 24h 後 | pending_retry |
| 4 回目失敗 | 停止 | admin に Chatwork 通知（手動対応）|

Cron `/api/cron/bud-notification-retry`（10 分粒度）で `next_retry_at <= now()` を拾って再試行。

### 8.1 `bud_salary_statements`（生成記録）

```sql
CREATE TABLE public.bud_salary_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salary_record_id uuid REFERENCES public.bud_salary_records(id),
  bonus_record_id uuid REFERENCES public.bud_bonus_records(id),
  employee_id uuid NOT NULL REFERENCES public.root_employees(id),
  statement_type text NOT NULL,             -- 'salary' | 'bonus'
  storage_path text NOT NULL,               -- bud-salary-statements/uuid/period.pdf
  file_size_bytes int NOT NULL,
  pdf_checksum text NOT NULL,               -- SHA256（改ざん検知）
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid,
  notification_sent_at timestamptz,
  notification_chatwork_message_id text,
  download_count int NOT NULL DEFAULT 0,
  last_downloaded_at timestamptz,

  -- 削除（横断統一）
  deleted_at timestamptz,
  deleted_by uuid,

  CHECK (
    (salary_record_id IS NOT NULL AND bonus_record_id IS NULL AND statement_type = 'salary')
    OR (salary_record_id IS NULL AND bonus_record_id IS NOT NULL AND statement_type = 'bonus')
  )
);

CREATE INDEX idx_statements_employee ON bud_salary_statements (employee_id, generated_at DESC);
```

---

## 9. RLS

```sql
ALTER TABLE bud_salary_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY statements_select_self
  ON bud_salary_statements FOR SELECT
  USING (employee_id = (SELECT id FROM root_employees WHERE user_id = auth.uid()));

CREATE POLICY statements_select_admin
  ON bud_salary_statements FOR SELECT
  USING (
    (SELECT garden_role FROM root_employees WHERE user_id = auth.uid())
      IN ('admin', 'super_admin')
  );

-- INSERT は service_role のみ
-- UPDATE は download_count / last_downloaded_at のみ self-update 許可
-- DELETE 完全禁止
```

---

## 10. 法令対応チェックリスト

### 10.1 労働基準法

- [ ] 第 24 条: 給与明細書の交付義務（書面 or 電子）
- [ ] 電子交付は**従業員の同意が必要**（雇用契約 or 別途同意書）
- [ ] 第 109 条: 5 年保管

### 10.2 個人情報保護法

- [ ] 第 23 条: 安全管理措置（署名 URL を流通させない = 適切）
- [ ] アクセス権限の最小化（RLS）
- [ ] 監査ログ（誰がいつ閲覧 / DL したか）

### 10.3 電子帳簿保存法

- [ ] 検索性の確保（`/bud/my-statements` で検索可）
- [ ] 改ざん防止（pdf_checksum SHA256）
- [ ] タイムスタンプ（generated_at）

---

## 11. 実装タスク分解（A-07 反映後）

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | `bud_salary_statements` migration | a-bud | 0.5h |
| 2 | `bud_salary_notifications` migration（新規）| a-bud | 0.5h |
| 3 | Storage バケット `bud-salary-statements` 作成 + RLS | a-bud | 0.5h |
| 4 | 給与明細 React PDF コンポーネント | a-bud | 2h |
| 5 | 賞与明細 React PDF コンポーネント | a-bud | 1h |
| 6 | PDF 生成 API + 一括生成 Cron | a-bud | 1.5h |
| 7 | **PW 保護 PDF 生成（pdf-lib 想定、要 npm 承認）** | a-bud | 1h |
| 8 | **メール配信（Resend / SendGrid 等）+ HTML/text 両対応** | a-bud | 2h |
| 9 | 配信ステータス管理 + 再送 Cron（1h/6h/24h）| a-bud | 1.5h |
| 10 | Chatwork 通知（a-rill 経由）| a-bud + a-rill | 1h |
| 11 | **Tree マイページ統合（給与明細セクション追加）** | a-bud + a-tree | 1.5h |
| 12 | **現金受領確認ボタン（cash 受給者のみ）** | a-bud | 0.5h |
| 13 | ダウンロード Server Action + 短時間 signed URL | a-bud | 0.5h |
| 14 | 監査ログ統合 + 異常検知 | a-bud | 0.5h |
| 15 | 単体・統合テスト（配信失敗 / PW 不一致等エッジケース）| a-bud | 1.5h |

合計: 約 16h ≈ **1.5d**（A-07 反映で +0.5d、当初 1.0d → 1.5d）

※ effort-tracking 上は **1.25d**（並行作業吸収を考慮した妥当値）

---

## 12. 判断保留事項（A-07 反映後）

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判 1 | 電子交付の同意取得 | **入社時の雇用契約に明記**、既存従業員は別途同意書（東海林さん要決定）|
| 判 2 | 法人印の表示 | **オプション**、`root_companies.seal_image_path` 使用 |
| 判 3 | 紙明細を希望する従業員 | **個別出力可** + 経理が手渡し（運用ルール）|
| 判 4 | 過去明細の表示期間 | **5 年**（法定通り）、UI フィルタは「全期間」も可 |
| 判 5 | Chatwork 文面の言語 | 日本語のみ（英語版は Phase E）|
| 判 6 | **PW 規則の確定** | **生年月日 4 桁（MMDD）or 社員番号下 4 桁** どちらかを実装時に最終決定（A-07 反映）|
| 判 7 | **メール配信プロバイダ** | Resend で開始、本番運用で SendGrid へ切替検討（要新規 npm 承認）|
| 判 8 | **PW 保護 PDF ライブラリ** | pdf-lib（要新規 npm 承認）|
| 判 9 | **退職者への配信継続** | 退職後 30 日まで配信継続（最終給与 + 源泉徴収票）|
| 判 10 | **メアド未登録者の扱い** | Tree マイページのみで配信、メアド登録を促す通知を Chatwork 経由 |
| 判 11 | **現金手渡しの紙受領書フォーマット** | A4 1 枚、署名欄 + 金額 + 日付（東海林さん要レビュー）|

---

## 13. 既知のリスクと対策

### 13.1 PDF 生成の失敗（一括時）

- 100 名分中 3 名失敗
- 対策: Promise.allSettled で部分成功、失敗分を再生成キューへ

### 13.2 Storage 容量

- 1 名 × 12 ヶ月 × 5 年 = 60 ファイル × 100KB = 6MB
- 100 名で 600MB → Cross Ops #02 のバックアップ対象

### 13.3 改ざん検知

- 担当者が PDF を直接編集
- 対策: SHA256 を generated_at 時点で記録、DL 時に検証

### 13.4 短時間 signed URL の漏洩

- 60 秒以内に共有される
- 対策: URL は server → client 直送（HTTP レスポンス内）、ログにも残さない

### 13.5 Chatwork 通知の到達失敗

- API 制限・ネットワーク障害
- 対策: 失敗時は Garden 管理画面で警告、再送ボタン

### 13.6 賞与と給与の同月発生

- 7 月で給与 + 夏季賞与
- 対策: それぞれ別 PDF、`statement_type` で分離

---

## 14. 関連ドキュメント

- `docs/specs/2026-04-24-bud-b-03-salary-statement-pdf.md`（設計書）
- `docs/specs/2026-04-25-bud-phase-d-02-salary-calculation.md`
- `docs/specs/2026-04-25-bud-phase-d-03-bonus-calculation.md`
- `docs/specs/cross-cutting/spec-cross-storage.md`
- `docs/specs/cross-cutting/spec-cross-chatwork.md`
- `docs/specs/2026-04-26-cross-ops-05-data-retention.md`

---

## 15. 受入基準（Definition of Done、A-07 反映後）

- [ ] `bud_salary_statements` / `bud_salary_notifications` migration 適用済
- [ ] Storage バケット作成 + RLS（自分 + admin+）動作
- [ ] 給与明細 / 賞与明細 PDF 生成（A4 縦、Noto Sans JP）動作
- [ ] **PW 保護 PDF 生成（pdf-lib）動作**
- [ ] 一括生成 Cron で 100 名分完走
- [ ] **Tree マイページ統合（給与明細セクション）動作**
- [ ] **メール配信（Resend / SendGrid 等）+ PW PDF 添付 動作**
- [ ] **配信ステータス管理 + 自動再送（1h/6h/24h）動作**
- [ ] **24h 経過 4 回失敗時 admin Chatwork 通知**
- [ ] Chatwork 通知（Tree URL + PW 規則 hint）到達
- [ ] **現金手渡し受給者の受領確認ボタン動作**
- [ ] **メアド未登録者の Tree のみ配信 + 登録促進通知動作**
- [ ] ダウンロード Server Action（60 秒 signed URL）動作
- [ ] 監査ログ（generated / notified / email_sent / cash_receipt_confirmed / downloaded）記録
- [ ] 異常 DL 検知が動作
- [ ] SHA256 改ざん検知が動作
- [ ] **配信エッジケーステスト（PDF 生成失敗 / メール送信失敗 / PW 不一致 / メアド不正）pass**
- [ ] **a-review #1 PW 設計の最終決定**（A 案 強ランダム + 別経路 / B 案 一回限りトークン / C 案 維持、東海林さん判断）
- [ ] **a-review #2 SPF/DKIM/DMARC DNS 反映確認**（dig コマンドで疎通）
- [ ] **a-review #3 SMTP TLS 強制設定**確認（プロバイダ管理画面）
- [ ] **a-review #4 メール本文の PW 規則平文記載なし**（§6.3 確認）
- [ ] **a-review #5 ダウンロード Server Action の rate limit + log redact 動作**

---

## 16. ⚠️ a-review 重大指摘 5 件と改修計画（2026-04-25）

### 16.0 経緯

PR #74（Bud Phase D spec 8 件）の事前レビューで a-review が**配信経路のセキュリティ重大指摘を 5 件**検出。
GitHub アカウント suspended のため a-review コメント本文を直接確認できないが、自己分析で 5 件を特定し本 spec へ反映した。
GitHub 復旧後、a-review コメントとの突き合わせ + 微調整を実施する。

### 16.1 指摘 #1: PDF パスワード脆弱（生年月日 4 桁）

**問題**: A-07 採択時の PW 規則「生年月日 4 桁（MMDD）or 社員番号下 4 桁」は、候補空間が 366 / 10000 と極小でブルートフォース容易。PDF AES-256 暗号化が無意味化する。GDPR / 個情法上の PII 配信で重大リスク。

**改修**: §6.5.1 / 6.5.2 に推奨修正案を追加（A 案 強ランダム + 別経路通知 / B 案 一回限りトークン / C 案 現状維持非推奨）。**東海林さん最終判断要**（A-07 採択結果の見直しに直結）。

### 16.2 指摘 #2: メール SPF/DKIM/DMARC 未定義

**問題**: 旧 §6.4 はプロバイダ選定のみで送信ドメイン認証要件が記載なし。なりすまし配信で PII 漏洩・フィッシング誘導リスク。

**改修**: §6.4.1 で SPF/DKIM/DMARC の DNS 設定を**必須**として明記。専用サブドメイン採用、DMARC は `p=reject` で強制。

### 16.3 指摘 #3: SMTP 経路 TLS 未指定 / Storage パスの uuid 化

**問題**:
- メール送信時の TLS 強制が未記述 → 中継サーバーでの平文露出リスク
- Storage パス `{employee_id}/{YYYY-MM}.pdf` は推測可能 → 列挙攻撃で他人の明細パス特定可

**改修**:
- §6.4.2 で TLS 1.2 以上必須を明記
- §6.6.2 で Storage パスを uuid v4 (`bud_salary_statements.id`) に変更、§5.2 / §8.1 と整合

### 16.4 指摘 #4: メール本文に PW 規則を平文同送

**問題**: 旧 §6.3 では本文に「PW は生年月日 4 桁（MMDD）です（例: 1985年3月15日 → 0315）」と PW 算出規則を平文で記載。メール傍受 / 転送 / 誤送信時に PDF + PW がセット漏洩。

**改修**: §6.3 メール本文を改訂し PW 規則を削除、別経路（SMS / Chatwork DM）通知に変更。指摘 #1 の A 案採択時に自然に整合。

### 16.5 指摘 #5: ダウンロード Server Action に rate limit / log redaction なし

**問題**: 旧 §6.6 には rate limit 言及なし。攻撃者が `salaryRecordId` を列挙して情報取得試行可。signed URL がログに残る場合、Vercel / Supabase ログから 60 秒以内に再利用される可能性。

**改修**: §6.6.1 で rate limit を明記（一般 10 req / 5 min）、§6.6.2 で log redaction（signed URL 削除 + ID hash 化）を追加。

### 16.6 改修サマリ

| # | 指摘 | 改修箇所 | 状態 |
|---|---|---|---|
| 1 | PDF PW 脆弱 | §6.5（推奨案 A/B/C 提示）| 🟡 東海林さん判断待ち |
| 2 | SPF/DKIM/DMARC 未定義 | §6.4.1 必須設定追加 | ✅ 反映済 |
| 3 | TLS / Storage パス | §6.4.2 / §6.6.2 | ✅ 反映済 |
| 4 | メール本文 PW 平文 | §6.3 改訂 | ✅ 反映済 |
| 5 | rate limit / log redact | §6.6.1 / §6.6.2 | ✅ 反映済 |

### 16.7 GitHub 復旧後のアクション

1. a-review コメント本文を取得し、本 §16 の改修内容と突き合わせ
2. 認識相違があれば追加 commit で修正
3. 指摘 #1 PW 設計は東海林さん最終判断 → 確定後に §6.5 を更新
4. 指摘 #1 確定後、A-07 spec（`docs/specs/2026-04-24-bud-a-07-cash-payment-undecided.md`）も連動修正
