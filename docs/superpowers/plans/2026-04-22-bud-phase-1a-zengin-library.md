# Garden-Bud Phase 1a — 全銀協CSV ライブラリ 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/lib/zengin/` に全銀協フォーマット（総合振込データ、120 byte 固定長、Shift-JIS）の CSV 生成ライブラリを TDD で作成する。楽天銀行・みずほ銀行・PayPay 銀行の 3 行取込に対応、京都銀行は差替え枠のみ（実装なし）。

**Architecture:**
- Pure functional TypeScript library（副作用なし、React 非依存、テスト容易）
- 責務分離: types / kana-converter / validator / records / bank-specific / generator
- Shift-JIS エンコードは `iconv-lite` 経由（Node.js の TextEncoder は UTF-8 のみのため）
- 4 レコード種別（ヘッダ / データ / トレーラ / エンド）を個別ファイルで表現
- 将来の銀行追加に備え、銀行別差異を `bank-specific.ts` に集約

**Tech Stack:**
- TypeScript 5.x strict mode
- Vitest 2.x（test runner、新規導入、**Task 0 で東海林さんの承認必要**）
- iconv-lite（Shift-JIS エンコード、**Task 0 で承認必要**）

**参照 Spec:** `docs/superpowers/specs/2026-04-22-bud-design-v2.md` §5（Phase 1a）

**見積工数:** 0.5d（effort-tracking.md 記載の通り）

---

## 前提条件

- [x] Phase 0 認証基盤が完了・push 済み
- [ ] **Task 0 の npm パッケージ追加（vitest + iconv-lite）を東海林さんが承認**
- [ ] 楽天銀行・みずほ銀行・PayPay 銀行のネットバンキング「総合振込 データ受信（取込）」画面にアクセス可能

---

## ファイル構成

```
src/lib/zengin/
  ├─ index.ts              — 公開 API の再エクスポート
  ├─ types.ts              — 型定義（BankType、BudTransfer 抜粋、BankAccount、ZenginOptions 等）
  ├─ kana-converter.ts     — 半角カタカナ変換（純関数）
  ├─ validator.ts          — 振込データバリデーション（純関数）
  ├─ encoding.ts           — Shift-JIS エンコード（iconv-lite ラッパー）
  ├─ bank-specific.ts      — 銀行別差異（拡張子・EOF マーク・楽天サービス区分）
  ├─ generator.ts          — CSV 組立の orchestrator
  ├─ records/
  │   ├─ header.ts         — ヘッダレコード（種別 1、120 byte）
  │   ├─ data.ts           — データレコード（種別 2、120 byte）
  │   ├─ trailer.ts        — トレーラレコード（種別 8、120 byte）
  │   └─ end.ts            — エンドレコード（種別 9、120 byte）
  └─ __tests__/
      ├─ kana-converter.test.ts
      ├─ validator.test.ts
      ├─ bank-specific.test.ts
      ├─ records/
      │   ├─ header.test.ts
      │   ├─ data.test.ts
      │   ├─ trailer.test.ts
      │   └─ end.test.ts
      ├─ encoding.test.ts
      ├─ generator.test.ts
      └─ fixtures/
          ├─ sample-transfers.ts
          └─ expected-outputs/
              ├─ rakuten-sample.txt
              ├─ mizuho-sample.txt
              └─ paypay-sample.txt

vitest.config.ts          — プロジェクトルートに新規作成
package.json              — devDependencies + scripts 追加
```

---

## Task 0: テスト環境セットアップ（⚠️ 要承認）

**Files:**
- Modify: `package.json`（devDependencies + scripts 追加）
- Create: `vitest.config.ts`

**⚠️ 東海林さんの承認が必要:**
- `vitest ^2.1.0` （テストランナー）
- `@vitest/ui ^2.1.0` （ブラウザ UI で結果閲覧、任意）
- `iconv-lite ^0.6.3` （Shift-JIS エンコード、型定義同梱）

**承認いただいた後、以下を実行します:**

- [ ] **Step 1: npm パッケージインストール**

Run:
```bash
npm install --save-dev vitest@^2.1.0 @vitest/ui@^2.1.0
npm install iconv-lite@^0.6.3
```

Expected: package.json / package-lock.json 更新、node_modules に追加。

- [ ] **Step 2: vitest.config.ts を作成**

Create: `vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 3: package.json に scripts 追加**

Modify: `package.json`（"scripts" セクション）

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:ui": "vitest --ui"
}
```

- [ ] **Step 4: 空実行で vitest 動作確認**

Run: `npm test`
Expected: `No test files found` または類似（エラーにならず実行完了）。

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore(bud): テスト環境セットアップ（vitest + iconv-lite）"
```

---

## Task 1: 型定義

**Files:**
- Create: `src/lib/zengin/types.ts`

**Step 1: 型定義ファイル作成**

- [ ] Create `src/lib/zengin/types.ts`:

```typescript
/**
 * Garden-Bud / 全銀協 CSV ライブラリ — 型定義
 *
 * 全銀協フォーマット（総合振込データ）は 120 byte 固定長の半角 Shift-JIS。
 * 4 種類のレコード（ヘッダ/データ/トレーラ/エンド）で1ファイルを構成する。
 */

/** 対応銀行（京都銀行は枠のみ、実装なし） */
export type BankType = "rakuten" | "mizuho" | "paypay" | "kyoto";

/** 預金種目コード（全銀協仕様） */
export type AccountTypeCode = "1" | "2" | "4"; // 1=普通, 2=当座, 4=貯蓄

/** 振込データ（bud_transfers の抜粋、CSV 生成に必要な項目のみ） */
export interface ZenginTransferInput {
  /** 振込先金融機関コード（4桁数字） */
  payee_bank_code: string;
  /** 振込先支店コード（3桁数字） */
  payee_branch_code: string;
  /** 預金種目 */
  payee_account_type: AccountTypeCode;
  /** 口座番号（最大7桁数字） */
  payee_account_number: string;
  /** 受取人名（半角カタカナに変換前、漢字・ひらがな・全角カナ等） */
  payee_account_holder_kana: string;
  /** 振込金額（正の整数、円） */
  amount: number;
  /** EDI 情報（任意、半角20桁以内、description の冒頭を使用） */
  edi_info?: string;
  /** 顧客コード1（任意、10桁） */
  customer_code_1?: string;
  /** 顧客コード2（任意、10桁） */
  customer_code_2?: string;
}

/** 振込元口座情報（ヘッダレコードに入る情報） */
export interface ZenginSourceAccount {
  /** 依頼人コード（全銀協から付与される10桁、銀行により運用が異なる） */
  consignor_code: string;
  /** 依頼人名（半角カタカナ40桁以内） */
  consignor_name: string;
  /** 振込指定日（MMDD 形式、4桁） */
  transfer_date: string;
  /** 振込元金融機関コード（4桁） */
  source_bank_code: string;
  /** 振込元金融機関名（半角カタカナ15桁以内） */
  source_bank_name: string;
  /** 振込元支店コード（3桁） */
  source_branch_code: string;
  /** 振込元支店名（半角カタカナ15桁以内） */
  source_branch_name: string;
  /** 振込元預金種目 */
  source_account_type: AccountTypeCode;
  /** 振込元口座番号（7桁） */
  source_account_number: string;
}

/** CSV 生成オプション（銀行別差異吸収） */
export interface ZenginOptions {
  bank: BankType;
}

/** バリデーション結果 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** CSV 生成結果 */
export interface GenerateResult {
  /** Shift-JIS エンコード済み Buffer */
  content: Buffer;
  /** 推奨ファイル名 */
  filename: string;
  /** レコード件数（データレコード数） */
  recordCount: number;
  /** 合計金額 */
  totalAmount: number;
}
```

**Step 2: Commit**

- [ ] Run:
```bash
git add src/lib/zengin/types.ts
git commit -m "feat(bud): 全銀協CSV ライブラリの型定義を追加"
```

---

## Task 2: 半角カタカナ変換（TDD）

**Files:**
- Create: `src/lib/zengin/kana-converter.ts`
- Test: `src/lib/zengin/__tests__/kana-converter.test.ts`

**Step 1: 失敗するテストを書く**

- [ ] Create `src/lib/zengin/__tests__/kana-converter.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { toHalfWidthKana } from "../kana-converter";

