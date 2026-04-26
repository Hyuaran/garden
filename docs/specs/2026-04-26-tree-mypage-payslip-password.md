# Tree マイページ拡張: 給与明細 PW 確認画面

- 対象: Garden Tree マイページに給与明細 PW 確認画面を追加（フォールバックフロー専用）
- 優先度: **🔴 高**（Y 案フォールバック必須、賃金支払 5 原則の到達担保）
- 見積: **0.5d**
- 担当セッション: a-tree（実装）/ a-bud（D-04 連携）/ a-bloom（レビュー）
- 作成: 2026-04-26（a-auto 008 / 給与明細配信 Y 案 + フォールバック整合）
- 前提:
  - **memory `project_payslip_distribution_design.md`**（2026-04-26 確定）
  - **memory `project_garden_login_office_only.md`**（社内 PC 限定）
  - Sprout S-05 §16（友だち状態管理）/ S-06 §14（入社初日 LINE 確認）
  - Bud Phase D-04 spec（給与明細配信、PR #74 #1）
  - Tree Phase B-β（マイページ既存実装）

---

## 1. 目的とスコープ

### 1.1 目的

LINE 非友だち / Bot 不通の従業員向けに、**社内 PC でログインしてマイページから給与明細の解凍 PW を確認**できる画面を提供する。Y 案（PW なし、LINE 通知併用）に対する**フォールバック経路**として、賃金支払 5 原則（労基法 24 条）の到達義務を満たす。

### 1.2 含めるもの

- 給与明細 PW 確認画面 `/tree/mypage/payslip-password`
- `line_friend_status != 'friend'` の従業員のみ表示
- 社内 PC ログイン限定（既存制約）
- 表示は当月分のみ、PW 表示は 24h 後に自動マスク
- アクセスログ記録
- root_employees.line_friend_status で表示制御
- PW 取得 API（Bud D-04 と連携）
- メール内 DL リンクとの組み合わせフロー

### 1.3 含めないもの

- PDF 自体の生成 → Bud D-04
- メール DL リンク送信 → Bud D-04
- LINE Bot 通知 → Sprout S-05
- 従業員の友だち状態管理 → Sprout S-05 / S-06
- 退職者向けマイページ → Phase D Tree 退職フロー

---

## 2. 全体フロー（フォールバック）

### 2.1 配信〜確認の流れ

```
[Bud D-04: 給与明細配信]
  ↓
employee.line_friend_status = ('blocked'|'unfriended'|'no_account'|'unknown')
  ↓
1. PW 保護 PDF を生成（PW = generatePayslipPassword(employee_id, year_month)）
2. PDF DL リンクをメールで送信
3. payslip_passwords テーブルに PW 記録（24h TTL）
4. LINE 通知は送信しない（フォールバック認証）
  ↓
[本人]
1. メール受信 → DL リンク クリック → PDF DL（PW 入力要求）
2. 社内 PC で Tree ログイン
3. /tree/mypage/payslip-password にアクセス
4. 当月分 PW をコピー → PDF 解凍
```

### 2.2 別経路認証の構造

| 認証要素 | 経路 |
|---|---|
| メール（DL リンク）| インターネット経由、本人メールアドレス |
| 社内 PC + Tree ログイン | 物理的に隔離されたオフィスネットワーク + JWT 認証 |

漏洩には**両方の経路の同時侵害**が必要 → 通常 LINE Bot 経路と同等以上のセキュリティ。

---

## 3. データベース設計

### 3.1 payslip_passwords テーブル（新規）

```sql
CREATE TABLE bud_payslip_passwords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES root_employees(id),
  year_month text NOT NULL,        -- 'YYYY-MM'
  password_hash text NOT NULL,      -- pgcrypto crypt() で hash 保存
  password_plain_encrypted bytea,   -- 24h 限定で復号可（pgcrypto pgp_sym_encrypt）
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,  -- 24h 後
  first_viewed_at timestamptz,      -- 初回参照時刻
  view_count int NOT NULL DEFAULT 0,
  masked_at timestamptz,             -- 24h 後の自動マスク時刻
  UNIQUE (employee_id, year_month)
);

CREATE INDEX idx_payslip_pw_employee_ym ON bud_payslip_passwords (employee_id, year_month);
CREATE INDEX idx_payslip_pw_expires ON bud_payslip_passwords (expires_at)
  WHERE masked_at IS NULL;
```

