import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import LineManager from './LineManager';
import RichMenuSettings from './RichMenuSettings';
import ContactSettings from './ContactSettings';
const contact=(key:string,label:string,url='')=>({key,label,url,updated_at:'',updated_by:null});
const contacts=[contact('guest_home','会社のホームページ'),contact('miyanaga','宮永さん','https://line.me/ti/p/m'),contact('team:小泉チーム','小泉さん','https://line.me/ti/p/k')];
const data={contacts,menus:[],employees:[],tags:[],members:[],history:[],updatedAt:'',greetings:[{id:'g1',employment_tag_id:null,business_tag_id:null,body:'こんにちは\nよろしくお願いします',enabled:true}]};
beforeEach(()=>{
  HTMLDialogElement.prototype.showModal=vi.fn(function(this:HTMLDialogElement){this.setAttribute('open','');});
  HTMLDialogElement.prototype.close=vi.fn();
  localStorage.clear(); window.history.replaceState(null,'','/?tab=people');
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('連絡先は変更列がなく、行をキーボードで押して登録する',()=>{
  render(<ContactSettings data={data} busy={false} act={vi.fn()}/>);
  expect(screen.queryByRole('button',{name:'変更する'})).toBeNull();
  fireEvent.keyDown(screen.getByText('宮永さん').closest('tr')!,{key:' '});
  expect(screen.getByRole('dialog',{name:'宮永さんの連絡先'})).toBeInTheDocument();
  expect(screen.getByText('登録したら、リッチメニュータブの［リッチメニューに反映する］を押してください。')).toBeInTheDocument();
});
it('反映前も6行あり、小泉チームの画像と位置・連絡先を表示する',()=>{
  render(<RichMenuSettings data={data} busy={true} act={vi.fn()}/>);
  expect(screen.getAllByText('反映していません')).toHaveLength(6);
  expect(screen.getByRole('button',{name:'送信中...'})).toBeDisabled();
  fireEvent.click(screen.getByText('ブロードバンド事業・小泉チーム'));
  const dialog=screen.getByRole('dialog');
  expect(within(dialog).getByRole('img')).toHaveAttribute('src','/line/richmenu/employee_4.jpg');
  for(const [position,label] of [['左上','申告フォーム'],['右上','シフト'],['左下','チームリーダー'],['右下','宮永さん']]) expect(within(dialog).getByText(new RegExp(position+'.+'+label))).toBeInTheDocument();
  expect(within(dialog).getByText(/小泉さんの LINE/)).toBeInTheDocument();
  expect(within(dialog).getByText(/宮永さんの LINE/)).toBeInTheDocument();
});
it('担当者が未登録なら宮永さん、ホームページ未登録なら準備中を表示する',()=>{
  render(<RichMenuSettings data={{...data,contacts:contacts.filter(c=>c.key!=='team:小泉チーム')}} busy={false} act={vi.fn()}/>);
  fireEvent.click(screen.getByText('ブロードバンド事業・小泉チーム'));
  expect(screen.getByText(/（登録がないため）宮永さんの LINE/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'閉じる'}));
  fireEvent.keyDown(screen.getByText('従業員以外の方').closest('tr')!,{key:'Enter'});
  expect(screen.getByText('準備中です（会社のホームページが登録されていません）')).toBeInTheDocument();
});
it('あいさつ文は一覧が初期表示で、編集・試し送信確認・カード切り替えと保存ができる',async()=>{
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>data});vi.stubGlobal('fetch',fetcher);
  render(<LineManager/>);
  expect(screen.getByRole('button',{name:'カード表示にする'})).toBeDisabled();
  fireEvent.click(screen.getByRole('tab',{name:'あいさつ文'}));
  fireEvent.click((await screen.findByText('こんにちは よろしくお願いします')).closest('tr')!);
  fireEvent.click(within(screen.getByRole('dialog',{name:'あいさつ文の編集'})).getByRole('button',{name:'自分に試しに送る'}));
  expect(screen.getByRole('dialog',{name:'試し送信'})).toBeInTheDocument();
  expect(screen.queryByRole('dialog',{name:'あいさつ文の編集'})).toBeNull();
  fireEvent.click(within(screen.getByRole('dialog',{name:'試し送信'})).getByRole('button',{name:'閉じる'}));
  fireEvent.click(screen.getByRole('button',{name:'カード表示にする'}));
  expect(screen.getByRole('button',{name:'編集する'})).toBeInTheDocument();
  expect(localStorage.getItem('garden.line.greeting.viewMode')).toBe('grid');
  fireEvent.click(screen.getByRole('button',{name:'一覧表示にする'}));
  expect(screen.getByText('こんにちは よろしくお願いします')).toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
