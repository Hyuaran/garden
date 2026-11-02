import { beforeEach,expect,it,vi } from 'vitest';
import type { GardenRole } from '@/app/root/_constants/types';
import type { ViewPermission } from '@/lib/auth/view-permission';
const state=vi.hoisted(()=>({role:'staff' as GardenRole,rows:[] as ViewPermission[]}));
vi.mock('@/lib/auth/view-permission.server',async()=>{
 const { resolveCanView }=await import('@/lib/auth/view-permission');
 class ViewPermissionError extends Error {status=403;}
 return {ViewPermissionError,viewPermissionContext:async()=>({viewer:{employeeId:'E1',role:state.role},name:'保存者'}),
 canReadSystemScope:async(page:string,tab:string,viewer:{employeeId:string;role:GardenRole})=>{
  if(tab)return resolveCanView(state.rows,page,tab,viewer);
  return ['tags','greeting','broadcast','contacts','richmenu','groups'].some(t=>resolveCanView(state.rows,page,t,viewer));
 }};
});
import { requireLineAdmin } from './tags.server';
beforeEach(()=>{state.role='staff';state.rows=[];});
it('既定は全権管理者だけ・タブの個人許可はそのタブだけに反映する',async()=>{
 for(const tab of ['','tags','broadcast'])expect(await requireLineAdmin(tab)).toBeNull();
 state.role='super_admin';expect(await requireLineAdmin('broadcast')).toEqual({employee_id:'E1',name:'保存者'});
 state.role='staff';state.rows=[{page_key:'system-line',tab_key:'broadcast',roles:[],employee_ids:['E1'],viewers_can_add:false,updated_by:'A',updated_at:''}];
 expect(await requireLineAdmin()).toBeTruthy();expect(await requireLineAdmin('broadcast')).toBeTruthy();expect(await requireLineAdmin('tags')).toBeNull();
});
