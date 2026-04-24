# Cross-Cutting Spec: Supabase Storage バケット設計・運用ガイド

- 優先度: **🟡 高**
- 見積: **0.75d**
- 作成: 2026-04-24（a-auto / Batch 7 Garden 横断 #3）
- 前提: T-F6-01 Forest Storage（Batch 3）, T-F5-01 Tax Files, Bloom `bloom-digests` 等既存

---

## 1. 背景と目的

### 1.1 現状
モジュールごとに個別に bucket 作成・RLS 設計しており、**命名規則・TTL・サイズ制限のルールが統一されていない**：

| 既存 bucket | モジュール | 用途 | 状態 |
|---|---|---|---|
| `forest-docs` | Forest | 決算書 PDF | spec 段階（T-F6-01）|
| `forest-downloads` | Forest | ZIP 一時格納 | spec 段階 |
| `forest-tax` | Forest | 税理士連携ファイル | spec 段階（T-F5-01）|
| `bud-attachments` | Bud | 振込請求書スキャン | spec 段階（A-04）|
| `bud-salary-statements` | Bud | 給与明細 PDF | spec 段階（B-03）|
| `bud-cc-invoices` | Bud | CC インボイス | spec 段階（A-08）|
| `bud-statement-imports` | Bud | 銀行 CSV 原本 | spec 段階（A-06）|
| `bloom-digests` | Bloom | 月次ダイジェスト PDF | 実装済（PR #17）|

### 1.2 本 spec のゴール
- **命名規則 / TTL / サイズ制限 / RLS パターンを統一**
- bucket 一覧を一元管理（本 spec が正本）
- 新規 bucket 作成時のチェックリスト
- 署名 URL の有効期限ルール

---

## 2. バケット命名規則

### 2.1 パターン

```
<module>-<purpose>[-<subset>]
```

- **module**: `bloom`, `bud`, `forest`, `leaf`, `root`, `rill`, `soil`, `tree`, `seed`, `auth`, `system` のみ
- **purpose**: 複数形の名詞（`docs`, `statements`, `attachments`, `invoices`, `imports`, `downloads` 等）
- **subset**: 任意の補助識別子（`temp`, `archive` 等）

### 2.2 NG パターン

- ❌ キャメルケース: `BudAttachments` → **kebab-case 必須**
- ❌ モジュール名なし: `documents` → 衝突リスク
- ❌ 曖昧な名前: `files` / `uploads` → purpose 明示
- ❌ 個人名: `yamada-docs` → 業務カテゴリで命名

---

## 3. 公開 / 非公開の判定

### 3.1 既定方針: **全 bucket 非公開（`public: false`）**

- Public bucket は業務データには不適切
- 静的アセット（ロゴ・favicon 等）は別 bucket `public-assets` で集約（必要時）

### 3.2 例外的に公開可

| ケース | 理由 |
|---|---|
| `public-assets`（静的画像）| 一時的な公開リンクで配布 |
| OG 画像生成（SNS 共有）| 公開前提のため |

上記以外は**原則非公開 + signedURL**。

---

## 4. サイズ制限

### 4.1 用途別の既定値

| 用途 | サイズ上限 | 根拠 |
|---|---|---|
| 決算書 PDF（forest-docs）| 50 MB | A4 × 50 頁程度 |
| 税理士連携（forest-tax）| 50 MB | 同上 |
| 給与明細（bud-salary-statements）| 2 MB | A4 × 2 頁程度、最小 |
| 振込請求書（bud-attachments）| 10 MB | PDF / JPG 主体 |
| CC インボイス（bud-cc-invoices）| 10 MB | 同上 |
| 銀行 CSV 原本（bud-statement-imports）| 5 MB | 月次明細 |
| 月次ダイジェスト PDF（bloom-digests）| 20 MB | A4 × 20 頁 |
| ZIP 一時格納（forest-downloads）| 200 MB | 6 社 × 3 期の ZIP |

