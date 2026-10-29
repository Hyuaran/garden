import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({view:'today'}));
vi.mock('next/navigation',()=>({useSearchParams:()=>new URLSearchParams('reportView='+state.view)}));
import ApDailyReport from './ApDailyReport';
const auto={start_time:'14:00',end_time:'21:00',work_minutes:420,calls:195,absent:99,prospect:17,effective_rate:35.9,toss:1,closer:2};
function data(kind:string|null='closer') {return {auto,record:null,recent:[{...auto,report_date:'2026-10-28',kind:'closer',count:2,month_total:7,efficiency:0.08}],totals:{closer:7,toss:3},monthMinutes:420,employee:{name:'谷本　花子',number:'001',kind}};}
describe('AP日報の画面',()=>{
 beforeEach(()=>{state.view='today';vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>data()}));});
 afterEach(()=>{cleanup();vi.unstubAllGlobals();});
 it('役職に応じた固定区分、送信文と小数の現状合計',async()=>{render(<ApDailyReport/>);await screen.findByLabelText('現状合計');expect(screen.queryByRole('tab')).toBeNull();expect(screen.queryByRole('heading',{name:'日報'})).toBeNull();expect(screen.queryByRole('radiogroup')).toBeNull();expect((screen.getByLabelText('Chatwork に送る文') as HTMLTextAreaElement).value).toContain('本日獲得　2件');});
 it('トスでは現状合計を表示しない',async()=>{vi.mocked(fetch).mockResolvedValue({ok:true,json:async()=>data('toss')} as Response);render(<ApDailyReport/>);await screen.findByLabelText('トスの件数');expect(screen.queryByLabelText('現状合計')).toBeNull();});
 it('その他の役職は選択でき、切り替えで数字と文も変わる',async()=>{vi.mocked(fetch).mockResolvedValue({ok:true,json:async()=>data(null)} as Response);render(<ApDailyReport/>);await screen.findByRole('radiogroup');fireEvent.click(screen.getByRole('radio',{name:'トス'}));expect(screen.getByLabelText('トスの件数')).toHaveValue(1);expect((screen.getByLabelText('Chatwork に送る文') as HTMLTextAreaElement).value).toContain('トス1件');});
 it('振り返りに各指標を表示',async()=>{state.view='history';render(<ApDailyReport history/>);await screen.findByText('2026-10-28');expect(screen.queryByLabelText('日付')).toBeNull();expect(screen.queryByRole('tab')).toBeNull();expect(screen.getByText(/総コール195件・留守99件・見込み17件/)).toBeInTheDocument();});
 it('日付変更で一回取り直す',async()=>{render(<ApDailyReport/>);await screen.findByLabelText('現状合計');fireEvent.change(screen.getByLabelText('日付'),{target:{value:'2026-10-27'}});await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(2));expect(vi.mocked(fetch).mock.calls[1][0]).toContain('date=2026-10-27');});
});
