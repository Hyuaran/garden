import {it,expect,vi,beforeEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
const m=vi.hoisted(()=>({load:vi.fn(),save:vi.fn(),retry:vi.fn()}));
vi.mock('./baitoru-actions',()=>({loadBaitoru:m.load,saveBaitoru:m.save,retryBaitoru:m.retry}));
import BaitoruPanel from './baitoru-panel';
beforeEach(()=>{
 cleanup();vi.resetAllMocks();m.load.mockResolvedValue({settings:{enabled:false,period_start:'2026-09-22',chatwork_title:'【バイトル新規応募】',exclude_inquiry_nos:[],notify_room:'dev',mentions:'',max_per_run:10,last_called_at:null},runs:[],failed:[{kintone_record_id:'baitoru:1',name:'山田 花子',notify_error:'通知の失敗'}]});m.save.mockResolvedValue(undefined);m.retry.mockResolvedValue({ok:true});
});
it('shows stopped/dev defaults, saves comma separated exclusions, and retries failed notices',async()=>{
 render(<BaitoruPanel/>);
 expect(await screen.findByLabelText('止める（掲載していない間は止める）')).toBeChecked();
 expect(screen.getByLabelText('通知先')).toHaveValue('dev');
 fireEvent.change(screen.getByLabelText('今回だけ除外する問合せ番号（カンマ区切り）'),{target:{value:'123,456'}});
 fireEvent.click(screen.getByRole('button',{name:'保存'}));
 await waitFor(()=>expect(m.save).toHaveBeenCalledWith(expect.objectContaining({exclude_inquiry_nos:['123','456'],enabled:false,notify_room:'dev'})));
 await screen.findByText('設定を保存しました');
 fireEvent.click(screen.getByRole('button',{name:'もう一度知らせる'}));
 await waitFor(()=>expect(m.retry).toHaveBeenCalledWith('baitoru:1'));await screen.findByText('もう一度知らせました');
});
