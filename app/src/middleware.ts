import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Site-wide maintenance mode. Toggle via MAINTENANCE_MODE env var in Vercel
 * and redeploy — off by default so a missing/unset var never accidentally
 * takes the site down.
 *
 * Payment webhooks stay reachable regardless — Stripe retries delivery on
 * failure, and blocking it during an outage would desync subscription state
 * for anyone who happens to pay while maintenance mode is on.
 */
const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === "true";

const MAINTENANCE_ALLOWLIST = ["/maintenance", "/api/stripe/webhook", "/favicon.ico"];

function isAllowedDuringMaintenance(pathname: string): boolean {
  if (pathname.startsWith("/_next")) return true;
  return MAINTENANCE_ALLOWLIST.some((p) => pathname.startsWith(p));
}

/**
 * Auth middleware — protects /dashboard/* routes.
 * Redirects unauthenticated users to /auth/login.
 * Refreshes session tokens on every request.
 */
export async function middleware(request: NextRequest) {
  if (MAINTENANCE_MODE && !isAllowedDuringMaintenance(request.nextUrl.pathname)) {
    return NextResponse.rewrite(new URL("/maintenance", request.url));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[]
        ) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options as never);
          });
        },
      },
    }
  );

  // Refresh the session (important for token rotation)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect dashboard routes
  if (request.nextUrl.pathname.startsWith("/dashboard") && !user) {
    const loginUrl = new URL("/auth/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect logged-in users away from login page
  if (request.nextUrl.pathname === "/auth/login" && user) {
    const dashUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashUrl);
  }

  return response;
}

export const config = {
  // Broadened from the original /dashboard + /auth/login scope so maintenance
  // mode can gate the whole site. The dashboard/login auth logic above is
  // still pathname-gated internally, so this widening doesn't change that
  // behavior — it only adds maintenance-mode coverage to every other route.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
