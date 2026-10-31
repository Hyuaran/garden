import HelpButton from "@/app/system/_components/HelpButton/HelpButton";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import { requireLineAdmin } from '@/lib/line/tags.server';
import LineManager from './LineManager';
export default async function Page() {
  if(!await requireLineAdmin()) return <main><div className="garden-help-heading"><h1>403</h1><HelpButton /></div><SystemTabs /><p>この画面は全権管理者だけが開けます。</p></main>;
  return <LineManager />;
}
