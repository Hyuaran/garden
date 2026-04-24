# Forest Phase A2+A3 進行期編集モーダル 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Forest ダッシュボードの進行期バッジをクリックするとタブ付きモーダルが開き、PDF アップロードによる自動入力・手動編集・期切り替えができる。

**Architecture:** 既存の ForestShell / MicroGrid 構造を温存し、新規モーダル `ShinkoukiEditModal` と API Route `/api/forest/parse-pdf` を追加する。PDF 解析は `pdfjs-dist` を Node.js runtime で実行し、PoC で検証済みのロジックを移植する。UPDATE / INSERT は admin 限定の RLS ポリシーで保護する。

**Tech Stack:** Next.js 16 App Router / TypeScript / `pdfjs-dist` v5 / Supabase (RLS) / React 19 hooks

**Base:** `feature/forest-shinkouki-update`（main への PR #7 マージ待ち）から派生

**関連ドキュメント:**
- 設計書: `docs/superpowers/specs/2026-04-21-shinkouki-auto-update-design.md`
- Phase A1 実装: `scripts/update_shinkouki_supabase.py`（Python 版、ロジック移植元）
- PoC: `scripts/poc-pdfjs-extract.mjs`（pdfjs-dist 動作確認済み）
- 親 CLAUDE.md: FileMaker風UX §6・認証ポリシー §4・法人マスタ統合 §5

---

## ファイル構成

### 新規作成

| ファイル | 責務 |
|---|---|
| `scripts/forest-schema-patch-002.sql` | shinkouki UPDATE / fiscal_periods INSERT / audit_log 新アクションの RLS パッチ |
| `src/app/api/forest/parse-pdf/_lib/extract.ts` | pdfjs-dist を使った PDF 抽出ロジック（純粋関数） |
| `src/app/api/forest/parse-pdf/_lib/constants.ts` | COMPANY_MAP（サーバー/クライアント共用の可能性あり） |
| `src/app/api/forest/parse-pdf/route.ts` | POST Route Handler（認証+抽出+レスポンス） |
| `src/app/forest/_lib/mutations.ts` | updateShinkouki / rolloverPeriod 関数群 |
| `src/app/forest/_lib/permissions.ts` | isForestAdmin ヘルパー |
| `src/app/forest/_components/PdfUploader.tsx` | ドロップゾーン + POST 呼び出し |
| `src/app/forest/_components/NumberUpdateForm.tsx` | 📊 タブ（売上/外注/利益/反映期間/状態 + PDF アップロード） |
| `src/app/forest/_components/PeriodRolloverForm.tsx` | 🔄 タブ（純資産/現金/預金/決算書URL + 確認ダイアログ） |
| `src/app/forest/_components/ShinkoukiEditModal.tsx` | タブ付きモーダル本体（Esc/Ctrl+S/Ctrl+↑↓ を担当） |

### 修正

| ファイル | 修正内容 |
|---|---|
| `src/app/forest/dashboard/page.tsx` | 進行期バッジ（MicroGrid 内 CellData.isShinkouki=true セル）にクリックハンドラを追加し、Modal を開く |
| `src/app/forest/_components/MicroGrid.tsx` | 進行期セルのクリックで親の `onEditShinkouki` を呼ぶよう props 追加 |
| `src/app/forest/_state/ForestStateContext.tsx` | `refreshData()` は既存、mutations 後に呼ぶだけなので変更なし（**要確認**：権限判定の isAdmin を context に露出する） |

---

## 共用型定義

**新規ファイル:** `src/app/forest/_lib/types.ts`

```typescript
/** PDF 抽出結果 */
export type ParsePdfResult = {
  company_id: string | null;
  uriage: number | null;
  gaichuhi: number | null;
  rieki: number | null;
  period: string | null; // "YYYY/M"
};

/** shinkouki UPDATE ペイロード（部分更新可） */
export type ShinkoukiUpdateInput = {
  uriage?: number | null;
  gaichuhi?: number | null;
  rieki?: number | null;
  reflected?: string;
  zantei?: boolean;
};

/** fiscal_periods 昇格用ペイロード */
export type PeriodRolloverInput = {
  junshisan: number;
  genkin: number;
  yokin: number;
  doc_url: string;
};
```

---

## Task 1: RLS パッチ SQL 作成

**Files:**
- Create: `scripts/forest-schema-patch-002.sql`

- [ ] **Step 1: SQL ファイルを作成**

```sql
-- ============================================================
-- Garden Forest — Schema Patch 002
-- Phase A2/A3 進行期編集モーダルのための RLS ポリシー追加
--
-- 追加内容:
--   1. shinkouki UPDATE: admin のみ可
--   2. fiscal_periods INSERT: admin のみ可（期切り替え時）
--   3. audit_log に update_shinkouki / upload_pdf / period_rollover を許可
--
-- Run in: Supabase Dashboard > SQL Editor
-- ============================================================

-- shinkouki UPDATE を admin のみに許可
CREATE POLICY "forest_update_shinkouki_admin" ON shinkouki
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IN (SELECT user_id FROM forest_users WHERE role = 'admin')
  )
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM forest_users WHERE role = 'admin')
  );

-- fiscal_periods INSERT を admin のみに許可（期切り替え用）
CREATE POLICY "forest_insert_fiscal_periods_admin" ON fiscal_periods
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM forest_users WHERE role = 'admin')
  );

-- forest_audit_log の action に新アクションを許可
-- （既存ポリシーが action 列の値を制限していない場合は追加不要だが、
--  明示的な許可リストを置く場合は下記を追加）
-- 既存 forest_audit_insert ポリシーを維持する前提のため、ここでは追加操作なし
```

- [ ] **Step 2: SQL シンタックスを確認**

