// CLI 弥生 CSV exporter — ヒュアラン 4-5 月通算 (a-main-026, 2026-05-13)
// 入力: みずほ .api + 楽天 CSV (両方 Shift-JIS)
// 出力: 弥生 25 列形式 CSV (UTF-8 でコンソール + Shift-JIS でファイル保存)
// minimal classifier: 入金=借方普通預金/貸方不明勘定、出金=借方不明勘定/貸方普通預金
// 補助科目: みずほ銀行 / 楽天銀行 (4/30 残高検算は別途)

const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

const MIZUHO_FILE = 'C:/Users/shoji/Downloads/ヒュアラン_みずほ_20260401から20260513まで_HS000120260513163702.api';
const RAKUTEN_FILE = 'C:/Users/shoji/Downloads/ヒュアラン_楽天_20260401から20260513まで_RB-torihikimeisai (5).csv';
const OUTPUT_FILE = 'C:/Users/shoji/Downloads/hyuaran_2026-04-to-05_弥生.csv';

// ---------- みずほ .api (TSV, 項目名称ヘッダー, 明細データ) ----------
function parseMizuhoApi(filepath) {
  const buf = fs.readFileSync(filepath);
  const text = iconv.decode(buf, 'Shift_JIS');
  const lines = text.split(/\r\n|\r|\n/);
  const rows = [];
  let prevMonth = null;
  let currentYear = 2026; // ファイル名 20260401-20260513 から推論
  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    if (cols[0] !== '明細') continue;
    const month = parseInt(cols[1], 10);
    const day = parseInt(cols[2], 10);
    if (!Number.isInteger(month) || month < 1 || month > 12) continue;
    if (!Number.isInteger(day) || day < 1 || day > 31) continue;
    if (prevMonth !== null && month < prevMonth) currentYear = 2027; // 年跨ぎ防御 (本件は無いが)
    prevMonth = month;
    const transactionKind = (cols[12] || '').trim();
    if (!transactionKind) continue;
    const isDeposit = transactionKind.includes('入金');
    const flow = isDeposit ? 'deposit' : 'withdrawal';
    const amountStr = (cols[19] || '').trim();
    if (!/^\d+$/.test(amountStr)) continue;
    const amount = Number(amountStr);
    const description = (cols[21] || '').replace(/　/g, ' ').trim();
    if (!description) continue;
    const date = `${currentYear}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    rows.push({ date, amount, flow, description, bank: 'mizuho', source_line: i + 1 });
  }
  return rows;
}

// ---------- 楽天 CSV (取引日,入出金(円),残高(円),入出金先内容) ----------
function parseRakutenCsv(filepath) {
  const buf = fs.readFileSync(filepath);
  const text = iconv.decode(buf, 'Shift_JIS');
  const lines = text.split(/\r\n|\r|\n/);
  const HEADER_PATTERN = /取引日.*入出金.*残高.*入出金先内容/;
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (HEADER_PATTERN.test(lines[i])) { headerIdx = i; break; }
  }
  if (headerIdx === -1) throw new Error('楽天 CSV: ヘッダー未検出');
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
    rows.push({ date, amount, flow, description: desc, bank: 'rakuten', source_line: i + 1 });
  }
  return rows;
}

// ---------- 弥生 25 列 CSV 生成 (minimal classifier) ----------
function formatYayoiDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${y}/${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

function sanitizeDesc(s) {
  return s.replace(/,/g, ' ').replace(/\r?\n/g, ' ');
}

function toYayoiRow(row, denpyoNo) {
  const date = formatYayoiDate(row.date);
  const desc = sanitizeDesc(row.description);
  const bankSubLabel = row.bank === 'mizuho' ? 'みずほ銀行' : '楽天銀行';
  const debitAccount = row.flow === 'deposit' ? '普通預金' : '不明勘定';
  const debitSubAccount = row.flow === 'deposit' ? bankSubLabel : '';
  const creditAccount = row.flow === 'deposit' ? '不明勘定' : '普通預金';
  const creditSubAccount = row.flow === 'deposit' ? '' : bankSubLabel;
  return [
    '2000',
    String(denpyoNo),
    '',
    date,
    debitAccount,
    debitSubAccount,
    '',
    '対象外',
    String(row.amount),
    '0',
    creditAccount,
    creditSubAccount,
    '',
    '対象外',
    String(row.amount),
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

const csvLines = allRows.map((row, i) => toYayoiRow(row, i + 1));
const csvText = csvLines.join('\r\n') + '\r\n';

// Shift-JIS でファイル保存 (弥生 import 用)
fs.writeFileSync(OUTPUT_FILE, iconv.encode(csvText, 'Shift_JIS'));

// 集計
const mizuhoApr = mizuhoRows.filter(r => r.date.startsWith('2026-04')).length;
const mizuhoMay = mizuhoRows.filter(r => r.date.startsWith('2026-05')).length;
const rakutenApr = rakutenRows.filter(r => r.date.startsWith('2026-04')).length;
const rakutenMay = rakutenRows.filter(r => r.date.startsWith('2026-05')).length;

const sumDeposit = allRows.filter(r => r.flow === 'deposit').reduce((s, r) => s + r.amount, 0);
const sumWithdraw = allRows.filter(r => r.flow === 'withdrawal').reduce((s, r) => s + r.amount, 0);

console.log('=== ヒュアラン 4-5 月通算 弥生 CSV 生成完了 ===');
console.log('総件数:', allRows.length);
console.log('  みずほ 4 月:', mizuhoApr, ' / 5 月:', mizuhoMay, ' / 計:', mizuhoRows.length);
console.log('  楽天   4 月:', rakutenApr, ' / 5 月:', rakutenMay, ' / 計:', rakutenRows.length);
console.log('入金合計: ¥', sumDeposit.toLocaleString('ja-JP'));
console.log('出金合計: ¥', sumWithdraw.toLocaleString('ja-JP'));
console.log('差引: ¥', (sumDeposit - sumWithdraw).toLocaleString('ja-JP'));
console.log('出力ファイル(Shift-JIS):', OUTPUT_FILE);
console.log('');
console.log('=== CSV 全文 (UTF-8, 弥生 25 列, CRLF) ===');
process.stdout.write(csvText);
