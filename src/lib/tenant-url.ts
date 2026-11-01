import { appUrl } from "./app-url";

export function tenantUrl(slug: string, pathname = "/") {
  const base = appUrl();
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN?.trim().toLowerCase();
  if (!appDomain || base.includes("localhost") || base.includes("127.0.0.1")) {
    return `/practice/${slug}${pathname === "/" ? "" : pathname}`;
  }
  const protocol = base.startsWith("https://") ? "https" : "http";
  return `${protocol}://${slug}.${appDomain}${pathname}`;
}