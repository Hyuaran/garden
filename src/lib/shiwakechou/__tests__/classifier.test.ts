/**
 * classifier テスト (B-min #2 4 月仕訳化)
 */

import { describe, it, expect } from "vitest";
import {
  classifyTransaction,
  classifyTransactions,
  summarizeClassification,
  detectInternalTransfer,
  findMatchingRule,
  matchPattern,
  type MasterRule,
  type SelfAccount,
  type ClassifyInput,
} from "../classifier";

function makeRule(opts: Partial<MasterRule> = {}): MasterRule {
  return {
    id: opts.id ?? "rule-1",
    pattern: opts.pattern ?? "テスト",
    pattern_kind: opts.pattern_kind ?? "contains",
    direction: opts.direction ?? "both",
    category: opts.category ?? null,
    debit_account: opts.debit_account ?? "支払手数料",
    credit_account: opts.credit_account ?? "普通預金",
    tax_class: opts.tax_class ?? "課税仕入 10%",
    is_intercompany: opts.is_intercompany ?? false,
    priority: opts.priority ?? 100,
    is_active: opts.is_active ?? true,
  };
}

function makeSelfAccount(opts: Partial<SelfAccount> = {}): SelfAccount {
  return {
    account_number: opts.account_number ?? "7853952",
    bank_kind: opts.bank_kind ?? "rakuten",
    sub_account_label:
      opts.sub_account_label ?? "楽天銀行_第一営業支店(普通預金)7853952_ヒュアラン",
  };
}

function makeInput(opts: Partial<ClassifyInput> = {}): ClassifyInput {
  return {
    transaction: {
      transaction_date: opts.transaction?.transaction_date ?? "2026-04-01",
      amount: opts.transaction?.amount ?? 10000,
      flow: opts.transaction?.flow ?? "withdrawal",
      description: opts.transaction?.description ?? "テスト摘要",
    },
    current_account_sub_label:
      opts.current_account_sub_label ??
      "みずほ銀行_四ツ橋支店(普通預金)1252992_ヒュアラン",
    self_accounts: opts.self_accounts ?? [],
    master_rules: opts.master_rules ?? [],
  };
}

describe("classifyTransaction - 自社内移し替え検出", () => {
  it("摘要に同法人内の口座番号が含まれる → status=internal_transfer", () => {
    const result = classifyTransaction(
      makeInput({
        transaction: {
          transaction_date: "2026-04-15",
          amount: 5000000,
          flow: "withdrawal",
          description: "ラクテン 第一営業支店 普通預金 7853952 カニヒュアラン",
        },
        current_account_sub_label:
          "みずほ銀行_四ツ橋支店(普通預金)1252992_ヒュアラン",
        self_accounts: [makeSelfAccount({ account_number: "7853952" })],
      }),
    );

    expect(result.status).toBe("internal_transfer");
    expect(result.applied_rule_id).toBeNull();
    expect(result.debit_account).toBe("普通預金");
    expect(result.credit_account).toBe("普通預金");
    expect(result.tax_class).toBe("対象外");
    expect(result.reason).toBe("internal_transfer");
    expect(result.matched_pattern).toBe("7853952");
    expect(result.internal_transfer_counterpart).not.toBeNull();
  });

  it("出金 (withdrawal): 借方=相手口座 / 貸方=自口座", () => {
    const result = classifyTransaction(
      makeInput({
        transaction: {
          transaction_date: "2026-04-15",
          amount: 5000000,
          flow: "withdrawal",
          description: "口座振替 7853952",
        },
        current_account_sub_label: "みずほ_四ツ橋(普通)1252992",
        self_accounts: [
          makeSelfAccount({
            account_number: "7853952",
            sub_account_label: "楽天_第一営業(普通)7853952",
          }),
        ],
      }),
    );

    expect(result.debit_sub_account).toBe("楽天_第一営業(普通)7853952");
    expect(result.credit_sub_account).toBe("みずほ_四ツ橋(普通)1252992");
  });

  it("入金 (deposit): 借方=自口座 / 貸方=相手口座", () => {
    const result = classifyTransaction(
      makeInput({
        transaction: {
          transaction_date: "2026-04-15",
          amount: 5000000,
          flow: "deposit",
          description: "口座振替 1252992",
        },
        current_account_sub_label: "楽天_第一営業(普通)7853952",
        self_accounts: [
          makeSelfAccount({
            account_number: "1252992",
            sub_account_label: "みずほ_四ツ橋(普通)1252992",
          }),
        ],
      }),
    );

    expect(result.debit_sub_account).toBe("楽天_第一営業(普通)7853952");
    expect(result.credit_sub_account).toBe("みずほ_四ツ橋(普通)1252992");
  });

  it("self_accounts が空 → 自社内移し替え検出されない", () => {
    const result = classifyTransaction(
      makeInput({
        transaction: {
          transaction_date: "2026-04-15",
          amount: 5000000,
          flow: "withdrawal",
          description: "口座振替 7853952",
        },
        self_accounts: [],
      }),
    );

    expect(result.status).not.toBe("internal_transfer");
    expect(result.status).toBe("pending"); // master_rules も空のため
  });

  it("複数 self_accounts のうち最初にマッチした口座が返る", () => {
    const a = makeSelfAccount({ account_number: "1111111", sub_account_label: "A" });
    const b = makeSelfAccount({ account_number: "2222222", sub_account_label: "B" });
    const result = classifyTransaction(
      makeInput({
        transaction: {
          transaction_date: "2026-04-15",
          amount: 100,
          flow: "withdrawal",
          description: "2222222 への振替",
        },
        self_accounts: [a, b],
      }),
    );

    expect(result.internal_transfer_counterpart?.account_number).toBe("2222222");
  });
});

