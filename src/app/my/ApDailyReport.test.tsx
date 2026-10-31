import { act, cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChartData, ChartOptions } from 'chart.js';
const chart=vi.hoisted(()=>({data:null as unknown as ChartData<'line'>,options:null as unknown as ChartOptions<'line'>}));
vi.mock('react-chartjs-2',()=>({Line:(props:{data:ChartData<'line'>;options:ChartOptions<'line'>})=>{chart.data=props.data;chart.options=props.options;return <div aria-label="日報の推移"/>;}}));
import ApDailyReport from './ApDailyReport';
const auto={start_time:'14:00',end_time:'21:00',work_minutes:420,calls:195,absent:99,prospect:17,effective_rate:35.9,toss:1,closer:2};
function data(kind:string|null='closer') {return {auto,record:null,recent:[{...auto,report_date:'2026-10-28',kind:'closer',count:2,month_total:7,efficiency:0.08,coin_created:99,guide_promised:null,guide_in_progress:0,statement_check_request:null,coin_total:100,reflection:'話をよく聞く\n次回は質問する',employee_name:'テスト',sent_count:1,auto_count:2}],totals:{closer:7,toss:3},monthMinutes:420,employee:{name:'谷本　花子',number:'001',kind}};}
describe('AP日報の画面',()=>{
 beforeEach(()=>{localStorage.clear();delete document.documentElement.dataset.theme;vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>data()}));HTMLDialogElement.prototype.showModal=vi.fn();HTMLDialogElement.prototype.close=vi.fn();});
 afterEach(()=>{cleanup();delete document.documentElement.dataset.theme;vi.unstubAllGlobals();});
 it('役職に応じた固定区分、送信文と小数の現状合計',async()=>{render(<ApDailyReport/>);await screen.findByLabelText('現状合計');expect(screen.queryByRole('radiogroup')).toBeNull();expect((screen.getByLabelText('Chatwork に送る文') as HTMLTextAreaElement).value).toContain('本日獲得　2件');expect(screen.queryByRole('button',{name:'表で見る'})).toBeNull();});
 it('トスでは現状合計を表示しない',async()=>{vi.mocked(fetch).mockResolvedValue({ok:true,json:async()=>data('toss')} as Response);render(<ApDailyReport/>);await screen.findByLabelText('トスの件数');expect(screen.queryByLabelText('現状合計')).toBeNull();});
 it('その他の役職は選択でき、切り替えで数字と文も変わる',async()=>{vi.mocked(fetch).mockResolvedValue({ok:true,json:async()=>data(null)} as Response);render(<ApDailyReport/>);await screen.findByRole('radiogroup');fireEvent.click(screen.getByRole('radio',{name:'トス'}));expect(screen.getByLabelText('トスの件数')).toHaveValue(1);});
 it('5本の線、古い日付順、左右の軸を渡す',async()=>{const result=data();result.recent.push({...result.recent[0],report_date:'2026-10-26',kind:'toss',calls:100});vi.mocked(fetch).mockResolvedValue({ok:true,json:async()=>result} as Response);render(<ApDailyReport history/>);await screen.findByLabelText('日報の推移');expect(chart.data.labels).toEqual(['10/26','10/28']);expect(chart.data.datasets.map(d=>d.label)).toEqual(['総コール','留守','見込み','トス・獲得','コイン作成数']);expect(chart.data.datasets.map(d=>d.yAxisID)).toEqual(['y','y','yRight','yRight','yRight']);expect(chart.data.datasets[0].data).toEqual([100,195]);expect(chart.options.interaction?.mode).toBe('index');expect(screen.queryByLabelText('日付')).toBeNull();});
 it('合計から率を計算し、日付の新しい順の行から日報を開く',async()=>{const result=data();result.recent.push({...result.recent[0],report_date:'2026-10-26',calls:5,absent:1,prospect:1,count:1,effective_rate:100});vi.mocked(fetch).mockResolvedValue({ok:true,json:async()=>result} as Response);render(<ApDailyReport history/>);await screen.findByLabelText('日報の推移');fireEvent.click(screen.getByRole('button',{name:'表で見る'}));const summary=screen.getByLabelText('合計');expect(within(summary).getByText('有効率 37.5%')).toBeInTheDocument();expect(within(summary).getByText('留守率 50.0%')).toBeInTheDocument();expect(within(summary).getByText('見込み率 9.0%')).toBeInTheDocument();expect(within(summary).getByText('獲得率 1.5%')).toBeInTheDocument();expect(screen.getAllByRole('row')[1]).toHaveTextContent('2026-10-28');fireEvent.click(screen.getByText('2026-10-28'));expect(screen.getByText('2026-10-28 の日報')).toBeInTheDocument();expect(screen.getByText(/話をよく聞く/)).toHaveTextContent('次回は質問する');expect(screen.getByText('コイン作成数',{selector:'dt'}).nextElementSibling).toHaveTextContent('99件');expect(screen.getAllByText('記録なし')).toHaveLength(2);expect(localStorage.getItem('garden.ap-daily-review.view')).toBe('table');fireEvent.click(screen.getByRole('button',{name:'グラフで見る'}));expect(screen.getByLabelText('日報の推移')).toBeInTheDocument();});
 it('保存した表表示を復元し、0コールの率は横棒',async()=>{localStorage.setItem('garden.ap-daily-review.view','table');const result=data();result.recent[0].calls=0;vi.mocked(fetch).mockResolvedValue({ok:true,json:async()=>result} as Response);render(<ApDailyReport history/>);await screen.findByText('2026-10-28');expect(screen.getAllByRole('row')[1].textContent).toContain('————');expect(screen.getByPlaceholderText('日付で探す')).toBeInTheDocument();});
 it('OSのダーク設定と明示の明暗切り替えを反映する',async()=>{
  let onChange=()=>{};
  const media={matches:true,addEventListener:vi.fn((_event:string,callback:()=>void)=>{onChange=callback;}),removeEventListener:vi.fn()};
  vi.stubGlobal('matchMedia',vi.fn(()=>media));
  render(<ApDailyReport history/>);await screen.findByLabelText('日報の推移');
  expect(chart.data.datasets[0].borderColor).toBe('#93B8EA');
  await act(async()=>{document.documentElement.dataset.theme='light';});
  expect(chart.data.datasets[0].borderColor).toBe('#10233F');
  await act(async()=>{document.documentElement.dataset.theme='dark';});
  expect(chart.data.datasets[0].borderColor).toBe('#93B8EA');
  await act(async()=>{delete document.documentElement.dataset.theme;media.matches=false;onChange();});
  expect(chart.data.datasets[0].borderColor).toBe('#10233F');
 });
 it('0件なら空の案内',async()=>{const result=data();result.recent=[];vi.mocked(fetch).mockResolvedValue({ok:true,json:async()=>result} as Response);render(<ApDailyReport history/>);await screen.findByText('まだありません');});
 it('日付変更で一回取り直す',async()=>{render(<ApDailyReport/>);await screen.findByLabelText('現状合計');fireEvent.change(screen.getByLabelText('日付'),{target:{value:'2026-10-27'}});await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(2));expect(vi.mocked(fetch).mock.calls[1][0]).toContain('date=2026-10-27');});
});