### 4.2 超過時の対応

- クライアント側で事前拒否（UX 優先）
- サーバー側でも 413 Payload Too Large 返却
- ユーザー表示: 「ファイルが大きすぎます（最大 XX MB）」

---

## 5. MIME タイプ制限

### 5.1 用途別の allowed MIME

| 用途 | 許可 MIME |
|---|---|
| PDF 専用 | `application/pdf` |
| 文書一般 | PDF + `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` + `application/vnd.ms-excel` + `text/csv` |
| 画像混在 | 上記 + `image/jpeg` + `image/png` |
| CSV 専用 | `text/csv` |
| ZIP | 無制限 or `application/zip` |

**禁止 MIME**:
- `application/x-msdownload` 等の実行可能形式
- `text/html` 等のスクリプト可能形式
- 不明な MIME → 拒否

---

## 6. RLS パターン統一

### 6.1 4 パターン

#### Pattern-1: **社員全員 read + admin write**
代表例: `forest-docs`, `forest-tax`

```sql
CREATE POLICY <p>_read ON storage.objects FOR SELECT
  USING (bucket_id = '<bucket>' AND <module>_is_user());

CREATE POLICY <p>_insert ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = '<bucket>' AND <module>_is_admin());

CREATE POLICY <p>_update ON storage.objects FOR UPDATE
  USING (bucket_id = '<bucket>' AND <module>_is_admin())
  WITH CHECK (bucket_id = '<bucket>' AND <module>_is_admin());

CREATE POLICY <p>_delete ON storage.objects FOR DELETE
  USING (bucket_id = '<bucket>' AND <module>_is_super_admin());
```

#### Pattern-2: **本人のみ read + admin 全権**
代表例: `bud-salary-statements`

```sql
-- Storage path: <bucket>/<employee_id>/<file>
-- folderの第1階層で本人判定
CREATE POLICY <p>_read_self ON storage.objects FOR SELECT
  USING (
    bucket_id = '<bucket>'
    AND (storage.foldername(name))[1] = (
      SELECT employee_id FROM root_employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY <p>_read_admin ON storage.objects FOR SELECT
  USING (bucket_id = '<bucket>' AND <module>_is_admin());

CREATE POLICY <p>_insert_admin ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = '<bucket>' AND <module>_is_admin());
```

#### Pattern-3: **generator-only read + service_role insert**
代表例: `forest-downloads`（ZIP 一時）、`bloom-digests`（PDF 生成結果）

```sql
-- owner = 生成者、5 分 signedURL で本人のみ DL
CREATE POLICY <p>_read_owner ON storage.objects FOR SELECT
  USING (bucket_id = '<bucket>' AND owner = auth.uid());
-- INSERT は service_role key 経由のみ（Route Handler で）
```

#### Pattern-4: **CSV 原本 admin+ read/write**
代表例: `bud-statement-imports`, `bud-cc-imports`

```sql
CREATE POLICY <p>_rw ON storage.objects FOR ALL
  USING (bucket_id = '<bucket>' AND <module>_is_admin())
  WITH CHECK (bucket_id = '<bucket>' AND <module>_is_admin());
```

### 6.2 パターン判定フロー

```
機密度:
├─ 公開 OK → (公開 bucket を検討するが原則避ける)
├─ 社員全員閲覧可 → Pattern-1
├─ 本人と admin のみ → Pattern-2
├─ 生成者のみ一時 → Pattern-3
└─ admin 専用 → Pattern-4
```

---

## 7. 署名 URL（Signed URL）TTL ルール

### 7.1 用途別の既定 TTL

| 用途 | TTL | 理由 |
|---|---|---|
| **ZIP DL 用一時 URL** | **5 分** | 即 DL 前提、漏洩リスク最小化 |
| 給与明細（本人アクセス）| 10 分 | 本人が一度閉じたら再取得の UX |
| 決算書 PDF 閲覧 | 1 時間 | 分析作業中の再リロード考慮 |
| 税理士連携ファイル | 10 分 | 短時間でダウンロード完結 |
| Chatwork 通知内 URL | **3 日** | 通知見逃しへの猶予（例外） |

