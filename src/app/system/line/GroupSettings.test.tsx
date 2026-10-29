import {beforeEach,expect,it,vi} from 'vitest';
import {fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import GroupSettings from './GroupSettings';
vi.mock('../_components/DataTable/DataTable',()=>({default:({rows,onRowClick}:{rows:{id:string;label:string}[];onRowClick:(r:unknown)=>void})=><div>{rows.map(r=><button key={r.id} onClick={()=>onRowClick(r)}>{r.label}</button>)}</div>}));
beforeEach(()=>{
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  global.fetch=vi.fn(async(_url,init)=>new Response(JSON.stringify(init?.method==='POST'?{id:'1',code:JSON.parse(String(init.body)).action==='code'?'G-4821':null}:{groups:[{id:'1',label:'A',account:'dev',chatwork_room_id:'123',notify_enabled:false,linked_at:null}]})));
});
it('追加の小窓でコードを作る',async()=>{
  render(<GroupSettings/>);await screen.findByText('A');
  fireEvent.click(screen.getByText('グループを追加する'));
  fireEvent.change(screen.getByLabelText('グループの名前'),{target:{value:'B'}});
  fireEvent.change(screen.getByLabelText('知らせ先の Chatwork ルームの番号'),{target:{value:'456'}});
  fireEvent.click(screen.getByText('確認コードを作る'));
  expect(await screen.findByRole('status')).toHaveTextContent('連携 G-4821（24 時間有効）');
});
it('行を押して変更し、確認後に外す',async()=>{
  render(<GroupSettings/>);fireEvent.click(await screen.findByText('A'));
  fireEvent.click(screen.getByLabelText('オン'));fireEvent.click(screen.getByText('保存する'));
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(vi.mocked(fetch).mock.calls.some(([,init])=>init?.body&&JSON.parse(String(init.body)).notify===true)).toBe(true);
  fireEvent.click(screen.getByText('A'));fireEvent.click(screen.getByText('このグループの記録を外す'));
  const confirmation=screen.getByRole('dialog',{name:'グループの記録を外しますか'});
  fireEvent.click(within(confirmation).getByText('記録を外す'));
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(vi.mocked(fetch).mock.calls.some(([,init])=>init?.body&&JSON.parse(String(init.body)).action==='remove'&&JSON.parse(String(init.body)).confirm)).toBe(true);
});
