import { cookies } from "next/headers";
import { decodeSession, encodeSession, type SessionUser } from "./session-token";

const COOKIE = "ap_session";

export type { SessionUser };

export async function getSession() {
  const jar = await cookies();
  return decodeSession(jar.get(COOKIE)?.value);
}

export async function setSessionCookie(user: SessionUser) {
  const jar = await cookies();
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN?.trim().toLowerCase();
  const domain = process.env.NODE_ENV === "production" && appDomain ? `.${appDomain}` : undefined;
  jar.set(COOKIE, encodeSession(user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 18 * 60 * 60,
    secure: process.env.NODE_ENV === "production",
    ...(domain ? { domain } : {}),
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN?.trim().toLowerCase();
  const domain = process.env.NODE_ENV === "production" && appDomain ? `.${appDomain}` : undefined;
  if (domain) jar.set(COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0, secure: true, domain });
  else jar.delete(COOKIE);
}