### 7.2 TTL 決定フロー

1. **アクセス頻度**: 1 回利用なら短く、何度も開くなら長く
2. **漏洩時の影響**: 給与は短く、公開可能に近い情報は長く
3. **UX**: 短すぎると再生成の手間、長すぎると漏洩リスク

**原則**: 迷ったら短く設定（10 分以下）、必要に応じて延長。

---

## 8. 既存 / 計画中の bucket 一覧

本 spec がマスター一覧。新規追加時は必ず本 spec に追記し PR で追跡。

| # | bucket 名 | モジュール | 用途 | サイズ | MIME | RLS | TTL |
|---|---|---|---|---|---|---|---|
| 1 | `bloom-digests` | Bloom | 月次ダイジェスト PDF | 20MB | PDF | Pattern-3 | 10 分 |
| 2 | `forest-docs` | Forest | 決算書 PDF | 50MB | PDF | Pattern-1 | 1 時間 |
| 3 | `forest-downloads` | Forest | ZIP 一時格納 | 200MB | ZIP | Pattern-3 | **5 分** |
| 4 | `forest-tax` | Forest | 税理士連携 | 50MB | PDF/xlsx/csv/jpg/png | Pattern-1 | 10 分 |
| 5 | `bud-attachments` | Bud | 振込請求書 | 10MB | PDF/JPG/PNG | Pattern-4 | 30 分 |
| 6 | `bud-salary-statements` | Bud | 給与明細 PDF | 2MB | PDF | Pattern-2 | 10 分 |
| 7 | `bud-cc-invoices` | Bud | CC インボイス | 10MB | PDF/JPG/PNG | Pattern-4 | 30 分 |
| 8 | `bud-statement-imports` | Bud | 銀行 CSV 原本 | 5MB | CSV | Pattern-4 | — (読取なし) |
| 9 | `bud-cc-imports` | Bud | CC 明細 CSV 原本 | 5MB | CSV | Pattern-4 | — |

### 8.1 将来追加予定

| bucket 名 | モジュール | 用途 | 追加時期 |
|---|---|---|---|
| `leaf-kanden-photos` | Leaf | 関電 撮影画像 | Phase B Leaf 着手時 |
| `leaf-documents` | Leaf | 契約書等 | 同上 |
| `root-employee-docs` | Root | 従業員関係書類 | Phase B Root 給与連携時 |
| `tree-recordings` | Tree | 架電録音（任意）| Phase D |
| `rill-attachments` | Rill | Chatwork 添付 mirror | Phase C |

---

## 9. 新規 bucket 作成チェックリスト

新しい bucket を作る際は**本 spec §8 への追加 PR** を必ず伴う：

```markdown
## 新規 Storage bucket 追加チェック

### 1. 命名
- [ ] `<module>-<purpose>` 形式
- [ ] kebab-case
- [ ] 既存との衝突なし

### 2. サイズ・MIME
- [ ] サイズ上限を既定値（§4.1）と比較、合理性あり
- [ ] MIME 制限が必要十分（最小権限）
- [ ] 不要な実行可能形式を禁止リストに含む

### 3. RLS
- [ ] Pattern-1 〜 Pattern-4 のいずれかで実装
- [ ] 4 コマンド（SELECT/INSERT/UPDATE/DELETE）全てポリシー定義
- [ ] `<module>_is_user()` / `<module>_is_admin()` ヘルパー関数使用

### 4. TTL
- [ ] 用途に応じた signedURL TTL 設定（§7.1）
- [ ] 必要以上に長くしない

### 5. 運用
- [ ] バックアップ方針（Supabase 自動 + 追加手動 dump の有無）
- [ ] 掃除 Cron 必要性判断（一時 bucket は必須）
- [ ] 料金影響の見積り（100GB 超は Paid plan 確認）

### 6. ドキュメント
- [ ] 本 spec §8 に追加
- [ ] 呼出元モジュールの spec で明記
- [ ] migration SQL を `supabase/migrations/` に配置
```

