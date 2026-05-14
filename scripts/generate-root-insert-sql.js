// CLI root_bank_transactions INSERT SQL 生成
// 出力: 160 行の bulk INSERT SQL を 1 ファイルに

const fs = require('fs');
const iconv = require('iconv-lite');

const MIZUHO_FILE = 'C:/Users/shoji/Downloads/ヒュアラン_みずほ_20260401から20260513まで_HS000120260513163702.api';
const RAKUTEN_FILE = 'C:/Users/shoji/Downloads/ヒュアラン_楽天_20260401から20260513まで_RB-torihikimeisai (5).csv';
const OUTPUT_SQL = 'C:/garden/a-main-026/scripts/_root-bank-transactions-insert.sql';

const HYUARAN_MIZUHO_ID = '88112876-d170-4530-9f21-d9ccfd15bb7d';
const HYUARAN_RAKUTEN_ID = '08990d04-77e2-4ecb-bbe7-846e17ebbea0';

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
    rows.push({
      bank_account_id: HYUARAN_MIZUHO_ID,
      transaction_date: date,
      amount: isDeposit ? amount : -amount,
      description,
      balance_after: null,
      source_csv_path: 'ヒュアラン_みずほ_20260401から20260513まで_HS000120260513163702.api',
      raw_row: { source: 'mizuho_api', month, day, flow, amount_unsigned: amount, description_raw: cols[21] || '', source_line: i + 1 },
    });
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
    const balanceRaw = line.slice(idx2 + 1, idx3).trim();
    const desc = line.slice(idx3 + 1).trim();
    if (!/^\d{8}$/.test(dateRaw)) continue;
    const date = `${dateRaw.slice(0,4)}-${dateRaw.slice(4,6)}-${dateRaw.slice(6,8)}`;
    const amountSigned = parseInt(amountRaw, 10);
    const balance = parseInt(balanceRaw, 10);
    if (isNaN(amountSigned) || isNaN(balance)) continue;
    rows.push({
      bank_account_id: HYUARAN_RAKUTEN_ID,
      transaction_date: date,
      amount: amountSigned,
      description: desc,
      balance_after: balance,
      source_csv_path: 'ヒュアラン_楽天_20260401から20260513まで_RB-torihikimeisai (5).csv',
      raw_row: { source: 'rakuten_csv', date_raw: dateRaw, amount_signed: amountSigned, balance, description: desc, source_line: i + 1 },
    });
  }
  return rows;
}

// SQL escape
function sqlStr(s) {
  if (s === null || s === undefined) return 'NULL';
  return "'" + String(s).replace(/'/g, "''") + "'";
}
function sqlJsonb(obj) {
  const json = JSON.stringify(obj).replace(/'/g, "''");
  return "'" + json + "'::jsonb";
}
function sqlNum(n) {
  return n === null || n === undefined ? 'NULL' : String(n);
}

const mizuhoRows = parseMizuhoApi(MIZUHO_FILE);
const rakutenRows = parseRakutenCsv(RAKUTEN_FILE);
const allRows = [...mizuhoRows, ...rakutenRows];

// SQL 構築
const valueLines = allRows.map(r => `(${sqlStr(r.bank_account_id)}, ${sqlStr(r.transaction_date)}, ${sqlNum(r.amount)}, ${sqlStr(r.description)}, ${sqlNum(r.balance_after)}, ${sqlStr(r.source_csv_path)}, ${sqlJsonb(r.raw_row)}, NULL, 'a-main-026 INSERT 2026-05-13 (Garden-Root 正式登録)')`);

const sql = `-- root_bank_transactions bulk INSERT (a-main-026, 2026-05-13)
-- ヒュアラン みずほ ${mizuhoRows.length} 件 + 楽天 ${rakutenRows.length} 件 = 計 ${allRows.length} 件

INSERT INTO public.root_bank_transactions (bank_account_id, transaction_date, amount, description, balance_after, source_csv_path, raw_row, imported_by, notes)
VALUES
${valueLines.join(',\n')};

-- 検証クエリ (INSERT 後実行)
-- SELECT bank_account_id, COUNT(*), SUM(amount) FROM public.root_bank_transactions
--  WHERE bank_account_id IN ('${HYUARAN_MIZUHO_ID}','${HYUARAN_RAKUTEN_ID}')
--  GROUP BY bank_account_id;
`;

fs.writeFileSync(OUTPUT_SQL, sql, 'utf-8');
console.log('SQL 生成完了:', OUTPUT_SQL);
console.log('みずほ:', mizuhoRows.length, '件');
console.log('楽天:', rakutenRows.length, '件');
console.log('合計:', allRows.length, '件');
console.log('SQL サイズ:', (sql.length / 1024).toFixed(1), 'KB');
