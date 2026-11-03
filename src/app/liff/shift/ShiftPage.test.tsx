import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('next/script',()=>({default:({onReady}:{onReady:()=>void})=><button onClick={onReady}>SDK準備完了</button>}));
import ShiftPage from './ShiftPage';
vi.mock('@/app/system/shift/MyShift',()=>({default:({token}:{token:string})=><p>シフトの提出画面 {token}</p>}));
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it('未設定なら準備中の文だけで通信しない',()=>{
  vi.stubEnv('NEXT_PUBLIC_LIFF_SHIFT_ID','');const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  const {container}=render(<ShiftPage/>);
  expect(container.textContent).toBe('準備中です');expect(fetch).not.toHaveBeenCalled();
});
it('LINE内で一度本人確認し、共通の提出画面を表示する',async()=>{
  vi.stubEnv('NEXT_PUBLIC_LIFF_SHIFT_ID','123-test');
  Object.assign(window,{liff:{init:vi.fn(async()=>{}),isInClient:()=>true,isLoggedIn:()=>true,getIDToken:()=> 'verified-token'}});
  const fetch=vi.fn(async()=>Response.json({name:'山田 太郎'}));vi.stubGlobal('fetch',fetch);
  render(<ShiftPage/>);fireEvent.click(screen.getByText('SDK準備完了'));fireEvent.click(screen.getByText('SDK準備完了'));
  await waitFor(()=>expect(screen.getByRole('heading',{name:'山田 太郎さんのシフト'})).toBeInTheDocument());
  expect(screen.getByText('シフトの提出画面 verified-token')).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(1);
});