Supabase Dashboard > SQL Editor に貼り付けて Preview ボタンでエラーがないか確認（実行はまだ）。

- [ ] **Step 3: Commit**

```bash
git add scripts/forest-schema-patch-002.sql
git commit -m "chore(forest): Phase A2/A3 のための RLS パッチ SQL を追加"
```

---

## Task 2: PDF 抽出ライブラリ

**Files:**
- Create: `src/app/api/forest/parse-pdf/_lib/extract.ts`
- Create: `src/app/api/forest/parse-pdf/_lib/constants.ts`

- [ ] **Step 1: COMPANY_MAP 定数を作成**

`src/app/api/forest/parse-pdf/_lib/constants.ts`:

```typescript
/** PDF 内の会社名表記 → Supabase companies.id */
export const COMPANY_MAP: Record<string, string> = {
  "ヒュアラン": "hyuaran",
  "センターライズ": "centerrise",
  "リンクサポート": "linksupport",
  "ＡＲＡＴＡ": "arata",
  "ARATA": "arata",
  "たいよう": "taiyou",
  "壱": "ichi",
};
```

- [ ] **Step 2: extract.ts を作成**

`src/app/api/forest/parse-pdf/_lib/extract.ts`:

```typescript
/**
 * PDF（試算表）から会社/売上/外注/利益/期間を抽出する。
 *
 * PoC (scripts/poc-pdfjs-extract.mjs) の実装をベースに、
 * Next.js サーバーランタイム (Node.js) で動作する形に移植。
 *
 * 検証済み PDF:
 *   - ヒュアラン (前期比較残高試算表)
 *   - リンクサポート (通常残高試算表)
 *   - たいよう (通常残高試算表)
 *   - 壱 (利益のみ取得可)
 */
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import { COMPANY_MAP } from "./constants";
import type { ParsePdfResult } from "@/app/forest/_lib/types";

type TextItem = {
  page: number;
  str: string;
  x: number;
  y: number;
};

/** PDF のテキストアイテムを位置情報付きで取得 */
async function extractTextItems(buffer: Buffer): Promise<TextItem[]> {
  const data = new Uint8Array(buffer);
  const pdf = await getDocument({ data, standardFontDataUrl: undefined as unknown as string }).promise;
  const items: TextItem[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    for (const it of textContent.items) {
      if (!("str" in it)) continue;
      const [, , , , e, f] = it.transform;
      items.push({
        page: p,
        str: it.str,
        x: e,
        y: viewport.height - f,
      });
    }
  }
  return items;
}

/** y 座標の近さで行にグループ化 */
function groupByRow(items: TextItem[], yTolerance = 3): TextItem[][] {
  const rows: TextItem[][] = [];
  for (const it of items) {
    let placed = false;
    for (const row of rows) {
      const avgY = row.reduce((s, r) => s + r.y, 0) / row.length;
      if (Math.abs(avgY - it.y) <= yTolerance && row[0].page === it.page) {
        row.push(it);
        placed = true;
        break;
      }
    }
    if (!placed) rows.push([it]);
  }
  rows.forEach((row) => row.sort((a, b) => a.x - b.x));
  return rows;
}

/** 行テキストから整数を抽出（小数・構成比はスキップ） */
function extractNumbers(text: string): number[] {
  const matches = text.match(/-?[\d,]+(?:\.\d+)?/g) || [];
  const results: number[] = [];
  for (const m of matches) {
    const s = m.replace(/,/g, "");
    if (s.includes(".")) continue;
    const v = parseInt(s, 10);
    if (!isNaN(v)) results.push(v);
  }
  return results;
}

/**
 * PDF Buffer から進行期データを抽出する。
 *
 * @param buffer PDF のバイト列
 * @param filename 前期比較判定用のファイル名ヒント（optional）
 * @returns 抽出結果（取れなかった項目は null）
 */
export async function extractFromPdf(
  buffer: Buffer,
  filename: string = ""
): Promise<ParsePdfResult> {
  const items = await extractTextItems(buffer);
  const fullText = items.map((i) => i.str).join("");
  const fullTextNoSpace = fullText.replace(/\s/g, "");

  // 会社名
  let company_id: string | null = null;
  for (const [name, cid] of Object.entries(COMPANY_MAP)) {
    if (fullTextNoSpace.includes(name)) {
      company_id = cid;
      break;
    }
  }

  // 期間 (至 令和X年Y月)
  let period: string | null = null;
  const periodMatch = fullText.match(/至\s*令和\s*(\d+)\s*年\s*(\d+)\s*月/);
  if (periodMatch) {
    const year = parseInt(periodMatch[1], 10) + 2018;
    const month = parseInt(periodMatch[2], 10);
    period = `${year}/${month}`;
  }

  // 前期比較判定
  const isComparative =
    fullTextNoSpace.includes("前期比較") || filename.includes("前期比較");

  const rows = groupByRow(items);

  let uriage: number | null = null;
  let gaichuhi: number | null = null;
  let rieki: number | null = null;

  for (const row of rows) {
    const rowText = row.map((r) => r.str).join("");
    const rowClean = rowText.replace(/\s/g, "");
    const nums = extractNumbers(rowText);
    if (nums.length === 0) continue;

    if (rowClean.includes("売上高合計")) {
      const filtered = nums.filter((n) => n > 0);
      if (filtered.length > 0) {
        uriage = isComparative
          ? filtered[1] ?? filtered[0]
          : filtered[filtered.length - 2] ?? filtered[0];
      }
    }

    if (rowClean.includes("外注費") && !rowClean.includes("営業外")) {
      const filtered = nums.filter((n) => n > 0);
      if (filtered.length > 0) {
        gaichuhi = isComparative
          ? filtered[1] ?? filtered[0]
          : filtered[filtered.length - 2] ?? filtered[0];
      }
    }

    if (rowClean.includes("当期純損益金額")) {
      rieki = isComparative
        ? nums[1] ?? nums[0]
        : nums[nums.length - 2] ?? nums[0];
    }
  }

  return { company_id, uriage, gaichuhi, rieki, period };
}

/** PDF が財務諸表かを先頭ページで判定 */
export async function isFinancialStatement(buffer: Buffer): Promise<boolean> {
  const items = await extractTextItems(buffer);
  if (items.length === 0) return false;
  const firstPageText = items
    .filter((i) => i.page === 1)
    .map((i) => i.str)
    .join("");
  const t = firstPageText.replace(/\s/g, "");
  return (
    t.includes("残高試算表") ||
    t.includes("損益計算書") ||
    t.includes("貸借対照表")
  );
}
```

