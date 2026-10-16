// Run from any directory: node scripts/innovera-metrics-verify/verify.mjs --lp-circuit-ids=123,456
// The extra IDs must be the actual LP circuits (their business meaning cannot be inferred).
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { performance } from 'node:perf_hooks';
import pg from 'pg';

const from = '2026-01-01';
const to = '2026-10-15';
const usage = 'Usage: node scripts/innovera-metrics-verify/verify.mjs --lp-circuit-ids=123,456';

function firstDifference(a, b, path = '$') {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a), bk = Object.keys(b);
    if (JSON.stringify(ak) !== JSON.stringify(bk)) return { path, oldKeys: ak, newKeys: bk };
    for (const key of ak) {
      const diff = firstDifference(a[key], b[key], `${path}[${JSON.stringify(key)}]`);
      if (diff) return diff;
    }
  }
  return { path, old: a, new: b };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) { console.log(usage); return; }
  if (args.length !== 1 || !/^--lp-circuit-ids=\d+(,\d+)*$/.test(args[0])) throw new Error(usage);
  const actualIds = [...new Set(args[0].split('=')[1].split(',').map(Number))];
  if (actualIds.some(id => !Number.isSafeInteger(id) || id > 2147483647)) throw new Error('Invalid circuit ID');
  const env = parseEnv(readFileSync(new URL('../../.env.local', import.meta.url), 'utf8'));
  if (!env.DATABASE_URL) throw new Error('.env.local: DATABASE_URL is required');
  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  let matches = 0, mismatches = 0;
  const timings = [];
  await client.connect();
  try {
    await client.query('begin isolation level repeatable read read only');
    await client.query("select set_config('request.jwt.claims', $1, true)", ['{"role":"service_role"}']);
    // The preserved slow implementation must be allowed to finish for comparison.
    await client.query("set local statement_timeout = '0'");
    const present = await client.query(`select distinct circuit_id from public.system_innovera_call
      where start_time >= $1::date::timestamp at time zone 'Asia/Tokyo'
        and start_time < ($2::date + 1)::timestamp at time zone 'Asia/Tokyo'
        and circuit_id = any($3::integer[])`, [from, to, actualIds]);
    if (actualIds.some(id => !present.rows.some(r => r.circuit_id === id))) {
      throw new Error('指定した LP 回線に対象期間の通話が存在しません');
    }
    const employees = await client.query(`select employee_id from public.root_employees
      where is_active = true and deleted_at is null order by employee_id limit 3`);
    if (employees.rows.length !== 3) throw new Error('実在する社員を3人取得できません');
    const ranges = [];
    for (let day = new Date(`${from}T00:00:00Z`); day.toISOString().slice(0, 10) <= to; day.setUTCDate(day.getUTCDate() + 1)) {
      const date = day.toISOString().slice(0, 10);
      ranges.push({ label: 'daily', from: date, to: date, employee: null });
    }
    for (let month = 0; month < 10; month++) {
      ranges.push({ label: 'monthly', from: new Date(Date.UTC(2026, month, 1)).toISOString().slice(0, 10),
        to: [new Date(Date.UTC(2026, month + 1, 0)).toISOString().slice(0, 10), to].sort()[0], employee: null });
    }
    ranges.push({ label: 'full', from, to, employee: null });
    for (const { employee_id } of employees.rows) ranges.push({ label: 'employee', from, to, employee: employee_id });
    const circuitSets = [[164, 165], actualIds];
    for (const ids of circuitSets) {
      for (const range of ranges) {
        const params = [range.from, range.to, ids, range.employee];
        const old = await client.query('select public.system_innovera_metrics_v1($1::date,$2::date,$3::integer[],$4::text) as result', params);
        const started = performance.now();
        const fresh = await client.query('select public.system_innovera_metrics($1::date,$2::date,$3::integer[],$4::text) as result', params);
        const ms = performance.now() - started;
        if (range.label === 'full') timings.push({ circuit_ids: ids, ms: Number(ms.toFixed(3)) });
        if (JSON.stringify(old.rows[0].result) !== JSON.stringify(fresh.rows[0].result)) {
          mismatches++;
          console.error(JSON.stringify({ range, circuit_ids: ids, difference: firstDifference(old.rows[0].result, fresh.rows[0].result) }, null, 2));
          process.exitCode = 1;
          return;
        }
        matches++;
        if (matches % 25 === 0) console.log(`比較済み ${matches} 件`);
      }
    }
  } finally {
    try { await client.query('rollback'); } finally { await client.end(); }
    console.log(`一致 ${matches} 件／不一致 ${mismatches} 件`);
    console.log('新しい関数の全期間の所要時間（クライアント往復込み ms）:', JSON.stringify(timings));
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
