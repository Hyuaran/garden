import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import MyNumberPrompt from './MyNumberPrompt';
beforeEach(()=>{HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it.each([null,{status:'rejected',rejection_reason:'写真を確認してください'}])('未提出と差し戻しを案内し、あとではサーバーへ記録する %j',async row=>{
 const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({row,prompt:true})});vi.stubGlobal('fetch',fetcher);
 render(<MyNumberPrompt locked={false} profile/>);
 await screen.findByRole('dialog');fireEvent.click(screen.getByRole('button',{name:'あとで'}));
 await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 expect(fetcher).toHaveBeenCalledWith('/api/system/mypage/my-number',{method:'PATCH'});
});
it.each([{row:null,prompt:false},{row:{status:'pending',my_number_last4:'9018'},prompt:false},{row:{status:'confirmed',my_number_last4:'9018'},prompt:false}])('当日延期または提出済みは案内しない %j',async status=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>status}));render(<MyNumberPrompt locked={false} profile/>);
 await waitFor(()=>expect(screen.queryByText('確認中')).toBeNull());expect(screen.queryByRole('dialog')).toBeNull();
});
it('3か月ごとの確認が終わるまで案内を待ち、取得は一度',async()=>{
 const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({row:null,prompt:true})});vi.stubGlobal('fetch',fetcher);
 const view=render(<MyNumberPrompt locked profile/>);await waitFor(()=>expect(fetcher).toHaveBeenCalledOnce());expect(screen.queryByRole('dialog')).toBeNull();
 view.rerender(<MyNumberPrompt locked={false} profile/>);await screen.findByRole('dialog');expect(fetcher).toHaveBeenCalledOnce();
});
