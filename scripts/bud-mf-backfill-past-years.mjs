// Node.js 24+: run from the repository root. No credentials are logged.
import { registerHooks, createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
const require = createRequire(import.meta.url);
const ts = require('typescript');
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && context.parentURL?.includes('/src/lib/bud/mf/') && !specifier.endsWith('.ts')) specifier += '.ts';
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.ts') && url.includes('/src/lib/bud/mf/')) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText };
    return next(url, context);
  }
});
async function main() {
  loadEnvFile(resolve('.env.local'));
  if (!process.env.MF_ACCOUNTING_API_KEY || !process.env.DATABASE_URL) throw new Error('configuration');
  const { MfClient } = await import('../src/lib/bud/mf/client.ts');
  const { backfillPastYears } = await import('../src/lib/bud/mf/backfill.ts');
  const { Client } = require('pg');
  const progress = resolve('.bud-mf-backfill-progress.json');
  const completed = new Set(existsSync(progress) ? JSON.parse(readFileSync(progress, 'utf8')) : []);
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await db.connect();
    await backfillPastYears(new MfClient(process.env.MF_ACCOUNTING_API_KEY), async (since, until, card, bank) => {
      await db.query('select public.bud_mf_store_past($1::date,$2::date,$3::jsonb,$4::jsonb)', [since, until, JSON.stringify(card), JSON.stringify(bank)]);
    }, { completed, log: console.log, onComplete: async key => {
      completed.add(key);
      writeFileSync(progress + '.tmp', JSON.stringify([...completed]));
      renameSync(progress + '.tmp', progress);
    } });
  } finally { await db.end(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => {
  console.error('過去年度の取り込みを停止しました。設定・接続先を確認し、同じコマンドで再実行してください。');
  process.exitCode = 1;
});
