import type { SessionUser } from "./session";

export function isVet(user: SessionUser) {
  return user.role === "VET" || user.role === "SUPER_ADMIN";
}

export function isAdmin(user: SessionUser) {
  return user.role === "ADMIN" || user.role === "SUPER_ADMIN";
}

export function isSuperAdmin(user: SessionUser) {
  return user.role === "SUPER_ADMIN";
}

export function roleLabel(role: string) {
  if (role === "VET") return "Veterinarian";
  if (role === "ADMIN") return "Admin";
  if (role === "SUPER_ADMIN") return "Super Admin";
  return role;
}