### 3.2 アクセスログテーブル（新規）

```sql
CREATE TABLE bud_payslip_password_views (
  id bigserial PRIMARY KEY,
  payslip_password_id uuid NOT NULL REFERENCES bud_payslip_passwords(id),
  viewed_by uuid NOT NULL,         -- アクセスした user_id
  viewed_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text,
  is_office_pc boolean NOT NULL    -- 社内 PC 判定結果
);

CREATE INDEX idx_payslip_pw_views_payslip ON bud_payslip_password_views (payslip_password_id);
CREATE INDEX idx_payslip_pw_views_user_time ON bud_payslip_password_views (viewed_by, viewed_at DESC);
```

### 3.3 root_employees.line_friend_status との連動

S-05 §16.2 で追加済の列を SELECT で参照、UI 表示制御に使用（書込はしない）。

---

## 4. 画面設計

### 4.1 ルーティング

`/tree/mypage/payslip-password` （社内 PC ログイン限定、既存 Tree 認証ミドルウェア準拠）

### 4.2 表示条件

```typescript
// アクセス時のチェック
const employee = await getCurrentEmployee();
const isOfficePC = await checkOfficeLogin();

// 1. 社内 PC でないと 403
if (!isOfficePC) return forbidden('社内 PC からのみアクセス可');

// 2. friend なら不要
if (employee.line_friend_status === 'friend') {
  return redirect('/tree/mypage', { message: 'LINE で給与明細通知を受け取れます' });
}

// 3. 退職者は閲覧不可
if (!employee.is_active) return forbidden('退職済みアカウントです');
```

### 4.3 画面レイアウト

```
┌───────────────────────────────────────────────┐
│ Tree マイページ > 給与明細 PW 確認              │
├───────────────────────────────────────────────┤
│ こんにちは、山田 太郎 さん                      │
│                                               │
│ ⚠️ あなたは LINE 友だち登録がないため、         │
│ 給与明細の PW をこちらでご確認ください。        │
│                                               │
│ ─────────────────────────────                │
│ 2026 年 4 月分 給与明細                         │
│ ─────────────────────────────                │
│                                               │
│ メールに添付された PDF を開く際の              │
│ パスワードは下記です：                          │
│                                               │
│ ┌─────────────────────────┐                   │
│ │   X k 7 N q 2 P                              │
│ │   [コピー] [表示]                            │
│ └─────────────────────────┘                   │
│                                               │
│ このパスワードは 2026-05-25 23:59:59 まで       │
│ 有効です（あと 23 時間 12 分）                  │
│                                               │
│ ─────────────────────────────                │
│ 注意事項:                                      │
│ - 24 時間経過後は自動的にマスクされます         │
│ - 紛失時は admin に再発行を依頼してください    │
│ - LINE 友だち登録すれば次回から PW 不要です    │
│                                               │
│ [LINE 友だち追加方法を見る →]                  │
└───────────────────────────────────────────────┘
```

### 4.4 既往月の確認

```
過去の給与明細 PW（参考、すでにマスク済）

| 年月 | 状態 | 初回確認 |
|---|---|---|
| 2026-04 | 表示中 | 2026-05-25 09:30 |
| 2026-03 | マスク済 | 2026-04-25 14:00 |
| 2026-02 | マスク済 | 2026-03-26 10:15 |
| 2026-01 | 未確認（!） | — |
```

未確認の警告を強調表示、admin 通知連動。

---

## 5. PW 表示と自動マスク

### 5.1 初回参照時の動作