describe("classifyTransaction - master_rules パターンマッチ", () => {
  it("contains マッチ → status=ok + debit/credit/tax セット", () => {
    const rule = makeRule({
      pattern: "振込手数料",
      pattern_kind: "contains",
      direction: "withdrawal",
      debit_account: "支払手数料",
      credit_account: "普通預金",
      tax_class: "課税仕入 10%",
      priority: 100,
    });

    const result = classifyTransaction(
      makeInput({
        transaction: {
          transaction_date: "2026-04-15",
          amount: 229,
          flow: "withdrawal",
          description: "振込手数料 (一般振込 ¥20)",
        },
        current_account_sub_label: "楽天_第一営業(普通)7853952",
        master_rules: [rule],
      }),
    );

    expect(result.status).toBe("ok");
    expect(result.applied_rule_id).toBe("rule-1");
    expect(result.debit_account).toBe("支払手数料");
    expect(result.credit_account).toBe("普通預金");
    expect(result.credit_sub_account).toBe("楽天_第一営業(普通)7853952");
    expect(result.tax_class).toBe("課税仕入 10%");
    expect(result.reason).toBe("master_rule_match");
    expect(result.matched_pattern).toBe("振込手数料");
  });

  it("入金マッチ → 借方=自口座 / 貸方=master.credit", () => {
    const rule = makeRule({
      pattern: "売上入金",
      pattern_kind: "contains",
      direction: "deposit",
      debit_account: "普通預金",
      credit_account: "売上高",
      tax_class: "課税売上 10%",
    });

    const result = classifyTransaction(
      makeInput({
        transaction: {
          transaction_date: "2026-04-10",
          amount: 1000000,
          flow: "deposit",
          description: "売上入金 ヒュアラン",
        },
        current_account_sub_label: "みずほ_四ツ橋(普通)1252992",
        master_rules: [rule],
      }),
    );

    expect(result.debit_account).toBe("普通預金");
    expect(result.debit_sub_account).toBe("みずほ_四ツ橋(普通)1252992");
    expect(result.credit_account).toBe("売上高");
    expect(result.credit_sub_account).toBe("");
  });

  it("priority desc 優先順序", () => {
    const lowPriority = makeRule({
      id: "low",
      pattern: "テスト",
      pattern_kind: "contains",
      priority: 50,
      debit_account: "低優先",
    });
    const highPriority = makeRule({
      id: "high",
      pattern: "テスト",
      pattern_kind: "contains",
      priority: 200,
      debit_account: "高優先",
    });

    const result = classifyTransaction(
      makeInput({
        transaction: { flow: "withdrawal", description: "テスト摘要", amount: 100, transaction_date: "2026-04-01" },
        master_rules: [lowPriority, highPriority], // 順序逆でも priority desc で評価
      }),
    );

    expect(result.applied_rule_id).toBe("high");
    expect(result.debit_account).toBe("高優先");
  });

  it("direction フィルタ: 'withdrawal' は出金のみマッチ", () => {
    const rule = makeRule({ pattern: "テスト", direction: "withdrawal" });

    const depositResult = classifyTransaction(
      makeInput({
        transaction: { flow: "deposit", description: "テスト", amount: 100, transaction_date: "2026-04-01" },
        master_rules: [rule],
      }),
    );

    expect(depositResult.status).toBe("pending"); // direction 不一致でマッチせず

    const withdrawalResult = classifyTransaction(
      makeInput({
        transaction: { flow: "withdrawal", description: "テスト", amount: 100, transaction_date: "2026-04-01" },
        master_rules: [rule],
      }),
    );

    expect(withdrawalResult.status).toBe("ok");
  });

  it("direction='both' は両方マッチ", () => {
    const rule = makeRule({ pattern: "テスト", direction: "both" });

    const depositResult = classifyTransaction(
      makeInput({
        transaction: { flow: "deposit", description: "テスト", amount: 100, transaction_date: "2026-04-01" },
        master_rules: [rule],
      }),
    );
    const withdrawalResult = classifyTransaction(
      makeInput({
        transaction: { flow: "withdrawal", description: "テスト", amount: 100, transaction_date: "2026-04-01" },
        master_rules: [rule],
      }),
    );

    expect(depositResult.status).toBe("ok");
    expect(withdrawalResult.status).toBe("ok");
  });

  it("is_active=false はマッチせず skip", () => {
    const inactiveRule = makeRule({ pattern: "テスト", is_active: false, priority: 200 });
    const activeRule = makeRule({
      id: "active",
      pattern: "テスト",
      is_active: true,
      priority: 100,
      debit_account: "アクティブ",
    });

    const result = classifyTransaction(
      makeInput({
        transaction: { flow: "withdrawal", description: "テスト", amount: 100, transaction_date: "2026-04-01" },
        master_rules: [inactiveRule, activeRule],
      }),
    );

    expect(result.applied_rule_id).toBe("active");
    expect(result.debit_account).toBe("アクティブ");
  });
});