describe("toHalfWidthKana", () => {
  it("全角カタカナを半角カタカナに変換する", () => {
    const result = toHalfWidthKana("ヤマダ タロウ");
    expect(result.kana).toBe("ﾔﾏﾀﾞ ﾀﾛｳ");
    expect(result.warnings).toEqual([]);
  });

  it("濁点・半濁点を適切に分解する", () => {
    const result = toHalfWidthKana("ガギグゲゴパピプペポ");
    expect(result.kana).toBe("ｶﾞｷﾞｸﾞｹﾞｺﾞﾊﾟﾋﾟﾌﾟﾍﾟﾎﾟ");
  });

  it("ひらがなは自動で全角カタカナ経由で半角カタカナに変換する", () => {
    const result = toHalfWidthKana("やまだ");
    expect(result.kana).toBe("ﾔﾏﾀﾞ");
  });

  it("全角英数字を半角に変換する", () => {
    const result = toHalfWidthKana("ABC123");
    expect(result.kana).toBe("ABC123");
  });

  it("半角英数字はそのまま通す", () => {
    const result = toHalfWidthKana("ABC123");
    expect(result.kana).toBe("ABC123");
  });

  it("許可記号（.-()/,）はそのまま通す", () => {
    const result = toHalfWidthKana("カ)ヤマダ.ABC-123(1)");
    expect(result.kana).toBe("ｶ)ﾔﾏﾀﾞ.ABC-123(1)");
  });

  it("漢字は変換できないので警告を出し、該当文字を除去する", () => {
    const result = toHalfWidthKana("山田太郎");
    expect(result.kana).toBe("");
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("変換不能");
  });

  it("空文字列は空文字列を返す", () => {
    const result = toHalfWidthKana("");
    expect(result.kana).toBe("");
    expect(result.warnings).toEqual([]);
  });

  it("前後の空白をトリムする", () => {
    const result = toHalfWidthKana("  ヤマダ  ");
    expect(result.kana).toBe("ﾔﾏﾀﾞ");
  });
});
```

**Step 2: テスト実行して失敗を確認**

- [ ] Run: `npm test -- kana-converter`
- [ ] Expected: FAIL（モジュールが存在しない）

**Step 3: 実装を書く**

- [ ] Create `src/lib/zengin/kana-converter.ts`:

```typescript
/**
 * Garden-Bud / 全銀協 CSV — 半角カタカナ変換
 *
 * 全銀協フォーマットの受取人名カナは「半角カタカナ30桁」で指定。
 * 入力が漢字・ひらがな・全角カナ混在でも、可能な限り半角カタカナに変換する。
 * 変換不能な文字（漢字等）は除去 + 警告を返す。
 *
 * 使用可能文字（全銀協仕様）:
 *   半角カタカナ: ｱ-ﾝ + ﾞﾟｰ
 *   半角英数: 0-9 A-Z（小文字は大文字化）
 *   記号: スペース . - ( ) / ,
 */

const FULL_TO_HALF_KATAKANA_MAP: Record<string, string> = {
  // 清音
  "ア": "ｱ", "イ": "ｲ", "ウ": "ｳ", "エ": "ｴ", "オ": "ｵ",
  "カ": "ｶ", "キ": "ｷ", "ク": "ｸ", "ケ": "ｹ", "コ": "ｺ",
  "サ": "ｻ", "シ": "ｼ", "ス": "ｽ", "セ": "ｾ", "ソ": "ｿ",
  "タ": "ﾀ", "チ": "ﾁ", "ツ": "ﾂ", "テ": "ﾃ", "ト": "ﾄ",
  "ナ": "ﾅ", "ニ": "ﾆ", "ヌ": "ﾇ", "ネ": "ﾈ", "ノ": "ﾉ",
  "ハ": "ﾊ", "ヒ": "ﾋ", "フ": "ﾌ", "ヘ": "ﾍ", "ホ": "ﾎ",
  "マ": "ﾏ", "ミ": "ﾐ", "ム": "ﾑ", "メ": "ﾒ", "モ": "ﾓ",
  "ヤ": "ﾔ", "ユ": "ﾕ", "ヨ": "ﾖ",
  "ラ": "ﾗ", "リ": "ﾘ", "ル": "ﾙ", "レ": "ﾚ", "ロ": "ﾛ",
  "ワ": "ﾜ", "ヲ": "ｦ", "ン": "ﾝ",
  // 濁音（濁点を後ろにつける）
  "ガ": "ｶﾞ", "ギ": "ｷﾞ", "グ": "ｸﾞ", "ゲ": "ｹﾞ", "ゴ": "ｺﾞ",
  "ザ": "ｻﾞ", "ジ": "ｼﾞ", "ズ": "ｽﾞ", "ゼ": "ｾﾞ", "ゾ": "ｿﾞ",
  "ダ": "ﾀﾞ", "ヂ": "ﾁﾞ", "ヅ": "ﾂﾞ", "デ": "ﾃﾞ", "ド": "ﾄﾞ",
  "バ": "ﾊﾞ", "ビ": "ﾋﾞ", "ブ": "ﾌﾞ", "ベ": "ﾍﾞ", "ボ": "ﾎﾞ",
  "ヴ": "ｳﾞ",
  // 半濁音
  "パ": "ﾊﾟ", "ピ": "ﾋﾟ", "プ": "ﾌﾟ", "ペ": "ﾍﾟ", "ポ": "ﾎﾟ",
  // 小書き
  "ァ": "ｧ", "ィ": "ｨ", "ゥ": "ｩ", "ェ": "ｪ", "ォ": "ｫ",
  "ッ": "ｯ", "ャ": "ｬ", "ュ": "ｭ", "ョ": "ｮ",
  // 長音・中点
  "ー": "-", "・": ".",
};

/** 全角英数字を半角に変換するテーブル（オフセット計算） */
function toHalfWidthAlnum(char: string): string {
  const code = char.charCodeAt(0);
  // 全角数字 0-9（U+FF10 - U+FF19）
  if (code >= 0xff10 && code <= 0xff19) {
    return String.fromCharCode(code - 0xfee0);
  }
  // 全角英大文字 A-Z（U+FF21 - U+FF3A）
  if (code >= 0xff21 && code <= 0xff3a) {
    return String.fromCharCode(code - 0xfee0);
  }
  // 全角英小文字 a-z → 大文字化
  if (code >= 0xff41 && code <= 0xff5a) {
    return String.fromCharCode(code - 0xfee0 - 0x20);
  }
  // 全角スペース
  if (code === 0x3000) return " ";
  return char;
}

/** ひらがな → 全角カタカナ */
function hiraganaToKatakana(char: string): string {
  const code = char.charCodeAt(0);
  // ひらがな U+3041 - U+3096
  if (code >= 0x3041 && code <= 0x3096) {
    return String.fromCharCode(code + 0x60);
  }
  return char;
}

/** 半角文字として既に使用可能か */
function isAllowedHalfWidth(char: string): boolean {
  return /^[\x20-\x7E\uFF61-\uFF9F]$/.test(char);
}

/**
 * 入力文字列を半角カタカナ（全銀協仕様）に変換する。
 *
 * @returns { kana, warnings }
 *   - kana: 変換後の文字列（変換不能文字は除去）
 *   - warnings: 除去された文字の警告メッセージ
 */
export function toHalfWidthKana(input: string): {
  kana: string;
  warnings: string[];
} {
  const trimmed = input.trim();
  const warnings: string[] = [];
  let result = "";

  for (const char of trimmed) {
    // まずひらがな → カタカナ
    const katakana = hiraganaToKatakana(char);

    // 全角カタカナ → 半角カタカナ
    if (FULL_TO_HALF_KATAKANA_MAP[katakana]) {
      result += FULL_TO_HALF_KATAKANA_MAP[katakana];
      continue;
    }

    // 全角英数 → 半角英数（大文字）
    const alnum = toHalfWidthAlnum(katakana);
    if (alnum !== katakana || isAllowedHalfWidth(alnum)) {
      // 英数字や許可記号の場合、大文字化して通す
      result += alnum.toUpperCase() === alnum ? alnum : alnum.toUpperCase();
      continue;
    }

    // 半角英小文字 → 大文字
    if (/[a-z]/.test(katakana)) {
      result += katakana.toUpperCase();
      continue;
    }

    // 変換不能
    warnings.push(`変換不能文字を除去: "${char}"`);
  }

  return { kana: result, warnings };
}
```

**Step 4: テスト実行して成功を確認**

- [ ] Run: `npm test -- kana-converter`
- [ ] Expected: すべての test が PASS

**Step 5: Commit**

- [ ] Run:
```bash
git add src/lib/zengin/kana-converter.ts src/lib/zengin/__tests__/kana-converter.test.ts
git commit -m "feat(bud): 全銀協CSV ライブラリ — 半角カタカナ変換を追加"
```

---

## Task 3: バリデータ（TDD）

**Files:**
- Create: `src/lib/zengin/validator.ts`
- Test: `src/lib/zengin/__tests__/validator.test.ts`

**Step 1: 失敗するテストを書く**

- [ ] Create `src/lib/zengin/__tests__/validator.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { validateTransfer } from "../validator";
import type { ZenginTransferInput } from "../types";

