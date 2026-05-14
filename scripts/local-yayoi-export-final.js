// CLI 弥生 CSV 最終出力 — みずほ / 楽天 別ファイル
// 東海林 OK 取得済 v3 確定 → 弥生 25 列形式 (Shift-JIS, CRLF, BOM なし) で 2 ファイル生成

const fs = require('fs');
const iconv = require('iconv-lite');

const MIZUHO_FILE = 'C:/Users/shoji/Downloads/ヒュアラン_みずほ_20260401から20260513まで_HS000120260513163702.api';
const RAKUTEN_FILE = 'C:/Users/shoji/Downloads/ヒュアラン_楽天_20260401から20260513まで_RB-torihikimeisai (5).csv';
const M5_SQL = 'C:/garden/a-main-025/docs/drafts/temp-m5.sql';
const OUTPUT_MIZUHO = 'C:/Users/shoji/Downloads/hyuaran_mizuho_2026-04-to-05_弥生.csv';
const OUTPUT_RAKUTEN = 'C:/Users/shoji/Downloads/hyuaran_rakuten_2026-04-to-05_弥生.csv';

// 東海林さん回答 v3 確定版 (No → account)
const SHOJI_ANSWERS = {
  1:   { account: '売上' },
  2:   { account: '売掛金' },
  11:  { account: '外注費' },
  15:  { account: '外注費' },
  19:  { account: '通信費' },
  20:  { account: '通信費' },
  36:  { account: '通信費' },
  79:  { account: '売掛金' },
  81:  { account: '売掛金' },
  84:  { account: '現金' },
  86:  { account: '外注費' },
  89:  { account: '外注費' },
  93:  { account: '外注費' },
  95:  { account: '支払報酬' },
  97:  { account: '地代家賃' },
  99:  { account: '販売促進費' },
  101: { account: '外注費' },
  107: { account: '外注費' },
  109: { account: '外注費' },
  111: { account: '外注費' },
  113: { account: '外注費' },
  115: { account: '外注費' },
  119: { account: '支払報酬' },
  121: { account: '給与' },
  123: { account: '給与' },
  125: { account: '外注費' },
  127: { account: '給与' },
  130: { account: '旅費交通費' },
  132: { account: '外注費' },
  134: { account: '給与' },
  136: { account: '外注費' },
  139: { account: '短期貸付金' },
  140: { account: '売掛金' },
  144: { account: '売掛金' },
  145: { account: '外注費' },
  147: { account: '租税公課' },
  148: { account: '荷造運賃' },
  149: { account: '外注費' },
  156: { account: '外注費' },
  159: { account: '印刷費' },
};

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
      pattern: unq(m[1]), pattern_kind: unq(m[2]), direction: unq(m[3]),
      category: unq(m[4]), debit_account: unq(m[5]), credit_account: unq(m[6]),
      tax_class: unq(m[7]), memo: unq(m[8]),
      is_active: true, priority: 100,
    });
  }
  return rules;
}

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

function findRule(desc, flow, rules) {
  for (const r of rules) {
    if (!r.is_active) continue;
    if (r.direction !== 'both' && r.direction !== flow) continue;
    if (matchPattern(desc, r.pattern, r.pattern_kind)) return r;
  }
  return null;
}

function classify(no, tx, rules) {
  if (SHOJI_ANSWERS[no]) {
    const ans = SHOJI_ANSWERS[no];
    const isDeposit = tx.flow === 'deposit';
    return {
      debit_account: isDeposit ? '普通預金' : ans.account,
      debit_sub: isDeposit ? tx.sub_label : '',
      credit_account: isDeposit ? ans.account : '普通預金',
      credit_sub: isDeposit ? '' : tx.sub_label,
      tax_class: '対象外',
    };
  }
  const mr = findRule(tx.description, tx.flow, rules);
  if (mr) {
    return {
      debit_account: mr.debit_account,
      debit_sub: mr.debit_account === '普通預金' ? tx.sub_label : '',
      credit_account: mr.credit_account,
      credit_sub: mr.credit_account === '普通預金' ? tx.sub_label : '',
      tax_class: mr.tax_class,
    };
  }
  // safety net (本来 v3 で 0 件だが、フォールバック)
  const isDeposit = tx.flow === 'deposit';
  return {
    debit_account: isDeposit ? '普通預金' : '不明勘定',
    debit_sub: isDeposit ? tx.sub_label : '',
    credit_account: isDeposit ? '不明勘定' : '普通預金',
    credit_sub: isDeposit ? '' : tx.sub_label,
    tax_class: '対象外',
  };
}

