import { requireLineAdmin } from '@/lib/line/tags.server';
import { loadMenuSettings } from '@/lib/line/richmenu.server';
import { menuGroups, type MenuGroup } from '@/lib/line/richmenu';
import { renderMenuImage } from '@/lib/line/richmenu-image.server';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  if (!await requireLineAdmin()) return new Response(null,{status:403});
  const group = new URL(request.url).searchParams.get('group') as MenuGroup;
  if (!menuGroups.includes(group)) return new Response(null,{status:400});
  try {
    const image = await renderMenuImage(group,(await loadMenuSettings()).contacts);
    return new Response(new Uint8Array(image.data),{headers:{'Content-Type':image.contentType,'Cache-Control':'private, no-store'}});
  } catch { return Response.json({error:'画像を作成できませんでした。'},{status:500}); }
}
