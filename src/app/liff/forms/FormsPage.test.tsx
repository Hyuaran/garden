import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
vi.mock('next/script',()=>({default:({onReady}:{onReady:()=>void})=><button onClick={onReady}>ready</button>}));
import FormsPage from './FormsPage';
beforeEach(()=>{vi.stubEnv('NEXT_PUBLIC_LIFF_FORMS_ID','123-forms');Object.assign(window,{liff:{init:vi.fn(async()=>{}),isInClient:()=>true,isLoggedIn:()=>true,getIDToken:()=> 'token'}});});
afterEach(()=>{cleanup();vi.unstubAllEnvs();vi.unstubAllGlobals();});
it('does not fetch outside LINE',async()=>{
 Object.assign(window,{liff:{init:async()=>{},isInClient:()=>false,isLoggedIn:()=>false}});
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);render(<FormsPage/>);fireEvent.click(screen.getByText('ready'));expect(await screen.findByText('LINE の中で開いてください')).toBeInTheDocument();expect(fetch).not.toHaveBeenCalled();
});
it('denies non employees',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>Response.json({}, {status:403})));render(<FormsPage/>);fireEvent.click(screen.getByText('ready'));expect(await screen.findByText('この画面は従業員の方だけが使えます')).toBeInTheDocument();});
it('uses surname, validates, submits once and adds history without refetch',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(Response.json({name:'山田 太郎',rows:[]})).mockResolvedValueOnce(Response.json({row:{id:'1',submission_type:'commute_route',status:'received',created_at:'2026-10-29T00:00:00Z'}},{status:201}));
 vi.stubGlobal('fetch',fetch);render(<FormsPage/>);fireEvent.click(screen.getByText('ready'));
 expect(await screen.findByRole('heading',{name:'山田さんの申告'})).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('2 新しい最寄り駅'),{target:{value:'新宿'}});fireEvent.change(screen.getByLabelText('3 適用希望日'),{target:{value:'2026-11-01'}});
 fireEvent.submit(screen.getByRole('button',{name:'送信する'}).closest('form')!);
 expect(await screen.findByText('送信しました。担当者が確認します。')).toBeInTheDocument();
 await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(2));expect(screen.getByText(/2026\/10\/29.*受付/)).toBeInTheDocument();
 expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({submission_type:'commute_route',payload:{station:'新宿',effectiveDate:'2026-11-01'}});
});
