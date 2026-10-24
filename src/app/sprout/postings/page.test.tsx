import { it,expect,vi } from 'vitest';
import { render,screen } from '@testing-library/react';
const m=vi.hoisted(()=>({user:vi.fn()}));
vi.mock('@/lib/sprout/access.server',()=>({sproutUser:m.user}));
vi.mock('./baitoru-panel',()=>({default:()=> <div>掲載の登録</div>}));
import PostingsPage from './page';
it('shows the preparation message when super-admin access is denied',async()=>{
 m.user.mockResolvedValue(null);
 render(await PostingsPage());expect(screen.getByText('準備中です')).toBeInTheDocument();
 expect(screen.queryByText('掲載の登録')).not.toBeInTheDocument();
});
