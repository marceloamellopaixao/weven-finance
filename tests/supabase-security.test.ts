import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const rls = readFileSync(resolve(process.cwd(), "supabase/rls.sql"), "utf8");
const authServer = readFileSync(resolve(process.cwd(), "src/lib/auth/server.ts"), "utf8");
const accessServer = readFileSync(resolve(process.cwd(), "src/lib/access-control/server.ts"), "utf8");
const supportAuthServer = readFileSync(resolve(process.cwd(), "src/lib/support/auth.server.ts"), "utf8");
const impersonationRoute = readFileSync(resolve(process.cwd(), "src/app/api/impersonation/route.ts"), "utf8");
const supportRoute = readFileSync(resolve(process.cwd(), "src/app/api/support-requests/route.ts"), "utf8");

test("authenticated clients cannot mutate profiles directly", () => {
  assert.match(
    rls,
    /revoke insert, update, delete, truncate, references, trigger\s+on table public\.profiles from anon, authenticated;/,
  );
  assert.doesNotMatch(rls, /create policy profiles_(?:insert|update)_own_or_staff/);
});

test("profile privileged fields have a defensive trigger", () => {
  assert.match(rls, /create or replace function public\.protect_profile_privileged_fields\(\)/);
  assert.match(rls, /new\.role is distinct from old\.role/);
  assert.match(rls, /new\.plan is distinct from old\.plan/);
  assert.match(rls, /new\.billing is distinct from old\.billing/);
  assert.match(rls, /create trigger trg_profiles_protect_privileged_fields/);
});

test("authenticated users only read public system configuration keys directly", () => {
  assert.match(rls, /key in \('plans', 'category_presets'\)/);
});

test("privileged APIs and impersonation require an aal2 token", () => {
  assert.match(authServer, /pathname\.startsWith\("\/api\/admin\/"\)/);
  assert.match(authServer, /request\.headers\.has\("x-impersonate-uid"\)/);
  assert.doesNotMatch(authServer, /pathname\.startsWith\("\/api\/impersonation"\)/);
  assert.match(authServer, /auth\.aal !== "aal2"/);
  assert.match(accessServer, /auth\.aal !== "aal2"/);
  assert.match(supportAuthServer, /export function requireSupportStaffMfa/);
  assert.match(supportRoute, /requireSupportStaffMfa\(auth\)/);
  assert.match(impersonationRoute, /requireImpersonationStaffMfa\(auth\.aal\)/);
});
