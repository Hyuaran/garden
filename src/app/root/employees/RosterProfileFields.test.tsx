import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import RosterProfileFields from './RosterProfileFields';

it('renders compact grouped fields in the shared responsive grid', () => {
  const {container} = render(<RosterProfileFields categories={['address','contact','sub_account','commute','employment']} draft={{}} onChange={vi.fn()} disabled={false}/>);
  expect(screen.getByRole('heading',{name:'保険・年金'})).toBeInTheDocument();
  expect(screen.getByRole('heading',{name:'給与'})).toBeInTheDocument();
  expect(container.querySelector('[data-form-row]')).toBeNull();
  expect(screen.getByRole('textbox',{name:'口座2 金融機関コード'})).toHaveStyle({textAlign:'right'});
  const css = readFileSync('src/app/system/forms/_components/form-kit/form-kit.module.css','utf8');
  expect(css).toContain('repeat(3,minmax(0,1fr))');
  expect(css).toContain('@media(max-width:600px)');
});
it('uses SystemTabs with local selection and no URL mutation', () => {
  const page = readFileSync('src/app/root/employees/page.tsx','utf8');
  expect(page).toContain('<SystemTabs>');
  expect(page).toContain('onClick={()=>setEditTab(id)}');
  expect(page).not.toContain("searchParams.set('tab'");
  expect(page).not.toContain("get('tab')");
});