```typescript
async function viewPasswordOnce(employeeId: string, yearMonth: string) {
  const pw = await fetchPayslipPassword(employeeId, yearMonth);
  if (!pw || pw.masked_at) {
    return { error: 'PW は既にマスクされています' };
  }

  // 復号
  const plain = await decrypt(pw.password_plain_encrypted);

  // first_viewed_at 記録
  if (!pw.first_viewed_at) {
    await supabaseAdmin.from('bud_payslip_passwords').update({
      first_viewed_at: new Date().toISOString(),
    }).eq('id', pw.id);
  }

  // view_count インクリメント + アクセスログ
  await supabaseAdmin.from('bud_payslip_passwords').update({
    view_count: pw.view_count + 1,
  }).eq('id', pw.id);
  await recordView(pw.id);

  return { plain, expires_at: pw.expires_at };
}
```

### 5.2 24h 自動マスク

```typescript
// /api/cron/payslip-pw-mask (1 時間ごと)
const expired = await supabaseAdmin
  .from('bud_payslip_passwords')
  .select('id')
  .lt('expires_at', new Date().toISOString())
  .is('masked_at', null);

for (const pw of expired) {
  await supabaseAdmin.from('bud_payslip_passwords').update({
    password_plain_encrypted: null,  // 平文 NULL クリア
    masked_at: new Date().toISOString(),
  }).eq('id', pw.id);
}
```

### 5.3 マスク後の挙動

- 画面では `(マスク済)` 表示
- 再発行は admin 経由（Bud D-04 から手動再生成）
- password_hash は残る（PDF を開けば検証可、admin が再発行判定）

---

## 6. アクセスログ記録

### 6.1 記録項目

```typescript
interface AccessLog {
  payslip_password_id: string;
  viewed_by: string;          // user_id
  viewed_at: string;
  ip_address: string;
  user_agent: string;
  is_office_pc: boolean;
  action: 'view' | 'copy';
}
```

### 6.2 操作 vs 監査

| アクション | 記録 |
|---|---|
| 画面アクセス | bud_payslip_password_views に INSERT |
| PW 表示クリック | view_count +1 + view ログ |
| PW コピーボタン | 別途 copy ログ（任意）|
| 24h 自動マスク | システムログ（user_id = NULL）|

### 6.3 admin の閲覧

```
/tree/admin/payslip-pw-audit （admin / super_admin のみ）

| employee | year_month | 初回確認 | 確認回数 | アクセス IP |
|---|---|---|---|---|
| 山田太郎 | 2026-04 | 04-25 09:30 | 2 | 192.168.1.42 |
| 鈴木次郎 | 2026-04 | 未確認 ⚠️ | 0 | — |
```

未確認者を月末にリマインダー（Chatwork 通知）。

---

## 7. 表示制御ロジック詳細

### 7.1 line_friend_status による分岐

```typescript
// /tree/mypage/payslip-password page.tsx
async function PageRoute() {
  const employee = await getCurrentEmployee();
  const isOfficePC = await checkOfficeLogin();

  // 1. 社内 PC チェック
  if (!isOfficePC) {
    return <ForbiddenView reason="office_only" />;
  }

  // 2. friend ならリダイレクト
  if (employee.line_friend_status === 'friend') {
    return <RedirectView to="/tree/mypage" message="LINE で受け取れます" />;
  }

  // 3. 退職者なら不可
  if (!employee.is_active) {
    return <ForbiddenView reason="inactive" />;
  }

  // 4. 当月分 PW 取得
  const yearMonth = currentYearMonth();
  const pw = await getPayslipPassword(employee.id, yearMonth);

  return <PayslipPasswordView pw={pw} employee={employee} />;
}
```

### 7.2 friend 切替時の挙動

入社後 LINE 友だち追加 → `line_friend_status = 'friend'` 確定:
- **既発行の PW**は引き続き有効（その月分は最後まで利用可）
- **次回以降**は LINE 通知のみ（PW 保護なし）に自動切替

### 7.3 友だち解除時の挙動