function makeValid(): ZenginTransferInput {
  return {
    payee_bank_code: "0001",
    payee_branch_code: "100",
    payee_account_type: "1",
    payee_account_number: "1234567",
    payee_account_holder_kana: "ヤマダ タロウ",
    amount: 10000,
  };
}

describe("validateTransfer", () => {
  it("正常なデータなら valid=true", () => {
    const result = validateTransfer(makeValid());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("銀行コードが4桁数字以外ならエラー", () => {
    const t = { ...makeValid(), payee_bank_code: "ABC" };
    const result = validateTransfer(t);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("銀行コード"))).toBe(true);
  });

  it("銀行コードが3桁ならエラー", () => {
    const t = { ...makeValid(), payee_bank_code: "123" };
    const result = validateTransfer(t);
    expect(result.valid).toBe(false);
  });

  it("支店コードが3桁数字以外ならエラー", () => {
    const t = { ...makeValid(), payee_branch_code: "12A" };
    expect(validateTransfer(t).valid).toBe(false);
  });

  it("口座番号が7桁超ならエラー", () => {
    const t = { ...makeValid(), payee_account_number: "12345678" };
    expect(validateTransfer(t).valid).toBe(false);
  });

  it("口座番号が空ならエラー", () => {
    const t = { ...makeValid(), payee_account_number: "" };
    expect(validateTransfer(t).valid).toBe(false);
  });

  it("口座番号が7桁未満でも valid（自動 0 埋めされる前提）", () => {
    const t = { ...makeValid(), payee_account_number: "123" };
    expect(validateTransfer(t).valid).toBe(true);
  });

  it("金額が 0 以下ならエラー", () => {
    const t = { ...makeValid(), amount: 0 };
    expect(validateTransfer(t).valid).toBe(false);
    const t2 = { ...makeValid(), amount: -100 };
    expect(validateTransfer(t2).valid).toBe(false);
  });

  it("金額が 10桁超（9,999,999,999 円超）ならエラー", () => {
    const t = { ...makeValid(), amount: 10_000_000_000 };
    expect(validateTransfer(t).valid).toBe(false);
  });

  it("金額が小数ならエラー", () => {
    const t = { ...makeValid(), amount: 100.5 };
    expect(validateTransfer(t).valid).toBe(false);
  });

  it("受取人名カナが空ならエラー", () => {
    const t = { ...makeValid(), payee_account_holder_kana: "" };
    expect(validateTransfer(t).valid).toBe(false);
  });

  it("受取人名カナが半角 30 桁超ならエラー", () => {
    // 半角カタカナで 31 文字
    const t = {
      ...makeValid(),
      payee_account_holder_kana: "ｱ".repeat(31),
    };
    expect(validateTransfer(t).valid).toBe(false);
  });

  it("受取人名カナに漢字が含まれる場合、警告のみ（半角変換後に削除される）", () => {
    const t = { ...makeValid(), payee_account_holder_kana: "山田タロウ" };
    const result = validateTransfer(t);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("預金種目が 1/2/4 以外はエラー（型レベルで弾かれるが念のため）", () => {
    const t = { ...makeValid(), payee_account_type: "9" as "1" };
    expect(validateTransfer(t).valid).toBe(false);
  });
});
```

**Step 2: テスト実行して失敗を確認**

- [ ] Run: `npm test -- validator`
- [ ] Expected: FAIL

**Step 3: 実装を書く**

- [ ] Create `src/lib/zengin/validator.ts`:

```typescript
/**
 * Garden-Bud / 全銀協 CSV — バリデーション
 *
 * 振込1件ごとに、全銀協フォーマットが要求する各項目の妥当性を検証する。
 * エラーがあれば valid=false で errors を返す（CSV 生成は中断）。
 */

import type { ZenginTransferInput, ValidationResult } from "./types";
import { toHalfWidthKana } from "./kana-converter";

const MAX_AMOUNT = 9_999_999_999; // 10桁上限
const MAX_KANA_LENGTH = 30;
const VALID_ACCOUNT_TYPES = ["1", "2", "4"];

function isDigitString(value: string, length: number): boolean {
  return new RegExp(`^\\d{${length}}$`).test(value);
}

function isDigitStringUpTo(value: string, maxLength: number): boolean {
  return new RegExp(`^\\d{1,${maxLength}}$`).test(value);
}

export function validateTransfer(t: ZenginTransferInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 銀行コード（4桁数字）
  if (!isDigitString(t.payee_bank_code, 4)) {
    errors.push(
      `銀行コードは4桁の数字である必要があります: "${t.payee_bank_code}"`,
    );
  }

  // 支店コード（3桁数字）
  if (!isDigitString(t.payee_branch_code, 3)) {
    errors.push(
      `支店コードは3桁の数字である必要があります: "${t.payee_branch_code}"`,
    );
  }

  // 預金種目（1/2/4）
  if (!VALID_ACCOUNT_TYPES.includes(t.payee_account_type)) {
    errors.push(
      `預金種目は 1(普通) / 2(当座) / 4(貯蓄) のいずれかです: "${t.payee_account_type}"`,
    );
  }

  // 口座番号（1〜7桁数字）
  if (!isDigitStringUpTo(t.payee_account_number, 7)) {
    errors.push(
      `口座番号は1〜7桁の数字である必要があります: "${t.payee_account_number}"`,
    );
  }

  // 受取人名カナ（空でない、変換後30桁以内）
  if (!t.payee_account_holder_kana || t.payee_account_holder_kana.trim() === "") {
    errors.push("受取人名カナが空です");
  } else {
    const { kana, warnings: kanaWarnings } = toHalfWidthKana(
      t.payee_account_holder_kana,
    );
    warnings.push(...kanaWarnings);
    if (kana.length > MAX_KANA_LENGTH) {
      errors.push(
        `受取人名カナは半角 ${MAX_KANA_LENGTH} 桁以内です: "${kana}" (${kana.length}桁)`,
      );
    }
    if (kana.length === 0) {
      errors.push("受取人名カナが変換後に空になりました（漢字等のみの入力）");
    }
  }

  // 金額（正の整数、上限）
  if (!Number.isInteger(t.amount)) {
    errors.push(`金額は整数である必要があります: ${t.amount}`);
  } else if (t.amount <= 0) {
    errors.push(`金額は 1 円以上である必要があります: ${t.amount}`);
  } else if (t.amount > MAX_AMOUNT) {
    errors.push(
      `金額が上限を超えています（最大 ${MAX_AMOUNT.toLocaleString()} 円）: ${t.amount}`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
```

**Step 4: テスト実行して成功を確認**

- [ ] Run: `npm test -- validator`
- [ ] Expected: すべての test が PASS

**Step 5: Commit**

- [ ] Run:
```bash
git add src/lib/zengin/validator.ts src/lib/zengin/__tests__/validator.test.ts
git commit -m "feat(bud): 全銀協CSV ライブラリ — バリデータを追加"
```

---

## Task 4: ヘッダレコード（TDD）

**Files:**
- Create: `src/lib/zengin/records/header.ts`
- Test: `src/lib/zengin/__tests__/records/header.test.ts`

**Step 1: 失敗するテストを書く**

- [ ] Create `src/lib/zengin/__tests__/records/header.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildHeaderRecord } from "../../records/header";
import type { ZenginSourceAccount } from "../../types";

const sourceAccount: ZenginSourceAccount = {
  consignor_code: "0000001234",
  consignor_name: "ｶ)ﾋｭｱﾗﾝ",
  transfer_date: "0425",
  source_bank_code: "0036",
  source_bank_name: "ﾗｸﾃﾝ",
  source_branch_code: "251",
  source_branch_name: "ﾀﾞｲｲﾁｴｲｷﾞｮｳ",
  source_account_type: "1",
  source_account_number: "7853952",
};

describe("buildHeaderRecord", () => {
  it("ヘッダレコードが 120 byte 固定長", () => {
    const record = buildHeaderRecord(sourceAccount);
    expect(record.length).toBe(120);
  });

  it("レコード種別が '1'（ヘッダ）で始まる", () => {
    const record = buildHeaderRecord(sourceAccount);
    expect(record[0]).toBe("1");
  });

  it("種別コード '21'（総合振込）が2桁目以降にある", () => {
    const record = buildHeaderRecord(sourceAccount);
    expect(record.substring(1, 3)).toBe("21");
  });

  it("コード区分が '0'（JIS漢字）", () => {
    const record = buildHeaderRecord(sourceAccount);
    expect(record.substring(3, 4)).toBe("0");
  });

  it("依頼人コードが10桁で入る", () => {
    const record = buildHeaderRecord(sourceAccount);
    expect(record.substring(4, 14)).toBe("0000001234");
  });

  it("依頼人名が40桁で左詰め、右側空白埋め", () => {
    const record = buildHeaderRecord(sourceAccount);
    const consignorNameField = record.substring(14, 54);
    expect(consignorNameField.length).toBe(40);
    expect(consignorNameField.trim()).toBe("ｶ)ﾋｭｱﾗﾝ");
  });

  it("振込指定日が4桁（MMDD）", () => {
    const record = buildHeaderRecord(sourceAccount);
    expect(record.substring(54, 58)).toBe("0425");
  });

  it("振込元金融機関コードが4桁", () => {
    const record = buildHeaderRecord(sourceAccount);
    expect(record.substring(58, 62)).toBe("0036");
  });

  it("振込元金融機関名が15桁で左詰め右空白埋め", () => {
    const record = buildHeaderRecord(sourceAccount);
    expect(record.substring(62, 77).trim()).toBe("ﾗｸﾃﾝ");
    expect(record.substring(62, 77).length).toBe(15);
  });

  it("振込元支店コードが3桁", () => {
    const record = buildHeaderRecord(sourceAccount);
    expect(record.substring(77, 80)).toBe("251");
  });

  it("振込元支店名が15桁で左詰め右空白埋め", () => {
    const record = buildHeaderRecord(sourceAccount);
    expect(record.substring(80, 95).trim()).toBe("ﾀﾞｲｲﾁｴｲｷﾞｮｳ");
  });

  it("振込元預金種目（1桁）と口座番号（7桁）", () => {
    const record = buildHeaderRecord(sourceAccount);
    expect(record.substring(95, 96)).toBe("1");
    expect(record.substring(96, 103)).toBe("7853952");
  });

  it("末尾のダミー（17桁）が空白埋め", () => {
    const record = buildHeaderRecord(sourceAccount);
    expect(record.substring(103, 120)).toBe(" ".repeat(17));
  });
});
```

**Step 2: テスト実行して失敗を確認**

- [ ] Run: `npm test -- records/header`
- [ ] Expected: FAIL

**Step 3: 実装を書く**

- [ ] Create `src/lib/zengin/records/header.ts`:

```typescript
/**
 * Garden-Bud / 全銀協 CSV — ヘッダレコード（種別 1）
 *
 * 仕様（120 byte 固定長、半角）:
 *   位置    桁数  項目
 *   0       1    レコード種別コード = "1"
 *   1-2     2    種別コード = "21"（総合振込）
 *   3       1    コード区分 = "0"（JIS）
 *   4-13    10   依頼人コード
 *   14-53   40   依頼人名（左詰め、右空白埋め）
 *   54-57   4    振込指定日（MMDD）
 *   58-61   4    振込元金融機関コード
 *   62-76   15   振込元金融機関名（左詰め、右空白埋め）
 *   77-79   3    振込元支店コード
 *   80-94   15   振込元支店名（左詰め、右空白埋め）
 *   95      1    振込元預金種目
 *   96-102  7    振込元口座番号
 *   103-119 17   ダミー（空白）
 */

import type { ZenginSourceAccount } from "../types";

function padRight(s: string, length: number): string {
  if (s.length > length) return s.substring(0, length);
  return s + " ".repeat(length - s.length);
}

function padLeftZero(s: string, length: number): string {
  if (s.length > length) return s.substring(s.length - length);
  return "0".repeat(length - s.length) + s;
}

export function buildHeaderRecord(source: ZenginSourceAccount): string {
  const parts: string[] = [
    "1",                                                  // 0:    種別
    "21",                                                 // 1-2:  総合振込
    "0",                                                  // 3:    JIS
    padLeftZero(source.consignor_code, 10),               // 4-13: 依頼人コード
    padRight(source.consignor_name, 40),                  // 14-53:依頼人名
    source.transfer_date,                                 // 54-57:振込指定日 MMDD
    padLeftZero(source.source_bank_code, 4),              // 58-61:振込元銀行コード
    padRight(source.source_bank_name, 15),                // 62-76:振込元銀行名
    padLeftZero(source.source_branch_code, 3),            // 77-79:振込元支店コード
    padRight(source.source_branch_name, 15),              // 80-94:振込元支店名
    source.source_account_type,                           // 95:   預金種目
    padLeftZero(source.source_account_number, 7),         // 96-102:口座番号
    " ".repeat(17),                                       // 103-119:ダミー
  ];

  const record = parts.join("");

  if (record.length !== 120) {
    throw new Error(
      `ヘッダレコード長が 120 byte ではありません: ${record.length}`,
    );
  }

  return record;
}
```

**Step 4: テスト実行して成功を確認**

- [ ] Run: `npm test -- records/header`
- [ ] Expected: すべての test が PASS

**Step 5: Commit**

- [ ] Run:
```bash
git add src/lib/zengin/records/header.ts src/lib/zengin/__tests__/records/header.test.ts
git commit -m "feat(bud): 全銀協CSV ライブラリ — ヘッダレコード組立を追加"
```

---

## Task 5: データレコード（TDD）

**Files:**
- Create: `src/lib/zengin/records/data.ts`
- Test: `src/lib/zengin/__tests__/records/data.test.ts`

**Step 1: 失敗するテストを書く**

- [ ] Create `src/lib/zengin/__tests__/records/data.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildDataRecord } from "../../records/data";
import type { ZenginTransferInput } from "../../types";

const transfer: ZenginTransferInput = {
  payee_bank_code: "0001",
  payee_branch_code: "100",
  payee_account_type: "1",
  payee_account_number: "1234567",
  payee_account_holder_kana: "ﾔﾏﾀﾞ ﾀﾛｳ",
  amount: 50000,
  edi_info: "TEST EDI",
};

// テストヘルパ：8 桁右空白埋め
function padRight8(s: string): string {
  return (s + "        ").substring(0, 8);
}

describe("buildDataRecord", () => {
  it("データレコードが 120 byte 固定長", () => {
    const record = buildDataRecord(transfer);
    expect(record.length).toBe(120);
  });

  it("レコード種別が '2'（データ）で始まる", () => {
    expect(buildDataRecord(transfer)[0]).toBe("2");
  });

  it("振込先銀行コード（4桁）", () => {
    const record = buildDataRecord(transfer);
    expect(record.substring(1, 5)).toBe("0001");
  });

  it("振込先銀行名（15桁・空白埋め）", () => {
    const record = buildDataRecord(transfer);
    expect(record.substring(5, 20)).toBe(" ".repeat(15));
  });

  it("振込先支店コード（3桁）", () => {
    const record = buildDataRecord(transfer);
    expect(record.substring(20, 23)).toBe("100");
  });

  it("振込先支店名（15桁・空白埋め）", () => {
    const record = buildDataRecord(transfer);
    expect(record.substring(23, 38)).toBe(" ".repeat(15));
  });

  it("手形交換所番号（4桁・空白埋め）", () => {
    const record = buildDataRecord(transfer);
    expect(record.substring(38, 42)).toBe(" ".repeat(4));
  });

  it("預金種目（1桁）と口座番号（7桁・0埋め）", () => {
    const record = buildDataRecord(transfer);
    expect(record.substring(42, 43)).toBe("1");
    expect(record.substring(43, 50)).toBe("1234567");
  });

  it("口座番号が4桁なら 0 で左埋めされる", () => {
    const t = { ...transfer, payee_account_number: "1234" };
    const record = buildDataRecord(t);
    expect(record.substring(43, 50)).toBe("0001234");
  });

  it("受取人名（30桁・左詰め右空白埋め）", () => {
    const record = buildDataRecord(transfer);
    const nameField = record.substring(50, 80);
    expect(nameField.trim()).toBe("ﾔﾏﾀﾞ ﾀﾛｳ");
    expect(nameField.length).toBe(30);
  });

  it("振込金額（10桁・右寄せ 0 埋め）", () => {
    const record = buildDataRecord(transfer);
    expect(record.substring(80, 90)).toBe("0000050000");
  });

  it("新規コード = '0'（1桁）", () => {
    expect(buildDataRecord(transfer).substring(90, 91)).toBe("0");
  });

  it("顧客コード1（10桁・空白埋め）", () => {
    const record = buildDataRecord(transfer);
    expect(record.substring(91, 101)).toBe(" ".repeat(10));
  });

  it("顧客コード2（10桁・空白埋め）", () => {
    const record = buildDataRecord(transfer);
    expect(record.substring(101, 111)).toBe(" ".repeat(10));
  });

  it("EDI 情報（8桁・左詰め右空白埋め）", () => {
    const record = buildDataRecord(transfer);
    expect(record.substring(111, 119)).toBe(padRight8("TEST EDI"));
  });

  it("振替区分 = '0'（1桁、末尾）", () => {
    const record = buildDataRecord(transfer);
    expect(record.substring(119, 120)).toBe("0");
  });

  it("EDI 情報が 8 桁を超える場合は切り詰められる", () => {
    const t = { ...transfer, edi_info: "ABCDEFGHIJ" };
    const record = buildDataRecord(t);
    expect(record.substring(111, 119)).toBe("ABCDEFGH");
  });

  it("EDI 情報なしでも 120 byte 固定", () => {
    const t = { ...transfer, edi_info: undefined };
    const record = buildDataRecord(t);
    expect(record.length).toBe(120);
  });

  it("顧客コードが指定されていれば入る", () => {
    const t: ZenginTransferInput = {
      ...transfer,
      customer_code_1: "ABC1234567",
      customer_code_2: "XYZ9876543",
    };
    const record = buildDataRecord(t);
    expect(record.substring(91, 101)).toBe("ABC1234567");
    expect(record.substring(101, 111)).toBe("XYZ9876543");
  });
});
```

**Step 2: テスト実行して失敗を確認**

- [ ] Run: `npm test -- records/data`
- [ ] Expected: FAIL

**Step 3: 実装を書く**

- [ ] Create `src/lib/zengin/records/data.ts`:

```typescript
/**
 * Garden-Bud / 全銀協 CSV — データレコード（種別 2）
 *
 * 仕様（120 byte 固定長、半角、全銀協 V1 の最も一般的なレイアウト）:
 *   位置      桁数  累計  項目
 *   0         1     1    レコード種別コード = "2"
 *   1-4       4     5    振込先金融機関コード
 *   5-19      15    20   振込先金融機関名（任意、空白埋め）
 *   20-22     3     23   振込先支店コード
 *   23-37     15    38   振込先支店名（任意、空白埋め）
 *   38-41     4     42   手形交換所番号（空白埋め）
 *   42        1     43   預金種目
 *   43-49     7     50   口座番号（0 埋め）
 *   50-79     30    80   受取人名（左詰め、右空白埋め）
 *   80-89     10    90   振込金額（右寄せ 0 埋め）
 *   90        1     91   新規コード = "0"
 *   91-100    10    101  顧客コード1（空白埋め）
 *   101-110   10    111  顧客コード2（空白埋め）
 *   111-118   8     119  EDI情報/摘要（左詰め、右空白埋め、8桁超は切詰）
 *   119       1     120  振替区分 = "0"
 */

import type { ZenginTransferInput } from "../types";
import { toHalfWidthKana } from "../kana-converter";

function padRight(s: string, length: number): string {
  if (s.length > length) return s.substring(0, length);
  return s + " ".repeat(length - s.length);
}

function padLeftZero(s: string, length: number): string {
  if (s.length > length) return s.substring(s.length - length);
  return "0".repeat(length - s.length) + s;
}

export function buildDataRecord(t: ZenginTransferInput): string {
  // 受取人名を半角カタカナに変換
  const { kana } = toHalfWidthKana(t.payee_account_holder_kana);

  // EDI 情報（8 桁まで）
  const ediInfoRaw = t.edi_info ? toHalfWidthKana(t.edi_info).kana : "";
  const ediInfo = ediInfoRaw.substring(0, 8);

  const parts: string[] = [
    "2",                                                  // 0      種別
    padLeftZero(t.payee_bank_code, 4),                    // 1-4    振込先銀行コード
    " ".repeat(15),                                       // 5-19   振込先銀行名（任意、空白）
    padLeftZero(t.payee_branch_code, 3),                  // 20-22  振込先支店コード
    " ".repeat(15),                                       // 23-37  振込先支店名（任意、空白）
    " ".repeat(4),                                        // 38-41  手形交換所番号
    t.payee_account_type,                                 // 42     預金種目
    padLeftZero(t.payee_account_number, 7),               // 43-49  口座番号
    padRight(kana, 30),                                   // 50-79  受取人名
    padLeftZero(t.amount.toString(), 10),                 // 80-89  振込金額
    "0",                                                  // 90     新規コード
    padRight(t.customer_code_1 ?? "", 10),                // 91-100 顧客コード1
    padRight(t.customer_code_2 ?? "", 10),                // 101-110 顧客コード2
    padRight(ediInfo, 8),                                 // 111-118 EDI情報
    "0",                                                  // 119    振替区分
  ];

  const record = parts.join("");

  if (record.length !== 120) {
    throw new Error(
      `データレコード長が 120 byte ではありません: ${record.length}`,
    );
  }

  return record;
}
```

**Step 4: テスト実行して成功を確認**

- [ ] Run: `npm test -- records/data`
- [ ] Expected: すべての test が PASS

**Step 5: Commit**

- [ ] Run:
```bash
git add src/lib/zengin/records/data.ts src/lib/zengin/__tests__/records/data.test.ts
git commit -m "feat(bud): 全銀協CSV ライブラリ — データレコード組立を追加"
```

---

## Task 6: トレーラレコード（TDD）

**Files:**
- Create: `src/lib/zengin/records/trailer.ts`
- Test: `src/lib/zengin/__tests__/records/trailer.test.ts`

**Step 1: 失敗するテストを書く**

- [ ] Create `src/lib/zengin/__tests__/records/trailer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildTrailerRecord } from "../../records/trailer";

describe("buildTrailerRecord", () => {
  it("トレーラレコードが 120 byte 固定長", () => {
    expect(buildTrailerRecord(3, 150000).length).toBe(120);
  });

  it("レコード種別が '8'（トレーラ）で始まる", () => {
    expect(buildTrailerRecord(3, 150000)[0]).toBe("8");
  });

  it("合計件数（6桁・右寄せ 0 埋め）", () => {
    const record = buildTrailerRecord(5, 150000);
    expect(record.substring(1, 7)).toBe("000005");
  });

  it("合計金額（12桁・右寄せ 0 埋め）", () => {
    const record = buildTrailerRecord(5, 150000);
    expect(record.substring(7, 19)).toBe("000000150000");
  });

  it("ダミー（101桁）", () => {
    const record = buildTrailerRecord(5, 150000);
    expect(record.substring(19, 120)).toBe(" ".repeat(101));
  });
});
```

**Step 2: テスト実行して失敗を確認**

- [ ] Run: `npm test -- records/trailer`
- [ ] Expected: FAIL

**Step 3: 実装を書く**

- [ ] Create `src/lib/zengin/records/trailer.ts`:

```typescript
/**
 * Garden-Bud / 全銀協 CSV — トレーラレコード（種別 8）
 *
 * 仕様（120 byte）:
 *   位置    桁数  項目
 *   0       1    レコード種別 = "8"
 *   1-6     6    合計件数（右寄せ 0 埋め）
 *   7-18    12   合計金額（右寄せ 0 埋め）
 *   19-119  101  ダミー（空白）
 */

function padLeftZero(s: string, length: number): string {
  if (s.length > length) return s.substring(s.length - length);
  return "0".repeat(length - s.length) + s;
}

export function buildTrailerRecord(
  recordCount: number,
  totalAmount: number,
): string {
  const parts: string[] = [
    "8",
    padLeftZero(recordCount.toString(), 6),
    padLeftZero(totalAmount.toString(), 12),
    " ".repeat(101),
  ];
  const record = parts.join("");

  if (record.length !== 120) {
    throw new Error(
      `トレーラレコード長が 120 byte ではありません: ${record.length}`,
    );
  }

  return record;
}
```

**Step 4: テスト実行して成功を確認**

- [ ] Run: `npm test -- records/trailer`
- [ ] Expected: すべての test が PASS

**Step 5: Commit**

- [ ] Run:
```bash
git add src/lib/zengin/records/trailer.ts src/lib/zengin/__tests__/records/trailer.test.ts
git commit -m "feat(bud): 全銀協CSV ライブラリ — トレーラレコード組立を追加"
```

---

## Task 7: エンドレコード（TDD）

**Files:**
- Create: `src/lib/zengin/records/end.ts`
- Test: `src/lib/zengin/__tests__/records/end.test.ts`

**Step 1: 失敗するテストを書く**

- [ ] Create `src/lib/zengin/__tests__/records/end.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildEndRecord } from "../../records/end";

describe("buildEndRecord", () => {
  it("エンドレコードが 120 byte 固定長", () => {
    expect(buildEndRecord().length).toBe(120);
  });

  it("レコード種別が '9'（エンド）で始まる", () => {
    expect(buildEndRecord()[0]).toBe("9");
  });

  it("残りは空白埋め（119桁）", () => {
    expect(buildEndRecord().substring(1, 120)).toBe(" ".repeat(119));
  });
});
```

**Step 2: テスト実行して失敗を確認**

- [ ] Run: `npm test -- records/end`
- [ ] Expected: FAIL

**Step 3: 実装を書く**

- [ ] Create `src/lib/zengin/records/end.ts`:

```typescript
/**
 * Garden-Bud / 全銀協 CSV — エンドレコード（種別 9）
 *
 * 仕様: "9" + 空白 119 桁 = 120 桁
 */

export function buildEndRecord(): string {
  return "9" + " ".repeat(119);
}
```

**Step 4: テスト実行して成功を確認**

- [ ] Run: `npm test -- records/end`
- [ ] Expected: すべての test が PASS

**Step 5: Commit**

- [ ] Run:
```bash
git add src/lib/zengin/records/end.ts src/lib/zengin/__tests__/records/end.test.ts
git commit -m "feat(bud): 全銀協CSV ライブラリ — エンドレコード組立を追加"
```

---

## Task 8: 銀行別差異オプション（TDD）

**Files:**
- Create: `src/lib/zengin/bank-specific.ts`
- Test: `src/lib/zengin/__tests__/bank-specific.test.ts`

**Step 1: 失敗するテストを書く**

- [ ] Create `src/lib/zengin/__tests__/bank-specific.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getBankProfile } from "../bank-specific";

