import test from 'node:test';
import assert from 'node:assert/strict';
import { manualsForFiles, registry, readRegistry } from './manual-map.mjs';
import { declaration, isAutomatic } from './commit-msg.mjs';
import { latestChanges, staleDocs, watch } from './watch-manuals.mjs';

test('画面、API、my、共通部品、テストの対応', () => {
  for (const file of ['src/app/system/innovera-calls/InnoveraCallsClient.tsx', 'src/app/api/system/innovera-calls/circuit-order/route.ts']) {
    assert.equal(manualsForFiles([file])[0].name, 'INNOVERA履歴・録音');
  }
  assert.equal(manualsForFiles(['src/app/my/ApDailyReview.tsx'])[0].key, 'system/ap-daily');
  assert.equal(manualsForFiles(['src/app/my/page.tsx'])[0].key, 'system/mypage');
  assert.deepEqual(manualsForFiles(['src/app/system/_components/Modal/Modal.tsx', 'src/app/foo.test.tsx', 'docs/x.md', 'src/app/system/docs/__tests__/x.ts']), []);
});
test('最長の区切り一致、group、private、Windows、extra-map、他モジュール', () => {
  assert.equal(manualsForFiles(['src/app/(auth)/system/innovera-calls/_components/X.tsx'])[0].key, 'system/innovera-calls');
  assert.deepEqual(manualsForFiles(['src/app/system/innovera-calls-other/page.tsx']), []);
  assert.equal(manualsForFiles(['src\\lib\\mail-forwarding\\notify.ts'])[0].key, 'root/mail-forwarding');
  assert.equal(manualsForFiles(['src/app/bud/bank/page.tsx'])[0].key, 'bud/bank');
  assert.equal(manualsForFiles(['src/lib/innovera/sync.server.ts'])[0].key, 'system/innovera');
  assert.deepEqual(manualsForFiles(['src/lib/innovera/client.ts']), []);
});
test('登録を解析できなければ停止', () => {
  assert.throws(() => readRegistry('const MANUAL_PATHS = {};'));
  assert.ok(registry.manuals.length >= 34);
  assert.equal(registry.docs.length, 5);
});
test('コミット文の行と理由、全角コロン、自動コミット', () => {
  assert.equal(declaration('修正\nマニュアル: 済 INNOVERA'), 'done');
  assert.equal(declaration('マニュアル：済'), 'done');
  assert.equal(declaration('マニュアル: 対象なし（内部修正）'), 'excluded');
  for (const value of ['修正のみ', '本文にマニュアル: 済', 'マニュアル: 対象なし', 'マニュアル：対象なし（ ）']) assert.equal(declaration(value), null);
  for (const value of ['fixup! x', 'squash! x', 'Revert "x"']) assert.ok(isAutomatic(value));
});
const hash = 'a'.repeat(40);
const date = '2026-11-02T05:03:11Z';
const objects = registry.docs.map(d => ({ name: d.file, updated_at: '2026-11-01T05:03:11Z' }));
test('24時間の境界、欠落、created_at、日時エラー', () => {
  assert.deepEqual(staleDocs({ date }, objects), []);
  assert.equal(staleDocs({ date }, objects.slice(1)).length, 1);
  assert.equal(staleDocs({ date }, objects.map(o => ({ ...o, updated_at: '2026-11-01T05:03:10Z' }))).length, 5);
  assert.deepEqual(staleDocs({ date }, objects.map(o => ({ name: o.name, created_at: o.updated_at }))), []);
  assert.throws(() => staleDocs({ date }, [{ name: registry.docs[0].file }]));
});
function fakeGit(args) {
  if (args[0] === 'fetch') return '';
  if (args[0] === 'log') return `${hash}\0${date}\0画面修正\0`;
  if (args[0] === 'diff-tree') return 'src/app/system/innovera-calls/page.tsx\0';
  throw new Error('想定外');
}
test('dry は送信せず1通分を出力（git・Storageとも代替）', async () => {
  const output = [];
  await watch({ since: '2026-10-25', dry: true, git: fakeGit, listObjects: async () => [], send: async () => assert.fail('送信禁止'), print: text => output.push(text) });
  assert.equal(output.length, 1);
  assert.match(output[0], /2026-11-02 14:03:11（aaaaaaa）/);
  assert.match(output[0], /⓪要点サマリ・①使い方/);
  console.log('代替データの --dry 出力:\n' + output[0]);
});
test('すべてそろっていれば無送信、古ければ1回のみ送信', async () => {
  let sent = 0;
  const base = { since: '2026-10-25', dry: false, git: fakeGit, send: async () => sent++, print: text => assert.equal(text, 'すべてそろっています') };
  await watch({ ...base, listObjects: async () => objects });
  assert.equal(sent, 0);
  await watch({ ...base, listObjects: async () => [] });
  assert.equal(sent, 1);
});
test('fetch失敗はmainへ、対象なしコミットは無視', () => {
  const git = args => {
    if (args[0] === 'fetch') throw new Error('offline');
    assert.equal(args[1], 'main');
    return `${hash}\0${date}\0マニュアル: 対象なし（内部修正）\0`;
  };
  assert.deepEqual(latestChanges('2026-10-25', git), []);
});
test('Storageの失敗は伝播し通知しない', async () => {
  await assert.rejects(watch({ since: '2026-10-25', dry: true, git: fakeGit, listObjects: async () => { throw new Error('Storage error'); }, send: async () => assert.fail('送信禁止') }), /Storage error/);
});
