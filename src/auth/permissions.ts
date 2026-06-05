import type { AppIdentity } from "./AuthShell";

const adminIdentifiers = new Set(["nakashima.keitarou@gmail.com", "keian"]);

export function isAdminIdentity(identity: AppIdentity) {
  const candidates = [identity.email, identity.displayName, identity.userId].filter(Boolean).map((value) => String(value).trim().toLowerCase());
  return candidates.some((value) => adminIdentifiers.has(value));
}