describe("getBankProfile", () => {
  it("楽天銀行は .csv 拡張子、EOF マークなし", () => {
    const profile = getBankProfile("rakuten");
    expect(profile.fileExtension).toBe(".csv");
    expect(profile.useEofMark).toBe(false);
  });

  it("みずほ銀行は .txt 拡張子、EOF マークあり", () => {
    const profile = getBankProfile("mizuho");
    expect(profile.fileExtension).toBe(".txt");
    expect(profile.useEofMark).toBe(true);
  });

  it("PayPay 銀行は .csv 拡張子、EOF マークなし", () => {
    const profile = getBankProfile("paypay");
    expect(profile.fileExtension).toBe(".csv");
    expect(profile.useEofMark).toBe(false);
  });

  it("京都銀行は未実装エラー", () => {
    expect(() => getBankProfile("kyoto")).toThrow(/未実装/);
  });
});
```

**Step 2: テスト実行して失敗を確認**

- [ ] Run: `npm test -- bank-specific`
- [ ] Expected: FAIL

**Step 3: 実装を書く**

- [ ] Create `src/lib/zengin/bank-specific.ts`:

```typescript
/**
 * Garden-Bud / 全銀協 CSV — 銀行別差異吸収
 *
 * 各銀行のネットバンキング取込画面で要求される仕様差を集約。
 * 将来の銀行追加は `BankProfile` を拡張し、`BANK_PROFILES` に登録するだけ。
 */

