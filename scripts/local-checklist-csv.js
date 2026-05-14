// CLI チェック用一覧 CSV 生成 — ヒュアラン 4-5 月通算 (a-main-026)
// 形式: UTF-8 BOM, 日付 / 金額 / 摘要 / 借方 / 貸方 / 備考(AI判定理由)
// 判定変更:
//  - 電話料 / オリコ・ジャックス等: classifier 既存判定確定 (仕入高/雑費)
//  - 個人名/給与関連: 借方=給与 に修正 (摘要から検出)

const fs = require('fs');
const iconv = require('iconv-lite');

const MIZUHO_FILE = 'C:/Users/shoji/Downloads/ヒュアラン_みずほ_20260401から20260513まで_HS000120260513163702.api';
const RAKUTEN_FILE = 'C:/Users/shoji/Downloads/ヒュアラン_楽天_20260401から20260513まで_RB-torihikimeisai (5).csv';
const M5_SQL = 'C:/garden/a-main-025/docs/drafts/temp-m5.sql';
const OUTPUT_FILE = 'C:/Users/shoji/Downloads/チェック用一覧.csv';

const SELF_ACCOUNTS_HYUARAN = [
  { account_number: '1252992', bank_kind: 'mizuho', sub_account_label: 'みずほ銀行' },
];

// ---------- parsers ----------
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

function parseMasterRules(filepath) {
  const text = fs.readFileSync(filepath, 'utf-8');
  const lines = text.split(/\r\n|\n/);
  const rules = [];
  const VALUES_PATTERN = /values\s*\(\s*('(?:[^']|'')*')\s*,\s*('(?:[^']|'')*')\s*,\s*('(?:[^']|'')*')\s*,\s*('(?:[^']|'')*')\s*,\s*('(?:[^']|'')*')\s*,\s*('(?:[^']|'')*')\s*,\s*('(?:[^']|'')*')\s*,\s*('(?:[^']|'')*')\s*\)/i;
  for (const line of lines) {
    if (!line.startsWith('insert into public.bud_master_rules')) continue;
    const m = line.match(VALUES_PATTERN);
    if (!m) continue;
    const unq = (s) => s.slice(1, -1).replace(/''/g, "'");
    rules.push({
      id: `rule-${rules.length + 1}`,
      pattern: unq(m[1]),
      pattern_kind: unq(m[2]),
      direction: unq(m[3]),
      category: unq(m[4]),
      debit_account: unq(m[5]),
      credit_account: unq(m[6]),
      tax_class: unq(m[7]),
      memo: unq(m[8]),
      is_intercompany: false,
      priority: 100,
      is_active: true,
    });
  }
  return rules;
}

// ---------- classifier ----------
function matchPattern(d, p, k) {
  if (p === '') return false;
  switch (k) {
    case 'prefix':   return d.startsWith(p);
    case 'contains': return d.includes(p);
    case 'regex':    try { return new RegExp(p).test(d); } catch { return false; }
    case 'exact':    return d === p;
  }
  return false;
}

function detectInternal(desc, accts) {
  for (const a of accts) if (desc.includes(a.account_number)) return a;
  return null;
}

function findRule(desc, flow, rules) {
  for (const r of rules) {
    if (!r.is_active) continue;
    if (r.direction !== 'both' && r.direction !== flow) continue;
    if (matchPattern(desc, r.pattern, r.pattern_kind)) return r;
  }
  return null;
}

