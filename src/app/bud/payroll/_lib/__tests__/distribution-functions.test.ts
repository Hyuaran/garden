/**
 * D-04 給与明細配信 純関数 単体テスト
 *
 * 対応 spec: docs/specs/2026-04-25-bud-phase-d-04-statement-distribution.md
 *
 * 網羅項目:
 *   1. decideDeliveryMethod（line_email / fallback_email_pw / manual の 3 分岐）
 *   2. generateOneTimeToken（base64url、長さ 43、ユニーク性）
 *   3. calculateTokenExpiry / isTokenExpired（24h 境界）
 *   4. generateStrongPassword（長さ + charset + 強度）
 *   5. isPasswordStrong（境界）
 *   6. decideRetryDelay（1h / 6h / 24h / null）
 *   7. calculateNextRetryAt
 *   8. shouldNotifyAdminOnFailure
 *   9. decideFallbackUpgrade（LINE 失敗時の自動格上げ）
 *   10. isTokenUsable（OK / USED / EXPIRED / NO_TOKEN）
 *   11. validateUedaUiAction（spec § 2.7 操作権限）
 *   12. shouldMaskFallbackPassword（24h 境界）
 */

import { describe, it, expect } from "vitest";
import {
  decideDeliveryMethod,
  generateOneTimeToken,
  calculateTokenExpiry,
  isTokenExpired,
  generateStrongPassword,
  isPasswordStrong,
  decideRetryDelay,
  calculateNextRetryAt,
  shouldNotifyAdminOnFailure,
  decideFallbackUpgrade,
  isTokenUsable,
  validateUedaUiAction,
  shouldMaskFallbackPassword,
} from "../distribution-functions";
import {
  PASSWORD_CHARSET,
  PAYROLL_PDF_PASSWORD_LENGTH,
  PAYROLL_LINK_EXPIRY_HOURS,
  MAX_RETRY_COUNT,
  UEDA_VISUAL_CHECK_UI_REQUIREMENTS,
  UEDA_VISUAL_CHECK_URLS,
} from "../distribution-types";

// ============================================================
// 1. decideDeliveryMethod
// ============================================================

describe("decideDeliveryMethod", () => {
  it("メアド未登録 → manual", () => {
    expect(
      decideDeliveryMethod({
        lineFriendStatus: "friend",
        emailRegistered: false,
        paymentMethod: "bank_transfer",
      }),
    ).toBe("manual");
  });

  it("メアド登録 + LINE friend → line_email（通常フロー）", () => {
    expect(
      decideDeliveryMethod({
        lineFriendStatus: "friend",
        emailRegistered: true,
        paymentMethod: "bank_transfer",
      }),
    ).toBe("line_email");
  });

  it("メアド登録 + LINE unfriend → fallback_email_pw（例外フロー）", () => {
    expect(
      decideDeliveryMethod({
        lineFriendStatus: "unfriend",
        emailRegistered: true,
        paymentMethod: "bank_transfer",
      }),
    ).toBe("fallback_email_pw");
  });

  it("メアド登録 + LINE unknown → fallback_email_pw", () => {
    expect(
      decideDeliveryMethod({
        lineFriendStatus: "unknown",
        emailRegistered: true,
        paymentMethod: "bank_transfer",
      }),
    ).toBe("fallback_email_pw");
  });

  it("paymentMethod=cash でも判定ロジックに影響なし（決定は LINE + email のみ）", () => {
    expect(
      decideDeliveryMethod({
        lineFriendStatus: "friend",
        emailRegistered: true,
        paymentMethod: "cash",
      }),
    ).toBe("line_email");
  });
});

// ============================================================
// 2. generateOneTimeToken
// ============================================================

describe("generateOneTimeToken", () => {
  it("base64url 形式（43 文字、英数字 + - + _ のみ）", () => {
    const token = generateOneTimeToken();
    expect(token.length).toBe(43); // 32 byte → base64url 43 文字（パディングなし）
    expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true);
  });

  it("複数回生成でユニーク（10 件すべて異なる）", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 10; i++) {
      tokens.add(generateOneTimeToken());
    }
    expect(tokens.size).toBe(10);
  });

  it("URL に直接埋め込み可能（パディング = なし）", () => {
    const token = generateOneTimeToken();
    expect(token.includes("=")).toBe(false);
    expect(token.includes("/")).toBe(false);
    expect(token.includes("+")).toBe(false);
  });
});

