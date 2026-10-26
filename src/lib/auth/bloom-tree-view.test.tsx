import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { GARDEN_ROLE_ORDER, isRoleAtLeast } from '@/app/root/_constants/types';
import { BLOOM_TREE_PAGES, BLOOM_TREE_VIEW_SCOPES, bloomTreePageKey } from './bloom-tree-view-scopes';
import { resolveCanView, type ViewPermission, type Viewer } from './view-permission';
vi.mock('server-only',()=>({}));
const mocks=vi.hoisted(()=>({rows:[] as ViewPermission[],viewer:{role:'staff',employeeId:'employee'} as Viewer,reads:0}));
vi.mock('./view-permission.server', async()=>{
  const {resolveCanView}=await import('./view-permission');
  class ViewPermissionError extends Error {constructor(message:string,public status=403){super(message);}}
  return {ViewPermissionError,viewPermissionContext:async()=>({viewer:mocks.viewer,userId:'self'}),canView:async(p:string,t:string,v:Viewer)=>resolveCanView(mocks.rows,p,t,v)};
});
vi.mock('@/lib/supabase/admin',()=>({getSupabaseAdmin:()=>{mocks.reads++;return {from:()=>{const q:any={then:(done:any)=>done({data:[],error:null})};for(const key of ['select','eq','gte','order','maybeSingle'])q[key]=()=>q;return q;}};}}));
import { requireBloomTreeRead } from './bloom-tree-view.server';
import { GET } from '@/app/api/bloom/read/route';
const setting=(page:string,roles:string[],tab='',people:string[]=[]):ViewPermission=>({page_key:page,tab_key:tab,roles,employee_ids:people,viewers_can_add:false,updated_by:'admin',updated_at:''});
beforeEach(()=>{mocks.rows=[];mocks.viewer={role:'staff',employeeId:'employee'};mocks.reads=0;});
describe('Bloom / Tree 閲覧設定',()=>{
 for(const scope of BLOOM_TREE_VIEW_SCOPES)for(const role of GARDEN_ROLE_ORDER)it(`設定なし ${scope.pageKey}/${scope.tabKey} ${role}`,()=>{
  const expected=scope.pageKey.startsWith('tree-') || (scope.pageKey==='bloom-ceo-status'?role==='super_admin':isRoleAtLeast(role,scope.pageKey==='bloom-monthly-digest-edit'?'admin':'staff'));
  expect(resolveCanView([],scope.pageKey,scope.tabKey,{role,employeeId:'employee'})).toBe(expected);
 });
 for(const scope of BLOOM_TREE_VIEW_SCOPES)it(`拡大・縮小・個人 ${scope.pageKey}/${scope.tabKey}`,async()=>{
  const {pageKey:p,tabKey:t}=scope;mocks.viewer.role='toss';
  mocks.rows=[setting(p,['toss'],t)];await expect(requireBloomTreeRead(p,t)).resolves.toBeTruthy();
  mocks.rows=[setting(p,[],t)];await expect(requireBloomTreeRead(p,t)).rejects.toThrow();
  mocks.rows=[setting(p,[],t,['employee'])];await expect(requireBloomTreeRead(p,t)).resolves.toBeTruthy();
  mocks.viewer.role='super_admin';mocks.rows=[setting(p,[],t)];await expect(requireBloomTreeRead(p,t)).resolves.toBeTruthy();
 });
 it('タブ設定を画面設定より優先し、不明スコープを拒否',async()=>{
  mocks.rows=[setting('bloom-blueprint',['staff']),setting('bloom-blueprint',[],'modules')];
  await expect(requireBloomTreeRead('bloom-blueprint','overview')).resolves.toBeTruthy();
  await expect(requireBloomTreeRead('bloom-blueprint','modules')).rejects.toThrow();
  await expect(requireBloomTreeRead('bloom-unknown')).rejects.toThrow();
 });
 it('API は拒否後に管理者接続を作らない。書き込みメソッドは公開しない',async()=>{
  mocks.rows=[setting('bloom-roadmap',[])];
  expect((await GET(new Request('http://localhost/api/bloom/read?operation=roadmap&page=/bloom/roadmap'))).status).toBe(403);
  expect(mocks.reads).toBe(0);
  mocks.rows=[setting('bloom-roadmap',['staff'])];
  expect((await GET(new Request('http://localhost/api/bloom/read?operation=roadmap&page=/bloom/roadmap'))).status).toBe(200);
  expect(mocks.reads).toBe(1);
 });
 it('任意テーブル・別画面への読み取り切替を拒否',async()=>{
  for(const [op,page] of [['root_employees','/bloom'],['digests','/bloom/roadmap'],['roadmap','/tree/dashboard']])expect((await GET(new Request(`http://localhost/api/bloom/read?operation=${op}&page=${page}`))).status).toBe(403);
  expect(mocks.reads).toBe(0);
 });
 it('ワークボードの閲覧できる別タブからデータを取得できない',async()=>{
  mocks.rows=[setting('bloom-workboard',['staff']),setting('bloom-workboard',[],'members')];
  expect((await GET(new Request('http://localhost/api/bloom/read?operation=teamStatus&page=/bloom/workboard'))).status).toBe(403);
  expect(mocks.reads).toBe(0);
 });
 it('全画面のURLを一意に解決する。ログインは対象外',()=>{
  for(const [key,path]of BLOOM_TREE_PAGES)expect(bloomTreePageKey(path.replace('[month]','2026-10'))).toBe(key);
  expect(bloomTreePageKey('/tree/login')).toBeUndefined();
 });
 it('migration・書き込み・cron の境界',()=>{
  const sql=readFileSync('supabase/migrations/20261027000448_bloom_tree_view_permissions.sql','utf8');
  for(const s of BLOOM_TREE_VIEW_SCOPES)expect(sql).toContain(`('${s.pageKey}','${s.tabKey}','${s.label}',`);
  expect(sql).toContain("check (page_key not like 'bloom-%' or viewers_can_add=false)");
  expect(sql).not.toMatch(/for (insert|update|delete)/i);
  expect(sql).not.toMatch(/on public\.root_employees/);
  for(const file of ['src/app/bloom/workboard/_lib/mutations.ts','src/app/tree/_lib/queries.ts'])expect(readFileSync(file,'utf8')).not.toContain('getSupabaseAdmin');
  for(const period of ['daily','weekly','monthly'])expect(readFileSync(`src/app/api/bloom/cron/${period}/route.ts`,'utf8')).not.toContain('requireBloomTreeRead');
  expect(sql).not.toContain('???');expect(sql.charCodeAt(0)).not.toBe(0xfeff);
 });
});
