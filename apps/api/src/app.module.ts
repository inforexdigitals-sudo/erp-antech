import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { ApprovalModule } from './common/approval/approval.module';
import { AuditModule } from './common/audit/audit.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { NumberingModule } from './common/numbering/numbering.module';
import { PrismaModule } from './database/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClaimsModule } from './modules/claims/claims.module';
import { CompanyModule } from './modules/company/company.module';
import { CrmModule } from './modules/crm/crm.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { HealthModule } from './modules/health/health.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { ProjectCostingModule } from './modules/project-costing/project-costing.module';
import { ProjectImportModule } from './modules/project-import/project-import.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { PurchaseOrdersModule } from './modules/purchase-orders/purchase-orders.module';
import { QuotationsModule } from './modules/quotations/quotations.module';
import { RolesModule } from './modules/roles/roles.module';
import { SubcontractorsModule } from './modules/subcontractors/subcontractors.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { TimesheetsModule } from './modules/timesheets/timesheets.module';
import { UsersModule } from './modules/users/users.module';
import { VariationOrdersModule } from './modules/variation-orders/variation-orders.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    // Global infrastructure (each @Global()-decorated; imported once, here).
    PrismaModule,
    AuditModule,
    ApprovalModule,
    NumberingModule,
    CryptoModule,

    // Feature modules built across Phase 5 batches 1-3 (Auth, Quotations,
    // Purchase Orders/Suppliers; Project Management, Project Costing;
    // Variation Orders, Timesheets/Leave) plus the minimal supporting
    // repositories they depend on (Users, CRM/Customers) — see
    // apps/api/README.md for what's a full module vs. a read-focused
    // stand-in. Inventory and CRM (beyond the Customers stub) are
    // deliberately deferred, not dropped — see docs/phase-5-backend-apis/README.md.
    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    CompanyModule,
    CrmModule,
    ProjectsModule,
    ProjectImportModule,
    ProjectCostingModule,
    QuotationsModule,
    SuppliersModule,
    PurchaseOrdersModule,
    VariationOrdersModule,
    TimesheetsModule,
    SubcontractorsModule,
    ClaimsModule,
    InvoicesModule,
    ProcurementModule,
    PayrollModule,
    DocumentsModule,
    DashboardModule,
  ],
  providers: [
    // Order matters: rate-limit first (cheapest, also throttles brute-force
    // login attempts), then authenticate, then authorize.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
