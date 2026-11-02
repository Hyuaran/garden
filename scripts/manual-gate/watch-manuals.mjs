import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { registry, manualsForFiles, root } from './manual-map.mjs';
import { declaration } from './commit-msg.mjs';

const labels = { summary: '⓪要点サマリ', operation: '①使い方', overview: '②仕様書（非エンジニア向け）', engineer: '③仕様書（エンジニア向け）', claude: '④仕様書' };
export function staleDocs(commit, objects, docs = registry.docs) {
  const threshold = Date.parse(commit.date) - 24 * 60 * 60 * 1000;
  if (!Number.isFinite(threshold)) throw new Error('コミット日時が不正です');
  return docs.filter(doc => {
    const object = objects.find(o => o.name === doc.file);
    const date = Date.parse(object?.updated_at || object?.created_at);
    if (object && !Number.isFinite(date)) throw new Error(`Storage の日時が不正です: ${doc.file}`);
    return !object || date < threshold;
  }).sort((a, b) => a.file.localeCompare(b.file)).map(doc => labels[doc.key]);
}
export function reportMessage(items) {
  const date = value => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(value));
  const clean = value => value.replaceAll('[', '［').replaceAll(']', '］');
  return `[info][title]マニュアルが画面より古い機能があります（${items.length} 件）[/title]\n${items.map(i => `・${clean(i.name)}：画面の変更 ${date(i.commit.date)}（${i.commit.hash.slice(0, 7)}）／古いもの ${i.stale.join('・')}`).join('\n')}\n直したら Storage に上げてください。画面の変更がマニュアルに関係ない場合は、次からコミット文に「マニュアル: 対象なし（理由）」と書いてください。[/info]`;
}
export function latestChanges(since, git) {
  let ref = 'origin/main';
  try { git(['fetch', 'origin', 'main']); }
  catch { console.error('git fetch に失敗しました。手元の main で続けます。'); ref = 'main'; }
  const fields = git(['log', ref, `--since=${since}T00:00:00+09:00`, '--format=%H%x00%cI%x00%B', '-z']).split('\0');
  if (fields.at(-1) === '') fields.pop();
  if (fields.length % 3) throw new Error('git 履歴の形式が不正です');
  const commits = [];
  for (let i = 0; i < fields.length; i += 3) {
    const [hash, date, message] = fields.slice(i, i + 3);
    if (!/^[a-f0-9]{40,64}$/.test(hash) || !Number.isFinite(Date.parse(date))) throw new Error('git 履歴の値が不正です');
    if (declaration(message) !== 'excluded') commits.push({ hash, date });
  }
  commits.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const latest = new Map();
  for (const commit of commits) {
    const files = git(['diff-tree', '--root', '-m', '--no-commit-id', '--name-only', '-r', '-z', commit.hash]).split('\0').filter(Boolean);
    for (const manual of manualsForFiles(files)) if (!latest.has(manual.key)) latest.set(manual.key, { ...manual, commit });
  }
  return [...latest.values()];
}
export async function watch({ since, dry, git, listObjects, send, print = console.log }) {
  const changes = latestChanges(since, git);
  const items = [];
  for (const change of changes) {
    const manual = registry.manuals.find(m => m.key === change.key);
    const stale = staleDocs(change.commit, await listObjects(manual.storagePrefix));
    if (stale.length) items.push({ ...change, stale });
  }
  if (!items.length) { print('すべてそろっています'); return; }
  const body = reportMessage(items);
  if (dry) print(body);
  else await send(body);
}
export async function main(args = process.argv.slice(2)) {
  if (args.some(a => a !== '--dry' && !a.startsWith('--since='))) throw new Error('引数が不正です');
  const since = args.find(a => a.startsWith('--since='))?.slice(8) || '2026-11-02';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || new Date(since).toISOString().slice(0, 10) !== since) throw new Error('--since は YYYY-MM-DD で指定してください');
  const env = resolve(root, '.env.local');
  if (existsSync(env)) process.loadEnvFile(env);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Storage: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が必要です');
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(30000) }) } });
  const git = args => {
    try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch { throw new Error(`git ${args[0]} に失敗しました`); }
  };
  await watch({ since, dry: args.includes('--dry'), git,
    async listObjects(prefix) {
      const objects = [];
      for (let offset = 0; ; offset += 100) {
        const { data, error } = await db.storage.from('system-manuals').list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
        if (error || !data) throw new Error(`Storage の読み取りに失敗しました: ${prefix}`);
        objects.push(...data);
        if (data.length < 100) return objects;
      }
    },
    async send(body) {
      const token = process.env.CHATWORK_API_TOKEN;
      const room = process.env.GARDEN_NOTICE_CHATWORK_ROOM_ID || '450125458';
      if (!token || !/^\d+$/.test(room)) throw new Error('Chatwork 通知設定が不正です');
      const response = await fetch(`https://api.chatwork.com/v2/rooms/${room}/messages`, { method: 'POST', headers: { 'X-ChatWorkToken': token }, body: new URLSearchParams({ body }), signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`Chatwork 送信に失敗しました (${response.status})`);
    },
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
