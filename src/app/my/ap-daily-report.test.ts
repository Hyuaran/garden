import { describe, expect, it } from 'vitest';
import { attendance, buildMessage, fixedKind, validateReport, type Report } from './ap-daily-report';
export const fixture: Report = {report_date:'2026-10-28',kind:'closer',start_time:'14:00',end_time:'21:00',work_minutes:420,calls:195,absent:99,prospect:17,effective_rate:35.897,count:0,auto_count:0,month_total:7,efficiency:0.08,reflection:'・質問攻めされた\n⇒すぐトークに戻って光割る',employee_name:'谷本　花子',sent_count:0,coin_created:99,guide_promised:null,guide_in_progress:null,statement_check_request:null,coin_total:100};
describe('AP日報',()=>{
  it('手書きと同じクローザー文・全角時刻・小数・コイン非掲載',()=>{
    expect(buildMessage(fixture)).toBe('【谷本 花子/クローザー】\n10月28日　14：00～21：00　　7時間稼働\n総コール195件(留守99件)（見込み17件）\n有効率35.9%（繋がった数÷総コール数）\n\n本日獲得　0件\n現状合計　7.0件　効率0.08\n\n【反省点】【それに対しての改善点】\n・質問攻めされた\n⇒すぐトークに戻って光割る');
  });
  it('トスには現状合計なし、訂正した本人の数字を使う',()=>{
    const text=buildMessage({...fixture,kind:'toss',count:3},true);
    expect(text).toMatch(/^（訂正）\n/); expect(text).toContain('トス3件'); expect(text).not.toContain('現状合計');
  });
  it('氏名の空白と区分を先頭にそろえる',()=>{expect(buildMessage({...fixture,employee_name:' 東海林　 美琴 '})).toMatch(/^【東海林 美琴\/クローザー】/);expect(buildMessage({...fixture,employee_name:'東海林 美琴',kind:'toss'})).toContain('【東海林 美琴/トス】');});
  it('区分の固定',()=>{expect(fixedKind('toss')).toBe('toss');expect(fixedKind('closer')).toBe('closer');expect(fixedKind('admin')).toBeNull();});
  it('必須反省、時刻前後、不正日付・件数を拒否',()=>{
    expect(validateReport(fixture)).toBe(fixture);
    for(const patch of [{reflection:' '},{end_time:'13:00'},{report_date:'2026-02-30'},{count:-1},{month_total:0.15},{coin_total:1.5},{work_minutes:421}]) expect(()=>validateReport({...fixture,...patch})).toThrow();
  });
  it('休憩を控除し、打刻がない日は空',()=>{
    expect(attendance([])).toEqual({start_time:'',end_time:'',work_minutes:0});
    expect(attendance([['clock_in','14:00'],['break_start','17:00'],['break_end','18:00'],['clock_out','21:00']].map(([punch_type,t])=>({punch_type,punched_at:`2026-10-28T${t}:00+09:00`})))).toEqual({start_time:'14:00',end_time:'21:00',work_minutes:360});
  });
});