import type { BankType } from "./types";

export interface BankProfile {
  bank: BankType;
  displayName: string;
  fileExtension: string;
  useEofMark: boolean;
  lineEnding: "\r\n" | "\n";
}

const BANK_PROFILES: Partial<Record<BankType, BankProfile>> = {
  rakuten: {
    bank: "rakuten",
    displayName: "楽天銀行ビジネス",
    fileExtension: ".csv",
    useEofMark: false,
    lineEnding: "\r\n",
  },
  mizuho: {
    bank: "mizuho",
    displayName: "みずほビジネスWEB",
    fileExtension: ".txt",
    useEofMark: true,
    lineEnding: "\r\n",
  },
  paypay: {
    bank: "paypay",
    displayName: "PayPay 銀行法人",
    fileExtension: ".csv",
    useEofMark: false,
    lineEnding: "\r\n",
  },
  // kyoto は未実装（送金必要時に追加）
};

export function getBankProfile(bank: BankType): BankProfile {
  const profile = BANK_PROFILES[bank];
  if (!profile) {
    throw new Error(`銀行 "${bank}" の全銀協CSV 出力は未実装です`);
  }
  return profile;
}
```

**Step 4: テスト実行して成功を確認**

- [ ] Run: `npm test -- bank-specific`
- [ ] Expected: すべての test が PASS

**Step 5: Commit**

- [ ] Run:
```bash
git add src/lib/zengin/bank-specific.ts src/lib/zengin/__tests__/bank-specific.test.ts
git commit -m "feat(bud): 全銀協CSV ライブラリ — 銀行別差異オプションを追加"
```

---

## Task 9: Shift-JIS エンコード（TDD）

**Files:**
- Create: `src/lib/zengin/encoding.ts`
- Test: `src/lib/zengin/__tests__/encoding.test.ts`

**Step 1: 失敗するテストを書く**

- [ ] Create `src/lib/zengin/__tests__/encoding.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { encodeToShiftJis } from "../encoding";

