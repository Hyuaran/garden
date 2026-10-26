import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { GARDEN_ROLE_ORDER, type GardenRole } from '@/app/root/_constants/types';
import { resolveCanView, type ViewPermission } from '@/lib/auth/view-permission';
import { bloomTreePageKey } from '@/lib/auth/bloom-tree-view-scopes';
const state=vi.hoisted(()=>({role:'toss' as GardenRole,rows:[] as ViewPermission[]}));
vi.mock('next/navigation',()=>({usePathname:()=>'/tree/dashboard',useRouter:()=>({push:vi.fn()})}));
vi.mock('../_state/TreeStateContext',()=>({useTreeState:()=>({role:state.role==='toss'?'sprout':state.role==='closer'?'branch':'manager',treeUser:null,menuOrder:[],tossWaitCount:0,confirmWaitCount:0,fbRemaining:0,alertCount:0,isAway:false})}));
vi.mock('@/lib/auth/bloom-tree-view.client',()=>({useBloomTreeView:()=>((href:string,defaults?:boolean)=>resolveCanView(state.rows,bloomTreePageKey(href)!,'',{role:state.role,employeeId:'employee'},defaults))}));
import { SidebarNav } from './SidebarNav';
afterEach(()=>{cleanup();state.rows=[];});
describe('Tree 既存メニューを全8役職で保持',()=>{
 for(const role of GARDEN_ROLE_ORDER)it(role,()=>{
  state.role=role;const {container,getByText,queryByText}=render(<SidebarNav />);
  fireEvent.mouseEnter(container.firstChild!);
  for(const label of ['検索','ダッシュボード','アポラン','有効率','架電画面','クローザー待ち','Chatwork情報','業務終了報告','Q&A検索','動画ポータル','マイページ','フィードバック一覧'])expect(getByText(label)).toBeTruthy();
  for(const label of ['通話画面','フォローコール','Breeze'])expect(!!queryByText(label)).toBe(role!=='toss');
  for(const label of ['前確・後確待ち','フィードバック入力','モニタリング','スクリプト管理','要フォロー','休憩スケジュール'])expect(!!queryByText(label)).toBe(!['toss','closer'].includes(role));
 });
 it('トスに追加されたメニューだけ表示する',()=>{
  state.role='toss';state.rows=[{page_key:'tree-monitoring',tab_key:'',roles:['toss'],employee_ids:[],viewers_can_add:false,updated_by:'admin',updated_at:''}];
  const {container,getByText,queryByText}=render(<SidebarNav />);fireEvent.mouseEnter(container.firstChild!);
  expect(getByText('モニタリング')).toBeTruthy();expect(queryByText('フィードバック入力')).toBeNull();
 });
 it('従来見えていたメニューを設定で隠す',()=>{
  state.role='cs';state.rows=[{page_key:'tree-search',tab_key:'',roles:[],employee_ids:[],viewers_can_add:false,updated_by:'admin',updated_at:''}];
  const {container,queryByText}=render(<SidebarNav />);fireEvent.mouseEnter(container.firstChild!);expect(queryByText('検索')).toBeNull();
 });
});
