import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // 画面の土台（layout）が「ログイン後の戻り先」に今のパスを使えるよう、要求ヘッダに載せる
  request.headers.set("x-pathname", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (request.nextUrl.pathname === '/system/line') return new NextResponse('403', {status:403});
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: auth } = await supabase.auth.getUser();
  if (request.nextUrl.pathname === '/system/line') {
    const { data: employee } = auth.user ? await supabase.from('root_employees').select('garden_role,is_active,termination_date,deleted_at').eq('user_id',auth.user.id).maybeSingle() : {data:null};
    const today = new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
    if (!employee || employee.garden_role !== 'super_admin' || !employee.is_active || employee.deleted_at || (employee.termination_date && employee.termination_date <= today)) return new NextResponse('403 この画面は全権管理者だけが開けます。',{status:403});
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml)$).*)",
  ],
};