describe("encodeToShiftJis", () => {
  it("ASCII を Shift-JIS Buffer に変換する", () => {
    const buf = encodeToShiftJis("ABC123");
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBe(6);
    expect(buf.toString("binary")).toBe("ABC123");
  });

  it("半角カタカナを Shift-JIS に変換する", () => {
    const buf = encodeToShiftJis("ｱｲｳ");
    expect(buf.length).toBe(3); // 半角カナは 1 byte
    // ｱ = 0xB1, ｲ = 0xB2, ｳ = 0xB3
    expect(buf[0]).toBe(0xb1);
    expect(buf[1]).toBe(0xb2);
    expect(buf[2]).toBe(0xb3);
  });

  it("CRLF がそのまま入る", () => {
    const buf = encodeToShiftJis("A\r\nB");
    expect(buf.length).toBe(4);
    expect(buf[0]).toBe(0x41); // 'A'
    expect(buf[1]).toBe(0x0d); // CR
    expect(buf[2]).toBe(0x0a); // LF
    expect(buf[3]).toBe(0x42); // 'B'
  });

  it("EOF マーク（0x1A）を含められる", () => {
    const buf = encodeToShiftJis("A\x1A");
    expect(buf.length).toBe(2);
    expect(buf[1]).toBe(0x1a);
  });
});
```

**Step 2: テスト実行して失敗を確認**

- [ ] Run: `npm test -- encoding`
- [ ] Expected: FAIL

**Step 3: 実装を書く**

- [ ] Create `src/lib/zengin/encoding.ts`:

```typescript
/**
 * Garden-Bud / 全銀協 CSV — Shift-JIS エンコード
 *
 * 全銀協フォーマットは Shift-JIS 固定。Node.js 標準の TextEncoder は UTF-8 のみの
 * ため、iconv-lite ライブラリを経由してエンコードする。
 */

import iconv from "iconv-lite";

export function encodeToShiftJis(text: string): Buffer {
  return iconv.encode(text, "Shift_JIS");
}
```

**Step 4: テスト実行して成功を確認**

- [ ] Run: `npm test -- encoding`
- [ ] Expected: すべての test が PASS

**Step 5: Commit**

- [ ] Run:
```bash
git add src/lib/zengin/encoding.ts src/lib/zengin/__tests__/encoding.test.ts
git commit -m "feat(bud): 全銀協CSV ライブラリ — Shift-JIS エンコードを追加"
```

---

## Task 10: ジェネレータ（TDD）

**Files:**
- Create: `src/lib/zengin/generator.ts`
- Test: `src/lib/zengin/__tests__/generator.test.ts`

**Step 1: 失敗するテストを書く**

- [ ] Create `src/lib/zengin/__tests__/generator.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateZenginCsv } from "../generator";
import type {
  ZenginSourceAccount,
  ZenginTransferInput,
} from "../types";

const source: ZenginSourceAccount = {
  consignor_code: "0000001234",
  consignor_name: "ｶ)ﾋｭｱﾗﾝ",
  transfer_date: "0425",
  source_bank_code: "0036",
  source_bank_name: "ﾗｸﾃﾝ",
  source_branch_code: "251",
  source_branch_name: "ﾀﾞｲｲﾁ",
  source_account_type: "1",
  source_account_number: "7853952",
};

