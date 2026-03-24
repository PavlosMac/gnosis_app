import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_AUTH_ROUTES = ["/user/login", "/user/register"];

export const proxy = (request: NextRequest) => {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get("access_token")?.value;
  const isAuthenticated = Boolean(accessToken);
  const isPublicAuthRoute = PUBLIC_AUTH_ROUTES.some((route) => pathname.startsWith(route));

  console.log("[AUTH:PROXY] Route guard", { pathname, isAuthenticated, isPublicAuthRoute });

  // Redirect unauthenticated users away from protected /user/* pages
  if (!isPublicAuthRoute && !isAuthenticated) {
    console.log("[AUTH:PROXY] Unauthenticated — redirecting to login", { from: pathname });
    const loginUrl = new URL("/user/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login/register
  if (isPublicAuthRoute && isAuthenticated) {
    console.log("[AUTH:PROXY] Already authenticated — redirecting to profile");
    return NextResponse.redirect(new URL("/user/profile", request.url));
  }

  return NextResponse.next();
};

export const config = {
  matcher: ["/user/:path*"],
};