describe("classifyTransaction - 未マッチ", () => {
  it("master_rules も self_accounts も空 → status=pending", () => {
    const result = classifyTransaction(makeInput({}));
    expect(result.status).toBe("pending");
    expect(result.debit_account).toBeNull();
    expect(result.credit_account).toBeNull();
    expect(result.tax_class).toBeNull();
    expect(result.reason).toBe("no_match");
  });

  it("master_rules にあっても description マッチしない → pending", () => {
    const result = classifyTransaction(
      makeInput({
        transaction: { flow: "withdrawal", description: "未知の摘要", amount: 100, transaction_date: "2026-04-01" },
        master_rules: [makeRule({ pattern: "別のキーワード" })],
      }),
    );
    expect(result.status).toBe("pending");
  });
});

describe("classifyTransaction - 自社内移し替え > master_rules の優先", () => {
  it("両方マッチする場合は自社内移し替えを優先", () => {
    const result = classifyTransaction(
      makeInput({
        transaction: {
          flow: "withdrawal",
          description: "7853952 への振替 (振込手数料込)",
          amount: 5000000,
          transaction_date: "2026-04-15",
        },
        self_accounts: [makeSelfAccount({ account_number: "7853952" })],
        master_rules: [
          makeRule({ pattern: "振込手数料", debit_account: "支払手数料" }),
        ],
      }),
    );

    // 自社内移し替えが優先
    expect(result.status).toBe("internal_transfer");
    expect(result.reason).toBe("internal_transfer");
    expect(result.debit_account).toBe("普通預金");
    expect(result.applied_rule_id).toBeNull();
  });
});

