// Direct REST INSERT to root_bank_transactions (Supabase service role)
const fs = require('fs');
const iconv = require('iconv-lite');

// .env.local から service role key を取得
const ENV_PATH = 'C:/garden/a-bloom-006/.env.local';
const env = Object.fromEntries(
  fs.readFileSync(ENV_PATH, 'utf-8').split(/\r?\n/)
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) { console.error('env missing'); process.exit(1); }

const MIZUHO_FILE = 'C:/Users/shoji/Downloads/ヒュアラン_みずほ_20260401から20260513まで_HS000120260513163702.api';
const RAKUTEN_FILE = 'C:/Users/shoji/Downloads/ヒュアラン_楽天_20260401から20260513まで_RB-torihikimeisai (5).csv';
const MIZUHO_ID = '88112876-d170-4530-9f21-d9ccfd15bb7d';
const RAKUTEN_ID = '08990d04-77e2-4ecb-bbe7-846e17ebbea0';

function parseMizuhoApi(filepath) {
  const buf = fs.readFileSync(filepath);
  const lines = iconv.decode(buf, 'Shift_JIS').split(/\r\n|\r|\n/);
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    if (cols[0] !== '明細') continue;
    const month = parseInt(cols[1], 10), day = parseInt(cols[2], 10);
    if (!Number.isInteger(month) || !Number.isInteger(day)) continue;
    const tk = (cols[12] || '').trim(); if (!tk) continue;
    const isDeposit = tk.includes('入金');
    const amountStr = (cols[19] || '').trim(); if (!/^\d+$/.test(amountStr)) continue;
    const amount = Number(amountStr);
    const description = (cols[21] || '').replace(/　/g, ' ').trim(); if (!description) continue;
    rows.push({
      bank_account_id: MIZUHO_ID,
      transaction_date: `2026-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
      amount: isDeposit ? amount : -amount,
      description, balance_after: null,
      source_csv_path: 'ヒュアラン_みずほ_20260401から20260513まで_HS000120260513163702.api',
      raw_row: { source: 'mizuho_api', month, day, flow: isDeposit ? 'deposit' : 'withdrawal', amount_unsigned: amount, source_line: i + 1 },
      imported_by: null,
      notes: 'a-main-026 mizuho 2026-05-13',
    });
  }
  return rows;
}

function parseRakutenCsv(filepath) {
  const buf = fs.readFileSync(filepath);
  const lines = iconv.decode(buf, 'Shift_JIS').split(/\r\n|\r|\n/);
  let h = -1;
  for (let i = 0; i < lines.length; i++) if (/取引日.*入出金.*残高.*入出金先内容/.test(lines[i])) { h = i; break; }
  const rows = [];
  for (let i = h + 1; i < lines.length; i++) {
    const line = lines[i]; if (!line.trim()) continue;
    const i1 = line.indexOf(','), i2 = line.indexOf(',', i1+1), i3 = line.indexOf(',', i2+1);
    if (i3 === -1) continue;
    const dateRaw = line.slice(0, i1).trim();
    const amountSigned = parseInt(line.slice(i1+1, i2).trim(), 10);
    const balance = parseInt(line.slice(i2+1, i3).trim(), 10);
    const desc = line.slice(i3+1).trim();
    if (!/^\d{8}$/.test(dateRaw) || isNaN(amountSigned) || isNaN(balance)) continue;
    rows.push({
      bank_account_id: RAKUTEN_ID,
      transaction_date: `${dateRaw.slice(0,4)}-${dateRaw.slice(4,6)}-${dateRaw.slice(6,8)}`,
      amount: amountSigned,
      description: desc, balance_after: balance,
      source_csv_path: 'ヒュアラン_楽天_20260401から20260513まで_RB-torihikimeisai (5).csv',
      raw_row: { source: 'rakuten_csv', date_raw: dateRaw, amount_signed: amountSigned, balance, source_line: i + 1 },
      imported_by: null,
      notes: 'a-main-026 rakuten 2026-05-13',
    });
  }
  return rows;
}

(async () => {
  const m = parseMizuhoApi(MIZUHO_FILE);
  const r = parseRakutenCsv(RAKUTEN_FILE);
  const all = [...m, ...r];
  console.log(`INSERT: みずほ ${m.length} + 楽天 ${r.length} = ${all.length} 件`);
  console.log(`URL: ${SUPABASE_URL}/rest/v1/root_bank_transactions`);

  const res = await fetch(`${SUPABASE_URL}/rest/v1/root_bank_transactions`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE,
      'Authorization': `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(all),
  });
  const status = res.status;
  let bodyText = await res.text();
  console.log(`Status: ${status}`);
  if (!res.ok) {
    console.error(`ERROR body: ${bodyText.slice(0, 1500)}`);
    process.exit(1);
  }
  const inserted = JSON.parse(bodyText);
  console.log(`✅ INSERT 成功: ${inserted.length} rows returned`);

  // 検証
  const verifyRes = await fetch(`${SUPABASE_URL}/rest/v1/root_bank_transactions?select=bank_account_id,amount&bank_account_id=in.(${MIZUHO_ID},${RAKUTEN_ID})`, {
    headers: { 'apikey': SERVICE_ROLE, 'Authorization': `Bearer ${SERVICE_ROLE}` },
  });
  const verifyData = await verifyRes.json();
  const mizCount = verifyData.filter(x => x.bank_account_id === MIZUHO_ID).length;
  const rakCount = verifyData.filter(x => x.bank_account_id === RAKUTEN_ID).length;
  const mizSum = verifyData.filter(x => x.bank_account_id === MIZUHO_ID).reduce((s, x) => s + Number(x.amount), 0);
  const rakSum = verifyData.filter(x => x.bank_account_id === RAKUTEN_ID).reduce((s, x) => s + Number(x.amount), 0);
  console.log('--- 検証 (本番 DB から fetch) ---');
  console.log(`みずほ: 件数=${mizCount} / 純額=¥${mizSum.toLocaleString('ja-JP')}`);
  console.log(`楽天:   件数=${rakCount} / 純額=¥${rakSum.toLocaleString('ja-JP')}`);
  console.log(`合計:   件数=${mizCount + rakCount} / 純額=¥${(mizSum + rakSum).toLocaleString('ja-JP')}`);
})();