const transfers: ZenginTransferInput[] = [
  {
    payee_bank_code: "0001",
    payee_branch_code: "100",
    payee_account_type: "1",
    payee_account_number: "1234567",
    payee_account_holder_kana: "ﾔﾏﾀﾞ ﾀﾛｳ",
    amount: 50000,
  },
  {
    payee_bank_code: "0005",
    payee_branch_code: "200",
    payee_account_type: "1",
    payee_account_number: "2345678",
    payee_account_holder_kana: "ｽｽﾞｷ ﾊﾅｺ",
    amount: 75000,
  },
];

describe("generateZenginCsv", () => {
  it("4 レコード（ヘッダ+データ×2+トレーラ+エンド）で計 600 byte", () => {
    const result = generateZenginCsv(transfers, source, { bank: "rakuten" });
    // 120 * (1 + 2 + 1 + 1) = 600 byte + CRLF 4 回 = 608 byte
    expect(result.content.length).toBe(600 + 4 * 2); // CRLF = 2byte × 4箇所
  });

  it("ファイル名が推奨形式 zengin_YYYYMMDD_<銀行>.csv", () => {
    const result = generateZenginCsv(transfers, source, { bank: "rakuten" });
    expect(result.filename).toMatch(/^zengin_\d{8}_rakuten\.csv$/);
  });

  it("合計件数と合計金額が正しい", () => {
    const result = generateZenginCsv(transfers, source, { bank: "rakuten" });
    expect(result.recordCount).toBe(2);
    expect(result.totalAmount).toBe(125000);
  });

  it("みずほは .txt + EOF マーク", () => {
    const result = generateZenginCsv(transfers, source, { bank: "mizuho" });
    expect(result.filename).toMatch(/\.txt$/);
    // 最後の byte が EOF (0x1A)
    expect(result.content[result.content.length - 1]).toBe(0x1a);
  });

  it("PayPay は .csv、EOF なし", () => {
    const result = generateZenginCsv(transfers, source, { bank: "paypay" });
    expect(result.filename).toMatch(/\.csv$/);
    expect(result.content[result.content.length - 1]).not.toBe(0x1a);
  });

  it("バリデーション失敗なら Error を投げる", () => {
    const invalid = [{ ...transfers[0], amount: 0 }];
    expect(() =>
      generateZenginCsv(invalid, source, { bank: "rakuten" }),
    ).toThrow(/金額は 1 円以上/);
  });

  it("空配列なら Error", () => {
    expect(() =>
      generateZenginCsv([], source, { bank: "rakuten" }),
    ).toThrow(/振込データが空/);
  });

  it("京都銀行は未実装エラー", () => {
    expect(() =>
      generateZenginCsv(transfers, source, { bank: "kyoto" }),
    ).toThrow(/未実装/);
  });
});
```

**Step 2: テスト実行して失敗を確認**

- [ ] Run: `npm test -- generator`
- [ ] Expected: FAIL

**Step 3: 実装を書く**

- [ ] Create `src/lib/zengin/generator.ts`:

```typescript
/**
 * Garden-Bud / 全銀協 CSV — ジェネレータ（orchestrator）
 *
 * 振込データの配列と振込元口座情報を受け取り、全銀協フォーマットの
 * 完全な CSV（Shift-JIS エンコード済 Buffer）を生成する。
 */

import type {
  ZenginTransferInput,
  ZenginSourceAccount,
  ZenginOptions,
  GenerateResult,
} from "./types";
import { validateTransfer } from "./validator";
import { buildHeaderRecord } from "./records/header";
import { buildDataRecord } from "./records/data";
import { buildTrailerRecord } from "./records/trailer";
import { buildEndRecord } from "./records/end";
import { encodeToShiftJis } from "./encoding";
import { getBankProfile } from "./bank-specific";

export function generateZenginCsv(
  transfers: ZenginTransferInput[],
  source: ZenginSourceAccount,
  options: ZenginOptions,
): GenerateResult {
  // 1. バリデーション
  if (transfers.length === 0) {
    throw new Error("振込データが空です");
  }

  const errors: string[] = [];
  transfers.forEach((t, idx) => {
    const result = validateTransfer(t);
    if (!result.valid) {
      errors.push(`[${idx}] ${result.errors.join(", ")}`);
    }
  });
  if (errors.length > 0) {
    throw new Error(`バリデーションエラー:\n${errors.join("\n")}`);
  }

  // 2. 銀行プロファイル取得（京都銀行はここで throw）
  const profile = getBankProfile(options.bank);

  // 3. 合計計算
  const totalAmount = transfers.reduce((sum, t) => sum + t.amount, 0);

  // 4. 各レコード組立
  const lines: string[] = [
    buildHeaderRecord(source),
    ...transfers.map(buildDataRecord),
    buildTrailerRecord(transfers.length, totalAmount),
    buildEndRecord(),
  ];

  // 5. 行結合 + 銀行別末尾処理
  let text = lines.join(profile.lineEnding) + profile.lineEnding;
  if (profile.useEofMark) {
    text += "\x1A";
  }

  // 6. Shift-JIS エンコード
  const content = encodeToShiftJis(text);

  // 7. ファイル名生成
  const today = new Date();
  const yyyymmdd =
    today.getFullYear().toString() +
    String(today.getMonth() + 1).padStart(2, "0") +
    String(today.getDate()).padStart(2, "0");
  const filename = `zengin_${yyyymmdd}_${options.bank}${profile.fileExtension}`;

  return {
    content,
    filename,
    recordCount: transfers.length,
    totalAmount,
  };
}
```

**Step 4: テスト実行して成功を確認**

- [ ] Run: `npm test -- generator`
- [ ] Expected: すべての test が PASS

**Step 5: Commit**

- [ ] Run:
```bash
git add src/lib/zengin/generator.ts src/lib/zengin/__tests__/generator.test.ts
git commit -m "feat(bud): 全銀協CSV ライブラリ — ジェネレータ（orchestrator）を追加"
```

---

## Task 11: 公開 API

**Files:**
- Create: `src/lib/zengin/index.ts`

**Step 1: 公開エクスポートを書く**

- [ ] Create `src/lib/zengin/index.ts`:

```typescript
/**
 * Garden-Bud / 全銀協 CSV ライブラリ — 公開 API
 *
 * 使用例:
 *   import { generateZenginCsv, toHalfWidthKana, validateTransfer } from "@/lib/zengin";
 *   const result = generateZenginCsv(transfers, source, { bank: "rakuten" });
 *   // result.content は Shift-JIS Buffer、result.filename は推奨ファイル名
 */

export { generateZenginCsv } from "./generator";
export { toHalfWidthKana } from "./kana-converter";
export { validateTransfer } from "./validator";
export { getBankProfile } from "./bank-specific";
export type {
  BankType,
  AccountTypeCode,
  ZenginTransferInput,
  ZenginSourceAccount,
  ZenginOptions,
  ValidationResult,
  GenerateResult,
} from "./types";
```

**Step 2: Commit**

- [ ] Run:
```bash
git add src/lib/zengin/index.ts
git commit -m "feat(bud): 全銀協CSV ライブラリ — 公開 API（index.ts）を追加"
```

---

## Task 12: 統合テスト（サンプル入出力のフィクスチャ比較）

**Files:**
- Create: `src/lib/zengin/__tests__/fixtures/sample-transfers.ts`
- Create: `src/lib/zengin/__tests__/integration.test.ts`

**Step 1: サンプルデータを定義**

- [ ] Create `src/lib/zengin/__tests__/fixtures/sample-transfers.ts`:

```typescript
import type {
  ZenginSourceAccount,
  ZenginTransferInput,
} from "../../types";

export const SAMPLE_SOURCE: ZenginSourceAccount = {
  consignor_code: "0000001234",
  consignor_name: "ｶ)ﾋｭｱﾗﾝ",
  transfer_date: "0425",
  source_bank_code: "0036",
  source_bank_name: "ﾗｸﾃﾝ",
  source_branch_code: "251",
  source_branch_name: "ﾀﾞｲｲﾁｴｲｷﾞｮｳ",
  source_account_type: "1",
  source_account_number: "7853952",
};

export const SAMPLE_TRANSFERS: ZenginTransferInput[] = [
  {
    payee_bank_code: "0001",
    payee_branch_code: "100",
    payee_account_type: "1",
    payee_account_number: "1234567",
    payee_account_holder_kana: "ﾔﾏﾀﾞ ﾀﾛｳ",
    amount: 50000,
    edi_info: "KEIHI 4GATSU",
  },
  {
    payee_bank_code: "0005",
    payee_branch_code: "200",
    payee_account_type: "1",
    payee_account_number: "2345678",
    payee_account_holder_kana: "ｽｽﾞｷ ﾊﾅｺ",
    amount: 75000,
  },
  {
    payee_bank_code: "0179",
    payee_branch_code: "685",
    payee_account_type: "1",
    payee_account_number: "1207991",
    payee_account_holder_kana: "ﾐﾔｻﾞｷ ｶﾂﾔ",
    amount: 24980,
  },
];
```

**Step 2: 統合テストを書く**

- [ ] Create `src/lib/zengin/__tests__/integration.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateZenginCsv } from "../generator";
import { SAMPLE_SOURCE, SAMPLE_TRANSFERS } from "./fixtures/sample-transfers";