describe("matchPattern", () => {
  it("prefix: 先頭一致", () => {
    expect(matchPattern("テスト摘要", "テスト", "prefix")).toBe(true);
    expect(matchPattern("摘要テスト", "テスト", "prefix")).toBe(false);
  });

  it("contains: 部分一致", () => {
    expect(matchPattern("摘要テスト", "テスト", "contains")).toBe(true);
    expect(matchPattern("摘要", "テスト", "contains")).toBe(false);
  });

  it("regex: 正規表現マッチ", () => {
    expect(matchPattern("CARD-1234", "CARD-\\d+", "regex")).toBe(true);
    expect(matchPattern("CARD-abc", "CARD-\\d+", "regex")).toBe(false);
  });

  it("exact: 完全一致", () => {
    expect(matchPattern("テスト", "テスト", "exact")).toBe(true);
    expect(matchPattern("テストABC", "テスト", "exact")).toBe(false);
  });

  it("空パターンは常に false (全マッチ防止)", () => {
    expect(matchPattern("摘要", "", "contains")).toBe(false);
    expect(matchPattern("摘要", "", "prefix")).toBe(false);
  });

  it("不正な regex は false (silent)", () => {
    expect(matchPattern("摘要", "[invalid", "regex")).toBe(false);
  });
});

describe("detectInternalTransfer", () => {
  it("摘要に口座番号が含まれていれば該当口座を返す", () => {
    const accts = [
      makeSelfAccount({ account_number: "1111111" }),
      makeSelfAccount({ account_number: "2222222" }),
    ];
    expect(detectInternalTransfer("振替 1111111 へ", accts)?.account_number).toBe(
      "1111111",
    );
    expect(detectInternalTransfer("振替 2222222 へ", accts)?.account_number).toBe(
      "2222222",
    );
  });

  it("含まれていなければ null", () => {
    const accts = [makeSelfAccount({ account_number: "1111111" })];
    expect(detectInternalTransfer("無関係な摘要", accts)).toBeNull();
  });

  it("空配列なら null", () => {
    expect(detectInternalTransfer("1111111", [])).toBeNull();
  });
});

describe("findMatchingRule", () => {
  it("active=true + direction 一致 + pattern マッチ", () => {
    const rules = [makeRule({ id: "r1", pattern: "abc", direction: "withdrawal" })];
    const matched = findMatchingRule("xyz abc", "withdrawal", rules);
    expect(matched?.id).toBe("r1");
  });

  it("マッチなしは null", () => {
    expect(findMatchingRule("xyz", "withdrawal", [])).toBeNull();
  });
});

describe("classifyTransactions / summarizeClassification", () => {
  it("一括分類 + サマリ", () => {
    const rule = makeRule({ pattern: "テスト" });
    const inputs: ClassifyInput[] = [
      makeInput({
        transaction: { flow: "withdrawal", description: "テスト1", amount: 100, transaction_date: "2026-04-01" },
        master_rules: [rule],
      }),
      makeInput({
        transaction: { flow: "withdrawal", description: "テスト2", amount: 200, transaction_date: "2026-04-02" },
        master_rules: [rule],
      }),
      makeInput({
        transaction: { flow: "withdrawal", description: "未知", amount: 300, transaction_date: "2026-04-03" },
        master_rules: [rule],
      }),
      makeInput({
        transaction: { flow: "withdrawal", description: "1111111 振替", amount: 400, transaction_date: "2026-04-04" },
        self_accounts: [makeSelfAccount({ account_number: "1111111" })],
        master_rules: [rule],
      }),
    ];

    const { results, summary } = classifyTransactions(inputs);
    expect(results).toHaveLength(4);
    expect(summary.total).toBe(4);
    expect(summary.ok).toBe(2);
    expect(summary.internal_transfer).toBe(1);
    expect(summary.pending).toBe(1);
    expect(summary.auto_classify_rate).toBe(0.75);
  });

  it("空配列でも error なし", () => {
    const { results, summary } = classifyTransactions([]);
    expect(results).toHaveLength(0);
    expect(summary.total).toBe(0);
    expect(summary.auto_classify_rate).toBe(0);
  });
});
