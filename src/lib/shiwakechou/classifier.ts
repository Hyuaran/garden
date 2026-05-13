/**
 * 4 月仕訳化 classifier (B-min #2)
 *
 * 入力:
 *   - bud_transactions (status='pending', 2026/04/01-04/30 期間) から取り出した取引
 *   - bud_master_rules (共通仕訳マスタ, 714 ルール, priority desc)
 *   - bud_bank_accounts (当該法人の自社内口座一覧, 自社内移し替え検出用)
 *
 * 処理:
 *   1. 自社内移し替え検出 (摘要に同法人の他口座番号が含まれる) → status='internal_transfer'
 *   2. master_rules パターンマッチ (priority desc / contains-prefix-regex-exact)
 *   3. マッチ → debit_account / credit_account / tax_class を UPDATE + status='ok'
 *   4. 未マッチ → status='pending' のまま (UI で手動補完想定)
 *
 * 元 Python: 4_仕訳帳_弥生出力_v11.py の自動判定ロジック (口座間移し替え判定 →
 *           法人間取引判定 (Phase 2) → 共通マスタ参照の優先順位)
 *
 * Phase 2 で追加予定:
 *   - 法人間取引マスタ (bud_intercompany_rules) との照合 → status='intercompany'
 *   - 振込手数料独立分離 (handoff §7)
 */

import type { TransactionFlow, TransactionStatus } from "./types";

// ----------------------------------------------------------------
// 公開型
// ----------------------------------------------------------------

/** マスタルール 1 行 (bud_master_rules 由来) */
export interface MasterRule {
  id: string;
  pattern: string;
  pattern_kind: "prefix" | "contains" | "regex" | "exact";
  direction: "withdrawal" | "deposit" | "both";
  category: string | null;
  debit_account: string;
  credit_account: string;
  tax_class: string;
  is_intercompany: boolean;
  priority: number;
  is_active: boolean;
}

/** 自社内口座 1 件 (bud_bank_accounts 由来、同法人内) */
export interface SelfAccount {
  /** 口座番号 (摘要マッチング用) */
  account_number: string;
  /** 銀行種別 (debug 用) */
  bank_kind: string;
  /** 弥生補助科目ラベル (debit / credit に格納する文字列) */
  sub_account_label: string;
}

/** classifier 入力 1 件 */
export interface ClassifyInput {
  /** 取引情報 (parser 出力相当) */
  transaction: {
    /** YYYY-MM-DD */
    transaction_date: string;
    /** 金額 (円, 符号なし) */
    amount: number;
    /** withdrawal / deposit */
    flow: TransactionFlow;
    /** 摘要原文 */
    description: string;
  };
  /** 当該取引口座の弥生補助科目ラベル (この口座が借方/貸方になる場合の補助科目) */
  current_account_sub_label: string;
  /** 当該口座と同じ法人の他口座一覧 (自社内移し替え検出用) */
  self_accounts: SelfAccount[];
  /** 適用候補マスタルール (priority desc 推奨、内部で再ソートも実施) */
  master_rules: MasterRule[];
}

/** classifier 出力 1 件 */
export interface ClassifiedTransaction {
  /** 取引ステータス */
  status: TransactionStatus;
  /** マッチしたマスタルール ID (status='ok' のみ非 null) */
  applied_rule_id: string | null;
  /** 借方勘定科目 */
  debit_account: string | null;
  /** 借方補助科目 */
  debit_sub_account: string | null;
  /** 貸方勘定科目 */
  credit_account: string | null;
  /** 貸方補助科目 */
  credit_sub_account: string | null;
  /** 税区分 */
  tax_class: string | null;
  /** 適用理由 (デバッグ用) */
  reason: "internal_transfer" | "master_rule_match" | "no_match";
  /** マッチしたパターン or 口座番号 (デバッグ用) */
  matched_pattern: string | null;
  /** 自社内移し替え検出時の相手口座 (status='internal_transfer' のみ非 null) */
  internal_transfer_counterpart: SelfAccount | null;
}

// ----------------------------------------------------------------
// メイン関数
// ----------------------------------------------------------------

/**
 * 1 取引を分類する。
 *
 * 優先順位:
 *   1. 自社内移し替え検出 (摘要に self_accounts のいずれかの口座番号が含まれる)
 *   2. master_rules パターンマッチ (priority desc + active + direction 一致)
 *   3. 未マッチ → status='pending'
 */
