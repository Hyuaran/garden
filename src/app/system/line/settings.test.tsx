import { SystemViewProvider } from '../_components/ViewPermissionButton/SystemViewContext';
import { templateFixtures } from './template-fixtures.test-data';
import { InitialUrlView } from "@/lib/ui/InitialUrlView";
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import LineManager from './LineManager';
import RichMenuSettings from './RichMenuSettings';
import ContactSettings from './ContactSettings';
const contact=(key:string,label:string,url='')=>({key,label,url,updated_at:'',updated_by:null});
const contacts=[contact('guest_home','会社のホームページ'),contact('miyanaga','宮永さん','https://line.me/ti/p/m'),contact('team:小泉チーム','小泉さん','https://line.me/ti/p/k')];
const data={templates:templateFixtures,contacts,menus:[],employees:[],tags:[],members:[],history:[],updatedAt:'',greetings:[{id:'g1',employment_tag_id:null,business_tag_id:null,body:'こんにちは\nよろしくお願いします',enabled:true}]};
beforeEach(()=>{
  HTMLDialogElement.prototype.showModal=vi.fn(function(this:HTMLDialogElement){this.setAttribute('open','');});
  HTMLDialogElement.prototype.close=vi.fn();
  localStorage.clear(); window.history.replaceState(null,'','/?tab=people');
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('人とタグは見出しで自由タグを個別に絞り、一斉送信の宛先指定は残す',async()=>{
  const employee={employee_id:'E1',employee_number:'0001',name:'山田 花子',employment_type:'正社員',garden_role:'staff',hire_date:null,termination_date:null,is_active:true,line_user_id:null,line_link_source:null};
  const people=[employee,{...employee,employee_id:'E2',employee_number:'0002',name:'佐藤 太郎'},{...employee,employee_id:'E3',employee_number:'0003',name:'鈴木 次郎'}];
  const tags=[{id:'t1',kind:'free',name:'研修',sort:0},{id:'t2',kind:'free',name:'通知',sort:1}];
  const members=[{employee_id:'E1',tag_id:'t1',source:'manual'},{employee_id:'E1',tag_id:'t2',source:'manual'},{employee_id:'E2',tag_id:'t2',source:'manual'}];
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({...data,employees:people,tags,members})}));
  render(<InitialUrlView search={window.location.search}><LineManager/></InitialUrlView>);
  await screen.findByText('山田 花子');
  for(const label of ['雇用形態','事業','在籍','役割','チーム','自由タグ']) expect(screen.queryByRole('button',{name:label})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'自由タグの並べ替え・絞り込み'}));
  let menu=within(screen.getByRole('dialog'));
  fireEvent.click(menu.getByLabelText('すべて選択'));
  fireEvent.click(menu.getByLabelText('通知 (2)'));
  fireEvent.click(menu.getByRole('button',{name:'OK'}));
  expect(screen.getByText('山田 花子')).toBeInTheDocument();
  expect(screen.getByText('佐藤 太郎')).toBeInTheDocument();
  expect(screen.queryByText('鈴木 次郎')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'自由タグの並べ替え・絞り込み'}));
  menu=within(screen.getByRole('dialog'));
  fireEvent.click(menu.getByLabelText('通知 (2)'));
  fireEvent.click(menu.getByLabelText('— (1)'));
  fireEvent.click(menu.getByRole('button',{name:'OK'}));
  expect(screen.getByText('鈴木 次郎')).toBeInTheDocument();
  expect(screen.queryByText('山田 花子')).toBeNull();
  fireEvent.click(screen.getByRole('tab',{name:'一斉送信'}));
  for(const label of ['雇用形態','事業','在籍','役割','チーム','自由タグ']) expect(screen.getByRole('button',{name:label})).toBeInTheDocument();
});
it('申告フォームの説明はLINE内の2種類の申告である',()=>{
  vi.stubEnv('NEXT_PUBLIC_LIFF_FORMS_ID','123-forms');
  render(<RichMenuSettings data={data} busy={false} act={vi.fn()}/>);
  fireEvent.click(screen.getByText('ブロードバンド事業・小泉チーム'));
  expect(screen.getByText('LINE の中で申告フォームのページが開きます（通勤経路の変更・給与受取口座の変更）')).toBeInTheDocument();
});
it('連絡先は変更列がなく、行をキーボードで押して登録する',()=>{
  const person={employee_id:'E1',employee_number:'0001',name:'山田　花子',employment_type:'正社員',garden_role:'staff',hire_date:null,termination_date:null,is_active:true,line_user_id:null,line_link_source:null,line_contact_url:'https://line.me/ti/p/y'};
  render(<ContactSettings data={{...data,employees:[person]}} busy={false} act={vi.fn()}/>);
  expect(screen.queryByRole('button',{name:'変更する'})).toBeNull();
  expect(screen.queryByText('会社のホームページ')).toBeNull();
  fireEvent.keyDown(screen.getByText('山田 花子').closest('tr')!,{key:' '});
  expect(screen.getByRole('dialog',{name:'山田 花子の連絡先'})).toBeInTheDocument();
  expect(screen.getByText('登録したら、リッチメニュータブの［リッチメニューに反映する］を押してください。')).toBeInTheDocument();
});
it('反映前も6行あり、小泉チームの画像と位置・連絡先を表示する',()=>{
  render(<RichMenuSettings data={data} busy={true} act={vi.fn()}/>);
  expect(screen.getAllByText('反映していません')).toHaveLength(7);
  expect(screen.getByRole('button',{name:'送信中...'})).toBeDisabled();
  fireEvent.click(screen.getByText('ブロードバンド事業・小泉チーム'));
  const dialog=screen.getByRole('dialog');
  expect(within(dialog).getByRole('img')).toHaveAttribute('src','/api/system/line/richmenu-image?group=koizumi');
  for(const [position,label] of [['左上','申告フォーム'],['右上','シフト'],['左下','チームリーダー'],['右下','マネージャー']]) expect(within(dialog).getByText(new RegExp(position+'.+'+label))).toBeInTheDocument();
  expect(within(dialog).getByText(/小泉さんの LINE/)).toBeInTheDocument();
  expect(within(dialog).getByText(/宮永さんの LINE/)).toBeInTheDocument();
});
it('担当者が未登録なら宮永さん、従業員以外の方はお問い合わせだけ',()=>{
  render(<RichMenuSettings data={{...data,contacts:contacts.filter(c=>c.key!=='team:小泉チーム')}} busy={false} act={vi.fn()}/>);
  fireEvent.click(screen.getByText('ブロードバンド事業・小泉チーム'));
  expect(screen.getByText(/（登録がないため）宮永さんの LINE/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'閉じる'}));
  fireEvent.keyDown(screen.getByText('従業員以外の方').closest('tr')!,{key:'Enter'});
  expect(screen.getByText(/全体.+お問い合わせ/)).toBeInTheDocument();
  expect(screen.queryByText(/ホームページ/)).toBeNull();
});
it('あいさつ文は一覧が初期表示で、編集・試し送信確認・カード切り替えと保存ができる',async()=>{
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>data});vi.stubGlobal('fetch',fetcher);
  render(<InitialUrlView search={window.location.search}><LineManager/></InitialUrlView>);
  expect(screen.getByRole('button',{name:'カード表示にする'})).toBeDisabled();
  fireEvent.click(screen.getByRole('tab',{name:'あいさつ文'}));
  fireEvent.click((await screen.findByText('こんにちは よろしくお願いします')).closest('tr')!);
  fireEvent.click(within(screen.getByRole('dialog',{name:'あいさつ文の編集'})).getByRole('button',{name:'自分に試しに送る'}));
  expect(screen.getByRole('dialog',{name:'試し送信'})).toBeInTheDocument();
  expect(screen.queryByRole('dialog',{name:'あいさつ文の編集'})).toBeNull();
  fireEvent.click(within(screen.getByRole('dialog',{name:'試し送信'})).getByRole('button',{name:'閉じる'}));
  fireEvent.click(screen.getByRole('button',{name:'カード表示にする'}));
  expect(screen.getByRole('button',{name:'編集'})).toBeInTheDocument();
  expect(localStorage.getItem('garden.line.greeting.viewMode')).toBe('grid');
  fireEvent.click(screen.getByRole('button',{name:'一覧表示にする'}));
  expect(screen.getByText('こんにちは よろしくお願いします')).toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('一斉送信の記録は行を押すと送った文と相手を小窓で見られる',async()=>{
  window.history.replaceState(null,'','/?tab=broadcast');
  const tags=[{id:'t1',kind:'free',name:'研修',sort:0}];
  const history=[{id:'b1',title:'連絡のテスト',body:'1行目\n2行目',tag_ids:['t1'],recipient_count:3,sent_count:3,failed_count:0,created_at:'2026-11-02T03:18:03Z',sent_at:'2026-11-02T03:18:05Z'}];
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({...data,tags,history})}));
  render(<InitialUrlView search={window.location.search}><LineManager/></InitialUrlView>);
  fireEvent.click(await screen.findByText('連絡のテスト'));
  const dialog=within(screen.getByRole('dialog'));
  expect(dialog.getByText(/1行目/).textContent).toBe('1行目\n2行目');
  expect(dialog.getByText('研修')).toBeTruthy();
  expect(dialog.getByText('3人（送信済 3・失敗 0）')).toBeTruthy();
  expect(dialog.getByText('送信済み')).toBeTruthy();
});
it('一斉送信の定型文ボタンで題名・文・絞り込みが入る',async()=>{
  window.history.replaceState(null,'','/?tab=broadcast');
  const tags=[{id:'e2',kind:'employment',name:'アルバイト',sort:0},{id:'b1',kind:'business',name:'ブロードバンド事業',sort:0},{id:'s1',kind:'status',name:'在籍中',sort:0}];
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({...data,tags})}));
  render(<InitialUrlView search={window.location.search}><LineManager/></InitialUrlView>);
  fireEvent.click(await screen.findByRole('button',{name:'雇用契約書のお知らせ'}));
  expect((screen.getByLabelText('題名') as HTMLInputElement).value).toMatch(/^\d{4}年\d{1,2}月分 雇用契約書$/);
  expect((screen.getByLabelText('送信内容') as HTMLTextAreaElement).value).toContain('【雇用契約書】のクラウドサインをお送りしてますので');
  for (const name of ['アルバイト','ブロードバンド事業','在籍中']) expect(screen.getAllByText(name).length).toBeGreaterThan(0);
});
it('一斉送信が終わると全画面で「〇人に送信しました」を出し、絞り込み・題名・送信内容を空に戻す',async()=>{
  window.history.replaceState(null,'','/?tab=broadcast');
  const tags=[{id:'e2',kind:'employment',name:'アルバイト',sort:0},{id:'b1',kind:'business',name:'ブロードバンド事業',sort:0},{id:'s1',kind:'status',name:'在籍中',sort:0}];
  const fetchMock=vi.fn(async(_url:string,init?:{method?:string;body?:string})=>{
    const action=init?.body?JSON.parse(init.body).action:undefined;
    if(action==='preview')return {ok:true,json:async()=>({people:[{employee_id:'1',name:'山田 一郎'},{employee_id:'2',name:'鈴木 花子'}],remaining:100,id:'d1',expires:1,signature:'s'})};
    if(action==='send')return {ok:true,json:async()=>({sent:2,failed:0})};
    return {ok:true,json:async()=>({...data,tags})};
  });
  vi.stubGlobal('fetch',fetchMock);
  render(<InitialUrlView search={window.location.search}><LineManager/></InitialUrlView>);
  fireEvent.click(await screen.findByRole('button',{name:'雇用契約書のお知らせ'}));
  fireEvent.click(screen.getByRole('button',{name:'送信する'}));
  const dialog=within(await screen.findByRole('dialog'));
  fireEvent.click(dialog.getByRole('button',{name:'送信する'}));
  expect(await screen.findByRole('status',{name:'2人に送信しました'})).toBeTruthy();
  expect((screen.getByLabelText('題名') as HTMLInputElement).value).toBe('');
  expect((screen.getByLabelText('送信内容') as HTMLTextAreaElement).value).toBe('');
  expect(screen.queryByText('2人に送信しました。')).toBeNull();
  expect(fetchMock.mock.calls.some(([,init])=>init?.body&&JSON.parse(init.body).action==='send')).toBe(true);
});