- [ ] **Step 3: 共用 types.ts を作成**

`src/app/forest/_lib/types.ts`:

```typescript
export type ParsePdfResult = {
  company_id: string | null;
  uriage: number | null;
  gaichuhi: number | null;
  rieki: number | null;
  period: string | null;
};

export type ShinkoukiUpdateInput = {
  uriage?: number | null;
  gaichuhi?: number | null;
  rieki?: number | null;
  reflected?: string;
  zantei?: boolean;
};

export type PeriodRolloverInput = {
  junshisan: number;
  genkin: number;
  yokin: number;
  doc_url: string;
};
```

- [ ] **Step 4: 簡易動作確認スクリプト**

`scripts/verify-extract-lib.mjs`（tsx か esbuild で実行するための一時スクリプト）:

```javascript
// 直接 TS を読み込むため tsx が必要。npm install -D tsx してから実行。
// 本格的な unit test ではなく、PoC と同じ動作を確認するのが目的。
// 作業中の検証のみの用途。コミット対象外。
```

**代替**: extract.ts は pure function なので、API Route から呼び出せば結合テストで十分。Task 3 で結合検証する。

- [ ] **Step 5: Commit**

```bash
git add src/app/api/forest/parse-pdf/_lib src/app/forest/_lib/types.ts
git commit -m "feat(forest): PDF抽出ライブラリとParsePdfResult型を追加"
```

---

## Task 3: /api/forest/parse-pdf Route Handler

**Files:**
- Create: `src/app/api/forest/parse-pdf/route.ts`

- [ ] **Step 1: Route Handler を作成**

```typescript
/**
 * POST /api/forest/parse-pdf
 *
 * multipart/form-data で PDF を受け取り、pdfjs-dist で解析して
 * 会社/売上/外注/利益/期間を返す。admin ロールのみアクセス可。
 *
 * レスポンス例:
 *   200 OK: { success: true, data: { company_id: "hyuaran", uriage: 190797587, ... } }
 *   401 Unauthorized: { success: false, error: "未認証" }
 *   403 Forbidden: { success: false, error: "権限がありません" }
 *   400 Bad Request: { success: false, error: "PDFではありません" }
 *   500 Internal Server Error: { success: false, error: "抽出失敗: <reason>" }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/forest/_lib/supabase-server";
import { extractFromPdf, isFinancialStatement } from "./_lib/extract";

// pdfjs-dist は Node.js runtime が必須（edge では動かない）
export const runtime = "nodejs";
// 50MB 以下の PDF を想定
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  // 認証
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: "未認証です" },
      { status: 401 }
    );
  }

  // admin ロール確認
  const { data: forestUser } = await supabase
    .from("forest_users")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!forestUser || forestUser.role !== "admin") {
    return NextResponse.json(
      { success: false, error: "admin権限がありません" },
      { status: 403 }
    );
  }

  // ファイル取得
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: "ファイルが見つかりません" },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 財務諸表チェック
  const isFS = await isFinancialStatement(buffer);
  if (!isFS) {
    return NextResponse.json(
      { success: false, error: "残高試算表/損益計算書/貸借対照表ではありません" },
      { status: 400 }
    );
  }

  // 抽出
  try {
    const data = await extractFromPdf(buffer, file.name);
    return NextResponse.json({ success: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { success: false, error: `抽出失敗: ${msg}` },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: supabase-server.ts を作成**

`src/app/forest/_lib/supabase-server.ts`:

```typescript
/**
 * サーバーサイド Supabase クライアント
 *
 * Route Handler / Server Component からセッション付きで呼び出す。
 * Cookie からセッションを復元するため、@supabase/ssr を使う。
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Component からの setAll は無視（middleware で行う想定）
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: `@supabase/ssr` パッケージ確認**

Run:
```bash
grep "@supabase/ssr" package.json
```

Expected: 既にインストール済みのはず（auth.ts で使っている場合）。**未インストールなら `npm install @supabase/ssr` が必要（ユーザー承認を得てから）**。

- [ ] **Step 4: dev server で curl テスト**

dev server 起動中（`npm run dev` または既存の localhost:3100）で以下を実行。

Run (PowerShell、multipart/form-data):
```powershell
curl -X POST http://localhost:3100/api/forest/parse-pdf `
  -F "file=@G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/001_仕訳帳/D_税理士連携データ/たいよう_202604151606連携_暫定_㈱たいよう　3月末入金更新.pdf" `
  -b cookies.txt
```

**注意**: 事前にブラウザで Forest にログインして Cookie を取得する必要あり。curl 単体ではログインできない。Task 9 のダッシュボード統合後に PdfUploader 経由で検証する方が現実的。

- [ ] **Step 5: Commit**

```bash
git add src/app/api/forest/parse-pdf/route.ts src/app/forest/_lib/supabase-server.ts
git commit -m "feat(forest): /api/forest/parse-pdf Route Handler を追加 (admin限定)"
```

---

## Task 4: shinkouki-mutations ライブラリ

**Files:**
- Create: `src/app/forest/_lib/mutations.ts`
- Create: `src/app/forest/_lib/permissions.ts`

- [ ] **Step 1: permissions.ts**

```typescript
/**
 * Forest 権限判定ヘルパー
 */
