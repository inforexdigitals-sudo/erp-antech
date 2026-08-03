/**
 * Bootstrap: creates one company, one "Owner" role granted every seeded
 * permission, and one user assigned that role. Demo customers are only
 * seeded in non-production runs (or when SEED_DEMO_DATA=true) — see
 * below.
 *
 * The company/role/user part stands in for the "new company"
 * signup/bootstrap flow that apps/api/README.md notes isn't built yet
 * (role/permission bootstrap on company creation is application logic,
 * not a migration — see db/migrations/README.md). Until that exists,
 * this is the only way to get a logged-in session at all; it's a
 * script, not an endpoint, deliberately — exposing "create a company
 * with full permissions" as a public API route would need real
 * signup/verification logic this doesn't attempt to fake.
 *
 * Production credentials: this file used to hardcode a single dev
 * login (owner@antech.test / AntechDev123!) — fine for local dev, not
 * something that should ever be the login for a real deployment (it's
 * printed in this repo's own README, and once the repo is pushed
 * anywhere, in this file's own history). SEED_OWNER_EMAIL/
 * SEED_OWNER_PASSWORD/SEED_OWNER_NAME/SEED_COMPANY_NAME override the
 * defaults; if NODE_ENV=production and SEED_OWNER_PASSWORD isn't set,
 * a random strong password is generated and printed once (there's no
 * self-service password reset yet — write it down immediately).
 *
 * The customers are seeded here for a different reason: CRM (module 2)
 * has no controller at all yet — `CustomersRepository` is read-only,
 * used internally by Quotations/Projects/Claims/Invoices to validate a
 * referenced `customerId`, with no way to create one through the API.
 * Those modules are otherwise fully built and usable, so rather than
 * build a CRM UI to unblock them (out of scope, deferred by explicit
 * request), a couple of customers are seeded directly so the rest of
 * the app has something real to reference. Not a substitute for CRM,
 * and not real customer data — skipped in production unless
 * SEED_DEMO_DATA=true is set explicitly.
 *
 * Idempotent — safe to re-run; each entity is looked up before create.
 * The Owner role's permission grants are also re-synced on every run
 * (not just created once) — a later migration adding a new permission
 * (e.g. db/migrations/0020's export permissions) would otherwise never
 * reach an already-seeded Owner role, since `role_permissions` was only
 * ever populated at role-creation time. Found exactly this way: PDF
 * export 403'd for the seeded Owner user after 0020 added
 * purchase_order.export/accounting.export post-seed.
 *
 * Run with: pnpm --filter ./apps/api db:seed
 */
import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const COMPANY_NAME = process.env.SEED_COMPANY_NAME ?? 'Antech Engineering Pte Ltd';
const OWNER_FULL_NAME = process.env.SEED_OWNER_NAME ?? 'Priya Ramachandran';
const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL ?? 'owner@antech.test';
const SEED_DEMO_DATA = process.env.SEED_DEMO_DATA === 'true' || !IS_PRODUCTION;

let ownerPassword = process.env.SEED_OWNER_PASSWORD;
let generatedPassword = false;
if (!ownerPassword) {
  if (IS_PRODUCTION) {
    // Random, URL-safe, always contains upper/lower/digit/symbol so it
    // passes any future password-strength check without relying on luck.
    ownerPassword = `${randomBytes(18).toString('base64').replace(/[+/=]/g, '')}Aa1!`;
    generatedPassword = true;
  } else {
    ownerPassword = 'AntechDev123!';
  }
}

const DEMO_CUSTOMERS = [
  { name: 'Marina Bayfront Developments Pte Ltd', registrationNumber: '201812345A', industry: 'Property Development' },
  { name: 'Straits Logistics Holdings', registrationNumber: '201956789K', industry: 'Logistics & Warehousing' },
  { name: 'Jurong Precision Manufacturing', registrationNumber: '202034567C', industry: 'Manufacturing' },
];

async function main(): Promise<void> {
  let company = await prisma.company.findFirst({ where: { name: COMPANY_NAME } });

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: COMPANY_NAME,
        legalName: COMPANY_NAME,
        baseCurrency: 'SGD',
        countryCode: 'SG',
      },
    });
    console.log(`Created company: ${company.name} (${company.id})`);
  } else {
    console.log(`Company already exists: ${company.name} (${company.id})`);
  }

  const permissions = await prisma.permission.findMany();
  if (permissions.length === 0) {
    throw new Error('No rows in permissions — run db/migrations/apply.sh (0016_seed_permissions.sql) first.');
  }

  let ownerRole = await prisma.role.findFirst({ where: { companyId: company.id, name: 'Owner' } });
  if (!ownerRole) {
    ownerRole = await prisma.role.create({
      data: {
        companyId: company.id,
        name: 'Owner',
        description: 'Full access — seeded dev role.',
        isSystemRole: true,
        rolePermissions: { create: permissions.map((p) => ({ permissionId: p.id })) },
      },
    });
    console.log(`Created role: ${ownerRole.name} — ${permissions.length} permissions`);
  } else {
    const granted = await prisma.rolePermission.findMany({ where: { roleId: ownerRole.id }, select: { permissionId: true } });
    const grantedIds = new Set(granted.map((g) => g.permissionId));
    const missing = permissions.filter((p) => !grantedIds.has(p.id));
    if (missing.length > 0) {
      await prisma.rolePermission.createMany({
        data: missing.map((p) => ({ roleId: ownerRole!.id, permissionId: p.id })),
      });
      console.log(`Backfilled ${missing.length} newly-seeded permission(s) onto role: ${ownerRole.name}`);
    } else {
      console.log(`Role already up to date: ${ownerRole.name} — ${granted.length} permissions`);
    }
  }

  const existingUser = await prisma.user.findFirst({ where: { email: OWNER_EMAIL } });
  if (!existingUser) {
    const passwordHash = await argon2.hash(ownerPassword!);
    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        fullName: OWNER_FULL_NAME,
        email: OWNER_EMAIL,
        passwordHash,
        jobTitle: 'Owner',
        userRoles: { create: [{ roleId: ownerRole.id }] },
      },
    });
    if (generatedPassword) {
      console.log('');
      console.log('================================================================');
      console.log(`  Created user: ${user.email}`);
      console.log(`  Password:     ${ownerPassword}`);
      console.log('  This password is shown ONCE — there is no reset flow yet.');
      console.log('  Save it now (a password manager, not a chat log).');
      console.log('================================================================');
      console.log('');
    } else {
      console.log(`Created user: ${user.email} / ${ownerPassword}`);
    }
  } else {
    console.log(`User already exists: ${existingUser.email}`);
  }

  if (SEED_DEMO_DATA) {
    for (const c of DEMO_CUSTOMERS) {
      const existing = await prisma.customer.findFirst({ where: { companyId: company.id, name: c.name } });
      if (existing) {
        console.log(`Customer already exists: ${c.name}`);
        continue;
      }
      await prisma.customer.create({
        data: { companyId: company.id, ...c, status: 'active' },
      });
      console.log(`Created customer: ${c.name}`);
    }
  } else {
    console.log('Skipped demo customers (production run — set SEED_DEMO_DATA=true to include them).');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
