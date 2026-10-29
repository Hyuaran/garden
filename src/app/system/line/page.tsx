import { requireLineAdmin } from '@/lib/line/tags.server';
import LineManager from './LineManager';
export default async function Page() {
  if(!await requireLineAdmin()) return <main><h1>403</h1><p>この画面は全権管理者だけが開けます。</p></main>;
  return <LineManager />;
}
