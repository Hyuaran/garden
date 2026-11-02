import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { manualsForFiles } from './manual-map.mjs';

export function declaration(message) {
  for (const line of message.split(/\r?\n/)) {
    if (/^\s*マニュアル\s*[:：]\s*済(?:\s|$|[（(]|[^\x00-\x7f])/.test(line)) return 'done';
    const match = line.match(/^\s*マニュアル\s*[:：]\s*対象なし(.*)$/);
    if (match && match[1].replace(/[\s()（）:：]/g, '').length) return 'excluded';
  }
  return null;
}
export function isAutomatic(message) { return /^(?:fixup!|squash!|Revert ")/.test(message.trimStart()); }
export function gate(messageFile) {
  if (process.env.MANUAL_GATE_SKIP === '1') { console.log('関所を飛ばしました'); return; }
  const message = readFileSync(messageFile, 'utf8');
  if (isAutomatic(message)) return;
  const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
  if (existsSync(git(['rev-parse', '--git-path', 'MERGE_HEAD']))) return;
  const manuals = manualsForFiles(git(['diff', '--cached', '--name-only', '-z']).split('\0').filter(Boolean));
  if (!manuals.length || declaration(message)) return;
  console.error('マニュアルの確認が必要です。');
  for (const manual of manuals) console.error(`・${manual.name}\n${manual.files.slice(0, 3).map(f => `  ${f}`).join('\n')}`);
  console.error('例: マニュアル: 済 INNOVERA履歴・録音\n例: マニュアル: 対象なし（表示に影響しない内部修正）\nマニュアル 5 点（⓪①②③④）を直して Storage に上げてから『マニュアル: 済』と書く');
  process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { gate(process.argv[2]); } catch (error) { console.error(`関所エラー: ${error.message}`); process.exitCode = 1; }
}
