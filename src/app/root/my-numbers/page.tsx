import { withInitialUrlView } from "@/lib/ui/withInitialUrlView.server";
import {notFound} from 'next/navigation';
import {myNumberViewer} from '@/lib/my-number/access.server';
import {myNumberRows} from '@/lib/my-number/review.server';
import MyNumbers from './MyNumbers';
export const dynamic='force-dynamic';
async function Page() {
 if(!await myNumberViewer())notFound();
 return <MyNumbers rows={await myNumberRows()}/>;
}

export default withInitialUrlView(Page);