it('題名が空のまま送信すると、エラーを画面の上に出す',async()=>{
  window.history.replaceState(null,'','/?tab=broadcast');
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({...data})});
  vi.stubGlobal('fetch',fetchMock);
  render(<InitialUrlView search={window.location.search}><LineManager/></InitialUrlView>);
  fireEvent.click(await screen.findByRole('button',{name:'送信する'}));
  const notice=(await screen.findByText('題名・送信内容を入力してください。')).closest('[role="alert"][style]') as HTMLElement;
  expect(notice.style.top).toBe('16px');
  expect(notice.style.bottom).toBe('');
  expect(fetchMock.mock.calls.some(([,init])=>init?.body&&JSON.parse(init.body).action==='preview')).toBe(false);
});

it('鉛筆は定型文の変更を開き、入力した名前を保存する',async()=>{
 window.history.replaceState(null,'','/?tab=broadcast');
 const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({...data})});
 vi.stubGlobal('fetch',fetchMock);
 render(<InitialUrlView search={window.location.search}><LineManager/></InitialUrlView>);
 fireEvent.click(await screen.findByRole('button',{name:'雇用契約書のお知らせを変更する'}));
 let dialog=within(screen.getByRole('dialog',{name:'定型文の変更'}));
 expect(dialog.getByLabelText('定型文の題名')).toHaveValue('{年}年{月}月分 雇用契約書');
 fireEvent.change(dialog.getByLabelText('ボタンの名前'),{target:{value:'変更した名前'}});
 fireEvent.click(dialog.getByRole('button',{name:'保存する'}));
 await screen.findByRole('button',{name:'雇用契約書のお知らせを変更する'});
 expect(fetchMock.mock.calls.some(([,init])=>init?.body&&JSON.parse(init.body).action==='templateSave'&&JSON.parse(init.body).label==='変更した名前')).toBe(true);
});