// 弥生 25 列フォーマット
function formatYayoiDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${y}/${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

function sanitizeDesc(s) {
  return s.replace(/,/g, ' ').replace(/\r?\n/g, ' ');
}

function toYayoiRow(c, tx, denpyoNo) {
  const date = formatYayoiDate(tx.date);
  const desc = sanitizeDesc(tx.description);
  return [
    '2000',
    String(denpyoNo),
    '',
    date,
    c.debit_account,
    c.debit_sub || '',
    '',
    c.tax_class || '対象外',
    String(tx.amount),
    '0',
    c.credit_account,
    c.credit_sub || '',
    '',
    c.tax_class || '対象外',
    String(tx.amount),
    '0',
    desc,
    '', '', '0', '', '', '', '',
    'no'
  ].join(',');
}

// ---------- main ----------
const mizuhoRows = parseMizuhoApi(MIZUHO_FILE);
const rakutenRows = parseRakutenCsv(RAKUTEN_FILE);
const allRows = [...mizuhoRows, ...rakutenRows].sort((a, b) => a.date.localeCompare(b.date) || a.bank.localeCompare(b.bank));
const rules = parseMasterRules(M5_SQL);

const classified = allRows.map((tx, i) => ({ no: i + 1, tx, c: classify(i + 1, tx, rules) }));

// みずほ / 楽天 別に分けて、各銀行内で 1 から伝票番号採番
const mizuhoEntries = classified.filter(x => x.tx.bank === 'mizuho');
const rakutenEntries = classified.filter(x => x.tx.bank === 'rakuten');

const mizuhoCsvLines = mizuhoEntries.map((x, i) => toYayoiRow(x.c, x.tx, i + 1));
const rakutenCsvLines = rakutenEntries.map((x, i) => toYayoiRow(x.c, x.tx, i + 1));

const mizuhoCsv = mizuhoCsvLines.join('\r\n') + '\r\n';
const rakutenCsv = rakutenCsvLines.join('\r\n') + '\r\n';

fs.writeFileSync(OUTPUT_MIZUHO, iconv.encode(mizuhoCsv, 'Shift_JIS'));
fs.writeFileSync(OUTPUT_RAKUTEN, iconv.encode(rakutenCsv, 'Shift_JIS'));

// 集計
const sumMizuhoDeposit = mizuhoEntries.filter(x => x.tx.flow === 'deposit').reduce((s, x) => s + x.tx.amount, 0);
const sumMizuhoWithdraw = mizuhoEntries.filter(x => x.tx.flow === 'withdrawal').reduce((s, x) => s + x.tx.amount, 0);
const sumRakutenDeposit = rakutenEntries.filter(x => x.tx.flow === 'deposit').reduce((s, x) => s + x.tx.amount, 0);
const sumRakutenWithdraw = rakutenEntries.filter(x => x.tx.flow === 'withdrawal').reduce((s, x) => s + x.tx.amount, 0);

console.log('=== 弥生 CSV 最終出力完了 (Shift-JIS, CRLF, BOM なし、25 列) ===');
console.log('');
console.log(`📂 みずほ: ${OUTPUT_MIZUHO}`);
console.log(`   件数: ${mizuhoEntries.length}`);
console.log(`   入金合計: ¥${sumMizuhoDeposit.toLocaleString('ja-JP')}`);
console.log(`   出金合計: ¥${sumMizuhoWithdraw.toLocaleString('ja-JP')}`);
console.log(`   差引: ¥${(sumMizuhoDeposit - sumMizuhoWithdraw).toLocaleString('ja-JP')}`);
console.log('');
console.log(`📂 楽天: ${OUTPUT_RAKUTEN}`);
console.log(`   件数: ${rakutenEntries.length}`);
console.log(`   入金合計: ¥${sumRakutenDeposit.toLocaleString('ja-JP')}`);
console.log(`   出金合計: ¥${sumRakutenWithdraw.toLocaleString('ja-JP')}`);
console.log(`   差引: ¥${(sumRakutenDeposit - sumRakutenWithdraw).toLocaleString('ja-JP')}`);
console.log('');
console.log(`合計件数: ${mizuhoEntries.length + rakutenEntries.length}`);
console.log(`合計差引: ¥${((sumMizuhoDeposit + sumRakutenDeposit) - (sumMizuhoWithdraw + sumRakutenWithdraw)).toLocaleString('ja-JP')}`);