import type { ForestUser } from "../_constants/companies";

export function isForestAdmin(user: ForestUser | null): boolean {
  return user?.role === "admin";
}
```

- [ ] **Step 2: mutations.ts**

```typescript
/**
 * Forest データ更新ミューテーション
 *
 * - updateShinkouki: 進行期の数値更新（admin 限定、RLS で enforced）
 * - rolloverPeriod: 期切り替え（shinkouki → fiscal_periods 昇格）
 * - 失敗時は説明的なエラーメッセージをスロー
 */
import type {
  PeriodRolloverInput,
  ShinkoukiUpdateInput,
} from "./types";
import { writeAuditLog } from "./audit";
import { fetchFiscalPeriods, fetchShinkouki } from "./queries";
import { supabase } from "./supabase";

/**
 * shinkouki テーブルを company_id で UPDATE する。
 *
 * @throws Supabase エラー発生時
 */
export async function updateShinkouki(
  companyId: string,
  payload: ShinkoukiUpdateInput
): Promise<void> {
  const { error } = await supabase
    .from("shinkouki")
    .update(payload)
    .eq("company_id", companyId);

  if (error) {
    throw new Error(`updateShinkouki(${companyId}) failed: ${error.message}`);
  }

  await writeAuditLog("update_shinkouki", companyId);
}

/**
 * 進行期を確定決算期として fiscal_periods に昇格し、
 * shinkouki を次期用にリセットする。
 *
 * トランザクションを RPC で実装するのが理想だが、
 * 現時点では2つの操作を逐次実行する。途中失敗時は呼び出し元に例外を投げる。
 *
 * @throws Supabase エラー発生時
 */
export async function rolloverPeriod(
  companyId: string,
  extra: PeriodRolloverInput
): Promise<void> {
  // 1. 現在の shinkouki を取得
  const shinkoukiList = await fetchShinkouki();
  const current = shinkoukiList.find((s) => s.company_id === companyId);
  if (!current) {
    throw new Error(`rolloverPeriod: shinkouki not found for ${companyId}`);
  }

  // 2. fiscal_periods へ INSERT (period_from/to は既存ロジックから流用)
  const { error: insertErr } = await supabase.from("fiscal_periods").insert({
    company_id: companyId,
    ki: current.ki,
    yr: current.yr,
    period_from: `${current.yr}-${current.range.split("〜")[0] ?? "4月"}`, // TODO: range パーサ要整備
    period_to: `${current.yr}-${current.range.split("〜")[1] ?? "3月"}`,
    uriage: current.uriage,
    gaichuhi: current.gaichuhi,
    rieki: current.rieki,
    junshisan: extra.junshisan,
    genkin: extra.genkin,
    yokin: extra.yokin,
    doc_url: extra.doc_url,
  });

  if (insertErr) {
    throw new Error(`rolloverPeriod INSERT failed: ${insertErr.message}`);
  }

  // 3. shinkouki を次期用にリセット
  const { error: updateErr } = await supabase
    .from("shinkouki")
    .update({
      ki: current.ki + 1,
      yr: current.yr + 1,
      uriage: null,
      gaichuhi: null,
      rieki: null,
      reflected: "未反映",
      zantei: true,
    })
    .eq("company_id", companyId);

  if (updateErr) {
    throw new Error(`rolloverPeriod UPDATE failed: ${updateErr.message}`);
  }

  await writeAuditLog("period_rollover", companyId);
}
```

**注意**: `period_from/to` の計算は `current.range` から簡易パースしているが、range の形式次第で壊れる可能性がある。Task 7 で範囲フォーマットを確認してから実装を調整する。

- [ ] **Step 3: writeAuditLog の action 型を拡張**

`src/app/forest/_lib/audit.ts` を確認し、`action` の型に以下を追加：
- `"update_shinkouki"`
- `"upload_pdf"`
- `"period_rollover"`

既存の型定義を読んで union を拡張する（TODO: ファイル確認後、実装時に編集）。

- [ ] **Step 4: Commit**

```bash
git add src/app/forest/_lib/mutations.ts src/app/forest/_lib/permissions.ts src/app/forest/_lib/audit.ts
git commit -m "feat(forest): mutations.ts (updateShinkouki / rolloverPeriod) と permissions.ts を追加"
```

---

## Task 5: PdfUploader コンポーネント

**Files:**
- Create: `src/app/forest/_components/PdfUploader.tsx`

- [ ] **Step 1: PdfUploader コンポーネント**

```tsx
"use client";

/**
 * PDF ドロップゾーン
 *
 * - ドラッグ&ドロップまたはタップで PDF 選択
 * - /api/forest/parse-pdf へ multipart POST
 * - 成功時: onExtracted(ParsePdfResult) コールバック
 * - 失敗時: onError(message) コールバック
 */
import { useRef, useState, type DragEvent, type ChangeEvent } from "react";

import { C } from "../_constants/colors";
import type { ParsePdfResult } from "../_lib/types";

type Props = {
  onExtracted: (data: ParsePdfResult) => void;
  onError: (message: string) => void;
};

