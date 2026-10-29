import { beforeEach, expect, it, vi } from 'vitest';
import type { Employee, Member, Tag } from './tags';
const mocks=vi.hoisted(()=>({db:vi.fn(),load:vi.fn(),fetch:vi.fn()}));
vi.mock('@/lib/supabase/admin',()=>({getSupabaseAdmin:mocks.db}));
vi.mock('./tags.server',()=>({loadLineData:mocks.load,checked:<T extends {error:unknown}>(r:T)=>{if(r.error)throw r.error;return r;}}));
vi.mock('./staff-client',()=>({lineStaffFetch:mocks.fetch}));
import { syncRichMenus } from './richmenu.server';
const e:Employee={employee_id:'1',employee_number:'0001',name:'山田',employment_type:'アルバイト',garden_role:'toss',hire_date:null,termination_date:null,is_active:true,line_user_id:'U1',line_link_source:'self'};
const tags:Tag[]=[{id:'b',kind:'business',name:'ブロードバンド事業',sort:1},{id:'t',kind:'team',name:'小泉チーム',sort:1}];
let members:Member[], employees:Employee[], saved:{line_user_id:string;richmenu_id:string}[], activated:boolean;
beforeEach(()=>{
  vi.resetAllMocks();members=[{tag_id:'b',employee_id:'1',source:'manual'}];employees=[e];saved=[];activated=true;
  mocks.load.mockImplementation(async()=>({employees,tags,members}));
  mocks.fetch.mockResolvedValue(new Response('{}'));
  mocks.db.mockReturnValue({
    rpc:vi.fn(async()=>({data:true,error:null})),
    from:(table:string)=>{
      let filter:string|undefined,op='select',rows:typeof saved=[];
      const q={
        select:()=>q,order:()=>q,range:()=>q,
        eq:(key:string,value:string)=>{if(key==='line_user_id')filter=value;return q;},
        delete:()=>{op='delete';return q;},
        upsert:(values:typeof saved)=>{op='upsert';rows=values;return q;},
        then:(resolve:(v:unknown)=>void)=>{
          if(table==='system_line_richmenu_assignment'){
            if(op==='delete')saved=saved.filter(r=>r.line_user_id!==filter);
            if(op==='upsert')for(const row of rows){saved=saved.filter(r=>r.line_user_id!==row.line_user_id);saved.push(row);}
          }
          resolve({error:null,data:table==='system_line_contact'?[]:table==='system_line_richmenu'?(activated?['guest','telema','koizumi','nhk','office','ishihara'].map(group_key=>({group_key,richmenu_id:'menu-'+group_key,active:true})):[]):saved});
        },
      };return q;
    },
  });
});
it('準備段階ではLINEに接続しない',async()=>{activated=false;await syncRichMenus();expect(mocks.fetch).not.toHaveBeenCalled();});
it('社員単位の更新では他の社員のメニューを付け替えたり解除したりしない',async()=>{
  employees=[e,{...e,employee_id:'2',line_user_id:'U2'}];
  saved=[{line_user_id:'U2',richmenu_id:'menu-koizumi'}];
  await syncRichMenus('1');
  expect(mocks.load).toHaveBeenCalledWith(true,'1');
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toEqual({richMenuId:'menu-telema',userIds:['U1']});
  expect(saved).toContainEqual({line_user_id:'U2',richmenu_id:'menu-koizumi'});
});
it('紐づけ・チーム・事業変更で付け替え、同じ状態では何もしない',async()=>{
  await syncRichMenus();await syncRichMenus();
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toEqual({richMenuId:'menu-telema',userIds:['U1']});
  members.push({tag_id:'t',employee_id:'1',source:'manual'});await syncRichMenus();
  expect(JSON.parse(mocks.fetch.mock.calls[1][1].body).richMenuId).toBe('menu-koizumi');
  tags.push({id:'n',kind:'business',name:'NHK派遣事業',sort:2});members=[{tag_id:'n',employee_id:'1',source:'manual'}];await syncRichMenus();
  expect(JSON.parse(mocks.fetch.mock.calls[2][1].body).richMenuId).toBe('menu-nhk');
});
it.each(['unlink','unfollow','retire','delete'])('%sで以前のLINE IDのメニューを外す',async reason=>{
  await syncRichMenus();mocks.fetch.mockClear();
  employees=reason==='delete'?[]:[{...e,...(reason==='unlink'?{line_user_id:null}:reason==='unfollow'?{line_link_source:'unfollowed'}:{is_active:false})}];
  await syncRichMenus();expect(mocks.fetch).toHaveBeenCalledWith('/user/U1/richmenu',{method:'DELETE'});expect(saved).toEqual([]);
});
it('LINEで失敗したら割り当て記録を変えず再試行できる',async()=>{
  mocks.fetch.mockRejectedValueOnce(new Error('LINE'));
  await expect(syncRichMenus()).rejects.toThrow('LINE');expect(saved).toEqual([]);
  await syncRichMenus();expect(saved[0].richmenu_id).toBe('menu-telema');
});