`friend` → `unfriended` 変化 → 翌月から PW 保護 PDF + マイページ確認に切替。

---

## 8. メール内 DL リンクとの組み合わせ

### 8.1 メール本文（フォールバック専用）

```
件名: [Garden] 2026 年 4 月分 給与明細のお知らせ

山田 太郎 様

2026 年 4 月分の給与明細を配信いたしました。

【ダウンロード】
下記リンクからお受け取りください（24h 限定）:
https://garden.example.com/api/bud/payslip-download/abc123

※ パスワード保護 PDF です

【パスワード確認】
社内 PC で Tree にログインし、マイページからご確認ください:
https://garden.example.com/tree/mypage/payslip-password

不明な点は、経理担当（admin）までお問い合わせください。
```

### 8.2 リンク有効期限

- DL リンク: 24h
- マイページ PW 確認: 24h（同じ TTL で一致）
- 両方 24h で連動マスク

---

## 9. RLS 設計

### 9.1 bud_payslip_passwords

```sql
-- 本人のみ参照可
CREATE POLICY payslip_pw_select_own
  ON bud_payslip_passwords FOR SELECT
  USING (employee_id = auth.uid());

-- 書込は service_role のみ（Bud D-04 経由）
-- DELETE 禁止（masked_at 設定で実質削除）
CREATE POLICY payslip_pw_no_delete
  ON bud_payslip_passwords FOR DELETE
  USING (false);

-- admin / super_admin は全件参照可（再発行判定 + 監査）
CREATE POLICY payslip_pw_select_admin
  ON bud_payslip_passwords FOR SELECT
  USING (current_garden_role() IN ('admin', 'super_admin'));
```

### 9.2 bud_payslip_password_views

```sql
-- 本人と admin のみ
CREATE POLICY payslip_pw_views_select
  ON bud_payslip_password_views FOR SELECT
  USING (
    viewed_by = auth.uid()
    OR current_garden_role() IN ('admin', 'super_admin')
  );

-- 書込は本人のアクセスログのみ
CREATE POLICY payslip_pw_views_insert
  ON bud_payslip_password_views FOR INSERT
  WITH CHECK (viewed_by = auth.uid());
```

---

## 10. セキュリティ考慮

### 10.1 PW の暗号化

- pgp_sym_encrypt で暗号化保存
- 鍵は Vercel 環境変数 `PAYSLIP_PW_ENCRYPTION_KEY`
- 24h 経過で `password_plain_encrypted = NULL` クリア
- `password_hash` は照合用に永続保持

### 10.2 IP 制限

- 社内 PC IP（既存 Garden の IP allowlist）からのアクセスのみ
- VPN / 自宅 IP は拒否
- middleware で事前判定、403 返却

### 10.3 ログイン後セッション

- Tree 既存の JWT 認証準拠
- セッション TTL は 8h（業務時間想定）
- マイページアクセスでは追加認証なし（既存ログイン状態を信頼）

### 10.4 コピー時の警告

```
[コピーされました]
このパスワードは 24 時間有効です。
紙やデジタルメモへの保存は避けてください。
```

トースト通知のみ、強制力なし。

---

## 11. 法令対応チェックリスト

- [ ] **賃金支払 5 原則（労基法 24 条）**: 給与明細到達確認をログで担保
- [ ] **労働基準法 109 条**: アクセスログ 5 年保管
- [ ] **個人情報保護法 第 23 条**: PW のマスク + 鍵管理 + RLS 厳格
- [ ] **個人情報保護法 第 24 条**: 漏洩時の報告義務（侵害検知時）
- [ ] **電子帳簿保存法**: 給与明細自体は電子保存対応（PDF 保管期間 7 年、Bud D-04 連動）

---