// ============================================================
// 3. calculateTokenExpiry / isTokenExpired
// ============================================================

describe("calculateTokenExpiry", () => {
  it("now + 24h を ISO 8601 で返す", () => {
    const now = new Date("2026-05-08T09:00:00.000Z");
    const expiry = calculateTokenExpiry(now);
    const expected = new Date("2026-05-09T09:00:00.000Z").toISOString();
    expect(expiry).toBe(expected);
  });

  it("PAYROLL_LINK_EXPIRY_HOURS = 24 と整合", () => {
    expect(PAYROLL_LINK_EXPIRY_HOURS).toBe(24);
  });
});

describe("isTokenExpired", () => {
  const now = new Date("2026-05-08T09:00:00.000Z");

  it("期限内（now < expiresAt）→ false", () => {
    const expiresAt = "2026-05-08T20:00:00.000Z";
    expect(isTokenExpired(expiresAt, now)).toBe(false);
  });

  it("期限超過 → true", () => {
    const expiresAt = "2026-05-08T08:00:00.000Z";
    expect(isTokenExpired(expiresAt, now)).toBe(true);
  });

  it("ちょうど境界（now = expiresAt）→ false（厳密比較）", () => {
    const expiresAt = now.toISOString();
    expect(isTokenExpired(expiresAt, now)).toBe(false);
  });
});

// ============================================================
// 4. generateStrongPassword
// ============================================================

describe("generateStrongPassword", () => {
  it("デフォルト長 16 文字（PAYROLL_PDF_PASSWORD_LENGTH）", () => {
    const pw = generateStrongPassword();
    expect(pw.length).toBe(PAYROLL_PDF_PASSWORD_LENGTH);
    expect(pw.length).toBe(16);
  });

  it("カスタム長 20 文字", () => {
    const pw = generateStrongPassword(20);
    expect(pw.length).toBe(20);
  });

  it("PASSWORD_CHARSET 内の文字のみ", () => {
    const pw = generateStrongPassword(50);
    for (const c of pw) {
      expect(PASSWORD_CHARSET.includes(c)).toBe(true);
    }
  });

  it("複数回生成でユニーク", () => {
    const pws = new Set<string>();
    for (let i = 0; i < 10; i++) {
      pws.add(generateStrongPassword());
    }
    expect(pws.size).toBe(10);
  });

  it("長さ < 8 → エラー", () => {
    expect(() => generateStrongPassword(7)).toThrow(/Password length must be >= 8/);
  });

  it("長さ 8 → OK（境界）", () => {
    expect(generateStrongPassword(8).length).toBe(8);
  });
});

describe("isPasswordStrong", () => {
  it("16 文字 charset 内 → true", () => {
    const pw = generateStrongPassword();
    expect(isPasswordStrong(pw)).toBe(true);
  });

  it("8 文字（境界）→ true", () => {
    expect(isPasswordStrong("Abc123!@")).toBe(true);
  });

  it("7 文字 → false", () => {
    expect(isPasswordStrong("Abc123!")).toBe(false);
  });

  it("charset 外（日本語）→ false", () => {
    expect(isPasswordStrong("Abcd1234パスワード")).toBe(false);
  });

  it("空文字 → false", () => {
    expect(isPasswordStrong("")).toBe(false);
  });
});

// ============================================================
// 5. PASSWORD_CHARSET（候補空間検証）
// ============================================================

describe("PASSWORD_CHARSET", () => {
  it("ASCII printable サブセット（90 種、ブルートフォース実質不可能 90^16 ≈ 5×10^31）", () => {
    expect(PASSWORD_CHARSET.length).toBe(90); // a-z(26)+A-Z(26)+0-9(10)+記号(28)
    // メタ確認: 各文字種が含まれる
    expect(PASSWORD_CHARSET.includes("a")).toBe(true);
    expect(PASSWORD_CHARSET.includes("Z")).toBe(true);
    expect(PASSWORD_CHARSET.includes("0")).toBe(true);
    expect(PASSWORD_CHARSET.includes("!")).toBe(true);
    expect(PASSWORD_CHARSET.includes("9")).toBe(true);
  });
});

// ============================================================
// 6. decideRetryDelay
// ============================================================

