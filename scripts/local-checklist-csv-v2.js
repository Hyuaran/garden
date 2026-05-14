// CLI チェック用一覧 CSV v2 — 東海林さん 40 件回答 反映版
// 入力: みずほ .api + 楽天 CSV + master_rules + 東海林さん回答 mapping
// 出力: UTF-8 BOM CSV、列構成は v1 と同じ

const fs = require('fs');
const iconv = require('iconv-lite');

const MIZUHO_FILE = 'C:/Users/shoji/Downloads/ヒュアラン_みずほ_20260401から20260513まで_HS000120260513163702.api';
const RAKUTEN_FILE = 'C:/Users/shoji/Downloads/ヒュアラン_楽天_20260401から20260513まで_RB-torihikimeisai (5).csv';
const M5_SQL = 'C:/garden/a-main-025/docs/drafts/temp-m5.sql';
const OUTPUT_FILE = 'C:/Users/shoji/Downloads/チェック用一覧_v3.csv';

// 東海林さん回答 mapping (No → { account, note })
// account: 出金時=借方、入金時=貸方 に上書き
const SHOJI_ANSWERS = {
  1:   { account: '売上', note: 'ブレーカー売上 (東海林指示)' },
  2:   { account: '売掛金', note: '東海林指示' },
  11:  { account: '外注費', note: '東海林指示 v3 修正 (カ）スカイズ → 外注費)' },
  15:  { account: '外注費', note: '東海林指示' },
  19:  { account: '通信費', note: '東海林指示' },
  20:  { account: '通信費', note: '東海林指示' },
  36:  { account: '通信費', note: '東海林指示' },
  79:  { account: '売掛金', note: '東海林指示' },
  81:  { account: '売掛金', note: '東海林指示' },
  84:  { account: '現金', note: '現金引き出し (東海林指示)' },
  86:  { account: '外注費', note: '東海林指示 (センターライズ振込)' },
  89:  { account: '外注費', note: '東海林指示 (ヒラノ ジュンヤ振込)' },
  93:  { account: '外注費', note: '東海林指示 (イトウ ケンタ振込)' },
  95:  { account: '支払報酬', note: '東海林指示 (弁護士 森実健太)' },
  97:  { account: '地代家賃', note: '地代 (東海林指示)' },
  99:  { account: '販売促進費', note: '東海林指示 (タナカエイセイ振込)' },
  101: { account: '外注費', note: '東海林指示 (エーゼットサービス振込)' },
  107: { account: '外注費', note: '東海林指示 (クマノ モトキ振込)' },
  109: { account: '外注費', note: '東海林指示 (サトウ コウタ振込)' },
  111: { account: '外注費', note: '東海林指示 (サトウ コウタ振込)' },
  113: { account: '外注費', note: '東海林指示 (ツジ ハヤト振込)' },
  115: { account: '外注費', note: '東海林指示 (フジキ セイギ振込)' },
  119: { account: '支払報酬', note: '東海林指示 (弁護士 森実健太)' },
  121: { account: '給与', note: '東海林指示 (ウエダ ナオ給与)' },
  123: { account: '給与', note: '東海林指示 (ウエダ モト給与)' },
  125: { account: '外注費', note: '東海林指示 (ゴトウ ケンイチ振込)' },
  127: { account: '給与', note: '東海林指示 (ゴトウ ショウタ給与)' },
  130: { account: '旅費交通費', note: '東海林指示 (桐井 大輔旅費)' },
  132: { account: '外注費', note: '東海林指示 (浅野 航汰振込)' },
  134: { account: '給与', note: '東海林指示 (東海林 美琴給与、内容：給与明示)' },
  136: { account: '外注費', note: '東海林指示 (ダイバーシティー㈱)' },
  139: { account: '短期貸付金', note: '東海林指示 v3 修正 (リンクサポートから貸付返戻、借方=普通預金/貸方=短期貸付金)' },
  140: { account: '売掛金', note: '東海林指示' },
  144: { account: '売掛金', note: '東海林指示 (ウイングロー)' },
  145: { account: '外注費', note: '東海林指示 v3 修正 (カ）スカイズ → 外注費)' },
  147: { account: '租税公課', note: '税 (東海林指示、PE 大阪市)' },
  148: { account: '荷造運賃', note: '郵送費 (東海林指示、ヤマト運輸)' },
  149: { account: '外注費', note: '東海林指示 (関西リフォーム振込)' },
  156: { account: '外注費', note: '東海林指示 v3 修正 (カ）スカイズ → 外注費)' },
  159: { account: '印刷費', note: '東海林指示 (プリントパック)' },
};

