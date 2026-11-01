import { createHmac, timingSafeEqual } from "crypto";

export type SessionUser = {
  id: string;
  name: string;
  role: "PLATFORM_ADMIN" | "SUPER_ADMIN" | "ADMIN" | "VET";
  organizationId: string;
  organizationSlug: string;
};

function secret() {
  const configured = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && (!configured || configured.length < 32)) {
    throw new Error("SESSION_SECRET must be at least 32 characters in production.");
  }
  return configured || "vetkonnect-pos-local-dev-secret";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function encodeSession(user: SessionUser) {
  const body = Buffer.from(JSON.stringify({ ...user, iat: Date.now() })).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeSession(token: string | undefined | null): SessionUser | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionUser & {
      iat: number;
    };
    if (!data.id || !data.role || !data.name || !data.organizationId || !data.organizationSlug || !data.iat) return null;
    if (Date.now() - data.iat > 18 * 60 * 60 * 1000) return null;
    return {
      id: data.id,
      name: data.name,
      role: data.role,
      organizationId: data.organizationId,
      organizationSlug: data.organizationSlug,
    };
  } catch {
    return null;
  }
}