describe("decideRetryDelay", () => {
  it("retryCount=0（1 回目失敗）→ 1h（3600000ms）", () => {
    expect(decideRetryDelay(0)).toBe(60 * 60 * 1000);
  });

  it("retryCount=1（2 回目失敗）→ 6h", () => {
    expect(decideRetryDelay(1)).toBe(6 * 60 * 60 * 1000);
  });

  it("retryCount=2（3 回目失敗）→ 24h", () => {
    expect(decideRetryDelay(2)).toBe(24 * 60 * 60 * 1000);
  });

  it("retryCount=3（4 回目失敗、停止）→ null", () => {
    expect(decideRetryDelay(3)).toBeNull();
  });

  it("retryCount=10（停止超過）→ null", () => {
    expect(decideRetryDelay(10)).toBeNull();
  });

  it("retryCount=-1（不正）→ null", () => {
    expect(decideRetryDelay(-1)).toBeNull();
  });
});

// ============================================================
// 7. calculateNextRetryAt
// ============================================================

describe("calculateNextRetryAt", () => {
  const now = new Date("2026-05-08T09:00:00.000Z");

  it("retryCount=0 → 1h 後", () => {
    const next = calculateNextRetryAt(0, now);
    expect(next).toBe("2026-05-08T10:00:00.000Z");
  });

  it("retryCount=2 → 24h 後", () => {
    const next = calculateNextRetryAt(2, now);
    expect(next).toBe("2026-05-09T09:00:00.000Z");
  });

  it("retryCount=3（停止）→ null", () => {
    expect(calculateNextRetryAt(3, now)).toBeNull();
  });
});

// ============================================================
// 8. shouldNotifyAdminOnFailure
// ============================================================

describe("shouldNotifyAdminOnFailure", () => {
  it("retryCount < MAX → false", () => {
    expect(shouldNotifyAdminOnFailure(0)).toBe(false);
    expect(shouldNotifyAdminOnFailure(2)).toBe(false);
  });

  it("retryCount >= MAX_RETRY_COUNT (3) → true", () => {
    expect(shouldNotifyAdminOnFailure(MAX_RETRY_COUNT)).toBe(true);
    expect(shouldNotifyAdminOnFailure(5)).toBe(true);
  });
});

// ============================================================
// 9. decideFallbackUpgrade
// ============================================================

describe("decideFallbackUpgrade", () => {
  it("line_email + LINE unfriend → fallback_email_pw", () => {
    expect(decideFallbackUpgrade("line_email", "unfriend")).toBe("fallback_email_pw");
  });

  it("line_email + LINE failed → fallback_email_pw", () => {
    expect(decideFallbackUpgrade("line_email", "failed")).toBe("fallback_email_pw");
  });

  it("line_email + LINE sent → 不変（line_email）", () => {
    expect(decideFallbackUpgrade("line_email", "sent")).toBe("line_email");
  });

  it("line_email + LINE null → 不変", () => {
    expect(decideFallbackUpgrade("line_email", null)).toBe("line_email");
  });

  it("fallback_email_pw + LINE unfriend → fallback_email_pw（既に格上げ済）", () => {
    expect(decideFallbackUpgrade("fallback_email_pw", "unfriend")).toBe(
      "fallback_email_pw",
    );
  });

  it("manual + LINE 関係なし → manual", () => {
    expect(decideFallbackUpgrade("manual", "unfriend")).toBe("manual");
  });
});

// ============================================================
// 10. isTokenUsable
// ============================================================

describe("isTokenUsable", () => {
  const now = new Date("2026-05-08T09:00:00.000Z");

  it("dl_used_at=null + 期限内 → OK", () => {
    const r = isTokenUsable(null, "2026-05-08T20:00:00.000Z", now);
    expect(r.usable).toBe(true);
    expect(r.reason).toBe("OK");
  });

  it("dl_used_at セット済 → USED", () => {
    const r = isTokenUsable("2026-05-08T08:30:00.000Z", "2026-05-08T20:00:00.000Z", now);
    expect(r.usable).toBe(false);
    expect(r.reason).toBe("USED");
  });

  it("期限超過 → EXPIRED", () => {
    const r = isTokenUsable(null, "2026-05-08T08:00:00.000Z", now);
    expect(r.usable).toBe(false);
    expect(r.reason).toBe("EXPIRED");
  });

  it("expiresAt=null（トークン未発行）→ NO_TOKEN", () => {
    const r = isTokenUsable(null, null, now);
    expect(r.usable).toBe(false);
    expect(r.reason).toBe("NO_TOKEN");
  });
});

