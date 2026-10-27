import {it,expect,vi,beforeEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
const m=vi.hoisted(()=>({load:vi.fn(),save:vi.fn(),retry:vi.fn(),create:vi.fn(),end:vi.fn(),cancel:vi.fn(),option:vi.fn()}));
vi.mock('./baitoru-actions',()=>({loadBaitoru:m.load,saveBaitoru:m.save,retryBaitoru:m.retry,createPosting:m.create,endPosting:m.end,cancelPosting:m.cancel,changeContentOption:m.option}));
import BaitoruPanel from './baitoru-panel';
beforeEach(()=>{
 cleanup();vi.resetAllMocks();m.load.mockResolvedValue({settings:{enabled:false,period_start:'2026-09-22',chatwork_title:'【バイトル新規応募】',exclude_inquiry_nos:[],notify_room:'dev',mention_employee_ids:[],max_per_run:10,last_called_at:null,content_options:['テレマアルバイト','テレマ正社員']},mention_candidates:[],postings:[],runs:[],failed:[{kintone_record_id:'baitoru:1',name:'山田 花子',notify_error:'通知の失敗'}]});m.save.mockResolvedValue(undefined);m.retry.mockResolvedValue({ok:true});
});
it('registers the chosen dates and content',async()=>{
 render(<BaitoruPanel/>);await screen.findByLabelText('掲載期間の開始');
 fireEvent.change(screen.getByLabelText('掲載期間の開始'),{target:{value:'2026-11-01'}});
 fireEvent.change(screen.getByLabelText('掲載期間の終了'),{target:{value:'2026-11-14'}});
 fireEvent.change(screen.getByLabelText('掲載内容'),{target:{value:'テレマ正社員'}});
 fireEvent.click(screen.getByRole('button',{name:'掲載する'}));
 await waitFor(()=>expect(m.create).toHaveBeenCalledWith('2026-11-01','2026-11-14','テレマ正社員'));
 await screen.findByText('掲載を登録しました');
});
it('shows end for active postings and cancel for future postings only',async()=>{
 const data=await m.load();
 m.load.mockResolvedValue({...data,postings:[
  {id:'active',start_date:'2000-01-01',end_date:'2099-12-31',content:'掲載中の内容',created_at:'2026-10-24T00:00:00Z',ended_early_at:null},
  {id:'future',start_date:'2099-12-31',end_date:'2099-12-31',content:'予定の内容',created_at:'2026-10-24T00:00:00Z',ended_early_at:null},
  {id:'ended',start_date:'2000-01-01',end_date:'2000-01-02',content:'終了の内容',created_at:'2026-10-24T00:00:00Z',ended_early_at:null},
 ]});
 render(<BaitoruPanel/>);
 fireEvent.click(await screen.findByRole('button',{name:'今すぐ終える'}));
 await waitFor(()=>expect(m.end).toHaveBeenCalledWith('active'));await screen.findByText('掲載を終えました');
 expect(screen.getAllByRole('button',{name:'取り消す'})).toHaveLength(1);
 fireEvent.click(screen.getByRole('button',{name:'取り消す'}));
 await waitFor(()=>expect(m.cancel).toHaveBeenCalledWith('future'));await screen.findByText('掲載を取り消しました');
});
it('shows posting registration, saves comma separated exclusions, and retries failed notices',async()=>{
 render(<BaitoruPanel/>);
 expect(await screen.findByLabelText('掲載期間の開始')).toHaveAttribute('type','date');
 expect(screen.queryByText('通知のタイトル')).not.toBeInTheDocument();
 expect(screen.getByLabelText('通知先')).toHaveValue('dev');
 fireEvent.change(screen.getByLabelText('今回だけ除外する問合せ番号（カンマ区切り）'),{target:{value:'123,456'}});
 fireEvent.click(screen.getByRole('button',{name:'保存'}));
 await waitFor(()=>expect(m.save).toHaveBeenCalledWith(expect.objectContaining({exclude_inquiry_nos:['123','456'],enabled:false,notify_room:'dev'})));
 await screen.findByText('設定を保存しました');
 fireEvent.click(screen.getByRole('button',{name:'もう一度知らせる'}));
 await waitFor(()=>expect(m.retry).toHaveBeenCalledWith('baitoru:1'));await screen.findByText('もう一度知らせました');
});

it('shows employee recipient choices and keeps unavailable selections visible', async () => {
 const data=await m.load();
 m.load.mockResolvedValue({...data,settings:{...data.settings,mention_employee_ids:['EMP-2']},mention_candidates:[
  {value:'EMP-1',label:'在籍 太郎'}, {value:'EMP-2',label:'退職 花子（ID 未登録）'},
 ]});
 render(<BaitoruPanel/>);
 await screen.findByText('通知の宛先');
 expect(screen.getByText('退職 花子（ID 未登録）')).toBeInTheDocument();
 expect(screen.getByText('宛先に出るのは Root の従業員で Chatwork ID を入れた人です')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'保存'}));
 await waitFor(()=>expect(m.save).toHaveBeenCalledWith(expect.objectContaining({mention_employee_ids:['EMP-2']})));
});