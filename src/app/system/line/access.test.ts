import { expect,it,vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks=vi.hoisted(()=>({role:'staff',signedIn:true}));
vi.mock('@supabase/ssr',()=>({createServerClient:()=>({auth:{getUser:async()=>({data:{user:mocks.signedIn?{id:'user'}:null}})},from:()=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{garden_role:mocks.role,is_active:true,termination_date:null,deleted_at:null}})};return q;}})}));
import { middleware } from '@/middleware';
it('画面も全権管理者以外と未ログインをHTTP403にする',async()=>{
 vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://example.invalid');vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','test');
 try {
  for(const role of ['staff','manager','admin','super_admin']){
   mocks.role=role;mocks.signedIn=true;
   const r=await middleware(new NextRequest('http://localhost/system/line'));
   expect(r.status).toBe(role==='super_admin'?200:403);
  }
  mocks.signedIn=false;expect((await middleware(new NextRequest('http://localhost/system/line'))).status).toBe(403);
 } finally {vi.unstubAllEnvs();}
});