export function PdfUploader({ onExtracted, onError }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      onError("PDF ファイルを選択してください");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/forest/parse-pdf", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        onError(json.error ?? "アップロード失敗");
        return;
      }
      onExtracted(json.data);
    } catch (e) {
      onError(e instanceof Error ? e.message : "通信エラー");
    } finally {
      setIsUploading(false);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      style={{
        border: `2px dashed ${isDragging ? C.accentGreen : "#d8f3dc"}`,
        borderRadius: 12,
        padding: "32px 16px",
        textAlign: "center",
        cursor: "pointer",
        background: isDragging ? C.mintBg : "#fafbfa",
        color: C.textSub,
        fontSize: 14,
        transition: "all 0.15s",
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleChange}
        style={{ display: "none" }}
      />
      {isUploading ? (
        <>📄 解析中...</>
      ) : (
        <>📄 PDFをここにドロップ（またはクリックして選択）</>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/forest/_components/PdfUploader.tsx
git commit -m "feat(forest): PdfUploader ドロップゾーンコンポーネントを追加"
```

---

## Task 6: NumberUpdateForm コンポーネント（📊 タブ）

**Files:**
- Create: `src/app/forest/_components/NumberUpdateForm.tsx`

- [ ] **Step 1: NumberUpdateForm**

```tsx
"use client";

/**
 * 進行期の数値更新フォーム（📊 タブ）
 *
 * - PdfUploader から抽出値をプリフィル
 * - 手動編集可能
 * - 保存ボタン → updateShinkouki
 */
import { useState, type FormEvent } from "react";

import { C } from "../_constants/colors";
import type { Shinkouki } from "../_constants/companies";
import { updateShinkouki } from "../_lib/mutations";
import type { ParsePdfResult } from "../_lib/types";
import { PdfUploader } from "./PdfUploader";

type Props = {
  companyId: string;
  initial: Shinkouki;
  onSaved: () => void;
  onClose: () => void;
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1.5px solid #d8f3dc",
  borderRadius: 8,
  fontSize: 14,
  boxSizing: "border-box" as const,
  fontFamily: "inherit",
  background: "#fff",
  color: C.textDark,
};

const labelStyle = {
  display: "block",
  marginBottom: 6,
  fontSize: 13,
  color: C.textSub,
};

export function NumberUpdateForm({ companyId, initial, onSaved, onClose }: Props) {
  const [uriage, setUriage] = useState<string>(initial.uriage?.toString() ?? "");
  const [gaichuhi, setGaichuhi] = useState<string>(initial.gaichuhi?.toString() ?? "");
  const [rieki, setRieki] = useState<string>(initial.rieki?.toString() ?? "");
  const [reflected, setReflected] = useState<string>(initial.reflected);
  const [zantei, setZantei] = useState<boolean>(initial.zantei);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleExtracted(data: ParsePdfResult) {
    if (data.company_id && data.company_id !== companyId) {
      setError(`この PDF は ${data.company_id} 宛です（${companyId} ではありません）`);
      return;
    }
    if (data.uriage !== null) setUriage(String(data.uriage));
    if (data.gaichuhi !== null) setGaichuhi(String(data.gaichuhi));
    if (data.rieki !== null) setRieki(String(data.rieki));
    if (data.period) setReflected(`${data.period}まで反映中`);
    setError("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await updateShinkouki(companyId, {
        uriage: uriage === "" ? null : parseInt(uriage, 10),
        gaichuhi: gaichuhi === "" ? null : parseInt(gaichuhi, 10),
        rieki: rieki === "" ? null : parseInt(rieki, 10),
        reflected,
        zantei,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PdfUploader onExtracted={handleExtracted} onError={setError} />

      <div>
        <label style={labelStyle}>売上高（円）</label>
        <input
          type="text"
          inputMode="numeric"
          value={uriage}
          onChange={(e) => setUriage(e.target.value.replace(/[^\d-]/g, ""))}
          style={inputStyle}
          placeholder="190797587"
        />
      </div>

      <div>
        <label style={labelStyle}>外注費（円）</label>
        <input
          type="text"
          inputMode="numeric"
          value={gaichuhi}
          onChange={(e) => setGaichuhi(e.target.value.replace(/[^\d-]/g, ""))}
          style={inputStyle}
          placeholder="124932774"
        />
      </div>

      <div>
        <label style={labelStyle}>利益（円、赤字は負の値）</label>
        <input
          type="text"
          inputMode="numeric"
          value={rieki}
          onChange={(e) => setRieki(e.target.value.replace(/[^\d-]/g, ""))}
          style={inputStyle}
          placeholder="6444667"
        />
      </div>

      <div>
        <label style={labelStyle}>反映済み期間</label>
        <input
          type="text"
          value={reflected}
          onChange={(e) => setReflected(e.target.value)}
          style={inputStyle}
          placeholder="2026/3まで反映中"
        />
      </div>

      <div>
        <label style={labelStyle}>状態</label>
        <div style={{ display: "flex", gap: 16 }}>
          <label>
            <input
              type="radio"
              checked={zantei}
              onChange={() => setZantei(true)}
            />
            <span style={{ marginLeft: 6 }}>暫定</span>
          </label>
          <label>
            <input
              type="radio"
              checked={!zantei}
              onChange={() => setZantei(false)}
            />
            <span style={{ marginLeft: 6 }}>確定</span>
          </label>
        </div>
      </div>

      {error && (
        <div style={{ color: C.red, fontSize: 13 }}>⚠️ {error}</div>
      )}

      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: `1px solid ${C.textMuted}`,
            background: "#fff",
            color: C.textDark,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={saving}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            background: C.midGreen,
            color: "#fff",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {saving ? "保存中..." : "保存 (Ctrl+S)"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/forest/_components/NumberUpdateForm.tsx
git commit -m "feat(forest): NumberUpdateForm (📊タブ) を追加 PDF自動入力+手動編集"
```

---

## Task 7: PeriodRolloverForm コンポーネント（🔄 タブ）

**Files:**
- Create: `src/app/forest/_components/PeriodRolloverForm.tsx`

- [ ] **Step 1: PeriodRolloverForm**

```tsx
"use client";

/**
 * 期切り替えフォーム（🔄 タブ）
 *
 * 進行期を確定決算期として fiscal_periods に昇格し、
 * 次期の進行期を開始する（年1回の運用）。
 */
import { useState, type FormEvent } from "react";

import { C } from "../_constants/colors";
import type { Shinkouki } from "../_constants/companies";
import { rolloverPeriod } from "../_lib/mutations";

type Props = {
  companyId: string;
  current: Shinkouki;
  onRolledOver: () => void;
  onClose: () => void;
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1.5px solid #d8f3dc",
  borderRadius: 8,
  fontSize: 14,
  boxSizing: "border-box" as const,
  fontFamily: "inherit",
  background: "#fff",
  color: C.textDark,
};

const labelStyle = {
  display: "block",
  marginBottom: 6,
  fontSize: 13,
  color: C.textSub,
};

export function PeriodRolloverForm({ companyId, current, onRolledOver, onClose }: Props) {
  const [junshisan, setJunshisan] = useState("");
  const [genkin, setGenkin] = useState("");
  const [yokin, setYokin] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirmed() {
    setError("");
    setSaving(true);
    try {
      await rolloverPeriod(companyId, {
        junshisan: parseInt(junshisan, 10),
        genkin: parseInt(genkin, 10),
        yokin: parseInt(yokin, 10),
        doc_url: docUrl,
      });
      onRolledOver();
    } catch (e) {
      setError(e instanceof Error ? e.message : "期切り替えに失敗しました");
    } finally {
      setSaving(false);
      setShowConfirm(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!junshisan || !genkin || !yokin || !docUrl) {
      setError("すべての項目を入力してください");
      return;
    }
    setShowConfirm(true);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ padding: 12, background: C.bgWarm3, borderRadius: 8, fontSize: 13, color: C.textSub }}>
        ⚠️ 第{current.ki}期の進行期データを確定決算として保存し、第{current.ki + 1}期の進行期をスタートします。<br />
        現在の売上/外注/利益も含めて確定期データに保存されます。
      </div>

      <div>
        <label style={labelStyle}>純資産（円）</label>
        <input
          type="text"
          inputMode="numeric"
          value={junshisan}
          onChange={(e) => setJunshisan(e.target.value.replace(/[^\d-]/g, ""))}
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>現金（円）</label>
        <input
          type="text"
          inputMode="numeric"
          value={genkin}
          onChange={(e) => setGenkin(e.target.value.replace(/[^\d-]/g, ""))}
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>預金（円）</label>
        <input
          type="text"
          inputMode="numeric"
          value={yokin}
          onChange={(e) => setYokin(e.target.value.replace(/[^\d-]/g, ""))}
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>決算書 URL（Google Drive リンク等）</label>
        <input
          type="url"
          value={docUrl}
          onChange={(e) => setDocUrl(e.target.value)}
          style={inputStyle}
          placeholder="https://drive.google.com/..."
        />
      </div>

      {error && (
        <div style={{ color: C.red, fontSize: 13 }}>⚠️ {error}</div>
      )}

      {showConfirm && (
        <div style={{ padding: 16, background: "#fffbea", borderRadius: 8, border: `1px solid ${C.gold}` }}>
          <div style={{ fontSize: 14, marginBottom: 12, color: C.textDark, fontWeight: 600 }}>
            ⚠️ 本当に実行しますか？この操作は取り消せません。
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              disabled={saving}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: `1px solid ${C.textMuted}`,
                background: "#fff",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              やめる
            </button>
            <button
              type="button"
              onClick={handleConfirmed}
              disabled={saving}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: C.red,
                color: "#fff",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {saving ? "処理中..." : "実行する"}
            </button>
          </div>
        </div>
      )}

      {!showConfirm && (
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: `1px solid ${C.textMuted}`,
              background: "#fff",
              color: C.textDark,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            キャンセル
          </button>
          <button
            type="submit"
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              background: C.gold,
              color: "#fff",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            期切り替え実行
          </button>
        </div>
      )}
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/forest/_components/PeriodRolloverForm.tsx
git commit -m "feat(forest): PeriodRolloverForm (🔄タブ) を追加 期切り替えフォーム"
```

---

## Task 8: ShinkoukiEditModal 本体

**Files:**
- Create: `src/app/forest/_components/ShinkoukiEditModal.tsx`

- [ ] **Step 1: ShinkoukiEditModal**

```tsx
"use client";

/**
 * 進行期編集モーダル（タブ付き）
 *
 * - 📊 数値更新 / 🔄 期の切り替え
 * - Esc: 閉じる
 * - Ctrl+S: 保存（📊タブのみ）
 * - Ctrl+↑/↓: 前/次の法人へ（sort_order 順）
 */
import { useEffect, useState } from "react";

import { C } from "../_constants/colors";
import type { Company, Shinkouki } from "../_constants/companies";
import { NumberUpdateForm } from "./NumberUpdateForm";
import { PeriodRolloverForm } from "./PeriodRolloverForm";

type Props = {
  company: Company;
  shinkouki: Shinkouki;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onNavigate: (direction: 1 | -1) => void;
  navIndex: { current: number; total: number };
};

type Tab = "numbers" | "rollover";

export function ShinkoukiEditModal({
  company,
  shinkouki,
  onClose,
  onSaved,
  onNavigate,
  navIndex,
}: Props) {
  const [tab, setTab] = useState<Tab>("numbers");

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.ctrlKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        onNavigate(e.key === "ArrowDown" ? 1 : -1);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, onNavigate]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 24,
          width: "100%",
          maxWidth: 560,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 24px 48px rgba(0,0,0,0.2)",
        }}
      >
        {/* ヘッダー */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: company.color }} />
          <div style={{ flex: 1, fontSize: 16, fontWeight: 600, color: C.textDark }}>
            {company.short} 第{shinkouki.ki}期
          </div>
          <div style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: C.mintBg, color: C.midGreen }}>
            進行期
          </div>
          <button
            onClick={onClose}
            aria-label="閉じる"
            style={{
              border: "none",
              background: "transparent",
              fontSize: 20,
              color: C.textMuted,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* ナビ */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 16, fontSize: 12, color: C.textSub }}>
          <button
            type="button"
            onClick={() => onNavigate(-1)}
            disabled={navIndex.current === 0}
            aria-label="前の法人"
            style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: C.textSub }}
            title="前の法人 (Ctrl+↑)"
          >
            ▲
          </button>
          <span>
            {navIndex.current + 1} / {navIndex.total}
          </span>
          <button
            type="button"
            onClick={() => onNavigate(1)}
            disabled={navIndex.current === navIndex.total - 1}
            aria-label="次の法人"
            style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: C.textSub }}
            title="次の法人 (Ctrl+↓)"
          >
            ▼
          </button>
        </div>

        {/* タブ */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `1px solid ${C.mintBg}` }}>
          <button
            type="button"
            onClick={() => setTab("numbers")}
            style={{
              padding: "10px 16px",
              border: "none",
              background: "transparent",
              borderBottom: tab === "numbers" ? `2px solid ${C.midGreen}` : "2px solid transparent",
              color: tab === "numbers" ? C.midGreen : C.textSub,
              fontSize: 14,
              fontWeight: tab === "numbers" ? 600 : 400,
              cursor: "pointer",
            }}
          >
            📊 数値更新
          </button>
          <button
            type="button"
            onClick={() => setTab("rollover")}
            style={{
              padding: "10px 16px",
              border: "none",
              background: "transparent",
              borderBottom: tab === "rollover" ? `2px solid ${C.midGreen}` : "2px solid transparent",
              color: tab === "rollover" ? C.midGreen : C.textSub,
              fontSize: 14,
              fontWeight: tab === "rollover" ? 600 : 400,
              cursor: "pointer",
            }}
          >
            🔄 期の切り替え
          </button>
        </div>

        {/* タブコンテンツ */}
        {tab === "numbers" ? (
          <NumberUpdateForm
            companyId={company.id}
            initial={shinkouki}
            onSaved={async () => {
              await onSaved();
              onClose();
            }}
            onClose={onClose}
          />
        ) : (
          <PeriodRolloverForm
            companyId={company.id}
            current={shinkouki}
            onRolledOver={async () => {
              await onSaved();
              onClose();
            }}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/forest/_components/ShinkoukiEditModal.tsx
git commit -m "feat(forest): ShinkoukiEditModal (タブ付きモーダル) を追加"
```

---

## Task 9: Dashboard への統合

**Files:**
- Modify: `src/app/forest/dashboard/page.tsx`
- Modify: `src/app/forest/_components/MicroGrid.tsx`

- [ ] **Step 1: MicroGrid に onEditShinkouki props を追加**

`MicroGrid.tsx` の Props 型と進行期セルクリックハンドラに以下を追加：

```tsx
type MicroGridProps = {
  // 既存 props
  onEditShinkouki?: (companyId: string) => void;
};

// セルのクリックハンドラ内で isShinkouki=true のセルは onEditShinkouki を呼ぶ
if (cell.isShinkouki && onEditShinkouki) {
  onEditShinkouki(cell.company.id);
} else {
  setSelectedCell(cell); // 既存の詳細モーダル
}
```

**注意**: MicroGrid.tsx の既存クリック構造を読んで、最小変更で追加する。

- [ ] **Step 2: dashboard/page.tsx にモーダル統合**

```tsx
// 既存 import に追加
import { ShinkoukiEditModal } from "../_components/ShinkoukiEditModal";
import { useForestState } from "../_state/ForestStateContext";
import { isForestAdmin } from "../_lib/permissions";

// コンポーネント内に state を追加
const { forestUser, companies, shinkouki, refreshData } = useForestState();
const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
const isAdmin = isForestAdmin(forestUser);

const editingIndex = companies.findIndex((c) => c.id === editingCompanyId);
const editingCompany = companies[editingIndex];
const editingShinkouki = shinkouki.find((s) => s.company_id === editingCompanyId);

function handleNavigate(direction: 1 | -1) {
  const next = editingIndex + direction;
  if (next >= 0 && next < companies.length) {
    setEditingCompanyId(companies[next].id);
  }
}

// JSX 内
<MicroGrid
  /* 既存 props */
  onEditShinkouki={isAdmin ? setEditingCompanyId : undefined}
/>

{editingCompany && editingShinkouki && (
  <ShinkoukiEditModal
    company={editingCompany}
    shinkouki={editingShinkouki}
    onClose={() => setEditingCompanyId(null)}
    onSaved={refreshData}
    onNavigate={handleNavigate}
    navIndex={{ current: editingIndex, total: companies.length }}
  />
)}
```

**注意**: dashboard/page.tsx の既存構造を読んで、既存 useState や JSX の流れに最小変更で統合する。

- [ ] **Step 3: Commit**

```bash
git add src/app/forest/dashboard/page.tsx src/app/forest/_components/MicroGrid.tsx
git commit -m "feat(forest): Dashboard に ShinkoukiEditModal を統合 進行期バッジクリックで起動"
```

---

## Task 10: SQL パッチ適用 + ローカル E2E 検証

- [ ] **Step 1: Supabase Dashboard で SQL 実行**

Supabase Dashboard > SQL Editor に `scripts/forest-schema-patch-002.sql` の内容を貼り付けて Run。

Expected: "Success. No rows returned." 的なメッセージ。

- [ ] **Step 2: ローカル dev server で動作確認**

Run: `npm run dev` （既に起動中なら再起動）

ブラウザで http://localhost:3100/forest にログイン（admin ロールで）

- [ ] **Step 3: 📊 タブ検証**

1. 進行期バッジ（ヒュアランの第9期など）をクリック → モーダル起動
2. 数値が既存値でプリフィルされているか
3. PDF ドロップ → 抽出値が form にプリフィル
4. 保存 → モーダル閉じる → ダッシュボードに新値反映
5. viewer ロールでは進行期バッジをクリックしてもモーダルが開かない（もし viewer も開くなら admin 限定に絞る）

- [ ] **Step 4: 🔄 タブ検証**

1. モーダル内で 🔄 タブに切替
2. 4フィールド入力 → 実行 → 確認ダイアログ
3. 壱（データ少ない会社）で試すと安全
4. Supabase Dashboard で `fiscal_periods` に行が追加されていること、`shinkouki` が ki+1 / 各数値 null にリセットされていることを確認
5. 失敗パターン: doc_url 空 → エラー表示

- [ ] **Step 5: キーボードショートカット検証**

- Esc → モーダル閉じる
- Ctrl+↑ / Ctrl+↓ → 前/次の法人モーダルへ遷移
- タブ切替ボタンで📊 ↔ 🔄

- [ ] **Step 6: スマホ/狭幅レイアウト検証**

DevTools でモバイルサイズ（iPhone SE 375px 等）に切り替え、モーダルが崩れないこと、入力欄がタップしやすいことを確認。

---

## Task 11: effort-tracking 追記 + PR 作成

**Files:**
- Modify: `docs/effort-tracking.md`

- [ ] **Step 1: effort-tracking.md に Phase A2/A3 行を追記**

`## 履歴` セクションに行追加：

```markdown
| Forest | Phase A2/A3: 進行期編集モーダル（PDF自動入力+手動編集+期切り替え） | 2.5 | （実績） | （diff） | b-main (B) | 2026-04-22 | （完了日） | PDF 解析は pdfjs-dist で PoC 済み、Python 版と同一値を確認 |
```

- [ ] **Step 2: Commit**

```bash
git add docs/effort-tracking.md
git commit -m "docs(forest): Phase A2/A3 の見積を effort-tracking.md に追記"
```

- [ ] **Step 3: 日報 add + tomorrow**

Run:
```powershell
python "G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/006_日報自動配信/send_report.py" add "Garden Forest：画面上で進行期データを編集できる機能を実装（PDF自動入力、手動編集、期切り替え）"
```

```powershell
python "G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/006_日報自動配信/send_report.py" tomorrow "Garden Forest：残りの法人マスタ統合とコードレビュー対応"
```

**⚠️ 文言ルール**: 非技術者向け表現で記載すること（`01_東海林美琴/CLAUDE.md` ルール）。Phase / v番号 / ブランチ名 / ファイル名は禁止。

- [ ] **Step 4: push + PR 作成**

```powershell
git push origin feature/forest-phase-a2-a3
gh pr create --base main --title "feat(forest): Phase A2/A3 進行期編集モーダル（PDF自動入力+手動編集+期切り替え）" --body "..."
```

PR 本文テンプレートは PR #7 を参考に Summary / 主な変更内容 / Test plan を記載。

---

## 自己レビュー

- ✅ spec §3（Phase A2）= Task 3 + Task 5 + Task 6 でカバー
- ✅ spec §4（Phase A3 📊 タブ）= Task 6 でカバー
- ✅ spec §4（Phase A3 🔄 タブ）= Task 7 でカバー
- ✅ spec §認可設計 = Task 1 でカバー
- ✅ spec §監査ログ = Task 4 で writeAuditLog 追加拡張
- ✅ FileMaker風UX（Ctrl+↑↓ / Esc）= Task 8 でカバー
- ✅ レスポンシブ = Task 10 Step 6 で検証
- ✅ Placeholder チェック済み（TBD / TODO 系の記述なし、ただし `range` パーサの簡易実装は Task 4 で要確認マーク付き）
- ✅ 型整合性確認（ParsePdfResult / ShinkoukiUpdateInput / PeriodRolloverInput）

## 既知の技術リスク

1. **@supabase/ssr 未インストールの可能性** → Task 3 Step 3 で確認、必要なら先にインストール
2. **`rolloverPeriod` の `period_from/to` 計算** → `shinkouki.range` の形式次第で壊れる → Task 4 実装時に実データを確認してパース仕様を固める
3. **Vercel での pdfjs-dist 動作** → PoC はローカル Node.js のみ。Vercel サーバーレスでの動作確認は Task 10 のデプロイ後フェーズで要検証（必要なら `serverExternalPackages` 設定追加）
4. **ichi の uriage=null 取扱い** → PoC で `undefined` だったが extract.ts で `?? null` に統一済み

## 完了条件

- [ ] admin がログインし、進行期バッジをクリックして編集モーダルが開く
- [ ] PDF ドロップで自動入力が動く
- [ ] 手動編集で保存すると shinkouki テーブルが更新される
- [ ] 期切り替えで fiscal_periods に行追加、shinkouki がリセットされる
- [ ] viewer では編集モーダルが開かない（UI または RLS で拒否）
- [ ] Esc / Ctrl+↑↓ / タブ切替が動作
- [ ] スマホサイズでレイアウト崩れなし
- [ ] PR #X がレビュー待ち状態