---

## 10. 掃除 Cron 戦略

### 10.1 一時 bucket（forest-downloads 等）

```sql
-- 24 時間以上経過したファイルを削除
-- Vercel Cron で daily 実行（02:00 JST = UTC 17:00）
```

```typescript
// src/app/api/system/cron/storage-cleanup/route.ts
import { createAdminSupabase } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const admin = createAdminSupabase();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // 対象 bucket
  const tempBuckets = ['forest-downloads'];

  for (const bucket of tempBuckets) {
    const { data: files } = await admin.storage.from(bucket).list();
    const oldFiles = files?.filter(f => new Date(f.created_at!) < cutoff) ?? [];

    if (oldFiles.length > 0) {
      await admin.storage.from(bucket).remove(oldFiles.map(f => f.name));
      console.log(`[storage-cleanup] ${bucket}: removed ${oldFiles.length} files`);
    }
  }

  return NextResponse.json({ success: true });
}
```

### 10.2 永続 bucket

掃除不要。税法 7 年保存に対応。

---

## 11. バックアップ戦略

### 11.1 Supabase 標準
- Daily snapshot（Pro plan 以上）
- 30 日間保持

### 11.2 追加策
- **月次手動 dump**（admin が `forest-docs` / `bud-salary-statements` 等を一括 DL、外部保管）
- **年次書庫化**（退職者データの分離）

---

## 12. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | Public bucket 利用の可否 | **原則禁止**、例外は `public-assets` のみ |
| 判2 | サイズ上限の増加ケース | 個別 PR で議論、デフォルトは §4.1 固守 |
| 判3 | MIME 制限の抜け（例: `application/octet-stream`）| **禁止**、Content-Type 偽装攻撃防止 |
| 判4 | CSV 原本保存期間 | **3 年**（税務調査の実績尊重）、その後削除 |
| 判5 | ZIP 一時の TTL 5 分は短すぎないか | 短くしてユーザー離脱時の漏洩防止、再ダウンロードで対処 |
| 判6 | Chatwork 通知内 URL の 3 日 TTL | B-03 / B-06 で合意済、長すぎるなら 1 日に短縮検討 |
| 判7 | bucket 作成の人間承認プロセス | **東海林さん承認必須**（料金影響あり、誰でも作れる状態は避ける）|

---

## 13. 実装ステップ

### W1: 既存 bucket の棚卸し（0.1d）
- [ ] 現 Supabase の bucket 一覧を取得
- [ ] 本 spec §8 との差分抽出

### W2: 新規作成 buckets のチェック（0.1d）
- [ ] Forest T-F6-01 / T-F5-01 の適用確認
- [ ] Bud A-04 / A-08 / A-06 / B-03 の spec 内容と本 spec の整合

### W3: 掃除 Cron 実装（0.15d）
- [ ] `/api/system/cron/storage-cleanup` Route
- [ ] `vercel.json` に daily 02:00 JST 追加

### W4: バックアップ運用手順書（0.1d）
- [ ] `docs/operations/storage-backup-manual.md` 作成
- [ ] 月次 / 年次の手順明文化

### W5: ドキュメント整備（0.1d）
- [ ] `known-pitfalls.md` §4.3 を本 spec §7 にリンク
- [ ] PR テンプレートにチェックリスト組込

---

## 14. 次アクション

1. a-auto または a-main で本 spec を PR 化してマージ
2. 新規 bucket 作成時は本 spec を更新する運用を徹底
3. **Supabase Dashboard にて定期棚卸し**（月 1 回）