describe("integration: 3 件の振込を 3 銀行それぞれで生成", () => {
  it("楽天銀行向け CSV", () => {
    const r = generateZenginCsv(SAMPLE_TRANSFERS, SAMPLE_SOURCE, {
      bank: "rakuten",
    });
    expect(r.recordCount).toBe(3);
    expect(r.totalAmount).toBe(50000 + 75000 + 24980);
    expect(r.filename).toMatch(/\.csv$/);
    // 先頭 120 byte がヘッダ（レコード種別 "1" で始まる）
    const headerDecoded = Buffer.from(r.content.subarray(0, 120)).toString("binary");
    expect(headerDecoded[0]).toBe("1");
  });

  it("みずほ銀行向け CSV（EOF マーク付き）", () => {
    const r = generateZenginCsv(SAMPLE_TRANSFERS, SAMPLE_SOURCE, {
      bank: "mizuho",
    });
    expect(r.filename).toMatch(/\.txt$/);
    // 最後の byte が EOF (0x1A)
    expect(r.content[r.content.length - 1]).toBe(0x1a);
  });

  it("PayPay 銀行向け CSV", () => {
    const r = generateZenginCsv(SAMPLE_TRANSFERS, SAMPLE_SOURCE, {
      bank: "paypay",
    });
    expect(r.filename).toMatch(/\.csv$/);
  });

  it("合計 CRLF 込みのサイズが想定どおり", () => {
    const r = generateZenginCsv(SAMPLE_TRANSFERS, SAMPLE_SOURCE, {
      bank: "rakuten",
    });
    // 5 レコード（ヘッダ+データ×3+トレーラ+エンド）× 120 + CRLF × 5 = 610
    expect(r.content.length).toBe(5 * 120 + 5 * 2);
  });
});
```

**Step 3: テスト実行して成功を確認**

- [ ] Run: `npm test -- integration`
- [ ] Expected: すべての test が PASS

**Step 4: 全テスト実行（回帰チェック）**

- [ ] Run: `npm test`
- [ ] Expected: すべての test（7 ファイル分）が PASS

**Step 5: Commit**

- [ ] Run:
```bash
git add src/lib/zengin/__tests__/fixtures/sample-transfers.ts src/lib/zengin/__tests__/integration.test.ts
git commit -m "test(bud): 全銀協CSV ライブラリ — 統合テストを追加"
```

---

## Task 13: 手動動作確認手順書の作成

**Files:**
- Create: `docs/superpowers/plans/2026-04-22-bud-phase-1a-manual-verification.md`

**Step 1: 手順書を書く**

- [ ] Create `docs/superpowers/plans/2026-04-22-bud-phase-1a-manual-verification.md`:

```markdown
# Phase 1a 手動動作確認手順

## 目的

`generateZenginCsv` が出力する CSV が、実際の銀行（楽天・みずほ・PayPay）の総合振込データ取込画面で**エラーなく受け付けられる**ことを確認する。

**実送金はしない**（画面上の取込チェックだけで、最終実行前の確認画面で中止）。

## 事前準備

1. Phase 1a の全テストが PASS している（`npm test` で緑）
2. 各銀行のネットバンキングにログインできる（担当: 東海林さん）

## サンプル CSV の生成

一時的な Node.js スクリプトで CSV を保存する:

```typescript
// temp/generate-sample.ts
import { writeFileSync } from "fs";
import { generateZenginCsv } from "../src/lib/zengin";
import {
  SAMPLE_SOURCE,
  SAMPLE_TRANSFERS,
} from "../src/lib/zengin/__tests__/fixtures/sample-transfers";

for (const bank of ["rakuten", "mizuho", "paypay"] as const) {
  const r = generateZenginCsv(SAMPLE_TRANSFERS, SAMPLE_SOURCE, { bank });
  writeFileSync(`temp/${r.filename}`, r.content);
  console.log(`Generated: temp/${r.filename}`);
}
```

実行: `npx tsx temp/generate-sample.ts`

## 楽天銀行 での取込確認

1. 楽天銀行ビジネスダイレクトにログイン
2. 「総合振込」→「データ受信（総振・一括取込）」メニュー
3. 「ファイルを選択」で `temp/zengin_YYYYMMDD_rakuten.csv` をアップロード
4. 画面にエラーが出ないことを確認（振込先・金額・合計件数・合計金額）
5. **中止**（実送金しない）
6. 確認結果をチームに共有

## みずほ銀行 での取込確認

1. みずほビジネスWEB にログイン
2. 「総合振込」→「データ送信」メニュー
3. ファイル `temp/zengin_YYYYMMDD_mizuho.txt` をアップロード
4. EOF マークが原因のエラーが出ないこと、レコード数表示が正しいことを確認
5. **中止**

## PayPay 銀行 での取込確認

1. PayPay 銀行法人アカウントにログイン
2. 「振込」→「総合振込」→「ファイル取込」メニュー
3. ファイル `temp/zengin_YYYYMMDD_paypay.csv` をアップロード
4. エラーが出ないことを確認
5. **中止**

## 結果記録

`docs/effort-tracking.md` の Phase 1a 行に以下を記入:

- 実績（d）: 実際にかかった日数
- 差分: 実績 - 見積（0.5d）
- Notes: 「3 銀行すべて取込成功」or 発生したエラーの修正内容

## エラー発生時の対応

| エラー例 | 対応 |
|---|---|
| 「レコード長が違う」 | `records/*.ts` のオフセット再確認、テスト追加 |
| 「文字コードエラー」 | `encoding.ts` の Shift-JIS 変換確認 |
| 「受取人名が読めない」 | `kana-converter.ts` の変換テーブル追加 |
| 「合計件数が合わない」 | `buildTrailerRecord` 引数の確認 |

対応後、必要に応じてテスト追加 + Task のコミットを追加。
```

**Step 2: Commit**

- [ ] Run:
```bash
git add docs/superpowers/plans/2026-04-22-bud-phase-1a-manual-verification.md
git commit -m "docs(bud): Phase 1a 手動動作確認手順書を追加"
```

---

## Task 14: 工数実績の記録

**Files:**
- Modify: `docs/effort-tracking.md`

**Step 1: Phase 1a 完了後に実績を記入**

- [ ] Modify `docs/effort-tracking.md`（Phase 1a 行）

該当行を以下のように更新（`実績(d)` と `差分` を埋める）:

```markdown
| 2026-04-22 | 2026-04-XX | Bud | Phase 1a 全銀協CSVライブラリ | 0.5 | X.X | ±X.X | b-main (B) | Claude | （所感・気づきがあれば記入）|
```

所感例:
- 「kana-converter のテーブルが思ったより大きく、実装に +0.1d」
- 「みずほ EOF マークの仕様確認に 0.1d 追加」
- 「3 銀行すべて一発で取込成功、見積通り」

**Step 2: Commit**

- [ ] Run:
```bash
git add docs/effort-tracking.md
git commit -m "docs(bud): Phase 1a 工数実績を記録"
```

---

## 完了チェックリスト

- [ ] Task 0: vitest + iconv-lite 導入（東海林さん承認必要）
- [ ] Task 1: 型定義
- [ ] Task 2: 半角カタカナ変換 + テスト
- [ ] Task 3: バリデータ + テスト
- [ ] Task 4: ヘッダレコード + テスト
- [ ] Task 5: データレコード + テスト
- [ ] Task 6: トレーラレコード + テスト
- [ ] Task 7: エンドレコード + テスト
- [ ] Task 8: 銀行別差異 + テスト
- [ ] Task 9: Shift-JIS エンコード + テスト
- [ ] Task 10: ジェネレータ + テスト
- [ ] Task 11: 公開 API
- [ ] Task 12: 統合テスト
- [ ] Task 13: 手動動作確認手順書
- [ ] Task 14: 工数実績記録（完了時）
- [ ] 全テスト（`npm test`）が緑
- [ ] 3 銀行での取込動作確認完了

## 次の Phase

Phase 1a 完了後、`writing-plans` で Phase 1b（振込管理画面）の実装プラン作成に進む。
