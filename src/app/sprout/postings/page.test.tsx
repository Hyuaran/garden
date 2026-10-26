import { it,expect,vi } from 'vitest';
vi.hoisted(()=>{process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';});
import { render,screen } from '@testing-library/react';
const m=vi.hoisted(()=>({user:vi.fn()}));
vi.mock('@/lib/auth/sprout-rill-view.server',()=>({RecruitMailView:async ({fallback}:{fallback:React.ReactNode})=>fallback}));
vi.mock('./baitoru-panel',()=>({default:()=> <div>掲載の登録</div>}));
import PostingsPage from './page';
it('shows the preparation message when super-admin access is denied',async()=>{
 m.user.mockResolvedValue(null);
 const page = await PostingsPage();
 render(await (page.type as (props: typeof page.props)=>Promise<React.ReactNode>)(page.props));expect(screen.getByText('準備中です')).toBeInTheDocument();
 expect(screen.queryByText('掲載の登録')).not.toBeInTheDocument();
});