## 12. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | bud_payslip_passwords テーブル migration | a-bud | 0.5h |
| 2 | bud_payslip_password_views テーブル migration | a-bud | 0.25h |
| 3 | RLS ポリシー実装 | a-bud + a-tree | 0.5h |
| 4 | 自動マスク Cron（1h ごと）| a-bud | 0.5h |
| 5 | /tree/mypage/payslip-password 画面 | a-tree | 1h |
| 6 | PW 表示 / コピー / 履歴 UI | a-tree | 1h |
| 7 | 社内 PC IP middleware | a-tree | 0.25h |
| 8 | アクセスログ記録 | a-tree | 0.25h |
| 9 | admin 監査画面（/tree/admin/payslip-pw-audit）| a-tree | 0.5h |
| 10 | Bud D-04 spec との連携確認 | a-bud + a-tree | 0.25h |

合計: 約 4.5h ≈ **0.5d**（既存 Tree マイページ基盤を活用）

---

## 13. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| 1 | PW TTL 24h 妥当性 | **24h 既定**、業務上の不便があれば 48h or 72h に拡張可 |
| 2 | マスク後の再発行プロセス | admin 経由のみ、本人の自己再発行は不可 |
| 3 | 過去月 PW の参照範囲 | 6 ヶ月（参考表示）、それ以前は admin のみ |
| 4 | コピー操作の追加ログ | view と分けない（同一トランザクションでカウント）|
| 5 | 社内 PC 判定の実装 | 既存 IP allowlist 流用 |
| 6 | 友だち切替時の既発行 PW 扱い | **既発行は有効**、次回以降のみ Y 案切替 |
| 7 | 退職時の履歴扱い | アクセスログ 5 年保管、PW 自体は退職翌月にマスク |
| 8 | 未確認リマインダー時刻 | 月末 17:00 JST、Chatwork DM |

---

## 14. 既知のリスクと対策

### 14.1 社内 PC 判定の誤判定

- VPN / プロキシ経由で IP が一致してしまう
- 対策: User-Agent + 端末認証も併用（既存 Tree 仕組み利用）

### 14.2 PW を紙にメモして紛失

- 物理紛失リスク
- 対策: コピー時警告 + admin 教育 + 解凍後即破棄推奨

### 14.3 マイページ画面のスクショ

- スマホで画面撮影 → 後日漏洩
- 対策: 24h 自動マスクで時間制約、本人責任で運用

### 14.4 admin の悪用

- admin 権限で全員の PW を参照可能
- 対策: admin の参照もログ記録、四半期に super_admin が監査

### 14.5 Cron 失敗で 24h マスクが動かない

- 平文が残り続けるリスク
- 対策: 監視（Cross Ops #01 連動）、連続失敗で critical 通知

### 14.6 line_friend_status の同期遅延

- LINE Webhook 取りこぼしで friend なのに unknown 扱い
- 対策: S-05 §16.6 日次 Cron で補正、月初の配信前に admin が一括レビュー

---

## 15. 関連ドキュメント

- memory: `project_payslip_distribution_design.md`
- memory: `project_garden_login_office_only.md`
- `docs/specs/2026-04-26-sprout-S-05-line-bot.md` §16
- `docs/specs/2026-04-26-sprout-S-06-pre-employment-ui.md` §14
- `docs/specs/2026-04-25-bud-phase-d-XX-XX.md`（D-04 給与明細配信）
- Tree Phase B-β マイページ既存仕様

---

## 16. 受入基準（Definition of Done）

- [ ] bud_payslip_passwords / bud_payslip_password_views テーブル作成済
- [ ] /tree/mypage/payslip-password 画面が動作
- [ ] line_friend_status='friend' の従業員は自動リダイレクト
- [ ] 社内 PC 以外からは 403
- [ ] PW 表示 / コピー / 24h カウントダウン動作
- [ ] 自動マスク Cron が 1h ごと稼働
- [ ] アクセスログが bud_payslip_password_views に記録
- [ ] admin 監査画面（/tree/admin/payslip-pw-audit）動作
- [ ] 未確認者の月末リマインダー Chatwork 配信
- [ ] RLS（本人 + admin のみ）テスト pass
- [ ] PW 暗号化キー Vercel 環境変数設定済
- [ ] 法令対応 5 項目レビュー済