export function classifyTransaction(
  input: ClassifyInput,
): ClassifiedTransaction {
  // 1. 自社内移し替え検出
  const counterpart = detectInternalTransfer(
    input.transaction.description,
    input.self_accounts,
  );
  if (counterpart !== null) {
    // 自社内移し替え:
    //   - withdrawal (出金): 自口座から相手口座へ送金 → 借方 = 相手 / 貸方 = 自口座
    //   - deposit (入金):    相手口座から自口座へ送金 → 借方 = 自口座 / 貸方 = 相手
    const isDeposit = input.transaction.flow === "deposit";
    const selfLabel = input.current_account_sub_label;
    const counterpartLabel = counterpart.sub_account_label;

    return {
      status: "internal_transfer",
      applied_rule_id: null,
      debit_account: "普通預金",
      debit_sub_account: isDeposit ? selfLabel : counterpartLabel,
      credit_account: "普通預金",
      credit_sub_account: isDeposit ? counterpartLabel : selfLabel,
      tax_class: "対象外",
      reason: "internal_transfer",
      matched_pattern: counterpart.account_number,
      internal_transfer_counterpart: counterpart,
    };
  }

  // 2. master_rules パターンマッチ
  const matchedRule = findMatchingRule(
    input.transaction.description,
    input.transaction.flow,
    input.master_rules,
  );
  if (matchedRule !== null) {
    // master_rule にマッチ:
    //   - withdrawal (出金): 借方 = master.debit (例: 飲食店), 貸方 = 自口座 (普通預金 + sub_account_label)
    //   - deposit    (入金): 借方 = 自口座 (普通預金 + sub_account_label), 貸方 = master.credit (例: 売上)
    // ※ master のうち debit_account or credit_account が "普通預金" の場合は sub_label が必要、
    //   そうでない場合 (例: 飲食店 / 売上) は sub_label は空でよい (実 Python 出力と整合)。
    const isDeposit = input.transaction.flow === "deposit";
    const selfLabel = input.current_account_sub_label;

    return {
      status: "ok",
      applied_rule_id: matchedRule.id,
      debit_account: matchedRule.debit_account,
      debit_sub_account: isDeposit
        ? (matchedRule.debit_account === "普通預金" ? selfLabel : "")
        : (matchedRule.debit_account === "普通預金" ? selfLabel : ""),
      credit_account: matchedRule.credit_account,
      credit_sub_account: isDeposit
        ? (matchedRule.credit_account === "普通預金" ? selfLabel : "")
        : (matchedRule.credit_account === "普通預金" ? selfLabel : ""),
      tax_class: matchedRule.tax_class,
      reason: "master_rule_match",
      matched_pattern: matchedRule.pattern,
      internal_transfer_counterpart: null,
    };
  }

  // 3. 未マッチ → pending
  return {
    status: "pending",
    applied_rule_id: null,
    debit_account: null,
    debit_sub_account: null,
    credit_account: null,
    credit_sub_account: null,
    tax_class: null,
    reason: "no_match",
    matched_pattern: null,
    internal_transfer_counterpart: null,
  };
}

/**
 * 取引配列を一括分類する。
 *
 * @returns 分類結果 + サマリ
 */
export function classifyTransactions(
  inputs: ClassifyInput[],
): {
  results: ClassifiedTransaction[];
  summary: ClassifySummary;
} {
  const results = inputs.map(classifyTransaction);
  const summary = summarizeClassification(results);
  return { results, summary };
}

/** 一括分類サマリ */
export interface ClassifySummary {
  total: number;
  ok: number;
  internal_transfer: number;
  pending: number;
  /** 自動分類率 (ok + internal_transfer) / total */
  auto_classify_rate: number;
}

export function summarizeClassification(
  results: ClassifiedTransaction[],
): ClassifySummary {
  const total = results.length;
  let ok = 0;
  let internal_transfer = 0;
  let pending = 0;
  for (const r of results) {
    if (r.status === "ok") ok++;
    else if (r.status === "internal_transfer") internal_transfer++;
    else if (r.status === "pending") pending++;
  }
  const auto_classify_rate =
    total === 0 ? 0 : (ok + internal_transfer) / total;
  return { total, ok, internal_transfer, pending, auto_classify_rate };
}

// ----------------------------------------------------------------
// 内部ヘルパー
// ----------------------------------------------------------------

/**
 * 摘要に self_accounts のいずれかの口座番号が含まれていれば、その口座を返す。
 * 含まれていなければ null。
 *
 * 注意:
 *   - 口座番号は通常 7 桁の数字、複数法人間で重複する可能性ほぼなし (口座番号自体ユニーク)
 *   - 摘要中に「7853952」のようにそのまま現れる楽天形式の場合に検出
 *   - みずほ系の摘要 (カタカナ依頼人名等) は口座番号が現れない場合もあり、その場合は master_rule に委ねる
 */
export function detectInternalTransfer(
  description: string,
  self_accounts: SelfAccount[],
): SelfAccount | null {
  for (const acct of self_accounts) {
    if (description.includes(acct.account_number)) {
      return acct;
    }
  }
  return null;
}

/**
 * 適用候補ルール群から、最初にマッチするルールを返す。
 *
 * 順序:
 *   - is_active=true のみ
 *   - direction が 'both' または取引 flow と一致
 *   - priority desc (大きいほど優先)
 *   - pattern_kind 別: prefix / contains / regex / exact
 */
export function findMatchingRule(
  description: string,
  flow: TransactionFlow,
  rules: MasterRule[],
): MasterRule | null {
  // priority desc でソート (caller 責任前提だが安全のため再ソート)
  const sorted = [...rules].sort((a, b) => b.priority - a.priority);

  for (const rule of sorted) {
    if (!rule.is_active) continue;
    if (rule.direction !== "both" && rule.direction !== flow) continue;
    if (matchPattern(description, rule.pattern, rule.pattern_kind)) {
      return rule;
    }
  }

  return null;
}

/**
 * パターンマッチング (pattern_kind 別)。
 *
 * - prefix: description.startsWith(pattern)
 * - contains: description.includes(pattern)
 * - regex: new RegExp(pattern).test(description)
 * - exact: description === pattern
 *
 * 不正な regex は false (silent skip、warning は呼び出し側で扱う想定)。
 */
export function matchPattern(
  description: string,
  pattern: string,
  kind: "prefix" | "contains" | "regex" | "exact",
): boolean {
  if (pattern === "") return false; // 空パターンは全マッチ防止
  switch (kind) {
    case "prefix":
      return description.startsWith(pattern);
    case "contains":
      return description.includes(pattern);
    case "regex":
      try {
        return new RegExp(pattern).test(description);
      } catch {
        return false;
      }
    case "exact":
      return description === pattern;
  }
}