// 個人名/給与パターン検出
//  - 摘要に「内容：給与」明記 → 給与
//  - 個人名らしき (漢字またはカタカナのスペース区切り 2 単語、法人接尾辞なし)
//    判定: 「カ）/（カ/(ｶ/カブシキ/株式会社」を含まず、かつ振込先が「○○ ○○」or「○○　○○」形式
function detectSalary(desc, flow) {
  if (flow !== 'withdrawal') return false;
  if (/内容[:：]\s*給与/.test(desc) || /内容[:：]\s*賞与/.test(desc)) return true;
  // 法人接尾辞・敬称検出 → 個人ではない
  if (/カ）|（カ|\(ｶ|カブシキ|株式会社|（株|（有|有限会社|（合|合同会社|合資会社|（資|（医|医療法人|（社|社団法人|（財|財団法人|（学|学校法人|（宗|宗教法人|（一般|一般社団|協会|組合|店|事務所|工業|商事|商店|商会|サービス|総研|研究所|印刷|不動産|農業協同組合|漁業協同組合|信用金庫|労働金庫|信用組合|農林|生協|JA|JF|（特|特定非営利|（NPO|消防組合|区役所|市役所|区民|町民|村民|団体|協議会|都|府|県|市|区|町|村|内容[:：]\s*[^\s給賞]/.test(desc)) return false;
  // 個人名パターン: 摘要内に「○○ ○○（依頼人」or「○○　○○（依頼人」 or 振込先 7 桁 + 個人名らしきカナ漢字
  // 簡易: 振込明細に 7 桁口座番号 + (依頼人名：カ）ヒユアラン) があり、口座番号後の個人名を抽出可能
  // 安全寄り: 「依頼人名：カ）ヒユアラン」を含む = 振込先個人 → 給与の可能性高
  if (/依頼人名[:：].*ヒユアラン/.test(desc)) {
    // 個人名らしき (漢字 2 文字 + space + 漢字 2 文字、または カタカナ + space + カタカナ)
    // 弁護士・士業除外
    if (/ベンゴシ|ヘ゛?ンコ゛?シ|弁護士|税理士|司法書士|行政書士|社労士|公認会計士|医師|院長|診療|クリニック|薬剤師|歯科/.test(desc)) return false;
    // 個人名 = 振込先口座 + (個人名カナ/漢字 2 単語)
    if (/普通預金\s+\d{7}\s+([゠-ヿ゛-゜一-龯]+\s+[゠-ヿ゛-゜一-龯]+)/.test(desc)) return true;
    // 漢字フルネーム（東海林　美琴 等）
    if (/[一-龯]{2,3}\s*[一-龯]{2,4}/.test(desc)) {
      // 法人キーワード除外済 → 個人と判定
      const noPersonExclude = !/事業|建設|工務|電器|電機|医院|病院|歯科|薬局|食堂|喫茶|料理|温泉/.test(desc);
      if (noPersonExclude) return true;
    }
  }
  return false;
}

function classify(tx, rules, selfAccts) {
  // 1. 自社内移し替え
  const cp = detectInternal(tx.description, selfAccts);
  if (cp) {
    const isDeposit = tx.flow === 'deposit';
    return {
      status: 'internal_transfer',
      debit_account: '普通預金',
      debit_sub: isDeposit ? tx.sub_label : cp.sub_account_label,
      credit_account: '普通預金',
      credit_sub: isDeposit ? cp.sub_account_label : tx.sub_label,
      tax_class: '対象外',
      reason: `自社内移し替え: 相手口座 ${cp.account_number}`,
    };
  }
  // 2. 個人名/給与判定 (rule マッチ前の優先判定、東海林さん指示)
  if (detectSalary(tx.description, tx.flow)) {
    return {
      status: 'ok_manual',
      debit_account: '給与',
      debit_sub: '',
      credit_account: '普通預金',
      credit_sub: tx.sub_label,
      tax_class: '対象外',
      reason: '個人名/給与判定 (a-main-026 修正)',
    };
  }
  // 3. master_rules マッチ
  const mr = findRule(tx.description, tx.flow, rules);
  if (mr) {
    const isDeposit = tx.flow === 'deposit';
    return {
      status: 'ok',
      debit_account: mr.debit_account,
      debit_sub: mr.debit_account === '普通預金' ? tx.sub_label : '',
      credit_account: mr.credit_account,
      credit_sub: mr.credit_account === '普通預金' ? tx.sub_label : '',
      tax_class: mr.tax_class,
      reason: `マスタ一致: pattern="${mr.pattern.slice(0, 30)}"${mr.pattern.length > 30 ? '…' : ''}`,
    };
  }
  // 4. 未マッチ pending
  const isDeposit = tx.flow === 'deposit';
  return {
    status: 'pending',
    debit_account: isDeposit ? '普通預金' : '不明勘定',
    debit_sub: isDeposit ? tx.sub_label : '',
    credit_account: isDeposit ? '不明勘定' : '普通預金',
    credit_sub: isDeposit ? '' : tx.sub_label,
    tax_class: '対象外',
    reason: '未分類 (要手動確認)',
  };
}

// ---------- CSV 出力 ----------
function csvEscape(s) {
  const str = String(s ?? '');
  if (/[",\r\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

// ---------- main ----------
const mizuhoRows = parseMizuhoApi(MIZUHO_FILE);
const rakutenRows = parseRakutenCsv(RAKUTEN_FILE);
const allRows = [...mizuhoRows, ...rakutenRows].sort((a, b) => a.date.localeCompare(b.date) || a.bank.localeCompare(b.bank));
const rules = parseMasterRules(M5_SQL);

const classified = allRows.map(tx => ({ tx, c: classify(tx, rules, SELF_ACCOUNTS_HYUARAN) }));

// 集計
const summary = { total: classified.length, ok: 0, ok_manual: 0, internal: 0, pending: 0 };
for (const x of classified) {
  if (x.c.status === 'ok') summary.ok++;
  else if (x.c.status === 'ok_manual') summary.ok_manual++;
  else if (x.c.status === 'internal_transfer') summary.internal++;
  else summary.pending++;
}
const auto_rate = ((summary.ok + summary.ok_manual + summary.internal) / summary.total * 100).toFixed(1);

// CSV ライン
const csvLines = [];
csvLines.push('No,日付,銀行,入出金,金額,摘要,借方,貸方,税区分,状態,備考');
classified.forEach((x, i) => {
  const flowLabel = x.tx.flow === 'deposit' ? '入金' : '出金';
  const debit = x.c.debit_account + (x.c.debit_sub ? `(${x.c.debit_sub})` : '');
  const credit = x.c.credit_account + (x.c.credit_sub ? `(${x.c.credit_sub})` : '');
  const statusLabel = { ok: '自動分類', ok_manual: '修正反映', internal_transfer: '内移し替え', pending: '要確認' }[x.c.status];
  csvLines.push([
    i + 1,
    x.tx.date,
    x.tx.bank === 'mizuho' ? 'みずほ' : '楽天',
    flowLabel,
    x.tx.amount,
    csvEscape(x.tx.description),
    csvEscape(debit),
    csvEscape(credit),
    x.c.tax_class,
    statusLabel,
    csvEscape(x.c.reason),
  ].join(','));
});
const csvText = '﻿' + csvLines.join('\r\n') + '\r\n'; // UTF-8 BOM

fs.writeFileSync(OUTPUT_FILE, csvText, 'utf-8');

console.log('=== チェック用一覧 CSV 生成完了 ===');
console.log(`出力: ${OUTPUT_FILE}`);
console.log(`形式: UTF-8 (BOM 付き、Excel 直接 open OK)`);
console.log(`総件数: ${summary.total}`);
console.log(`  ✅ 自動分類 (master_rule): ${summary.ok}`);
console.log(`  🔧 修正反映 (個人名/給与): ${summary.ok_manual}`);
console.log(`  🔄 内移し替え: ${summary.internal}`);
console.log(`  ❓ 要確認 (pending): ${summary.pending}`);
console.log(`自動分類率: ${auto_rate}%`);
console.log('');
console.log('=== CSV 全文 (チャット直貼付用) ===');
process.stdout.write(csvText);
