import { existsSync, mkdirSync, writeFileSync, unlinkSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const marker = '# garden-manual-gate-v1';
try {
  const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const top = git(['rev-parse', '--show-toplevel']);
  let hooks;
  try { hooks = git(['config', '--get', 'core.hooksPath']); } catch (error) { if (error.status !== 1) throw error; }
  const target = resolve(top, hooks || git(['rev-parse', '--git-path', 'hooks']), 'commit-msg');
  if (process.argv.includes('--uninstall')) {
    if (existsSync(target)) {
      if (!readFileSync(target, 'utf8').includes(marker)) throw new Error('別の commit-msg は削除しません');
      unlinkSync(target);
    }
  } else {
    if (existsSync(target) && !process.argv.includes('--force')) throw new Error('commit-msg が既にあります。上書きは --force');
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `#!/bin/sh\n${marker}\ntop=$(git rev-parse --show-toplevel) || exit 1\nscript="$top/scripts/manual-gate/commit-msg.mjs"\nif [ -f "$script" ]; then\n  node "$script" "$@"\n  exit $?\nfi\nexit 0\n`, { encoding: 'utf8', mode: 0o755 });
  }
  console.log(target);
} catch (error) { console.error(`フック設定エラー: ${error.message}`); process.exitCode = 1; }