it('許可のないタブを隠し、URLで指定されても許可されたタブを開く',async()=>{
 window.history.replaceState(null,'','/?tab=broadcast');
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>data}));
 render(<SystemViewProvider value={{pageKey:'system-line',admin:false,canAdd:false,tabs:['tags','greeting','broadcast','contacts','richmenu','groups'].map(key=>({key,label:key,allowed:key==='greeting',canAdd:false}))}}><InitialUrlView search={window.location.search}><LineManager/></InitialUrlView></SystemViewProvider>);
 await screen.findByText('こんにちは よろしくお願いします');
 expect(screen.queryByRole('tab',{name:'一斉送信'})).toBeNull();
 expect(screen.queryByRole('button',{name:'雇用契約書のお知らせ'})).toBeNull();
});

it('定型文を追加でき、削除は確認の小窓で確定するまで送らない',async()=>{
 window.history.replaceState(null,'','/?tab=broadcast');
 const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>data});
 vi.stubGlobal('fetch',fetchMock);
 render(<InitialUrlView search={window.location.search}><LineManager/></InitialUrlView>);
 fireEvent.click(await screen.findByRole('button',{name:'＋ 定型文を追加'}));
 let dialog=within(screen.getByRole('dialog',{name:'定型文の追加'}));
 for(const [name,value] of [['ボタンの名前','新しい定型文'],['定型文の題名','{年}年のお知らせ'],['定型文の送信内容','お疲れ様です']]) fireEvent.change(dialog.getByLabelText(name),{target:{value}});
 fireEvent.click(dialog.getByRole('button',{name:'保存する'}));
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'定型文の追加'})).toBeNull());
 expect(fetchMock.mock.calls.some(([,init])=>init?.body&&JSON.parse(init.body).action==='templateSave'&&!JSON.parse(init.body).id)).toBe(true);
 // 結果は画面の下に浮かべる（出ても消えても部品を押し下げない）。何をしたかが分かる文
 const notice=await screen.findByText('定型文を保存しました。');
 expect(notice.closest('div[style*="position: fixed"]')).not.toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'雇用契約書のお知らせを変更する'}));
 dialog=within(screen.getByRole('dialog',{name:'定型文の変更'}));
 // 3 つ以上でも選んだタグが 1 つずつ見える
 for(const name of ['アルバイト','ブロードバンド事業','在籍中']) expect(dialog.getByLabelText('選んでいる絞り込み').textContent).toContain(name);
 fireEvent.click(dialog.getByRole('button',{name:'雇用契約書のお知らせを削除する'}));
 expect(fetchMock.mock.calls.some(([,init])=>init?.body&&JSON.parse(init.body).action==='templateDelete')).toBe(false);
 fireEvent.click(within(screen.getByRole('dialog',{name:'定型文の削除'})).getByRole('button',{name:'削除する'}));
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'定型文の変更'})).toBeNull());
 expect(fetchMock.mock.calls.some(([,init])=>init?.body&&JSON.parse(init.body).action==='templateDelete')).toBe(true);
});
