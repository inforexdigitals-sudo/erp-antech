import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { RequestContextService } from '../context/request-context.service';

@Global()
@Module({
  providers: [AuditService, RequestContextService],
  // RequestContextService must be exported too, not just AuditService —
  // AuthService injects it directly (for login_history's IP/user-agent),
  // and @Global() only makes a module's *exported* providers ambient;
  // anything left private stays invisible outside this module even so.
  exports: [AuditService, RequestContextService],
})
export class AuditModule {}
