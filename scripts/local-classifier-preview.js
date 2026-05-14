// CLI 仕訳プレビュー (classifier 適用版) — ヒュアラン 4-5 月通算 (a-main-026)
// 既存 master_rules 714 件 + minimal classifier 適用
// 出力: 表形式 (markdown) で chat 直貼付 (CSV は作らない、確認待ち)

const fs = require('fs');
const iconv = require('iconv-lite');

const MIZUHO_FILE = 'C:/Users/shoji/Downloads/ヒュアラン_みずほ_20260401から20260513まで_HS000120260513163702.api';
const RAKUTEN_FILE = 'C:/Users/shoji/Downloads/ヒュアラン_楽天_20260401から20260513まで_RB-torihikimeisai (5).csv';
const M5_SQL = 'C:/garden/a-main-025/docs/drafts/temp-m5.sql';

// ヒュアラン口座 (self_accounts、PR #172 forest m4 seed 投入済)
// 自社内移し替え検出用 — みずほ + 楽天のみ知る (hyuaran 所有の他法人口座は別)
const SELF_ACCOUNTS_HYUARAN = [
  { account_number: '1252992', bank_kind: 'mizuho', sub_account_label: 'みずほ銀行' },
  // 楽天口座番号は未把握 (摘要に出ないため省略)
];

