import { NextResponse } from 'next/server';
import { verifyLiffEmployee } from '@/lib/line/liff-verify.server';
export const runtime = 'nodejs';
export async function POST(request: Request) {
 const body = await request.json().catch(() => null);
 const employee = await verifyLiffEmployee(body?.idToken);
 if (employee instanceof Response) return employee;
 return NextResponse.json({name: employee.name}, {headers: {'Cache-Control':'no-store'}});
}
