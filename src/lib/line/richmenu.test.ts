import { describe, expect, it, vi } from 'vitest';
import { menuDefinition, menuGroup, menuGroups, validContactUrl, type Contact, type MenuGroup } from './richmenu';
import type { Employee, Tag, Member } from './tags';
import { automaticTeamTag } from './tags';
vi.mock('@/lib/supabase/admin',()=>({getSupabaseAdmin:vi.fn()}));
vi.mock('./tags.server',()=>({checked:vi.fn(),loadLineData:vi.fn()}));
import { deployMenus } from './richmenu.server';
const employee: Employee = {employee_id:'1',employee_number:'0001',name:'山田',employment_type:'アルバイト',garden_role:'toss',hire_date:null,termination_date:null,is_active:true,line_user_id:'U1',line_link_source:'self'};
const contact=(key:string,url:string):Contact=>({key,label:key,url,updated_at:'',updated_by:null});
it('ブロードバンド事業のアルバイトに新人チームを自動付与し、手動の選択を戻さない',()=>{
  const tags:Tag[]=[{id:'b',kind:'business',name:'ブロードバンド事業',sort:1},{id:'new',kind:'team',name:'新人チーム',sort:4},{id:'chosen',kind:'team',name:'小泉チーム',sort:2}];
  const business:Member={tag_id:'b',employee_id:'1',source:'manual'};
  expect(automaticTeamTag(employee,tags,[business])).toEqual([{tag_id:'new',employee_id:'1',source:'auto'}]);
  expect(automaticTeamTag(employee,tags,[business,{tag_id:'chosen',employee_id:'1',source:'manual'}])).toEqual([]);
  expect(automaticTeamTag(employee,tags,[])).toEqual([]);
  expect(automaticTeamTag({...employee,employment_type:'正社員'},tags,[business])).toEqual([]);
});
function group(business:string, team?:string) {
  const tags:Tag[]=[{id:'b',kind:'business',name:business,sort:1},...(team?[{id:'t',kind:'team' as const,name:team,sort:1}]:[])];
  const members:Member[]=tags.map(t=>({tag_id:t.id,employee_id:'1',source:'manual'}));
  return menuGroup(employee,tags,members);
}
describe('メニューの選択と押せる範囲',()=>{
  it.each([['宮永チーム','telema','employee_3_base'],['新人チーム','telema','employee_3_base'],['小泉チーム','koizumi','employee_4_base'],['石原チーム','ishihara','employee_4_base'],[undefined,'telema','employee_3_base']])('%s', (team,expected,image)=>{
    const actual=group('ブロードバンド事業',team);
    expect(actual).toBe(expected);expect(menuDefinition(actual,[]).image).toBe(image);
  });
  it('NHK・事務・退職者・解除された人を選ぶ',()=>{
    expect(group('NHK派遣事業')).toBe('nhk');
    expect(group('関西電力事業')).toBe('kanden');
    expect(menuGroup({...employee,employment_type:'正社員'},[{id:'b',kind:'business',name:'ブロードバンド事業',sort:1}],[{tag_id:'b',employee_id:'1',source:'manual'}])).toBe('office');
    expect(menuGroup(employee,[{id:'r',kind:'role',name:'事務',sort:1}],[{tag_id:'r',employee_id:'1',source:'auto'}])).toBe('guest');
    for(const e of [{...employee,is_active:false},{...employee,termination_date:'2000-01-01'},{...employee,line_user_id:null},{...employee,line_link_source:'unfollowed'}])expect(menuGroup(e,[],[])).toBe('guest');
  });
  it('連絡先が空なら宮永さん、ホームページは準備中',()=>{
    const contacts=[contact('miyanaga','https://line.me/ti/p/test')];
    expect(menuDefinition('ishihara',contacts).body.areas[2].action).toEqual({type:'uri',uri:contacts[0].url});
    expect(menuDefinition('nhk',[]).body.areas[2].action).toEqual({type:'message',text:'準備中'});
    expect(menuDefinition('guest',contacts).body.areas[1].action).toEqual({type:'message',text:'準備中'});
  });
  it('絵の区切りと一致し、シフトだけをLIFFへ開く',()=>{
    expect(menuDefinition('koizumi',[]).body.areas.map(a=>a.bounds)).toEqual([{x:0,y:0,width:1250,height:843},{x:1250,y:0,width:1250,height:843},{x:0,y:843,width:1250,height:843},{x:1250,y:843,width:1250,height:843}]);
    expect(menuDefinition('telema',[]).body.size).toEqual({width:2500,height:843});
    expect(menuDefinition('telema',[]).body.areas.map(a=>a.bounds)).toEqual([{x:0,y:0,width:833,height:843},{x:833,y:0,width:834,height:843},{x:1667,y:0,width:833,height:843}]);
    expect(menuDefinition('guest',[]).body.areas.map(a=>a.bounds)).toEqual([{x:0,y:0,width:1250,height:843},{x:1250,y:0,width:1250,height:843}]);
    expect(menuDefinition('guest',[]).body.size).toEqual({width:2500,height:843});
    expect(menuDefinition('telema',[],'123-test').body.areas[1].action).toEqual({type:'uri',uri:'https://liff.line.me/123-test'});
    expect(menuDefinition('telema',[]).body.areas[1].action).toEqual({type:'message',text:'シフト'});
  });
  it.each(['http://line.me/test','https://line.me.evil/test','https://line.me@evil/test','javascript:alert(1)','https://example.com','https://line.me'])('LINE以外を拒否 %s', url=>expect(validContactUrl('nhk',url)).toBe(false));
  it('ホームページだけは他のhttpsを許可',()=>{expect(validContactUrl('guest_home','https://example.com')).toBe(true);expect(validContactUrl('nhk','')).toBe(true);});
});
function transport() {
  const calls:string[]=[];let n=0;
  return {calls,api:{
    create:vi.fn(async()=>{calls.push('create');return 'new'+n++;}),
    upload:vi.fn(async()=>{calls.push('upload');}),
    setDefault:vi.fn(async()=>{calls.push('default');}),
    link:vi.fn(async()=>{calls.push('link');}),
    unlink:vi.fn(async()=>{calls.push('unlink');}),
    remove:vi.fn(async()=>{calls.push('delete');}),
  }};
}
it('作成・既定・500人ずつ付け替え・公開・旧メニュー削除の順',async()=>{
  const t=transport(), groups=new Map<MenuGroup,string[]>([['telema',Array.from({length:1001},(_,i)=>'U'+i)]]);
  await deployMenus([],groups,['old-garden'],['former'],async()=>{},async()=>{t.calls.push('publish');},t.api);
  expect(t.calls).toEqual([...Array.from({length:menuGroups.length},()=>['create','upload']).flat(),'default','link','link','link','unlink','publish','delete']);
  expect(t.api.link.mock.calls.map(c=>(c as unknown as [string,string[]])[1].length)).toEqual([500,500,1]);
  expect(t.api.remove).toHaveBeenCalledWith('old-garden');
});
it.each(['create','upload','setDefault','link','unlink'] as const)('%s失敗時は旧メニューを消さない',async stage=>{
  const t=transport();t.api[stage].mockRejectedValueOnce(new Error('failure'));
  const publish=vi.fn();
  await expect(deployMenus([],new Map([['telema',['U1']]]),['old'],['former'],async()=>{},publish,t.api)).rejects.toThrow('failure');
  expect(t.api.remove).not.toHaveBeenCalled();expect(publish).not.toHaveBeenCalled();
});
it('記録または公開の失敗でも旧メニューを消さない',async()=>{
  for(const failSave of [true,false]){
    const t=transport(), fail=async()=>{throw new Error('database');};
    await expect(deployMenus([],new Map(),['old'],[],failSave?fail:async()=>{},failSave?async()=>{}:fail,t.api)).rejects.toThrow();
    expect(t.api.remove).not.toHaveBeenCalled();
  }
});

it('forms LIFF and fallback actions',()=>{
 expect(menuDefinition('koizumi',[],undefined,'123-forms').body.areas[0].action).toEqual({type:'uri',uri:'https://liff.line.me/123-forms'});
 expect(menuDefinition('ishihara',[],undefined,'').body.areas[0].action).toEqual({type:'message',text:'申告フォーム'});
});
