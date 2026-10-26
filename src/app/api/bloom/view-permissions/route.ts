import { readViewPermissions, viewPermissionContext, ViewPermissionError } from '@/lib/auth/view-permission.server';
export async function GET() {
  try {
    const { viewer } = await viewPermissionContext();
    const rows = (await readViewPermissions()).filter(row => /^(bloom|tree)-/.test(row.page_key));
    return Response.json({viewer,rows}, {headers:{'Cache-Control':'no-store'}});
  } catch (e) {
    if (e instanceof ViewPermissionError) return Response.json({error:e.message},{status:e.status});
    throw e;
  }
}
