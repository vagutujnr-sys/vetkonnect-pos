import { NextRequest, NextResponse } from "next/server";

function sessionRoute(token: string | undefined) {
  if (!token) return null;
  try {
    const body = token.split(".")[0];
    if (!body) return null;
    const data = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/"))) as {
      organizationSlug?: string;
      role?: string;
    };
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.organizationSlug ?? "")) return null;
    return { slug: data.organizationSlug!, role: data.role };
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const session = sessionRoute(request.cookies.get("ap_session")?.value);
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN?.trim().toLowerCase();
  const host = request.nextUrl.hostname.toLowerCase();
  const isLocalHost = host === "localhost" || host === "127.0.0.1";
  const tenantSlug = appDomain && host.endsWith(`.${appDomain}`)
    ? host.slice(0, -(appDomain.length + 1))
    : null;

  if (tenantSlug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tenantSlug)) {
    if (session && session.role !== "PLATFORM_ADMIN" && session.slug !== tenantSlug) {
      const url = request.nextUrl.clone();
      url.hostname = `${session.slug}.${appDomain}`;
      return NextResponse.redirect(url);
    }
    const headers = new Headers(request.headers);
    headers.set("x-practice-code", tenantSlug);
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/tenant-login";
      return NextResponse.rewrite(url, { request: { headers } });
    }
    return NextResponse.next({ request: { headers } });
  }

  if (pathname.startsWith("/practice/")) {
    const [, , code, ...parts] = pathname.split("/");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code ?? "")) return NextResponse.next();
    if (session && session.role !== "PLATFORM_ADMIN" && session.slug !== code) {
      const url = request.nextUrl.clone();
      url.pathname = `/practice/${session.slug}${parts.length ? `/${parts.join("/")}` : ""}`;
      return NextResponse.redirect(url);
    }
    if (!session && parts.length && parts[0] !== "api" && parts[0] !== "manifest.webmanifest") {
      const url = request.nextUrl.clone();
      url.pathname = `/practice/${code}`;
      return NextResponse.redirect(url);
    }
    const headers = new Headers(request.headers);
    headers.set("x-practice-code", code);
    const url = request.nextUrl.clone();
    url.pathname = parts.length ? `/${parts.join("/")}` : "/tenant-login";
    return NextResponse.rewrite(url, { request: { headers } });
  }

  if (session && pathname !== "/register" && !pathname.startsWith("/register/")) {
    if (["/", "/sign-in", "/home"].includes(pathname) && appDomain && !isLocalHost && !host.endsWith(`.${appDomain}`)) {
      const url = request.nextUrl.clone();
      url.hostname = `${session.slug}.${appDomain}`;
      url.pathname = pathname === "/sign-in" ? "/" : pathname;
      return NextResponse.redirect(url);
    }
    const url = request.nextUrl.clone();
    url.pathname = `/practice/${session.slug}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js).*)"],
};