// ---------- parsers (前 v1 と同一) ----------
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
      is_intercompany: false, priority: 100, is_active: true,
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

// classifier with shoji_answers override
function classify(no, tx, rules) {
  // 1. 東海林さん回答 (最優先)
  if (SHOJI_ANSWERS[no]) {
    const ans = SHOJI_ANSWERS[no];
    const isDeposit = tx.flow === 'deposit';
    return {
      status: 'ok_manual',
      debit_account: isDeposit ? '普通預金' : ans.account,
      debit_sub: isDeposit ? tx.sub_label : '',
      credit_account: isDeposit ? ans.account : '普通預金',
      credit_sub: isDeposit ? '' : tx.sub_label,
      tax_class: '対象外',
      reason: `${ans.note}`,
    };
  }
  // 2. master_rules マッチ
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
  // 3. 未マッチ pending
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

const classified = allRows.map((tx, i) => ({ no: i + 1, tx, c: classify(i + 1, tx, rules) }));

// 集計
const summary = { total: classified.length, ok: 0, ok_manual: 0, pending: 0 };
for (const x of classified) {
  if (x.c.status === 'ok') summary.ok++;
  else if (x.c.status === 'ok_manual') summary.ok_manual++;
  else summary.pending++;
}
const auto_rate = ((summary.ok + summary.ok_manual) / summary.total * 100).toFixed(1);

// CSV
const csvLines = ['No,日付,銀行,入出金,金額,摘要,借方,貸方,税区分,状態,備考'];
classified.forEach(x => {
  const flowLabel = x.tx.flow === 'deposit' ? '入金' : '出金';
  const debit = x.c.debit_account + (x.c.debit_sub ? `(${x.c.debit_sub})` : '');
  const credit = x.c.credit_account + (x.c.credit_sub ? `(${x.c.credit_sub})` : '');
  const statusLabel = { ok: '自動分類', ok_manual: '東海林指示反映', pending: '要確認' }[x.c.status];
  csvLines.push([
    x.no, x.tx.date,
    x.tx.bank === 'mizuho' ? 'みずほ' : '楽天',
    flowLabel, x.tx.amount,
    csvEscape(x.tx.description),
    csvEscape(debit), csvEscape(credit),
    x.c.tax_class, statusLabel,
    csvEscape(x.c.reason),
  ].join(','));
});
const csvText = '﻿' + csvLines.join('\r\n') + '\r\n';
fs.writeFileSync(OUTPUT_FILE, csvText, 'utf-8');

console.log('=== チェック用一覧 v2 生成完了 (東海林指示 40 件反映) ===');
console.log(`出力: ${OUTPUT_FILE}`);
console.log(`総件数: ${summary.total}`);
console.log(`  ✅ 自動分類 (master_rule): ${summary.ok}`);
console.log(`  🔧 東海林指示反映: ${summary.ok_manual}`);
console.log(`  ❓ 要確認 (残り pending): ${summary.pending}`);
console.log(`分類率: ${auto_rate}%`);
console.log('');
// 状態別の行 No 一覧（pending の確認用）
const pendingNos = classified.filter(x => x.c.status === 'pending').map(x => x.no);
console.log('残り pending No:', pendingNos.length === 0 ? 'なし (全件分類完了)' : pendingNos.join(', '));