// ============================================================
// 11. validateUedaUiAction（spec § 2.7、Cat 4 #26）
// ============================================================

describe("validateUedaUiAction", () => {
  it("'view' → 許可", () => {
    expect(validateUedaUiAction({ action: "view" }).allowed).toBe(true);
  });

  it("'row_check' → 許可", () => {
    expect(validateUedaUiAction({ action: "row_check" }).allowed).toBe(true);
  });

  it("'submit_ok' → 許可", () => {
    expect(validateUedaUiAction({ action: "submit_ok" }).allowed).toBe(true);
  });

  it("'submit_ng' → 許可", () => {
    expect(validateUedaUiAction({ action: "submit_ng" }).allowed).toBe(true);
  });

  it("編集試行（editingField あり）→ 拒否", () => {
    const r = validateUedaUiAction({
      action: "row_check",
      editingField: "transfer_amount",
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("編集権限なし");
  });

  it("振込実行試行 → 拒否（東海林さん専任）", () => {
    const r = validateUedaUiAction({
      action: "submit_ok",
      triggersTransfer: true,
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("振込実行権限なし");
  });

  it("不明 action → 拒否", () => {
    const r = validateUedaUiAction({ action: "delete" });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("許可されていない");
  });
});

// ============================================================
// 12. shouldMaskFallbackPassword（24h マスク）
// ============================================================

describe("shouldMaskFallbackPassword", () => {
  const displayedAt = "2026-05-08T09:00:00.000Z";

  it("未表示（null）→ マスク不要（false）", () => {
    expect(shouldMaskFallbackPassword(null)).toBe(false);
  });

  it("表示後 23h59m → マスク不要", () => {
    const now = new Date("2026-05-09T08:59:00.000Z");
    expect(shouldMaskFallbackPassword(displayedAt, now)).toBe(false);
  });

  it("表示後 24h ちょうど → マスク（境界）", () => {
    const now = new Date("2026-05-09T09:00:00.000Z");
    expect(shouldMaskFallbackPassword(displayedAt, now)).toBe(true);
  });

  it("表示後 25h → マスク", () => {
    const now = new Date("2026-05-09T10:00:00.000Z");
    expect(shouldMaskFallbackPassword(displayedAt, now)).toBe(true);
  });
});

// ============================================================
// 13. UEDA_VISUAL_CHECK_UI_REQUIREMENTS / URLS（spec § 2.7 定数の整合性）
// ============================================================

describe("UEDA_VISUAL_CHECK_UI_REQUIREMENTS", () => {
  it("autoTimeoutSeconds = null（自動 timeout なし）", () => {
    expect(UEDA_VISUAL_CHECK_UI_REQUIREMENTS.autoTimeoutSeconds).toBeNull();
  });

  it("editableFields = []（編集権限なし）", () => {
    expect(UEDA_VISUAL_CHECK_UI_REQUIREMENTS.editableFields).toEqual([]);
  });

  it("canExecuteTransfer = false", () => {
    expect(UEDA_VISUAL_CHECK_UI_REQUIREMENTS.canExecuteTransfer).toBe(false);
  });

  it("notificationChannel = garden_internal_only（Chatwork 不使用）", () => {
    expect(UEDA_VISUAL_CHECK_UI_REQUIREMENTS.notificationChannel).toBe(
      "garden_internal_only",
    );
  });

  it("rowLayout は 6 項目（金額・氏名・口座を含む）", () => {
    expect(UEDA_VISUAL_CHECK_UI_REQUIREMENTS.rowLayout.length).toBe(6);
    expect(UEDA_VISUAL_CHECK_UI_REQUIREMENTS.rowLayout).toContain("amount_yen");
    expect(UEDA_VISUAL_CHECK_UI_REQUIREMENTS.rowLayout).toContain("name_kanji");
    expect(UEDA_VISUAL_CHECK_UI_REQUIREMENTS.rowLayout).toContain("account_type_number");
  });
});

describe("UEDA_VISUAL_CHECK_URLS", () => {
  it("list URL", () => {
    expect(UEDA_VISUAL_CHECK_URLS.list).toBe("/bud/payroll/visual-check");
  });

  it("detail URL（batchId 埋め込み）", () => {
    expect(UEDA_VISUAL_CHECK_URLS.detail("abc-123")).toBe(
      "/bud/payroll/visual-check/abc-123",
    );
  });
});
