import { NextRequest, NextResponse } from "next/server";

const VALID_ROLES = new Set(["employee", "manager", "admin"]);

const rolePathMap: Record<string, string> = {
  employee: "/employee",
  manager: "/manager",
  admin: "/admin",
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get("firebase-token")?.value;
  const role = request.cookies.get("user-role")?.value;

  if (!token || !role) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.set("firebase-token", "", { maxAge: 0, path: "/" });
    response.cookies.set("user-role", "", { maxAge: 0, path: "/" });
    return response;
  }

  if (!VALID_ROLES.has(role)) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.set("firebase-token", "", { maxAge: 0, path: "/" });
    response.cookies.set("user-role", "", { maxAge: 0, path: "/" });
    return response;
  }

  const allowedPath = rolePathMap[role];

  if (!pathname.startsWith(allowedPath)) {
    return NextResponse.redirect(new URL(allowedPath, request.url));
  }

  const response = NextResponse.next();
  response.headers.set("x-user-role", role);
  return response;
}

export const config = {
  matcher: ["/employee/:path*", "/manager/:path*", "/admin/:path*"],
};
