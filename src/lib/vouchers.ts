import { createHash } from "crypto";

export function normalizeVoucherCode(code: string) {
  return code.trim().toUpperCase();
}

export function isValidVoucherCode(code: string) {
  return /^[A-Z0-9-]{8,32}$/.test(normalizeVoucherCode(code));
}

export function hashVoucherCode(code: string) {
  return createHash("sha256").update(normalizeVoucherCode(code)).digest("hex");
}