// ---------- みずほ .api ----------
function parseMizuhoApi(filepath) {
  const buf = fs.readFileSync(filepath);
  const text = iconv.decode(buf, 'Shift_JIS');
  const lines = text.split(/\r\n|\r|\n/);
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    if (cols[0] !== '明細') continue;
    const month = parseInt(cols[1], 10);
    const day = parseInt(cols[2], 10);
    if (!Number.isInteger(month) || !Number.isInteger(day)) continue;
    const transactionKind = (cols[12] || '').trim();
    if (!transactionKind) continue;
    const isDeposit = transactionKind.includes('入金');
    const flow = isDeposit ? 'deposit' : 'withdrawal';
    const amountStr = (cols[19] || '').trim();
    if (!/^\d+$/.test(amountStr)) continue;
    const amount = Number(amountStr);
    const description = (cols[21] || '').replace(/　/g, ' ').trim();
    if (!description) continue;
    const date = `2026-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    rows.push({ date, amount, flow, description, bank: 'mizuho', sub_label: 'みずほ銀行' });
  }
  return rows;
}

// ---------- 楽天 CSV ----------
function parseRakutenCsv(filepath) {
  const buf = fs.readFileSync(filepath);
  const text = iconv.decode(buf, 'Shift_JIS');
  const lines = text.split(/\r\n|\r|\n/);
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/取引日.*入出金.*残高.*入出金先内容/.test(lines[i])) { headerIdx = i; break; }
  }
  const rows = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const idx1 = line.indexOf(',');
    const idx2 = line.indexOf(',', idx1 + 1);
    const idx3 = line.indexOf(',', idx2 + 1);
    if (idx3 === -1) continue;
    const dateRaw = line.slice(0, idx1).trim();
    const amountRaw = line.slice(idx1 + 1, idx2).trim();
    const desc = line.slice(idx3 + 1).trim();
    if (!/^\d{8}$/.test(dateRaw)) continue;
    const date = `${dateRaw.slice(0,4)}-${dateRaw.slice(4,6)}-${dateRaw.slice(6,8)}`;
    const amountSigned = parseInt(amountRaw, 10);
    if (isNaN(amountSigned)) continue;
    const flow = amountSigned >= 0 ? 'deposit' : 'withdrawal';
    const amount = Math.abs(amountSigned);
    rows.push({ date, amount, flow, description: desc, bank: 'rakuten', sub_label: '楽天銀行' });
  }
  return rows;
}

// ---------- master_rules 抽出 (temp-m5.sql) ----------
function parseMasterRules(filepath) {
  const text = fs.readFileSync(filepath, 'utf-8');
  const lines = text.split(/\r\n|\n/);
  const rules = [];
  // フォーマット: insert into public.bud_master_rules (pattern, pattern_kind, direction, category, debit_account, credit_account, tax_class, memo) values ('...','...',...,'...');
  const VALUES_PATTERN = /values\s*\(\s*('(?:[^']|'')*')\s*,\s*('(?:[^']|'')*')\s*,\s*('(?:[^']|'')*')\s*,\s*('(?:[^']|'')*')\s*,\s*('(?:[^']|'')*')\s*,\s*('(?:[^']|'')*')\s*,\s*('(?:[^']|'')*')\s*,\s*('(?:[^']|'')*')\s*\)/i;
  for (const line of lines) {
    if (!line.startsWith('insert into public.bud_master_rules')) continue;
    const m = line.match(VALUES_PATTERN);
    if (!m) continue;
    const unq = (s) => s.slice(1, -1).replace(/''/g, "'");
    const pattern = unq(m[1]);
    const pattern_kind = unq(m[2]);
    const direction = unq(m[3]);
    const category = unq(m[4]);
    const debit_account = unq(m[5]);
    const credit_account = unq(m[6]);
    const tax_class = unq(m[7]);
    const memo = unq(m[8]);
    rules.push({
      id: `rule-${rules.length + 1}`,
      pattern, pattern_kind, direction, category,
      debit_account, credit_account, tax_class, memo,
      is_intercompany: false,
      priority: 100,
      is_active: true,
    });
  }
  return rules;
}

// ---------- classifier ----------
function matchPattern(description, pattern, kind) {
  if (pattern === '') return false;
  switch (kind) {
    case 'prefix':   return description.startsWith(pattern);
    case 'contains': return description.includes(pattern);
    case 'regex':    try { return new RegExp(pattern).test(description); } catch { return false; }
    case 'exact':    return description === pattern;
  }
  return false;
}

function detectInternalTransfer(desc, self_accounts) {
  for (const a of self_accounts) {
    if (desc.includes(a.account_number)) return a;
  }
  return null;
}

function findMatchingRule(desc, flow, rules) {
  for (const r of rules) {
    if (!r.is_active) continue;
    if (r.direction !== 'both' && r.direction !== flow) continue;
    if (matchPattern(desc, r.pattern, r.pattern_kind)) return r;
  }
  return null;
}

function classifyTransaction(tx, rules, self_accounts) {
  const counterpart = detectInternalTransfer(tx.description, self_accounts);
  if (counterpart !== null) {
    const isDeposit = tx.flow === 'deposit';
    return {
      status: 'internal_transfer',
      debit_account: '普通預金',
      debit_sub: isDeposit ? tx.sub_label : counterpart.sub_account_label,
      credit_account: '普通預金',
      credit_sub: isDeposit ? counterpart.sub_account_label : tx.sub_label,
      tax_class: '対象外',
      reason: 'internal',
      matched: counterpart.account_number,
    };
  }
  const matched = findMatchingRule(tx.description, tx.flow, rules);
  if (matched) {
    const isDeposit = tx.flow === 'deposit';
    return {
      status: 'ok',
      debit_account: matched.debit_account,
      debit_sub: matched.debit_account === '普通預金' ? tx.sub_label : '',
      credit_account: matched.credit_account,
      credit_sub: matched.credit_account === '普通預金' ? tx.sub_label : '',
      tax_class: matched.tax_class,
      reason: 'rule',
      matched: matched.pattern,
    };
  }
  // pending: 未マッチでも minimal で 入金=借方普通預金/貸方不明、出金=借方不明/貸方普通預金
  const isDeposit = tx.flow === 'deposit';
  return {
    status: 'pending',
    debit_account: isDeposit ? '普通預金' : '不明勘定',
    debit_sub: isDeposit ? tx.sub_label : '',
    credit_account: isDeposit ? '不明勘定' : '普通預金',
    credit_sub: isDeposit ? '' : tx.sub_label,
    tax_class: '対象外',
    reason: 'no_match',
    matched: null,
  };
}

// ---------- main ----------
const mizuhoRows = parseMizuhoApi(MIZUHO_FILE);
const rakutenRows = parseRakutenCsv(RAKUTEN_FILE);
const allRows = [...mizuhoRows, ...rakutenRows].sort((a, b) => a.date.localeCompare(b.date) || a.bank.localeCompare(b.bank));
const rules = parseMasterRules(M5_SQL);

const classified = allRows.map(tx => ({
  tx,
  c: classifyTransaction(tx, rules, SELF_ACCOUNTS_HYUARAN),
}));

// 集計
const summary = { total: classified.length, ok: 0, internal_transfer: 0, pending: 0 };
for (const x of classified) {
  if (x.c.status === 'ok') summary.ok++;
  else if (x.c.status === 'internal_transfer') summary.internal_transfer++;
  else summary.pending++;
}
const auto_rate = ((summary.ok + summary.internal_transfer) / summary.total * 100).toFixed(1);

console.log('=== ヒュアラン 4-5 月通算 仕訳プレビュー (classifier 適用、CSV 未生成) ===');
console.log('総件数:', summary.total, '/ ok:', summary.ok, '/ 内移し替え:', summary.internal_transfer, '/ pending:', summary.pending);
console.log('自動分類率:', auto_rate + '%');
console.log('master_rules 件数:', rules.length);
console.log('');

// 表形式 (markdown)
console.log('| # | 日付 | 金額 | 摘要 | 借方科目 | 貸方科目 | 状態 |');
console.log('|---|---|---:|---|---|---|---|');
classified.forEach((x, i) => {
  const date = x.tx.date.slice(5); // MM-DD
  const amount = x.tx.amount.toLocaleString('ja-JP');
  const desc = x.tx.description.replace(/\|/g, '/').slice(0, 40);
  const debit = x.c.debit_account + (x.c.debit_sub ? `(${x.c.debit_sub})` : '');
  const credit = x.c.credit_account + (x.c.credit_sub ? `(${x.c.credit_sub})` : '');
  const status = x.c.status === 'ok' ? '✅' : x.c.status === 'internal_transfer' ? '🔄' : '❓';
  console.log(`| ${i+1} | ${date} | ${amount} | ${desc} | ${debit} | ${credit} | ${status} |`);
});
